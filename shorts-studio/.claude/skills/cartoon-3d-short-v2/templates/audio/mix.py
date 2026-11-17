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
        st_name, night = s["set"], s["light"] == "night"
        if st_name in ("highway", "car_cabin"):
            bed = G.amb_highway(dur, r, rain=(s["light"] == "rain"))
        elif st_name == "street":
            bed = G.amb_street(dur, r)
        elif st_name in ("terrace", "pool") or (st_name == "bedroom" and night):
            bed = G.amb_night(dur, r, murmur=(st_name == "terrace"))
        elif st_name in ("kitchen", "bedroom", "study", "office"):
            bed = G.amb_room(dur, r)
        else:
            continue
        cur = integrated(bed)
        if np.isfinite(cur):
            bed *= dbg((v_ref - 24.0) - cur)
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
        "clock_tick":    (lambda: G.clock_tick(r), -17.0),
        "alarm_ring":    (lambda: G.alarm_ring(r), -11.0),
        "whoosh":        (lambda: G.whoosh(r), -8.0),
        "coffee_pour":   (lambda: G.coffee_pour(r), -15.0),
        "page_flutter":  (lambda: G.page_flutter(r), -11.0),
        "book_shut":     (lambda: G.book_shut(r), -7.5),
        "chess_clack":   (lambda: G.chess_clack(r), -12.0),
        "king_topple":   (lambda: G.king_topple(r), -9.5),
        "chalk_scribble":(lambda: G.chalk_scribble(r), -12.0),
        "sneeze":        (lambda: G.sneeze(r), -6.0),
        "door_open":     (lambda: G.door_open(r), -12.0),
        "footstep":      (lambda: G.footstep(r), -14.0),
        "crosswalk_beep":(lambda: G.crosswalk_beep(r), -15.0),
        "glass_clink":   (lambda: G.glass_clink(r), -13.0),
        "pigeon_flap":   (lambda: G.pigeon_flap(r), -12.0),
        "stone_thud":    (lambda: G.stone_thud(r), -9.0),
        "toaster_pop":   (lambda: G.toaster_pop(r), -4.5),
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
    ev_t = lambda tp, default: next((e["time_s"] for e in tl["events"] if e["type"] == tp), default)
    stop_ev = ev_t("music_stop", 49.5)
    # optional score cues (absent in older timelines -> classic behaviour):
    #   score_fast: racing sixteenth-note glock arpeggio joins the groove (a mind running hot)
    #   score_slow: groove drops to a trudging half-time with a low tuba (the world at 1x)
    #   pad_in:     start of the warm resolve chord (default 55.0 s)
    fast_ev, slow_ev = ev_t("score_fast", None), ev_t("score_slow", None)
    pad_ev = ev_t("pad_in", 55.0)

    # 120 BPM driving sneaky bassline + snare groove up to `music_stop`
    beat = 0.5
    notes = [38, 38, 41, 43, 38, 38, 45, 43] # D minor sneaky pulse
    arp = [74, 77, 81, 86, 81, 77, 74, 69, 74, 77, 84, 86, 84, 81, 77, 72]
    k = 0
    t = 0.0
    while t < stop_ev - 0.05:
        slow = slow_ev is not None and t >= slow_ev - 1e-6
        step = beat * 2 if slow else beat
        m = notes[k % len(notes)]
        f = I.m2f(m)
        bass = I.pluck(f, 0.78, r, dur=0.44 if not slow else 0.8, bright=0.65 if not slow else 0.4)
        place(out, pan(bass, -0.05), t)
        if slow:
            if k % 2 == 0:
                tb = I.brass(I.m2f(m - 12), 0.7, 0.5, r, kind="tuba")
                place(out, pan(tb, 0.1), t, 0.55)
            br = I.brush(0.3, r, dur=0.3, swish=True)
            place(out, pan(br, -0.15), t + step * 0.5)
        elif k % 2 == 1:
            sn = I.snare(0.45, r, dur=0.22, snappy=0.8)
            place(out, pan(sn, 0.08), t)
        else:
            br = I.brush(0.35, r, dur=0.18)
            place(out, pan(br, -0.15), t + beat * 0.5)
        if fast_ev is not None and t >= fast_ev - 1e-6 and not slow:
            for j in range(4):
                tj = t + j * beat / 4
                if tj >= stop_ev - 0.05 or (slow_ev is not None and tj >= slow_ev):
                    break
                g = I.glock(I.m2f(arp[(k * 4 + j) % len(arp)]), 0.32 if j else 0.42, r, dur=0.5)
                place(out, pan(g, 0.35 * np.sin(k * 0.9 + j)), tj, 0.5)
        t += step
        k += 1

    # Hard stop at `music_stop`
    stop_idx = ns(stop_ev)
    out[:, stop_idx:] = 0.0

    # Payoff reveal pad (pad_in -> end)
    if dur_s > pad_ev + 0.3:
        pad = I.pad([I.m2f(50), I.m2f(57), I.m2f(62), I.m2f(65)], dur_s - pad_ev, 0.48, r, att=0.4, rel=0.5)
        place(out, pad, pad_ev)

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
