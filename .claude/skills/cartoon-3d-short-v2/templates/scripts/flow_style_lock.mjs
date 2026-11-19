// Style-locked Google Flow enhancement for Shorts-Studio v2 (/short3d).
// Google Flow must NEVER invent its own art style. Every Flow shot goes through a strict 3-stage lock:
//   A. Three.js keyframe lock  -> assets/flow_refs/shot_XX_start.png (+ shot_XX_end.png when the shot moves)
//   B. Flow Frames image-to-video from those keyframes (never text-only, never Ingredients-only)
//   C. Every animation prompt wrapped in STYLE_LOCK_PROMPT (below), verbatim
// Shared by export_timeline.mjs, render.mjs and flow_plan.mjs so the rules live in one place.
import fs from "node:fs";

export const STYLE_LOCK_PROMPT =
  "Animate this exact stylized 2D-on-3D cartoon stickman frame. Preserve the exact white round-headed stickman " +
  "character with bold black outlines, exact camera framing, and stylized 3D set colors. Upgrade only smooth natural " +
  "character motion, subtle secondary movement, soft contact shadows, volumetric lighting, and atmospheric particles " +
  "(rain/dust/reflections). Do NOT change character anatomy, do NOT turn characters into realistic humans, do NOT " +
  "alter camera angle, and do NOT generate text.";

/** Shots this short or shorter (seconds) always stay clean Three.js: Flow's slow head + morph risk isn't worth it. */
export const FAST_BEAT_MAX_S = 2.0;
/** Beat tags (story.ts `beat:`) that always stay Three.js: dialogue/prop gags carry text, counters and faces. */
export const THREEJS_ONLY_BEATS = new Set(["dialogue", "prop"]);
/** Flow's video durations (s). */
export const FLOW_DURATIONS = [4, 6, 8, 10];
export const DEFAULT_FLOW_MODEL = "Omni 1.1 Flash";
/** Start/End keyframes at or above this PSNR (dB) are treated as the same pose -> start frame only. */
export const STATIC_SHOT_PSNR_DB = 38;
/** Morph gate (270x480 luma SSIM): raw take frame 0 vs start keyframe, last used frame vs end keyframe. */
/** SSIM of the Flow clip's first/last used frame vs our Three.js start/end keyframe. */
export const MORPH_SSIM_START = 0.8;
export const MORPH_SSIM_END = 0.5;
export const REJECT_FILE = "assets/flow_clips/flow_reject.json";

// Everything readable stays in Remotion (signs, flip counters, HUD/REC, subtitles), and Flow may not restyle
// the character or move the camera. Motion text matching any of these is refused before any credit is spent.
const BANNED = [
  [/\b(text|texts|word|words|letter(?:s|ing)?|caption|captions|subtitle|subtitles|title card|typography|font|logo|watermark)\b/i, "readable text belongs in Remotion"],
  [/\b(sign|signs|signage|billboard|banner|label|labels|counter|scoreboard|clock face|numbers?|digits?|readout)\b/i, "signs/counters/readouts are Remotion or Three.js props"],
  [/\b(hud|rec|timestamp|overlay|ui|interface)\b/i, "HUD and REC overlays are Remotion DOM layers"],
  [/\b(realistic|photoreal(?:istic)?|real (?:person|people|human)|live[- ]action|human skin|anime|watercolou?r|pixel art|claymation|oil painting|new style|restyle)\b/i, "Flow must not change the art style"],
  [/\b(new (?:camera )?angle|change (?:the )?camera|cut to|switch (?:angle|view)|reverse shot|zoom out|wide shot|close[- ]up|orbit|dolly zoom)\b/i, "camera framing is locked to our Three.js rig"],
  [/\b(fingers|hair|nose|ears|muscles|clothes change|different outfit|anatomy|teeth)\b/i, "stickman anatomy is locked"],
];

/** Returns a list of problems with a shot's `flowMotion` text (empty = OK). */
export function lintMotion(motion) {
  const problems = [];
  if (!motion || !String(motion).trim()) problems.push("missing flowMotion (describe only the motion to add)");
  for (const [re, why] of BANNED) {
    const m = String(motion ?? "").match(re);
    if (m) problems.push(`"${m[0]}": ${why}`);
  }
  return problems;
}

/** Stage C: the only way a Flow prompt may be built. */
export function buildFlowPrompt(motion) {
  return `${STYLE_LOCK_PROMPT} Motion: ${String(motion).trim().replace(/\s+/g, " ")}`;
}

/** Shortest Flow duration covering `needsS` seconds (capped at 10). */
export const pickDuration = (needsS) => FLOW_DURATIONS.find((d) => d >= needsS) ?? 10;

/** Timeline-level gate (story.ts only): fast 1-2 s beats and dialogue/prop beats stay Three.js. */
export function timelineFlowSkip(shot, fps) {
  const secs = (shot.b - shot.a) / fps;
  if (shot.beat && THREEJS_ONLY_BEATS.has(shot.beat)) return `${shot.beat} beat stays Three.js`;
  if (secs <= FAST_BEAT_MAX_S) return `fast ${secs.toFixed(2)} s beat (<= ${FAST_BEAT_MAX_S} s) stays Three.js`;
  return null;
}

/** Rejected Flow takes ({ "<id>": "reason" }) -> those shots fall back to the clean Three.js render. */
export function loadRejects(file = REJECT_FILE) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}
export function saveRejects(rejects, file = REJECT_FILE) {
  fs.writeFileSync(file, JSON.stringify(rejects, null, 2) + "\n");
}
