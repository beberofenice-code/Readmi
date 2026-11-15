// Single-source master timeline for "What If Your Shadow Walked Away?" (61.3 s / 1,840 frames @ 30 fps).
// Shot boundaries are fitted to voice/shadow-walked-away/words.json (ElevenLabs alignment).
// Exported to out/shadow-walked-away/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1840; // 61.33 s
export type V3 = [number, number, number];
export type SetName = "street" | "office" | "apartment" | "beach";

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
  xfade?: number;     // frames of dissolve into this shot (stitched via FFmpeg xfade in per-shot mode)
  hud?: string;
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 155,  set: "street",    light: "day" },                 // hook: the shadow stands up and leaves
  { id: 2,  a: 155,  b: 339,  set: "street",    light: "day" },                 // gray walk to work -> peel
  { id: 3,  a: 339,  b: 441,  set: "street",    light: "day" },                 // "You're attached!" / "Not anymore."
  { id: 4,  a: 441,  b: 581,  set: "street",    light: "day" },                 // chase, briefcase
  { id: 5,  a: 581,  b: 754,  set: "office",    light: "interior", xfade: 6 },  // nobody notices
  { id: 6,  a: 754,  b: 814,  set: "apartment", light: "night",    xfade: 8 },  // postcards arrive
  { id: 7,  a: 814,  b: 1010, set: "apartment", light: "interior" },            // rollercoaster / surf / wedding
  { id: 8,  a: 1010, b: 1083, set: "apartment", light: "night", sunAz: 150, sunEl: 40 }, // the SOMEDAY list
  { id: 9,  a: 1083, b: 1153, set: "apartment", light: "night", sunAz: 150, sunEl: 40 }, // calls in sick, buys a ticket
  { id: 10, a: 1153, b: 1338, set: "beach",     light: "golden",   xfade: 8 },  // finds it at sunset
  { id: 11, a: 1338, b: 1410, set: "beach",     light: "golden" },              // he hadn't stood in the sun for years
  { id: 12, a: 1410, b: 1491, set: "beach",     light: "golden" },              // "I just got tired of waiting."
  { id: 13, a: 1491, b: 1661, set: "beach",     light: "golden" },              // shoes off, into the light, shadow returns
  { id: 14, a: 1661, b: TOTAL, set: "beach",    light: "golden" },              // he follows his shadow
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

/** World-fixed sun directions (towards the sun) for exterior sets, so cast shadows keep one geography across cuts. */
export const SUN_WORLD: Partial<Record<SetName, V3>> = {
  street: [-0.85, 0.75, -0.35],
  beach: [-0.2, 0.2, 1.0],
};
/** Unit ground direction a shadow falls in + its length for a 1 m tall object */
export const shadowDir = (set: SetName): { dx: number; dz: number; perM: number } => {
  const s = SUN_WORLD[set]!;
  const h = Math.hypot(s[0], s[2]);
  return { dx: -s[0] / h, dz: -s[2] / h, perM: h / s[1] };
};

// ---------------- Speech windows (frames) for lip flap ----------------
export const SPEECH: Record<"man" | "shadow", [number, number][]> = {
  man: [[339, 350], [352, 372], [373, 403], [1218, 1256]],
  shadow: [[406, 438], [1410, 1433], [1446, 1488]],
};
export const talk = (who: "man" | "shadow", f: number) => {
  for (const [a, b] of SPEECH[who]) if (f >= a && f < b) return 0.3 + 0.55 * Math.abs(Math.sin(f * 0.95));
  return 0;
};

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "shadow_rise" | "stretch_squeak" | "soft_steps" | "peel_snap" | "whoosh" | "briefcase_thud"
    | "keyboard" | "mail_slot" | "card_flip" | "phone_beep" | "ticket_stamp" | "shoe_thud"
    | "shimmer" | "music_stop" | "music_resolve";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 36,   type: "shadow_rise",    gain: 0.9,  pan: 0.2,   desc: "Flat shadow hinges up off the sidewalk" },
  { frame: 90,   type: "stretch_squeak", gain: 0.8,  pan: 0.15,  desc: "Shadow stretches its arms" },
  { frame: 124,  type: "soft_steps",     gain: 0.7,  pan: 0.35,  desc: "Shadow strolls away" },
  { frame: 160,  type: "soft_steps",     gain: 0.6,  pan: -0.05, desc: "Man commute footsteps A" },
  { frame: 205,  type: "soft_steps",     gain: 0.6,  pan: 0.0,   desc: "Man commute footsteps B" },
  { frame: 284,  type: "stretch_squeak", gain: 0.75, pan: 0.1,   desc: "Shadow strands stretch from his heels" },
  { frame: 300,  type: "peel_snap",      gain: 1.0,  pan: 0.1,   desc: "Shadow snaps free of his shoes" },
  { frame: 432,  type: "whoosh",         gain: 0.8,  pan: 0.4,   desc: "Shadow bolts" },
  { frame: 446,  type: "soft_steps",     gain: 0.9,  pan: -0.1,  desc: "Chase footsteps A" },
  { frame: 480,  type: "soft_steps",     gain: 0.9,  pan: -0.1,  desc: "Chase footsteps B" },
  { frame: 500,  type: "whoosh",         gain: 0.7,  pan: 0.5,   desc: "Shadow whips past the camera" },
  { frame: 556,  type: "briefcase_thud", gain: 0.9,  pan: 0.0,   desc: "Briefcase drops as he gives up" },
  { frame: 590,  type: "keyboard",       gain: 0.7,  pan: -0.15, desc: "Office typing bed A" },
  { frame: 660,  type: "keyboard",       gain: 0.6,  pan: 0.2,   desc: "Office typing bed B" },
  { frame: 762,  type: "mail_slot",      gain: 0.9,  pan: -0.1,  desc: "Postcard 1 through the mail slot" },
  { frame: 778,  type: "mail_slot",      gain: 0.8,  pan: -0.1,  desc: "Postcard 2 through the mail slot" },
  { frame: 792,  type: "mail_slot",      gain: 0.8,  pan: -0.1,  desc: "Postcard 3 through the mail slot" },
  { frame: 814,  type: "card_flip",      gain: 0.8,  pan: 0.0,   desc: "Rollercoaster postcard" },
  { frame: 864,  type: "card_flip",      gain: 0.8,  pan: 0.0,   desc: "Surfing postcard" },
  { frame: 917,  type: "card_flip",      gain: 0.8,  pan: 0.0,   desc: "Wedding postcard" },
  { frame: 1086, type: "phone_beep",     gain: 0.7,  pan: 0.1,   desc: "Dials the office" },
  { frame: 1128, type: "ticket_stamp",   gain: 0.9,  pan: 0.0,   desc: "One-way ticket stamped" },
  { frame: 1215, type: "music_stop",     gain: 1.0,  pan: 0.0,   desc: "Score drops out for the question" },
  { frame: 1259, type: "music_resolve",  gain: 1.0,  pan: 0.0,   desc: "Warm pad enters on the reveal" },
  { frame: 1519, type: "shoe_thud",      gain: 0.8,  pan: -0.2,  desc: "Left shoe lands in the sand" },
  { frame: 1535, type: "shoe_thud",      gain: 0.8,  pan: 0.2,   desc: "Right shoe lands in the sand" },
  { frame: 1556, type: "soft_steps",     gain: 0.5,  pan: 0.0,   desc: "Barefoot steps into the light" },
  { frame: 1614, type: "whoosh",         gain: 0.6,  pan: 0.1,   desc: "Shadow folds down onto the sand" },
  { frame: 1640, type: "shimmer",        gain: 0.9,  pan: 0.0,   desc: "Shadow re-attaches at his heels" },
  { frame: 1766, type: "shimmer",        gain: 0.5,  pan: 0.0,   desc: "The shadow waves first" },
];

// ---------------- Street treadmill kinematics (origin-locked: the man stays at x = 0, the street scrolls) ----------------
export const walkSpeedMps = (f: number): number => {
  if (f >= 155 && f < 262) return 1.3;
  if (f >= 262 && f < 276) return 1.3 * (1 - smooth((f - 262) / 14));
  if (f >= 441 && f < 520) return 4.2 * smooth((f - 438) / 8);
  if (f >= 520 && f < 566) return 4.2 * (1 - smooth((f - 520) / 46));
  return 0;
};
const SCROLL: number[] = (() => {
  const a = [0];
  for (let f = 1; f <= TOTAL + 60; f++) a.push(a[f - 1] + walkSpeedMps(f - 1) / FPS);
  return a;
})();
/** Metres the street has scrolled by frame f */
export const scrollAt = (f: number) => SCROLL[Math.max(0, Math.min(SCROLL.length - 1, Math.round(f)))];

/** Shot 4: the shadow pulls away ahead of the man (x in metres ahead of him) */
export const shadowLeadX = (f: number) => 1.7 + 0.046 * Math.max(0, f - 441);
/** Shot 14: man walks inland (toward the lens) with his shadow in front of him */
export const finalManZ = (f: number) => 2.0 - (f - 1661) / FPS;

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
  // Shot 1: high 3/4 on the man + his sidewalk shadow -> MS of the standing shadow -> pull back as it strolls off
  1: [
    { f: 0,   s: (f) => dolly([1.15, 2.6, -6.2], [0.75, 0.72, 0.45], pushK(f, 0, 0.002, 0.0035, 30), { fov: 46 }) },
    { f: 86,  cut: true, s: (f) => dolly([1.1, 1.35, -3.0], [1.03, 1.02, 0.72], pushK(f, 86, 0.003), { fov: 36 }) },
    { f: 118, dur: 30, s: (f) => dolly([0.55, 1.45, -4.5], [0.5, 1.0, 0.5], pushK(f, 118, 0.002), { fov: 40 }) },
  ],
  // Shot 2: side tracking on the commute treadmill -> low CU at his shoes for the peel
  2: [
    { f: 155, s: (f) => dolly([0.7, 1.6, -6.6], [0.5, 0.95, 0.3], pushK(f, 155, 0.0018), { fov: 44 }) },
    { f: 262, cut: true, s: (f) => dolly([2.7, 2.3, -2.0], [0.75, 0.0, 0.5], pushK(f, 262, 0.002, 0.0035, 30), { fov: 46, roll: -0.03 }) },
  ],
  // Shot 3: man MS ("You're attached!") -> shadow MS ("Not anymore.")
  3: [
    { f: 339, s: (f) => dolly([2.5, 1.5, -1.5], [0, 1.28, 0.3], pushK(f, 339, 0.0028), { fov: 34, roll: 0.02 }) },
    { f: 404, cut: true, s: (f) => dolly([-0.3, 1.4, -1.0], [1.9, 1.08, 0.9], pushK(f, 404, 0.003), { fov: 40, roll: -0.02 }) },
  ],
  // Shot 4: 3/4 front chase (shadow whips past the lens) -> side MS as he runs out of breath
  4: [
    { f: 441, s: (f) => dolly([5.2, 1.35, -0.2], [0.8, 1.0, 0.4], pushK(f, 441, 0.0022), { fov: 42, roll: 0.035 }) },
    { f: 515, cut: true, s: (f) => dolly([0.55, 1.0, -2.7], [0.2, 0.85, 0.3], pushK(f, 515, 0.003), { fov: 36 }) },
  ],
  // Shot 5: office wide -> MS as he checks the carpet beside his chair (nothing there) while everyone types on
  5: [
    { f: 581, s: (f) => dolly([0.25, 2.25, -5.2], [0, 1.0, 2.0], pushK(f, 581, 0.0024), { fov: 44 }) },
    { f: 653, cut: true, s: (f) => dolly([0.55, 1.45, -2.3], [0, 1.15, 0.5], pushK(f, 653, 0.0022), { fov: 38 }) },
  ],
  // Shot 6: apartment door, postcards dropping through the slot
  6: [
    { f: 754, s: (f) => dolly([-0.45, 1.05, -1.3], [-0.9, 0.68, 2.0], pushK(f, 754, 0.0032), { fov: 40 }) },
  ],
  // Shot 7: three postcard inserts (hard cuts on each new card)
  7: [
    { f: 814, s: (f) => dolly([2.36, 1.34, -0.78], [2.4, 1.32, 0.6], pushK(f, 814, 0.0024), { fov: 36, roll: -0.025 }) },
    { f: 864, cut: true, s: (f) => dolly([2.45, 1.31, -0.78], [2.4, 1.32, 0.6], pushK(f, 864, 0.0024), { fov: 36, roll: 0.03 }) },
    { f: 917, cut: true, s: (f) => dolly([2.4, 1.36, -0.8], [2.4, 1.32, 0.6], pushK(f, 917, 0.0022), { fov: 36, roll: -0.015 }) },
  ],
  // Shot 8: over the man's shoulder to the dusty SOMEDAY list
  8: [
    { f: 1010, s: (f) => dolly([0.35, 1.5, -1.35], [0.55, 1.47, 2.2], pushK(f, 1010, 0.003), { fov: 34 }) },
  ],
  // Shot 9: fake cough on the phone -> the one-way ticket
  9: [
    { f: 1083, s: (f) => dolly([0.3, 1.45, -1.3], [0.05, 1.32, 0.9], pushK(f, 1083, 0.0028), { fov: 36 }) },
    { f: 1124, cut: true, s: (f) => dolly([0.05, 1.26, -0.8], [0.05, 1.2, 0.9], pushK(f, 1124, 0.0035), { fov: 36, roll: 0.03 }) },
  ],
  // Shot 10: beach wide -> man MS in the shade -> behind the seated shadow, sun over the sea
  10: [
    { f: 1153, s: (f) => dolly([0.7, 1.9, -9.5], [0.4, 1.25, 2.0], pushK(f, 1153, 0.0018), { fov: 46 }) },
    { f: 1218, cut: true, s: (f) => dolly([0.3, 1.42, 0.3], [-0.3, 1.3, -2.2], pushK(f, 1218, 0.0026), { fov: 34 }) },
    { f: 1259, cut: true, s: (f) => dolly([1.78, 1.02, 2.3], [1.2, 0.9, 5.2], pushK(f, 1259, 0.0022), { fov: 36 }) },
  ],
  // Shot 11: from behind him in the shack's shade, looking out at the sunlit sand and the shadow
  11: [
    { f: 1338, s: (f) => dolly([-1.9, 1.3, -5.6], [0.9, 0.9, 2.5], pushK(f, 1338, 0.003), { fov: 40, roll: -0.02 }) },
  ],
  // Shot 12: CU of the shadow, sun haloed behind its head
  12: [
    { f: 1410, s: (f) => dolly([1.8, 0.98, 2.6], [1.2, 0.86, 5.2], pushK(f, 1410, 0.003), { fov: 32 }) },
  ],
  // Shot 13: shoes come off (low) -> he walks into the light (wide) -> the shadow folds back onto his heels (low)
  13: [
    { f: 1491, s: (f) => dolly([1.2, 0.5, -4.9], [-0.3, 0.32, -2.2], pushK(f, 1491, 0.0026), { fov: 42 }) },
    { f: 1550, cut: true, s: (f) => dolly([-0.4, 1.7, -7.4], [0.5, 0.9, 0.8], pushK(f, 1550, 0.0022), { fov: 42 }) },
    { f: 1612, cut: true, s: (f) => dolly([2.9, 0.75, -1.6], [1.1, 0.32, 0.9], pushK(f, 1612, 0.0028), { fov: 40, roll: 0.02 }) },
  ],
  // Shot 14: backward tracking as he follows his own long shadow, sun behind him
  14: [
    { f: 1661, s: (f) => {
      const z = finalManZ(f), k = pushK(f, 1661, 0.0012);
      return { pos: [3.55, 1.7, z - 0.4 - 5.2 * k], look: [3.25, 0.9, z - 0.4], fov: 50 };
    } },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [300 / FPS, 0.7],   // shadow snaps free
  [556 / FPS, 0.6],   // briefcase drops
  [1128 / FPS, 0.5],  // ticket stamp
  [1640 / FPS, 0.55], // shadow re-attaches
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
  { f: 0,    cInf: 0 },   // street wide sharp
  { f: 86,   cInf: 11 },  // shadow MS
  { f: 118,  dur: 30, cInf: 4 },
  { f: 155,  cInf: 0 },   // commute wide
  { f: 262,  cInf: 9, focus: () => [0.8, 0.05, 0.55] }, // shoes insert
  { f: 339,  cInf: 12 },  // dialogue MS
  { f: 441,  cInf: 0 },   // chase wide
  { f: 515,  cInf: 10 },  // out of breath MS
  { f: 581,  cInf: 0 },   // office wide
  { f: 653,  cInf: 9 },   // man MS, coworkers soft behind
  { f: 754,  cInf: 10, focus: () => [-0.9, 0.5, 1.9] },  // mail slot
  { f: 814,  cInf: 13, focus: () => [2.4, 1.32, 0.6] },  // postcard inserts
  { f: 1010, cInf: 11, focus: () => [0.75, 1.5, 2.2] },  // SOMEDAY list
  { f: 1083, cInf: 12 },  // phone MS
  { f: 1124, cInf: 12 },  // ticket insert
  { f: 1153, cInf: 0 },   // beach wide
  { f: 1218, cInf: 12 },  // man MS
  { f: 1259, cInf: 6 },   // behind the shadow, keep the sun shape
  { f: 1338, cInf: 7, focus: () => [-0.3, 1.2, -2.2] },
  { f: 1410, cInf: 13 },  // shadow CU
  { f: 1491, cInf: 12, focus: () => [-0.3, 0.1, -2.2] }, // shoes
  { f: 1550, cInf: 0 },   // into the light wide
  { f: 1612, cInf: 10, focus: () => [1.0, 0.1, 1.2] },   // heels insert
  { f: 1661, cInf: 0 },   // final wide
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
