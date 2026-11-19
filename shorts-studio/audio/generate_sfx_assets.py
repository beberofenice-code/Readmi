#!/usr/bin/env python3
"""
Procedural SFX & Ambience Asset Generator for Shorts-Studio.
Synthesizes a complete library of synced foley/UI/ambience WAV assets under `assets/sfx/`
and writes `assets/sfx/manifest.json` so every short gets real, frame-accurate SFX with zero missing-file errors.

Uses pure Python/NumPy (`audio/sfx_gen.py` + `audio/dsp.py`) and optional FFmpeg `lavfi` shaping.
Can be run standalone (`python3 audio/generate_sfx_assets.py`) or imported by `audio/mix.py` via `ensure_sfx_assets()`.
"""
import argparse
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import numpy as np
from dsp import SR, rng, st, write_wav, integrated, dbg
import sfx_gen as G

DEFAULT_ASSETS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "assets", "sfx"))

# Canonical SFX catalog:
# name -> (category, default_rel_db, loopable, description, generator(r))
SFX_CATALOG = {
    # ---- Mechanical / Action ----
    "brake_slam": (
        "mechanical", -7.0, False,
        "Heavy pedal stomp + spring thump for sudden brake-check cold opens",
        lambda r: G.brake_slam(r),
    ),
    "tire_screech": (
        "mechanical", -8.0, False,
        "Dry asphalt tire lockup screech and rubber skid",
        lambda r: G.tire_screech(r, dur=1.15, wet=False),
    ),
    "tire_screech_wet": (
        "mechanical", -8.0, False,
        "Wet road tire skid with hydroplane water spray",
        lambda r: G.tire_screech(r, dur=1.10, wet=True),
    ),
    "crash_impact": (
        "mechanical", -4.5, False,
        "Sub-bass thud + chassis metallic crunch + shattering glass shards",
        lambda r: G.car_crash(r, intensity=1.15),
    ),
    "car_horn": (
        "mechanical", -8.5, False,
        "Dual-tone sedan horn honk",
        lambda r: G.car_horn(r, dur=0.58),
    ),
    "car_whoosh": (
        "mechanical", -10.5, False,
        "Stereo Doppler pass-by car whoosh",
        lambda r: G.car_whoosh(r, dur=0.72),
    ),
    "lane_swoop": (
        "mechanical", -11.0, False,
        "Quick swerve tire chirp for abrupt lane cuts",
        lambda r: G.tire_screech(r, dur=0.65, wet=False),
    ),
    "siren_chirp": (
        "mechanical", -9.5, False,
        "Police cruiser double siren chirp",
        lambda r: G.siren_chirp(r),
    ),

    # ---- Comedy / UI / Money ----
    "cash_register": (
        "comedy_ui", -7.5, False,
        "Classic cash register drawer slam + bright bell cha-ching",
        lambda r: G.cash_register(r),
    ),
    "cash_rustle": (
        "comedy_ui", -9.5, False,
        "Crisp stacked paper cash thumb-riffle and bill snap",
        lambda r: G.cash_rustle(r, dur=0.58),
    ),
    "money_rain": (
        "comedy_ui", -10.0, False,
        "Fluttering airborne banknotes raining down",
        lambda r: G.money_rain(r, dur=1.4),
    ),
    "pop_in": (
        "comedy_ui", -9.5, False,
        "Punchy cartoon/UI bubble pop-in for visual gags and prop appearances",
        lambda r: G.pop_in(r),
    ),
    "counter_flip": (
        "comedy_ui", -8.5, False,
        "Mechanical tabletop flip-counter card clack",
        lambda r: G.counter_flip(r),
    ),
    "calendar_flip": (
        "comedy_ui", -8.5, False,
        "Desk calendar page swoosh + crisp clack",
        lambda r: G.calendar_flip(r),
    ),
    "phone_ring": (
        "comedy_ui", -9.0, False,
        "Office desk telephone double ring",
        lambda r: G.phone_ring(r),
    ),
    "camera_beep": (
        "comedy_ui", -7.5, False,
        "Dashcam / device dual REC confirmation beep",
        lambda r: G.camera_beep(r),
    ),
    "whoosh_transition": (
        "comedy_ui", -12.0, False,
        "Subtle clean air transition whoosh for fast scene cuts",
        lambda r: G.whoosh_transition(r, dur=0.34),
    ),
    "hottub_bubbles": (
        "comedy_ui", -13.0, True,
        "Jacuzzi/hot-tub churning bubbles loop",
        lambda r: G.hottub_bubbles(r, dur=2.3),
    ),

    # ---- Ambience & Wipers ----
    "rain_loop_exterior": (
        "ambience", -21.0, True,
        "Full-spectrum continuous exterior rain shower loop",
        lambda r: G.rain_loop_exterior(4.0, r),
    ),
    "rain_loop_cabin": (
        "ambience", -22.0, True,
        "Muffled low-pass interior car-cabin rain bed (roof drumming)",
        lambda r: G.rain_loop_cabin(4.0, r),
    ),
    "highway_ambience": (
        "ambience", -24.0, True,
        "Steady highway engine/road hum + passing air bed",
        lambda r: G.amb_highway(4.0, r, rain=False, cabin=False),
    ),
    "wiper_sweep": (
        "ambience", -12.0, False,
        "Rhythmic windshield wiper rubber swish",
        lambda r: G.wiper_sweep(r),
    ),
}

# Friendly aliases accepted in story.ts sfxEvents / EVENTS so shorthand names never fail
SFX_ALIASES = {
    "crash": "crash_impact",
    "metallic_crash": "crash_impact",
    "screech": "tire_screech",
    "horn": "car_horn",
    "honk": "car_horn",
    "whoosh": "whoosh_transition",
    "transition_whoosh": "whoosh_transition",
    "cha_ching": "cash_register",
    "cash_cha_ching": "cash_register",
    "paper_rustle": "cash_rustle",
    "pop": "pop_in",
    "rec_beep": "camera_beep",
    "beep": "camera_beep",
    "wiper": "wiper_sweep",
    "wiper_swish": "wiper_sweep",
    "rain_exterior": "rain_loop_exterior",
    "rain_cabin": "rain_loop_cabin",
    "rain_muffled": "rain_loop_cabin",
}


def _normalize_asset(sig, target_peak=0.82):
    """Peak-normalize procedural SFX safely without clipping while preserving stereo shape."""
    sig = st(sig)
    pk = float(np.max(np.abs(sig)))
    if pk > 1e-9:
        sig = sig * (target_peak / pk)
    return sig


def generate_all(out_dir=DEFAULT_ASSETS_DIR, force=False, quiet=False):
    """Generate all missing procedural SFX WAV files + write assets/sfx/manifest.json."""
    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "manifest.json")
    assets = {}
    generated = 0

    for idx, (name, (category, rel_db, loopable, desc, gen_fn)) in enumerate(SFX_CATALOG.items()):
        rel_file = f"{name}.wav"
        wav_path = os.path.join(out_dir, rel_file)
        if force or not os.path.exists(wav_path):
            r = rng(5000 + idx * 97)
            sig = _normalize_asset(gen_fn(r))
            write_wav(wav_path, sig, bits=16)
            dur_s = round(sig.shape[1] / SR, 3)
            lufs = integrated(sig)
            generated += 1
        else:
            # Measure existing wav quickly
            import wave
            with wave.open(wav_path, "rb") as wf:
                dur_s = round(wf.getnframes() / wf.getframerate(), 3)
            lufs = -16.0

        assets[name] = {
            "file": rel_file,
            "category": category,
            "duration_s": dur_s,
            "default_rel_db": rel_db,
            "loopable": loopable,
            "sample_rate": SR,
            "description": desc,
            "integrated_lufs": round(float(lufs), 2) if np.isfinite(lufs) else -20.0,
        }

    manifest = {
        "version": 2,
        "sample_rate": SR,
        "channels": 2,
        "generator": "audio/generate_sfx_assets.py",
        "assets": assets,
        "aliases": SFX_ALIASES,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    if not quiet:
        print(f"[sfx] Ready: {len(assets)} SFX assets ({generated} generated) -> {manifest_path}")
    return manifest


def ensure_sfx_assets(assets_dir=DEFAULT_ASSETS_DIR, quiet=True):
    """Ensure manifest.json and all referenced WAVs exist (auto-generates any missing files)."""
    manifest_path = os.path.join(assets_dir, "manifest.json")
    need_gen = not os.path.exists(manifest_path)
    if not need_gen:
        try:
            manifest = json.load(open(manifest_path, encoding="utf-8"))
            for info in manifest.get("assets", {}).values():
                if not os.path.exists(os.path.join(assets_dir, info["file"])):
                    need_gen = True
                    break
            if not need_gen:
                return manifest
        except Exception:
            need_gen = True
    return generate_all(out_dir=assets_dir, force=False, quiet=quiet)


def main():
    ap = argparse.ArgumentParser(description="Generate procedural SFX library + assets/sfx/manifest.json")
    ap.add_argument("--out-dir", default=DEFAULT_ASSETS_DIR, help="Output folder for WAVs and manifest.json")
    ap.add_argument("--force", action="store_true", help="Regenerate all WAV files even if present")
    args = ap.parse_args()
    generate_all(out_dir=args.out_dir, force=args.force, quiet=False)


if __name__ == "__main__":
    main()
