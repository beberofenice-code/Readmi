// Single-source master timeline for "What If You Woke Up in a Zombie Apocalypse?" (1,992 frames @ 30 fps = 66.4 s).
// Shot boundaries are fitted to voice/zombie-apocalypse/words.json (ElevenLabs read at tempo 1.12, 64.74 s) so every cut
// lands on a line or word onset. Exported to out/zombie-apocalypse/timeline.json via scripts/export_timeline.mjs.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1992; // 66.4 s: voice ends f1942 ("zombie."), ~1.7 s payoff hold
export const AUDIO_PROFILE = "zombie"; // audio/mix.py picks the zombie foley/ambience/score profile
export type V3 = [number, number, number];
export type SetName = "bedroom" | "street" | "square";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  set: SetName;
  light: LightMode;
  xfade?: number;
  sunAz?: number;
  sunEl?: number;
};

// "rain" here is the overcast apocalypse grade only (no rain particles in this short); the sun comes out (day) on the reveal.
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 56,   set: "bedroom", light: "interior", sunAz: 150, sunEl: 40 },
  { id: 2,  a: 56,   b: 128,  set: "bedroom", light: "interior", sunAz: 150, sunEl: 40 },
  { id: 3,  a: 128,  b: 185,  set: "bedroom", light: "interior", sunAz: 160, sunEl: 55 },
  { id: 4,  a: 185,  b: 259,  set: "street",  light: "rain" },
  { id: 5,  a: 259,  b: 338,  set: "street",  light: "rain" },
  { id: 6,  a: 338,  b: 414,  set: "street",  light: "rain" },
  { id: 7,  a: 414,  b: 490,  set: "bedroom", light: "interior", xfade: 6, sunAz: 150, sunEl: 40 },
  { id: 8,  a: 490,  b: 565,  set: "bedroom", light: "interior", sunAz: 150, sunEl: 40 },
  { id: 9,  a: 565,  b: 625,  set: "bedroom", light: "interior", sunAz: 210, sunEl: 45 },
  { id: 10, a: 625,  b: 662,  set: "bedroom", light: "interior", sunAz: 200, sunEl: 45 },
  { id: 11, a: 662,  b: 707,  set: "street",  light: "rain" },
  { id: 12, a: 707,  b: 803,  set: "street",  light: "rain" },
  { id: 13, a: 803,  b: 845,  set: "street",  light: "rain" },
  { id: 14, a: 845,  b: 909,  set: "street",  light: "rain" },
  { id: 15, a: 909,  b: 978,  set: "street",  light: "rain" },
  { id: 16, a: 978,  b: 1063, set: "street",  light: "rain",   xfade: 6 },
  { id: 17, a: 1063, b: 1115, set: "street",  light: "rain" },
  { id: 18, a: 1115, b: 1230, set: "street",  light: "rain" },
  { id: 19, a: 1230, b: 1311, set: "square",  light: "rain",   xfade: 8 },
  { id: 20, a: 1311, b: 1370, set: "square",  light: "rain" },
  { id: 21, a: 1370, b: 1448, set: "square",  light: "rain" },
  { id: 22, a: 1448, b: 1585, set: "square",  light: "day" },
  { id: 23, a: 1585, b: 1684, set: "square",  light: "day" },
  { id: 24, a: 1684, b: 1802, set: "square",  light: "day" },
  { id: 25, a: 1802, b: TOTAL, set: "square", light: "day" },
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "alarm_clock" | "phone_buzz" | "wind_gust" | "zombie_groan" | "foot_drag" | "pan_grab" | "pot_clang"
    | "couch_drag" | "couch_thud" | "fridge_open" | "gate_creak" | "whoosh" | "pan_bonk" | "cartoon_tweet"
    | "crowd_groan" | "dumpster_slam" | "dumpster_creak" | "trash_squelch" | "crowd_turn" | "record_scratch"
    | "music_stop" | "phone_ring" | "mic_feedback" | "crowd_cheer" | "confetti_pop" | "trophy_ding";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 0,    type: "alarm_clock",    gain: 0.9,  pan: -0.3,  desc: "Bell alarm clock rattling on the nightstand" },
  { frame: 134,  type: "phone_buzz",     gain: 0.8,  pan: -0.1,  desc: "Phone vibrating against the nightstand" },
  { frame: 160,  type: "phone_buzz",     gain: 0.75, pan: -0.1,  desc: "Second buzz: 40 missed calls" },
  { frame: 188,  type: "wind_gust",      gain: 0.8,  pan: 0.2,   desc: "Wind across the empty street, paper tumbling" },
  { frame: 268,  type: "zombie_groan",   gain: 0.85, pan: 0.0,   desc: "First zombie groans down the middle of the road" },
  { frame: 346,  type: "foot_drag",      gain: 0.8,  pan: 0.1,   desc: "Dragged shoe scraping asphalt" },
  { frame: 374,  type: "foot_drag",      gain: 0.75, pan: 0.1,   desc: "Dragged shoe scraping asphalt" },
  { frame: 402,  type: "foot_drag",      gain: 0.7,  pan: 0.1,   desc: "Dragged shoe scraping asphalt" },
  { frame: 492,  type: "pan_grab",       gain: 0.8,  pan: 0.15,  desc: "Frying pan whipped up into frame" },
  { frame: 538,  type: "pot_clang",      gain: 0.9,  pan: 0.0,   desc: "Cooking pot clanks down onto the head" },
  { frame: 572,  type: "couch_drag",     gain: 0.85, pan: 0.25,  desc: "Couch scraping across the floorboards" },
  { frame: 604,  type: "couch_thud",     gain: 1.0,  pan: 0.35,  desc: "Couch slams against the bedroom door" },
  { frame: 628,  type: "fridge_open",    gain: 0.8,  pan: 0.2,   desc: "Mini fridge door pops open: hum, nothing inside" },
  { frame: 666,  type: "gate_creak",     gain: 0.8,  pan: 0.3,   desc: "Back gate creaks as you sneak out" },
  { frame: 724,  type: "zombie_groan",   gain: 1.0,  pan: 0.35,  desc: "Zombie lurches out from behind the car" },
  { frame: 866,  type: "whoosh",         gain: 0.8,  pan: -0.1,  desc: "Frying-pan swing" },
  { frame: 880,  type: "pan_bonk",       gain: 1.2,  pan: 0.05,  desc: "BONK: pan meets zombie head" },
  { frame: 886,  type: "cartoon_tweet",  gain: 0.6,  pan: 0.1,   desc: "Cartoon stars circling the bump" },
  { frame: 984,  type: "crowd_groan",    gain: 0.9,  pan: 0.0,   desc: "Dozens of zombies groaning as they shuffle" },
  { frame: 1070, type: "whoosh",         gain: 0.85, pan: 0.2,   desc: "Dive into the dumpster" },
  { frame: 1094, type: "dumpster_slam",  gain: 1.15, pan: 0.25,  desc: "Steel dumpster lid slams shut" },
  { frame: 1118, type: "dumpster_creak", gain: 0.85, pan: 0.25,  desc: "Lid creaks open again" },
  { frame: 1136, type: "trash_squelch",  gain: 0.85, pan: 0.2,   desc: "Squelchy garbage as you climb out" },
  { frame: 1234, type: "crowd_groan",    gain: 0.8,  pan: 0.0,   desc: "The horde in the square" },
  { frame: 1322, type: "crowd_turn",     gain: 0.9,  pan: 0.0,   desc: "Every head turns at once" },
  { frame: 1440, type: "record_scratch", gain: 1.0,  pan: 0.0,   desc: "Record scratch: the reveal" },
  { frame: 1441, type: "music_stop",     gain: 1.0,  pan: 0.0,   desc: "Tension score cuts dead" },
  { frame: 1598, type: "phone_ring",     gain: 0.55, pan: -0.25, desc: "Friends' phones still calling you" },
  { frame: 1684, type: "mic_feedback",   gain: 0.6,  pan: -0.1,  desc: "PA mic squeal as the host steps up" },
  { frame: 1784, type: "crowd_cheer",    gain: 0.9,  pan: 0.0,   desc: "Crowd cheers for the guy with the pan" },
  { frame: 1803, type: "confetti_pop",   gain: 0.8,  pan: 0.0,   desc: "Confetti cannons on stage" },
  { frame: 1912, type: "trophy_ding",    gain: 0.7,  pan: 0.1,   desc: "Trophy glint" },
  { frame: 1926, type: "crowd_cheer",    gain: 1.0,  pan: 0.0,   desc: "Big cheer on 'best zombie'" },
];

// ---------------- Shared kinematics (sets.ts poses + CAMS framing read the same functions) ----------------
/** Shot 5/6: first zombie limps toward camera down the centre line */
export const zombie1Z = (f: number) => 24 - (f - 259) * 0.034;
/** Street: Gary (pan victim) emerges from behind the parked car and shuffles at you */
export const garyPos = (f: number): V3 => {
  if (f < 721) return [2.9, 0, 17.8];
  if (f < 752) { const k = smooth((f - 721) / 31); return [lerp(2.9, 1.1, k), 0, lerp(17.8, 15.3, k)]; }
  if (f < 845) { const k = (f - 752) / 93; return [lerp(1.1, 1.0, k), 0, lerp(15.3, 13.5, k)]; }
  if (f < 880) return [1.0, 0, 13.35];
  if (f < 978) { const k = smooth((f - 880) / 14); return [1.0, 0, 13.35 + 0.35 * k]; }
  return [1.0, 0, 13.7];
};
/** Street: your route (gate -> sneak -> stop before Gary) */
export const heroStreetPos = (f: number): V3 => {
  if (f < 707) { const k = smooth((f - 662) / 45); return [lerp(6.2, 4.3, k), 0, lerp(1.6, 5.4, k)]; }
  if (f < 845) { const k = smooth((f - 707) / 30); return [lerp(1.2, 0.85, k), 0, lerp(10.2, 11.4, k)]; }
  return [0.8, 0, 12.35];
};

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

export const CAMS: Record<number, CamKey[]> = {
  // 1: wake up in bed: medium from the foot of the bed, punch-in on the bolt upright
  1: [{ f: 0, s: (f) => dolly([0.25, 1.3, -1.3], [-1.6, 0.98, 1.55], pushK(f, 0, 0.0028, 0.006, 20), { fov: 44 }) }],
  // 2: close-up panic, hands on cheeks
  2: [{ f: 56, s: (f) => dolly([-1.42, 1.38, 0.0], [-1.74, 1.3, 1.55], pushK(f, 56, 0.0032), { fov: 40, roll: -0.03 }) }],
  // 3: top-down insert on the buzzing phone (40 missed calls)
  3: [{ f: 128, s: (f) => dolly([-0.42, 0.98, 1.86], [-0.42, 0.51, 2.12], pushK(f, 128, 0.0035), { fov: 40 }) }],
  // 4: empty street establishing, slow creep down the road
  4: [{ f: 185, s: (f) => dolly([-1.2, 1.7, -7.0], [0.4, 1.3, 14.0], pushK(f, 185, 0.0022), { fov: 42 }) }],
  // 5: long-lens frontal on the first zombie limping down the centre line
  5: [{ f: 259, s: (f) => dolly([-0.6, 1.3, 12.5], [0.0, 1.15, 22.0], pushK(f, 259, 0.0025), { fov: 28 }) }],
  // 6: low side-tracking on the dragged leg
  6: [{ f: 338, s: (f) => ({ pos: [2.3, 0.45, zombie1Z(f) - 1.1], look: [0.0, 0.5, zombie1Z(f) + 0.15], fov: 40, roll: 0.02 }) }],
  // 7: bedroom, you square up (determined)
  7: [{ f: 414, s: (f) => dolly([0.35, 1.32, -1.75], [0.2, 1.22, 0.6], pushK(f, 414, 0.0026), { fov: 40 }) }],
  // 8: chest-up hero shot: pan up, pot on the head
  8: [{ f: 490, s: (f) => dolly([0.3, 1.52, -1.05], [0.2, 1.4, 0.6], pushK(f, 490, 0.0024, 0.005, 24), { fov: 44 }) }],
  // 9: wide on the couch shove; the charity-walk flyer sits on the wall by the door
  9: [{ f: 565, s: (f) => dolly([-1.25, 1.55, -1.5], [1.9, 0.9, 0.95], pushK(f, 565, 0.0022), { fov: 46 }) }],
  // 10: POV from inside the mini fridge: one sad ketchup bottle, your face peering in
  10: [{ f: 625, s: (f) => dolly([2.06, 0.62, 2.42], [1.97, 0.74, 1.55], pushK(f, 625, 0.0012), { fov: 52 }) }],
  // 11: low front on the sneak out of the back gate
  11: [{ f: 662, s: (f) => dolly([3.0, 0.95, 8.6], [5.2, 0.85, 3.6], pushK(f, 662, 0.0025), { fov: 40 }) }],
  // 12: over-the-shoulder: zombie lurches out from behind the parked car
  12: [
    { f: 707, s: (f) => dolly([-0.1, 1.55, 8.4], [1.7, 1.05, 15.0], pushK(f, 707, 0.0022), { fov: 40 }) },
    { f: 752, dur: 26, s: (f) => dolly([0.1, 1.5, 9.4], [1.2, 1.2, 14.6], pushK(f, 752, 0.0028), { fov: 38 }) },
  ],
  // 13: close-up "Braaains..."
  13: [{ f: 803, s: (f) => dolly([0.72, 1.5, 12.2], [1.0, 1.42, garyPos(f)[2] - 0.05], pushK(f, 803, 0.003), { fov: 40 }) }],
  // 14: profile two-shot for the swing (BONK at f880)
  14: [{ f: 845, s: (f) => dolly([-2.5, 1.28, 12.9], [0.9, 1.2, 12.9], pushK(f, 845, 0.0026, 0.005, 26), { fov: 40 }) }],
  // 15: over-the-shoulder on Gary rubbing his bump: "Ow! Dude..."
  15: [{ f: 909, s: (f) => dolly([-0.35, 1.65, 11.0], [1.0, 1.4, 13.7], pushK(f, 909, 0.0028), { fov: 40 }) }],
  // 16: high wide: dozens shuffling the same way, you by the dumpster
  16: [{ f: 978, s: (f) => dolly([-0.6, 7.5, -1.8], [3.3, 0.5, 10.0], pushK(f, 978, 0.0024), { fov: 44 }) }],
  // 17: the dive (lid slams f1094)
  17: [{ f: 1063, s: (f) => dolly([1.3, 1.55, 4.0], [4.8, 0.95, 8.0], pushK(f, 1063, 0.0025, 0.005, 24), { fov: 44 }) }],
  // 18: you climb out covered in ketchup, coffee grounds and bandages
  18: [
    { f: 1115, s: (f) => dolly([1.6, 1.4, 5.9], [4.6, 1.2, 8.1], pushK(f, 1115, 0.0022), { fov: 42 }) },
    { f: 1178, dur: 30, s: (f) => dolly([2.35, 1.5, 6.7], [4.15, 1.3, 8.4], pushK(f, 1178, 0.0026), { fov: 40 }) },
  ],
  // 19: square: crane down into the horde (stage stays behind camera until the reveal)
  19: [
    { f: 1230, s: (f) => dolly([0.0, 8.6, 9.6], [0.0, 0.6, -1.6], pushK(f, 1230, 0.002), { fov: 46 }) },
    { f: 1238, dur: 40, s: (f) => dolly([0.45, 2.7, 6.0], [0.0, 1.1, -0.6], pushK(f, 1238, 0.0022), { fov: 44 }) },
  ],
  // 20: every head turns to stare
  20: [{ f: 1311, s: (f) => dolly([0.2, 1.65, 4.6], [0.0, 1.25, -1.2], pushK(f, 1311, 0.0032), { fov: 42 }) }],
  // 21: low-angle last stand, pan raised
  21: [{ f: 1370, s: (f) => dolly([0.6, 0.42, 1.75], [0.0, 1.8, -0.2], pushK(f, 1370, 0.0028, 0.0055, 30), { fov: 48, roll: 0.03 }) }],
  // 22: REVEAL: reverse wide from behind you: the Charity Zombie Walk stage and banner
  22: [{ f: 1448, cut: true, s: (f) => dolly([0.0, 2.5, -8.6], [0.0, 2.2, 12.0], pushK(f, 1448, 0.0012), { fov: 42 }) }],
  // 23: your friends, phones still ringing
  23: [{ f: 1585, s: (f) => dolly([0.9, 1.9, 0.9], [0.0, 1.3, -1.95], pushK(f, 1585, 0.0022), { fov: 52 }) }],
  // 24: host on stage -> reverse from the stage onto you as he points
  24: [
    { f: 1684, s: (f) => dolly([0.7, 1.75, 6.4], [-0.55, 2.45, 13.4], pushK(f, 1684, 0.0022), { fov: 40 }) },
    { f: 1766, cut: true, s: (f) => dolly([-0.4, 2.3, 12.6], [0.0, 1.0, 0.0], pushK(f, 1766, 0.003), { fov: 40 }) },
  ],
  // 25: on stage with the trophy; glide in to the close-up for "best zombie"
  25: [
    { f: 1802, s: (f) => dolly([0.35, 2.05, 8.6], [0.25, 2.05, 13.4], pushK(f, 1802, 0.0022), { fov: 40 }) },
    { f: 1880, dur: 34, s: (f) => dolly([0.5, 1.98, 11.05], [0.45, 1.88, 13.3], pushK(f, 1880, 0.0024), { fov: 36 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [538 / FPS, 0.5],   // pot on the head
  [604 / FPS, 0.75],  // couch slams the door
  [880 / FPS, 1.45],  // BONK
  [1094 / FPS, 1.0],  // dumpster lid slam
  [1803 / FPS, 0.55], // confetti cannons
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
  { f: 0,    cInf: 10 },  // bedroom medium
  { f: 56,   cInf: 13 },  // panic CU
  { f: 128,  cInf: 12 },  // phone insert
  { f: 185,  cInf: 0 },   // empty street wide, all sharp
  { f: 259,  cInf: 6 },   // long-lens zombie
  { f: 338,  cInf: 11 },  // dragged leg low
  { f: 414,  cInf: 9 },
  { f: 490,  cInf: 12 },  // pan + pot CU
  { f: 565,  cInf: 4 },   // couch wide
  { f: 625,  cInf: 12 },  // fridge insert
  { f: 662,  cInf: 8 },
  { f: 707,  cInf: 9, focus: (f) => [garyPos(f)[0], 1.2, garyPos(f)[2]] }, // rack onto the zombie behind the car
  { f: 803,  cInf: 13 },  // Braaains CU
  { f: 845,  cInf: 8 },
  { f: 909,  cInf: 11, focus: (f) => [garyPos(f)[0], 1.4, garyPos(f)[2]] },
  { f: 978,  cInf: 0 },   // high wide crowd
  { f: 1063, cInf: 7 },
  { f: 1115, cInf: 9 },
  { f: 1230, cInf: 0 },   // crane into the square
  { f: 1311, cInf: 9 },
  { f: 1370, cInf: 10 },  // low-angle last stand
  { f: 1448, cInf: 3 },   // reveal: banner must read
  { f: 1585, cInf: 11 },  // friends with phones
  { f: 1684, cInf: 6 },   // host + banner
  { f: 1766, cInf: 9 },
  { f: 1802, cInf: 6 },
  { f: 1880, dur: 30, cInf: 11 }, // trophy close-up
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
