# Procedural Foley & Ambience Generators for Shorts-Studio v2 (numpy + scipy only):
# Automotive brake-check screech, sheet-metal + glass collision crunch, cash register cha-ching,
# fluttering banknotes, office rotary/desk phone ring, flip-counter clack, hot-tub bubbles,
# rain-on-car-roof cabin bed, windshield wiper sweep, and dashcam REC beep.
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, reson, resbank, peq, colored, smooth_noise, fades, phase, modal, pan, st, widen, place)

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


# ---------------- "Billionaire" short additions ----------------
def alarm_ring(r, dur=1.9):
    """mechanical twin-bell alarm: hammer at ~22 Hz between two bells"""
    n = ns(dur)
    hits = np.arange(0, dur - 0.05, 1 / 22.0)
    y = np.zeros(n)
    for i, tm in enumerate(hits):
        f0 = 2650 if i % 2 else 3150
        b = modal(0.12, [(f0, 1.0, 0.05), (f0 * 2.31, 0.4, 0.02), (f0 * 0.5, 0.25, 0.06)], r)
        k = ns(tm)
        m = min(len(b), n - k)
        y[k:k + m] += b[:m] * (0.8 + 0.2 * r.random())
    env = np.minimum(1, tt(dur) / 0.02) * np.where(tt(dur) > dur - 0.25, (dur - tt(dur)) / 0.25, 1)
    return fades(widen(y * env * 0.5, r, 6, 0.5), 0.002, 0.05)


def heli_whir(r, dur=2.9):
    """turbine whine rising + rotor chop accelerating"""
    n = ns(dur)
    t = np.arange(n) / SR
    spin = np.clip(t / dur, 0, 1) ** 0.8
    whine = np.sin(phase(380 + 900 * spin)) * 0.22 * spin
    rate = 4 + 13 * spin
    chop_ph = np.cumsum(rate) / SR
    chop = (0.5 + 0.5 * np.cos(TAU * chop_ph)) ** 6
    body = lp(colored(n, r, 1.0), 420, 2) * (0.4 + 1.4 * chop) * (0.3 + 0.7 * spin)
    return fades(widen(body + whine, r, 9, 0.7), 0.3, 0.3)


def car_whoosh(r, dur=0.9):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.exp(-((t - 0.42) / 0.16) ** 2)
    eng = np.sin(phase(150 * (1.35 - 0.6 * t / dur))) * 0.6 + 0.3 * np.sin(phase(300 * (1.35 - 0.6 * t / dur)))
    air = bp(colored(n, r, 0.6), 300, 4000, 2)
    y = (eng * 0.5 + air) * env
    p = np.clip((t - 0.42) / 0.5, -1, 1)
    return fades(np.stack([y * np.sqrt(0.5 - 0.5 * p), y * np.sqrt(0.5 + 0.5 * p)]), 0.01, 0.05)


def yacht_horn(r, dur=1.6):
    t = tt(dur)
    f = 110 * (1 + 0.004 * np.sin(TAU * 5 * t))
    y = sum(a * np.sin(phase(f * k)) for k, a in [(1, 1.0), (2, 0.6), (3, 0.45), (4, 0.25), (5, 0.15)])
    y = lp(y, 1800) * np.minimum(1, t / 0.08) * np.where(t > dur - 0.3, (dur - t) / 0.3, 1)
    return fades(y * 0.5, 0.01, 0.05)


def phone_buzz(r, dur=0.42):
    t = tt(dur)
    gate = ((t < 0.16) | ((t > 0.24) & (t < 0.4))).astype(float)
    y = (np.sign(np.sin(TAU * 172 * t)) * 0.4 + np.sin(TAU * 344 * t) * 0.3) * gate
    return fades(lp(y, 2400) * 0.6, 0.003, 0.02)


def gate_rattle(r, dur=0.9):
    n = ns(dur)
    y = np.zeros(n)
    for _ in range(14):
        k = ns(r.uniform(0, dur - 0.2))
        f0 = r.uniform(700, 1900)
        c = modal(0.2, [(f0, 1.0, 0.05), (f0 * 2.7, 0.5, 0.03), (f0 * 4.1, 0.25, 0.015)], r)
        m = min(len(c), n - k)
        y[k:k + m] += c[:m] * r.uniform(0.3, 1.0)
    return fades(widen(y * 0.5, r, 8, 0.7), 0.002, 0.08)


def crowd_laugh(r, dur=1.5, voices=9):
    """formant-filtered 'ha-ha-ha' pulse trains from several voices"""
    n = ns(dur)
    out = np.zeros((2, n))
    for v in range(voices):
        f0 = r.uniform(110, 260)
        rate = r.uniform(4.5, 6.5)
        t = np.arange(n) / SR
        st0 = r.uniform(0, 0.15)
        env = np.clip((t - st0) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - st0) / r.uniform(0.7, 1.3))
        puls = (0.5 + 0.5 * np.sin(TAU * rate * t - np.pi / 2)) ** 3
        src = np.sign(np.sin(phase(f0 * (1 + 0.04 * np.sin(TAU * rate * t))))) * 0.5 + 0.3 * r.standard_normal(n)
        voc = reson(src, 750, 5) + 0.7 * reson(src, 1250, 6) + 0.3 * reson(src, 2600, 8)
        out += pan(voc * puls * env, r.uniform(-0.7, 0.7))
    out = hp(out, 120)
    return fades(out / np.max(np.abs(out)) * 0.7, 0.01, 0.15)


def stamp(r):
    t = tt(0.45)
    thud = np.exp(-t / 0.05) * np.sin(phase(70 * (1 + 1.2 * np.exp(-t / 0.01)))) * 1.5
    slap = bp(r.standard_normal(len(t)), 600, 5000) * np.exp(-t / 0.012)
    return fades(thud + slap, 0.001, 0.05)


def door_open(r, dur=0.9):
    n = ns(dur)
    t = np.arange(n) / SR
    creak = np.zeros(n)
    k = 0.0
    while k < 0.7:
        i = ns(k)
        m = min(ns(0.01), n - i)
        creak[i:i + m] += np.hanning(m)
        k += 1 / (40 + 90 * k)
    creak = reson(creak, 900, 12) + 0.5 * reson(creak, 2100, 14)
    latch = modal(0.2, [(1800, 1.0, 0.03), (3300, 0.5, 0.015)], r)
    y = creak * 0.6
    y[:len(latch)] += latch
    return fades(y, 0.002, 0.08)


def record_scratch(r, dur=0.55):
    n = ns(dur)
    t = np.arange(n) / SR
    speed = np.interp(t, [0, 0.12, 0.2, 0.32, 0.55], [1.0, -1.6, 1.4, -0.8, 0.0])
    ph = np.cumsum(speed) / SR
    src = np.sin(TAU * 440 * ph) * 0.5 + bp(colored(n, r, 0.5), 800, 6000) * np.abs(speed) * 0.8
    return fades(src * 0.7, 0.003, 0.05)


def applause(r, dur=2.4, rate=60):
    n = ns(dur)
    y = np.zeros((2, n))
    tm = 0.0
    while tm < dur - 0.03:
        k = ns(tm)
        L = ns(0.018)
        cl = bp(r.standard_normal(L), r.uniform(900, 1600), r.uniform(3500, 7000)) * np.exp(-np.arange(L) / SR / 0.004)
        place(y, pan(cl * r.uniform(0.3, 1.0), r.uniform(-0.8, 0.8)), tm)
        tm += r.exponential(1 / rate)
    env = np.minimum(1, tt(dur) / 0.15) * np.exp(-np.maximum(0, tt(dur) - 1.4) / 0.5)
    return fades(y * env, 0.01, 0.2)


def sizzle(r, dur=3.2):
    n = ns(dur)
    y = hp(colored(n, r, 0.2), 2500) * 0.25 * (0.7 + 0.3 * smooth_noise(n, r, 3.0))
    tm = 0.0
    while tm < dur - 0.02:
        k = ns(tm)
        L = min(ns(0.006), n - k)
        y[k:k + L] += hp(r.standard_normal(L), 3000) * r.uniform(0.2, 0.9)
        tm += r.exponential(1 / 70)
    return fades(widen(y, r, 7, 0.8), 0.2, 0.4)


def pen_scribble(r, dur=1.35):
    n = ns(dur)
    t = np.arange(n) / SR
    stroke = (0.5 + 0.5 * np.sin(TAU * 7.5 * t + 2 * np.sin(TAU * 1.3 * t))) ** 2
    y = bp(colored(n, r, 0.3), 1800, 7000) * stroke * 0.5
    return fades(y, 0.02, 0.1)


def paper_tear(r, dur=0.55):
    n = ns(dur)
    t = np.arange(n) / SR
    crackle = np.zeros(n)
    tm = 0.0
    while tm < dur - 0.01:
        k = ns(tm)
        crackle[k] += r.uniform(0.3, 1.0)
        tm += r.exponential(1 / 900)
    y = bp(crackle, 1200, 9000) + bp(colored(n, r, 0.4), 1500, 8000) * 0.25
    return fades(y * np.minimum(1, t / 0.03) * 0.6, 0.002, 0.06)


def amb_room(dur, r):
    n = ns(dur)
    return fades(st(lp(colored(n, r, 1.2), 300) * 0.2), 0.2, 0.3)


def amb_birds(dur, r):
    n = ns(dur)
    out = st(lp(colored(n, r, 1.0), 500) * 0.15)
    tm = r.uniform(0.1, 0.5)
    while tm < dur - 0.4:
        f0 = r.uniform(2600, 4200)
        L = ns(r.uniform(0.08, 0.18))
        tl = np.arange(L) / SR
        chirp = np.sin(phase(f0 * (1 + 0.25 * np.sin(TAU * r.uniform(15, 30) * tl)))) * np.sin(np.pi * tl / tl[-1]) ** 2
        for rep in range(int(r.integers(1, 4))):
            place(out, pan(chirp * r.uniform(0.15, 0.35), r.uniform(-0.8, 0.8)), tm + rep * 0.14)
        tm += r.uniform(0.5, 1.4)
    return fades(out, 0.3, 0.3)


def amb_night(dur, r, city=False):
    n = ns(dur)
    t = np.arange(n) / SR
    cr = (np.sin(TAU * 4300 * t) * (0.5 + 0.5 * np.sign(np.sin(TAU * 19 * t))) * (0.5 + 0.5 * np.sin(TAU * 0.7 * t)) ** 4) * 0.05
    out = widen(cr, r, 13, 0.9)
    if city:
        out += st(lp(colored(n, r, 1.3), 220) * 0.35) + widen(bp(colored(n, r, 0.8), 200, 1500) * 0.1, r, 11, 0.8)
    return fades(out, 0.3, 0.3)


def amb_water(dur, r):
    n = ns(dur)
    lap = bp(colored(n, r, 0.9), 150, 1400) * (0.4 + 0.6 * (0.5 + 0.5 * np.sin(TAU * 0.35 * np.arange(n) / SR + smooth_noise(n, r, 0.3))) ** 3)
    return fades(widen(lap * 0.5, r, 11, 0.8), 0.4, 0.4)
