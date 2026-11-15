---
description: Autonomous 8-stage 2.5D/3D vertical animated short generator (Three.js + Remotion + Python BS.1770-4 audio)
---

# `/short3d` — Autonomous 2.5D/3D Animated Short Pipeline

Topic / Brief: `$ARGUMENTS`

Execute the **Shorts-Studio v2** 8-stage production workflow end-to-end without stopping for manual confirmation unless an unrecoverable dependency error occurs. Derive a kebab-case `<slug>` and PascalCase `<CompName>` from `$ARGUMENTS`.

## Environment & Memory Rules (Critical on Android / Termux)
- **Single Webpack Bundle:** Always render via `node scripts/render.mjs` or `node scripts/short3d_runner.mjs` so Webpack bundles **once** into `.remotion-bundle/`. Never spawn ad-hoc `npx remotion render` calls that duplicate `public/` into `/tmp`.
- **Software GL Guardrail:** On Android/Termux or headless ARM64, keep `--gl=swangle --concurrency=1 --scale=0.5` (auto-detected by `render.mjs`).
- **Single `<ThreeCanvas>`:** Never mount two `<ThreeCanvas>` instances simultaneously; let `render.mjs` stitch `xfade` handles via FFmpeg.

## Stage 1 — Script (`src/videos/<slug>/SCRIPT.md`)
1. Write a 50–68 second script (~185–245 words at ~3.7 words/s):
   - **Line 1:** Paradox hook stated as fact in 10–16 words, zero throat-clearing.
   - **Body:** Present-tense setting, 3–5 escalating story beats with `[SPEAKER]` micro-dialogue tags, mystery pivot (`"You see,"` or equivalent), and a crisp 1–2 sentence ironic payoff ending on the final word.

## Stage 2 — Voiceover & Word Alignment (`voice/<slug>/`)
1. If `voice/<slug>/voice.wav` is already present, inspect its sample rate (`48000 Hz` required) and load `voice/<slug>/words.json`.
2. Otherwise, if `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set (optional per-speaker `ELEVENLABS_VOICE_ID_<SPEAKER>`), generate it with ElevenLabs:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage voice
   ```
   This runs `scripts/elevenlabs_tts.py` (`/v1/text-to-speech/{voice_id}/with-timestamps` per `[SPEAKER]` line -> ffmpeg -> 48 kHz mono `voice.wav`, character timings grouped into `words.json` `[{"w": "...", "s": 0.04, "e": 0.28, "speaker": "narrator"}]`). In a cloud session `api.elevenlabs.io` must be allowed; store the key as a network secret for that host (header `xi-api-key`), never in chat or git.
3. With no key, continue without narration (Stage 6 mixes score + foley only) and say so in the final report.

## Stage 3 — Master Timeline (`src/videos/<slug>/story.ts` -> `out/<slug>/timeline.json`)
1. Author `src/videos/<slug>/story.ts` as the **single source of truth**:
   - `SHOTS` with `set`, `light` (`"day" | "golden" | "night" | "interior" | "rain"`), optional `xfade` (6–8 frames), and optional `hud`.
   - `CAMS` using symmetric smootherstep `glide` (18–40 frames), creeping `pushK` (`0.0018–0.0035`/f) on every hold, and 7-frame sign-flipping `KICKS` on impacts.
   - `DOF` thin-lens schedule (`cInf = 10–14` on CU/MS/inserts, `0` on wide/HUD shots) and frame-accurate `EVENTS` foley triggers.
2. Compile `timeline.json`:
   ```bash
   node scripts/export_timeline.mjs src/videos/<slug>/story.ts out/<slug>/timeline.json
   ```

## Stage 4 — Modular 3D Sets, Hybrid 2.5D Rigs & Composition (`src/videos/<slug>/`)
1. Build `sets.ts` using `twoTone` materials (`core/shade.ts`), HD `Canvas2D` painters (`core/paint.ts`), `HeroRig25D` (`core/rig25d.ts`) for seated/interactive characters, and origin-locked scrolling treadmills for any moving vehicles.
2. Put all character rigs, sky domes, rain streaks, and emissive sprites on layer `NOINK` (`layer 3`), and use unlit `MeshBasicMaterial` textures for any readable signs.
3. Wire `<CompName>.tsx` with `InkPass -> LensBlur -> BloomEffect -> ToneMappingEffect(NEUTRAL) -> GradeEffect` plus `<OverlayLayer>` DOM UI, and register `<CompName>` in `src/Root.tsx`.

## Stage 5 — Stills Gate (`out/<slug>/stills/`)
1. Render 1 midpoint still per shot (reusing `.remotion-bundle/`):
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage stills
   ```
2. Inspect the stills for framing, `InkPass` silhouettes, shadow tint, and sign legibility. Fix any clipping in `sets.ts` / `story.ts` and re-export `timeline.json` before full render.

## Stage 6 — Auto-Synced Procedural Audio (`audio/<slug>_mix.wav`)
1. Extend `audio/sfx_gen.py` if new foley event types were added in `story.ts`, then synthesize and master to `-14.5 LUFS` / `-1.2 dBTP`:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage audio
   ```

## Stage 7 — Fault-Tolerant Per-Shot Render & FFmpeg Stitch (`out/<slug>/final-short.mp4`)
1. Render resumable shot chunks, apply FFmpeg `xfade` transitions, mux `audio/<slug>_mix.wav`, and auto-copy to `~/storage/downloads/` when on Termux:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage render
   ```

## Stage 8 — Frame-by-Frame QA (`out/<slug>/qa/report.md`)
1. Run full 30 fps QA verification:
   ```bash
   node scripts/short3d_runner.mjs --slug <slug> --comp <CompName> --stage qa
   ```
2. Confirm `black []`, `unplanned white []`, `frozen spans >=12f []`, and `POPS []`. If any shot fails, re-render **only** that shot chunk (`rm out/<slug>/chunks/shot_XX.mp4`) and re-run Stage 7 & Stage 8.
