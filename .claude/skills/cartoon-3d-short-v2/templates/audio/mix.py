#!/usr/bin/env python3
# Auto-Synced Audio Pipeline for Shorts-Studio v2.
# Reads out/<short>/timeline.json directly (never drifts from story.ts!), synthesizes all foley events,
# composes a driving 120 BPM synth-bass escalation score that hard-stops at the `music_stop` event (frame 1486),
# ducks -3 dB under speech spans from words.json (or auto-generates a silent placeholder voice if testing without VO),
# and masters to -14.5 LUFS integrated / -1.2 dBTP true-peak ceiling.
import argparse
import json
import os
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, ns, st, pan, place, dbg, read_wav, write_wav, integrated, true_peak, lra, fades, hp, lp, make_ir, convolve_st, rng)
import instruments as I
import sfx_gen as G

TARGET_LUFS = -14.5
CEIL_DBTP = -1.2
DUCK_DB = -3.0

def build_sfx(tl, N, v_ref):
    r = rng(2026)
    out = np.zeros((2, N))
    send = np.zeros(N)

    # Ambience beds per shot
    for s in tl["shots"]:
        t0 = s["a"] / tl["fps"]
        dur = (s["b"] - s["a"]) / tl["fps"]
        if s["set"] in ("highway", "car_cabin"):
            bed = G.amb_highway(dur, r, rain=(s["light"] == "rain"))
            cur = integrated(bed)
            if np.isfinite(cur):
                bed *= dbg((v_ref - 24.0) - cur)
            place(out, bed, t0)
        elif s["set"] in ("street", "mansion", "tower", "plant"):
            # outdoor sets without traffic: a thin wind bed (the "nobody is here" room tone)
            bed = G.amb_wind(dur, r)
            cur = integrated(bed)
            if np.isfinite(cur):
                bed *= dbg((v_ref - 27.0) - cur)
            place(out, bed, t0)

    # Discrete timeline events
    dispatch = {
        "brake_slam":    (lambda: G.brake_slam(r), -7.0),
        "tire_screech":  (lambda: G.tire_screech(r, wet=False), -8.0),
        "crash_impact":  (lambda: G.car_crash(r, 1.15), -4.5),
        "cash_register": (lambda: G.cash_register(r), -7.5),
        "money_rain":    (lambda: G.money_rain(r), -10.0),
        "lane_swoop":    (lambda: G.tire_screech(r, dur=0.65, wet=False), -11.0),
        "phone_ring":    (lambda: G.phone_ring(r), -9.0),
        "counter_flip":  (lambda: G.counter_flip(r), -8.5),
        "hottub_bubbles":(lambda: G.hottub_bubbles(r), -13.0),
        "siren_chirp":   (lambda: G.siren_chirp(r), -9.5),
        "wiper_sweep":   (lambda: G.wiper_sweep(r), -12.0),
        "camera_beep":   (lambda: G.camera_beep(r), -7.5),
        "alarm_clock":   (lambda: G.alarm_clock(r), -13.0),
        "wind_gust":     (lambda: G.wind_gust(r), -14.0),
        "phone_ringout": (lambda: G.phone_ringout(r), -13.0),
        "whoosh":        (lambda: G.whoosh(r), -9.0),
        "engine_rev":    (lambda: G.engine_rev(r), -8.0),
        "cart_rattle":   (lambda: G.cart_rattle(r), -12.0),
        "crown_ding":    (lambda: G.crown_ding(r), -10.0),
        "power_down":    (lambda: G.power_down(r), -5.0),
        "steam_hiss":    (lambda: G.steam_hiss(r), -13.0),
        "tap_sputter":   (lambda: G.tap_sputter(r), -10.0),
        "water_drip":    (lambda: G.water_drip(r), -9.0),
        "flies_buzz":    (lambda: G.flies_buzz(r), -13.0),
        "radio_static":  (lambda: G.radio_static(r), -9.0),
        "ghost_chime":   (lambda: G.ghost_chime(r), -10.0),
        "crowd_murmur":  (lambda: G.crowd_murmur(r), -12.0),
    }

    for ev in tl["events"]:
        tp = ev["type"]
        if tp not in dispatch:
            continue
        fn, rel_db = dispatch[tp]
        sig = fn() * float(ev.get("gain", 1.0))
        sig = pan(sig, float(ev.get("pan", 0.0))) if sig.ndim == 1 else sig
        cur = integrated(sig)
        if np.isfinite(cur):
            sig *= dbg((v_ref + rel_db) - cur)
        place(out, sig, float(ev["time_s"]))
        i0 = ns(float(ev["time_s"]))
        m = min(sig.shape[1], N - i0)
        if m > 0:
            send[i0:i0 + m] += 0.15 * sig[:, :m].mean(0)

    ir = make_ir(0.95, 42, pre=0.01, hf=1.5)
    out += 0.45 * convolve_st(send, ir)
    return hp(out, 28, 2)

def build_score(tl, N):
    r = rng(909)
    out = np.zeros((2, N))
    dur_s = tl["duration_s"]
    stop_ev = next((e["time_s"] for e in tl["events"] if e["type"] == "music_stop"), 49.5)

    # 120 BPM driving sneaky bassline + snare groove up to `music_stop`, then warm resolve chord at 55.0s
    beat = 0.5
    notes = [38, 38, 41, 43, 38, 38, 45, 43] # D minor sneaky pulse
    k = 0
    t = 0.0
    while t < stop_ev - 0.05:
        m = notes[k % len(notes)]
        f = I.m2f(m)
        bass = I.pluck(f, 0.78, r, dur=0.44, bright=0.65)
        place(out, pan(bass, -0.05), t)
        if k % 2 == 1:
            sn = I.snare(0.45, r, dur=0.22, snappy=0.8)
            place(out, pan(sn, 0.08), t)
        else:
            br = I.brush(0.35, r, dur=0.18)
            place(out, pan(br, -0.15), t + beat * 0.5)
        t += beat
        k += 1

    # Hard stop right before the quiet driver points to the dashcam
    stop_idx = ns(stop_ev)
    out[:, stop_idx:] = 0.0

    lonely_ev = next((e["time_s"] for e in tl["events"] if e["type"] == "music_lonely"), None)
    resolve_ev = next((e["time_s"] for e in tl["events"] if e["type"] == "music_resolve"), None)

    # Optional sparse "empty world" section (music_lonely -> music_resolve): slow music-box arpeggios over a low pad
    if lonely_ev is not None:
        end = resolve_ev if resolve_ev is not None else dur_s
        chords = [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [45, 52, 57, 61]]  # Dm - C - Bb - A
        step, bar = 0.75, 3.0
        t, k = lonely_ev, 0
        while t < end - 0.4:
            ch = chords[(k // 4) % len(chords)]
            if k % 4 == 0:
                seg = min(bar + 0.6, end - t)
                place(out, I.pad([I.m2f(m - 12) for m in ch[:3]], seg, 0.2, r, att=0.9, rel=0.9), t)
            note = ch[[0, 2, 3, 2][k % 4]] + 12
            place(out, pan(I.musicbox(I.m2f(note), 0.42, r, dur=1.5), 0.2 * (-1) ** k), t)
            t += step
            k += 1

    # Payoff pad: at the music_resolve event (warm F add9) when the timeline has one, else the original 55.0 s Dm pad
    if resolve_ev is not None:
        if dur_s - resolve_ev > 0.5:
            pad = I.pad([I.m2f(41), I.m2f(53), I.m2f(57), I.m2f(60), I.m2f(67)], dur_s - resolve_ev, 0.5, r, att=0.5, rel=0.6)
            place(out, pad, resolve_ev)
            for i, m in enumerate([72, 77, 81, 84]):
                tn = resolve_ev + 0.9 + i * 0.6
                if tn < dur_s - 0.3:
                    place(out, pan(I.musicbox(I.m2f(m), 0.4, r, dur=1.6), 0.15 * (-1) ** i), tn)
    elif dur_s > 55.0:
        pad = I.pad([I.m2f(50), I.m2f(57), I.m2f(62), I.m2f(65)], dur_s - 55.0, 0.48, r, att=0.4, rel=0.5)
        place(out, pad, 55.0)

    return hp(out, 32, 2)

def limiter(x, ceil_db=CEIL_DBTP):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[:4 * n].reshape(n, 4).max(1)
    gr = ndimage.minimum_filter1d(np.minimum(1.0, c / np.maximum(pk, 1e-12)), ns(0.006) + 1, mode="nearest")
    gr = ndimage.uniform_filter1d(gr, ns(0.006) + 1, mode="nearest")
    return x * np.minimum(gr, 1.0)[None, :]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeline", default="out/dashcam/timeline.json")
    ap.add_argument("--voice", default="voice/voice.wav")
    ap.add_argument("--words", default="voice/words.json")
    ap.add_argument("--out", default="audio/mix.wav")
    args = ap.parse_args()

    tl = json.load(open(args.timeline, encoding="utf-8"))
    N = ns(tl["duration_s"])

    if os.path.exists(args.voice):
        vx, sr = read_wav(args.voice)
        assert sr == SR, f"Expected {SR} Hz voice.wav, got {sr}"
        mono = vx[0] if vx.shape[0] == 1 else vx.mean(0)
        v = np.zeros(N)
        v[:min(N, len(mono))] = mono[:N]
        v = st(v)
        v_ref = integrated(v)
    else:
        print("[mix] No voice.wav found yet; mixing instrumental + foley stem preview at -16 LUFS reference.")
        v = np.zeros((2, N))
        v_ref = -16.0

    sfx = build_sfx(tl, N, v_ref)
    mus = build_score(tl, N)
    cur_m = integrated(mus)
    if np.isfinite(cur_m):
        mus *= dbg((v_ref - 10.5) - cur_m)

    if os.path.exists(args.words):
        words = json.load(open(args.words, encoding="utf-8"))
        duck = np.ones(N)
        for w in words:
            a, b = max(0, ns(float(w["s"]) - 0.06)), min(N, ns(float(w["e"]) + 0.10))
            duck[a:b] = dbg(DUCK_DB)
        duck = ndimage.uniform_filter1d(duck, ns(0.08), mode="nearest")
        mus *= duck[None, :]

    mix0 = v + mus + sfx
    L0 = integrated(mix0)
    gain = (TARGET_LUFS - L0) if np.isfinite(L0) else 0.0
    master = fades(limiter(mix0 * dbg(gain)), 0.005, 0.04)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_wav(args.out, master)
    print(f"[mix] Wrote {args.out} | Integrated={integrated(master):.2f} LUFS | TruePeak={true_peak(master):.2f} dBTP | LRA={lra(master):.2f} LU")

if __name__ == "__main__":
    main()
