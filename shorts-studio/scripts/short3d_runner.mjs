#!/usr/bin/env node
// One-command orchestrator for the /short3d slash command across Desktop, Linux, and Android/Termux.
// Usage:
//   node scripts/short3d_runner.mjs --slug dashcam --comp DashcamShort [--stage all|timeline|voice|stills|audio|render|qa|refs|flow-plan|flow-check|flow-status] [--scale 0.5] [--no-captions] [--shot 1,12]
// Google Flow = style-locked-flow ONLY (text-to-video / flow-all is removed). Flow stages are never part of `all`:
//   refs:        Stage A - clean Three.js Start (+ End when the shot moves) keyframes -> assets/flow_refs/shot_XX_start/end.png
//   flow-plan:   Stage B+C - Frames-mode image-to-video requests, prompts wrapped in STYLE_LOCK_PROMPT -> out/<slug>/flow_plan.json
//                (blocks shots with missing keyframes or motion text asking for text/signs/HUD/restyle/camera changes)
//   flow-check:  morph gate on downloaded clips vs our keyframes + contact sheets; failures fall back to Three.js
//                (--reject 7:morph / --accept 7 to override; stored in assets/flow_clips/flow_reject.json)
//   flow-status: list Flow shots, auto Three.js fallbacks, rejects, clip present/missing, and seconds each needs
//   render:      add --allow-missing-flow to render "FLOW CLIP PENDING" slates for clips not downloaded yet
//   voice: ElevenLabs TTS from src/videos/<slug>/SCRIPT.md (needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID; add --force-voice to redo)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const slug = getArg("--slug", "dashcam");
const comp = getArg("--comp", "DashcamShort");
const stage = getArg("--stage", "all"); // all | timeline | voice | stills | audio | render | qa | refs | flow-status
const shotArg = getArg("--shot", "");
const isTermux = Boolean(process.env.TERMUX_VERSION) || process.platform === "android" || fs.existsSync("/data/data/com.termux");
const scale = getArg("--scale", isTermux ? "0.5" : "1.0");
const pyBin = "python3";

const storyTs = getArg("--story", `src/videos/${slug}/story.ts`);
const outDir = getArg("--outdir", `out/${slug}`);
const timelineJson = path.join(outDir, "timeline.json");
const stillsDir = path.join(outDir, "stills");
const qaDir = path.join(outDir, "qa");
const voiceWav = getArg("--voice", `voice/${slug}/voice.wav`);
const wordsJson = getArg("--words", `voice/${slug}/words.json`);
const scriptMd = getArg("--script", `src/videos/${slug}/SCRIPT.md`);
const mixWav = getArg("--mix", `audio/${slug}_mix.wav`);
const finalMp4 = getArg("--out", path.join(outDir, "final-short.mp4"));
const noCaptions = args.includes("--no-captions");

function step(label, cmd, cmdArgs) {
  console.log(`\n==================== [short3d: ${label}] ====================`);
  console.log(`$ ${cmd} ${cmdArgs.join(" ")}`);
  execFileSync(cmd, cmdArgs, { stdio: "inherit" });
}

function captionArgs() {
  if (noCaptions || !fs.existsSync(wordsJson)) return [];
  return ["--captions", "--words", wordsJson];
}

// Google Flow hand-off folders (Stage A Three.js keyframes in, downloaded Flow takes + flow_reject.json back)
for (const d of ["assets/flow_refs", "assets/flow_clips"]) fs.mkdirSync(d, { recursive: true });

const flowStages = new Set(["refs", "flow-plan", "flow-check", "flow-status"]);
if (stage === "all" || stage === "timeline" || flowStages.has(stage)) {
  step("Export Master Timeline", "node", ["scripts/export_timeline.mjs", storyTs, timelineJson]);
}

if (stage === "voice" || stage === "all") {
  const haveVoice = fs.existsSync(voiceWav) && !args.includes("--force-voice");
  if (haveVoice) {
    console.log(`\n[short3d] Voice: keeping existing ${voiceWav} (--force-voice to regenerate).`);
  } else if (!process.env.ELEVENLABS_API_KEY) {
    const msg = "[short3d] Voice: ELEVENLABS_API_KEY not set; skipping TTS (audio stage will mix score + foley only).";
    if (stage === "voice") { console.error(msg); process.exit(1); }
    console.log("\n" + msg);
  } else {
    step("ElevenLabs Voiceover + Word Timings", pyBin, [
      "scripts/elevenlabs_tts.py",
      "--script", scriptMd,
      "--out-dir", path.dirname(voiceWav),
      ...(args.includes("--force-voice") ? ["--force"] : []),
    ]);
  }
}

if (stage === "all" || stage === "stills") {
  step("Render Midpoint Stills Gate", "node", [
    "scripts/render.mjs", "stills",
    "--comp", comp,
    "--timeline", timelineJson,
    "--out", stillsDir,
    ...captionArgs(),
    ...(shotArg ? ["--shot", shotArg] : []),
  ]);
}

if (stage === "refs") {
  step("Render Three.js Keyframes for Google Flow", "node", [
    "scripts/render.mjs", "refs",
    "--comp", comp,
    "--timeline", timelineJson,
    ...(shotArg ? ["--shot", shotArg] : []),
  ]);
}

if (stage === "flow-plan") {
  step("Style-Locked Flow Plan (Frames mode + style-lock prompt)", "node", [
    "scripts/render.mjs", "flow-plan",
    "--timeline", timelineJson,
    "--out", path.join(outDir, "flow_plan.json"),
    ...(shotArg ? ["--shot", shotArg] : []),
  ]);
}

if (stage === "flow-check") {
  step("Flow Morph Gate (keep clean Three.js on failure)", "node", [
    "scripts/render.mjs", "flow-check",
    "--timeline", timelineJson,
    "--out", path.join(outDir, "flow_check"),
    ...(shotArg ? ["--shot", shotArg] : []),
    ...(getArg("--accept", "") ? ["--accept", getArg("--accept", "")] : []),
    ...(getArg("--reject", "") ? ["--reject", getArg("--reject", "")] : []),
  ]);
}

if (stage === "flow-status") {
  step("Google Flow Clip Status", "node", ["scripts/render.mjs", "flow-status", "--timeline", timelineJson]);
}

if (stage === "all" || stage === "audio") {
  step("Generate Procedural SFX Manifest & Mix 4-Track Audio", pyBin, [
    "audio/mix.py",
    "--timeline", timelineJson,
    "--voice", voiceWav,
    "--words", wordsJson,
    "--out", mixWav,
  ]);
}

if (stage === "all" || stage === "render") {
  const extra = [
    ...(args.includes("--force") ? ["--force"] : []),
    ...(args.includes("--allow-missing-flow") ? ["--allow-missing-flow"] : []),
    ...captionArgs(),
    ...(shotArg ? ["--shot", shotArg] : []),
  ];
  step("Resumable Per-Shot Render & FFmpeg Stitch", "node", [
    "scripts/render.mjs", "render-shots",
    "--comp", comp,
    "--timeline", timelineJson,
    "--audio", mixWav,
    "--scale", scale,
    "--out", finalMp4,
    ...extra,
  ]);

  // On Termux/Android, mirror finished MP4 to ~/storage/downloads if accessible
  const dlDir = path.join(process.env.HOME || "", "storage/downloads");
  if (isTermux && fs.existsSync(dlDir) && fs.existsSync(finalMp4)) {
    const dest = path.join(dlDir, `${slug}-final-short.mp4`);
    fs.copyFileSync(finalMp4, dest);
    console.log(`[short3d] Copied final video to Android Downloads -> ${dest}`);
  }
}

if (stage === "all" || stage === "qa") {
  step("Frame-by-Frame 30fps Cinema QA & Contact Sheets", pyBin, [
    "scripts/short_qa.py",
    finalMp4,
    qaDir,
    timelineJson,
    ...(fs.existsSync(wordsJson) ? ["--words", wordsJson] : []),
  ]);
}

console.log(`\n[short3d] Pipeline stage '${stage}' completed -> ${finalMp4}`);
