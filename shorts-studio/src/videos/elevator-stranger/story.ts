// Single-source master timeline for "The Elevator Stranger" (65.5 s / 1,965 frames @ 30 fps).
// Shot boundaries are fitted to voice/elevator-stranger/words.json (frame numbers in the comments are word onsets).
// Exported to out/elevator-stranger/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1965; // 65.5 s (last word ends at f1919)
export type V3 = [number, number, number];
export type SetName = "elevator" | "lobby" | "office";

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
  hud?: "cctv";
  sunAz?: number;
  sunEl?: number;
};

// "lobby" = the elevator set seen through its doors (ground-floor lobby in Shot 2, 40th-floor landing in Shot 14).
// The key light sits behind the camera (sunAz 150) so the walls facing the lens are lit; flashbacks use the cool "rain" grade.
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 140,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 2,  a: 140,  b: 246,  set: "lobby",    light: "day",      sunAz: 150, sunEl: 55 },
  { id: 3,  a: 246,  b: 346,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 4,  a: 346,  b: 428,  set: "elevator", light: "interior", sunAz: 160, sunEl: 20 },
  { id: 5,  a: 428,  b: 484,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 6,  a: 484,  b: 593,  set: "elevator", light: "night",    sunAz: 150, sunEl: 50 },
  { id: 7,  a: 593,  b: 704,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 8,  a: 704,  b: 905,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 9,  a: 905,  b: 963,  set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 10, a: 963,  b: 1066, set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 11, a: 1066, b: 1202, set: "elevator", light: "interior", sunAz: 170, sunEl: 60 },
  { id: 12, a: 1202, b: 1275, set: "elevator", light: "interior", sunAz: 150, sunEl: 50 },
  { id: 13, a: 1275, b: 1339, set: "elevator", light: "interior", xfade: 8, hud: "cctv", sunAz: 160, sunEl: 60 },
  { id: 14, a: 1339, b: 1445, set: "lobby",    light: "day",      sunAz: 150, sunEl: 55 },
  { id: 15, a: 1445, b: 1529, set: "office",   light: "day",      sunAz: 140, sunEl: 45 },
  { id: 16, a: 1529, b: 1593, set: "office",   light: "day",      sunAz: 140, sunEl: 45 },
  { id: 17, a: 1593, b: 1665, set: "elevator", light: "rain",     xfade: 8, sunAz: 150, sunEl: 50 },
  { id: 18, a: 1665, b: 1748, set: "elevator", light: "rain",     sunAz: 150, sunEl: 40 },
  { id: 19, a: 1748, b: 1858, set: "elevator", light: "rain",     sunAz: 150, sunEl: 50 },
  { id: 20, a: 1858, b: TOTAL, set: "office",  light: "day",      xfade: 6, sunAz: 140, sunEl: 45 },
];

export const FLASH_AT = -1; // no white flash in this short

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Story beats shared by sets.ts, the overlay and the camera ----------------
/** Dan's thought-bubble pops: [frame, texture kind, shot] */
export const BUBBLES: [number, "elevator" | "coffee" | "boss" | "rage", number][] = [
  [57, "elevator", 1], [78, "coffee", 1], [92, "boss", 1],   // hook montage
  [708, "elevator", 8], [759, "coffee", 8], [820, "boss", 8], // "...elevators break every week / coffee / the boss"
  [1752, "rage", 19], [1789, "coffee", 19], [1826, "boss", 19], // "every candidate"
];
/** Dialogue windows (frames) for mouth flaps */
export const DAN_LINES: [number, number][] = [[484, 522]];
export const BOSS_LINES: [number, number][] = [[912, 956], [1858, 1880], [1886, 1917]];
export const POUNDS = [541, 549, 556, 566];
export const STOP_PULL = 1700;   // flashback: she pulls the emergency stop knob
export const DRIP_HIT = 1250;    // "...where everything leaks."
export const CUP_SET = 1575;
/** Security-camera clock for the "Forty minutes later" time-lapse (Shot 13): 09:02 -> 09:42 */
export const cctvClock = (f: number) => {
  const sec = Math.round((2 + 40 * smooth((f - 1277) / 54)) * 60 + ((f * 7) % 60));
  const p = (n: number) => String(n).padStart(2, "0");
  return `09:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
};

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "footsteps_run"
    | "door_slide"
    | "elevator_ding"
    | "floor_tick"
    | "elevator_jolt"
    | "alarm_buzz"
    | "door_pound"
    | "lights_flicker"
    | "bubble_pop"
    | "pencil_scribble"
    | "water_drip"
    | "time_whoosh"
    | "chair_creak"
    | "cup_set"
    | "stop_knob"
    | "music_stop"
    | "music_resolve";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 57,   type: "bubble_pop",      gain: 0.7,  pan: 0.2,  desc: "Hook rant bubble 1 (broken elevator)" },
  { frame: 78,   type: "bubble_pop",      gain: 0.7,  pan: 0.2,  desc: "Hook rant bubble 2 (coffee)" },
  { frame: 92,   type: "bubble_pop",      gain: 0.75, pan: 0.2,  desc: "Hook rant bubble 3 (the boss)" },
  { frame: 146,  type: "footsteps_run",   gain: 0.9,  pan: 0.0,  desc: "Dan sprints across the marble lobby" },
  { frame: 206,  type: "door_slide",      gain: 0.8,  pan: 0.0,  desc: "Elevator doors start closing on him" },
  { frame: 250,  type: "elevator_ding",   gain: 0.8,  pan: 0.0,  desc: "Doors shut, car departs" },
  { frame: 372,  type: "floor_tick",      gain: 0.7,  pan: 0.0,  desc: "Floor indicator 10 -> 11" },
  { frame: 428,  type: "elevator_jolt",   gain: 0.8,  pan: -0.1, desc: "Car shudders between 11 and 12" },
  { frame: 459,  type: "elevator_jolt",   gain: 1.2,  pan: 0.1,  desc: "Car slams to a stop" },
  { frame: 484,  type: "alarm_buzz",      gain: 0.8,  pan: -0.25, desc: "Red emergency lamp buzzer" },
  { frame: 541,  type: "door_pound",      gain: 1.0,  pan: 0.15, desc: "Dan pounds on the doors 1" },
  { frame: 549,  type: "door_pound",      gain: 0.9,  pan: 0.05, desc: "Dan pounds on the doors 2" },
  { frame: 556,  type: "door_pound",      gain: 1.0,  pan: 0.15, desc: "Dan pounds on the doors 3" },
  { frame: 566,  type: "door_pound",      gain: 1.1,  pan: 0.05, desc: "Dan pounds on the doors 4" },
  { frame: 593,  type: "lights_flicker",  gain: 0.8,  pan: 0.0,  desc: "Ceiling panel flickers back on" },
  { frame: 708,  type: "bubble_pop",      gain: 0.8,  pan: 0.2,  desc: "Rant bubble: elevators break every week" },
  { frame: 759,  type: "bubble_pop",      gain: 0.8,  pan: 0.2,  desc: "Rant bubble: coffee tastes like regret" },
  { frame: 820,  type: "bubble_pop",      gain: 0.85, pan: 0.1,  desc: "Rant bubble: the boss never listens" },
  { frame: 1080, type: "pencil_scribble", gain: 0.9,  pan: -0.1, desc: "Notepad line 1: fire the consultants" },
  { frame: 1126, type: "pencil_scribble", gain: 0.9,  pan: -0.1, desc: "Notepad line 2: fix the elevators" },
  { frame: 1172, type: "pencil_scribble", gain: 0.9,  pan: -0.1, desc: "Notepad line 3: ask the janitors" },
  { frame: 1250, type: "water_drip",      gain: 0.9,  pan: 0.2,  desc: "Ceiling drip lands on Dan's head" },
  { frame: 1275, type: "time_whoosh",     gain: 0.9,  pan: 0.0,  desc: "Security-cam fast-forward: forty minutes" },
  { frame: 1339, type: "elevator_ding",   gain: 0.9,  pan: 0.0,  desc: "Arrival chime on the 40th floor" },
  { frame: 1343, type: "door_slide",      gain: 0.85, pan: 0.0,  desc: "Doors finally open" },
  { frame: 1374, type: "footsteps_run",   gain: 0.8,  pan: 0.25, desc: "Dan bolts for the interview room" },
  { frame: 1445, type: "music_stop",      gain: 1.0,  pan: 0.0,  desc: "Score drops out on the empty chair" },
  { frame: 1546, type: "chair_creak",     gain: 0.8,  pan: 0.0,  desc: "The stranger sits in the boss's chair" },
  { frame: 1575, type: "cup_set",         gain: 0.8,  pan: 0.1,  desc: "Paper cup set on the desk" },
  { frame: 1593, type: "music_resolve",   gain: 1.0,  pan: 0.0,  desc: "Warm reveal pad enters on 'You see'" },
  { frame: 1700, type: "stop_knob",       gain: 1.0,  pan: -0.2, desc: "Flashback: she pulls the emergency stop" },
  { frame: 1704, type: "elevator_jolt",   gain: 0.6,  pan: 0.0,  desc: "Flashback: car halts on cue" },
  { frame: 1752, type: "bubble_pop",      gain: 0.6,  pan: 0.2,  desc: "Candidate 1 rant bubble" },
  { frame: 1789, type: "bubble_pop",      gain: 0.6,  pan: 0.2,  desc: "Candidate 2 rant bubble" },
  { frame: 1826, type: "bubble_pop",      gain: 0.6,  pan: 0.2,  desc: "Candidate 3 rant bubble" },
  { frame: 1906, type: "cup_set",         gain: 0.7,  pan: 0.1,  desc: "She slides the coffee across the desk" },
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

// Elevator car interior: x -1.1..1.1, y 0..2.5, z -1 (doors) .. 1 (back wall). Dan stands at x -0.36, the stranger
// at x +0.36 next to the button panel on the x = +1.1 wall. Front-on cameras sit outside the (hidden) door wall and
// look +z, so world +x is SCREEN LEFT in those shots.
const TWO: V3 = [0, 1.36, -3.25], TWO_LOOK: V3 = [0, 1.3, 0.28];
const DAN_HEAD: V3 = [-0.36, 1.4, 0.25], BOSS_HEAD: V3 = [0.36, 1.4, 0.3];

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1 (hook): wide doll's-house two-shot of the stuck car -> glide closer as the rant bubbles pop
  1: [
    { f: 0,  s: (f) => dolly([0, 1.4, -4.0], [0, 1.28, 0.28], pushK(f, 0, 0.0026), { fov: 40 }) },
    { f: 100, dur: 34, s: (f) => dolly([-0.1, 1.5, -3.2], [-0.08, 1.5, 0.28], pushK(f, 100, 0.0024), { fov: 40 }) },
  ],
  // Shot 2: from inside the car, through the closing doors: Dan sprints at the lens across the lobby
  2: [
    { f: 140, s: (f) => dolly([0.05, 1.34, 0.8], [-0.05, 1.42, -2.2], pushK(f, 140, 0.0018), { fov: 50 }) },
  ],
  // Shot 3: two-shot, Dan panting -> glide to the quiet stranger and her coffee
  3: [
    { f: 246, s: (f) => dolly(TWO, TWO_LOOK, pushK(f, 246, 0.0024), { fov: 40 }) },
    { f: 290, dur: 28, s: (f) => dolly([0.55, 1.44, -1.5], BOSS_HEAD, pushK(f, 290, 0.003), { fov: 34 }) },
  ],
  // Shot 4: insert on the floor indicator above the doors (10 -> 11 ...)
  4: [
    { f: 346, s: (f) => dolly([0.06, 1.7, 0.52], [0, 2.26, -0.95], pushK(f, 346, 0.003), { fov: 36, roll: 0.02 }) },
  ],
  // Shot 5: wide two-shot, the car shudders (kicks at 428 / 444) and slams to a stop (459)
  5: [
    { f: 428, s: (f) => dolly([0, 1.38, -3.7], [0, 1.28, 0.28], pushK(f, 428, 0.0028), { fov: 40, roll: 0.025 * Math.sin((f - 428) * 0.55) * Math.exp(-Math.max(0, f - 459) / 9) }) },
  ],
  // Shot 6: red emergency light. Dan CU "No, no, no. Not today." -> low wide as he pounds on the doors (the lens)
  6: [
    { f: 484, s: (f) => dolly([-0.55, 1.5, -1.9], [-0.36, 1.44, 0.25], pushK(f, 484, 0.0035), { fov: 34, roll: -0.035 }) },
    { f: 531, cut: true, s: (f) => dolly([0.1, 1.2, -3.6], [-0.05, 1.3, 0.0], pushK(f, 531, 0.0026), { fov: 40, roll: 0.02 }) },
  ],
  // Shot 7: lights back on, "So he starts talking" two-shot drifting toward Dan
  7: [
    { f: 593, s: (f) => dolly(TWO, TWO_LOOK, pushK(f, 593, 0.0022), { fov: 40 }) },
    { f: 640, dur: 32, s: (f) => dolly([-0.25, 1.42, -3.0], [-0.1, 1.36, 0.28], pushK(f, 640, 0.0024), { fov: 40 }) },
  ],
  // Shot 8: rant bubbles over the two-shot -> her deadpan look at the coffee -> Dan + "the boss" bubble
  8: [
    { f: 704, s: (f) => dolly([0, 1.5, -3.3], [0, 1.52, 0.28], pushK(f, 704, 0.0022), { fov: 40 }) },
    { f: 790, cut: true, s: (f) => dolly([0.6, 1.4, -1.35], [0.36, 1.33, 0.3], pushK(f, 790, 0.0035), { fov: 34 }) },
    { f: 812, cut: true, s: (f) => dolly([-0.3, 1.6, -2.75], [-0.3, 1.66, 0.25], pushK(f, 812, 0.0024), { fov: 38 }) },
  ],
  // Shot 9: the stranger's only question
  9: [
    { f: 905, s: (f) => dolly([0.14, 1.43, -1.25], BOSS_HEAD, pushK(f, 905, 0.0032), { fov: 34, roll: 0.02 }) },
  ],
  // Shot 10: Dan, nothing left to lose -> opens up into the two-shot
  10: [
    { f: 963, s: (f) => dolly([-0.2, 1.44, -1.4], DAN_HEAD, pushK(f, 963, 0.003), { fov: 34 }) },
    { f: 1018, dur: 32, s: (f) => dolly([0.05, 1.38, -3.1], TWO_LOOK, pushK(f, 1018, 0.0022), { fov: 40 }) },
  ],
  // Shot 11: her POV down onto the notepad as the fix list writes itself
  11: [
    { f: 1066, s: (f) => dolly([0.36, 1.74, 0.34], [0.36, 1.03, -0.1], pushK(f, 1066, 0.002), { fov: 38 }) },
  ],
  // Shot 12: two-shot, Dan points at the ceiling leak, the drip finds him
  12: [
    { f: 1202, s: (f) => dolly([-0.12, 1.42, -3.2], [-0.12, 1.5, 0.28], pushK(f, 1202, 0.0026), { fov: 40 }) },
  ],
  // Shot 13: ceiling-corner security camera, forty minutes in fast-forward (HUD shot, all in focus)
  13: [
    { f: 1275, cut: true, s: (f) => dolly([0.1, 2.43, -0.93], [0, 0.85, 0.5], pushK(f, 1275, 0.0018), { fov: 76 }) },
  ],
  // Shot 14: 40th-floor landing, the doors finally open and Dan bolts past the lens
  14: [
    { f: 1339, cut: true, s: (f) => dolly([0.75, 1.42, -5.4], [0, 1.3, -1.05], pushK(f, 1339, 0.0022), { fov: 40 }) },
    { f: 1392, dur: 26, s: (f) => dolly([0.75, 1.42, -5.4], [-0.25, 1.3, -1.6], pushK(f, 1392, 0.002), { fov: 42, roll: -0.02 }) },
  ],
  // Shot 15: "It's empty." punch-in on the boss's chair -> reverse on Dan as the stranger walks in behind him
  15: [
    { f: 1445, cut: true, s: (f) => dolly([0.12, 1.5, -3.3], [0, 1.2, 1.1], pushK(f, 1445, 0.0032, 0.0065, 26), { fov: 38 }) },
    { f: 1475, cut: true, s: (f) => dolly([0.5, 1.5, 0.45], [0.05, 1.34, -2.6], pushK(f, 1475, 0.0024), { fov: 40 }) },
  ],
  // Shot 16: she sits down in the boss's chair
  16: [
    { f: 1529, cut: true, s: (f) => dolly([-0.25, 1.44, -2.7], [0, 1.2, 1.0], pushK(f, 1529, 0.003), { fov: 38 }) },
  ],
  // Shot 17 (flashback): the same two-shot, drifting toward the button panel as her hand wanders to it
  17: [
    { f: 1593, s: (f) => dolly(TWO, TWO_LOOK, pushK(f, 1593, 0.0022), { fov: 40 }) },
    { f: 1626, dur: 30, s: (f) => dolly([-0.15, 1.28, -2.6], [0.8, 1.12, -0.25], pushK(f, 1626, 0.0024), { fov: 38 }) },
  ],
  // Shot 18 (flashback): CU of the emergency stop knob
  18: [
    { f: 1665, cut: true, s: (f) => dolly([0.16, 1.07, -0.56], [1.06, 1.0, -0.45], pushK(f, 1665, 0.003, 0.006, 30), { fov: 32, roll: -0.03 }) },
  ],
  // Shot 19 (flashback): "every candidate" jump-cut montage on a locked two-shot
  19: [
    { f: 1748, cut: true, s: (f) => dolly(TWO, TWO_LOOK, pushK(f, 1748, 0.003), { fov: 40 }) },
    { f: 1785, cut: true, s: (f) => dolly([0.06, 1.4, -3.05], [0, 1.36, 0.28], pushK(f, 1785, 0.003), { fov: 40, roll: 0.02 }) },
    { f: 1822, cut: true, s: (f) => dolly([-0.06, 1.44, -2.85], [0, 1.42, 0.28], pushK(f, 1822, 0.003), { fov: 40, roll: -0.02 }) },
  ],
  // Shot 20: "You're hired. Start with the coffee." -> Dan's reaction
  20: [
    { f: 1858, s: (f) => dolly([0.12, 1.34, -2.15], [0, 1.06, 1.0], pushK(f, 1858, 0.0026), { fov: 36 }) },
    { f: 1922, cut: true, s: (f) => dolly([0.05, 1.5, 0.25], [-0.25, 1.44, -2.4], pushK(f, 1922, 0.0032), { fov: 34 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [57 / FPS, 0.3],    // hook bubble 1
  [78 / FPS, 0.3],    // hook bubble 2
  [92 / FPS, 0.35],   // hook bubble 3
  [428 / FPS, 0.9],   // elevator shudder
  [444 / FPS, 0.7],   // second shudder
  [459 / FPS, 1.5],   // hard stop
  [541 / FPS, 0.5],   // door pound 1
  [549 / FPS, 0.45],  // door pound 2
  [556 / FPS, 0.5],   // door pound 3
  [566 / FPS, 0.6],   // door pound 4
  [708 / FPS, 0.3],   // rant bubble: elevators
  [759 / FPS, 0.3],   // rant bubble: coffee
  [820 / FPS, 0.3],   // rant bubble: boss
  [1250 / FPS, 0.3],  // ceiling drip
  [1700 / FPS, 0.9],  // emergency stop pulled
  [1752 / FPS, 0.25], // candidate bubbles
  [1789 / FPS, 0.25],
  [1826 / FPS, 0.25],
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
  { f: 0,    cInf: 0 },             // hook wide
  { f: 140,  cInf: 0 },             // lobby wide, deep focus
  { f: 246,  cInf: 5 },
  { f: 290,  dur: 28, cInf: 12 },   // stranger MCU
  { f: 346,  cInf: 12 },            // floor indicator insert
  { f: 428,  cInf: 0 },             // shudder wide
  { f: 484,  cInf: 13 },            // Dan CU, red light
  { f: 531,  cInf: 0 },             // pounding wide
  { f: 593,  cInf: 5 },
  { f: 704,  cInf: 0 },             // bubbles two-shot (keep the icons crisp)
  { f: 790,  cInf: 13 },            // her look at the coffee
  { f: 812,  cInf: 6 },
  { f: 905,  cInf: 13 },            // her question
  { f: 963,  cInf: 13 },            // Dan CU
  { f: 1018, dur: 32, cInf: 5 },
  { f: 1066, cInf: 12 },            // notepad insert
  { f: 1202, cInf: 5 },
  { f: 1275, cInf: 0 },             // security camera HUD
  { f: 1339, cInf: 5 },
  { f: 1445, cInf: 6 },             // empty chair (nameplate stays readable)
  { f: 1475, cInf: 10 },            // Dan sharp, doorway soft
  { f: 1529, cInf: 10 },
  { f: 1593, cInf: 5 },
  { f: 1626, dur: 30, cInf: 9 },
  { f: 1665, cInf: 14 },            // stop knob CU
  { f: 1748, cInf: 0 },             // montage two-shot
  { f: 1858, cInf: 12 },            // boss at her desk
  { f: 1922, cInf: 13 },            // Dan reaction
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
