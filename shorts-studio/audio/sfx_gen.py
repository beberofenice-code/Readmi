# Procedural Foley & Ambience Generators for Shorts-Studio v2 (numpy + scipy only):
# Automotive brake-check screech, sheet-metal + glass collision crunch, cash register cha-ching,
# fluttering banknotes, office rotary/desk phone ring, flip-counter clack, hot-tub bubbles,
# rain-on-car-roof cabin bed, windshield wiper sweep, and dashcam REC beep.
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, reson, resbank, peq, colored, smooth_noise, fades, phase, modal, pan, st, widen)

SMALLMETAL = [(1850, 40, 1.0), (3100, 45, 0.8), (4600, 50, 0.6), (6900, 55, 0.35)]
CHASSIS = [(68, 8, 1.0), (142, 10, 0.85), (275, 13, 0.65), (510, 16, 0.45), (1120, 22, 0.3)]

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

def cash_register(r):
    dur = 1.1
    drawer = modal(dur, [(220, 0.6, 0.06), (510, 0.4, 0.04)], r)
    bell = modal(dur, [(2349, 1.0, 0.42), (2349 * 2.756, 0.45, 0.18), (2349 * 5.4, 0.2, 0.08)], r)
    bell = np.roll(bell, ns(0.08))
    bell[:ns(0.08)] = 0
    return fades(drawer + bell * 0.9, 0.001, 0.08)

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

def siren_chirp(r):
    dur = 0.65
    t = tt(dur)
    f = 680 + 580 * np.sin(np.pi * np.clip(t / 0.32, 0, 1)) ** 1.4
    y = (np.sin(phase(f)) + 0.25 * np.sin(2 * phase(f))) * np.exp(-np.maximum(0, t - 0.35) / 0.12)
    return fades(y * 0.6, 0.005, 0.05)

def wiper_sweep(r):
    dur = 0.52
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 1.3
    rub = bp(colored(n, r, 0.8), 220, 1450, 2) * env * 0.55
    squeak = np.sin(phase(480 + 190 * t)) * env ** 2 * 0.18
    return fades(rub + squeak, 0.01, 0.04)

def camera_beep(r):
    dur = 0.24
    t = tt(dur)
    b1 = np.sin(TAU * 2637 * t) * (t < 0.08) * np.exp(-t / 0.06)
    b2 = np.sin(TAU * 3136 * t) * (t >= 0.10) * np.exp(-np.maximum(0, t - 0.10) / 0.08)
    return fades((b1 + b2) * 0.75, 0.002, 0.02)

def amb_highway(dur, r, rain=False):
    n = ns(dur)
    hum = lp(colored(n, r, 1.4), 260, 2) * 0.45
    air = bp(colored(n, r, 0.7), 300, 2200, 1) * (0.28 + 0.12 * smooth_noise(n, r, 0.4))
    out = st(hum) + widen(air, r, 11, 0.6)
    if rain:
        patter = bp(colored(n, r, 0.4), 900, 5200, 1) * 0.38
        out += widen(patter, r, 7, 0.9)
    return fades(out, 0.25, 0.35)


# ---------------- Space / black-hole foley (blackhole short) ----------------
def sting_hit(r):
    dur = 2.2
    t = tt(dur)
    sub = np.sin(phase(58 * (1 + 0.8 * np.exp(-t / 0.05)))) * np.exp(-t / 0.5) * 1.6
    hit = bp(r.standard_normal(len(t)), 200, 3000, 2) * np.exp(-t / 0.06)
    bell = modal(dur, [(523, 0.5, 0.9), (523 * 2.76, 0.25, 0.4), (784, 0.3, 0.7)], r)
    return fades(widen(sub + hit * 0.6 + bell * 0.5, r, 13, 0.8), 0.001, 0.3)

def shimmer(r, dur=1.6):
    n = ns(dur)
    y = np.zeros(n)
    for k in range(18):
        f0 = r.uniform(1800, 5200)
        tm = r.uniform(0, dur * 0.55)
        tone = modal(dur - tm, [(f0, 1.0, 0.35)], r)
        i = ns(tm)
        y[i:i + len(tone)] += tone[: n - i] * r.uniform(0.2, 0.6)
    env = np.sin(np.pi * np.clip(np.arange(n) / n, 0, 1)) ** 0.5
    return fades(widen(y * env * 0.5, r, 9, 0.95), 0.05, 0.3)

def deep_boom(r):
    dur = 3.0
    t = tt(dur)
    y = np.sin(phase(42 * (1 + 0.5 * np.exp(-t / 0.08)))) * np.exp(-t / 0.9) * 1.8
    y += lp(colored(len(t), r, 1.2), 180) * np.exp(-t / 0.6) * 0.8
    return fades(widen(y, r, 15, 0.6), 0.002, 0.4)

def photon_zap(r):
    dur = 0.7
    t = tt(dur)
    f = 2600 * np.exp(-t / 0.18) + 180
    y = np.sin(phase(f)) * np.exp(-t / 0.22) * 0.7 + hp(r.standard_normal(len(t)), 5000) * np.exp(-t / 0.03) * 0.2
    return fades(y, 0.002, 0.08)

def whoosh(r, dur=0.9):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 2
    fc = 400 + 2400 * np.sin(np.pi * t / dur)
    nz = colored(n, r, 0.6)
    y = np.zeros(n)
    blk = ns(0.02)
    for i in range(0, n, blk):
        seg = nz[max(0, i - 400): i + blk]
        y[i:i + blk] = bp(seg, max(120, fc[i] * 0.5), min(18000, fc[i] * 1.8), 1)[-min(blk, n - i):]
    return fades(widen(y * env, r, 12, 0.9), 0.02, 0.08)

def scope_servo(r):
    dur = 0.75
    t = tt(dur)
    f = 180 + 90 * np.sin(np.pi * t / dur)
    y = (np.sign(np.sin(phase(f))) * 0.15 + np.sin(phase(f * 3)) * 0.2) * np.sin(np.pi * t / dur) ** 0.6
    y = bp(y, 150, 2600, 2) + modal(dur, [(1400, 0.3, 0.02)], r)
    return fades(y, 0.01, 0.05)

def radio_click(r):
    dur = 0.32
    t = tt(dur)
    click = hp(r.standard_normal(len(t)), 1800) * np.exp(-t / 0.004)
    hiss = bp(r.standard_normal(len(t)), 1500, 6000, 2) * 0.18 * (t < 0.22)
    chirp = np.sin(phase(1900 + 600 * (t > 0.05))) * 0.25 * ((t > 0.02) & (t < 0.1))
    return fades(click + hiss + chirp, 0.0005, 0.05)

def clock_slow(r, dur=7.3):
    """ticks whose spacing stretches toward a full stop (time dilation)"""
    n = ns(dur + 0.3)
    y = np.zeros(n)
    tm, k = 0.0, 0
    while tm < dur:
        p = tm / dur
        tick = modal(0.08, [(3200 if k % 2 else 2600, 1.0, 0.012), (5400, 0.4, 0.006)], r) * (1 - 0.6 * p)
        i = ns(tm)
        y[i:i + len(tick)] += tick[: n - i]
        tm += 0.5 / max(0.05, (1 - p) ** 1.4)
        k += 1
    return fades(y, 0.001, 0.05)

def freeze_hit(r):
    dur = 1.6
    t = tt(dur)
    # tape-stop: a falling chord, then a glassy ring
    f = np.maximum(30, 330 * np.exp(-t / 0.25))
    tape = (np.sin(phase(f)) + 0.5 * np.sin(phase(f * 1.5))) * np.exp(-t / 0.35) * 0.7
    glass = modal(dur, [(2093, 0.5, 0.8), (3136, 0.3, 0.6), (4186, 0.2, 0.4)], r)
    return fades(widen(tape + glass * 0.6, r, 10, 0.7), 0.002, 0.2)

def fire_roar(r, dur=6.2):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.clip(t / 1.4, 0, 1) ** 1.5 * np.clip((dur - t) / 1.2, 0, 1)
    rumble = lp(colored(n, r, 1.3), 220, 2) * 1.4
    crackle = np.zeros(n)
    for _ in range(260):
        i = ns(r.uniform(0, dur - 0.02))
        L = ns(0.006)
        crackle[i:i + L] += hp(r.standard_normal(L), 2500) * r.uniform(0.2, 1.0)
    roar = bp(colored(n, r, 0.8), 120, 1800, 2) * (0.6 + 0.4 * smooth_noise(n, r, 3.0))
    return fades(widen((rumble + roar + crackle * 0.5) * env, r, 14, 0.9), 0.05, 0.4)

def burn_whoomp(r):
    dur = 1.6
    t = tt(dur)
    y = np.sin(phase(70 * (1 + 1.2 * np.exp(-t / 0.04)))) * np.exp(-t / 0.3) * 1.5
    y += bp(r.standard_normal(len(t)), 300, 5000, 2) * np.exp(-t / 0.25) * np.clip(t / 0.03, 0, 1)
    return fades(widen(y, r, 12, 0.8), 0.001, 0.2)

def ash_scatter(r, dur=2.4):
    n = ns(dur)
    y = hp(colored(n, r, 0.3), 3000) * 0.25 * np.exp(-np.arange(n) / SR / 0.9)
    for _ in range(120):
        i = ns(r.uniform(0, dur * 0.8))
        L = ns(0.01)
        y[i:i + L] += bp(r.standard_normal(L), 2000, 9000, 1) * r.uniform(0.1, 0.5)
    return fades(widen(y, r, 8, 0.95), 0.01, 0.3)

def soft_chime(r):
    dur = 2.4
    y = modal(dur, [(1046.5, 0.6, 1.2), (1568, 0.4, 0.9), (2093, 0.25, 0.7)], r)
    y = np.roll(y, ns(0.01))
    return fades(widen(y, r, 11, 0.9), 0.01, 0.3)

def low_rumble(r, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 1.6), 120, 2) * 2.0 + np.sin(phase(np.full(n, 36.0))) * 0.6
    return fades(st(y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7), 0.1, 0.4)

def stretch_creak(r, dur=2.7):
    n = ns(dur)
    t = np.arange(n) / SR
    f = 90 * 2 ** (2.2 * t / dur)
    saw = np.sin(phase(f)) + 0.5 * np.sin(2 * phase(f)) + 0.3 * np.sin(3 * phase(f))
    grit = (smooth_noise(n, r, 40.0) > 0.2).astype(float) * 0.5 + 0.5
    y = bp(saw * grit, 80, 2500, 2) * np.clip(t / 0.3, 0, 1)
    return fades(widen(y * 0.7, r, 9, 0.6), 0.02, 0.2)

def boing(r):
    dur = 0.9
    t = tt(dur)
    f = 220 * (1 + 0.6 * np.exp(-t / 0.08) * np.cos(TAU * 11 * t))
    y = np.sin(phase(f)) * np.exp(-t / 0.35) + 0.3 * np.sin(2 * phase(f)) * np.exp(-t / 0.2)
    return fades(y * 0.8, 0.001, 0.08)

def bell_toll(r):
    dur = 4.0
    f0 = 196.0
    y = modal(dur, [(f0 * 0.5, 0.5, 2.4), (f0, 1.0, 1.8), (f0 * 1.19, 0.6, 1.4), (f0 * 1.5, 0.4, 1.2), (f0 * 2.0, 0.35, 0.9), (f0 * 2.74, 0.25, 0.6)], r)
    return fades(widen(y * 0.6, r, 14, 0.7), 0.002, 0.5)

def amb_space(dur, r):
    n = ns(dur)
    drone = lp(colored(n, r, 1.5), 140, 2) * 0.6
    air = bp(colored(n, r, 0.9), 400, 3000, 1) * 0.08 * (0.6 + 0.4 * smooth_noise(n, r, 0.2))
    return fades(widen(drone + air, r, 17, 0.8), 0.3, 0.3)

def amb_ship(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    hum = (np.sin(TAU * 60 * t) + 0.4 * np.sin(TAU * 120 * t) + 0.2 * np.sin(TAU * 180 * t)) * 0.15
    vent = bp(colored(n, r, 0.6), 200, 1600, 1) * 0.25
    return fades(widen(hum + vent, r, 10, 0.6), 0.2, 0.2)

def amb_inside(dur, r):
    n = ns(dur)
    rumble = lp(colored(n, r, 1.7), 90, 2) * 1.2
    wind = bp(colored(n, r, 0.7), 300, 2400, 2) * (0.5 + 0.5 * smooth_noise(n, r, 0.8)) * 0.6
    return fades(widen(rumble + wind, r, 13, 0.9), 0.2, 0.3)
