# "The Beggar's Gutter Trick" (cigarette) audio profile for audio/mix.py (timeline.json "profile": "cigarette").
# Track 4 = manifest SFX (whoosh, pop, cash register, counter flip, camera beep... via mix.build_sfx) + procedural period
# foley (carriage on cobbles, cigar crunch, coin clink, cannon, candlestick-phone bells, thunder, wrench clanks, crank
# ratchet, the rolling machine's clatter loop) + per-set ambience beds (sunny Seville street, factory murmur, camp fire,
# office clock, rain on the barn: muffled inside, open outside).
# Track 3 = the stock 5-mood score from mix.build_score driven by the story's MUSIC_CUES.
import copy
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, dbg, lp, hp, bp, resbank, colored, smooth_noise, fades, phase, modal,
                 pan, st, place, widen, integrated)
import sfx_gen as G
import profile_zombie as Z

CUSTOM = {"carriage_rumble", "cigar_crunch", "tobacco_shred", "coin_clink", "crowd_murmur", "cannon_boom", "poster_unroll",
          "bell_phone", "thunder", "metal_clank", "drip", "crank_ratchet", "machine_start"}


def mplace(buf, x, t):
    """add a mono signal into a mono buffer at time t (s)"""
    i = ns(t)
    a, b = max(0, i), min(len(buf), i + len(x))
    if b > a:
        buf[a:b] += x[a - i:b - i]


def _lvl(x, v_ref, rel_db):
    cur = integrated(st(x))
    return x * dbg((v_ref + rel_db) - cur) if np.isfinite(cur) else x


# ----------------------------------------------------------------------------- one-shots
def carriage_rumble(r, dur=2.2):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.6) / 0.7)
    rumble = lp(colored(n, r, 2.0), 260, 2) * (0.7 + 0.3 * smooth_noise(n, r, 9.0)) * env
    rim = bp(r.standard_normal(n), 900, 4200, 2) * (0.5 + 0.5 * np.abs(np.sin(TAU * 7.5 * t))) ** 6 * env * 0.5
    hooves = np.zeros(n)
    k = 0.02
    while k < dur - 0.1:  # three-beat gallop
        for off, a in ((0.0, 1.0), (0.09, 0.8), (0.17, 0.9)):
            i = ns(k + off)
            clop = modal(0.09, [(320 + r.uniform(-30, 30), 1.0, 0.018), (780, 0.5, 0.01), (1500, 0.25, 0.006)], r)
            m = min(len(clop), n - i)
            if m > 0:
                hooves[i:i + m] += clop[:m] * a * env[i]
        k += 0.36
    return fades(widen(rumble * 1.1 + rim + hooves * 1.3, r, 9, 0.6), 0.005, 0.2)


def cigar_crunch(r):
    dur = 0.4
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for _ in range(140):
        tm = abs(r.normal(0.0, 0.05))
        i = ns(tm)
        L = min(ns(0.006), n - i)
        if L > 2:
            y[i:i + L] += bp(r.standard_normal(L), 1200, 7000, 1) * np.exp(-np.arange(L) / SR / 0.0015) * r.uniform(0.3, 1.0)
    thump = np.sin(phase(90 * (1 + 0.8 * np.exp(-t / 0.02)))) * np.exp(-t / 0.06) * 1.4
    return fades(widen(y * 1.3 + thump, r, 5, 0.4), 0.0005, 0.05)


def tobacco_shred(r, dur=0.8):
    n = ns(dur)
    t = np.arange(n) / SR
    y = bp(r.standard_normal(n), 1500, 7500, 2) * (0.5 + 0.5 * np.sin(TAU * 9 * t)) ** 3
    return fades(widen(y * np.exp(-t / 0.6), r, 6, 0.5), 0.01, 0.1)


def coin_clink(r):
    out = np.zeros(ns(0.7))
    for k, (tm, a) in enumerate(((0.0, 1.0), (0.12, 0.45), (0.19, 0.25))):
        c = modal(0.4, [(3150, 1.0, 0.12), (5230, 0.6, 0.07), (7400, 0.3, 0.04)], r)
        mplace(out, c * a, tm)
    return fades(out, 0.0005, 0.05)


def crowd_murmur(r, dur=2.2):
    y = np.zeros(ns(dur))
    for k in range(6):
        v = Z.chatter_voice(r, dur, 120 + 70 * r.random(), excited=k % 2 == 0)
        y[:len(v)] += v[:len(y)] * r.uniform(0.5, 1.0)
    return fades(widen(y, r, 13, 0.8), 0.15, 0.4)


def cannon_boom(r):
    dur = 3.2
    n = ns(dur)
    t = np.arange(n) / SR
    sub = np.sin(phase(42 * (1 + 1.2 * np.exp(-t / 0.03)))) * np.exp(-t / 0.35) * 2.4
    blast = lp(r.standard_normal(n), 2400, 2) * np.exp(-t / 0.09) * 1.6
    tail = lp(colored(n, r, 2.0), 180, 2) * np.exp(-t / 1.1) * np.clip(t / 0.05, 0, 1) * 0.9
    return fades(widen(sub + blast + tail, r, 14, 0.9), 0.0005, 0.4)


def bell_phone(r, dur=1.05):
    n = ns(dur)
    y = np.zeros(n)
    k, i = 0, 0.0
    while i < dur - 0.08:  # 20 Hz hammer alternating between two gongs
        f0 = 1180 if k % 2 == 0 else 1460
        g = modal(0.12, [(f0, 1.0, 0.05), (f0 * 2.76, 0.35, 0.02)], r)
        mplace(y, g, i)
        i += 0.05
        k += 1
    return fades(y * 0.5, 0.002, 0.08)


def thunder(r, dur=3.6):
    n = ns(dur)
    t = np.arange(n) / SR
    crack = bp(r.standard_normal(n), 400, 5000, 2) * np.exp(-t / 0.12) * np.clip(t / 0.01, 0, 1)
    roll = lp(colored(n, r, 2.0), 220, 2) * (0.6 + 0.4 * smooth_noise(n, r, 3.0)) * np.exp(-t / 1.3) * np.clip(t / 0.25, 0, 1)
    return fades(widen(crack * 0.6 + roll * 1.4, r, 18, 1.0), 0.005, 0.6)


def metal_clank(r):
    return fades(modal(0.6, [(620, 1.0, 0.09), (1610, 0.7, 0.06), (2870, 0.5, 0.04), (4300, 0.25, 0.02)], r), 0.0005, 0.05)


def drip(r):
    t = tt(0.09)
    y = np.sin(phase(700 * (1 + 1.4 * (t / 0.09)))) * np.exp(-t / 0.02)
    return fades(y, 0.0005, 0.01)


def crank_ratchet(r, dur=0.6):
    n = ns(dur)
    y = np.zeros(n)
    tm, rate = 0.0, 26.0
    while tm < dur - 0.03:
        c = modal(0.03, [(2300 + r.uniform(-200, 200), 0.8, 0.004), (5200, 0.4, 0.002)], r)
        mplace(y, c, tm)
        tm += 1.0 / rate
        rate *= 0.94
    creak = Z.creak(r, 0.6)
    return fades(y + creak[:n] * 0.4 if len(creak) >= n else y, 0.001, 0.05)


def machine_run(r, dur):
    """spin-up roar then the steady clatter: cutter clacks ~10 Hz, flywheel thump ~2.6 Hz, gear whine, belt hiss"""
    n = ns(dur)
    t = np.arange(n) / SR
    up = np.clip(t / 0.6, 0, 1)
    y = np.zeros(n)
    tm = 0.0
    while tm < dur:
        rate = 3 + 7 * min(1.0, tm / 0.6)
        c = modal(0.05, [(1900 + r.uniform(-150, 150), 0.7, 0.006), (3700, 0.3, 0.003), (480, 0.6, 0.012)], r)
        mplace(y, c * (0.7 + 0.3 * r.random()), tm)
        tm += 1.0 / rate
    thump = np.sin(TAU * 55 * t) * (0.5 + 0.5 * np.sin(TAU * 2.6 * t)) ** 8 * 0.9
    whine = np.sin(phase(380 + 260 * up)) * 0.06 * up
    hiss = bp(r.standard_normal(n), 2000, 6000, 2) * 0.05 * up
    roar = lp(colored(n, r, 1.5), 500, 2) * np.exp(-t / 0.5) * 0.9
    return fades(widen(y * up + thump * up + whine + hiss + roar, r, 8, 0.6), 0.01, 0.3)


ONESHOT = {"carriage_rumble": (carriage_rumble, -6.0), "cigar_crunch": (cigar_crunch, -2.0), "tobacco_shred": (tobacco_shred, -14.0),
           "coin_clink": (coin_clink, -10.0), "crowd_murmur": (crowd_murmur, -15.0), "cannon_boom": (cannon_boom, -1.5),
           "poster_unroll": (lambda r: G.calendar_flip(r), -11.0), "bell_phone": (bell_phone, -9.0), "thunder": (thunder, -7.0),
           "metal_clank": (metal_clank, -11.0), "drip": (drip, -14.0), "crank_ratchet": (crank_ratchet, -9.0)}


# ----------------------------------------------------------------------------- ambience beds
def amb_street(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 1.0), 900, 2) * 0.25
    for _ in range(int(dur * 1.6)):  # sparrows
        tm = r.uniform(0, dur - 0.3)
        f0 = r.uniform(3200, 5200)
        L = ns(0.07)
        ch = np.sin(phase(f0 * (1 + 0.3 * np.sin(TAU * 30 * np.arange(L) / SR)))) * np.hanning(L)
        mplace(y, ch * 0.25, tm)
    return widen(y, r, 15, 0.9)


def amb_factory(dur, r):
    y = crowd_murmur(r, dur) * 0.6
    y = y.mean(0) if y.ndim == 2 else y
    n = len(y)
    y = y + bp(r.standard_normal(n), 1500, 6000, 2) * 0.06 * (0.5 + 0.5 * smooth_noise(n, r, 4.0))
    return widen(y, r, 17, 0.9)


def amb_camp(dur, r):
    n = ns(dur)
    y = lp(colored(n, r, 1.5), 700, 2) * 0.35
    for _ in range(int(dur * 14)):  # fire crackles
        mplace(y, bp(r.standard_normal(ns(0.01)), 1500, 7000, 1) * r.uniform(0.2, 1.0), r.uniform(0, dur - 0.02))
    t = np.arange(n) / SR
    crickets = np.sin(TAU * 4400 * t) * (np.sin(TAU * 30 * t) > 0.3) * (np.sin(TAU * 1.3 * t) > 0) * 0.03
    return widen(y + crickets, r, 12, 0.7)


def amb_office(dur, r):
    n = ns(dur)
    y = lp(colored(n, r, 1.0), 400, 2) * 0.12
    tm = 0.05
    while tm < dur:  # pendulum clock tick-tock
        mplace(y, modal(0.05, [(2600, 0.5, 0.006), (1200, 0.3, 0.01)], r), tm)
        tm += 1.0
    return widen(y, r, 10, 0.6)


def build_sfx(tl, N, v_ref):
    import mix  # stock manifest-backed foley (whoosh, pop_in, cash_register, counter_flip, camera_beep, ...)
    fps = float(tl.get("fps", 30))
    r = rng(1881)
    tl2 = copy.deepcopy(tl)
    for s in tl2["shots"]:  # beds are ours; keep mix.build_sfx from adding rain/highway beds or wipers
        s["light"], s["set"] = "day", "none"
    evs = [e for e in (tl.get("sfxEvents") or tl.get("events") or []) if e["type"] not in CUSTOM]
    tl2["sfxEvents"] = tl2["events"] = evs
    out = mix.build_sfx(tl2, N, v_ref)

    events = tl.get("sfxEvents") or tl.get("events") or []
    for ev in events:
        tp = ev["type"]
        t0 = float(ev.get("time_s", ev["frame"] / fps))
        g = 20 * np.log10(max(float(ev.get("gain", 1.0)), 1e-3))
        if tp == "machine_start":
            sig = machine_run(r, max(0.5, N / SR - t0))
            sig = _lvl(sig, v_ref, -10.0 + g)
            place(out, sig, t0)
            continue
        if tp not in ONESHOT:
            continue
        fn, rel = ONESHOT[tp]
        sig = fn(r)
        if sig.ndim == 1:
            sig = pan(sig, float(ev.get("pan", 0.0)))
        place(out, _lvl(sig, v_ref, rel + g), t0)

    beds = {"street": (amb_street, -27.0), "factory": (amb_factory, -25.0), "camp": (amb_camp, -25.0), "office": (amb_office, -29.0)}
    for s in tl["shots"]:
        t0 = s["a"] / fps
        dur = max(0.2, (s["b"] - s["a"]) / fps)
        if s["set"] == "barn":
            exterior = s["id"] == 19
            bed = G.rain_loop_exterior(dur + 0.3, r) if exterior else G.rain_loop_cabin(dur + 0.3, r)
            place(out, fades(_lvl(st(bed), v_ref, -21.0 if exterior else -24.0), 0.08, 0.15), t0 - 0.1)
        elif s["set"] in beds:
            fn, rel = beds[s["set"]]
            place(out, fades(_lvl(st(fn(dur + 0.3, r)), v_ref, rel), 0.08, 0.15), t0 - 0.1)
    return hp(out, 28, 2)


def build_score(tl, N):
    import mix
    return mix.build_score(tl, N)
