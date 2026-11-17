// Single-source master timeline for "What If You Think 100x Faster?" (62.5 s, 1,875 frames @ 30 fps).
// Shot boundaries are fitted to voice/think-100x-faster/words.json (cuts land 4-6 frames ahead of each line).
// Exported to out/think-100x-faster/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
// NOTE: cameras sit at -z looking +z, so screen-right is world -x.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1875; // 62.5 s
export type V3 = [number, number, number];
export type SetName = "kitchen" | "bedroom" | "study" | "office" | "street" | "terrace";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  set: SetName;
  light: LightMode;
  xfade?: number;     // frames of dissolve into this shot (stitched via FFmpeg xfade in per-shot mode)
  hud?: "clock";
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 112,  set: "kitchen", light: "interior" },                       // hook: waiting for toast
  { id: 2,  a: 112,  b: 253,  set: "bedroom", light: "day", sunAz: 120, sunEl: 40 },      // wakes up at x100
  { id: 3,  a: 253,  b: 380,  set: "kitchen", light: "interior", xfade: 6 },             // book vs. coffee stream
  { id: 4,  a: 380,  b: 503,  set: "study",   light: "interior" },                       // chess in four seconds
  { id: 5,  a: 503,  b: 638,  set: "study",   light: "interior" },                       // 300-year proof, one sneeze
  { id: 6,  a: 638,  b: 904,  set: "office",  light: "interior", xfade: 6, hud: "clock" }, // "Good... morning... Milo."
  { id: 7,  a: 904,  b: 979,  set: "office",  light: "interior", xfade: 6 },             // the four-day meeting
  { id: 8,  a: 979,  b: 1039, set: "street",  light: "golden", sunAz: 28, sunEl: 13 },    // the two-hour red light
  { id: 9,  a: 1039, b: 1179, set: "terrace", light: "night",  xfade: 8 },               // the ten-minute laugh
  { id: 10, a: 1179, b: 1365, set: "street",  light: "day",    xfade: 8 },               // "You see," pivot
  { id: 11, a: 1365, b: 1441, set: "street",  light: "day",    sunAz: 115, sunEl: 44 },   // genius in a statue
  { id: 12, a: 1441, b: 1577, set: "bedroom", light: "night",  xfade: 8, sunAz: 150, sunEl: 50 }, // can't sleep
  { id: 13, a: 1577, b: 1691, set: "kitchen", light: "interior", xfade: 8 },             // 80 years = 8,000
  { id: 14, a: 1691, b: TOTAL, set: "kitchen", light: "interior" },                      // "hurry up" -> toast
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Story beats shared by sets.ts, the HUD and the camera ----------------
export const SIT_UP = 147;        // "wakes"
export const BOOK_SHUT = 366;     // "pours."
export const CHESS_MOVES = [428, 434, 440, 446]; // "in four seconds"
export const KING_FALLS = 452;
export const SNEEZE = 616;        // "sneeze."
export const BOSS_SPEAKS = 724;   // "Good..."
export const BOSS_DONE = 822;
export const DAY_FLIPS = [944, 954, 964]; // "feels like four days"
export const PIGEON_LANDS = 1420; // "statue."
export const TOAST_POP = 1834;    // just after the final word

/** Boss's slow-motion mouth: one long open-close per word ("Good... morning... Milo.") */
export const bossMouth = (f: number) => {
  const words: [number, number][] = [[724, 752], [759, 794], [798, 822]];
  for (const [a, b] of words) if (f >= a && f < b) return 0.25 + 0.75 * Math.sin((Math.PI * (f - a)) / (b - a)) ** 0.7;
  return 0;
};

/** HUD clocks (shot 6): real seconds since the boss opened his mouth, and Milo's felt seconds (x100), frozen at the cut */
export const realSeconds = (f: number) => Math.max(0, Math.min(f, 814) - BOSS_SPEAKS) / FPS;
export const miloSeconds = (f: number) => realSeconds(f) * 100;

/** Shot 10 walk: Milo strolls along the pavement at a perfectly normal 1 m/s; the camera tracks beside him */
export const WALK_SPEED = 1.0;
export const walkX = (f: number) => 3.2 - (WALK_SPEED * (f - 1179)) / FPS; // world x, heading -x (screen right)

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "clock_tick"
    | "alarm_ring"
    | "whoosh"
    | "score_fast"
    | "score_slow"
    | "coffee_pour"
    | "page_flutter"
    | "book_shut"
    | "chess_clack"
    | "king_topple"
    | "chalk_scribble"
    | "sneeze"
    | "door_open"
    | "footstep"
    | "counter_flip"
    | "crosswalk_beep"
    | "glass_clink"
    | "pigeon_flap"
    | "stone_thud"
    | "music_stop"
    | "toaster_pop"
    | "pad_in";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 4,    type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen wall clock tick (hook)" },
  { frame: 34,   type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen wall clock tick" },
  { frame: 64,   type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen wall clock tick" },
  { frame: 94,   type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen wall clock tick" },
  { frame: 114,  type: "alarm_ring",     gain: 0.75, pan: -0.3,  desc: "Bedside alarm clock rings at 7:00" },
  { frame: 147,  type: "whoosh",         gain: 0.9,  pan: 0.0,   desc: "Milo bolts upright, mind spinning up to x100" },
  { frame: 257,  type: "score_fast",     gain: 1.0,  pan: 0.0,   desc: "Score switches to racing sixteenth-note glock" },
  { frame: 262,  type: "coffee_pour",    gain: 0.7,  pan: 0.35,  desc: "Coffee machine gurgle, stream hanging in the air" },
  { frame: 306,  type: "page_flutter",   gain: 0.9,  pan: -0.1,  desc: "Whole book riffled in two seconds" },
  { frame: 366,  type: "book_shut",      gain: 0.9,  pan: -0.1,  desc: "Book snaps shut, finished" },
  { frame: 428,  type: "chess_clack",    gain: 0.9,  pan: 0.1,   desc: "Chess move 1" },
  { frame: 434,  type: "chess_clack",    gain: 0.9,  pan: -0.1,  desc: "Chess move 2" },
  { frame: 440,  type: "chess_clack",    gain: 0.9,  pan: 0.1,   desc: "Chess move 3" },
  { frame: 446,  type: "chess_clack",    gain: 1.0,  pan: -0.1,  desc: "Chess move 4, checkmate" },
  { frame: 452,  type: "king_topple",    gain: 0.9,  pan: -0.2,  desc: "Grandmaster's king falls over" },
  { frame: 512,  type: "chalk_scribble", gain: 0.85, pan: 0.1,   desc: "Chalk racing across the blackboard" },
  { frame: 560,  type: "chalk_scribble", gain: 0.85, pan: -0.1,  desc: "More chalk" },
  { frame: 606,  type: "sneeze",         gain: 1.0,  pan: 0.0,   desc: "Ah... CHOO (proof finished mid-sneeze)" },
  { frame: 638,  type: "score_slow",     gain: 1.0,  pan: 0.0,   desc: "Score drops to a trudging half-time" },
  { frame: 644,  type: "door_open",      gain: 0.8,  pan: -0.5,  desc: "Office door creaks open" },
  { frame: 664,  type: "footstep",       gain: 0.7,  pan: -0.45, desc: "Boss step 1" },
  { frame: 682,  type: "footstep",       gain: 0.7,  pan: -0.35, desc: "Boss step 2" },
  { frame: 700,  type: "footstep",       gain: 0.7,  pan: -0.25, desc: "Boss step 3" },
  { frame: 740,  type: "clock_tick",     gain: 0.7,  pan: 0.0,   desc: "Office clock, one second" },
  { frame: 770,  type: "clock_tick",     gain: 0.7,  pan: 0.0,   desc: "Office clock, two seconds" },
  { frame: 800,  type: "clock_tick",     gain: 0.7,  pan: 0.0,   desc: "Office clock, three seconds" },
  { frame: 944,  type: "counter_flip",   gain: 0.85, pan: 0.0,   desc: "Meeting calendar flips to DAY 2" },
  { frame: 954,  type: "counter_flip",   gain: 0.85, pan: 0.0,   desc: "Meeting calendar flips to DAY 3" },
  { frame: 964,  type: "counter_flip",   gain: 0.9,  pan: 0.0,   desc: "Meeting calendar flips to DAY 4" },
  { frame: 984,  type: "crosswalk_beep", gain: 0.7,  pan: -0.2,  desc: "Don't-walk signal chirping at the red light" },
  { frame: 1046, type: "glass_clink",    gain: 0.7,  pan: 0.2,   desc: "Wine glasses on the terrace" },
  { frame: 1300, type: "pigeon_flap",    gain: 0.75, pan: 0.3,   desc: "Pigeon overtakes Milo at normal speed" },
  { frame: 1414, type: "pigeon_flap",    gain: 0.7,  pan: 0.1,   desc: "Pigeon comes in to land" },
  { frame: 1420, type: "stone_thud",     gain: 0.8,  pan: 0.0,   desc: "Pigeon lands on the statue's head" },
  { frame: 1470, type: "clock_tick",     gain: 0.6,  pan: 0.3,   desc: "Bedside clock in the dark" },
  { frame: 1500, type: "clock_tick",     gain: 0.6,  pan: 0.3,   desc: "Bedside clock in the dark" },
  { frame: 1530, type: "clock_tick",     gain: 0.6,  pan: 0.3,   desc: "Bedside clock in the dark" },
  { frame: 1560, type: "clock_tick",     gain: 0.6,  pan: 0.3,   desc: "Bedside clock in the dark" },
  { frame: 1689, type: "music_stop",     gain: 1.0,  pan: 0.0,   desc: "Score drops out; only the kitchen clock is left" },
  { frame: 1700, type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen clock tick" },
  { frame: 1730, type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen clock tick" },
  { frame: 1760, type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen clock tick" },
  { frame: 1790, type: "clock_tick",     gain: 0.8,  pan: 0.0,   desc: "Kitchen clock tick" },
  { frame: 1834, type: "toaster_pop",    gain: 1.1,  pan: 0.15,  desc: "The toast finally pops" },
  { frame: 1838, type: "pad_in",         gain: 1.0,  pan: 0.0,   desc: "Warm resolve chord under the popped toast" },
];

// ---------------- Camera Grammar (smootherstep glides, creeping holds, 7f kicks) ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type ShotCam = Partial<Cam> & { pos: V3; look: V3 };
export type CamKey = { f: number; dur?: number; cut?: boolean; s: (f: number) => ShotCam };

const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: ShotCam): Cam => ({ fov: 40, roll: 0, ...c });
const runKeys = (keys: CamKey[], f: number): Cam => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};

const pushK = (f: number, f0: number, rate = 0.0024, punch = 0, n = 32) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) {
    for (let i = 0; i < Math.min(x, n); i++) {
      s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
    }
  }
  return Math.exp(-s);
};

const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): ShotCam => ({
  pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k],
  look,
  ...rest,
});
/** dolly that also rides along world x (tracking shot beside the walking Milo) */
const track = (dx: number, c: ShotCam): ShotCam => ({ ...c, pos: [c.pos[0] + dx, c.pos[1], c.pos[2]], look: [c.look[0] + dx, c.look[1], c.look[2]] });

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1: kitchen island, Milo vs. toaster -> glide into the toaster with his face looming over it
  1: [
    { f: 0,  s: (f) => dolly([0.0, 1.5, -3.5], [-0.1, 1.3, 0.3], pushK(f, 0, 0.0026), { fov: 40 }) },
    { f: 50, dur: 32, s: (f) => dolly([-0.8, 1.3, -1.95], [-0.3, 1.2, 0.25], pushK(f, 50, 0.003), { fov: 36 }) },
  ],
  // Shot 2: bedside 3/4 -> punch in on the bolt-upright wake-up
  2: [
    { f: 112, s: (f) => dolly([-1.75, 1.75, -2.2], [0.15, 0.95, 0.75], pushK(f, 112, 0.0022), { fov: 42 }) },
    { f: 170, dur: 26, s: (f) => dolly([-0.6, 1.5, -1.35], [0.15, 1.34, 0.72], pushK(f, 170, 0.003, 0.006, 28), { fov: 38, roll: -0.03 }) },
  ],
  // Shot 3: Milo riffling a book -> cut to the coffee stream that has barely left the spout
  3: [
    { f: 253, s: (f) => dolly([0.1, 1.5, -3.2], [0.05, 1.28, 0.3], pushK(f, 253, 0.0026), { fov: 40 }) },
    { f: 338, dur: 24, s: (f) => dolly([1.25, 1.28, -1.55], [0.6, 1.14, 0.1], pushK(f, 338, 0.003), { fov: 34, roll: 0.03 }) },
  ],
  // Shot 4: chess two-shot -> board -> the bored winner
  4: [
    { f: 380, s: (f) => dolly([0.0, 1.45, -4.2], [0.0, 0.98, 0.0], pushK(f, 380, 0.0024), { fov: 40 }) },
    { f: 420, dur: 20, s: (f) => dolly([-0.05, 1.95, -2.5], [0.0, 0.9, 0.0], pushK(f, 420, 0.0028), { fov: 40 }) },
    { f: 458, dur: 24, s: (f) => dolly([0.15, 1.3, -1.9], [0.5, 1.12, 0.0], pushK(f, 458, 0.003), { fov: 36, roll: 0.03 }) },
  ],
  // Shot 5: blackboard, chalk flying -> push in for the sneeze
  5: [
    { f: 503, cut: true, s: (f) => dolly([0.15, 1.55, -3.7], [0.1, 1.6, 1.7], pushK(f, 503, 0.0024), { fov: 40 }) },
    { f: 592, dur: 22, s: (f) => dolly([0.45, 1.5, -1.5], [0.5, 1.45, 1.4], pushK(f, 592, 0.003, 0.006, 26), { fov: 38, roll: -0.03 }) },
  ],
  // Shot 6: boss ambles in and delivers three words -> cut to Milo five felt minutes later
  6: [
    { f: 638, s: (f) => dolly([0.0, 1.5, -4.3], [0.0, 1.22, 0.4], pushK(f, 638, 0.0018), { fov: 40 }) },
    { f: 720, dur: 30, s: (f) => dolly([-0.45, 1.45, -2.5], [-0.55, 1.3, 0.9], pushK(f, 720, 0.002), { fov: 38 }) },
    { f: 826, cut: true, s: (f) => dolly([0.2, 1.4, -1.75], [0.55, 1.24, 0.6], pushK(f, 826, 0.0032), { fov: 36, roll: 0.035 }) },
  ],
  // Shot 7: the meeting -> glide up to the tear-off calendar
  7: [
    { f: 904, s: (f) => dolly([0.0, 1.55, -3.9], [0.0, 1.35, 0.5], pushK(f, 904, 0.0024), { fov: 40 }) },
    { f: 930, dur: 18, s: (f) => dolly([-1.2, 2.0, 0.3], [-1.25, 2.1, 2.3], pushK(f, 930, 0.0028), { fov: 38 }) },
  ],
  // Shot 8: golden-hour crossing, Milo dwarfed by a red light
  8: [
    { f: 979, cut: true, s: (f) => dolly([-0.35, 1.2, -5.6], [-0.3, 1.75, 0.3], pushK(f, 979, 0.003), { fov: 40, roll: 0.02 }) },
  ],
  // Shot 9: terrace two-shot -> Milo waiting out the laugh
  9: [
    { f: 1039, s: (f) => dolly([0.0, 1.35, -3.9], [0.0, 1.08, 0.0], pushK(f, 1039, 0.0022), { fov: 40 }) },
    { f: 1104, dur: 28, s: (f) => dolly([0.05, 1.3, -2.6], [0.45, 1.08, 0.05], pushK(f, 1104, 0.0028), { fov: 36, roll: 0.03 }) },
  ],
  // Shot 10: tracking beside the walk: head (racing thoughts) -> legs -> mouth -> the whole street
  10: [
    { f: 1179, s: (f) => track(walkX(f), dolly([0.75, 1.5, -2.6], [-0.1, 1.42, 0.0], pushK(f, 1179, 0.002), { fov: 38 })) },
    { f: 1244, dur: 20, s: (f) => track(walkX(f), dolly([0.5, 0.55, -2.3], [-0.1, 0.4, 0.0], pushK(f, 1244, 0.002), { fov: 38 })) },
    { f: 1268, dur: 18, s: (f) => track(walkX(f), dolly([0.4, 1.45, -1.7], [-0.05, 1.42, 0.0], pushK(f, 1268, 0.002), { fov: 36 })) },
    { f: 1290, dur: 34, s: (f) => track(walkX(f), dolly([1.8, 2.1, -6.6], [-0.6, 1.5, 0.0], pushK(f, 1290, 0.0018), { fov: 44 })) },
  ],
  // Shot 11: low hero angle on the statue
  11: [
    { f: 1365, cut: true, s: (f) => dolly([20.9, 0.9, -5.6], [20.0, 1.75, 0.0], pushK(f, 1365, 0.003, 0.006, 30), { fov: 40, roll: -0.03 }) },
  ],
  // Shot 12: top-down on the insomniac -> drift toward the glowing clock
  12: [
    { f: 1441, s: (f) => dolly([-0.1, 4.4, 0.2], [-0.1, 0.7, 0.95], pushK(f, 1441, 0.002), { fov: 40, roll: 0.05 }) },
    { f: 1504, dur: 30, s: (f) => dolly([-0.12, 4.3, 0.45], [-0.12, 0.7, 1.2], pushK(f, 1504, 0.0024), { fov: 38, roll: -0.03 }) },
  ],
  // Shot 13: old Milo and his cake -> pull back to a wall of tally marks
  13: [
    { f: 1577, s: (f) => dolly([0.05, 1.4, -2.3], [0.0, 1.25, 0.3], pushK(f, 1577, 0.0024), { fov: 38 }) },
    { f: 1628, dur: 34, s: (f) => dolly([0.0, 1.75, -4.4], [0.0, 1.75, 2.3], pushK(f, 1628, 0.0018), { fov: 44 }) },
  ],
  // Shot 14: bookend on the toaster; long creep, then the pop
  14: [
    { f: 1691, cut: true, s: (f) => dolly([0.0, 1.5, -3.4], [-0.1, 1.3, 0.3], pushK(f, 1691, 0.0022), { fov: 40 }) },
    { f: 1752, dur: 36, s: (f) => dolly([-0.8, 1.3, -1.95], [-0.3, 1.2, 0.25], pushK(f, 1752, 0.0026), { fov: 36 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [147 / FPS, 0.9],   // bolts upright
  [366 / FPS, 0.5],   // book snaps shut
  [428 / FPS, 0.35],  // chess move 1
  [434 / FPS, 0.35],  // chess move 2
  [440 / FPS, 0.35],  // chess move 3
  [446 / FPS, 0.5],   // checkmate
  [452 / FPS, 0.4],   // king topples
  [616 / FPS, 1.2],   // the sneeze
  [944 / FPS, 0.35],  // DAY 2
  [954 / FPS, 0.35],  // DAY 3
  [964 / FPS, 0.5],   // DAY 4
  [1420 / FPS, 0.55], // pigeon lands on the statue
  [1834 / FPS, 1.0],  // toast pops
];

export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};

export const camAt = (id: number, f: number): Cam => {
  const c = runKeys(CAMS[id], f);
  const a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return {
    ...c,
    look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m],
    roll: c.roll + a * 0.004,
  };
};

// ---------------- Thin-Lens DOF Schedule (px @ 1080x1920) ----------------
export type DofEntry = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: DofEntry[] = [
  { f: 0,    cInf: 8 },                                              // kitchen MS
  { f: 50,   dur: 32, cInf: 13, focus: () => [-0.42, 1.05, -0.1] },  // toaster CU, Milo soft behind
  { f: 112,  cInf: 0 },                                              // bedroom wide
  { f: 170,  dur: 26, cInf: 12 },                                    // wake-up CU
  { f: 253,  cInf: 9 },                                              // book MS
  { f: 338,  dur: 24, cInf: 13 },                                    // coffee stream insert
  { f: 380,  cInf: 0 },                                              // chess two-shot
  { f: 420,  dur: 20, cInf: 10 },                                    // board
  { f: 458,  dur: 24, cInf: 12 },                                    // bored winner CU
  { f: 503,  cInf: 0 },                                              // blackboard (readable)
  { f: 592,  dur: 22, cInf: 6, focus: () => [0.72, 1.45, 1.35] },      // sneeze
  { f: 638,  cInf: 0 },                                              // office wide + HUD
  { f: 720,  dur: 30, cInf: 10 },                                    // boss MS
  { f: 826,  cInf: 13 },                                             // Milo CU
  { f: 904,  cInf: 0 },                                              // meeting wide
  { f: 930,  dur: 18, cInf: 0 },                                     // calendar insert (readable sign)
  { f: 979,  cInf: 0 },                                              // red-light wide
  { f: 1039, cInf: 10 },                                             // terrace two-shot, bokeh bulbs
  { f: 1104, dur: 28, cInf: 14 },                                    // Milo waiting CU
  { f: 1179, cInf: 11 },                                             // walk MS
  { f: 1290, dur: 34, cInf: 0 },                                     // street wide
  { f: 1365, cInf: 8 },                                              // statue
  { f: 1441, cInf: 0 },                                              // bed top-down
  { f: 1577, cInf: 10 },                                             // cake MS
  { f: 1628, dur: 34, cInf: 0 },                                     // tally wall wide
  { f: 1691, cInf: 8 },                                              // bookend MS
  { f: 1752, dur: 36, cInf: 13, focus: () => [-0.42, 1.05, -0.1] },  // toaster CU
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
