# Zombie-apocalypse audio profile for audio/mix.py (selected by timeline.json "profile": "zombie").
# Procedural foley (alarm clock, phone buzz, groans, pan BONK, dumpster slam, record scratch, crowd cheer, ...),
# per-set ambience beds (bedroom room tone + distant siren, windy empty street, groaning horde, cheerful costume crowd)
# and a two-part score: sneaky D-minor pizzicato creep that builds to a riser and cuts dead on `music_stop`,
# then (after a beat of silence) a bouncy D-major groove that lands on a brass fanfare for "best zombie".
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, dbg, lp, hp, bp, reson, resbank, colored, smooth_noise, fades, phase, modal, shape,
                 pan, st, place, widen, make_ir, convolve_st, integrated)
import instruments as I
import sfx_gen as G


# ======================================================================= voices (groans, chatter, cheers)
VOWELS = {
    "uh": [(640, 7, 1.0), (1190, 9, 0.55), (2390, 11, 0.25)],
    "aa": [(760, 6, 1.0), (1100, 8, 0.65), (2450, 11, 0.3)],
    "oo": [(330, 6, 1.0), (850, 8, 0.4), (2300, 11, 0.15)],
    "eh": [(530, 7, 1.0), (1850, 9, 0.5), (2500, 11, 0.3)],
    "ee": [(300, 7, 0.9), (2250, 10, 0.55), (3000, 12, 0.3)],
}


def _saw(ph):
    return 2.0 * ((ph / TAU) % 1.0) - 1.0


def groan(r, dur=1.6, f0=92.0, vowel=("uh", "aa"), rise=0.12, fry=0.45):
    """zombie groan: rough sawtooth glottal source (vocal fry sub-harmonic) through sliding vowel formants + breath"""
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    contour = 1 + rise * np.sin(np.pi * np.clip(u * 1.2, 0, 1)) - 0.18 * u ** 2
    f = f0 * contour * (1 + 0.035 * smooth_noise(n, r, 7.0))
    ph = phase(f)
    src = _saw(ph) * (1 + fry * np.sin(ph / 2 + 0.3 * smooth_noise(n, r, 3.0)))
    src = lp(src, 3200, 2)
    a = resbank(src, VOWELS[vowel[0]])
    b = resbank(src, VOWELS[vowel[1]])
    k = np.clip(u * 1.6 - 0.2, 0, 1)
    y = a * (1 - k) + b * k
    breath = bp(r.standard_normal(n), 500, 3200, 1) * 0.12 * (0.6 + 0.4 * smooth_noise(n, r, 4.0))
    env = np.minimum(1, t / 0.18) * np.minimum(1, (dur - t) / 0.45) ** 1.3
    env *= 0.8 + 0.2 * smooth_noise(n, r, 2.5)
    return fades((y / (np.std(y) + 1e-9) * 0.5 + breath) * np.clip(env, 0, 1), 0.01, 0.05)


def _syllables(n, r, rate=4.5):
    """speech-like syllabic amplitude envelope"""
    e = np.maximum(0, smooth_noise(n, r, rate) + 0.15)
    return e / (e.max() + 1e-9)


def chatter_voice(r, dur, f0, excited=False):
    n = ns(dur)
    t = np.arange(n) / SR
    f = f0 * (1 + (0.12 if excited else 0.07) * smooth_noise(n, r, 1.6) + 0.03 * smooth_noise(n, r, 9))
    src = lp(_saw(phase(f)), 3600, 2)
    names = list(VOWELS)
    banks = [resbank(src, VOWELS[nm]) for nm in names]
    sel = (smooth_noise(n, r, 3.5) + 1) / 2 * (len(names) - 1)
    y = np.zeros(n)
    for i, b in enumerate(banks):
        y += b * np.clip(1 - np.abs(sel - i), 0, 1)
    y /= np.std(y) + 1e-9
    return y * _syllables(n, r, 5.5 if excited else 4.2)


def claps(r, dur, rate=18.0):
    n = ns(dur)
    y = np.zeros(n)
    tm = r.uniform(0, 0.05)
    while tm < dur - 0.03:
        k = ns(tm)
        L = min(ns(0.03), n - k)
        tl = np.arange(L) / SR
        c = bp(r.standard_normal(L), r.uniform(900, 1500), r.uniform(3500, 6000), 1) * np.exp(-tl / 0.007)
        y[k:k + L] += c * r.uniform(0.4, 1.0)
        tm += r.exponential(1 / rate)
    return y


# ======================================================================= foley
def alarm_clock(r, dur=1.75):
    """twin-bell wind-up alarm: hammer strikes alternate bells ~22 Hz + rattling body"""
    n = ns(dur)
    y = np.zeros(n)
    bells = [[(2480, 1.0, 0.25), (2480 * 2.32, 0.5, 0.12), (2480 * 4.1, 0.25, 0.06)],
             [(2710, 1.0, 0.25), (2710 * 2.29, 0.5, 0.12), (2710 * 3.9, 0.25, 0.06)]]
    strikes = [modal(0.3, b, r) for b in bells]
    tm, i = 0.0, 0
    while tm < dur - 0.3:
        k = ns(tm + r.normal(0, 0.0015))
        s = strikes[i % 2] * r.uniform(0.75, 1.0)
        y[k:k + len(s)] += s[: n - k]
        tm += 1 / 22.0
        i += 1
    rattle = bp(r.standard_normal(n), 600, 2400, 1) * 0.18 * (0.5 + 0.5 * np.sin(TAU * 22 * np.arange(n) / SR) ** 2)
    return fades(widen(y * 0.35 + rattle, r, 6, 0.4), 0.002, 0.12)


def phone_buzz(r, dur=0.62):
    """vibrate motor against a wooden nightstand: 170 Hz buzz + rattling harmonics"""
    n = ns(dur)
    t = np.arange(n) / SR
    f = 168 * (1 + 0.01 * np.sin(TAU * 3 * t))
    ph = phase(f)
    buzz = np.sign(np.sin(ph)) * 0.4 + np.sin(ph) * 0.6
    buzz = bp(buzz, 120, 2600, 2)
    wood = resbank(buzz, [(340, 5, 0.6), (820, 7, 0.4), (1650, 9, 0.25)])
    env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
    return fades((buzz * 0.6 + wood) * env, 0.003, 0.02)


def wind_gust(r, dur=2.8):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.4
    base = bp(colored(n, r, 1.0), 180, 2200, 2)
    whistle = reson(colored(n, r, 0.5), 820 + 260 * np.sin(np.pi * t / dur).mean(), 18) * 0.5
    rustle = hp(r.standard_normal(n), 2500) * 0.08 * np.maximum(0, smooth_noise(n, r, 9))
    return fades(widen((base + whistle + rustle) * env, r, 13, 0.9), 0.05, 0.2)


def foot_drag(r, dur=0.55):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8 * (0.7 + 0.3 * smooth_noise(n, r, 25))
    scrape = bp(colored(n, r, 0.6), 300, 3800, 2) * env
    grit = hp(r.standard_normal(n), 3000) * (r.random(n) < 0.004) * 2.0
    thump = np.exp(-t / 0.03) * np.sin(phase(85 * np.ones(n))) * 0.8
    return fades(scrape + grit * env + thump, 0.002, 0.05)


def whoosh(r, dur=0.42, f_lo=500, f_hi=2600):
    """air swish: noise through a band that sweeps up then down with the swing"""
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 2

    def g(T, F):
        fc = f_lo + (f_hi - f_lo) * np.sin(np.pi * np.clip(T / dur, 0, 1))
        return np.exp(-0.5 * (np.log(np.maximum(F[:, None], 20) / fc[None, :]) / 0.45) ** 2)

    y = shape(colored(n, r, 0.5), g, 512, 128)
    y /= np.std(y) + 1e-9
    return fades(widen(y * env, r, 9, 0.7), 0.005, 0.03)


def pan_grab(r):
    y = np.zeros((2, ns(0.95)))
    place(y, whoosh(r, 0.32, 600, 3000), 0)
    place(y, modal(0.6, [(415, 0.6, 0.18), (1090, 0.35, 0.1), (2210, 0.2, 0.05)], r) * 0.5, 0.26)
    return fades(y, 0.002, 0.05)


def pot_clang(r):
    """steel pot plonked onto a head: bright clang + muffled thunk"""
    dur = 1.3
    t = tt(dur)
    ring = modal(dur, [(612, 1.0, 0.45), (1468, 0.6, 0.3), (2390, 0.45, 0.2), (3530, 0.3, 0.12), (4870, 0.15, 0.08)], r)
    thunk = lp(r.standard_normal(len(t)), 500, 2) * np.exp(-t / 0.025) * 1.2
    return fades(ring * 0.7 + thunk, 0.0005, 0.12)


def couch_drag(r, dur=1.05):
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.12)
    judder = 0.55 + 0.45 * np.abs(np.sin(TAU * 14 * t + 2 * smooth_noise(n, r, 4)))
    scrape = bp(colored(n, r, 1.1), 90, 1400, 2) * judder
    groan_ = reson(colored(n, r, 0.8), 210, 9) * 0.6 * judder
    return fades(widen((scrape + groan_) * env, r, 8, 0.5), 0.01, 0.06)


def couch_thud(r):
    dur = 0.9
    t = tt(dur)
    sub = np.exp(-t / 0.09) * np.sin(phase(68 * (1 + 0.6 * np.exp(-t / 0.015)))) * 1.8
    door = modal(dur, [(182, 0.8, 0.12), (410, 0.6, 0.08), (930, 0.35, 0.05)], r)
    rattle = bp(r.standard_normal(len(t)), 1500, 5000, 1) * np.exp(-t / 0.05) * 0.25
    knob = modal(dur, [(3150, 0.25, 0.09), (5200, 0.12, 0.05)], r)
    return fades(sub + door + rattle + knob, 0.0005, 0.1)


def fridge_open(r):
    dur = 1.6
    n = ns(dur)
    t = np.arange(n) / SR
    pop = lp(r.standard_normal(n), 900, 2) * np.exp(-t / 0.012) * 1.1
    seal = bp(r.standard_normal(n), 1200, 5000, 1) * np.exp(-np.maximum(0, t - 0.01) / 0.06) * 0.35
    hum = (np.sin(TAU * 60 * t) + 0.5 * np.sin(TAU * 120 * t) + 0.2 * np.sin(TAU * 180 * t)) * 0.18 * np.minimum(1, t / 0.15)
    rattle = modal(dur, [(820, 0.25, 0.08), (1960, 0.15, 0.05)], r)
    return fades(pop + seal + hum + np.roll(rattle, ns(0.03)), 0.0005, 0.3)


def creak(r, dur=1.0, f_lo=28.0, f_hi=75.0, modes=((420, 9, 1.0), (910, 11, 0.6), (1720, 13, 0.35))):
    """stick-slip hinge creak: accelerating then easing impulse train through wood/metal resonances"""
    n = ns(dur)
    t = np.arange(n) / SR
    rate = f_lo + (f_hi - f_lo) * np.sin(np.pi * np.clip(t / dur, 0, 1)) + 6 * smooth_noise(n, r, 6)
    ph = np.cumsum(rate) / SR
    imp = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    imp[idx] = r.uniform(0.6, 1.0, len(idx))
    y = resbank(imp, list(modes))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6
    return fades(y * env, 0.005, 0.06)


def pan_bonk(r):
    """cartoon BONK: big low pan gong with pitch drop + skull thump + springy wobble"""
    dur = 1.5
    n = ns(dur)
    t = np.arange(n) / SR
    gong = modal(dur, [(330, 1.0, 0.5), (742, 0.55, 0.32), (1210, 0.45, 0.22), (1980, 0.25, 0.12)], r, glide=0.18, glide_tau=0.04)
    thump = np.exp(-t / 0.05) * np.sin(phase(110 * (1 + 0.8 * np.exp(-t / 0.01)))) * 1.6
    crack = bp(r.standard_normal(n), 1200, 7000, 1) * np.exp(-t / 0.006) * 0.9
    boing = np.sin(phase(190 * (1 + 0.35 * np.sin(TAU * 7 * t) * np.exp(-t / 0.35)))) * np.exp(-t / 0.3) * 0.35
    return fades(widen(gong * 0.8 + thump + crack + boing, r, 7, 0.5), 0.0003, 0.15)


def cartoon_tweet(r, dur=2.6):
    n = ns(dur)
    y = np.zeros(n)
    tm = 0.05
    while tm < dur - 0.12:
        L = ns(0.07)
        tl = np.arange(L) / SR
        f0 = r.uniform(2600, 3300)
        f = f0 * (1 + 0.45 * tl / 0.07)
        c = np.sin(phase(f)) * np.sin(np.pi * tl / 0.07) ** 2
        k = ns(tm)
        y[k:k + L] += c[: n - k] * r.uniform(0.6, 1.0)
        tm += 0.11 if r.random() < 0.75 else 0.32
    env = np.minimum(1, (dur - np.arange(n) / SR) / 0.6)
    return fades(y * env, 0.005, 0.1)


def crowd_groan(r, dur=3.2, voices=12, spread=1.0):
    out = np.zeros((2, ns(dur)))
    for i in range(voices):
        d = r.uniform(1.2, 2.4)
        g = groan(r, d, r.uniform(70, 140), (["uh", "aa", "oo"][i % 3], ["aa", "uh", "oo"][(i + 1) % 3]), rise=r.uniform(0.05, 0.2))
        place(out, pan(g * r.uniform(0.5, 1.0), r.uniform(-0.9, 0.9) * spread), r.uniform(0, dur - d))
    return fades(out, 0.08, 0.3)


def dumpster_slam(r):
    dur = 1.9
    n = ns(dur)
    t = np.arange(n) / SR
    body = modal(dur, [(88, 1.0, 0.35), (163, 0.8, 0.28), (241, 0.6, 0.22), (397, 0.45, 0.16), (611, 0.3, 0.1)], r)
    clang = modal(dur, [(1240, 0.4, 0.3), (2050, 0.3, 0.22), (3380, 0.2, 0.12)], r)
    sub = np.exp(-t / 0.12) * np.sin(phase(52 * (1 + 0.5 * np.exp(-t / 0.02)))) * 2.0
    crack = bp(r.standard_normal(n), 400, 6000, 1) * np.exp(-t / 0.012)
    return fades(widen(body + clang * 0.6 + sub + crack, r, 10, 0.7), 0.0003, 0.2)


def dumpster_creak(r):
    return creak(r, 1.0, 18, 46, ((210, 8, 1.0), (520, 10, 0.7), (1130, 12, 0.4), (2400, 14, 0.2)))


def trash_squelch(r, dur=0.9):
    n = ns(dur)
    out = np.zeros(n)
    for _ in range(5):
        L = ns(r.uniform(0.08, 0.2))
        tl = np.arange(L) / SR
        f = r.uniform(220, 420) * (1 + 1.5 * tl / tl[-1])
        sq = reson(lp(r.standard_normal(L), 1500, 2), 600, 3) * 0.6 + np.sin(phase(f)) * 0.4
        sq *= np.sin(np.pi * tl / tl[-1]) ** 1.5
        k = ns(r.uniform(0, dur - 0.2))
        out[k:k + L] += sq[: n - k] * r.uniform(0.6, 1.0)
    for _ in range(18):  # little bubbly pops
        L = ns(0.03)
        tl = np.arange(L) / SR
        k = ns(r.uniform(0, dur - 0.04))
        out[k:k + L] += np.exp(-tl / 0.008) * np.sin(phase(r.uniform(500, 1300) * (1 + 6 * tl))) * 0.3
    return fades(widen(out, r, 6, 0.5), 0.005, 0.06)


def crowd_turn(r, dur=1.4):
    out = np.zeros((2, ns(dur)))
    n = ns(dur)
    t = np.arange(n) / SR
    rust = bp(colored(n, r, 0.6), 800, 6000, 2) * np.exp(-np.abs(t - 0.25) / 0.25) * 0.5
    out += widen(rust, r, 11, 0.9)
    for i in range(10):
        g = groan(r, 0.9, r.uniform(85, 150), ("uh", "aa"), rise=0.3)
        place(out, pan(g * 0.6, r.uniform(-0.9, 0.9)), 0.15 + r.uniform(0, 0.2))
    return fades(out, 0.01, 0.2)


def record_scratch(r):
    """vinyl scratch: a rich source read back at a fast back-and-forth speed curve"""
    dur = 0.55
    n = ns(dur)
    t = np.arange(n) / SR
    src_n = ns(2.0)
    rr = rng(77)
    src = bp(colored(src_n, rr, 0.5), 200, 6000, 2) * 0.5
    tsrc = np.arange(src_n) / SR
    for m in (50, 57, 62, 65):
        src += 0.25 * _saw(TAU * I.m2f(m) * tsrc)
    speed = np.where(t < 0.12, 2.6 * np.sin(np.pi * t / 0.12), np.where(t < 0.3, -2.2 * np.sin(np.pi * (t - 0.12) / 0.18), 1.8 * np.exp(-(t - 0.3) / 0.08) * np.sin(np.pi * np.clip((t - 0.3) / 0.25, 0, 1))))
    pos = 0.6 * SR + np.cumsum(speed)
    y = np.interp(pos, np.arange(src_n), src)
    y *= np.clip(np.abs(speed) / 1.2, 0, 1) ** 0.7
    y += bp(rr.standard_normal(n), 1500, 7000, 1) * np.abs(np.gradient(speed)) * 120 * 0.02
    return fades(lp(y, 7000, 2), 0.002, 0.04)


def phone_rings(r):
    out = np.zeros((2, ns(2.2)))
    for i, (tm, p) in enumerate([(0.0, -0.4), (0.25, 0.35), (1.1, -0.1)]):
        ring = G.phone_ring(r)
        place(out, pan(ring * (1.0 if i == 0 else 0.75), p), tm)
    return out


def mic_feedback(r):
    dur = 0.95
    n = ns(dur)
    t = np.arange(n) / SR
    tap = lp(r.standard_normal(n), 600, 2) * np.exp(-t / 0.02) * 0.9
    tap += np.roll(tap, ns(0.18)) * 0.8
    sw = np.clip((t - 0.35) / 0.45, 0, 1) ** 2 * (t < 0.82)
    squeal = (np.sin(phase(2950 * (1 + 0.004 * np.sin(TAU * 6 * t)))) + 0.3 * np.sin(phase(5900 * np.ones(n)))) * sw * 0.45
    return fades(tap + squeal, 0.001, 0.06)


def crowd_cheer(r, dur=2.8, voices=14):
    out = np.zeros((2, ns(dur)))
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.18) * np.minimum(1, (dur - t) / 0.9)
    for i in range(voices):
        v = chatter_voice(r, dur, r.uniform(190, 360), excited=True)
        place(out, pan(v * env * r.uniform(0.4, 0.9), r.uniform(-0.9, 0.9)), 0)
    out += widen(claps(r, dur, 26.0) * env * 1.4, r, 9, 0.9)
    for _ in range(2):  # whistles
        L = ns(0.6)
        tl = np.arange(L) / SR
        w = np.sin(phase(2200 + 900 * np.sin(np.pi * tl / 0.6))) * np.sin(np.pi * tl / 0.6) * 0.25
        place(out, pan(w, r.uniform(-0.6, 0.6)), r.uniform(0.2, 1.2))
    return fades(out, 0.02, 0.3)


def confetti_pop(r):
    dur = 1.8
    out = np.zeros((2, ns(dur)))
    for tm, p in [(0.0, -0.5), (0.06, 0.5)]:
        L = ns(0.4)
        tl = np.arange(L) / SR
        pop = np.exp(-tl / 0.04) * np.sin(phase(75 * (1 + np.exp(-tl / 0.01)))) * 1.4 + bp(r.standard_normal(L), 500, 5000, 1) * np.exp(-tl / 0.03)
        place(out, pan(pop, p), tm)
    place(out, G.money_rain(r, 1.5) * 0.5, 0.15)
    return fades(out, 0.0005, 0.2)


def trophy_ding(r):
    y = modal(1.8, [(2093, 1.0, 0.6), (2093 * 2.76, 0.4, 0.3), (2093 * 5.4, 0.2, 0.12), (4186, 0.3, 0.4)], r)
    sh = I.triangle(0.5, r, 1.4, f=3520.0)
    n = max(len(y), len(sh))
    return fades(np.pad(y, (0, n - len(y))) + 0.4 * np.pad(sh, (0, n - len(sh))), 0.001, 0.2)


# ======================================================================= ambience beds
def amb_bedroom(dur, r, siren=True):
    n = ns(dur)
    t = np.arange(n) / SR
    tone = lp(colored(n, r, 1.6), 220, 2) * 0.35
    out = st(tone) + widen(bp(colored(n, r, 0.8), 300, 2500, 1) * 0.06, r, 11, 0.6)
    if siren:
        f = 760 + 230 * np.sin(TAU * 0.21 * t + 1.0)
        s = (np.sin(phase(f)) + 0.3 * np.sin(2 * phase(f))) * 0.22
        s = lp(s, 1500, 2) * (0.6 + 0.4 * smooth_noise(n, r, 0.2))
        out += widen(s, r, 23, 0.9)
    return fades(out, 0.03, 0.03)


def amb_street(dur, r, groans=True):
    n = ns(dur)
    t = np.arange(n) / SR
    gust = 0.55 + 0.45 * smooth_noise(n, r, 0.35)
    wind = bp(colored(n, r, 1.1), 150, 1800, 2) * gust * 0.5
    out = widen(wind, r, 14, 0.9)
    out += st(lp(colored(n, r, 1.8), 120, 2) * 0.25)
    if groans and dur > 1.5:
        k = 0.3
        while k < dur - 1.2:
            g = groan(r, r.uniform(1.0, 1.6), r.uniform(70, 110), ("uh", "oo"))
            g = lp(g, 1200, 2) * 0.22
            place(out, pan(g, r.uniform(-0.9, 0.9)), k)
            k += r.uniform(1.6, 3.2)
    return fades(out, 0.03, 0.03)


def amb_horde(dur, r):
    n = ns(dur)
    out = amb_street(dur, r, groans=False) * 0.6
    k = 0.0
    while k < dur - 0.6:
        d = min(r.uniform(1.0, 2.2), dur - k)
        g = groan(r, d, r.uniform(68, 135), (["uh", "aa", "oo"][int(r.integers(3))], ["uh", "aa", "oo"][int(r.integers(3))]))
        place(out, pan(g * r.uniform(0.35, 0.7), r.uniform(-0.95, 0.95)), k)
        k += r.uniform(0.15, 0.4)
    out += widen(bp(colored(n, r, 0.7), 300, 2400, 2) * 0.12, r, 9, 0.9)  # shuffling
    return fades(out, 0.03, 0.03)


def amb_party(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for i in range(10):
        v = chatter_voice(r, dur, r.uniform(110, 260))
        out += pan(v * r.uniform(0.25, 0.5), r.uniform(-0.95, 0.95))
    out += widen(bp(colored(n, r, 0.9), 200, 3000, 2) * 0.18, r, 12, 0.9)
    k = 0.4
    while k < dur - 0.3:  # sparse birds + a laugh-y chirp
        place(out, pan(cartoon_tweet(r, 0.35) * 0.18, r.uniform(-0.8, 0.8)), k)
        k += r.uniform(1.8, 3.5)
    return fades(out, 0.03, 0.03)


# ======================================================================= builders called by mix.py
DISPATCH = {
    "alarm_clock":    (alarm_clock, -8.0),
    "phone_buzz":     (phone_buzz, -11.0),
    "wind_gust":      (wind_gust, -13.0),
    "zombie_groan":   (lambda r: groan(r, 1.7, 88.0), -7.5),
    "foot_drag":      (foot_drag, -12.0),
    "pan_grab":       (pan_grab, -11.0),
    "pot_clang":      (pot_clang, -7.5),
    "couch_drag":     (couch_drag, -10.5),
    "couch_thud":     (couch_thud, -6.5),
    "fridge_open":    (fridge_open, -11.0),
    "gate_creak":     (lambda r: creak(r, 1.1), -11.0),
    "whoosh":         (whoosh, -11.5),
    "pan_bonk":       (pan_bonk, -4.0),
    "cartoon_tweet":  (cartoon_tweet, -14.0),
    "crowd_groan":    (crowd_groan, -10.0),
    "dumpster_slam":  (dumpster_slam, -5.0),
    "dumpster_creak": (dumpster_creak, -10.0),
    "trash_squelch":  (trash_squelch, -10.5),
    "crowd_turn":     (crowd_turn, -9.0),
    "record_scratch": (record_scratch, -6.0),
    "phone_ring":     (phone_rings, -13.0),
    "mic_feedback":   (mic_feedback, -14.0),
    "crowd_cheer":    (crowd_cheer, -9.0),
    "confetti_pop":   (confetti_pop, -9.0),
    "trophy_ding":    (trophy_ding, -12.0),
}

AMB = {  # (set, light) -> (generator, level re voice)
    ("bedroom", "interior"): (lambda d, r: amb_bedroom(d, r), -30.0),
    ("street", "rain"):      (lambda d, r: amb_street(d, r), -24.0),
    ("square", "rain"):      (lambda d, r: amb_horde(d, r), -21.0),
    ("square", "day"):       (lambda d, r: amb_party(d, r), -22.0),
}


def build_sfx(tl, N, v_ref):
    r = rng(1313)
    fps = tl["fps"]
    out = np.zeros((2, N))
    send = np.zeros(N)

    # contiguous ambience beds per (set, light) run; 30 ms butt-joins land exactly on the picture cuts
    runs = []
    for s in tl["shots"]:
        key = (s["set"], s["light"])
        if runs and runs[-1][0] == key and runs[-1][2] == s["a"]:
            runs[-1][2] = s["b"]
        else:
            runs.append([key, s["a"], s["b"]])
    for key, a, b in runs:
        if key not in AMB:
            continue
        gen, rel = AMB[key]
        bed = gen((b - a) / fps + 0.03, r)
        cur = integrated(bed)
        if np.isfinite(cur):
            bed *= dbg((v_ref + rel) - cur)
        place(out, bed, a / fps)

    for ev in tl["events"]:
        tp = ev["type"]
        if tp not in DISPATCH:
            continue
        fn, rel_db = DISPATCH[tp]
        sig = fn(r) * float(ev.get("gain", 1.0))
        sig = pan(sig, float(ev.get("pan", 0.0))) if sig.ndim == 1 else sig
        cur = integrated(sig)
        if np.isfinite(cur):
            sig *= dbg((v_ref + rel_db + 20 * np.log10(max(float(ev.get("gain", 1.0)), 1e-3))) - cur)
        place(out, sig, float(ev["time_s"]))
        i0 = ns(float(ev["time_s"]))
        m = min(sig.shape[1], N - i0)
        if m > 0:
            send[i0:i0 + m] += 0.15 * sig[:, :m].mean(0)

    ir = make_ir(1.1, 43, pre=0.012, hf=1.4)
    out += 0.4 * convolve_st(send, ir)
    return hp(out, 28, 2)


def build_score(tl, N):
    r = rng(4242)
    out = np.zeros((2, N))
    fps = tl["fps"]
    dur_s = tl["duration_s"]
    ev = {e["type"]: e["time_s"] for e in tl["events"]}
    stop_t = ev.get("music_stop", 48.0)
    crowd_t = next((e["time_s"] for e in tl["events"] if e["type"] == "crowd_groan"), 32.8)
    fan_t = [e["time_s"] for e in tl["events"] if e["type"] == "crowd_cheer"][-1] - 0.13  # "best zombie" downbeat
    riser_t = 1370 / fps

    # ---------------- Part A: sneaky D-minor pizzicato creep (96 BPM) ----------------
    beat = 60 / 96
    e8 = beat / 2
    pat = [50, 57, 53, 57, 50, 58, 53, 61]  # D A F A D Bb F C#
    tA = 0.35
    k = 0
    while tA < stop_t - 0.02:
        m = pat[k % 8] + (12 if tA > crowd_t and (k // 16) % 2 else 0)
        acc = 1.0 if k % 8 == 0 else 0.7
        place(out, pan(I.pluck(I.m2f(m), 0.55 * acc, r, dur=0.3, bright=0.35), -0.25 + 0.5 * (k % 2)), tA)
        if k % 8 == 0:
            place(out, pan(I.pluck(I.m2f(38), 0.9, r, dur=0.9, bright=0.25), -0.05), tA)
        if k % 2 == 1:  # clock-like tick
            place(out, pan(I.brush(0.22, r, dur=0.08), 0.35), tA)
        if tA > crowd_t:
            if k % 4 == 2:
                place(out, pan(I.snare(0.32 + 0.25 * min(1, (tA - crowd_t) / 12), r, dur=0.25, snappy=0.7), 0.1), tA)
            if k % 16 == 0:
                place(out, I.timpani(I.m2f(38), 0.75, r, dur=1.6), tA)
        tA += e8
        k += 1
    # drone pad underneath (tremolo), swelling into the horde section
    drone = I.pad([I.m2f(38), I.m2f(45), I.m2f(50)], stop_t - 0.4, 0.32, r, att=1.5, rel=0.05, warm=600,
                  trem=lambda t: 0.75 + 0.25 * np.sin(TAU * 4.5 * t))
    drone *= np.clip(0.55 + 0.45 * (np.arange(drone.shape[1]) / SR - crowd_t + 0.35) / 10, 0.55, 1.0)[None, :]
    place(out, drone, 0.35)
    # riser: buzz roll + rising cluster into the scratch
    for tm, v in I.snare_roll(riser_t, stop_t - 0.02, 0.15, 0.85, r, rate=26.0):
        place(out, pan(I.snare(v, r, dur=0.12, snappy=0.9, buzz=True), 0.05), tm)
    rd = stop_t - riser_t
    n = ns(rd)
    tr = np.arange(n) / SR
    rise = np.sin(phase(I.m2f(62) * 2 ** (tr / rd * 7 / 12))) + 0.6 * np.sin(phase(I.m2f(63) * 2 ** (tr / rd * 7 / 12)))
    rise = rise * (tr / rd) ** 2 * 0.25 + bp(colored(n, r, 0.6), 800, 6000, 2) * (tr / rd) ** 3 * 0.25
    place(out, widen(rise, r, 9, 0.8), riser_t)
    out[:, ns(stop_t):] = 0.0

    # ---------------- Part B: bouncy D-major groove (120 BPM) -> fanfare ----------------
    b = 0.5
    tB0 = stop_t + 0.9
    chords = [(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])]  # D Bm G A
    mel = [74, 78, 81, 78, 76, 74, 76, 78, 79, 78, 76, 74, 73, 74, 76, 69]
    tm = tB0
    i = 0
    while tm < fan_t - 0.05:
        bar, bt = divmod(i, 4)
        root, tri = chords[bar % 4]
        place(out, pan(I.pluck(I.m2f(root - 12 if bt % 2 == 0 else root - 5), 0.85, r, dur=0.45, bright=0.55), -0.1), tm)
        if bt in (1, 3):
            place(out, pan(I.snare(0.4, r, dur=0.2, snappy=0.85), 0.12), tm)
            for nn in tri:
                place(out, pan(I.vibes(I.m2f(nn), 0.22, r, dur=0.45), 0.3), tm)
        place(out, pan(I.brush(0.3, r, dur=0.15), -0.3), tm + b / 2)
        if tm > tB0 + 4 * b:  # glockenspiel tune after the first bar
            place(out, pan(I.glock(I.m2f(mel[i % 16]), 0.45, r, dur=0.9), 0.2), tm)
            if i % 2 == 0:
                place(out, pan(I.glock(I.m2f(mel[(i + 1) % 16]), 0.3, r, dur=0.6), 0.2), tm + b / 2)
        tm += b
        i += 1
    # fanfare: brass D-major stab + cymbal + timpani, then a held warm chord to the end. Built on its own bus and
    # levelled ~3 dB over the groove so the limiter never has to crush the payoff.
    fan = np.zeros((2, N))
    for nn, p in [(50, -0.3), (57, 0.0), (62, 0.2), (66, 0.35), (69, -0.15)]:
        place(fan, pan(I.brass(I.m2f(nn), 1.3, 0.85, r, kind="horn"), p), fan_t)
    place(fan, widen(I.cymbal(0.8, r, dur=2.4), r, 11, 0.8) * 0.6, fan_t)
    place(fan, I.timpani(I.m2f(38), 0.95, r, dur=2.2), fan_t)
    for j, nn in enumerate([74, 78, 81, 86]):
        place(fan, pan(I.glock(I.m2f(nn), 0.5, r, dur=1.4), 0.2), fan_t + 0.08 * j)
    if dur_s > fan_t + 0.6:
        place(fan, I.pad([I.m2f(50), I.m2f(57), I.m2f(62), I.m2f(66)], dur_s - fan_t - 0.6, 0.5, r, att=0.3, rel=0.25), fan_t + 0.3)
    g0, g1 = ns(tB0), ns(fan_t)
    groove_rms = np.sqrt(np.mean(out[:, g0:g1] ** 2)) if g1 > g0 else 0.1
    fan_rms = np.sqrt(np.mean(fan[:, g1:g1 + ns(1.0)] ** 2)) + 1e-12
    out += fan * (groove_rms * dbg(3.0) / fan_rms)

    return hp(out, 32, 2)
