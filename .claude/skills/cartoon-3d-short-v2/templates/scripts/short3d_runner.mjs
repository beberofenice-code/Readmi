#!/usr/bin/env node
// One-command orchestrator for the /short3d slash command across Desktop, Linux, and Android/Termux.
// Usage:
//   node scripts/short3d_runner.mjs --slug dashcam --comp DashcamShort [--stage all|timeline|voice|stills|audio|render|qa] [--scale 0.5]
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
const stage = getArg("--stage", "all"); // all | timeline | voice | stills | audio | render | qa
const isTermux = Boolean(process.env.TERMUX_VERSION) || process.platform === "android" || fs.existsSync("/data/data/com.termux");
const scale = getArg("--scale", isTermux ? "0.5" : "1.0");
const pyBin = fs.existsSync("/data/data/com.termux/files/usr/bin/python3") ? "python3" : "python3";

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

function step(label, cmd, cmdArgs) {
  console.log(`\n==================== [short3d: ${label}] ====================`);
  console.log(`$ ${cmd} ${cmdArgs.join(" ")}`);
  execFileSync(cmd, cmdArgs, { stdio: "inherit" });
}

if (stage === "all" || stage === "timeline") {
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
  ]);
}

if (stage === "all" || stage === "audio") {
  step("Synthesize & Master BS.1770-4 Audio", pyBin, [
    "audio/mix.py",
    "--timeline", timelineJson,
    "--voice", voiceWav,
    "--words", wordsJson,
    "--out", mixWav,
  ]);
}

if (stage === "all" || stage === "render") {
  const extra = args.includes("--force") ? ["--force"] : [];
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
  step("Frame-by-Frame 30fps QA & Contact Sheets", pyBin, [
    "scripts/short_qa.py",
    finalMp4,
    qaDir,
    timelineJson,
  ]);
}

console.log(`\n[short3d] Pipeline stage '${stage}' completed -> ${finalMp4}`);
