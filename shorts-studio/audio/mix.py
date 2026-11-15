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

# Ambience beds for non-vehicle sets: (generator, level in LU relative to the voice)
AMB_BEDS = {
    "street": (G.amb_city, -25.0),
    "office": (G.amb_office, -26.0),
    "apartment": (G.amb_room, -30.0),
    "beach": (G.amb_beach, -19.0),
}

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
        elif s["set"] in AMB_BEDS:
            fn, rel = AMB_BEDS[s["set"]]
            bed = fn(dur, r)
            cur = integrated(bed)
            if np.isfinite(cur):
                bed *= dbg((v_ref + rel) - cur)
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
        "shadow_rise":   (lambda: G.shadow_rise(r), -9.0),
        "stretch_squeak":(lambda: G.stretch_squeak(r), -11.0),
        "soft_steps":    (lambda: G.soft_steps(r), -14.0),
        "peel_snap":     (lambda: G.peel_snap(r), -6.5),
        "whoosh":        (lambda: G.whoosh(r), -10.0),
        "briefcase_thud":(lambda: G.briefcase_thud(r), -7.0),
        "keyboard":      (lambda: G.keyboard(r), -15.0),
        "mail_slot":     (lambda: G.mail_slot(r), -8.5),
        "card_flip":     (lambda: G.card_flip(r), -11.0),
        "phone_beep":    (lambda: G.phone_beep(r), -12.0),
        "ticket_stamp":  (lambda: G.ticket_stamp(r), -7.5),
        "shoe_thud":     (lambda: G.shoe_thud(r), -9.0),
        "shimmer":       (lambda: G.shimmer(r), -8.0),
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
    resolve_ev = next((e["time_s"] for e in tl["events"] if e["type"] == "music_resolve"), None)
    if resolve_ev is not None:
        return build_score_whimsy(tl, N, stop_ev, resolve_ev, r)

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

    # Payoff reveal pad (54.8s -> end)
    if dur_s > 55.0:
        pad = I.pad([I.m2f(50), I.m2f(57), I.m2f(62), I.m2f(65)], dur_s - 55.0, 0.48, r, att=0.4, rel=0.5)
        place(out, pad, 55.0)

    return hp(out, 32, 2)

def build_score_whimsy(tl, N, stop_ev, resolve_ev, r):
    """Timelines with a `music_resolve` event: light 112 BPM pizzicato + music-box groove in G up to `music_stop`,
    silence for the question, then a warm G - Em - C pad bed with sparse music-box notes from `music_resolve` to the end."""
    out = np.zeros((2, N))
    dur_s = tl["duration_s"]
    beat = 60.0 / 112.0
    bass = [43, 50, 47, 50, 40, 47, 45, 50]            # G D B D | E B A D
    mel = [79, 83, 86, 83, 81, 79, 76, 74, 79, 86, 88, 86, 83, 81, 79, 83]
    k, t = 0, 0.0
    while t < stop_ev - 0.05:
        place(out, pan(I.pluck(I.m2f(bass[k % len(bass)]), 0.7, r, dur=0.5, bright=0.55), -0.08), t)
        if k % 2 == 1:
            place(out, pan(I.brush(0.32, r, dur=0.16), 0.2), t)
        if k >= 8 and k % 2 == 0:                      # melody enters after the hook line
            place(out, pan(I.musicbox(I.m2f(mel[(k // 2) % len(mel)]), 0.42, r, dur=1.2), 0.18), t + beat * 0.5)
        t += beat
        k += 1
    stop_idx = ns(stop_ev)
    tail = ns(0.12)
    out[:, stop_idx:stop_idx + tail] *= np.linspace(1, 0, tail)[None, :min(tail, N - stop_idx)] if stop_idx + tail <= N else 0
    out[:, stop_idx + tail:] = 0.0

    span = dur_s - resolve_ev
    chords = [([43, 50, 55, 59, 62], 0.0, 0.42), ([40, 52, 55, 59, 64], 0.36, 0.3), ([36, 48, 55, 60, 64], 0.62, 0.38)]
    for notes, u0, ulen in chords:
        t0 = resolve_ev + u0 * span
        d = max(1.0, min(ulen * span, dur_s - t0 - 0.9))
        place(out, I.pad([I.m2f(m) for m in notes], d, 0.46, r, att=0.9, rel=1.4), t0)
    for i, m in enumerate([79, 83, 86, 91, 88, 86, 83, 86, 91, 95]):
        tn = resolve_ev + 1.2 + i * (span - 3.0) / 10.0
        place(out, pan(I.musicbox(I.m2f(m), 0.34, r, dur=2.0), 0.25 * (-1) ** i), tn)
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
