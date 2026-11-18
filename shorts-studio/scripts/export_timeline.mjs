#!/usr/bin/env node
// Compiles story.ts into a single canonical timeline.json for Python procedural audio + short_qa.py.
// Usage: node scripts/export_timeline.mjs [src/videos/dashcam/story.ts] [out/dashcam/timeline.json]
import fs from "node:fs";
import path from "node:path";

const [storyPath = "src/videos/dashcam/story.ts", outPath = "out/dashcam/timeline.json"] = process.argv.slice(2);
const src = fs.readFileSync(storyPath, "utf8");

const fps = Number(src.match(/FPS\s*=\s*(\d+)/)?.[1] ?? 30);
const total = Number(src.match(/TOTAL\s*=\s*(\d+)/)?.[1] ?? 1867);
const score = src.match(/SCORE\s*=\s*"([^"]+)"/)?.[1] ?? null;
const flash = Number(src.match(/FLASH_AT\s*=\s*(-?\d+)/)?.[1] ?? -1);

// Parse SHOTS
const shots = [];
const shotRe = /\{\s*id:\s*(\d+),\s*a:\s*(\d+),\s*b:\s*(\w+),\s*set:\s*"([^"]+)",\s*light:\s*"([^"]+)"([^}]*)\}/g;
for (const m of src.matchAll(shotRe)) {
  const bVal = m[3] === "TOTAL" ? total : Number(m[3]);
  const xfadeMatch = m[6].match(/xfade:\s*(\d+)/);
  const hudMatch = m[6].match(/hud:\s*"([^"]+)"/);
  shots.push({
    id: Number(m[1]),
    a: Number(m[2]),
    b: bVal,
    set: m[4],
    light: m[5],
    xfade: xfadeMatch ? Number(xfadeMatch[1]) : 0,
    hud: hudMatch ? hudMatch[1] : null,
  });
}

// Parse EVENTS
const events = [];
const evRe = /\{\s*frame:\s*(\d+),\s*type:\s*"([^"]+)"([^}]*)\}/g;
for (const m of src.matchAll(evRe)) {
  const g = m[3].match(/gain:\s*([\d.]+)/);
  const p = m[3].match(/pan:\s*(-?[\d.]+)/);
  const d = m[3].match(/desc:\s*"([^"]+)"/);
  events.push({
    frame: Number(m[1]),
    time_s: Number((Number(m[1]) / fps).toFixed(4)),
    type: m[2],
    gain: g ? Number(g[1]) : 1.0,
    pan: p ? Number(p[1]) : 0.0,
    desc: d ? d[1] : m[2],
  });
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

const payload = {
  fps,
  total_frames: total,
  duration_s: Number((total / fps).toFixed(4)),
  ...(score ? { score } : {}),
  shots,
  events,
  xfade,
  ...(flash >= 0 ? { flash: [flash, flash + 4] } : {}),
  planned: [...cuts, ...kicks],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`[export_timeline] Wrote ${shots.length} shots & ${events.length} foley events -> ${outPath}`);
