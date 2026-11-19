#!/usr/bin/env node
// Compiles story.ts into a single canonical timeline.json for Python 4-track audio + short_qa.py.
// Supports both legacy `EVENTS` and new `sfxEvents`, optional `camRig`, `MUSIC_CUES`/`musicCues`,
// `DIALOGUE_FX`/`dialogueFx`, and emits pacing telemetry (2.0-3.5s target rule, 18-25 shots/60s).
// Usage: node scripts/export_timeline.mjs [src/videos/dashcam/story.ts] [out/dashcam/timeline.json]
import fs from "node:fs";
import path from "node:path";
import { timelineFlowSkip } from "./flow_style_lock.mjs";

const [storyPath = "src/videos/dashcam/story.ts", outPath = "out/dashcam/timeline.json"] = process.argv.slice(2);
// Drop whole-line // comments first so commented example shots/events are never parsed as real ones.
const src = fs.readFileSync(storyPath, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

const fps = Number(src.match(/FPS\s*=\s*(\d+)/)?.[1] ?? 30);
const total = Number(src.match(/TOTAL\s*=\s*(\d+)/)?.[1] ?? 1867);
const flash = Number(src.match(/FLASH_AT\s*=\s*(-?\d+)/)?.[1] ?? -1);
// Audio profile for audio/mix.py (foley/ambience/score bank); stories without one keep the default cinema/dashcam mix
const profile = src.match(/AUDIO_PROFILE\s*=\s*"([^"]+)"/)?.[1] ?? "dashcam";

// Parse SHOTS (supports legacy lights + daylight_crisp | sunset_glow | night_spotlight | rainy_overcast + optional camRig)
const shots = [];
const shotRe = /\{\s*id:\s*(\d+),\s*a:\s*(\d+),\s*b:\s*(\w+),\s*set:\s*"([^"]+)",\s*light:\s*"([^"]+)"([^}]*)\}/g;
for (const m of src.matchAll(shotRe)) {
  const bVal = m[3] === "TOTAL" ? total : Number(m[3]);
  const xfadeMatch = m[6].match(/xfade:\s*(\d+)/);
  const hudMatch = m[6].match(/hud:\s*"([^"]+)"/);
  const rigMatch = m[6].match(/camRig:\s*"([^"]+)"/);
  // Google Flow mixing: source "threejs" (default) | "flow_clip" + clip conform options
  const str = (k) => m[6].match(new RegExp(`${k}:\\s*"([^"]+)"`))?.[1];
  const num = (k) => { const v = m[6].match(new RegExp(`${k}:\\s*(-?[\\d.]+)`))?.[1]; return v === undefined ? undefined : Number(v); };
  const bool = (k) => { const v = m[6].match(new RegExp(`${k}:\\s*(true|false)`))?.[1]; return v === undefined ? undefined : v === "true"; };
  const requested = str("source") ?? "threejs";
  const id = Number(m[1]);
  if (m[4] === "flow") {
    throw new Error(`[export_timeline] Shot ${id}: set "flow" (text-to-video / flow-all) is removed. Flow only enhances ` +
      `Three.js keyframes (style-locked-flow): give the shot its real Three.js set.`);
  }
  // Stage A..C style lock: fast 1-2 s beats and dialogue/prop beats are forced back to the clean Three.js render.
  const beat = str("beat");
  const skip = requested === "flow_clip" ? timelineFlowSkip({ a: Number(m[2]), b: bVal, beat }, fps) : null;
  const source = skip ? "threejs" : requested;
  const p2 = String(id).padStart(2, "0");
  const flowFields = source === "flow_clip"
    ? {
        clip: str("clip") ?? `assets/flow_clips/shot_${p2}.mp4`,
        clipStart: num("clipStart") ?? 0,
        clipRate: num("clipRate") ?? 1,
        clipFit: str("clipFit") ?? "cover",
        refStart: str("refStart") ?? `assets/flow_refs/shot_${p2}_start.png`,
        refEnd: str("refEnd") ?? `assets/flow_refs/shot_${p2}_end.png`, // dropped by `refs` when the shot doesn't move
        ...(bool("flowEnd") !== undefined ? { flowEnd: bool("flowEnd") } : {}),
        flowMotion: str("flowMotion") ?? "",
        ...(str("flowModel") ? { flowModel: str("flowModel") } : {}),
      }
    : {};
  shots.push({
    id,
    a: Number(m[2]),
    b: bVal,
    set: m[4],
    light: m[5],
    xfade: xfadeMatch ? Number(xfadeMatch[1]) : 0,
    hud: hudMatch ? hudMatch[1] : null,
    ...(rigMatch ? { camRig: rigMatch[1] } : {}),
    ...(beat ? { beat } : {}),
    source,
    ...(skip ? { requestedSource: requested, flowSkip: skip } : {}),
    ...flowFields,
  });
}

// Parse EVENTS / sfxEvents (supports frame-anchored or time_s-anchored events)
const events = [];
const evRe = /\{\s*(?:frame:\s*(\d+)|time_s:\s*([\d.]+))\s*,\s*type:\s*"([^"]+)"([^}]*)\}/g;
for (const m of src.matchAll(evRe)) {
  const frameVal = m[1] !== undefined ? Number(m[1]) : Math.round(Number(m[2]) * fps);
  const timeVal = m[2] !== undefined ? Number(m[2]) : Number((frameVal / fps).toFixed(4));
  const g = m[4].match(/gain:\s*([\d.]+)/);
  const p = m[4].match(/pan:\s*(-?[\d.]+)/);
  const d = m[4].match(/desc:\s*"([^"]+)"/);
  events.push({
    frame: frameVal,
    time_s: timeVal,
    type: m[3],
    gain: g ? Number(g[1]) : 1.0,
    pan: p ? Number(p[1]) : 0.0,
    desc: d ? d[1] : m[3],
  });
}

// Parse optional MUSIC_CUES / musicCues: [{ frame: 0, mood: "mischievous_groove" }, ...]
const musicCues = [];
const musicBlock = src.match(/(?:MUSIC_CUES|musicCues)[^=]*=\s*\[([\s\S]*?)\];/);
if (musicBlock) {
  const cueRe = /\{\s*(?:frame:\s*(\d+)|time_s:\s*([\d.]+))\s*,\s*mood:\s*"([^"]+)"[^}]*\}/g;
  for (const cm of musicBlock[1].matchAll(cueRe)) {
    const fVal = cm[1] !== undefined ? Number(cm[1]) : Math.round(Number(cm[2]) * fps);
    const tVal = cm[2] !== undefined ? Number(cm[2]) : Number((fVal / fps).toFixed(4));
    musicCues.push({ frame: fVal, time_s: tVal, mood: cm[3] });
  }
}

// Parse optional DIALOGUE_FX / dialogueFx: { agent: "phone", dispatcher: "radio" }
const dialogueFx = {};
const dlgBlock = src.match(/(?:DIALOGUE_FX|dialogueFx)[^=]*=\s*\{([\s\S]*?)\};/);
if (dlgBlock) {
  for (const dm of dlgBlock[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/g)) {
    dialogueFx[dm[1].toLowerCase()] = dm[2].toLowerCase();
  }
}

// Parse planned cuts & 7-frame kicks for short_qa.py
const cuts = [...src.matchAll(/\{\s*f:\s*(\d+),\s*cut:\s*true/g)].map((m) => [Number(m[1]), Number(m[1])]);
const kicks = [];
const kickBlock = src.match(/KICKS[^=]*=\s*\[([\s\S]*?)\];/);
if (kickBlock) {
  for (const km of kickBlock[1].matchAll(/\[\s*(\d+)\s*\/\s*FPS\s*,\s*([\d.]+)\s*\]/g)) {
    const f0 = Number(km[1]);
    kicks.push([f0, f0 + 8]);
  }
}

const xfade = shots
  .filter((s) => s.xfade > 0)
  // render.mjs dissolves over the incoming shot's first xfade frames (the outgoing chunk carries a tail handle)
  .map((s) => [s.a, s.a + s.xfade]);

// Compute pacing summary (considering both shot boundaries and internal camera angle cuts)
const durationS = Number((total / fps).toFixed(4));
const cutFrames = Array.from(new Set([0, ...shots.map((s) => s.a), ...cuts.map((c) => c[0]), total])).sort((a, b) => a - b);
const cutDurs = [];
for (let i = 0; i < cutFrames.length - 1; i++) {
  const d = (cutFrames[i + 1] - cutFrames[i]) / fps;
  if (d > 0.05) cutDurs.push(Number(d.toFixed(2)));
}
const effectiveCuts = Math.max(shots.length, cutDurs.length);
const pacing = {
  shot_count: shots.length,
  effective_cuts: effectiveCuts,
  cuts_per_60s: durationS > 0 ? Number(((effectiveCuts / durationS) * 60).toFixed(1)) : 0,
  avg_cut_s: cutDurs.length ? Number((cutDurs.reduce((a, b) => a + b, 0) / cutDurs.length).toFixed(2)) : 0,
  min_cut_s: cutDurs.length ? Math.min(...cutDurs) : 0,
  max_cut_s: cutDurs.length ? Math.max(...cutDurs) : 0,
  over_3_5s_count: cutDurs.filter((d) => d > 3.55).length,
  target_cut_s: [2.0, 3.5],
  target_cuts_per_60s: [18, 25],
};

const flowShots = shots.filter((s) => s.source === "flow_clip");
const flow = {
  threejs_shots: shots.length - flowShots.length,
  mode: "style-locked-flow",
  flow_shots: flowShots.map((s) => s.id),
  kept_threejs: Object.fromEntries(shots.filter((s) => s.flowSkip).map((s) => [s.id, s.flowSkip])),
  // Seconds of Flow footage each clip must cover (shot + dissolve tail handle into the next shot), after clipStart & clipRate
  needs_s: Object.fromEntries(flowShots.map((s) => {
    const next = shots[shots.indexOf(s) + 1];
    const frames = s.b - s.a + (next?.xfade ?? 0);
    return [s.id, Number(((frames / fps) * s.clipRate + s.clipStart).toFixed(2))];
  })),
};

const payload = {
  profile,
  fps,
  total_frames: total,
  duration_s: durationS,
  shots,
  events,
  sfxEvents: events,
  ...(musicCues.length ? { musicCues } : {}),
  ...(Object.keys(dialogueFx).length ? { dialogueFx } : {}),
  pacing,
  flow,
  xfade,
  ...(flash >= 0 ? { flash: [flash, flash + 4] } : {}),
  planned: [...cuts, ...kicks],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  `[export_timeline] Wrote ${shots.length} shots (${flowShots.length} Flow clips, ${effectiveCuts} cuts, ${pacing.cuts_per_60s}/60s, avg ${pacing.avg_cut_s}s) & ${events.length} SFX events -> ${outPath}`,
);
