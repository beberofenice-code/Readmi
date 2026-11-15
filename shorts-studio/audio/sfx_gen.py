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

# ---------------- Lighthouse short: storm, machinery and harbour foley ----------------
BOXMETAL = [(180, 1.0, 0.12), (410, 0.7, 0.09), (930, 0.5, 0.06), (2100, 0.3, 0.04)]

def thunder(r, dur=3.4):
    n = ns(dur)
    t = np.arange(n) / SR
    crack = hp(r.standard_normal(n), 1400) * np.exp(-t / 0.035) * 1.2
    crack += bp(r.standard_normal(n), 400, 3000, 1) * np.exp(-np.maximum(0, t - 0.03) / 0.16) * (t > 0.03) * 0.7
    roll = lp(colored(n, r, 1.6), 190, 2) * np.minimum(1, t / 0.03) * np.exp(-t / 1.0) * (1.0 + 0.6 * smooth_noise(n, r, 5.0)) * 2.4
    sub = np.sin(phase(52 * (1 + 0.4 * np.exp(-t / 0.05)))) * np.exp(-t / 0.5) * 1.6
    return fades(widen(crack + roll + sub, r, 14, 0.85), 0.001, 0.5)

def wave_crash(r, dur=2.4):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.minimum(1, (t / 0.22)) ** 2 * np.exp(-np.maximum(0, t - 0.22) / 0.65)
    wash = bp(colored(n, r, 0.5), 180, 6500, 1) * env
    hiss = hp(colored(n, r, 0.2), 3500) * np.exp(-np.maximum(0, t - 0.3) / 0.9) * (t > 0.2) * 0.35
    thump = lp(r.standard_normal(n), 110, 2) * np.exp(-np.maximum(0, t - 0.18) / 0.12) * (t > 0.15) * 2.2
    return fades(widen(wash + hiss + thump, r, 13, 0.9), 0.02, 0.4)

def switch_clunk(r):
    dur = 0.85
    t = tt(dur)
    thump = np.sin(phase(105 * (1 - 0.3 * t))) * np.exp(-t / 0.05) * 1.5
    jaws = modal(dur, [(640, 0.8, 0.06), (1480, 0.5, 0.04), (2900, 0.3, 0.03)], r)
    click = hp(r.standard_normal(len(t)), 2600) * np.exp(-t / 0.004) * 0.6
    f = 118 * np.exp(-t / 0.28) + 36
    powerdown = (np.sin(phase(f)) + 0.4 * np.sin(2 * phase(f))) * np.minimum(1, t / 0.02) * np.exp(-t / 0.3) * 0.7
    return fades(thump + jaws + click + powerdown, 0.001, 0.08)

def motor_die(r, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    zap = np.zeros(n)
    for _ in range(9):
        k = ns(r.uniform(0.0, 0.5))
        L = ns(r.uniform(0.02, 0.07))
        m = min(L, n - k)
        zap[k:k + m] += hp(r.standard_normal(L), 2800)[:m] * np.linspace(1, 0, L)[:m] * r.uniform(0.5, 1.0)
    f = 30 + 420 * np.exp(-t / 0.7)
    ph = phase(f)
    whine = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.33 * np.sin(3 * ph)) * np.exp(-t / 1.1) * 0.55
    rattle = bp(r.standard_normal(n), 300, 1800, 1) * (0.5 + 0.5 * np.sign(np.sin(ph * 0.25))) * np.exp(-t / 0.9) * 0.3
    return fades(zap * 0.9 + whine + rattle, 0.002, 0.3)

def crank_ratchet(r, dur=1.1):
    n = ns(dur)
    y = np.zeros(n)
    tm = 0.0
    while tm < dur - 0.06:
        k = ns(tm)
        f0 = r.uniform(1500, 2300)
        c = modal(0.05, [(f0, 0.8, 0.012), (f0 * 2.4, 0.4, 0.007)], r)
        m = min(len(c), n - k)
        y[k:k + m] += c[:m] * r.uniform(0.6, 1.0)
        tm += 0.062 + r.uniform(-0.008, 0.008)
    groan = bp(colored(n, r, 1.0), 120, 520, 1) * (0.5 + 0.5 * np.sin(TAU * 1.8 * np.arange(n) / SR)) * 0.5
    return fades(y + groan, 0.005, 0.05)

def boot_clang(r):
    dur = 0.7
    t = tt(dur)
    box_ = modal(dur, BOXMETAL, r)
    thump = np.sin(phase(88 * (1 - 0.3 * t))) * np.exp(-t / 0.04) * 1.3
    slap = bp(r.standard_normal(len(t)), 700, 4000, 1) * np.exp(-t / 0.01) * 0.6
    return fades(box_ + thump + slap, 0.001, 0.08)

def ship_horn(r, dur=1.7):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.14) * np.minimum(1, (dur - t) / 0.35)
    y = np.zeros(n)
    for f0, g in ((98.0, 1.0), (147.0, 0.7)):
        ph = phase(f0 * (1 + 0.004 * np.sin(TAU * 4.6 * t)))
        for h in range(1, 9):
            y += g * np.sin(h * ph) / h ** 1.15
    y = lp(y, 1100, 2) * env
    air = bp(colored(n, r, 0.6), 200, 1500, 1) * env * 0.12
    return fades(widen(y * 0.5 + air, r, 15, 0.6), 0.01, 0.1)

def telegraph_bell(r):
    dur = 0.95
    y = np.zeros(ns(dur))
    for k, g in ((0.0, 1.0), (0.17, 0.85)):
        b = modal(dur - k, [(1760, 1.0, 0.33), (1760 * 2.76, 0.4, 0.14), (1760 * 5.4, 0.18, 0.06)], r)
        i0 = ns(k)
        y[i0:i0 + len(b)] += b[:len(y) - i0] * g
    return fades(y, 0.001, 0.08)

def anchor_splash(r, dur=2.1):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    tm = 0.0
    while tm < 0.42:
        k = ns(tm)
        L = ns(0.03)
        y[k:k + L] += bp(r.standard_normal(L), 1400, 5200, 1) * np.linspace(1, 0, L) * r.uniform(0.4, 0.9)
        tm += r.uniform(0.018, 0.034)
    ts = np.maximum(0, t - 0.42)
    on = (t > 0.42)
    splash = bp(colored(n, r, 0.4), 260, 5500, 1) * on * np.minimum(1, ts / 0.02) * np.exp(-ts / 0.38) * 1.5
    plunge = lp(r.standard_normal(n), 140, 2) * on * np.exp(-ts / 0.16) * 2.4
    return fades(widen(y * 0.7 + splash + plunge, r, 11, 0.8), 0.002, 0.3)

def gull_cry(r):
    dur = 1.15
    n = ns(dur)
    y = np.zeros(n)
    for k, t0 in enumerate((0.0, 0.33, 0.62)):
        L = ns(0.26)
        tl = np.arange(L) / SR
        f = (1950 - 120 * k) * (1 - 0.28 * (tl / 0.26)) * (1 + 0.03 * np.sin(TAU * 28 * tl))
        ph = phase(f)
        c = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.sin(np.pi * tl / 0.26) ** 1.2
        i0 = ns(t0)
        y[i0:i0 + L] += c * (1.0 - 0.18 * k)
    return fades(y * 0.5, 0.005, 0.05)

def paper_rustle(r, dur=0.95):
    n = ns(dur)
    env = np.clip(0.55 + 0.8 * smooth_noise(n, r, 14.0), 0, None) * np.sin(np.pi * np.arange(n) / n) ** 0.6
    return fades(widen(hp(colored(n, r, 0.2), 2400) * env, r, 8, 0.8), 0.01, 0.08)

def mug_sip(r):
    dur = 0.75
    n = ns(dur)
    t = np.arange(n) / SR
    slurp = np.zeros(n)
    L = ns(0.42)
    seg = r.standard_normal(L)
    for k in range(6):  # rising-band slurp
        a, b = k * L // 6, (k + 1) * L // 6
        slurp[a:b] = bp(seg, 700 + 420 * k, 2400 + 500 * k, 1)[a:b]
    slurp[:L] *= np.sin(np.pi * np.arange(L) / L) ** 0.8 * (0.7 + 0.3 * np.sin(TAU * 31 * np.arange(L) / SR))
    tick = modal(0.2, [(2650, 0.6, 0.05), (5300, 0.3, 0.03)], r)
    i0 = ns(0.52)
    slurp[i0:i0 + len(tick)] += tick[:n - i0] * 0.6
    return fades(slurp, 0.01, 0.05)

def amb_storm(dur, r, inside=False):
    """Gale + rain + surf bed; `inside` = heard through lantern-room / wheelhouse glass."""
    n = ns(dur)
    gust = 0.55 + 0.45 * smooth_noise(n, r, 0.35)
    wind = bp(colored(n, r, 1.0), 180, 1400, 1) * gust * 0.6
    howl_f = 520 + 160 * smooth_noise(n, r, 0.5)
    howl = np.sin(phase(howl_f)) * bp(colored(n, r, 0.8), 300, 900, 1) * gust ** 2 * 0.5
    rain = bp(colored(n, r, 0.3), 1200, 7000, 1) * 0.3
    surf = lp(colored(n, r, 1.5), 240, 2) * (0.6 + 0.4 * smooth_noise(n, r, 0.22)) * 0.75
    out = widen(wind + howl, r, 13, 0.7) + widen(rain, r, 7, 0.9) + st(surf)
    if inside:
        out = lp(out, 1500, 2) * 0.8 + widen(bp(colored(n, r, 0.2), 2200, 6000, 1) * 0.12, r, 6, 0.9)
    return fades(out, 0.2, 0.3)

def amb_calm_sea(dur, r):
    n = ns(dur)
    swell = 0.5 + 0.5 * np.sin(TAU * 0.16 * np.arange(n) / SR + 1.0)
    wash = bp(colored(n, r, 0.8), 250, 3200, 1) * (0.25 + 0.75 * swell ** 2) * 0.5
    air = lp(colored(n, r, 1.2), 400, 1) * 0.2
    return fades(widen(wash, r, 12, 0.8) + st(air), 0.4, 0.4)
