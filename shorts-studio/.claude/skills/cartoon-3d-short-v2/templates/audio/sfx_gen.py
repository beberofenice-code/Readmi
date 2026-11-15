# Procedural Foley & Ambience Generators for Shorts-Studio v2 (numpy + scipy only):
# Automotive brake-check screech, sheet-metal + glass collision crunch, cash register cha-ching,
# fluttering banknotes, office rotary/desk phone ring, flip-counter clack, hot-tub bubbles,
# rain-on-car-roof cabin bed, windshield wiper sweep, dashcam REC beep, plus the shadow short's foley + set ambiences.
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


# ---------------------------------------------------------------- "What If Your Shadow Walked Away?" foley
def _burst(r, dur, lo, hi, tau, order=1):
    t = tt(dur)
    return bp(r.standard_normal(len(t)), lo, hi, order) * np.exp(-t / tau)

def shadow_rise(r, dur=1.1):
    """airy upward swell + soft rising tone: something flat lifting itself off the ground"""
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    env = np.sin(np.pi * u) ** 1.2
    air = np.zeros(n)
    for k, (lo, hi) in enumerate([(250, 700), (600, 1500), (1300, 3200)]):
        air += bp(colored(n, r, 0.6), lo, hi, 1) * np.clip(1 - np.abs(u * 2.6 - 0.5 - k * 0.7), 0, 1)
    tone = np.sin(phase(190 * 2 ** (1.4 * u))) * 0.22 + np.sin(phase(285 * 2 ** (1.4 * u))) * 0.1
    return fades(widen((air * 0.5 + tone) * env, r, 12, 0.8), 0.04, 0.15)

def stretch_squeak(r, dur=0.55):
    """rubbery stretch: bending pitch with a little friction grit"""
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = 330 * 2 ** (0.9 * u ** 1.6) * (1 + 0.02 * np.sin(TAU * 31 * t))
    ph = phase(f)
    y = (np.sin(ph + 0.6 * np.sin(2 * ph)) * 0.5 + bp(colored(n, r, 0.5), 900, 3000, 1) * 0.12) * np.sin(np.pi * u) ** 0.7
    return fades(y, 0.01, 0.05)

def soft_steps(r, dur=1.45, n_steps=6):
    """a handful of soft footfalls"""
    n = ns(dur)
    y = np.zeros(n)
    for i in range(n_steps):
        k = ns(0.02 + i * (dur - 0.2) / n_steps + r.uniform(-0.012, 0.012))
        s = _burst(r, 0.12, 70, 420, 0.022, 2) * 1.2 + _burst(r, 0.12, 1500, 5000, 0.006) * 0.18
        L = min(len(s), n - k)
        y[k:k + L] += s[:L] * r.uniform(0.75, 1.0)
    return fades(y, 0.002, 0.05)

def peel_snap(r):
    """rubber-band snap + cartoon pop"""
    dur = 0.4
    t = tt(dur)
    snap = hp(r.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.9
    pop = np.sin(phase(620 * np.exp(-t / 0.05) + 150)) * np.exp(-t / 0.07) * 1.1
    twang = modal(dur, [(410, 0.4, 0.09), (830, 0.2, 0.05)], r, glide=0.25, glide_tau=0.03)
    return fades(snap + pop + twang, 0.0005, 0.05)

def whoosh(r, dur=0.55):
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    env = np.sin(np.pi * u) ** 1.6
    a = bp(colored(n, r, 0.5), 300, 1400, 1) * (1 - u) + bp(colored(n, r, 0.5), 900, 4200, 1) * u
    return fades(widen(a * env, r, 10, 0.9), 0.02, 0.08)

def briefcase_thud(r):
    dur = 0.5
    t = tt(dur)
    thud = np.sin(phase(96 * (1 + 0.5 * np.exp(-t / 0.02)))) * np.exp(-t / 0.07) * 1.5
    body = modal(dur, [(210, 0.5, 0.06), (480, 0.3, 0.035)], r)
    latch = np.roll(modal(dur, [(2900, 0.35, 0.02), (4300, 0.25, 0.015)], r), ns(0.05))
    latch[:ns(0.05)] = 0
    return fades(thud + body + latch + _burst(r, dur, 300, 2500, 0.012) * 0.4, 0.001, 0.05)

def keyboard(r, dur=2.2):
    """office typing: irregular plastic key clicks"""
    n = ns(dur)
    y = np.zeros(n)
    tm = 0.02
    while tm < dur - 0.06:
        k = ns(tm)
        s = _burst(r, 0.035, 1800, 6500, 0.004) * 0.8 + modal(0.035, [(r.uniform(900, 1500), 0.4, 0.008)], r)
        L = min(len(s), n - k)
        y[k:k + L] += s[:L] * r.uniform(0.4, 1.0)
        tm += r.uniform(0.055, 0.17)
    return fades(widen(y, r, 7, 0.7), 0.01, 0.1)

def mail_slot(r):
    """brass flap clack + paper sliding through"""
    dur = 0.6
    t = tt(dur)
    clack = modal(dur, [(1450, 0.8, 0.03), (2380, 0.5, 0.022), (3900, 0.3, 0.015)], r) + _burst(r, dur, 500, 3000, 0.008) * 0.6
    paper = bp(colored(len(t), r, 0.3), 2000, 7000, 1) * np.clip((t - 0.05) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.1) / 0.14) * 0.35
    clack2 = np.roll(clack, ns(0.3)) * 0.55
    clack2[:ns(0.3)] = 0
    return fades(clack + paper + clack2, 0.0005, 0.05)

def card_flip(r):
    dur = 0.22
    t = tt(dur)
    y = bp(colored(len(t), r, 0.2), 1500, 8000, 1) * np.sin(np.pi * np.clip(t / 0.12, 0, 1)) ** 2 * 0.6
    y += hp(r.standard_normal(len(t)), 3000) * np.exp(-np.abs(t - 0.12) / 0.004) * 0.5
    return fades(y, 0.002, 0.03)

def phone_beep(r):
    dur = 0.62
    t = tt(dur)
    y = np.zeros(len(t))
    for i, (f1, f2) in enumerate([(697, 1209), (770, 1336), (852, 1477), (941, 1336)]):
        g = ((t >= i * 0.15) & (t < i * 0.15 + 0.1)).astype(float)
        y += (np.sin(TAU * f1 * t) + np.sin(TAU * f2 * t)) * g * 0.3
    return fades(lp(y, 3400), 0.003, 0.02)

def ticket_stamp(r):
    """rubber-stamp thunk + a tiny service-bell ding"""
    dur = 0.9
    t = tt(dur)
    thunk = np.sin(phase(120 * (1 + 0.6 * np.exp(-t / 0.015)))) * np.exp(-t / 0.05) * 1.4 + _burst(r, dur, 300, 2200, 0.01) * 0.5
    bell = np.roll(modal(dur, [(2093, 0.8, 0.35), (2093 * 2.76, 0.3, 0.14)], r), ns(0.09))
    bell[:ns(0.09)] = 0
    return fades(thunk + bell * 0.6, 0.0005, 0.08)

def shoe_thud(r):
    dur = 0.3
    t = tt(dur)
    y = np.sin(phase(84 * (1 + 0.4 * np.exp(-t / 0.02)))) * np.exp(-t / 0.05) * 1.2
    sand = bp(colored(len(t), r, 0.6), 600, 4500, 1) * np.exp(-t / 0.05) * 0.5
    return fades(y + sand, 0.001, 0.04)

def shimmer(r, dur=1.7):
    """glassy rising sparkle: the shadow clicking back into place"""
    n = ns(dur)
    y = np.zeros(n)
    for i, m in enumerate([72, 76, 79, 84, 88, 91]):
        f = 440.0 * 2 ** ((m - 69) / 12.0)
        k = ns(i * 0.075)
        s = modal(dur - i * 0.075, [(f, 0.7, 0.55), (f * 2.0, 0.25, 0.3), (f * 3.01, 0.12, 0.18)], r)
        y[k:k + len(s)] += s[:n - k] * (0.9 - 0.08 * i)
    return fades(widen(y, r, 14, 0.9), 0.002, 0.25)

def amb_city(dur, r):
    """daytime street: distant traffic hum + air"""
    n = ns(dur)
    hum = lp(colored(n, r, 1.5), 220, 2) * 0.45
    air = bp(colored(n, r, 0.8), 400, 2600, 1) * (0.2 + 0.1 * smooth_noise(n, r, 0.3))
    return fades(st(hum) + widen(air, r, 11, 0.7), 0.25, 0.35)

def amb_office(dur, r):
    """fluorescent mains hum + ventilation"""
    n = ns(dur)
    t = np.arange(n) / SR
    hum = (np.sin(TAU * 120 * t) + 0.35 * np.sin(TAU * 240 * t) + 0.15 * np.sin(TAU * 360 * t)) * 0.12
    vent = bp(colored(n, r, 1.0), 150, 1600, 1) * 0.3
    return fades(st(hum) + widen(vent, r, 9, 0.5), 0.2, 0.3)

def amb_room(dur, r):
    """quiet apartment room tone"""
    n = ns(dur)
    return fades(widen(lp(colored(n, r, 1.3), 500, 2) * 0.3, r, 9, 0.5), 0.2, 0.3)

def amb_beach(dur, r):
    """slow surf: overlapping wave swells + hiss of foam"""
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    tm = -1.5
    while tm < dur:
        L = r.uniform(3.6, 5.2)
        u = np.clip((t - tm) / L, 0, 1)
        env = np.where((t >= tm) & (t < tm + L), np.sin(np.pi * u ** 0.6) ** 2, 0.0)
        y += env * (bp(colored(n, r, 0.9), 180, 1800, 1) * (1 - 0.6 * u) + bp(colored(n, r, 0.3), 1800, 7000, 1) * 0.5 * u)
        tm += r.uniform(2.6, 3.8)
    return fades(widen(y * 0.5, r, 13, 0.9), 0.3, 0.4)
