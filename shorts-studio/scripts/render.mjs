#!/usr/bin/env node
// Cross-platform Remotion runner (Windows / macOS / Linux / Android Termux).
// Features:
//  1. Bundles Webpack ONCE into ./.remotion-bundle (reused across stills and all shot renders; zero temp-drive bloat).
//  2. Auto-detects Chrome/Chromium binary & selects `angle` on desktop vs `swangle --concurrency=1` on Termux/headless ARM.
//  3. Resumable per-shot rendering with +xfade handles so any tweak re-renders in seconds, then stitches via FFmpeg xfade + audio mux.
//  4. Supports `--captions`, `--words <words.json>`, and `--shot <id[,id]>` for fast targeted verification renders.
//  5. Google Flow mixing: shots with `source: "flow_clip"` play assets/flow_clips/shot_XX.mp4, conformed here by FFmpeg
//     (1080x1920 cover/contain, 30 fps CFR, exact frames incl. xfade tail, audio stripped) into public/flow_clips/.
//     The bundle auto-refreshes when conformed clips change; a replaced Flow take re-renders only its own chunk.
//     `refs` renders Three.js Start/End keyframes (clean, no captions/HUD) to assets/flow_refs/ for Flow Frames mode (Stage A).
//     `flow-status` lists each Flow shot's clip/ref state and the seconds of footage it needs.
//  6. style-locked-flow (the ONLY Flow mode): `refs` (Stage A Three.js keyframes) -> `flow-plan` (Stage B Frames-mode
//     image-to-video requests, Stage C STYLE_LOCK_PROMPT-wrapped prompts) -> `flow-check` (morph gate). Rejected takes
//     (assets/flow_clips/flow_reject.json) and fast/dialogue/prop beats fall back to the clean Three.js render.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, renderMedia, selectComposition } from "@remotion/renderer";
import {
  STYLE_LOCK_PROMPT, buildFlowPrompt, lintMotion, pickDuration, loadRejects, saveRejects, REJECT_FILE,
  DEFAULT_FLOW_MODEL, STATIC_SHOT_PSNR_DB, MORPH_SSIM_START, MORPH_SSIM_END,
} from "./flow_style_lock.mjs";

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
const wordsPath = getArg("--words", "");
const captionsEnabled = args.includes("--captions");
const shotFilterRaw = getArg("--shot", "");
const shotFilter = shotFilterRaw
  ? new Set(shotFilterRaw.split(",").map((x) => Number(x.trim())).filter(Number.isFinite))
  : null;
const frameOverride = getArg("--frame", "");
const scale = Number(getArg("--scale", process.platform === "android" ? "0.5" : "1.0"));

function loadWords() {
  if (!wordsPath || !fs.existsSync(wordsPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(wordsPath, "utf8"));
  } catch (err) {
    console.warn(`[render] Warning: failed to parse ${wordsPath}: ${err.message}`);
    return undefined;
  }
}

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
  const gl = getArg("--gl", process.env.REMOTION_GL || (isTermux || headlessLinux || (process.arch === "arm64" && process.platform === "linux") ? "swangle" : "angle"));
  const concurrency = Number(getArg("--concurrency", gl === "swangle" ? "1" : String(Math.max(1, Math.min(4, os.cpus().length >> 1)))));
  return { browserExecutable, gl, concurrency, isTermux };
}

// ---------------- Google Flow clip conform ----------------
const FLOW_PUBLIC = path.join("public", "flow_clips");
const pad2 = (n) => String(n).padStart(2, "0");
const fileSig = (p) => { const st = fs.statSync(p); return `${st.size}:${Math.round(st.mtimeMs)}`; };

function probeDuration(file) {
  try {
    return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
  } catch { return NaN; }
}

/** Conform every downloaded Flow clip to the exact frames its shot (+ next xfade handle) occupies.
 *  Returns { clips: {id: "flow_clips/shot_XX.mp4"}, missing: [ids], sigs: {id: sig} }. Cached via .sig sidecars. */
function conformFlowClips(tl) {
  const res = { clips: {}, missing: [], sigs: {}, rejected: {} };
  const shots = tl.shots;
  const rejects = loadRejects();
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (s.source !== "flow_clip") continue;
    // Morphed / off-style takes never reach the cut: the shot renders from the clean Three.js scene instead.
    if (rejects[s.id]) { res.rejected[s.id] = rejects[s.id]; continue; }
    const srcClip = s.clip || `assets/flow_clips/shot_${pad2(s.id)}.mp4`;
    if (!fs.existsSync(srcClip)) { res.missing.push(s.id); continue; }
    const frames = s.b - s.a + (shots[i + 1]?.xfade ?? 0);
    const start = Number(s.clipStart ?? 0), rate = Number(s.clipRate ?? 1), fit = s.clipFit || "cover";
    const W = 1080, H = 1920;
    const sig = crypto.createHash("sha1").update(JSON.stringify([fileSig(srcClip), frames, start, rate, fit, tl.fps])).digest("hex").slice(0, 16);
    const rel = `flow_clips/shot_${pad2(s.id)}.mp4`;
    const out = path.join("public", rel);
    res.clips[String(s.id)] = rel;
    res.sigs[s.id] = sig;
    if (fs.existsSync(out) && fs.existsSync(out + ".sig") && fs.readFileSync(out + ".sig", "utf8") === sig) continue;

    const have = (probeDuration(srcClip) - start) / rate, need = frames / tl.fps;
    if (Number.isFinite(have) && have + 1e-3 < need) {
      console.warn(`[flow] Shot ${s.id}: clip gives ${have.toFixed(2)} s after clipStart/clipRate but shot needs ${need.toFixed(2)} s; ` +
        `last frame will be held (QA may flag a freeze). Lower clipStart, raise clipRate, or extend the clip in Flow.`);
    }
    const fitChain = fit === "contain"
      ? `split[bgsrc][fgsrc];[bgsrc]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:2,eq=brightness=-0.06[bg];` +
        `[fgsrc]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`
      : `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`;
    const vf = `[0:v]setpts=(PTS-STARTPTS)/${rate},${fitChain},fps=${tl.fps},tpad=stop_mode=clone:stop_duration=${Math.ceil(need) + 1},setsar=1,format=yuv420p[v]`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    console.log(`[flow] Conforming Shot ${s.id}: ${srcClip} (+${start}s, x${rate}, ${fit}) -> ${out} (${frames} frames)`);
    execFileSync("ffmpeg", [
      "-v", "error", "-y", ...(start > 0 ? ["-ss", String(start)] : []), "-i", srcClip,
      "-filter_complex", vf, "-map", "[v]", "-an", "-frames:v", String(frames),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-g", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
    ], { stdio: "inherit" });
    fs.writeFileSync(out + ".sig", sig);
  }
  return res;
}

const fmt = (x) => (Number.isFinite(x) ? x.toFixed(2) : "-");

/** Run ffmpeg and return its stderr log (where psnr/ssim print their results). */
const ffLog = (ffArgs) => String(spawnSync("ffmpeg", ["-hide_banner", "-v", "info", ...ffArgs], { encoding: "utf8" }).stderr ?? "");

/** PSNR (dB) between two same-size images; NaN if ffmpeg fails. */
function psnrOf(a, b) {
  const m = ffLog(["-i", a, "-i", b, "-lavfi", "psnr", "-f", "null", "-"]).match(/average:(inf|[\d.]+)/);
  return m ? (m[1] === "inf" ? Infinity : Number(m[1])) : NaN;
}

/** Structural SSIM (270x480 luma, so codec noise doesn't count) between frame `n` of a clip and a keyframe image.
 *  `fit` matches the conform crop (cover) so raw 9:16 / 16:9 Flow output lines up with our 1080x1920 keyframe. */
function ssimAt(clip, n, image, fit = "cover") {
  const sc = fit === "contain" ? "scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2"
    : "scale=270:480:force_original_aspect_ratio=increase,crop=270:480";
  const filt = `[0:v]select=eq(n\\,${Math.max(0, n)}),${sc},format=gray[a];[1:v]scale=270:480,format=gray[b];[a][b]ssim`;
  const m = ffLog(["-i", clip, "-i", image, "-filter_complex", filt, "-frames:v", "1", "-f", "null", "-"]).match(/All:([\d.]+)/);
  return m ? Number(m[1]) : NaN;
}

function flowBundleSig() {
  if (!fs.existsSync(FLOW_PUBLIC)) return "none";
  const files = fs.readdirSync(FLOW_PUBLIC).filter((f) => f.endsWith(".mp4")).sort();
  return crypto.createHash("sha1").update(files.map((f) => `${f}=${fileSig(path.join(FLOW_PUBLIC, f))}`).join("|")).digest("hex");
}

async function ensureBundle(force = false) {
  // Remotion copies public/ into the bundle, so new/changed Flow clips need a fresh bundle.
  const sigFile = path.join(bundleDir, ".flow_sig");
  const flowSig = flowBundleSig();
  const stale = fs.existsSync(sigFile) ? fs.readFileSync(sigFile, "utf8") !== flowSig : flowSig !== "none";
  if (stale && !force) console.log("[render] Flow clips changed since last bundle -> rebundling.");
  if (!force && !stale && fs.existsSync(path.join(bundleDir, "index.html"))) {

    console.log(`[render] Reusing cached bundle at ${bundleDir}`);
    return bundleDir;
  }
  console.log(`[render] Bundling ${entry} -> ${bundleDir} ...`);
  const loc = await bundle({
    entryPoint: path.resolve(entry),
    publicDir: fs.existsSync("public") ? path.resolve("public") : null,
    outDir: bundleDir,
  });
  fs.writeFileSync(sigFile, flowSig);
  return loc;
}

async function run() {
  if (mode === "help") {
    console.log(
      "Usage:\n" +
      "  node scripts/render.mjs stills --comp DashcamShort --timeline out/dashcam/timeline.json [--shot 1,12] [--captions --words voice/dashcam/words.json] --out out/dashcam/stills\n" +
      "  node scripts/render.mjs render-shots --comp DashcamShort --timeline out/dashcam/timeline.json --audio audio/mix.wav [--captions --words voice/dashcam/words.json] [--allow-missing-flow] --out out/dashcam/final-short.mp4\n" +
      "  node scripts/render.mjs refs --comp DashcamShort --timeline out/dashcam/timeline.json [--shot 5,9] [--out assets/flow_refs]\n" +
      "  node scripts/render.mjs flow-status --timeline out/dashcam/timeline.json\n" +
      "  node scripts/render.mjs flow-plan --timeline out/dashcam/timeline.json [--shot 5,9] --out out/dashcam/flow_plan.json\n" +
      "  node scripts/render.mjs flow-check --timeline out/dashcam/timeline.json [--shot 5,9] [--accept 5] [--reject 9:morph] --out out/dashcam/flow_check",
    );
    return;
  }

  if (mode === "flow-status") {
    const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
    const fl = tl.shots.filter((s) => s.source === "flow_clip");
    const rejects = loadRejects();
    console.log(`[flow-status] style-locked-flow | ${tl.shots.length - fl.length} Three.js shots, ${fl.length} Flow-enhanced shots`);
    for (const s of tl.shots.filter((x) => x.flowSkip)) console.log(`  shot ${pad2(s.id)}  THREEJS (auto): ${s.flowSkip}`);
    for (const s of fl) {
      const clip = s.clip || `assets/flow_clips/shot_${pad2(s.id)}.mp4`;
      const have = fs.existsSync(clip) ? `${probeDuration(clip).toFixed(2)} s` : "MISSING";
      const refs = [s.refStart, s.refEnd].filter(Boolean).map((r) => `${r}${fs.existsSync(r) ? "" : " (none)"}`).join(", ") || "-";
      const lint = lintMotion(s.flowMotion);
      const state = rejects[s.id] ? `REJECTED -> Three.js (${rejects[s.id]})` : lint.length ? `PROMPT BLOCKED: ${lint.join("; ")}` : "ok";
      console.log(`  shot ${pad2(s.id)}  set=${s.set}  needs ${tl.flow?.needs_s?.[s.id] ?? "?"} s  clip=${clip} [${have}]  refs=${refs}  ${state}`);
    }
    return;
  }

  if (mode === "flow-plan") {
    // Stage B + C: Frames-mode (start_frame [+ end_frame]) image-to-video requests with the style-lock prompt.
    // Never text-only, never Ingredients-only. Feed `items` to google_flow_mcp flow_generate_video / flow_batch_generate
    // ONLY after the user approved the keyframes (APPROVAL GATE).
    const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
    const rejects = loadRejects();
    const pick = tl.shots.filter((s) => s.source === "flow_clip" && (!shotFilter || shotFilter.has(s.id)));
    const items = [], blocked = [];
    for (const s of pick) {
      const problems = lintMotion(s.flowMotion);
      if (!s.refStart || !fs.existsSync(s.refStart)) problems.push(`Stage A missing: ${s.refStart} (run --stage refs first)`);
      if (rejects[s.id] && !(shotFilter && shotFilter.has(s.id))) problems.push(`take rejected (${rejects[s.id]}); pass --shot ${s.id} to retry`);
      if (problems.length) { blocked.push({ id: s.id, problems }); continue; }
      const end = s.flowEnd !== false && s.refEnd && fs.existsSync(s.refEnd) ? path.resolve(s.refEnd) : undefined;
      items.push({
        shot: s.id,
        prompt: buildFlowPrompt(s.flowMotion),
        start_frame: path.resolve(s.refStart),
        ...(end ? { end_frame: end } : {}),
        aspect_ratio: "9:16",
        model: s.flowModel || DEFAULT_FLOW_MODEL,
        duration: pickDuration(tl.flow?.needs_s?.[s.id] ?? (s.b - s.a) / tl.fps),
        save_as: s.clip || `assets/flow_clips/shot_${pad2(s.id)}.mp4`,
      });
    }
    const planOut = args.includes("--out") ? outPath : path.join(path.dirname(timelinePath), "flow_plan.json");
    fs.mkdirSync(path.dirname(planOut), { recursive: true });
    fs.writeFileSync(planOut, JSON.stringify({ mode: "style-locked-flow", flow_mode: "Frames", style_lock: STYLE_LOCK_PROMPT, items, blocked }, null, 2));
    for (const it of items) console.log(`[flow-plan] shot ${pad2(it.shot)} Frames ${it.end_frame ? "start+end" : "start"} | ${it.model} ${it.duration}s`);
    for (const b of blocked) console.warn(`[flow-plan] shot ${pad2(b.id)} BLOCKED: ${b.problems.join("; ")}`);
    console.log(`[flow-plan] ${items.length} request(s) -> ${planOut}. APPROVAL GATE: show the keyframes + credit estimate and wait for a go-ahead.`);
    if (blocked.length && !items.length) process.exitCode = 2;
    return;
  }

  if (mode === "flow-check") {
    // Morph gate: compare each conformed Flow clip against our own Three.js keyframes. A take whose first frame isn't
    // our start keyframe (restyled / realistic / reframed) or whose last used frame drifts far from the end keyframe is
    // rejected automatically -> that shot renders from the clean Three.js scene. Contact sheets are written for a
    // visual pass too (face/limb morphs can slip past SSIM: reject those with --reject <id>:<reason>).
    const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
    const rejects = loadRejects();
    for (const a of getArg("--accept", "").split(",").filter(Boolean)) delete rejects[Number(a)];
    for (const r of getArg("--reject", "").split(",").filter(Boolean)) {
      const [id, ...why] = r.split(":");
      rejects[Number(id)] = `manual: ${why.join(":") || "morph"}`;
    }
    saveRejects(rejects);
    const checkDir = args.includes("--out") ? outPath : path.join(path.dirname(timelinePath), "flow_check");
    fs.mkdirSync(checkDir, { recursive: true });
    const accepted = new Set(getArg("--accept", "").split(",").filter(Boolean).map(Number));
    const conformed = conformFlowClips(tl);
    for (const s of tl.shots.filter((x) => x.source === "flow_clip" && (!shotFilter || shotFilter.has(x.id)))) {
      const clip = conformed.clips[String(s.id)];
      if (!clip) { console.log(`[flow-check] shot ${pad2(s.id)}: ${rejects[s.id] ? `rejected (${rejects[s.id]})` : "no clip yet"}`); continue; }
      const file = path.join("public", clip);
      const frames = s.b - s.a;
      const sheet = path.join(checkDir, `shot_${pad2(s.id)}_sheet.jpg`);
      try {
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf",
          `select=not(mod(n\\,${Math.max(1, Math.floor(frames / 6))})),scale=360:640,tile=6x1`, "-frames:v", "1", sheet]);
      } catch { /* sheet is a convenience */ }
      // Frames mode starts ON our keyframe, so check the raw take's frame 0 (before clipStart/clipRate trimming).
      const rawClip = s.clip || `assets/flow_clips/shot_${pad2(s.id)}.mp4`;
      const startSsim = s.refStart && fs.existsSync(s.refStart) ? ssimAt(rawClip, 0, s.refStart, s.clipFit) : NaN;
      const endSsim = s.flowEnd !== false && s.refEnd && fs.existsSync(s.refEnd) ? ssimAt(file, frames - 1, s.refEnd) : NaN;
      const bad = [];
      if (Number.isFinite(startSsim) && startSsim < MORPH_SSIM_START) bad.push(`start SSIM ${startSsim.toFixed(2)} < ${MORPH_SSIM_START}`);
      if (Number.isFinite(endSsim) && endSsim < MORPH_SSIM_END) bad.push(`end SSIM ${endSsim.toFixed(2)} < ${MORPH_SSIM_END}`);
      if (bad.length && !accepted.has(s.id)) rejects[s.id] = `auto: ${bad.join(", ")}`;
      console.log(`[flow-check] shot ${pad2(s.id)}: start=${fmt(startSsim)} end=${fmt(endSsim)} -> ${rejects[s.id] ? `REJECTED, Three.js fallback (${rejects[s.id]})` : "kept"} | sheet ${sheet}`);
    }
    saveRejects(rejects);
    console.log(`[flow-check] Rejections live in ${REJECT_FILE}. Look at every sheet: any face/limb morph -> --reject <id>:morph.`);
    return;
  }

  const env = detectEnv();
  const words = loadWords();
  const sharedProps = {
    ...(captionsEnabled ? { captions: true } : {}),
    ...(words ? { words } : {}),
  };
  console.log(
    `[render] Platform=${process.platform}/${process.arch} | GL=${env.gl} | concurrency=${env.concurrency} | scale=${scale}` +
    (captionsEnabled ? ` | captions=ON (${words?.length ?? 0} words)` : ""),
  );
  if (mode === "bundle") { await ensureBundle(true); return; }

  const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
  // Conform Flow clips BEFORE bundling so public/flow_clips is current inside the bundle.
  const flow = mode === "refs" ? { clips: {}, missing: [], sigs: {}, rejected: {} } : conformFlowClips(tl);
  // The composition plays a Flow clip ONLY for ids in flowClips (or flowPending slates); every other shot,
  // including rejected / skipped Flow takes, renders from the clean Three.js scene.
  if (Object.keys(flow.clips).length) sharedProps.flowClips = flow.clips;
  for (const [id, why] of Object.entries(flow.rejected)) console.warn(`[flow] Shot ${id}: take rejected (${why}) -> clean Three.js render.`);
  if (flow.missing.length) {
    const msg = `[flow] Missing Flow clip(s) for shot(s) ${flow.missing.join(",")} (expected in assets/flow_clips/).`;
    if (mode === "render-shots" && !args.includes("--allow-missing-flow")) {
      const needed = shotFilter ? flow.missing.filter((id) => shotFilter.has(id)) : flow.missing;
      if (needed.length) throw new Error(`${msg} Download them first, or pass --allow-missing-flow to render "PENDING" slates.`);
    }
    if (mode === "render-shots") {
      console.warn(`${msg} Rendering PENDING slates for them.`);
      sharedProps.flowPending = flow.missing;
    } else {
      console.warn(`${msg} Stills show the Three.js keyframe scene for them.`);
    }
  }
  const serveUrl = await ensureBundle(args.includes("--rebundle"));
  const chromiumOptions = { gl: env.gl };
  const composition = await selectComposition({
    serveUrl,
    id: compId,
    inputProps: sharedProps,
    browserExecutable: env.browserExecutable,
    chromiumOptions,
  });

  if (mode === "stills") {
    fs.mkdirSync(outPath, { recursive: true });
    const selectedShots = shotFilter ? tl.shots.filter((s) => shotFilter.has(s.id)) : tl.shots;
    for (const s of selectedShots) {
      const mid = frameOverride !== "" ? Number(frameOverride) : Math.floor((s.a + s.b) / 2);
      const file = path.join(outPath, `shot_${String(s.id).padStart(2, "0")}_f${mid}.jpg`);
      await renderStill({
        composition,
        serveUrl,
        frame: mid,
        scale: 0.5,
        imageFormat: "jpeg",
        jpegQuality: 88,
        output: file,
        inputProps: { ...sharedProps, shotId: s.id },
        browserExecutable: env.browserExecutable,
        chromiumOptions,
      });
      console.log(`[stills] Rendered Shot ${s.id} (f=${mid}) -> ${file}`);
    }
    return;
  }

  if (mode === "refs") {
    // Clean full-res keyframes of each Flow shot's Three.js set -> Stage A Start (+End) Frames for Google Flow (Frames mode only).
    const refsDir = args.includes("--out") ? outPath : "assets/flow_refs";
    fs.mkdirSync(refsDir, { recursive: true });
    const pick = tl.shots.filter((s) => (shotFilter ? shotFilter.has(s.id) : s.source === "flow_clip"));
    for (const s of pick) {
      if (s.set === "flow") throw new Error(`[refs] Shot ${s.id} has set "flow": text-to-video is removed; give it a Three.js set.`);
      const files = {};
      for (const [tag, frame] of [["start", s.a], ["end", s.b - 1]]) {
        const file = path.join(refsDir, `shot_${pad2(s.id)}_${tag}.png`);
        if (tag === "end" && s.flowEnd === false) { fs.rmSync(file, { force: true }); continue; }
        await renderStill({
          composition, serveUrl, frame, scale: 1, imageFormat: "png", output: file,
          inputProps: { shotId: s.id, forceThree: true, noOverlay: true },
          browserExecutable: env.browserExecutable, chromiumOptions,
        });
        files[tag] = file;
        console.log(`[refs] Shot ${s.id} ${tag} (f=${frame}) -> ${file}`);
      }
      // End frame only when the camera/character actually moves across the shot (or flowEnd: true forces it).
      if (files.end && s.flowEnd !== true) {
        const psnr = psnrOf(files.start, files.end);
        if (Number.isFinite(psnr) && psnr >= STATIC_SHOT_PSNR_DB) {
          fs.rmSync(files.end, { force: true });
          console.log(`[refs] Shot ${s.id}: start/end nearly identical (PSNR ${psnr.toFixed(1)} dB) -> start frame only.`);
        }
      }
    }
    console.log("[refs] Stage A done. APPROVAL GATE: show these keyframes before spending any Flow video credits.");
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

      if (shotFilter && !shotFilter.has(s.id)) {
        continue;
      }
      // Flow chunks remember which conformed clip they were cut from; a replaced Flow take re-renders just that chunk.
      const flowSig = flow.sigs[s.id];
      // Three.js chunks must have no .sig, so a Flow chunk is re-rendered when its take is rejected/skipped.
      const sigOk = flowSig
        ? fs.existsSync(chunkFile + ".sig") && fs.readFileSync(chunkFile + ".sig", "utf8") === flowSig
        : !fs.existsSync(chunkFile + ".sig") && !(sharedProps.flowPending ?? []).includes(s.id);
      if (fs.existsSync(chunkFile) && sigOk && !args.includes("--force")) {
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
        inputProps: { ...sharedProps, shotId: s.id },
        browserExecutable: env.browserExecutable,
        chromiumOptions,
      });
      if (flowSig) fs.writeFileSync(chunkFile + ".sig", flowSig);
      else fs.rmSync(chunkFile + ".sig", { force: true });
    }

    if (shotFilter) {
      console.log(`[render-shots] Rendered filtered shot(s) ${[...shotFilter].join(",")} only; skipping full stitch.`);
      return;
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
  ffArgs.push(
    "-frames:v", String(frames), "-t", (frames / fps).toFixed(6), "-r", String(fps),
    "-threads", "2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", finalOut,
  );
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
