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

# ---------------- "The Elevator Stranger" foley ----------------
def _seq(dur, hits, r):
    """Lay (time_s, mono_signal, gain) hits into one mono buffer."""
    y = np.zeros(ns(dur))
    for tm, sig, g in hits:
        k = ns(tm)
        m = min(len(sig), len(y) - k)
        if m > 0:
            y[k:k + m] += sig[:m] * g
    return y

def footsteps_run(r, dur=3.0, rate=5.6):
    hits, tm, i = [], 0.03, 0
    while tm < dur - 0.15:
        tl = tt(0.13)
        heel = np.exp(-tl / 0.012) * np.sin(phase(150 * (1 - 0.4 * tl / 0.13)))
        slap = bp(r.standard_normal(len(tl)), 900, 5200, 1) * np.exp(-tl / 0.016) * 0.7
        hits.append((tm, heel + slap, (0.55 + 0.45 * tm / dur) * r.uniform(0.8, 1.0)))
        tm += 1 / rate * r.uniform(0.92, 1.08)
        i += 1
    return fades(widen(_seq(dur, hits, r), r, 9, 0.6), 0.005, 0.1)

def door_slide(r, dur=1.25):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.clip(t / 0.12, 0, 1) * np.clip((dur - t) / 0.1, 0, 1)
    motor = np.sin(phase(92 + 26 * np.clip(t / 0.3, 0, 1))) * 0.35 + np.sin(phase(184 + 52 * np.clip(t / 0.3, 0, 1))) * 0.18
    roll = bp(colored(n, r, 0.9), 240, 2400, 2) * (0.5 + 0.2 * smooth_noise(n, r, 6.0))
    y = (motor + roll) * env
    thunk = modal(0.3, [(120, 1.0, 0.05), (310, 0.5, 0.03)], r)
    k = n - len(thunk)
    y[k:] += thunk * 1.2
    return fades(widen(y, r, 10, 0.5), 0.01, 0.05)

def elevator_ding(r):
    a = modal(1.5, [(1318.5, 1.0, 0.5), (1318.5 * 2.76, 0.35, 0.2), (1318.5 * 5.4, 0.12, 0.08)], r)
    b = modal(1.5, [(1046.5, 1.0, 0.6), (1046.5 * 2.76, 0.3, 0.22)], r)
    y = a.copy()
    k = ns(0.28)
    y[k:] += b[:len(y) - k] * 0.9
    return fades(y, 0.001, 0.2)

def floor_tick(r):
    t = tt(0.16)
    return fades(np.sin(TAU * 1760 * t) * np.exp(-t / 0.05) * 0.7, 0.002, 0.03)

def elevator_jolt(r):
    dur = 1.3
    n = ns(dur)
    t = np.arange(n) / SR
    sub = np.exp(-t / 0.16) * np.sin(phase(48 * (1 + 0.6 * np.exp(-t / 0.03)))) * 2.2
    clank = resbank(bp(r.standard_normal(n), 150, 3800, 2) * np.exp(-t / 0.07), CHASSIS) * 1.1
    groan_f = 210 * (1 - 0.3 * t / dur) * (1 + 0.03 * smooth_noise(n, r, 9.0))
    groan = np.sin(phase(groan_f) + 0.8 * np.sin(phase(groan_f * 0.5))) * np.clip(t / 0.1, 0, 1) * np.exp(-t / 0.45) * 0.35
    rattle = hp(r.standard_normal(n), 2500) * np.exp(-t / 0.2) * (0.5 + 0.5 * np.sin(TAU * 31 * t)) * 0.25
    return fades(widen(sub + clank + groan + rattle, r, 12, 0.7), 0.001, 0.15)

def alarm_buzz(r, dur=3.6, period=26 / 30):
    n = ns(dur)
    t = np.arange(n) / SR
    gate = (0.5 - 0.5 * np.cos(TAU * t / period)) ** 2
    ph = phase(np.full(n, 440.0))
    buzz = np.sign(np.sin(ph)) * 0.5 + np.sin(ph * 1.5) * 0.3
    return fades(lp(bp(buzz, 300, 3200, 1), 2600, 2) * gate * 0.6, 0.02, 0.2)

def door_pound(r):
    dur = 0.4
    t = tt(dur)
    body = np.exp(-t / 0.05) * np.sin(phase(86 * (1 + 0.5 * np.exp(-t / 0.015)))) * 1.6
    sheet = modal(dur, [(240, 0.8, 0.09), (415, 0.5, 0.07), (890, 0.3, 0.04)], r)
    slap = bp(r.standard_normal(len(t)), 700, 4000, 1) * np.exp(-t / 0.008) * 0.6
    return fades(body + sheet + slap, 0.001, 0.05)

def lights_flicker(r, dur=0.55):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.sin(TAU * 100 * t) * 0.25 * np.clip(t / 0.3, 0, 1)
    for tm in (0.02, 0.11, 0.17, 0.3):
        tl = tt(0.05)
        tick = hp(r.standard_normal(len(tl)), 3000) * np.exp(-tl / 0.004)
        k = ns(tm)
        y[k:k + len(tick)] += tick[:max(0, n - k)] * 0.8
    return fades(y, 0.002, 0.1)

def bubble_pop(r):
    dur = 0.2
    t = tt(dur)
    blip = np.sin(phase(380 + 900 * np.clip(t / 0.06, 0, 1))) * np.exp(-t / 0.045)
    click = hp(r.standard_normal(len(t)), 2000) * np.exp(-t / 0.003) * 0.3
    return fades(blip + click, 0.001, 0.02)

def pencil_scribble(r, dur=0.95):
    n = ns(dur)
    t = np.arange(n) / SR
    strokes = np.abs(np.sin(TAU * 7.5 * t + 0.6 * np.sin(TAU * 2.1 * t))) ** 0.6
    y = bp(colored(n, r, 0.3), 1800, 7500, 1) * strokes * (0.6 + 0.4 * smooth_noise(n, r, 14.0))
    return fades(y * 0.7, 0.02, 0.06)

def water_drip(r):
    dur = 0.3
    t = tt(dur)
    plink = np.sin(phase(900 + 1500 * np.exp(-t / 0.02))) * np.exp(-t / 0.05)
    splat = bp(r.standard_normal(len(t)), 1500, 6000, 1) * np.exp(-t / 0.012) * 0.4
    return fades(plink + splat, 0.001, 0.03)

def time_whoosh(r, dur=2.0):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    chirp = np.sin(phase(300 * 2 ** (2.6 * t / dur)) + 2.5 * np.sin(TAU * 23 * t)) * 0.22
    tape = bp(colored(n, r, 0.5), 600, 6000, 1) * (0.5 + 0.5 * np.sin(TAU * 17 * t)) * 0.5
    return fades(widen((chirp + tape) * env, r, 11, 0.8), 0.05, 0.25)

def chair_creak(r):
    dur = 0.7
    n = ns(dur)
    t = np.arange(n) / SR
    f = 310 * (1 + 0.25 * np.sin(TAU * 2.3 * t)) * (1 + 0.04 * smooth_noise(n, r, 30.0))
    creak = np.sin(phase(f) + 1.2 * np.sin(phase(f * 2.01))) * np.sin(np.pi * t / dur) ** 2 * 0.3
    puff = lp(colored(n, r, 1.0), 500, 2) * np.exp(-t / 0.12) * 0.9
    return fades(creak + puff, 0.01, 0.08)

def cup_set(r):
    dur = 0.22
    t = tt(dur)
    tap = modal(dur, [(520, 0.9, 0.03), (1350, 0.4, 0.015)], r)
    card = bp(r.standard_normal(len(t)), 900, 4500, 1) * np.exp(-t / 0.01) * 0.5
    return fades(tap + card, 0.001, 0.02)

def stop_knob(r):
    dur = 0.45
    t = tt(dur)
    clunk = np.exp(-t / 0.035) * np.sin(phase(140 * (1 + 0.4 * np.exp(-t / 0.01)))) * 1.5
    spring = modal(dur, [(760, 0.7, 0.08), (1580, 0.45, 0.05), (2900, 0.25, 0.03)], r)
    click = hp(r.standard_normal(len(t)), 2600) * np.exp(-t / 0.004) * 0.6
    return fades(clunk + spring + click, 0.001, 0.05)

def amb_room(dur, r, hum=True):
    """Elevator / lobby / office room tone: ventilation air + (elevator) faint mains hum."""
    n = ns(dur)
    air = bp(colored(n, r, 1.1), 120, 1800, 1) * (0.3 + 0.08 * smooth_noise(n, r, 0.3))
    out = widen(air, r, 11, 0.6)
    if hum:
        t = np.arange(n) / SR
        out += st(np.sin(TAU * 100 * t) * 0.06 + np.sin(TAU * 50 * t) * 0.08)
    return fades(out, min(0.25, dur / 4), min(0.35, dur / 4))
