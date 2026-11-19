---
description: Autonomous 8-stage cinema-grade 2.5D/3D vertical animated short generator (Three.js + Remotion + 12 Camera Rigs + 4 Cinema Lighting Presets + 4-Track FFmpeg/BS.1770-4 Audio + Viral Subtitles)
---

# `/short3d` — Autonomous Cinema 2.5D/3D Animated Short Pipeline

Topic / Brief: `$ARGUMENTS`

Execute the **Shorts-Studio v2 (Cinema Upgrade)** 8-stage production workflow end-to-end without stopping for manual confirmation unless an unrecoverable dependency error occurs. Derive a kebab-case `<slug>` and PascalCase `<CompName>` from `$ARGUMENTS`.

## Environment & Memory Rules (Critical on Android / Termux & Headless Linux)
- **Single Webpack Bundle:** Always render via `node scripts/render.mjs` or `node scripts/short3d_runner.mjs` so Webpack bundles **once** into `.remotion-bundle/`. Never spawn ad-hoc `npx remotion render` calls that duplicate `public/` into `/tmp`.
- **Software GL Guardrail:** On Android/Termux or headless Linux/ARM64, keep `--gl=swangle --concurrency=1` (auto-detected by `render.mjs`; `--scale=0.5` on Termux).
- **Single `<ThreeCanvas>`:** Never mount two `<ThreeCanvas>` instances simultaneously; let `render.mjs` stitch `xfade` handles via FFmpeg.
- **Exact Dependency Pin:** Keep `@react-three/postprocessing` pinned to exact `"3.0.4"` (never `^3`).

---

## Stage 1 — Viral Hook & Retention Script (`src/videos/<slug>/SCRIPT.md`)

Write a tight **55–65 second** script (~165–180 WPM, ~165–195 words total) engineered for maximum mobile retention:

### Mandatory Scripting Laws
1. **0:00–0:03 Action-First Cold Open (Mandatory):**
   - Drop the viewer straight into physical action + loud tactile SFX on **frame 1** (e.g., sudden brake slam, metallic crash, heist snap, disastrous mistake).
   - **STRICTLY BANNED weak intros:** Never start with `"Have you ever wondered..."`, `"In today's video..."`, `"Did you know..."`, `"Today we're talking about..."`, logos, or throat-clearing.
2. **The Hidden-Subject Curiosity Loop (Mandatory):**
   - **Do NOT name the final invention, twist, or punchline in the opening hook or title beat.**
   - Frame the story around a vivid human conflict (e.g., an unfair scammer winning over and over, a stubborn underdog getting mocked) and **withhold the reveal word until the final 2–3 seconds**.
3. **5-Beat Story Blueprint (55–65 s):**
   - **Beat 1 (`0:00–0:03`) — Cold Open:** Immediate mid-action visual + SFX shock (e.g., `hood_windshield` -> `tight_impact_shake` + `brake_slam` / `tire_screech` / `crash_impact`).
   - **Beat 2 (`0:03–0:15`) — Setup:** Show why the scheme/situation works and land the immediate reward (`daylight_crisp`, cash/prop gag, `cash_register` / `cash_rustle`).
   - **Beat 3 (`0:15–0:32`) — Rule-of-3 Escalation:** Raise the stakes visually across 3 escalating beats (bigger target, accomplice/twist, greedier upgrade) accompanied by a **time-of-day lighting progression** (`daylight_crisp` -> `sunset_glow` -> `night_spotlight`) and a music energy shift (`mischievous_groove` -> `driving_escalation`).
   - **Beat 4 (`0:32–0:42`) — Comic Dialogue Breather + Visual Micro-Gag:** Break narration monotony with a quick **2-line back-and-forth character exchange** using `[SPEAKER:phone]` (or `[SPEAKER]`) tags paired with a visual micro-gag in the frame (e.g., `createFlipCounterProp` flipping numbers in a `sitcom_desk_medium` shot, coffee cup steam, or absurd prop).
   - **Beat 5 (`0:42–0:62`) — Atmospheric Mood Shift -> Calm Underdog Reversal -> Payoff Reveal:** Shift weather & lighting (`rainy_overcast` + rain streaks + glossy wet asphalt reflections + windshield wipers + `tense_rainy` music -> `silence_drop`), introduce a calm twist, reveal proof through a diegetic POV shot (`device_pov_hud` + `<DiegeticHUD>` + `reverse_cabin_reveal`), and deliver the **1-sentence reveal** right at the final 2–3 seconds over `resolve_chord`.

### Speaker & Dialogue FX Tagging Format
- Prefix lines with `[NARRATOR]` (default lead voice) and optional character dialogue lines with `[SPEAKER]` or `[SPEAKER:fx]` (e.g., `[AGENT:phone]`, `[SCAMMER:phone]`, `[DRIVER]`, `[DISPATCH:radio]`).
- Supported `:fx` tags in `scripts/elevenlabs_tts.py` and `audio/mix.py`: `phone` (telephone bandpass EQ `highpass=f=300,lowpass=f=3000`), `radio`, `megaphone`, `cabin`.

---

## Stage 2 — Brisk Voiceover & Word Alignment (`voice/<slug>/`)
1. If `voice/<slug>/voice.wav` already exists, verify `48000 Hz` sample rate and load `voice/<slug>/words.json`.
2. Otherwise, if `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set (plus optional `ELEVENLABS_VOICE_ID_<SPEAKER>`):
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage voice
   ```
   `scripts/elevenlabs_tts.py` parses `[SPEAKER:fx]` tags, synthesizes aligned clips, **automatically trims dead air & long breaths** (`--max-pause 0.18`s default) while keeping `words.json` frame-locked, reports WPM diagnostics (target **165–180 WPM**), and outputs 48 kHz mono `voice/<slug>/voice.wav` + `voice/<slug>/words.json` (`[{"w","s","e","speaker","fx"}]`).
   - In cloud sessions, allow `api.elevenlabs.io` and store the key as a network secret (`xi-api-key`), never in chat or git.
3. Without a key, continue without narration (Stage 6 mixes music + foley only) and note it in the final report.

---

## Stage 3 — Master Timeline & Dynamic Camera Choreography (`src/videos/<slug>/story.ts` -> `out/<slug>/timeline.json`)

Author `src/videos/<slug>/story.ts` as the **single source of truth** using `core/camera.ts` and `core/lights.ts`:

### Mandatory Pacing & Camera Motion Laws
- **2.0–3.5 s Shot Pacing Rule:** Cut or change camera angle every **2.0–3.5 seconds** (60–105 frames at 30 fps; **18–25 distinct shots** per 60-second short). Quick impact inserts may run 1.0–1.8 s; never hold a static angle beyond 3.5–4.5 s.
- **Zero Frozen Cameras:** Every single shot MUST have intentional motion (slow push-in, lateral tracking, subtle `handheldDrift`, or `dampedSpringShake` impact kick). Call `validateShotPacing(SHOTS, FPS)` to verify pacing.
- **12 Reusable Camera Rig Presets (`core/camera.ts`):**
  1. `hood_windshield` — Mounted on vehicle hood looking slightly up through windshield at driver's face.
  2. `interior_dash_pov` — Behind steering wheel & glowing instrument cluster looking out windshield.
  3. `tight_impact_shake` — Low quarter-angle close-up on collision/action point with damped spring shake on exact impact frame.
  4. `low_ground_wide` — Near-asphalt low wide angle exaggerating poses and vehicle scale.
  5. `low_bumper_track` — Gliding low directly in front of moving vehicle grille while traffic streams past.
  6. `high_tactical_three_quarter` — Elevated 3/4 side angle showing multi-vehicle/object spatial geometry cleanly.
  7. `low_hero_tilt` — Upward-tilted hero angle for greed peaks, victories, or dramatic reveals.
  8. `sitcom_desk_medium` — Eye-level medium shot across a desk/counter with foreground comedic prop on one third & skyline depth behind.
  9. `overpass_push_in` — Elevated start smoothly pushing into a character's close-up reaction.
  10. `passenger_cabin_reveal` — Low interior angle looking up across seated character toward an overhead mounted prop.
  11. `device_pov_hud` — In-world camera/screen lens POV paired with `<DiegeticHUD>` (`● REC` overlay).
  12. `reverse_cabin_reveal` — Reverse dashboard angle looking back at character + glowing/blinking device LED.

### Timeline Exports
- Export `SHOTS` (each with `set`, `light`: `"daylight_crisp" | "sunset_glow" | "night_spotlight" | "rainy_overcast"`, optional `camRig`, `xfade`, `hud`, `hudConfig`), `CAMS` (built via `createCameraRig` / `CAMERA_RIGS` / `glide` / `pushK`), `KICKS`, `DOF`, `sfxEvents` (or `EVENTS`), optional `MUSIC_CUES` (`mischievous_groove`, `driving_escalation`, `tense_rainy`, `silence_drop`, `resolve_chord`), and optional `DIALOGUE_FX`.
- Compile canonical `timeline.json`:
  ```bash
  node scripts/export_timeline.mjs src/videos/<slug>/story.ts out/<slug>/timeline.json
  ```

---

## Stage 4 — Cinema Art Direction, Expressive Rigs, Micro-Gags & Overlays (`src/videos/<slug>/`)

1. **4 Time-of-Day & Weather Lighting Presets (`core/lights.ts`, `core/grade.ts`):**
   - `daylight_crisp` — Cobalt sky dome, stylized clouds, sharp directional sunlight, soft shadows, saturated palette.
   - `sunset_glow` — Indigo-to-peach twilight sky, warm low-angle rim light, glowing headlights/taillights with bloom.
   - `night_spotlight` — Deep night blue sky + dramatic warm overhead key spotlights (`createOverheadSpotlight`).
   - `rainy_overcast` — Slate/teal overcast sky, animated diagonal rain streaks (`createRainParticles`), glossy reflective wet asphalt mirroring emissive taillights (`createWetAsphaltReflections`), and optional animated wipers (`createWindshieldWipers`).
2. **Expressive 2D-on-3D Character Rigs (`core/rig25d.ts`, `core/toon.ts`):**
   - Bold black outlines (`#140e17`), capsule stick limbs, clothing accents (`collar`, `tie`, `vest`, `apron`), and swappable 3D accessories (`shades`, `hat`: `"none" | "police" | "baseball" | "beanie" | "hard_hat" | "tophat"`, `coffeeCup`, `phone`).
   - Drive emotions per frame with `resolveExpression(keyframes, frame, seed?)` supporting rapid swaps across `"smug" | "panicked" | "fake_pain" | "shocked_sweat" | "deadpan" | "annoyed" | "triumphant"` plus automatic blinking (`autoBlink`) and comedic accents (`sweatDrop: true`, `motionLines: "panic" | "speed" | "shock"`).
3. **Rich Textures & Micro-Gag Helpers (`core/paint.ts`, `core/environment.ts`):**
   - Use `asphaltHD(wet)`, `grassBladesHD()`, `dashboardClusterTex()`, `interiorTrimTex()`, `skylineTex()`, `cashBillTex()`.
   - Drop in reusable environment/micro-gag props: `createSkyDome`, `createStylizedCloudDeck`, `createOverheadSpotlight`, `createRainParticles`, `createWetAsphaltReflections`, `createWindshieldWipers`, `createCashExplosion`, `createCrashDebrisSparks`, `createFlipCounterProp`, `createBlinkingDeviceLED`, `createCitySkylineBackdrop`.
   - Keep characters, sky domes, rain streaks, and emissive FX on layer `NOINK` (`layer 3`); use unlit `MeshBasicMaterial` for readable signs; keep moving vehicles origin-locked on scrolling road treadmills.
4. **Diegetic HUD & Punchy Viral Subtitles (`core/OverlayLayer.tsx`):**
   - Mount `<DiegeticHUD visible={!!shot.hud} ... />` for in-world camera shots (`● REC`, live timestamp, speed readout, `FRONT 1080P` label).
   - Mount `<PopCaptions words={props.words ?? []} enabled={!!props.captions} />` (`ViralSubtitles` alias) outside `<ThreeCanvas>`: bold rounded white sans-serif with thick crisp black stroke (`paintOrder: "stroke fill"`), subtle shadow, centered at `77%` vertical height (safely above YouTube Shorts / Reels UI), **1–3 words at a time**, fast `0.92 -> 1.0` pop-in over 3–4 frames, never multi-line walls of text.
   - Register `<CompName>` in `src/Root.tsx`.

---

## Stage 5 — Stills Gate (`out/<slug>/stills/`)
1. Render 1 midpoint still per shot with captions & HUD enabled (reuses `.remotion-bundle/`):
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage stills
   ```
   (Use `--shot 1,5,12` for rapid spot-checks.)
2. Run stills QA (`python3 scripts/short_qa.py --stills out/<slug>/stills out/<slug>/qa out/<slug>/timeline.json --words voice/<slug>/words.json`) and inspect images for framing, lighting progression, expression clarity, HUD readability, and subtitle safe zone. Fix clipping before full render.

---

## Stage 6 — 4-Track Multi-Layer Audio & Procedural SFX Mix (`audio/<slug>_mix.wav`)
1. Run the 4-track FFmpeg audio pipeline (auto-generates any missing WAVs in `assets/sfx/` from `audio/generate_sfx_assets.py` + `assets/sfx/manifest.json` so there are **zero missing-file errors**):
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage audio
   ```
2. The 4-track FFmpeg mixer (`audio/mix.py`) combines:
   - **Track 1 — Narrator VO (Lead):** Crisp broadcast EQ, gentle noise gate, frame-synced.
   - **Track 2 — Character Dialogue Inserts (FX):** Isolated non-narrator lines with per-speaker FFmpeg FX (e.g., telephone bandpass EQ `highpass=f=300,lowpass=f=3000` for `[SPEAKER:phone]`).
   - **Track 3 — Dynamic Background Music Bed:** Act-based mood shifts (`mischievous_groove` -> `driving_escalation` -> `tense_rainy` -> `silence_drop` -> `resolve_chord`), cleanly ducked **-16 to -20 dB** (default `-18 dB`) under VO via FFmpeg sidechain + word-aligned ducking.
   - **Track 4 — Frame-Accurate Foley & SFX Track:** Timeline `sfxEvents` placed from `assets/sfx/manifest.json` (`brake_slam`, `tire_screech`, `crash_impact`, `car_horn`, `car_whoosh`, `cash_register`, `cash_rustle`, `pop_in`, `calendar_flip`, `counter_flip`, `phone_ring`, `camera_beep`, `whoosh_transition`, plus continuous `rain_loop_exterior` / muffled `rain_loop_cabin` + rhythmic `wiper_sweep`).
   - Loudness normalized via FFmpeg to **-14.5 LUFS** / **-1.2 dBTP** at 48 kHz stereo.

---

## Stage 7 — Resumable Per-Shot Render & FFmpeg Stitch (`out/<slug>/final-short.mp4`)
1. Render fault-tolerant per-shot chunks (with viral subtitles enabled automatically when `words.json` exists; pass `--no-captions` to disable), apply FFmpeg `xfade` transitions, mux `audio/<slug>_mix.wav`, and auto-copy to `~/storage/downloads/` on Termux:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage render
   ```

---

## Stage 8 — Cinema QA Gate (`out/<slug>/qa/report.md`)
1. Run full 30 fps QA verification:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage qa
   ```
2. Verify all 4 gates report `PASS`:
   - **PACING:** Shot durations in 2.0–3.5 s target band & healthy shot density.
   - **FRAMES:** Zero black frames, zero unplanned white flashes, zero flat/blank frames (`std < 0.015`), zero frozen camera spans `>=12f`, and clean `POPS []`.
   - **AUDIO:** Audio stream present, 48 kHz stereo, non-silent, `-14.5 LUFS` (±2.5 dB), true peak `<= -1.0 dBTP`.
   - **SUBTITLES:** Word chunks strictly `<= 3 words` per cue, positioned inside mobile safe zone (`72–84%` vertical height, clear of Shorts/Reels bottom UI).
3. If any single shot fails, delete **only** that shot chunk (`rm out/<slug>/chunks/shot_XX.mp4`) and re-run Stage 7 & Stage 8.
