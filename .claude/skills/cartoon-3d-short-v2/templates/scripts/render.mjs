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
    stitchChunks(chunkFiles, tl.fps, audioPath, outPath, tl.total_frames);
  }
}

function stitchChunks(chunks, fps, audioFile, finalOut, totalFrames) {
  // Each chunk i holds shot i plus a tail handle of `nextXfade` frames. Consecutive hard-cut chunks (xfade === 0)
  // are coalesced via FFmpeg's concat demuxer so only (1 + #dissolves) decoders are open at once — avoiding OOM on
  // 20+ shot shorts under 8 GB VMs or Termux. Every segment is normalised (yuvj420p pc->tv, SAR, fps, timebase)
  // before xfade dissolves are applied.
  const outDir = path.dirname(finalOut);
  fs.mkdirSync(outDir, { recursive: true });

  const segments = [];
  for (const c of chunks) {
    const xf = c.shot.xfade || 0;
    if (segments.length === 0 || xf > 0) {
      segments.push({ xfade: xf, items: [c], durFrames: c.durFrames });
    } else {
      const cur = segments[segments.length - 1];
      cur.items.push(c);
      cur.durFrames += c.durFrames;
    }
  }

  const tmpLists = [];
  const inputs = [];
  segments.forEach((seg, idx) => {
    if (seg.items.length === 1) {
      inputs.push("-threads", "2", "-reinit_filter", "0", "-i", seg.items[0].file);
    } else {
      const listFile = path.join(outDir, `.concat_seg_${idx}.txt`);
      const body = seg.items.map((it) => `file '${path.resolve(it.file).replace(/'/g, "'\\''")}'`).join("\n") + "\n";
      fs.writeFileSync(listFile, body);
      tmpLists.push(listFile);
      inputs.push("-threads", "2", "-reinit_filter", "0", "-f", "concat", "-safe", "0", "-i", listFile);
    }
  });

  const parts = segments.map((_, i) => `[${i}:v]scale=in_range=pc:out_range=tv,format=yuv420p,setsar=1,settb=1/${fps},setpts=N[n${i}]`);
  let acc = "[n0]";
  let cumulativeFrames = segments[0].durFrames;
  for (let i = 1; i < segments.length; i++) {
    const xf = segments[i].xfade;
    const out = `[v${i}]`;
    parts.push(`${acc}[n${i}]xfade=transition=fade:duration=${(xf / fps).toFixed(6)}:offset=${((cumulativeFrames - xf) / fps).toFixed(6)},settb=1/${fps},setpts=N${out}`);
    cumulativeFrames += segments[i].durFrames - xf;
    acc = out;
  }
  const frames = totalFrames ?? cumulativeFrames;
  if (totalFrames && totalFrames !== cumulativeFrames) {
    console.warn(`[stitch] chunk frames sum to ${cumulativeFrames}, timeline says ${totalFrames}; trimming/padding to the timeline.`);
  }

  const ffArgs = ["-y", ...inputs];
  const withAudio = audioFile && fs.existsSync(audioFile);
  if (withAudio) ffArgs.push("-i", audioFile);
  ffArgs.push("-filter_complex", parts.join(";"), "-map", acc);
  // 256k: at 192k the AAC encode overshot a -1.2 dBTP master to 0 dBFS
  if (withAudio) ffArgs.push("-map", `${segments.length}:a:0`, "-c:a", "aac", "-b:a", "256k");
  else ffArgs.push("-an");
  ffArgs.push("-frames:v", String(frames), "-t", (frames / fps).toFixed(6), "-r", String(fps),
    "-threads", "2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", finalOut);
  console.log(`[stitch] ${chunks.length} chunks (${segments.length} segments) -> ${frames} frames (${(frames / fps).toFixed(2)} s) -> ${finalOut}`);
  try {
    execFileSync("ffmpeg", ["-v", "warning", ...ffArgs], { stdio: "inherit" });
  } finally {
    for (const f of tmpLists) fs.rmSync(f, { force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
