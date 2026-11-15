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


# ---------------- "Everyone Was Gone" foley (empty-world set) ----------------
def alarm_clock(r):
    dur = 0.78
    t = tt(dur)
    gate = ((t % 0.19) < 0.095).astype(float)
    tone = np.sign(np.sin(TAU * 2050 * t)) * 0.5 + np.sin(TAU * 4100 * t) * 0.25
    return fades(lp(tone * gate, 5200) * 0.6, 0.002, 0.02)

def wind_gust(r, dur=2.8):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6 * (0.7 + 0.3 * smooth_noise(n, r, 1.3))
    body = bp(colored(n, r, 1.0), 160, 1300, 2) * env
    whistle = reson(colored(n, r, 0.5), 720, 9) * env ** 2 * 0.12
    return fades(widen(body + whistle, r, 12, 0.85), 0.2, 0.4)

def phone_ringout(r):
    dur = 2.3
    t = tt(dur)
    gate = ((t < 0.9) | ((t > 1.25) & (t < 2.15))).astype(float)
    gate = lp(gate, 60)
    tone = (np.sin(TAU * 440 * t) + np.sin(TAU * 480 * t)) * 0.35 * gate
    return fades(bp(tone, 300, 3200, 2), 0.01, 0.05)

def whoosh(r, dur=0.5):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 2
    nz = colored(n, r, 0.6)
    y = bp(nz, 500, 2600, 2) * env * (1 - t / dur) + bp(nz, 1400, 6000, 2) * env * (t / dur)
    return fades(widen(y, r, 9, 0.7), 0.01, 0.05)

def engine_rev(r, dur=2.2):
    n = ns(dur)
    t = np.arange(n) / SR
    f0 = 62 + 150 * np.clip(t / 1.3, 0, 1) ** 0.7 - 30 * np.clip((t - 1.4) / 0.8, 0, 1)
    ph = phase(f0)
    saw = sum(np.sin(k * ph) / k for k in range(1, 9))
    growl = lp(saw * (1 + 0.35 * np.sin(ph * 0.5)), 1900, 2)
    road = bp(colored(n, r, 0.9), 200, 2400, 1) * 0.35
    env = np.clip(t / 0.12, 0, 1) * (1 - 0.75 * np.clip((t - 1.5) / 0.7, 0, 1))
    return fades(widen((growl * 0.6 + road) * env, r, 10, 0.5), 0.02, 0.25)

def cart_rattle(r, dur=2.8):
    n = ns(dur)
    t = np.arange(n) / SR
    roll = bp(colored(n, r, 1.1), 90, 700, 2) * (0.5 + 0.3 * smooth_noise(n, r, 7.0))
    y = roll * 0.5
    tm = 0.03
    while tm < dur - 0.12:
        k = ns(tm)
        tick = modal(0.1, [(r.uniform(1700, 2300), 0.8, 0.02), (r.uniform(3300, 5200), 0.5, 0.012)], r)
        L = min(len(tick), n - k)
        y[k:k + L] += tick[:L] * r.uniform(0.15, 0.6)
        tm += r.uniform(0.04, 0.16)
    env = np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return fades(widen(y * env, r, 8, 0.6), 0.02, 0.2)

def crown_ding(r):
    dur = 1.5
    y = np.zeros(ns(dur))
    for i, f0 in enumerate([1568.0, 1975.5, 2349.3, 3136.0]):
        bell = modal(1.1, [(f0, 1.0, 0.36), (f0 * 2.76, 0.4, 0.14), (f0 * 5.4, 0.15, 0.06)], r)
        k = ns(0.075 * i)
        L = min(len(bell), len(y) - k)
        y[k:k + L] += bell[:L] * (0.8 if i < 3 else 1.0)
    return fades(widen(y * 0.6, r, 9, 0.6), 0.001, 0.2)

def power_down(r, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    f0 = 26 + 96 * np.exp(-t / 0.62)
    ph = phase(f0)
    hum = (np.sin(ph) + 0.55 * np.sin(2 * ph) + 0.35 * np.sin(3 * ph) + 0.2 * np.sin(5 * ph)) * np.exp(-t / 1.1)
    whine = np.sin(phase(380 + 2600 * np.exp(-t / 0.42))) * np.exp(-t / 0.5) * 0.3
    relay = hp(r.standard_normal(n), 1800) * np.exp(-t / 0.006) * 0.9
    k = ns(1.55)
    thunk = np.zeros(n)
    tl = np.arange(n - k) / SR
    thunk[k:] = np.exp(-tl / 0.07) * np.sin(phase(70 * (1 - 0.3 * tl))) * 1.3
    return fades(widen(hum * 0.9 + whine + relay + thunk, r, 12, 0.5), 0.002, 0.3)

def steam_hiss(r, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    y = hp(colored(n, r, 0.2), 2400) * np.exp(-t / 0.9) * (0.8 + 0.2 * smooth_noise(n, r, 5.0))
    return fades(widen(y * 0.7, r, 7, 0.8), 0.05, 0.4)

def tap_sputter(r, dur=1.0):
    n = ns(dur)
    t = np.arange(n) / SR
    gate = np.clip(smooth_noise(n, r, 16.0) * 1.6, 0, 1) ** 2 * np.exp(-t / 0.45)
    spit = bp(r.standard_normal(n), 500, 4200, 2) * gate
    gurgle = np.sin(phase(150 + 90 * smooth_noise(n, r, 9.0))) * gate * 0.5
    squeak = np.sin(phase(1500 + 500 * np.sin(TAU * 9 * t))) * np.exp(-t / 0.12) * 0.14
    return fades(spit * 0.7 + gurgle + squeak, 0.005, 0.1)

def water_drip(r):
    dur = 0.3
    t = tt(dur)
    plink = np.sin(phase(820 + 1300 * np.clip(t / 0.03, 0, 1))) * np.exp(-t / 0.035)
    ring = modal(dur, [(2100, 0.35, 0.06), (3400, 0.2, 0.04)], r)
    return fades(plink * 0.8 + ring, 0.001, 0.05)

def flies_buzz(r, dur=2.4):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for _ in range(4):
        f0 = r.uniform(170, 240) * (1 + 0.08 * smooth_noise(n, r, 3.0))
        ph = phase(f0)
        am = np.clip(0.5 + 0.9 * smooth_noise(n, r, 2.2), 0, 1)
        y += sum(np.sin(k * ph) / k for k in range(1, 7)) * am
    env = np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return fades(widen(bp(y, 160, 3200, 1) * env * 0.4, r, 10, 0.9), 0.05, 0.3)

def radio_static(r, dur=3.6):
    n = ns(dur)
    t = np.arange(n) / SR
    hiss = bp(r.standard_normal(n), 600, 6500, 2) * (0.55 + 0.45 * smooth_noise(n, r, 6.0))
    crackle = hp(r.standard_normal(n), 3000) * (r.uniform(0, 1, n) > 0.9985).astype(float) * 6.0
    crackle = lp(crackle, 7000)
    whine = np.sin(phase(1150 + 500 * smooth_noise(n, r, 0.6))) * 0.06 * (0.5 + 0.5 * smooth_noise(n, r, 1.1))
    env = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 1.1, 0, 1)
    return fades((hiss * 0.6 + crackle + whine) * env, 0.003, 0.3)

def ghost_chime(r):
    dur = 1.3
    y = modal(dur, [(1174.7, 1.0, 0.42), (1760.0, 0.6, 0.3), (2349.3, 0.3, 0.18), (3520.0, 0.12, 0.09)], r)
    air = hp(colored(len(y), r, 0.3), 5000) * np.exp(-tt(dur)[:len(y)] / 0.12) * 0.08
    return fades(widen((y + air) * 0.6, r, 11, 0.8), 0.004, 0.3)

def crowd_murmur(r, dur=3.4):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for _ in range(14):
        fc = r.uniform(260, 1500)
        voice = reson(colored(n, r, 0.8), fc, r.uniform(3, 7))
        am = np.clip(smooth_noise(n, r, r.uniform(2.5, 5.5)) * 1.4, 0, 1) ** 1.5
        y += voice * am * r.uniform(0.4, 1.0)
    env = np.clip(t / 1.2, 0, 1) ** 1.3 * np.clip((dur - t) / 1.0, 0, 1)
    return fades(widen(lp(y, 2600) * env * 0.25, r, 13, 0.95), 0.1, 0.5)

def amb_wind(dur, r):
    n = ns(dur)
    air = bp(colored(n, r, 1.2), 110, 900, 1) * (0.45 + 0.35 * smooth_noise(n, r, 0.35))
    return fades(widen(air, r, 13, 0.8), 0.25, 0.35)
