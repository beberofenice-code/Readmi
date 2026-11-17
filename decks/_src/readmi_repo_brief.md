# Readmi repository — source brief (compiled from the repo on 2026-11-17)

## What the repo is
- GitHub repo `beberofenice-code/Readmi`. Root README is a placeholder ("# Readmi / Okay").
- Main content: `shorts-studio/` — a Three.js + Remotion project that produces vertical (9:16) 2.5D/3D cartoon story shorts, ~60 s each.
- Also: `shorts-studio-v3.zip` (250 KB archive of the studio), project skills under `.claude/skills/` (cartoon-3d-short-v2, ppt-master).

## Flagship output: "How the Dashcam Was Invented" (DashcamShort)
- 62.2 s, 1,867 frames @ 30 fps, 1080x1920 (2K 1440x2560 export option), final file `out/dashcam/final-short.mp4` (~26 MB).
- Story: a "swoop-and-squat" insurance-fraud driver brake-checks cars, fakes neck injuries, gets paid — until a quiet driver points at a little camera on his windshield. Payoff: "And that's how the dashcam was invented."
- 12 shots across 5 sets: car_cabin, highway, driveway, office, pool.
- 5 lighting/grade modes used: day, golden, night, interior, rain. Crossfades of 6–8 frames between places; final shot uses a diegetic dashcam HUD overlay.
- Voices: NARRATOR, AGENT, SCAMMER. Voiceover generated with ElevenLabs (`voice/dashcam/voice.wav` + word timings `words.json`).

## QA results (out/dashcam/qa/report.md)
- Loudness −15.1 LUFS integrated, LRA 6.2 LU, peak −1.0 dBFS; AAC 48 kHz stereo.
- No silences, no black frames, no unplanned white frames, no frozen spans ≥12 frames, zero unplanned pops.
- Mean motion diff 2.90; held frames 47 (3%).

## Engine (src/videos/core, ~3,650 lines TS)
- toon.ts (909) toon shading; paint.ts (720) hand-painted procedural textures; build.ts (704) scene construction;
  ink.ts (393) black ink outlines on 3D geometry; rig25d.ts (278) hybrid 2.5D character rig (flat bean-head characters, seated/interactive);
  grade.ts (152) + lights.ts (98) 5-mode lighting & color grade; lensblur.ts (139) depth of field; OverlayLayer.tsx (96) DashcamHUD + PopCaptions;
  shade.ts, cardshade.ts.
- Story layer (src/videos/dashcam): story.ts (shot table + camera paths), sets.ts (816 lines, 5 painted 3D sets), DashcamShort.tsx, SCRIPT.md.

## Audio (audio/, Python)
- Procedural foley (sfx_gen.py), 120 BPM score (instruments.py), DSP (dsp.py), mix.py auto-synced to timeline, mastered with ITU BS.1770-4 loudness limiter.

## Pipeline (8 stages, skill /short3d and cartoon-3d-short-v2)
1. Script & beat sheet (SCRIPT.md) following a measured script formula: paradox hook → setting → escalation → mystery → "You see," pivot → ironic payoff.
2. Voice: ElevenLabs TTS → voice.wav + words.json.
3. Story/timeline: story.ts → export_timeline.mjs → timeline.json.
4. Sets & characters (sets.ts, rig25d).
5. Stills: render.mjs renders one midpoint still per shot for review.
6. Audio mix: mix.py → mix.wav.
7. Render: fault-tolerant per-shot render, xfade stitching, mux audio.
8. QA: short_qa.py report; sbs_sheet.py side-by-side sheets.
- Runs on Desktop, Linux and Android/Termux. Headless Linux fix: pin @react-three/postprocessing 3.0.4 and use swangle for WebGL.

## Style bible (measured study of 20 reference shorts)
- Vertical 1080x1920, 30 fps, median ~60 s; voice starts at frame 1–4; no intro/outro/CTA.
- Narrator 3.5–4.1 words/s (median 3.7); loudness target ~−14 LUFS.
- 2D flat characters in 3D toon environments with ink outlines, warm key + blue/purple shadows, saturated color (sat 0.38–0.65).
- Camera holds ~80% of frames; moves are ease-out bursts; hard cuts almost never; place changes via 6–8 frame dissolves.

## Stack
- Remotion 4.0.543, React 19, three 0.187, @react-three/fiber 9, postprocessing 6.39, TypeScript 5.9; Python audio tools.

## History (git)
- Initial commit → studio upload → shorts-studio project + skill (PR #2) → headless WebGL fix, midpoint stills, shot reframes, ElevenLabs voice script →
  QA fixes for shots 5/10/12 and final render (PR #3) → ElevenLabs voiceover + audio remix (PR #4) → ppt-master skill added.
