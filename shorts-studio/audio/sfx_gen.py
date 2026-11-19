# Procedural Foley & Ambience Generators for Shorts-Studio (numpy + optional scipy):
# Mechanical/Action: brake_slam, tire_screech, car_crash, car_horn, car_whoosh, siren_chirp.
# Comedy/UI/Money: cash_register, cash_rustle, money_rain, pop_in, counter_flip, calendar_flip,
#   phone_ring, camera_beep, whoosh_transition, hottub_bubbles.
# Ambience: rain_loop_exterior, rain_loop_cabin (muffled interior), amb_highway, wiper_sweep.
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, reson, resbank, peq, colored, smooth_noise, fades, phase, modal, pan, st, widen)

SMALLMETAL = [(1850, 40, 1.0), (3100, 45, 0.8), (4600, 50, 0.6), (6900, 55, 0.35)]
CHASSIS = [(68, 8, 1.0), (142, 10, 0.85), (275, 13, 0.65), (510, 16, 0.45), (1120, 22, 0.3)]


# ---------------- Mechanical / Action ----------------

def brake_slam(r):
    dur = 0.28
    t = tt(dur)
    thump = np.exp(-t / 0.032) * np.sin(phase(92 * (1 - 0.35 * t))) * 1.4
    spring = modal(dur, [(420, 0.5, 0.04), (890, 0.35, 0.025)], r)
    click = hp(r.standard_normal(len(t)), 2400) * np.exp(-t / 0.004) * 0.45
    return fades(thump + spring + click, 0.001, 0.03)


def tire_screech(r, dur=1.15, wet=False):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.55
    f1 = (980 if wet else 1180) * (1 - 0.14 * (t / dur) + 0.025 * smooth_noise(n, r, 11.0))
    f2 = f1 * 1.42
    ph1, ph2 = phase(f1), phase(f2)
    squeal = (0.65 * np.sin(ph1 + 0.35 * np.sin(ph1)) + 0.45 * np.sin(ph2)) * env
    skid = bp(colored(n, r, 0.7), 650, 4800, 2) * env * (0.65 if wet else 0.4)
    if wet:
        spray = hp(colored(n, r, 0.4), 3200) * env * 0.45
        skid += spray
    return fades(widen(squeal + skid, r, 9, 0.65), 0.015, 0.08)


def car_crash(r, intensity=1.0):
    dur = 1.65
    n = ns(dur)
    t = np.arange(n) / SR
    sub = np.exp(-t / 0.14) * np.sin(phase(56 * (1 + 0.55 * np.exp(-t / 0.02)))) * 2.6 * intensity
    crunch_nz = bp(r.standard_normal(n), 180, 4200, 2) * np.exp(-t / 0.18)
    metal = resbank(crunch_nz, CHASSIS) * 1.4
    glass = np.zeros(n)
    for _ in range(28):
        tm = r.uniform(0.01, 0.65)
        k = ns(tm)
        f0 = r.uniform(2800, 7400)
        shard = modal(0.09, [(f0, 0.7, 0.018), (f0 * 1.62, 0.4, 0.01)], r)
        L = min(len(shard), n - k)
        if L > 0:
            glass[k:k + L] += shard[:L] * r.uniform(0.3, 1.0)
    return fades(widen(sub + metal + glass * 0.55, r, 12, 0.8), 0.001, 0.15)


def car_horn(r, dur=0.58):
    """Dual-tone sedan horn (F4 + A4 brassy reed harmonics through nasal automotive horn formant)."""
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / 0.012) * np.minimum(1.0, (dur - t) / 0.035)
    f1 = 415.0 * (1.0 + 0.006 * smooth_noise(n, r, 12.0))
    f2 = 518.0 * (1.0 + 0.006 * smooth_noise(n, r, 10.0))
    p1, p2 = phase(f1), phase(f2)
    y = np.zeros(n)
    for k in range(1, 9):
        y += (1.0 / (k ** 0.75)) * (np.sin(k * p1) + 0.85 * np.sin(k * p2 + 0.3))
    y = bp(y, 320, 3800, 2)
    y = peq(y, 1250, 5.5, 1.4)
    return fades(widen(y * env * 0.55, r, 6, 0.35), 0.004, 0.03)


def car_whoosh(r, dur=0.72):
    """Stereo Doppler car pass-by whoosh (sweeps left -> right with air rush + tire roar)."""
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.35
    # Doppler pitch drop from 1.32x -> 0.72x across peak
    doppler = 1.02 - 0.32 * np.tanh((u - 0.48) * 5.2)
    engine = np.sin(phase(135.0 * doppler)) * 0.4 + np.sin(phase(270.0 * doppler)) * 0.22
    air = bp(colored(n, r, 0.7), 220, 3400, 2) * 0.85
    hiss = hp(colored(n, r, 0.3), 2600) * 0.28 * (env ** 1.5)
    mono = (engine + air + hiss) * env
    # Left-to-right stereo pan sweep
    th = (np.clip(-0.85 + 1.70 * u, -1, 1) + 1.0) * np.pi / 4.0
    stereo = np.stack([mono * np.cos(th), mono * np.sin(th)]) * np.sqrt(2)
    return fades(stereo, 0.02, 0.06)


def siren_chirp(r):
    dur = 0.65
    t = tt(dur)
    f = 680 + 580 * np.sin(np.pi * np.clip(t / 0.32, 0, 1)) ** 1.4
    y = (np.sin(phase(f)) + 0.25 * np.sin(2 * phase(f))) * np.exp(-np.maximum(0, t - 0.35) / 0.12)
    return fades(y * 0.6, 0.005, 0.05)


# ---------------- Comedy / UI / Money ----------------

def cash_register(r):
    dur = 1.1
    drawer = modal(dur, [(220, 0.6, 0.06), (510, 0.4, 0.04)], r)
    bell = modal(dur, [(2349, 1.0, 0.42), (2349 * 2.756, 0.45, 0.18), (2349 * 5.4, 0.2, 0.08)], r)
    bell = np.roll(bell, ns(0.08))
    bell[:ns(0.08)] = 0
    return fades(drawer + bell * 0.9, 0.001, 0.08)


def cash_rustle(r, dur=0.58):
    """Crisp paper cash stack thumb-riffle & bill snap."""
    n = ns(dur)
    y = np.zeros(n)
    # 12 crisp rapid bill flips
    for i in range(12):
        tm = 0.02 + i * (dur - 0.12) / 12.0 + r.uniform(-0.006, 0.006)
        k = max(0, ns(tm))
        L = min(ns(0.048), n - k)
        if L <= 2:
            continue
        tl = np.arange(L) / SR
        crisp = bp(r.standard_normal(L), 1800, 8200, 2) * np.exp(-tl / 0.011)
        snap = modal(L / SR, [(950 + r.uniform(-120, 180), 0.35, 0.008)], r)[:L]
        y[k:k + L] += (crisp + snap) * r.uniform(0.65, 1.05)
    return fades(widen(y, r, 7, 0.55), 0.003, 0.04)


def money_rain(r, dur=1.4):
    n = ns(dur)
    y = np.zeros(n)
    for _ in range(34):
        tm = r.uniform(0.0, dur - 0.12)
        k = ns(tm)
        L = ns(0.075)
        tl = np.arange(L) / SR
        flap = bp(r.standard_normal(L), 1400, 6500, 1) * np.sin(np.pi * tl / 0.075) ** 2
        m = min(L, n - k)
        y[k:k + m] += flap[:m] * r.uniform(0.35, 0.95)
    return fades(widen(y, r, 10, 0.85), 0.01, 0.08)


def pop_in(r):
    """Tactile cartoon/UI bubble pop-in for prop reveals and visual punchlines."""
    dur = 0.14
    t = tt(dur)
    f = 240.0 + 620.0 * (1.0 - np.exp(-t / 0.026))
    body = np.sin(phase(f)) * np.exp(-t / 0.032) * 1.15
    click = bp(r.standard_normal(len(t)), 1400, 5600, 1) * np.exp(-t / 0.004) * 0.45
    return fades(body + click, 0.001, 0.015)


def phone_ring(r):
    dur = 0.85
    t = tt(dur)
    gate = ((t < 0.36) | ((t > 0.46) & (t < 0.82))).astype(float)
    mod = 0.5 + 0.5 * np.sin(TAU * 20 * t)
    tone = (np.sin(TAU * 940 * t) + 0.65 * np.sin(TAU * 1220 * t)) * mod * gate * 0.6
    return fades(tone, 0.005, 0.03)


def counter_flip(r):
    dur = 0.22
    t = tt(dur)
    snap = bp(r.standard_normal(len(t)), 800, 5500, 1) * np.exp(-t / 0.008) * 1.1
    card = modal(dur, [(380, 0.8, 0.03), (1150, 0.5, 0.015)], r)
    return fades(snap + card, 0.001, 0.02)


def calendar_flip(r):
    """Crisp desk-calendar flip clack + paper swoosh."""
    dur = 0.28
    n = ns(dur)
    t = np.arange(n) / SR
    swoosh = bp(r.standard_normal(n), 1500, 7200, 1) * np.sin(np.pi * np.clip(t / 0.12, 0, 1)) ** 2 * 0.7
    clack = np.zeros(n)
    k = ns(0.085)
    L = n - k
    tl = np.arange(L) / SR
    clack[k:] = (
        bp(r.standard_normal(L), 700, 4800, 1) * np.exp(-tl / 0.007) * 1.2
        + modal(L / SR, [(410, 0.8, 0.026), (1280, 0.55, 0.014)], r)[:L]
    )
    return fades(swoosh + clack, 0.001, 0.025)


def whoosh_transition(r, dur=0.34):
    """Subtle clean air transition whoosh for fast 2-3s scene cuts."""
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.8
    low = lp(colored(n, r, 1.1), 520, 2) * env * 0.55
    mid = bp(colored(n, r, 0.6), 450, 2600, 2) * (env ** 1.2) * 0.75
    hi = hp(colored(n, r, 0.4), 2200) * (env ** 2.0) * 0.25
    return fades(widen(low + mid + hi, r, 9, 0.75), 0.008, 0.03)


def hottub_bubbles(r, dur=2.3):
    n = ns(dur)
    y = bp(colored(n, r, 0.9), 140, 1200, 1) * 0.35
    tm = 0.02
    while tm < dur - 0.08:
        k = ns(tm)
        f0 = r.uniform(320, 1450)
        ta = r.uniform(0.01, 0.028)
        L = min(ns(0.09), n - k)
        tl = np.arange(L) / SR
        y[k:k + L] += np.exp(-tl / ta) * np.sin(phase(f0 * (1 + 8 * tl))) * r.uniform(0.25, 0.85)
        tm += r.exponential(1 / 55.0)
    return fades(widen(y, r, 8, 0.75), 0.12, 0.18)


def camera_beep(r):
    dur = 0.24
    t = tt(dur)
    b1 = np.sin(TAU * 2637 * t) * (t < 0.08) * np.exp(-t / 0.06)
    b2 = np.sin(TAU * 3136 * t) * (t >= 0.10) * np.exp(-np.maximum(0, t - 0.10) / 0.08)
    return fades((b1 + b2) * 0.75, 0.002, 0.02)


# ---------------- Ambience & Wipers ----------------

def wiper_sweep(r):
    dur = 0.52
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 1.3
    rub = bp(colored(n, r, 0.8), 220, 1450, 2) * env * 0.55
    squeak = np.sin(phase(480 + 190 * t)) * env ** 2 * 0.18
    return fades(rub + squeak, 0.01, 0.04)


def rain_loop_exterior(dur, r):
    """Full-spectrum continuous exterior rain shower loop (broad steady patter + gentle wind swell)."""
    n = ns(dur)
    swell = 0.84 + 0.16 * smooth_noise(n, r, 0.35)
    body = bp(colored(n, r, 0.65), 320, 6800, 2) * 0.55 * swell
    sizzle = hp(colored(n, r, 0.25), 3200) * 0.28 * swell
    # Subtle sporadic close droplets
    drops = np.zeros(n)
    tm = 0.02
    while tm < dur - 0.04:
        k = ns(tm)
        L = min(ns(0.018), n - k)
        tl = np.arange(L) / SR
        drops[k:k + L] += bp(r.standard_normal(L), 2000, 7500, 1) * np.exp(-tl / 0.003) * r.uniform(0.15, 0.45)
        tm += r.exponential(1.0 / 32.0)
    out = widen(body + sizzle + drops, r, 12, 0.88)
    return fades(out, 0.08, 0.08)


def rain_loop_cabin(dur, r):
    """Muffled low-pass interior car-cabin rain bed (roof drumming + warm damped enclosure)."""
    ext = rain_loop_exterior(dur, r)
    # Heavy cabin low-pass dampening + subtle metallic roof drumming resonance around 320-680 Hz
    muffled = lp(ext, 1350, 3)
    roof = peq(muffled, 420, 4.5, 1.3)
    rumble = st(lp(colored(ext.shape[1], r, 1.5), 190, 2) * 0.28)
    return fades(roof * 0.85 + rumble, 0.08, 0.08)


def amb_highway(dur, r, rain=False, cabin=False):
    n = ns(dur)
    hum = lp(colored(n, r, 1.4), 260, 2) * 0.45
    air = bp(colored(n, r, 0.7), 300, 2200, 1) * (0.28 + 0.12 * smooth_noise(n, r, 0.4))
    out = st(hum) + widen(air, r, 11, 0.6)
    if rain:
        rain_bed = rain_loop_cabin(dur, r) if cabin else rain_loop_exterior(dur, r)
        out = (lp(out, 1100, 2) * 0.65 if cabin else out) + rain_bed * 0.72
    elif cabin:
        out = lp(out, 950, 2) * 0.82
    return fades(out, 0.18, 0.22)
