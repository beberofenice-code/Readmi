#!/usr/bin/env node
// Cross-platform Remotion runner (Windows / macOS / Linux / Android Termux).
// Features:
//  1. Bundles Webpack ONCE into ./.remotion-bundle (reused across stills and all shot renders; zero temp-drive bloat).
//  2. Auto-detects Chrome/Chromium binary & selects `angle` on desktop vs `swangle --concurrency=1` on Termux/headless ARM.
//  3. Renders individual shots with +xfade handles so any tweak re-renders in seconds, then stitches via FFmpeg xfade + audio mux.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, renderMedia, selectComposition } from "@remotion/renderer";

const args = process.argv.slice(2);
const mode = args[0] || "help"; // "bundle" | "stills" | "render-shots"
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const entry = getArg("--entry", "src/index.ts");
const compId = getArg("--comp", "DashcamShort");
const bundleDir = path.resolve(getArg("--bundle-dir", ".remotion-bundle"));
const timelinePath = getArg("--timeline", "out/dashcam/timeline.json");
const audioPath = getArg("--audio", "");
const outPath = getArg("--out", "out/dashcam/final-short.mp4");
const scale = Number(getArg("--scale", process.platform === "android" ? "0.5" : "1.0"));

function detectEnv() {
  const isTermux = Boolean(process.env.TERMUX_VERSION) || process.platform === "android" || fs.existsSync("/data/data/com.termux");
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    "/data/data/com.termux/files/usr/bin/chromium-browser",
    "/data/data/com.termux/files/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].filter(Boolean);
  const browserExecutable = candidates.find((p) => fs.existsSync(p)) || undefined;
  // Headless Linux (CI, cloud containers) has no GPU/display, so ANGLE cannot create a WebGL context there.
  const headlessLinux = process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
  const gl = getArg("--gl", process.env.REMOTION_GL || (isTermux || headlessLinux || process.arch === "arm64" && process.platform === "linux" ? "swangle" : "angle"));
  const concurrency = Number(getArg("--concurrency", gl === "swangle" ? "1" : String(Math.max(1, Math.min(4, os.cpus().length >> 1)))));
  return { browserExecutable, gl, concurrency, isTermux };
}

async function ensureBundle(force = false) {
  if (!force && fs.existsSync(path.join(bundleDir, "index.html"))) {
    console.log(`[render] Reusing cached bundle at ${bundleDir}`);
    return bundleDir;
  }
  console.log(`[render] Bundling ${entry} -> ${bundleDir} ...`);
  const loc = await bundle({
    entryPoint: path.resolve(entry),
    publicDir: fs.existsSync("public") ? path.resolve("public") : null,
    outDir: bundleDir,
  });
  return loc;
}

async function run() {
  if (mode === "help") {
    console.log("Usage:\n  node scripts/render.mjs stills --comp DashcamShort --out out/dashcam/stills\n  node scripts/render.mjs render-shots --comp DashcamShort --timeline out/dashcam/timeline.json --audio audio/mix.wav --out out/dashcam/final-short.mp4");
    return;
  }

  const env = detectEnv();
  console.log(`[render] Platform=${process.platform}/${process.arch} | GL=${env.gl} | concurrency=${env.concurrency} | scale=${scale}`);
  const serveUrl = await ensureBundle(mode === "bundle" || args.includes("--rebundle"));
  if (mode === "bundle") return;

  const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
  const chromiumOptions = { gl: env.gl };
  const composition = await selectComposition({
    serveUrl,
    id: compId,
    browserExecutable: env.browserExecutable,
    chromiumOptions,
  });

  if (mode === "stills") {
    fs.mkdirSync(outPath, { recursive: true });
    for (const s of tl.shots) {
      const mid = Math.floor((s.a + s.b) / 2);
      const file = path.join(outPath, `shot_${String(s.id).padStart(2, "0")}_f${mid}.jpg`);
      await renderStill({
        composition,
        serveUrl,
        frame: mid,
        scale: 0.5,
        imageFormat: "jpeg",
        jpegQuality: 88,
        output: file,
        inputProps: { shotId: s.id },
        browserExecutable: env.browserExecutable,
        chromiumOptions,
      });
      console.log(`[stills] Rendered Shot ${s.id} (f=${mid}) -> ${file}`);
    }
    return;
  }

  if (mode === "render-shots") {
    const chunksDir = path.join(path.dirname(outPath), "chunks");
    fs.mkdirSync(chunksDir, { recursive: true });
    const chunkFiles = [];

    for (let i = 0; i < tl.shots.length; i++) {
      const s = tl.shots[i];
      const nextXfade = tl.shots[i + 1]?.xfade ?? 0;
      const startFrame = s.a;
      const endFrame = Math.min(tl.total_frames - 1, s.b - 1 + nextXfade);
      const chunkFile = path.join(chunksDir, `shot_${String(s.id).padStart(2, "0")}.mp4`);
      chunkFiles.push({ file: chunkFile, shot: s, durFrames: endFrame - startFrame + 1, nextXfade });

      if (fs.existsSync(chunkFile) && !args.includes("--force")) {
        console.log(`[render-shots] Skipping cached Shot ${s.id} (${chunkFile})`);
        continue;
      }

      console.log(`[render-shots] Rendering Shot ${s.id}: frames ${startFrame}..${endFrame} ...`);
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: 16,
        scale,
        frameRange: [startFrame, endFrame],
        concurrency: env.concurrency,
        outputLocation: chunkFile,
        inputProps: { shotId: s.id },
        browserExecutable: env.browserExecutable,
        chromiumOptions,
      });
    }

    // Stitch chunks via FFmpeg xfade / concat + mux audio
    stitchChunks(chunkFiles, tl.fps, audioPath, outPath);
  }
}

function stitchChunks(chunks, fps, audioFile, finalOut) {
  fs.mkdirSync(path.dirname(finalOut), { recursive: true });
  const inputs = [];
  chunks.forEach((c) => inputs.push("-i", c.file));

  let filter = "";
  let prevLabel = "[0:v]";
  let cumulativeFrames = chunks[0].durFrames;

  for (let i = 1; i < chunks.length; i++) {
    const xf = chunks[i].shot.xfade || 0;
    const outLabel = `[v${i}]`;
    if (xf > 0) {
      const offsetSec = ((cumulativeFrames - xf) / fps).toFixed(4);
      const durSec = (xf / fps).toFixed(4);
      filter += `${prevLabel}[${i}:v]xfade=transition=fade:duration=${durSec}:offset=${offsetSec}${outLabel};`;
      cumulativeFrames = cumulativeFrames - xf + chunks[i].durFrames;
    } else {
      const offsetSec = (cumulativeFrames / fps).toFixed(4);
      filter += `${prevLabel}[${i}:v]xfade=transition=fade:duration=0.001:offset=${offsetSec}${outLabel};`;
      cumulativeFrames += chunks[i].durFrames;
    }
    prevLabel = outLabel;
  }

  const ffArgs = ["-y", ...inputs];
  if (audioFile && fs.existsSync(audioFile)) ffArgs.push("-i", audioFile);

  if (chunks.length > 1) {
    ffArgs.push("-filter_complex", filter.slice(0, -1), "-map", prevLabel);
  } else {
    ffArgs.push("-map", "0:v:0");
  }

  if (audioFile && fs.existsSync(audioFile)) {
    ffArgs.push("-map", `${chunks.length}:a:0`, "-c:a", "aac", "-b:a", "192k", "-shortest");
  } else {
    ffArgs.push("-an");
  }

  ffArgs.push("-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", finalOut);
  console.log(`[stitch] Running FFmpeg stitch -> ${finalOut}`);
  execFileSync("ffmpeg", ffArgs, { stdio: "inherit" });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
