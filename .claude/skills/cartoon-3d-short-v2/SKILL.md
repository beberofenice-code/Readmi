---
name: cartoon-3d-short-v2
description: Build 55-65 s cinema-grade vertical 2.5D/3D animated explainer shorts (expressive 2D-on-3D stickman rigs with emotion state machine & accessories, 4 time-of-day/weather lighting presets, 12 dynamic camera rig presets with 2.0-3.5 s pacing, environmental micro-gags, toggleable diegetic HUD & 1-3 word viral subtitles, and 4-track FFmpeg/BS.1770-4 audio with procedural SFX manifest), rendered fault-tolerantly per shot in Three.js + Remotion across Desktop, Linux, and Android/Termux. Shots can be enhanced by Google Flow (Veo/Omni) via google_flow_mcp ONLY in style-locked-flow mode: Three.js keyframes -> Frames image-to-video -> mandatory style-lock prompt, with automatic Three.js fallback for fast beats and morphed takes; Flow never invents its own art style.
---

# Shorts-Studio v2 — Cinema Upgrade (Three.js + Remotion + 4-Track Audio)

Production-grade vertical animated explainer pipeline modeled on top-tier 3D/stickman viral shorts while preserving single-bundle resumable per-shot rendering, zero-OOM crossfades, and automated frame-by-frame QA across Desktop, Linux, and Android/Termux.

## Core Architecture & Upgraded Modules

1. **4 Cinema Time-of-Day & Weather Lighting Presets (`templates/core/lights.ts`, `grade.ts`):**
   - `daylight_crisp` — Cobalt blue sky dome, stylized clouds, sharp directional sunlight + soft ground shadows, vibrant saturated colors.
   - `sunset_glow` — Indigo-to-peach twilight sky, warm low-angle rim light, emissive glowing headlights/taillights with subtle bloom.
   - `night_spotlight` — Deep night blue sky with dramatic warm overhead key spotlights (`createOverheadSpotlight`) and high contrast.
   - `rainy_overcast` — Moody slate/teal overcast sky, animated diagonal rain streaks, glossy wet asphalt reflections, optional windshield wipers.
   - Legacy modes (`day`, `golden`, `night`, `interior`, `rain`) remain fully supported; helper exports include `LIGHT_ATMOS`, `isDayLight`, `isSunsetLight`, `isNightLight`, and `isRainLight`.

2. **Expressive 2D-on-3D Character Rig (`templates/core/rig25d.ts`, `toon.ts`):**
   - Bold crisp black outlines (`#140e17`, configurable `outlineColor`/`outlineThickness`), capsule stick limbs, clothing accents (`collar`, `tie`, `vest`, `apron`), and swappable 3D accessories (`shades`, `hat`: `"none" | "police" | "baseball" | "beanie" | "hard_hat" | "tophat"`, `coffeeCup` with animated steam, `phone`).
   - Frame-driven facial expression state machine (`resolveExpression(keyframes, frame, seed?)`, `autoBlink()`) supporting rapid swaps across `"smug" | "panicked" | "fake_pain" | "shocked_sweat" | "deadpan" | "annoyed" | "triumphant"` (plus legacy expressions) and comedic visual accents (`sweatDrop`, `motionLines`: `"panic" | "speed" | "shock"`).
   - Pooled 2D `Canvas2D` billboards (`toon.ts` + `cardshade.ts`) also support all 7 emotions for background/exterior crowds.

3. **Rich Environmental Storytelling & Micro-Gags (`templates/core/paint.ts`, `environment.ts`):**
   - Procedural HD textures: `asphaltHD(wet)`, `grassBladesHD()`, `dashboardClusterTex(speedMph, rpm, alertText)`, `interiorTrimTex("wood" | "fabric" | "leather")`, `skylineTex(mode)`, `cashBillTex()`.
   - Reusable scene & gag helpers (`environment.ts`): `createSkyDome`, `createStylizedCloudDeck`, `createOverheadSpotlight`, `createRainParticles` (with optional cabin exclusion box), `createWetAsphaltReflections`, `createWindshieldWipers`, `createCashExplosion`, `createCrashDebrisSparks`, `createFlipCounterProp`, `createBlinkingDeviceLED`, and `createCitySkylineBackdrop`.
   - Moving vehicles stay origin-locked within `[-15 m, +15 m]` of `(0,0,0)` on scrolling road treadmills so the `4096x4096` shadow map and `InkPass` widths stay razor-sharp.

4. **Dynamic Camera Choreography System (`templates/core/camera.ts`):**
   - **Pacing Law:** Cut or change angle every **2.0–3.5 seconds** (18–25 distinct shots per 60 s short). Every shot MUST include subtle motion (push-in, lateral track, `handheldDrift`, or `dampedSpringShake`) — never a frozen camera. Validate via `validateShotPacing()`.
   - **12 Reusable Camera Rig Presets (`CAMERA_RIGS` / `createCameraRig`):**
     `hood_windshield`, `interior_dash_pov`, `tight_impact_shake`, `low_ground_wide`, `low_bumper_track`, `high_tactical_three_quarter`, `low_hero_tilt`, `sitcom_desk_medium`, `overpass_push_in`, `passenger_cabin_reveal`, `device_pov_hud`, `reverse_cabin_reveal`.

5. **Toggleable Diegetic HUD & Punchy Viral Subtitles (`templates/core/OverlayLayer.tsx`):**
   - Rendered in DOM **outside** `<ThreeCanvas>` so WebGL DOF and color grading never blur UI or text.
   - `<DiegeticHUD>` (backward-compatible alias `<DashcamHUD>`): blinking `● REC` dot, live date/timestamp, live speed readout, configurable lens badge (`FRONT 1080P`), optional fisheye vignette & reticle.
   - `<PopCaptions>` (alias `<ViralSubtitles>`): bold rounded white sans-serif with thick crisp black stroke (`paintOrder: "stroke fill"`) and drop shadow, centered in the lower third (`77%` vertical height, `SUBTITLE_SAFE_ZONE` clear of YouTube Shorts / Reels buttons), **1–3 words at a time** via `chunkWordsForSubtitles()`, with fast subtle scale pop-in (`0.92 -> 1.0` over 3.5 frames) and strict single-line rendering (`whiteSpace: "nowrap"`).

6. **4-Track FFmpeg Audio Mix & Procedural SFX Manifest (`templates/audio/`):**
   - `generate_sfx_assets.py` procedurally synthesizes 22 WAV assets across mechanical/action (`brake_slam`, `tire_screech`, `tire_screech_wet`, `crash_impact`, `car_horn`, `car_whoosh`, `lane_swoop`, `siren_chirp`), comedy/UI/money (`cash_register`, `cash_rustle`, `money_rain`, `pop_in`, `counter_flip`, `calendar_flip`, `phone_ring`, `camera_beep`, `whoosh_transition`, `hottub_bubbles`), and ambience (`rain_loop_exterior`, `rain_loop_cabin`, `highway_ambience`, `wiper_sweep`) plus `assets/sfx/manifest.json` & aliases. Auto-runs via `ensure_sfx_assets()` for **zero missing-file errors**.
   - `mix.py` mixes 4 clean stems through FFmpeg:
     1. **Narrator VO (Lead)** — clean presence + gentle dead-air gating.
     2. **Character Dialogue Inserts (FX)** — non-narrator lines filtered via FFmpeg (e.g., `highpass=f=300,lowpass=f=3000` telephone bandpass EQ for `[SPEAKER:phone]`).
     3. **Dynamic Background Music Bed** — multi-mood act progression (`mischievous_groove` -> `driving_escalation` -> `tense_rainy` -> `silence_drop` -> `resolve_chord`), ducked **-16 to -20 dB** (`-18 dB` default) under VO via FFmpeg `sidechaincompress` + word-aligned envelope.
     4. **Frame-Accurate Foley & SFX Track** — places every `sfxEvents`/`events` cue from `timeline.json` + automatic exterior/muffled-cabin rain beds and rhythmic wiper sweeps.
   - Pure-NumPy fallbacks in `dsp.py` & `instruments.py` mean zero `scipy` dependency failures. Mastered to **-14.5 LUFS** / **-1.2 dBTP** at 48 kHz stereo.

7. **Single-Source Timeline, Resumable Per-Shot Render & QA (`templates/scripts/`):**
   - `export_timeline.mjs`: exports `SHOTS`, `CAMS`, `KICKS`, `sfxEvents`/`EVENTS`, `MUSIC_CUES`, `DIALOGUE_FX`, and `pacing` diagnostics to `timeline.json`.
   - `render.mjs`: bundles Webpack **once** to `.remotion-bundle/`, supports `--captions`, `--words`, `--shot`, `--frame`, renders resumable shot chunks with `+xfade` handles, and stitches via FFmpeg.
   - `short_qa.py`: validates shot **PACING**, **FRAMES** (black/white/flat-blank `std<0.015`/frozen `>=12f`), **AUDIO** (stream presence, 48 kHz stereo, loudness/TP/silences), and **SUBTITLES** (1–3 word chunks + `72–84%` mobile safe zone), plus `--stills <dir>` fast gate mode.

---

## Dependency Rules (Required)
- **Pin `@react-three/postprocessing` to exact `3.0.4`** (`npm install -E @react-three/postprocessing@3.0.4`; `package.json` must read `"3.0.4"`, never `^3`). Versions `>= 3.1` instantiate `EffectComposer` asynchronously in `useEffect`, causing Remotion's single `advance()` per frame to output an empty canvas.
- Peer set verified: `three@0.187`, `@react-three/fiber@9`, `postprocessing@6.39`, `react@19`, Remotion `4.0.x`.
- Headless Linux (no `DISPLAY`/`WAYLAND_DISPLAY`) automatically falls back to `--gl=swangle`; override via `REMOTION_GL`.
- `HeroRig25D` faces local **+z** (face decal, vest/tie/collar, hands, feet). Orient `yaw` toward the camera for front shots; flat-colored rig materials require a texture because `cardShade` samples `map`.

---

## Viral Hook & 5-Beat Retention Scripting Formula
Every 55–65 s script (`SCRIPT.md`) MUST follow these non-negotiable retention rules:
- **0:00–0:03 Action-First Cold Open:** Start mid-action with visual + SFX shock on frame 1. **Strictly ban** weak intros (`"Have you ever wondered..."`, `"In today's video..."`, `"Did you know..."`).
- **Hidden-Subject Curiosity Loop:** Never name the final invention, twist, or punchline in the opening hook. Focus on a vivid human conflict and withhold the reveal word until the final 2–3 seconds.
- **5-Beat Blueprint:**
  1. `0:00–0:03` **Cold Open** — Mid-action shock + mechanical SFX (`brake_slam` / `crash_impact`).
  2. `0:03–0:15` **Setup** — Why the scheme/situation works + immediate payoff (`daylight_crisp`).
  3. `0:15–0:32` **Rule-of-3 Escalation** — Three escalating targets/upgrades with lighting progression (`daylight_crisp` -> `sunset_glow` -> `night_spotlight`) and driving music.
  4. `0:32–0:42` **Comic Dialogue Breather + Visual Micro-Gag** — Fast 2-line character exchange (`[SPEAKER:phone]` telephone EQ) + visual prop gag (`createFlipCounterProp`, `sitcom_desk_medium`).
  5. `0:42–0:62` **Atmospheric Mood Shift -> Calm Underdog Reversal -> Payoff Reveal** — Shift to `rainy_overcast` (rain + wet asphalt reflections + wipers), calm twist, diegetic POV proof (`device_pov_hud` + `<DiegeticHUD>`), and 1-sentence final reveal.

---

## 8-Stage Execution Pipeline
1. **Script (`src/videos/<slug>/SCRIPT.md`):** Follow the 5-Beat Blueprint (~165–180 WPM, ~165–195 words) with `[NARRATOR]` and `[SPEAKER:phone]` dialogue tags.
2. **Voice & Alignment (`voice/<slug>/`):** Run `node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage voice` (calls `scripts/elevenlabs_tts.py`, which trims dead-air/breaths with `--max-pause 0.18`, preserves locked `words.json` timestamps + `fx` metadata, and checks 165–180 WPM pacing). Preview offline with `--dry-run`.
3. **Master Timeline (`story.ts` -> `timeline.json`):** Author `SHOTS` (2.0–3.5 s cadence, 18–25 cuts/60 s), `CAMS` (using the 12 presets in `core/camera.ts`), `KICKS`, `DOF`, `sfxEvents`, and `MUSIC_CUES`. Run `node scripts/export_timeline.mjs src/videos/<slug>/story.ts out/<slug>/timeline.json`.
4. **Sets, Rigs & Composition (`sets.ts`, `<CompName>.tsx`):** Use the 4 lighting presets, `HeroRig25D` + `resolveExpression()`, `paint.ts` HD textures, `environment.ts` weather/micro-gag props, `NOINK` (`layer 3`) for characters/sky/particles, `<DiegeticHUD>`, and `<PopCaptions>`.
5. **Stills Gate:** Run `node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage stills` (or `--shot 1,6,12`) and verify with `python3 scripts/short_qa.py --stills out/<slug>/stills out/<slug>/qa out/<slug>/timeline.json --words voice/<slug>/words.json`.
6. **4-Track Audio Mix (`audio/<slug>_mix.wav`):** Run `node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage audio` (auto-generates `assets/sfx/` WAVs + `manifest.json`, applies telephone bandpass EQ on phone dialogue, ducks dynamic score `-18 dB` under VO, masters to `-14.5 LUFS` / `-1.2 dBTP`).
7. **Resumable Per-Shot Render & Stitch:** Run `node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage render` (enables viral subtitles automatically when `words.json` is present; add `--no-captions` to omit).
8. **Frame-by-Frame QA:** Run `node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage qa` (add `--strict` to `short_qa.py` for CI enforcement) to verify `PACING`, `FRAMES`, `AUDIO`, and `SUBTITLES` all pass.

---

## Google Flow Enhancement: `style-locked-flow` (the ONLY Flow mode)

Google Flow **never invents its own art style**. It may only *enhance* frames that our Three.js scene already rendered, in our exact `/short3d` look. **Text-to-video (`flow-all`) is removed**: a shot with `set: "flow"` fails `export_timeline.mjs`, and Ingredients-only / text-only video calls are not allowed. Every shot in `story.ts` has `source: "threejs"` (default) or `source: "flow_clip"` (Flow-enhanced). Both go into the same 1080x1920 / 30 fps Remotion timeline. ElevenLabs VO, `mix.py`, the per-shot render + xfade stitch, `<PopCaptions>` and QA work the same for both. Flow's clip audio is always stripped.

The shared rules live in `templates/scripts/flow_style_lock.mjs` (`STYLE_LOCK_PROMPT`, `buildFlowPrompt`, `lintMotion`, `timelineFlowSkip`, morph thresholds). Never write a Flow prompt by hand.

### The strict 3-stage lock (every Flow-enhanced shot)
**Stage A: Three.js keyframe lock.** Build the shot fully in Three.js first (real `set`, `CAMS`, lighting, rig, expressions). Then:
```bash
node scripts/short3d_runner.mjs --slug <slug> --comp <Comp> --stage refs [--shot 5,9]
```
This renders clean full-res keyframes (no captions, no HUD) straight from our scene and camera rig: `assets/flow_refs/shot_XX_start.png` and `shot_XX_end.png`. The end frame is kept **only when the camera or character moves across the shot**. If start and end are nearly the same (PSNR >= 38 dB), the end frame is deleted and Flow gets the start frame only. `flowEnd: true | false` forces either way.

**Stage B: Flow image-to-video (Frames mode).**
```bash
node scripts/short3d_runner.mjs --slug <slug> --comp <Comp> --stage flow-plan [--shot 5,9]
```
This writes `out/<slug>/flow_plan.json`. Each `items[]` entry has `prompt`, `start_frame` (and `end_frame` when present), `aspect_ratio: "9:16"`, `model`, `duration` (shortest of 4/6/8/10 s covering `needs_s`) and `save_as`. Pass the items **unchanged** to `google_flow_mcp` `flow_generate_video` / `flow_batch_generate` (`items`), with `max_credits` set. Always use `start_frame`/`end_frame` (Frames mode). Never send `references`-only or prompt-only video requests. A shot is **blocked** from the plan when its start keyframe is missing, its take was rejected, or its `flowMotion` fails the lint.

**Stage C: style-lock prompt (mandatory).** `flow-plan` wraps every shot's `flowMotion` in this exact text (from `STYLE_LOCK_PROMPT`):
> Animate this exact stylized 2D-on-3D cartoon stickman frame. Preserve the exact white round-headed stickman character with bold black outlines, exact camera framing, and stylized 3D set colors. Upgrade only smooth natural character motion, subtle secondary movement, soft contact shadows, volumetric lighting, and atmospheric particles (rain/dust/reflections). Do NOT change character anatomy, do NOT turn characters into realistic humans, do NOT alter camera angle, and do NOT generate text.

`flowMotion` holds **only the motion to add**, e.g. `"the stickman grips the wheel and leans forward, rain streaks across the glass"`. `lintMotion` refuses motion text that asks for text/letters/captions/logos, signs/counters/readouts, HUD/REC overlays, a different style (realistic, photoreal, anime…), a camera change (new angle, zoom out, cut to…), or new anatomy (fingers, hair, …).

### Protect text, props & consistency
- **Flow never renders anything readable.** All text stays in Remotion or Three.js: readable signs and `createFlipCounterProp` counters (Three.js / Remotion), the diegetic `● REC` HUD (`<DiegeticHUD>`), and the bold 1-3 word lower-third subtitles (`<PopCaptions>`). These DOM layers sit above Flow clips exactly as they sit above the WebGL canvas.
- **Automatic Three.js fallback.** These shots render from the clean Three.js scene even if `story.ts` says `source: "flow_clip"` (`timeline.json` records `requestedSource` + `flowSkip`):
  - fast beats of **<= 2.0 s** (`FAST_BEAT_MAX_S`);
  - shots tagged `beat: "dialogue"` or `beat: "prop"` (dialogue breathers, flip counters and other prop gags);
  - takes rejected by the **morph gate** (below).
- **Morph gate (mandatory after every download):**
  ```bash
  node scripts/short3d_runner.mjs --slug <slug> --comp <Comp> --stage flow-check [--shot 7]
  ```
  This compares the raw take's first frame with `shot_XX_start.png` (structural SSIM >= 0.80) and the last used frame with `shot_XX_end.png` (>= 0.50). A take that fails is written to `assets/flow_clips/flow_reject.json` and that shot falls back to the clean Three.js render. It also writes 6-frame contact sheets to `out/<slug>/flow_check/shot_XX_sheet.jpg`. **Look at every sheet.** SSIM can miss small face or limb morphs, so if the stickman's round head, face, outline weight or stick limbs change at all, run `--stage flow-check --reject 7:morph`. `--accept 7` clears a rejection after you've checked it by eye. A re-generated take for a rejected shot needs `--stage flow-plan --shot 7`.
- The composition only plays a Flow clip for shots that `render.mjs` passes as **accepted, conformed** takes (`flowClips`). Everything else renders from Three.js automatically, and a chunk re-renders by itself when its shot switches between Flow and Three.js.

### Folders & naming (project root; `short3d_runner.mjs` creates them)
- `assets/flow_refs/`: Stage A keyframes going **to** Flow (`shot_XX_start.png`, `shot_XX_end.png`).
- `assets/flow_clips/`: takes coming **back**, `shot_XX.mp4` (two-digit id). Flow saves to `~/flow-media`; copy the file here under the `save_as` name. Also holds `flow_reject.json`.
- `public/flow_clips/`: **generated** conformed copies (1080x1920, 30 fps CFR, exact frames + xfade tail, no audio). Never edit them by hand.

### Shot fields (`story.ts`, one shot per line, flat fields)
```ts
{ id: 7, a: 945, b: 1075, set: "highway", light: "rain", xfade: 6, source: "flow_clip", clipStart: 0.3, clipRate: 1.15, flowMotion: "the stickman grips the wheel and leans forward, rain streaks across the glass" },
{ id: 8, a: 1075, b: 1135, set: "office", light: "interior", source: "flow_clip", beat: "prop", flowMotion: "..." },   // stays Three.js (prop beat)
```
- `flowMotion` (required): the motion to add, nothing else. `flowModel`: default `Omni 1.1 Flash`; use `Veo 3.1 - Fast` for hero beats. `flowEnd`: force or suppress the end frame. `beat`: `"dialogue" | "prop"` always stay Three.js.
- `clip` defaults to `assets/flow_clips/shot_XX.mp4`; `refStart`/`refEnd` default to `assets/flow_refs/shot_XX_start.png` / `_end.png`. `clipStart` trims Veo's slow first ~0.3-0.5 s. `clipRate` 1.1-1.3 tightens floaty motion to the 2.0-3.5 s pacing. `clipFit`: `cover` (default) or `contain`.
- `render.mjs` conforms each take to exactly `(b - a) + next shot's xfade` frames and holds the last frame (with a warning) if it is short. Check with `--stage flow-status`.
- `<CompName>.tsx` must follow `templates/dashcam/DashcamShort.tsx`: play `<FlowClipLayer>` only when `props.flowClips[id]` (or `props.flowPending`) is set and `!props.forceThree`, otherwise `<ThreeCanvas>`. HUD (unless `props.noOverlay`) and `<PopCaptions>` sit above both.

### Commands
- `--stage refs`: Stage A keyframes. `--stage flow-plan`: Stage B+C requests. `--stage flow-check [--reject id:why] [--accept id]`: morph gate. `--stage flow-status`: the Flow/Three.js decision for every shot, clip present or missing, refs, lint, and rejects.
- `--stage stills` / `--stage render`: conform the accepted takes, rebundle when they change, and re-render only the chunks that changed. `render` refuses to run with missing clips unless you pass `--allow-missing-flow` (yellow "FLOW CLIP PENDING" slates, for timing tests only).

### Flow session rules
1. Read the `google_flow_mcp` skill `generate_media` (`get_skill`), then call `flow_status`. If it isn't logged in, stop and ask the user to sign in. Use one Flow project per short, named `<slug>`.
2. Videos are always **9:16**. Run `flow_get_options` for the current models. Use `Omni 1.1 Flash` for most shots and `Veo 3.1 - Fast/Quality` for 2-4 hero beats at most.
3. Before generating, copy `flow_plan.json`'s items (prompt, frames, model) into `src/videos/<slug>/FLOW.md` so every take can be reproduced.
4. Send all shots in one `flow_batch_generate` / `items` call. Never call once per prompt. Always set `max_credits`. Pass `dry_run: true` first to get the credit estimate.

### APPROVAL GATE (mandatory)
**Never spend Flow video credits before the user has approved the keyframes.** After `--stage refs` and `--stage flow-plan`:
1. Show every keyframe inline (`![shot_05_start](/abs/path.png)`).
2. List the planned calls: shot ids, Frames (start / start+end), model, duration and estimated credits (from `dry_run: true`), plus any shots blocked or kept in Three.js and why.
3. **Stop and wait** for an explicit go-ahead. Ask again after any change to keyframes or to the shot list. `dry_run` calls are fine before approval. `flow_generate_video`, `flow_extend_video`, `flow_batch_generate` with videos and `flow_upscale_video` are not.

### Workflow
1. Make the whole short in Three.js with normal pacing (Stages 1-5). Pick the shots to enhance (usually hook, Rule-of-3 peak, rain mood shift, final reveal, all longer than 2 s and not dialogue/prop beats). Set `source: "flow_clip"` plus `flowMotion` on them and keep their real `set`.
2. `--stage refs` → `--stage flow-plan` → **APPROVAL GATE** → generate exactly the planned Frames requests.
3. Download each take to `assets/flow_clips/shot_XX.mp4` → `--stage flow-check` (look at every sheet, reject any morph) → `--stage flow-status` → `--stage stills` → `--stage audio` → `--stage render` → `--stage qa`.
4. Use `xfade: 4-6` into and out of Flow shots so the cut is invisible. Any shot can go back to Three.js at any time (`--reject`, or remove `source`) with no other changes.
