---
name: cartoon-3d-short-v2
description: Build 50-70 s vertical 2.5D/3D animated story shorts (flat bean-head characters + hybrid 2.5D seated/interactive rigs inside painted 3D sets with black ink outlines, 5 lighting/grade modes, origin-locked vehicle treadmills, diegetic HUD/caption overlays, and auto-synced Python BS.1770-4 procedural audio), rendered fault-tolerantly per shot in Three.js + Remotion across Desktop, Linux, and Android/Termux.
---

# Shorts-Studio v2 (Three.js + Remotion Multi-Set & Vehicle Pipeline)

Upgraded from `cartoon-3d-short` v1 to eliminate single-scene limits, dual-WebGL crossfade OOM crashes, flat-card interior clipping, manual TS/Python timeline drift, and Windows-only Chrome bundling.

## Key Architectural Upgrades
1. **5-Mode Lighting & Fitted Display Grade (`templates/core/lights.ts`, `grade.ts`):**
   - Full support for `day`, `golden`, `night`, `interior`, and `rain` presets derived from the 2,164-frame reference cluster study (`references/reports/grade.md` & `lighting.md`).
2. **Modular Set Registry & Origin-Locked Highway Treadmill (`templates/dashcam/sets.ts`):**
   - Only the active shot's set (`car_cabin`, `highway`, `driveway`, `office`, `pool`) is visible on a given frame.
   - Moving vehicles stay within `[-15 m, +15 m]` of `(0,0,0)` while road slabs, lane dashes, and scenery scroll past—keeping the `4096x4096` shadow map crisp and `InkPass` near-widths (`5.1 px`) consistent.
3. **Hybrid 2.5D Character Rig (`templates/core/rig25d.ts`):**
   - Keeps pooled 2D `Canvas2D` billboards (`toon.ts` + `cardshade.ts`) for exterior crowds, and adds a 3D lathed bean-head + 3D capsule torso + `TubeGeometry` spline limbs (`NOINK` layer + plum `#241726` inverted hull) for drivers, pedals, steering wheels, desks, and hot tubs.
4. **DOM `<OverlayLayer>` (`templates/core/OverlayLayer.tsx`):**
   - Renders crisp diegetic UI (`<DashcamHUD>` with live `MPH`, `REC` dot, timestamp, fisheye vignette) and optional `words.json` 1-2 word pop-captions **outside** `<ThreeCanvas>` so WebGL DOF and colour grading never blur text.
5. **Single-Source Master Timeline (`templates/scripts/export_timeline.mjs`):**
   - `story.ts` is the sole source of truth. `export_timeline.mjs` compiles shots, crossfades, camera moves, kicks, and foley triggers to `timeline.json`, read directly by Python audio (`mix.py`, which drives `sfx_gen.py` foley and `instruments.py` score synthesis) and `short_qa.py`.
6. **Single-Bundle, Per-Shot Resumable Renderer (`templates/scripts/render.mjs`):**
   - Bundles Webpack **once** to `.remotion-bundle/` (no 1.3 GB temp-dir duplication per run), auto-detects OS Chromium/Chrome and GPU backend (`angle` on desktop vs `swangle --concurrency=1` on Termux/headless Linux), renders shots individually with `+xfade` handles, and stitches via FFmpeg `xfade`.

## Dependency Rules (required)
- **Pin `@react-three/postprocessing` to exactly `3.0.4`** (`npm install -E @react-three/postprocessing@3.0.4`; `package.json` must read `"3.0.4"`, never `^3`).
  Versions >= 3.1 create the `EffectComposer` inside a `useEffect` + `setState`, so on the single `advance()` Remotion issues
  per still/frame the composer does not exist yet while its priority-1 `useFrame` still suppresses R3F's default render:
  every frame renders as an empty canvas (only the DOM background / HUD shows). 3.0.4 builds the composer synchronously
  (`useMemo` + `useLayoutEffect`), so frame 1 of every single-pass render is drawn.
- Peer set known to work with it: `three@0.187`, `@react-three/fiber@9`, `postprocessing@6.39`, `react@19`, Remotion `4.0.x`.
- Headless Linux (no `DISPLAY`/`WAYLAND_DISPLAY`) has no GPU: `render.mjs` falls back to `--gl=swangle`; override with `REMOTION_GL`.
- `HeroRig25D` faces local **+z** (face decal, vest opening, hands, feet). Pose `yaw` so +z points at the camera for front-on shots;
  flat-coloured rig parts must use a texture (`cardShade` samples `map`; an untextured material renders black).

## 8-Stage Execution Pipeline
1. **Script (`SCRIPT.md`):** Paradox hook in line 1 (10-16 words), 3-5 escalating beats, `[SPEAKER]` tags for micro-dialogue, and ironic twist ending on the final word (~3.7 words/s).
2. **Voice & Alignment (`voice/`):** Generate/record 48 kHz `voice.wav`, trim pauses >0.25 s, run WhisperX / forced alignment to emit `voice/words.json` + 30 fps `voice/mouth_env.json`.
3. **Master Timeline (`story.ts` -> `timeline.json`):** Define `SHOTS`, `CAMS` (`glide` 18-40 f, creeping `pushK` 0.15-0.35 %/f on every hold, 7-frame sign-flipping `KICKS`), `DOF`, and `EVENTS`. Run `node scripts/export_timeline.mjs src/videos/<short>/story.ts out/<short>/timeline.json`.
4. **Sets & Rigs (`sets.ts`, `rig25d.ts`):** Build low-poly + painted `CanvasTexture` environments (`paint.ts`), put character/sky/particle meshes on `NOINK` (`layer 3`), and give readable signs unlit `MeshBasicMaterial` faces.
5. **Stills Gate:** Run `node scripts/render.mjs stills --comp DashcamShort --out out/dashcam/stills` (renders 1 midpoint still per shot from the cached bundle) and inspect with `sbs_sheet.py`.
6. **Procedural Audio (`audio/mix.py`):** Run `python audio/mix.py --timeline out/dashcam/timeline.json --voice voice/voice.wav --words voice/words.json`. Synthesizes foley + score, ducks `-3 dB` under speech, limits at `-1.2 dBTP`, and hits `-14.5 LUFS`.
7. **Per-Shot Render & Stitch:** Run `node scripts/render.mjs render-shots --comp DashcamShort --timeline out/dashcam/timeline.json --audio audio/mix.wav --out out/dashcam/final-short.mp4`.
8. **Frame-by-Frame QA:** Run `python scripts/short_qa.py out/dashcam/final-short.mp4 out/dashcam/qa out/dashcam/timeline.json` to verify zero unplanned black, white, pop, or >=12f frozen spans.
