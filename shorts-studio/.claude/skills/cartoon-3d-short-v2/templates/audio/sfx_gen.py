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


# ---------------- Domestic / office / street foley ("What If You Think 100x Faster?") ----------------
def clock_tick(r):
    dur = 0.09
    t = tt(dur)
    tick = hp(r.standard_normal(len(t)), 1800) * np.exp(-t / 0.0035) * 0.9
    body = modal(dur, [(1450, 0.6, 0.012), (2900, 0.35, 0.007), (520, 0.25, 0.02)], r)
    return fades(tick + body, 0.0005, 0.01)

def alarm_ring(r, dur=1.05):
    t = tt(dur)
    trill = 0.5 + 0.5 * np.sign(np.sin(TAU * 26 * t))
    bell = (np.sin(TAU * 2180 * t) + 0.6 * np.sin(TAU * 2740 * t) + 0.35 * np.sin(TAU * 4310 * t)) * trill
    clack = hp(r.standard_normal(len(t)), 3000) * trill * 0.12
    return fades((bell * 0.42 + clack) * np.minimum(1, (dur - t) / 0.12), 0.004, 0.05)

def whoosh(r, dur=0.75):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    nz = colored(n, r, 0.6)
    lo, hi = bp(nz, 250, 1200, 1), bp(nz, 1200, 6500, 1)
    sweep = np.clip(t / dur, 0, 1)
    rise = np.sin(phase(180 + 1500 * sweep ** 2)) * 0.18
    return fades(widen((lo * (1 - sweep) + hi * sweep) * env * 0.9 + rise * env, r, 10, 0.8), 0.02, 0.1)

def coffee_pour(r, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    pump = np.sin(TAU * 52 * t) * 0.25 + lp(colored(n, r, 1.0), 320, 2) * 0.5
    gurgle = np.zeros(n)
    tm = 0.05
    while tm < dur - 0.1:
        k = ns(tm)
        f0 = r.uniform(260, 900)
        L = min(ns(0.07), n - k)
        tl = np.arange(L) / SR
        gurgle[k:k + L] += np.exp(-tl / 0.02) * np.sin(phase(f0 * (1 + 5 * tl))) * r.uniform(0.2, 0.6)
        tm += r.exponential(1 / 22.0)
    hiss = hp(colored(n, r, 0.3), 3500) * 0.08
    return fades(widen(pump + gurgle + hiss, r, 8, 0.6), 0.2, 0.5)

def page_flutter(r, dur=1.9):
    n = ns(dur)
    y = np.zeros(n)
    tm = 0.0
    while tm < dur - 0.06:  # a whole book riffled: ~38 pages a second
        k = ns(tm)
        L = ns(0.05)
        tl = np.arange(L) / SR
        flap = bp(r.standard_normal(L), 1800, 7500, 1) * np.sin(np.pi * tl / 0.05) ** 2
        m = min(L, n - k)
        y[k:k + m] += flap[:m] * r.uniform(0.5, 1.0)
        tm += r.uniform(0.02, 0.032)
    return fades(widen(y, r, 9, 0.7), 0.02, 0.06)

def book_shut(r):
    dur = 0.3
    t = tt(dur)
    thump = np.exp(-t / 0.03) * np.sin(phase(130 * (1 - 0.3 * t))) * 1.2
    slap = bp(r.standard_normal(len(t)), 500, 4500, 1) * np.exp(-t / 0.012) * 0.9
    return fades(thump + slap, 0.001, 0.04)

def chess_clack(r):
    dur = 0.14
    t = tt(dur)
    f0 = r.uniform(880, 1150)
    wood = modal(dur, [(f0, 0.9, 0.018), (f0 * 2.31, 0.5, 0.01), (f0 * 0.52, 0.4, 0.03)], r)
    click = hp(r.standard_normal(len(t)), 2500) * np.exp(-t / 0.003) * 0.5
    return fades(wood + click, 0.0005, 0.02)

def king_topple(r):
    dur = 0.75
    n = ns(dur)
    y = np.zeros(n)
    for tm, g in [(0.0, 1.0), (0.16, 0.6), (0.27, 0.4), (0.35, 0.28), (0.41, 0.18), (0.45, 0.12)]:
        c = chess_clack(r) * g
        k = ns(tm)
        y[k:k + len(c)] += c[:n - k]
    roll = bp(colored(n, r, 0.8), 300, 1400, 1) * np.exp(-np.maximum(0, np.arange(n) / SR - 0.4) / 0.12) * 0.2
    return fades(y + roll, 0.0005, 0.05)

def chalk_scribble(r, dur=1.45):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    tm = 0.0
    while tm < dur - 0.08:  # frantic short strokes
        L = ns(r.uniform(0.035, 0.085))
        k = ns(tm)
        tl = np.arange(L) / SR
        f0 = r.uniform(2300, 3800)
        stroke = (bp(r.standard_normal(L), 1500, 7000, 1) * 0.7 + np.sin(phase(f0 * (1 + 0.15 * np.sin(TAU * 60 * tl)))) * 0.16) * np.sin(np.pi * tl / (L / SR)) ** 0.7
        m = min(L, n - k)
        y[k:k + m] += stroke[:m] * r.uniform(0.6, 1.0)
        tap = ns(tm + L / SR)
        if tap + 200 < n:
            y[tap:tap + 200] += hp(r.standard_normal(200), 1200) * np.exp(-np.arange(200) / 30.0) * 0.5
        tm += L / SR + r.uniform(0.01, 0.04)
    return fades(y, 0.005, 0.04)

def sneeze(r):
    # "ah... ah..." (two rising breaths, 0.0-0.3 s) then the "CHOO" burst at 0.33 s
    dur = 0.95
    n = ns(dur)
    t = np.arange(n) / SR
    nz = r.standard_normal(n)
    inh = np.zeros(n)
    for a, b in [(0.0, 0.13), (0.16, 0.31)]:
        w = (t >= a) & (t < b)
        inh[w] = np.sin(np.pi * (t[w] - a) / (b - a)) ** 1.5
    breath = bp(nz, 700, 2600, 1) * inh * 0.35 + np.sin(phase(260 + 380 * t / 0.3)) * inh * 0.1
    tc = np.maximum(0, t - 0.33)
    on = (t >= 0.33).astype(float)
    choo = (bp(nz, 1500, 7500, 1) * np.exp(-tc / 0.05) * 1.2 + bp(nz, 400, 1500, 1) * np.exp(-tc / 0.16) * 0.7
            + np.sin(phase(330 * np.exp(-tc / 0.3))) * np.exp(-tc / 0.2) * 0.3) * on
    return fades(widen(breath + choo, r, 9, 0.5), 0.005, 0.1)

def door_open(r):
    dur = 0.9
    n = ns(dur)
    t = np.arange(n) / SR
    latch = np.zeros(n)
    c = modal(0.12, [(620, 0.8, 0.02), (1750, 0.5, 0.01)], r)
    latch[:len(c)] += c
    f = 310 + 190 * np.sin(np.pi * np.clip((t - 0.12) / 0.7, 0, 1)) + 25 * smooth_noise(n, r, 9.0)
    env = np.sin(np.pi * np.clip((t - 0.12) / 0.75, 0, 1)) ** 0.8
    saw = np.sign(np.sin(phase(f))) * 0.5 + np.sin(phase(f * 2.01)) * 0.3
    creak = bp(saw, 400, 3200, 1) * env * 0.45
    return fades(latch + creak, 0.001, 0.06)

def footstep(r):
    dur = 0.2
    t = tt(dur)
    heel = np.exp(-t / 0.022) * np.sin(phase(105 * (1 - 0.25 * t))) * 1.0
    scuff = bp(r.standard_normal(len(t)), 300, 2400, 1) * np.exp(-t / 0.02) * 0.45
    return fades(heel + scuff, 0.001, 0.03)

def crosswalk_beep(r, dur=1.75):
    t = tt(dur)
    gate = ((t % 0.42) < 0.07).astype(float)
    y = (np.sin(TAU * 1480 * t) + 0.3 * np.sin(TAU * 2960 * t)) * ndsmooth(gate) * 0.5
    return fades(y, 0.003, 0.03)

def ndsmooth(g, k=90):
    return np.convolve(g, np.ones(k) / k, mode="same")

def glass_clink(r):
    dur = 0.9
    a = modal(dur, [(3120, 1.0, 0.28), (5480, 0.5, 0.16), (8210, 0.25, 0.09)], r)
    b = modal(dur, [(3460, 0.8, 0.24), (6100, 0.4, 0.13)], r)
    b = np.roll(b, ns(0.035)); b[:ns(0.035)] = 0
    return fades(a + b, 0.0005, 0.1)

def pigeon_flap(r, dur=0.8):
    n = ns(dur)
    t = np.arange(n) / SR
    beats = 0.5 + 0.5 * np.sin(TAU * 11.5 * t - 1.2)
    y = bp(colored(n, r, 0.5), 350, 3200, 1) * beats ** 3 * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6
    coo = np.sin(phase(430 + 60 * np.sin(TAU * 7 * t))) * np.exp(-((t - 0.62) / 0.09) ** 2) * 0.18
    return fades(widen(y + coo, r, 8, 0.7), 0.01, 0.08)

def stone_thud(r):
    dur = 0.4
    t = tt(dur)
    thud = np.exp(-t / 0.05) * np.sin(phase(150 * (1 - 0.3 * t))) * 0.9
    tap = modal(dur, [(940, 0.5, 0.02), (1870, 0.3, 0.012)], r)
    return fades(thud + tap, 0.001, 0.05)

def toaster_pop(r):
    # spring CLUNK, sliding chrome rattle, then the "ding" timer bell 0.12 s later
    dur = 2.0
    n = ns(dur)
    t = np.arange(n) / SR
    clunk = np.exp(-t / 0.035) * np.sin(phase(170 * (1 + 0.6 * np.exp(-t / 0.015)))) * 1.3
    spring = np.sin(phase(640 * (1 + 0.5 * np.exp(-t / 0.05)))) * np.exp(-t / 0.09) * (0.6 + 0.4 * np.sin(TAU * 38 * t)) * 0.5
    rattle = resbank(hp(r.standard_normal(n), 900) * np.exp(-t / 0.05), SMALLMETAL) * 0.25
    bell = modal(dur, [(2093, 1.0, 0.75), (2093 * 2.76, 0.4, 0.35), (2093 * 5.4, 0.18, 0.14)], r)
    k = ns(0.12)
    ding = np.zeros(n); ding[k:] = bell[:n - k]
    return fades(widen(clunk + spring + rattle, r, 8, 0.5) + st(ding * 0.85), 0.001, 0.25)

# ---------------- Ambience beds ----------------
def amb_room(dur, r, hum=50.0):
    n = ns(dur)
    t = np.arange(n) / SR
    tone = lp(colored(n, r, 1.6), 420, 2) * 0.5 + np.sin(TAU * hum * t) * 0.03 + np.sin(TAU * hum * 2 * t) * 0.012
    air = bp(colored(n, r, 0.9), 500, 3000, 1) * 0.07
    return fades(st(tone) + widen(air, r, 12, 0.8), 0.25, 0.35)

def amb_street(dur, r):
    n = ns(dur)
    rumble = lp(colored(n, r, 1.4), 220, 2) * (0.4 + 0.2 * smooth_noise(n, r, 0.25))
    air = bp(colored(n, r, 0.7), 400, 2600, 1) * (0.14 + 0.08 * smooth_noise(n, r, 0.5))
    birds = np.zeros(n)
    tm = r.uniform(0.2, 0.8)
    while tm < dur - 0.3:
        k = ns(tm)
        L = min(ns(0.11), n - k)
        tl = np.arange(L) / SR
        f0 = r.uniform(3200, 4800)
        birds[k:k + L] += np.sin(phase(f0 * (1 + 0.25 * np.sin(TAU * 18 * tl)))) * np.sin(np.pi * tl / 0.11) ** 2 * r.uniform(0.03, 0.08)
        tm += r.uniform(0.12, 1.1)
    return fades(st(rumble) + widen(air + birds, r, 11, 0.8), 0.25, 0.35)

def amb_night(dur, r, murmur=False):
    n = ns(dur)
    t = np.arange(n) / SR
    crick = np.sin(TAU * 4300 * t) * (0.5 + 0.5 * np.sign(np.sin(TAU * 31 * t))) * (np.sin(TAU * 1.9 * t) > 0.2) * 0.035
    crick2 = np.sin(TAU * 3650 * t) * (0.5 + 0.5 * np.sign(np.sin(TAU * 27 * t))) * (np.sin(TAU * 1.3 * t + 1.0) > 0.4) * 0.025
    air = lp(colored(n, r, 1.5), 300, 2) * 0.3
    out = st(air) + pan(crick, -0.5) + pan(crick2, 0.55)
    if murmur:  # distant restaurant chatter: slowly modulated vocal-band noise
        mm = bp(colored(n, r, 1.0), 250, 1300, 1) * (0.5 + 0.5 * smooth_noise(n, r, 3.5)) * 0.22
        out += widen(mm, r, 13, 0.9)
    return fades(out, 0.25, 0.35)
