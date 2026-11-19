# Shorts-Studio v2 (`cartoon-3d-short-v2`) — Cinema Upgrade

Complete upgraded Three.js + Remotion + 4-Track FFmpeg/BS.1770-4 production template and Claude/Antigravity skill for cinema-grade, high-retention 2.5D/3D vertical animated explainer shorts.

## Folder Map
| Path | Description |
|---|---|
| `SKILL.md` | Full cinema-grade agent skill instructions, 5-beat viral retention scripting rules, 12 camera rig presets, 4 lighting presets, and 8-stage pipeline |
| `templates/core/` | Core engine: 4 cinema + 5 legacy lighting/grade modes (`lights.ts`, `grade.ts`), 12-preset `camera.ts` choreography & pacing validator, `environment.ts` weather/sky/micro-gag props, expressive `rig25d.ts` + `toon.ts` emotion state machine & accessories, `OverlayLayer.tsx` (`<DiegeticHUD>` + `<PopCaptions>`/`<ViralSubtitles>`), HD `paint.ts`, `ink.ts`, `lensblur.ts`, `shade.ts`, `cardshade.ts`, `build.ts` |
| `templates/dashcam/` | Complete reference implementation of **"How the Dashcam Was Invented"** (`SCRIPT.md`, `story.ts`, `sets.ts`, `DashcamShort.tsx`) |
| `templates/audio/` | 4-track FFmpeg audio mixer (`mix.py`), procedural 22-asset SFX generator + manifest builder (`generate_sfx_assets.py`), pure-NumPy-capable `dsp.py`, `instruments.py`, and `sfx_gen.py` |
| `templates/scripts/` | `export_timeline.mjs` (`story.ts` -> `timeline.json` with `sfxEvents`, `MUSIC_CUES`, `DIALOGUE_FX`, `pacing`), persistent-bundle resumable `render.mjs`, `elevenlabs_tts.py` (`[SPEAKER:fx]` + dead-air trimmer + WPM check), `short_qa.py` (pacing, non-blank frames, audio, subtitle safe-zone QA), `sbs_sheet.py`, and `short3d_runner.mjs` |
| `references/` | Updated `STYLE_BIBLE.md` + 7 quantitative look-match reports |

## Quick Start (Desktop, Linux, or Android / Termux)
1. Copy `templates/core/` and `templates/dashcam/` into `src/videos/` of your Remotion project, and register `DashcamShort` (`durationInFrames={1867}`, `fps={30}`, `width={1080}`, `height={1920}`) in `src/Root.tsx`.
2. Export the canonical timeline JSON from `story.ts`:
   ```bash
   node scripts/export_timeline.mjs src/videos/dashcam/story.ts out/dashcam/timeline.json
   ```
3. Generate the procedural SFX library (`assets/sfx/*.wav` + `assets/sfx/manifest.json`) — also auto-run by `audio/mix.py`:
   ```bash
   python3 audio/generate_sfx_assets.py
   ```
4. Render midpoint stills with viral subtitles & HUD (bundles Webpack once into `.remotion-bundle/`):
   ```bash
   node scripts/render.mjs stills --comp DashcamShort --timeline out/dashcam/timeline.json --captions --words voice/dashcam/words.json --out out/dashcam/stills
   ```
5. Mix the 4-track soundtrack (`audio/mix.wav`, `-14.5 LUFS` / `-1.2 dBTP`, `-18 dB` VO ducking, telephone bandpass EQ on phone dialogue):
   ```bash
   python3 audio/mix.py --timeline out/dashcam/timeline.json --voice voice/dashcam/voice.wav --words voice/dashcam/words.json --out audio/mix.wav
   ```
6. Render shots fault-tolerantly, stitch `xfade` transitions, mux `audio/mix.wav`, and run cinema QA:
   ```bash
   node scripts/render.mjs render-shots --comp DashcamShort --timeline out/dashcam/timeline.json --audio audio/mix.wav --captions --words voice/dashcam/words.json --out out/dashcam/final-short.mp4
   python3 scripts/short_qa.py out/dashcam/final-short.mp4 out/dashcam/qa out/dashcam/timeline.json --words voice/dashcam/words.json --strict
   ```
