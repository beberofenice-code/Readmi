# Shorts-Studio v2 (`cartoon-3d-short-v2`)

Complete upgraded Three.js + Remotion + Python BS.1770-4 production template and Claude/Antigravity skill for multi-set, vehicle-ready 2.5D/3D vertical animated shorts.

## Folder Map
| Path | Description |
|---|---|
| `SKILL.md` | Full v2 agent skill instructions, rules, and 8-stage production pipeline |
| `templates/core/` | Core engine: 5-mode `lights.ts` & `grade.ts`, `rig25d.ts` hybrid 2.5D rig, `OverlayLayer.tsx` (`<DashcamHUD>` + `<PopCaptions>`), `ink.ts`, `lensblur.ts`, `shade.ts`, `cardshade.ts`, `toon.ts`, `paint.ts`, `build.ts` |
| `templates/dashcam/` | Complete 12-shot, 1,867-frame implementation of **"How the Dashcam Was Invented"** (`SCRIPT.md`, `story.ts`, `sets.ts`, `DashcamShort.tsx`) |
| `templates/audio/` | Auto-synced procedural foley + 120 BPM score + BS.1770-4 master limiter (`mix.py`, `sfx_gen.py`, `dsp.py`, `instruments.py`) |
| `templates/scripts/` | `export_timeline.mjs` (`story.ts` -> `timeline.json`), cross-platform persistent-bundle `render.mjs`, `sbs_sheet.py`, `short_qa.py`, `elevenlabs_tts.py` (ElevenLabs `SCRIPT.md` -> 48 kHz `voice.wav` + `words.json`), and `short3d_runner.mjs` |
| `references/` | Measured `STYLE_BIBLE.md` + all 7 quantitative look-match reports |

## Quick Start (Desktop, Linux, or Android / Termux)
1. Copy `templates/core/` and `templates/dashcam/` into `src/videos/` of your Remotion project, and register `DashcamShort` (`durationInFrames={1867}`, `fps={30}`, `width={1080}`, `height={1920}`) in `src/Root.tsx`.
2. Export the canonical timeline JSON from `story.ts`:
   ```bash
   node scripts/export_timeline.mjs src/videos/dashcam/story.ts out/dashcam/timeline.json
   ```
3. Render 1 midpoint still per shot (bundles Webpack once into `.remotion-bundle/`):
   ```bash
   node scripts/render.mjs stills --comp DashcamShort --timeline out/dashcam/timeline.json --out out/dashcam/stills
   ```
4. Synthesize and master the soundtrack (`mix.wav`):
   ```bash
   python audio/mix.py --timeline out/dashcam/timeline.json --voice voice/voice.wav --words voice/words.json --out audio/mix.wav
   ```
5. Render shots fault-tolerantly, stitch `xfade` transitions, mux `mix.wav`, and run QA:
   ```bash
   node scripts/render.mjs render-shots --comp DashcamShort --timeline out/dashcam/timeline.json --audio audio/mix.wav --out out/dashcam/final-short.mp4
   python scripts/short_qa.py out/dashcam/final-short.mp4 out/dashcam/qa out/dashcam/timeline.json
   ```
