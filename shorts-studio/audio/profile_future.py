# "What If You Woke Up 10 Years in the Future?" audio profile for audio/mix.py (timeline.json "profile": "future").
# Procedural foley (eye pop, nurse-bot servos + beeps, hover-car doppler passes, pizza drone, keyboard/mouse, slot-machine
# jackpot, IV tape rip, bare-foot sprint, taxi horn, ATM, cash bricks, heavenly choir, register ching, robot error buzz,
# coffee slurp, sad trombone), per-set ambience beds (hospital room tone + heart monitor, 2026 night room, 2036 city
# hum with distant hover traffic, golden-hour chatter) and a three-part score:
#   A) bouncy C-major "future" synth-pluck groove (112 BPM) with a lo-fi music-box flashback inside it,
#   B) the groove kicks up a gear for the sprint and cuts dead on `music_stop` (the $4,000,000 price reveal),
#   C) after the robot's flat stare, a mellow lounge (vibes + walking bass) under the pivot, left hanging for the
#      sad-trombone button.
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, dbg, lp, hp, bp, resbank, colored, smooth_noise, fades, phase, modal,
                 pan, st, place, widen, make_ir, convolve_st, integrated)
import instruments as I
import sfx_gen as G
import profile_zombie as Z


def _env(n, a=0.005, r=0.05):
    t = np.arange(n) / SR
    d = n / SR
    return np.clip(np.minimum(t / max(a, 1e-4), (d - t) / max(r, 1e-4)), 0, 1)


def _square(ph, k=9):
    y = np.zeros_like(ph)
    for h in range(1, k + 1, 2):
        y += np.sin(h * ph) / h
    return y


# ======================================================================= foley
def eye_pop(r):
    dur = 0.22
    t = tt(dur)
    f = 300 + 1500 * (t / dur) ** 0.6
    y = np.sin(phase(f)) * np.exp(-t / 0.07) * 0.8
    y += hp(r.standard_normal(len(t)), 2500) * np.exp(-t / 0.003) * 0.5
    return fades(y, 0.0005, 0.03)


def beard_rustle(r, dur=0.9):
    n = ns(dur)
    y = bp(colored(n, r, 0.3), 1800, 8000, 2) * Z._syllables(n, r, 7.0) * _env(n, 0.05, 0.25)
    return fades(widen(y, r, 7, 0.6), 0.01, 0.1)


def robot_hover(r, dur=1.3):
    n = ns(dur)
    t = np.arange(n) / SR
    f = 170 + 90 * np.sin(np.pi * np.clip(t / dur, 0, 1)) + 6 * smooth_noise(n, r, 5)
    whir = lp(Z._saw(phase(f)), 1400, 2) * 0.4 + 0.25 * np.sin(phase(f * 2.01))
    hum = bp(colored(n, r, 0.5), 400, 3000, 2) * 0.18
    return fades(widen((whir + hum) * _env(n, 0.15, 0.4), r, 9, 0.5), 0.01, 0.1)


def robot_beep(r):
    out = np.zeros(ns(0.32))
    for tm, f in [(0.0, 1320), (0.12, 1760)]:
        t = tt(0.09)
        b = np.sin(TAU * f * t) * _env(len(t), 0.004, 0.02) * 0.6
        k = ns(tm)
        out[k:k + len(b)] += b[:len(out) - k]
    return out


def dramatic_sting(r):
    dur = 2.4
    out = np.zeros((2, ns(dur + 0.4)))
    for tm, m, d in [(0.0, 52, 0.22), (0.28, 53, 0.22), (0.62, 49, 1.5)]:
        for o, p in [(0, -0.2), (-12, 0.2), (7, 0.0)]:
            place(out, pan(I.brass(I.m2f(m + o), d, 0.9, r, kind="horn"), p), tm)
    place(out, st(I.timpani(I.m2f(37), 0.9, r, dur=1.8)), 0.62)
    return fades(out, 0.002, 0.3)


def hover_pass(r, dur=1.7):
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    dop = 1 + 0.12 * np.tanh((0.5 - u) * 6)
    f = 240 * dop
    tone = (np.sin(phase(f)) + 0.4 * np.sin(phase(f * 2.02)) + 0.2 * Z._saw(phase(f * 0.5))) * 0.4
    air = np.zeros(n)
    nz = colored(n, r, 0.4)
    for lo, hi, g in [(600, 2400, 0.5), (2400, 7000, 0.3)]:
        air += bp(nz, lo * dop.mean(), hi, 2) * g
    env = np.exp(-((u - 0.5) / 0.2) ** 2)
    y = (tone + air) * env
    p = np.clip((u - 0.5) * 2.2, -1, 1)
    th = (p + 1) * np.pi / 4
    return fades(np.stack([y * np.cos(th), y * np.sin(th)]), 0.01, 0.1)


def drone_buzz(r, dur=2.0):
    n = ns(dur)
    t = np.arange(n) / SR
    f = 155 * (1 + 0.04 * smooth_noise(n, r, 3))
    y = lp(Z._saw(phase(f)), 2500, 2) * (0.7 + 0.3 * np.sin(TAU * 31 * t))
    y += 0.4 * lp(Z._saw(phase(f * 1.49)), 2500, 2)
    env = np.clip(t / dur, 0, 1) ** 1.6 * np.minimum(1, (dur - t) / 0.25)
    return fades(widen(y * env * 0.5, r, 6, 0.5), 0.01, 0.05)


def flashback_swell(r, dur=1.3):
    n = ns(dur)
    t = np.arange(n) / SR
    cym = I.cymbal(0.7, r, dur=dur)[: n][::-1]
    cym = np.pad(cym, (0, max(0, n - len(cym))))[:n]
    shimmer = sum(np.sin(phase(I.m2f(m) * (1 + 0.003 * np.sin(TAU * 5 * t)))) for m in (72, 76, 79, 84)) * 0.12
    env = (t / dur) ** 2
    return fades(widen(cym * 0.8 + shimmer * env, r, 13, 0.9), 0.02, 0.03)


def _click(r, f0=3200, dec=0.004, n=None):
    n = n or ns(0.03)
    t = np.arange(n) / SR
    return bp(r.standard_normal(n), f0 * 0.5, min(f0 * 2, 12000), 2) * np.exp(-t / dec) + np.sin(TAU * 180 * t) * np.exp(-t / 0.006) * 0.4


def keyboard_typing(r, dur=1.7):
    out = np.zeros(ns(dur))
    tm = 0.02
    while tm < dur - 0.05:
        c = _click(r, r.uniform(2200, 4200)) * r.uniform(0.4, 1.0)
        k = ns(tm)
        out[k:k + len(c)] += c[:len(out) - k]
        tm += r.exponential(0.085) + 0.03
    return fades(out, 0.002, 0.05)


def mouse_click(r):
    out = np.zeros(ns(0.15))
    for tm in (0.0, 0.07):
        c = _click(r, 5200, 0.002)
        k = ns(tm)
        out[k:k + len(c)] += c
    return out


def coin_ding(r):
    out = np.zeros(ns(0.8))
    for tm, f, d in [(0.0, 988, 0.08), (0.08, 1319, 0.6)]:
        t = tt(d)
        b = _square(TAU * f * t, 7) * np.exp(-t / (0.25 if d > 0.1 else 0.05)) * 0.35
        k = ns(tm)
        out[k:k + len(b)] += b[:len(out) - k]
    return fades(out, 0.001, 0.05)


def app_chime(r):
    out = np.zeros(ns(1.2))
    for i, m in enumerate((72, 76, 79, 84)):
        g = I.glock(I.m2f(m), 0.5, r, dur=0.9)
        k = ns(0.06 * i)
        L = min(len(g), len(out) - k)
        out[k:k + L] += g[:L]
    return out


def slot_riser(r, dur=3.0):
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = 330 * 2 ** (u * 2)
    y = (np.sin(phase(f)) + 0.5 * np.sin(phase(f * 1.5))) * (0.6 + 0.4 * np.sin(TAU * (6 + 14 * u) * t))
    return fades(widen(y * u ** 1.5 * 0.35, r, 9, 0.6), 0.01, 0.02)


def jackpot(r, dur=2.4):
    out = np.zeros((2, ns(dur)))
    tm, i = 0.0, 0
    seq = [84, 88, 91, 96]
    while tm < 1.3:  # slot-machine bell gallop
        place(out, pan(I.glock(I.m2f(seq[i % 4]), 0.55, r, dur=0.4), 0.3 * np.sin(i)), tm)
        tm += 0.055
        i += 1
    place(out, st(G.cash_register(r)) * 0.9, 0.0)
    for _ in range(26):  # coins spilling
        c = modal(0.25, [(r.uniform(3800, 6500), 1.0, 0.06), (r.uniform(7000, 9500), 0.5, 0.03)], r) * r.uniform(0.2, 0.6)
        place(out, pan(c, r.uniform(-0.8, 0.8)), r.uniform(0.1, 1.9))
    return fades(out, 0.001, 0.3)


def iv_rip(r):
    dur = 0.5
    n = ns(dur)
    t = np.arange(n) / SR
    rate = 90 + 500 * np.clip(t / 0.18, 0, 1)
    times = np.cumsum(1 / rate) * 1.0
    y = np.zeros(n)
    for tm in times[times < 0.22]:
        c = _click(r, r.uniform(1500, 4000), 0.002)
        k = ns(tm)
        y[k:k + len(c)] += c[:n - k] * 0.6
    pop = np.sin(phase(400 * (1 + 2 * np.exp(-(t - 0.24).clip(0) / 0.01)))) * np.exp(-(t - 0.24).clip(0) / 0.03) * (t > 0.24)
    return fades(y + pop * 0.8, 0.001, 0.05)


def run_steps(r, dur=2.3, rate=5.0):
    out = np.zeros(ns(dur))
    tm = 0.0
    while tm < dur - 0.1:
        L = ns(0.07)
        tl = np.arange(L) / SR
        s = lp(r.standard_normal(L), 900, 2) * np.exp(-tl / 0.012) * 1.2 + bp(r.standard_normal(L), 1500, 6000, 1) * np.exp(-tl / 0.006) * 0.5
        k = ns(tm)
        out[k:k + L] += s[:len(out) - k] * r.uniform(0.7, 1.0)
        tm += 1 / rate + r.uniform(-0.01, 0.01)
    return fades(out, 0.002, 0.05)


def car_horn(r):
    dur = 0.7
    t = tt(dur)
    y = np.zeros_like(t)
    for f in (466.0, 587.0):
        fs = f * (1 + 0.06 * np.exp(-t / 0.05))
        y += _square(phase(fs), 9) * 0.3
    y = lp(y, 3000, 2) * _env(len(t), 0.01, 0.08)
    return fades(y, 0.003, 0.05)


def screen_tap(r):
    t = tt(0.25)
    thud = lp(r.standard_normal(len(t)), 400, 2) * np.exp(-t / 0.02) * 1.2
    blip = np.sin(TAU * 1500 * t) * np.exp(-t / 0.05) * (t > 0.03) * 0.4
    return fades(thud + blip, 0.0005, 0.03)


def atm_confirm(r):
    out = np.zeros(ns(1.4))
    for i, f in enumerate((880, 1109, 1319, 1760)):
        b = np.sin(TAU * f * tt(0.07)) * 0.45
        k = ns(i * 0.07)
        out[k:k + len(b)] += b
    reg = G.cash_register(r)
    k = ns(0.3)
    L = min(len(reg), len(out) - k)
    out[k:k + L] += reg[:L] * 0.8
    return out


def cash_pour(r, dur=1.7):
    out = np.zeros((2, ns(dur)))
    tm = 0.0
    while tm < 1.3:
        L = ns(0.12)
        tl = np.arange(L) / SR
        thud = lp(r.standard_normal(L), 700, 2) * np.exp(-tl / 0.02) + bp(r.standard_normal(L), 2000, 7000, 1) * np.exp(-tl / 0.01) * 0.4
        place(out, pan(thud * r.uniform(0.5, 1.0), r.uniform(-0.4, 0.4)), tm)
        tm += 0.05 + r.uniform(-0.01, 0.015)
    place(out, G.money_rain(r, 1.5) * 0.6, 0.05)
    return fades(out, 0.001, 0.2)


def choir_ahh(r, dur=2.4):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for m in (60, 64, 67, 72, 76):
        for v in range(2):
            f = I.m2f(m) * (1 + 0.004 * v) * (1 + 0.006 * np.sin(TAU * 5.2 * t + v))
            src = lp(Z._saw(phase(f)), 4000, 2)
            y = resbank(src, Z.VOWELS["aa"])
            y /= np.std(y) + 1e-9
            place(out, pan(y * 0.12, r.uniform(-0.7, 0.7)), 0)
    env = np.clip(t / 0.5, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    return fades(out * env[None, :], 0.02, 0.2)


def door_chime(r):
    out = np.zeros(ns(1.6))
    for tm, m in [(0.0, 79), (0.32, 76)]:
        g = I.glock(I.m2f(m), 0.6, r, dur=1.2)
        k = ns(tm)
        L = min(len(g), len(out) - k)
        out[k:k + L] += g[:L]
    return out


def cup_place(r):
    return fades(modal(0.3, [(2400, 1.0, 0.04), (4100, 0.5, 0.02)], r) * 0.6 + lp(r.standard_normal(ns(0.3)), 500) * np.exp(-tt(0.3) / 0.01) * 0.6, 0.0005, 0.05)


def error_buzz(r):
    out = np.zeros(ns(0.75))
    for tm, d in [(0.0, 0.18), (0.26, 0.42)]:
        t = tt(d)
        b = lp(_square(phase(110 * np.ones(len(t))), 15), 2500, 2) * _env(len(t), 0.005, 0.03) * 0.5
        k = ns(tm)
        out[k:k + len(b)] += b[:len(out) - k]
    return out


def sip(r, dur=1.1):
    n = ns(dur)
    t = np.arange(n) / SR
    fc = 900 + 1400 * np.clip(t / dur, 0, 1)
    y = np.zeros(n)
    nz = colored(n, r, 0.2)
    for lo in (0.5, 1.0):
        y += bp(nz, 500 * lo + 400, 4000, 2)
    gurgle = np.sin(phase(fc * 0.25 * (1 + 0.3 * np.sign(np.sin(TAU * 17 * t))))) * 0.25
    env = Z._syllables(n, r, 9.0) * 0.6 + 0.4
    y = (y * 0.4 + gurgle) * env * _env(n, 0.05, 0.2)
    gulp = np.sin(phase(220 * (1 - 0.4 * np.clip((t - dur + 0.18) / 0.15, 0, 1)))) * np.exp(-np.clip(t - dur + 0.18, 0, None) / 0.05) * (t > dur - 0.18)
    return fades(y + gulp * 0.6, 0.01, 0.05)


def sad_trombone(r):
    dur = 3.4
    out = np.zeros((2, ns(dur)))
    for tm, m, d, fall in [(0.0, 55, 0.42, 0), (0.5, 54, 0.42, 0), (1.0, 53, 0.42, 0), (1.5, 52, 1.5, -0.5)]:
        y = I.brass(I.m2f(m), d, 0.85, r, kind="tuba", scoop=-60.0, fall=fall)
        if d > 1:  # waaaah vibrato
            tl = np.arange(len(y)) / SR
            y = y * (1 + 0.35 * np.sin(TAU * 5.5 * tl) * np.clip((tl - 0.3) / 0.4, 0, 1))
        place(out, pan(lp(y, 2600, 2), 0.05), tm)
    return fades(out, 0.003, 0.25)


# ======================================================================= ambience beds
def amb_hospital(dur, r):
    n = ns(dur)
    out = st(lp(colored(n, r, 1.6), 240, 2) * 0.3) + widen(bp(colored(n, r, 0.9), 300, 2500, 1) * 0.04, r, 11, 0.6)
    tm = 0.25
    while tm < dur - 0.2:  # heart monitor
        b = np.sin(TAU * 1046 * tt(0.11)) * _env(ns(0.11), 0.004, 0.03) * 0.22
        place(out, pan(b, -0.35), tm)
        tm += 0.83
    return fades(out, 0.03, 0.03)


def amb_night_room(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    hum = (np.sin(TAU * 60 * t) + 0.4 * np.sin(TAU * 120 * t)) * 0.05
    out = st(lp(colored(n, r, 1.8), 180, 2) * 0.35 + hum) + widen(bp(colored(n, r, 1.0), 200, 1200, 2) * 0.08, r, 17, 0.9)
    return fades(out, 0.03, 0.03)


def amb_city(dur, r, golden=False):
    n = ns(dur)
    out = widen(lp(colored(n, r, 1.2), 900, 2) * 0.4, r, 15, 0.9)
    t = np.arange(n) / SR
    out += st(np.sin(TAU * 82 * t) * 0.03 * (0.7 + 0.3 * smooth_noise(n, r, 0.3)))  # city hover-grid hum
    for i in range(6 if golden else 4):
        v = Z.chatter_voice(r, dur, r.uniform(120, 260))
        out += pan(v * r.uniform(0.06, 0.12), r.uniform(-0.9, 0.9))
    k = 0.6
    while k < dur - 1.0:  # distant hover traffic
        place(out, hover_pass(r, r.uniform(1.4, 2.2)) * 0.25, k)
        k += r.uniform(1.5, 3.0)
    return fades(out, 0.03, 0.03)


# ======================================================================= builders called by mix.py
DISPATCH = {
    "eye_pop":         (eye_pop, -12.0),
    "whoosh":          (Z.whoosh, -12.0),
    "beard_rustle":    (beard_rustle, -15.0),
    "robot_hover":     (robot_hover, -13.0),
    "robot_beep":      (robot_beep, -14.0),
    "dramatic_sting":  (dramatic_sting, -7.0),
    "hover_pass":      (hover_pass, -11.0),
    "drone_buzz":      (drone_buzz, -12.0),
    "flashback_swell": (flashback_swell, -11.0),
    "keyboard_typing": (keyboard_typing, -16.0),
    "mouse_click":     (mouse_click, -13.0),
    "coin_ding":       (coin_ding, -12.0),
    "app_chime":       (app_chime, -13.0),
    "slot_riser":      (slot_riser, -15.0),
    "jackpot":         (jackpot, -7.0),
    "iv_rip":          (iv_rip, -9.0),
    "run_steps":       (run_steps, -14.0),
    "car_horn":        (car_horn, -10.0),
    "screen_tap":      (screen_tap, -13.0),
    "atm_confirm":     (atm_confirm, -10.0),
    "cash_pour":       (cash_pour, -8.0),
    "choir_ahh":       (choir_ahh, -11.0),
    "door_chime":      (door_chime, -14.0),
    "cup_place":       (cup_place, -14.0),
    "record_scratch":  (Z.record_scratch, -6.0),
    "register_ching":  (lambda r: G.cash_register(r), -9.0),
    "error_buzz":      (error_buzz, -11.0),
    "sip":             (sip, -9.0),
    "sad_trombone":    (sad_trombone, -6.0),
}

AMB = {  # (set, light) -> (generator, level re voice)
    ("hospital", "interior"): (lambda d, r: amb_hospital(d, r), -28.0),
    ("apartment", "night"):   (lambda d, r: amb_night_room(d, r), -30.0),
    ("city", "day"):          (lambda d, r: amb_city(d, r), -24.0),
    ("city", "golden"):       (lambda d, r: amb_city(d, r, golden=True), -23.0),
}


def build_sfx(tl, N, v_ref):
    r = rng(2036)
    fps = tl["fps"]
    out = np.zeros((2, N))
    send = np.zeros(N)
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
        sig = fn(r)
        sig = pan(sig, float(ev.get("pan", 0.0))) if sig.ndim == 1 else sig
        cur = integrated(sig)
        if np.isfinite(cur):
            sig *= dbg((v_ref + rel_db + 20 * np.log10(max(float(ev.get("gain", 1.0)), 1e-3))) - cur)
        place(out, sig, float(ev["time_s"]))
        i0 = ns(float(ev["time_s"]))
        m = min(sig.shape[1], N - i0)
        if m > 0:
            send[i0:i0 + m] += 0.15 * sig[:, :m].mean(0)

    ir = make_ir(0.8, 47, pre=0.01, hf=1.5)
    out += 0.35 * convolve_st(send, ir)
    return hp(out, 28, 2)


def build_score(tl, N):
    r = rng(1118)
    out = np.zeros((2, N))
    fps = tl["fps"]
    dur_s = tl["duration_s"]
    ev = {}
    for e in tl["events"]:
        ev.setdefault(e["type"], []).append(e["time_s"])
    stop_t = ev.get("music_stop", [48.0])[0]
    fb0, fb1 = ev["flashback_swell"][0] + 0.25, ev["flashback_swell"][1] + 0.25   # music-box section
    jack_t = ev["jackpot"][0]
    run_t = 912 / fps
    lounge_t = 1566 / fps
    trom_t = ev["sad_trombone"][0]

    # ---------------- A/B: bouncy C-major "future" groove ----------------
    beat = 60 / 112
    chords = [(48, [64, 67, 72]), (45, [64, 69, 72]), (41, [65, 69, 72]), (43, [62, 67, 71])]  # C Am F G
    mel = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76, 79]
    tm, i = 0.4, 0
    while tm < stop_t - 0.02:
        if fb0 - 0.3 <= tm < fb1:   # flashback: lo-fi music box instead
            tm += beat / 2
            i += 1
            continue
        bar, sub = divmod(i, 8)
        root, tri = chords[bar % 4]
        hype = tm >= run_t
        e8 = sub % 2
        if not e8:
            place(out, pan(I.pluck(I.m2f(root - 12 if sub % 4 == 0 else root - 5), 0.85, r, dur=0.4, bright=0.6), -0.1), tm)
        if sub in (2, 6):
            place(out, pan(I.snare(0.35 + (0.15 if hype else 0), r, dur=0.18, snappy=0.85), 0.1), tm)
        if hype or sub % 2 == 0:
            place(out, pan(I.brush(0.22, r, dur=0.08), 0.3), tm)
        if sub in (1, 3, 5, 7):  # off-beat synth chord stabs
            for nn in tri:
                place(out, pan(I.pluck(I.m2f(nn), 0.22, r, dur=0.18, bright=0.9), 0.25), tm)
        if tm > 1.2 and sub % 2 == 0:
            place(out, pan(I.glock(I.m2f(mel[(i // 2) % 16] + (12 if hype else 0) * 0), 0.32 if not hype else 0.42, r, dur=0.6), -0.2), tm)
        if hype and sub == 0:
            place(out, I.timpani(I.m2f(36), 0.5, r, dur=1.0), tm)
        tm += beat / 2
        i += 1
    # music-box flashback (2026 night)
    mb = [72, 76, 79, 84, 79, 76, 74, 77, 81, 77, 74, 71]
    tm, j = fb0, 0
    while tm < fb1 - 0.1:
        place(out, pan(I.musicbox(I.m2f(mb[j % 12]), 0.45, r, dur=1.2), 0.15 * np.sin(j)), tm)
        tm += beat * 0.75
        j += 1
    place(out, I.pad([I.m2f(48), I.m2f(55), I.m2f(64)], fb1 - fb0, 0.25, r, att=0.6, rel=0.4, warm=500), fb0)
    # jackpot fanfare stab
    for nn, p in [(60, -0.2), (64, 0.1), (67, 0.3), (72, 0.0)]:
        place(out, pan(I.brass(I.m2f(nn), 0.6, 0.8, r, kind="stab"), p), jack_t)
    # pre-stop riser (barista line) then hard stop
    riser_t = stop_t - 1.6
    for t0, v in I.snare_roll(riser_t, stop_t - 0.02, 0.1, 0.6, r, rate=24.0):
        place(out, pan(I.snare(v, r, dur=0.1, snappy=0.9, buzz=True), 0.05), t0)
    out[:, ns(stop_t):] = 0.0

    # ---------------- C: mellow lounge for the pivot, left hanging for the trombone ----------------
    lb = 60 / 84
    walk = [36, 40, 43, 45, 41, 45, 48, 47, 43, 47, 50, 48, 36, 38, 40, 43]
    vib = [(64, 67, 71), (65, 69, 72), (62, 65, 69), (67, 71, 74)]
    tm, k = lounge_t, 0
    end_t = trom_t - 0.15
    lounge = np.zeros((2, N))
    while tm < end_t:
        place(lounge, pan(I.pluck(I.m2f(walk[k % 16]), 0.7, r, dur=0.7, bright=0.3), -0.15), tm)
        if k % 4 == 0:
            for nn in vib[(k // 4) % 4]:
                place(lounge, pan(I.vibes(I.m2f(nn), 0.28, r, dur=1.8), 0.3), tm)
        if k % 2 == 1:
            place(lounge, pan(I.brush(0.25, r, dur=0.25, swish=True), 0.35), tm)
        tm += lb
        k += 1
    fade = np.clip((end_t - np.arange(N) / SR) / 0.3, 0, 1)
    lounge *= fade[None, :]
    out += lounge
    return hp(out, 32, 2)
