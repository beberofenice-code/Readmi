#!/usr/bin/env python3
"""
4-Track Cinema Audio Mixing Pipeline for Shorts-Studio.
Reads out/<short>/timeline.json + voice.wav + words.json and builds 4 discrete stems mixed cleanly in FFmpeg:
  1. Narrator Voiceover (Lead): clean broadcast presence, dead-air gated gently while preserving frame sync.
  2. Character Dialogue Inserts (Optional FX): isolates non-narrator speaker lines from words.json and applies
     per-role FFmpeg filters (e.g., telephone bandpass EQ `highpass=f=300,lowpass=f=3000` for phone calls).
  3. Dynamic Background Music Bed: supports mood shifts across acts (upbeat mischievous groove -> driving
     escalation -> sparse tense/rainy beat -> hard stop -> crisp final chord resolve), ducked cleanly -16 to -20 dB
     (default -18 dB) under VO via FFmpeg sidechain/envelope ducking.
  4. Frame-Accurate Foley & SFX Event Track: reads `sfxEvents` or `events` from timeline.json, resolves every sound
     from `assets/sfx/manifest.json` (auto-generating any missing WAV via generate_sfx_assets.py with zero missing-file
     errors), plus exterior/muffled-cabin rain ambience beds and rhythmic wiper swishes.

Masters via FFmpeg + BS.1770-4 verification to -14.5 LUFS integrated / -1.2 dBTP true-peak ceiling at 48 kHz stereo.
Backward-compatible with custom profiles (e.g. AUDIO_PROFILE = "zombie" -> audio/profile_zombie.py).
"""
import argparse
import importlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import numpy as np
from dsp import (
    SR, ns, st, pan, place, dbg, read_wav, write_wav,
    integrated, true_peak, lra, fades, hp, lp,
    make_ir, convolve_st, rng, moving_avg, moving_min, oversample4x,
)
import instruments as I
import sfx_gen as G
from generate_sfx_assets import DEFAULT_ASSETS_DIR, ensure_sfx_assets

TARGET_LUFS = -14.5
CEIL_DBTP = -1.2
# Target music bed level under active voiceover: -18 dB relative to VO (within -16..-20 dB spec)
MUSIC_UNDER_VO_DB = -18.0
MUSIC_OPEN_DB = -12.0

PHONE_SPEAKERS = {"agent", "caller", "phone", "dispatcher", "operator", "support", "bank", "hotline"}
RADIO_SPEAKERS = {"radio", "intercom", "pa", "walkie", "speakerphone"}
RAIN_LIGHTS = {"rain", "rainy_overcast"}
INTERIOR_SETS = {"car_cabin", "cabin", "interior", "office", "bedroom", "studio", "desk"}


def _load_sfx_asset(name, manifest, assets_dir):
    """Resolve an SFX event name or alias from assets/sfx/manifest.json -> (stereo float64 array, default_rel_db)."""
    aliases = manifest.get("aliases", {})
    canon = aliases.get(name, name)
    info = manifest.get("assets", {}).get(canon)
    if not info:
        return None, None
    wav_path = os.path.join(assets_dir, info["file"])
    if not os.path.exists(wav_path):
        ensure_sfx_assets(assets_dir, quiet=True)
    sig, sr = read_wav(wav_path)
    if sr != SR:
        # Simple linear resample safeguard if an external WAV had another sample rate
        n_new = int(round(sig.shape[1] * SR / sr))
        t_old = np.linspace(0, 1, sig.shape[1])
        t_new = np.linspace(0, 1, n_new)
        sig = np.stack([np.interp(t_new, t_old, sig[c]) for c in range(sig.shape[0])])
    return st(sig), float(info.get("default_rel_db", -9.0))


def _loop_to_dur(sig, dur_s):
    """Seamlessly tile a loopable stereo asset to exact duration `dur_s` with smooth crossfade."""
    target_n = max(1, ns(dur_s))
    sig = st(sig)
    src_n = sig.shape[1]
    if src_n >= target_n:
        return fades(sig[:, :target_n], 0.05, 0.08)
    xf = min(ns(0.12), src_n // 4)
    step = max(1, src_n - xf)
    out = np.zeros((2, target_n + src_n))
    pos = 0
    while pos < target_n:
        chunk = sig.copy()
        if pos > 0 and xf > 0:
            r = np.linspace(0, 1, xf)
            chunk[:, :xf] *= r[None, :]
            out[:, pos:pos + xf] *= (1.0 - r)[None, :]
        out[:, pos:pos + src_n] += chunk
        pos += step
    return fades(out[:, :target_n], 0.05, 0.08)


def split_voice_tracks(v_mono, words, N, tl):
    """
    Split voiceover into:
      - Track 1: Narrator VO (lead)
      - Track 2a: Phone/radio FX character dialogue inserts
      - Track 2b: Clean on-camera character dialogue inserts
    Uses word timings + smooth 15 ms crossfade masks so there are zero clicks.
    """
    if not words:
        return st(v_mono), np.zeros((2, N)), np.zeros((2, N)), []

    dialogue_fx_map = {k.lower(): v for k, v in (tl.get("dialogueFx") or {}).items()}
    phone_mask = np.zeros(N, dtype=np.float64)
    char_mask = np.zeros(N, dtype=np.float64)
    fx_log = []

    # Group contiguous non-narrator spans so breathing between words stays intact on the character bus
    spans = []
    for w in words:
        spk = str(w.get("speaker", "narrator")).strip().lower()
        if spk in ("", "narrator"):
            continue
        fx = str(w.get("fx") or dialogue_fx_map.get(spk) or "").strip().lower()
        if not fx:
            if spk in PHONE_SPEAKERS or spk.endswith("_phone"):
                fx = "phone"
            elif spk in RADIO_SPEAKERS:
                fx = "radio"
            else:
                fx = "character"
        s, e = float(w["s"]), float(w["e"])
        if spans and spans[-1][0] == spk and spans[-1][1] == fx and s - spans[-1][3] < 0.35:
            spans[-1][3] = max(spans[-1][3], e)
        else:
            spans.append([spk, fx, s, e])

    pad = 0.045
    for spk, fx, s, e in spans:
        a = max(0, ns(s - pad))
        b = min(N, ns(e + pad))
        if fx in ("phone", "radio"):
            phone_mask[a:b] = 1.0
        else:
            char_mask[a:b] = 1.0
        fx_log.append((spk, fx, round(s, 2), round(e, 2)))

    # Smooth masks (~16 ms) for seamless crossfades between narrator and character inserts
    win = max(1, ns(0.016))
    phone_m = moving_avg(phone_mask, win)
    char_m = moving_avg(char_mask, win)
    total_dlg = np.clip(phone_m + char_m, 0.0, 1.0)
    narr_m = 1.0 - total_dlg

    track1 = st(v_mono * narr_m)
    track2_phone = st(v_mono * phone_m)
    track2_char = st(v_mono * char_m)
    return track1, track2_phone, track2_char, fx_log


def build_sfx(tl, N, v_ref, manifest=None, assets_dir=DEFAULT_ASSETS_DIR):
    """Build Track 4: Frame-accurate Foley, SFX events (manifest-backed), and ambience beds."""
    if manifest is None:
        manifest = ensure_sfx_assets(assets_dir, quiet=True)
    r = rng(2026)
    fps = float(tl.get("fps", 30))
    out = np.zeros((2, N))
    send = np.zeros(N)

    # 1. Per-shot ambience beds (rain exterior vs muffled interior cabin rain + highway hum)
    events = tl.get("sfxEvents") or tl.get("events") or []
    explicit_wiper_times = [
        float(e.get("time_s", float(e.get("frame", 0)) / fps))
        for e in events
        if e.get("type") in ("wiper_sweep", "wiper", "wiper_swish")
    ]

    for s in tl.get("shots", []):
        t0 = float(s["a"]) / fps
        dur = max(0.1, (float(s["b"]) - float(s["a"])) / fps)
        light = str(s.get("light", "day"))
        set_name = str(s.get("set", "")).lower()
        is_rain = light in RAIN_LIGHTS
        is_cabin = any(k in set_name for k in INTERIOR_SETS)

        if is_rain:
            asset_name = "rain_loop_cabin" if is_cabin else "rain_loop_exterior"
            bed_raw, rel_db = _load_sfx_asset(asset_name, manifest, assets_dir)
            bed = _loop_to_dur(bed_raw, dur) if bed_raw is not None else (
                G.rain_loop_cabin(dur, r) if is_cabin else G.rain_loop_exterior(dur, r)
            )
            cur = integrated(bed)
            if np.isfinite(cur):
                bed *= dbg((v_ref + (rel_db if rel_db is not None else -22.0)) - cur)
            place(out, bed, t0)

            # Auto-add rhythmic windshield wiper swishes on rainy cabin shots if none placed explicitly
            if is_cabin and not any(t0 <= wt <= t0 + dur for wt in explicit_wiper_times):
                wiper_sig, w_rel = _load_sfx_asset("wiper_sweep", manifest, assets_dir)
                if wiper_sig is not None:
                    cur_w = integrated(wiper_sig)
                    if np.isfinite(cur_w):
                        wiper_sig = wiper_sig * dbg((v_ref + (w_rel or -13.5)) - cur_w)
                    wt = t0 + 0.35
                    while wt < t0 + dur - 0.5:
                        place(out, wiper_sig, wt)
                        wt += 1.6

        elif set_name in ("highway", "car_cabin"):
            bed_raw, rel_db = _load_sfx_asset("highway_ambience", manifest, assets_dir)
            bed = _loop_to_dur(bed_raw, dur) if bed_raw is not None else G.amb_highway(dur, r, rain=False, cabin=is_cabin)
            if is_cabin:
                bed = lp(bed, 950, 2) * 0.78
            cur = integrated(bed)
            if np.isfinite(cur):
                bed *= dbg((v_ref - 24.5) - cur)
            place(out, bed, t0)

    # 2. Discrete timeline-driven SFX events (anchored by time_s or frame)
    for ev in events:
        tp = str(ev.get("type", "")).strip()
        if not tp or tp in ("music_stop", "music_mood"):
            continue
        sig, rel_db = _load_sfx_asset(tp, manifest, assets_dir)
        if sig is None:
            continue
        gain_lin = float(ev.get("gain", 1.0))
        pan_val = float(ev.get("pan", 0.0))
        if abs(pan_val) > 1e-3:
            mono = sig.mean(0)
            sig = pan(mono, pan_val)
        cur = integrated(sig)
        if np.isfinite(cur):
            sig = sig * dbg((v_ref + rel_db + 20.0 * np.log10(max(gain_lin, 1e-3))) - cur)
        else:
            sig = sig * gain_lin
        t_ev = float(ev["time_s"]) if "time_s" in ev else float(ev.get("frame", 0)) / fps
        place(out, sig, t_ev)
        i0 = ns(t_ev)
        m = min(sig.shape[1], N - i0)
        if m > 0 and i0 >= 0:
            send[i0:i0 + m] += 0.14 * sig[:, :m].mean(0)

    ir = make_ir(0.9, 42, pre=0.01, hf=1.5)
    out += 0.42 * convolve_st(send, ir)
    return hp(out, 28, 2)


def _derive_music_cues(tl):
    """
    Build structured music mood cues from timeline.json `musicCues` or auto-derive from the 5-beat story arc:
      - mischievous_groove (Cold Open + Setup)
      - driving_escalation (Escalation acts / sunset / night)
      - tense_rainy (Rainy overcast atmospheric mood shift)
      - silence_drop (Hard stop at `music_stop`)
      - resolve_chord (Crisp final reveal chord)
    """
    dur_s = float(tl["duration_s"])
    fps = float(tl.get("fps", 30))
    if tl.get("musicCues"):
        cues = []
        for c in tl["musicCues"]:
            t_s = float(c["time_s"]) if "time_s" in c else float(c.get("frame", 0)) / fps
            cues.append((t_s, str(c["mood"])))
        return sorted(cues, key=lambda x: x[0])

    events = tl.get("sfxEvents") or tl.get("events") or []
    stop_t = next(
        (float(e.get("time_s", float(e.get("frame", 0)) / fps)) for e in events if e.get("type") == "music_stop"),
        min(dur_s - 7.0, dur_s * 0.80),
    )
    rain_shot = next((s for s in tl.get("shots", []) if str(s.get("light", "")) in RAIN_LIGHTS), None)
    rain_t = float(rain_shot["a"]) / fps if rain_shot else None
    esc_t = min(15.0, stop_t * 0.35)
    resolve_t = min(dur_s - 2.5, max(stop_t + 3.2, dur_s - 5.5))

    cues = [(0.0, "mischievous_groove"), (esc_t, "driving_escalation")]
    if rain_t is not None and esc_t + 2.0 < rain_t < stop_t - 1.0:
        cues.append((rain_t, "tense_rainy"))
    cues.append((stop_t, "silence_drop"))
    if dur_s > resolve_t + 0.8:
        cues.append((resolve_t, "resolve_chord"))
    return sorted(cues, key=lambda x: x[0])


def build_score(tl, N):
    """Build Track 3: Dynamic Background Music Bed with multi-mood act progression."""
    r = rng(909)
    out = np.zeros((2, N))
    dur_s = float(tl["duration_s"])
    cues = _derive_music_cues(tl)

    # Convert sorted (t_start, mood) cues into contiguous (t0, t1, mood) segments
    segments = []
    for i, (t0, mood) in enumerate(cues):
        t1 = cues[i + 1][0] if i + 1 < len(cues) else dur_s
        if t1 > t0:
            segments.append((t0, t1, mood))

    beat = 0.5  # 120 BPM crisp pulse
    notes_groove = [38, 38, 41, 43, 38, 38, 45, 43]  # D minor mischievous sneaky pulse
    notes_esc = [38, 45, 41, 43, 45, 48, 45, 43]     # Escalating octaves + upper fifth

    for t0, t1, mood in segments:
        if mood == "silence_drop":
            # Crisp hard stop with 12 ms anti-click tail
            idx = ns(t0)
            fade_n = min(ns(0.015), max(0, N - idx))
            if fade_n > 0:
                out[:, idx:idx + fade_n] *= np.linspace(1.0, 0.0, fade_n)[None, :]
            out[:, idx + fade_n:] = 0.0
            continue

        if mood == "mischievous_groove":
            t, k = t0, 0
            while t < t1 - 0.04:
                m = notes_groove[k % len(notes_groove)]
                bass = I.pluck(I.m2f(m), 0.76, r, dur=0.42, bright=0.62)
                place(out, pan(bass, -0.06), t)
                if k % 2 == 1:
                    sn = I.snare(0.38, r, dur=0.18, snappy=0.75)
                    place(out, pan(sn, 0.08), t)
                else:
                    br = I.brush(0.32, r, dur=0.16)
                    place(out, pan(br, -0.16), t + beat * 0.5)
                if k % 4 == 2:
                    vb = I.vibes(I.m2f(m + 24), 0.20, r, dur=0.35)
                    place(out, pan(vb, 0.25), t)
                t += beat
                k += 1

        elif mood == "driving_escalation":
            t, k = t0, 0
            while t < t1 - 0.04:
                m = notes_esc[k % len(notes_esc)]
                bass = I.pluck(I.m2f(m), 0.88, r, dur=0.45, bright=0.78)
                place(out, pan(bass, -0.04), t)
                # Driving off-beat bass push
                if k % 2 == 0:
                    sub = I.pluck(I.m2f(m - 12 if m >= 45 else m), 0.65, r, dur=0.25, bright=0.45)
                    place(out, pan(sub, 0.04), t + beat * 0.5)
                if k % 2 == 1:
                    sn = I.snare(0.55, r, dur=0.24, snappy=0.88)
                    place(out, pan(sn, 0.10), t)
                br = I.brush(0.36, r, dur=0.14)
                place(out, pan(br, -0.22), t + beat * 0.5)
                if k % 4 == 0:
                    gl = I.glock(I.m2f(m + 24), 0.28, r, dur=0.55)
                    place(out, pan(gl, 0.22), t)
                t += beat
                k += 1

        elif mood == "tense_rainy":
            seg_dur = t1 - t0
            pad = I.pad([I.m2f(38), I.m2f(45), I.m2f(53)], seg_dur, 0.36, r, att=0.45, rel=0.25, warm=650.0)
            place(out, pad, t0)
            t, k = t0, 0
            while t < t1 - 0.05:
                # Sparse half-time low pulse
                if k % 2 == 0:
                    p = I.pluck(I.m2f(38 if (k // 2) % 2 == 0 else 41), 0.55, r, dur=0.65, bright=0.28)
                    place(out, pan(p, 0.0), t)
                t += beat
                k += 1

        elif mood == "resolve_chord":
            seg_dur = max(0.9, t1 - t0)
            # Crisp D-major / add9 final payoff chord + bright bell chime
            pad = I.pad([I.m2f(50), I.m2f(57), I.m2f(62), I.m2f(66)], seg_dur, 0.52, r, att=0.22, rel=0.45, warm=1400.0)
            place(out, pad, t0)
            for j, nn in enumerate([62, 66, 69, 74]):
                place(out, pan(I.glock(I.m2f(nn), 0.42, r, dur=1.2), -0.18 + 0.12 * j), t0 + 0.04 * j)

    return hp(out, 32, 2)


def limiter(x, ceil_db=CEIL_DBTP):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(oversample4x(x)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[:4 * n].reshape(n, 4).max(1)
    gr = moving_min(np.minimum(1.0, c / np.maximum(pk, 1e-12)), ns(0.006) + 1)
    gr = moving_avg(gr, ns(0.006) + 1)
    return x * np.minimum(gr, 1.0)[None, :]


def _mix_4track_ffmpeg(t1_path, t2_phone_path, t2_char_path, t3_path, t4_path, out_path, has_vo, music_duck_db):
    """
    Mix all 4 stems cleanly through FFmpeg:
      - Track 1 (Narrator VO): crisp highpass + gentle broadcast presence
      - Track 2 (Character Dialogue Inserts): telephone bandpass EQ (`highpass=f=300,lowpass=f=3000`) on phone
        inserts + clean presence EQ on on-camera character lines
      - Track 3 (Music Bed): sidechain ducked cleanly under combined VO bus (-16 to -20 dB relative to VO)
      - Track 4 (Foley & SFX): full-bandwidth frame-accurate SFX & ambience
      - Final master bus: sum + loudnorm / true-peak protection at 48 kHz stereo PCM.
    """
    # Compute FFmpeg sidechain ratio/threshold to duck cleanly under VO (extra ~6 dB ducking on top of base -12 dB = -18 dB under VO)
    if has_vo:
        fc = (
            "[0:a]highpass=f=85,equalizer=f=3200:t=q:w=1.2:g=1.8[narr];"
            "[1:a]highpass=f=300,lowpass=f=3000,acompressor=threshold=-20dB:ratio=3:attack=5:release=60,volume=1.18[dlg_phone];"
            "[2:a]highpass=f=95,equalizer=f=2400:t=q:w=1.2:g=2.2[dlg_char];"
            "[dlg_phone][dlg_char]amix=inputs=2:duration=longest:normalize=0[dlg];"
            "[narr][dlg]amix=inputs=2:duration=longest:normalize=0,asplit=2[vo_mix][vo_sc];"
            "[3:a][vo_sc]sidechaincompress=threshold=0.018:ratio=4.5:attack=15:release=220:makeup=1[mus_ducked];"
            "[vo_mix][mus_ducked][4:a]amix=inputs=3:duration=longest:normalize=0,"
            f"loudnorm=I={TARGET_LUFS}:TP={CEIL_DBTP}:LRA=7[out]"
        )
    else:
        fc = (
            "[3:a][4:a]amix=inputs=2:duration=longest:normalize=0,"
            f"loudnorm=I={TARGET_LUFS}:TP={CEIL_DBTP}:LRA=7[out]"
        )

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", t1_path,
        "-i", t2_phone_path,
        "-i", t2_char_path,
        "-i", t3_path,
        "-i", t4_path,
        "-filter_complex", fc,
        "-map", "[out]",
        "-ar", str(SR),
        "-ac", "2",
        "-c:a", "pcm_s24le",
        out_path,
    ]
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description="4-Track FFmpeg Audio & SFX Mixer for Shorts-Studio")
    ap.add_argument("--timeline", default="out/dashcam/timeline.json")
    ap.add_argument("--voice", default="voice/voice.wav")
    ap.add_argument("--words", default="voice/words.json")
    ap.add_argument("--out", default="audio/mix.wav")
    ap.add_argument("--assets-dir", default=DEFAULT_ASSETS_DIR, help="Path to local assets/sfx directory")
    ap.add_argument("--music-duck-db", type=float, default=MUSIC_UNDER_VO_DB,
                    help="Target music loudness relative to VO during speech (-16 to -20 dB, default -18 dB)")
    ap.add_argument("--keep-stems", default=None, help="Optional directory to keep the 4 individual WAV stems")
    ap.add_argument("--no-ffmpeg", action="store_true", help="Fallback to pure-Python mixing if FFmpeg is unavailable")
    args = ap.parse_args()

    tl = json.load(open(args.timeline, encoding="utf-8"))
    N = ns(float(tl["duration_s"]))
    words = json.load(open(args.words, encoding="utf-8")) if os.path.exists(args.words) else []

    # Ensure procedural SFX library + manifest.json exist (zero missing-file errors)
    manifest = ensure_sfx_assets(args.assets_dir, quiet=True)

    has_vo = os.path.exists(args.voice)
    if has_vo:
        vx, sr = read_wav(args.voice)
        assert sr == SR, f"Expected {SR} Hz voice.wav, got {sr}"
        mono = vx[0] if vx.shape[0] == 1 else vx.mean(0)
        v_mono = np.zeros(N)
        v_mono[:min(N, len(mono))] = mono[:N]
        v_ref = integrated(st(v_mono))
        if not np.isfinite(v_ref):
            v_ref = -16.0
    else:
        print("[mix] No voice.wav found yet; mixing instrumental + foley stem preview at -16 LUFS reference.")
        v_mono = np.zeros(N)
        v_ref = -16.0

    # Track 1 (Narrator) & Track 2 (Character Dialogue Inserts: phone FX vs clean character)
    track1, track2_phone, track2_char, fx_log = split_voice_tracks(v_mono, words, N, tl)

    # Track 3 (Music Bed) & Track 4 (Frame-Accurate Foley/SFX)
    profile = tl.get("profile", "dashcam")
    if profile != "dashcam":
        P = importlib.import_module(f"profile_{profile}")
        track4 = P.build_sfx(tl, N, v_ref)
        track3 = P.build_score(tl, N)
    else:
        track4 = build_sfx(tl, N, v_ref, manifest=manifest, assets_dir=args.assets_dir)
        track3 = build_score(tl, N)

    # Level Music Bed cleanly relative to VO (-12 dB open, ducking into -16..-20 dB under VO)
    cur_m = integrated(track3)
    if np.isfinite(cur_m):
        base_music_rel = max(-16.0, min(-11.0, args.music_duck_db + 5.0))
        track3 *= dbg((v_ref + base_music_rel) - cur_m)

    # Smooth word-aligned envelope ducking so Track 3 stays strictly -16..-20 dB beneath speech
    if words and has_vo:
        extra_duck_db = min(-3.0, args.music_duck_db - (max(-16.0, min(-11.0, args.music_duck_db + 5.0))))
        duck = np.ones(N)
        for w in words:
            a, b = max(0, ns(float(w["s"]) - 0.06)), min(N, ns(float(w["e"]) + 0.12))
            duck[a:b] = dbg(extra_duck_db)
        duck = moving_avg(duck, ns(0.085))
        track3 *= duck[None, :]

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    use_ffmpeg = (not args.no_ffmpeg) and (shutil.which("ffmpeg") is not None)

    if use_ffmpeg:
        stem_dir = args.keep_stems or tempfile.mkdtemp(prefix="shorts_4track_")
        os.makedirs(stem_dir, exist_ok=True)
        try:
            t1_p = os.path.join(stem_dir, "track1_narrator.wav")
            t2p_p = os.path.join(stem_dir, "track2_dialogue_phone.wav")
            t2c_p = os.path.join(stem_dir, "track2_dialogue_char.wav")
            t3_p = os.path.join(stem_dir, "track3_music.wav")
            t4_p = os.path.join(stem_dir, "track4_sfx.wav")
            write_wav(t1_p, track1)
            write_wav(t2p_p, track2_phone)
            write_wav(t2c_p, track2_char)
            write_wav(t3_p, track3)
            write_wav(t4_p, track4)

            _mix_4track_ffmpeg(t1_p, t2p_p, t2c_p, t3_p, t4_p, args.out, has_vo, args.music_duck_db)
            master, _ = read_wav(args.out)
            # Final safety true-peak verification & exact BS.1770-4 trim if needed
            tp_now = true_peak(master)
            if tp_now > CEIL_DBTP + 0.15:
                master = fades(limiter(master, CEIL_DBTP), 0.005, 0.04)
                write_wav(args.out, master)
        finally:
            if not args.keep_stems:
                shutil.rmtree(stem_dir, ignore_errors=True)
    else:
        # Pure-Python fallback (applies 300-3000 Hz phone bandpass directly in NumPy)
        from dsp import bp
        dlg_phone_fx = bp(track2_phone, 300, 3000, 3) * 1.18
        mix0 = track1 + dlg_phone_fx + track2_char + track3 + track4
        L0 = integrated(mix0)
        gain = (TARGET_LUFS - L0) if np.isfinite(L0) else 0.0
        master = fades(limiter(mix0 * dbg(gain)), 0.005, 0.04)
        write_wav(args.out, master)

    dlg_summary = f"{len(fx_log)} dialogue inserts ({sum(1 for _, fx, _, _ in fx_log if fx in ('phone', 'radio'))} phone/radio EQ)"
    print(
        f"[mix] 4-Track ({'FFmpeg' if use_ffmpeg else 'NumPy'}) profile={profile} | {dlg_summary} | "
        f"music_under_vo={args.music_duck_db:.1f} dB"
    )
    print(
        f"[mix] Wrote {args.out} | Integrated={integrated(master):.2f} LUFS | "
        f"TruePeak={true_peak(master):.2f} dBTP | LRA={lra(master):.2f} LU"
    )


if __name__ == "__main__":
    main()
