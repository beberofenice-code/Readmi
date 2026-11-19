# Shorts-Studio Cinema Style Bible
*(Built on quantitative study of 20 top-performing 3D/stickman explainer shorts + Cinema Upgrade production standards)*

## Format & Pacing
- Vertical **1080x1920**, **30 fps**, **55–65 s** target length (acceptable window 50–70 s). Action and sound start on **frame 1** (zero intro logos, zero outro cards, zero CTAs).
- **Voiceover:** Brisk, punchy delivery at **165–180 WPM** (~2.75–3.0 words/s natural or up to 3.7 words/s energetic), dead-air and long breaths trimmed automatically (`--max-pause 0.18`s) so pacing never drags.
- **4-Track Audio Mix:** Mastered to **-14.5 LUFS** integrated, **-1.2 dBTP** true-peak ceiling, 48 kHz stereo:
  1. Narrator VO lead.
  2. Character dialogue inserts with optional FX (e.g., telephone bandpass EQ `highpass=f=300,lowpass=f=3000` for `[SPEAKER:phone]`).
  3. Dynamic background music bed ducked **-16 to -20 dB** (default `-18 dB`) under active VO with mood shifts (`mischievous_groove` -> `driving_escalation` -> `tense_rainy` -> `silence_drop` -> `resolve_chord`).
  4. Frame-accurate foley & SFX (`sfxEvents` backed by `assets/sfx/manifest.json`) + exterior/muffled-cabin rain ambience + rhythmic windshield wipers.
- **Punchy Viral Subtitles (Enabled by default when `words.json` exists):**
  - Bold rounded white sans-serif with thick crisp black stroke (`paint-order: stroke fill`, `14px #09090b`) and subtle drop shadow.
  - Centered in the lower third (**75–80% vertical height**, default `77%`, safely clear of YouTube Shorts / Reels bottom buttons and right-rail icons).
  - **1–3 words at a time** (`chunkWordsForSubtitles()`), word-level synced, fast subtle scale pop-in (`0.92 -> 1.0` over 3–4 frames), strictly single-line (never multi-line walls of text).

## Viral Hook & 5-Beat Retention Script Formula
1. **0:00–0:03 Action-First Cold Open (Mandatory):** Drop the viewer directly into physical motion and loud foley on frame 1 (brake slam, metallic crunch, heist grab, mistake). **Strictly ban** weak intros (`"Have you ever wondered..."`, `"In today's video..."`, `"Did you know..."`).
2. **Hidden-Subject Curiosity Loop:** Never name the final invention, twist, or punchline in the opening hook. Frame around a vivid human conflict (e.g., an unfair scammer winning repeatedly) and withhold the reveal word until the final 2–3 seconds.
3. **0:03–0:15 Setup:** Present-tense concrete setting, named everyman or clear archetype, showing immediately why the scheme/situation works and the tangible reward.
4. **0:15–0:32 Rule-of-3 Escalation:** Escalate visually across 3 beats (bigger targets, accomplice/twist, greedier upgrade) accompanied by a **time-of-day lighting shift** (`daylight_crisp` -> `sunset_glow` -> `night_spotlight`) and driving music escalation.
5. **0:32–0:42 Comic Dialogue Breather + Visual Micro-Gag:** Insert a rapid 2-line character exchange (`[SPEAKER:phone]` bandpass EQ) paired with a background visual gag (animated flip-counter, absurd desk prop, exaggerated expression swap).
6. **0:42–0:62 Atmospheric Mood Shift -> Calm Underdog Reversal -> Payoff Reveal:** Shift weather/lighting (`rainy_overcast` with diagonal rain + glossy wet asphalt reflections + windshield wipers), present the calm reversal, show proof via a diegetic POV shot (`device_pov_hud` + `<DiegeticHUD>`), and land the crisp 1-sentence reveal right on the final beat.
- Sentences stay short (~10–14 words), plain spoken English, contractions, zero unexplained jargon; every sentence is illustrated literally by props and expressions.

## Visual Art Direction & 4 Lighting Presets
- **2D-on-3D Expressive Characters (`HeroRig25D` + `toon.ts`):** Crisp bold black outlines (`#140e17`), thin capsule stick limbs, distinct clothing accents (`collar`, `tie`, `vest`, `apron`), swappable 3D accessories (`shades`, `hat`, `coffeeCup`, `phone`), rapid frame-driven emotion swaps (`smug`, `panicked`, `fake_pain`, `shocked_sweat`, `deadpan`, `annoyed`, `triumphant`), and comedic accents (animated sweat drops, radial motion lines).
- **Stylized 3D Environments:** Hand-painted HD textures (`asphaltHD`, `grassBladesHD`, `dashboardClusterTex`, `interiorTrimTex`, `skylineTex`, `cashBillTex`), thin black ink outlines on 3D geometry (`InkPass`), soft DOF on backgrounds (`LensBlur`), warm key light + cool blue/purple shadows, and active micro-gag particle systems (`createCashExplosion`, `createCrashDebrisSparks`, `createFlipCounterProp`, `createBlinkingDeviceLED`).
- **4 Reusable Time-of-Day & Weather Lighting Presets (`core/lights.ts`):**
  1. `daylight_crisp` — Cobalt blue sky dome, stylized clouds, sharp sunlight + soft ground shadows, vibrant saturated materials.
  2. `sunset_glow` — Indigo-to-peach twilight sky, warm low-angle rim light, emissive glowing headlights/taillights with bloom.
  3. `night_spotlight` — Dark blue night sky with dramatic warm overhead key spotlights (`createOverheadSpotlight`) and high contrast.
  4. `rainy_overcast` — Moody slate/teal overcast sky, animated diagonal rain streaks, glossy wet asphalt mirroring emissive taillights, optional animated windshield wiper sweeps.
- **Measured Color Targets:** Luma mean `0.43–0.54`, luma std `0.21–0.29`, `p2` `0.03–0.11` (rich darks), `p98` `0.90–1.0`, saturation `0.38–0.65`.

## Dynamic Camera Choreography & Pacing
- **Cut Cadence:** Cut or shift camera angle every **2.0–3.5 seconds** (roughly **18–25 distinct shots** per 60-second short). Use 6–8 frame `xfade` dissolves between major location/time-of-day shifts and clean cuts or ease-out camera moves within a set.
- **Zero Frozen Cameras:** Every single shot MUST maintain intentional subtle motion — slow push-in (`pushK`), lateral tracking (`dolly`), subtle `handheldDrift`, or impact `dampedSpringShake` — eliminating flat, static wide shots.
- **12 Reusable Camera Rig Presets (`core/camera.ts`):**
  `hood_windshield`, `interior_dash_pov`, `tight_impact_shake`, `low_ground_wide`, `low_bumper_track`, `high_tactical_three_quarter`, `low_hero_tilt`, `sitcom_desk_medium`, `overpass_push_in`, `passenger_cabin_reveal`, `device_pov_hud`, `reverse_cabin_reveal`.

## Effects & Diegetic Overlays
- **2D/3D FX (`core/environment.ts`, `NOINK` layer 3):** Falling/exploding cash bills, crash debris sparks, diagonal rain streaks, overhead spotlight cones, wet asphalt reflection streaks, blinking red/green device LEDs, animated sweat drops, and radial motion lines.
- **Diegetic HUD (`<DiegeticHUD>`):** Toggleable per shot for in-world cameras (`● REC` blinking dot, live date/timestamp, live speed readout, `FRONT 1080P` label, optional fisheye vignette).
