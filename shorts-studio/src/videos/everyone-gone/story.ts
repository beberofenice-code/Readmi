// Single-source master timeline for "What If You Woke Up and Everyone Was Gone?" (58.2 s / 1,745 frames @ 30 fps).
// Shot lengths are fitted to voice/everyone-gone/words.json (narration ends at f1690).
// Exported to out/everyone-gone/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1745; // 58.17 s
export type V3 = [number, number, number];
export type SetName = "bedroom" | "street" | "highway" | "market" | "mansion" | "plant" | "kitchen" | "tower";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  set: SetName;
  light: LightMode;
  xfade?: number; // frames of dissolve into this shot (stitched via FFmpeg xfade in per-shot mode)
  hud?: string;
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 96,   set: "bedroom", light: "interior" },                 // "You wake up one morning..."
  { id: 2,  a: 96,   b: 265,  set: "street",  light: "day" },                      // silent street, open doors, phone
  { id: 3,  a: 265,  b: 410,  set: "street",  light: "day" },                      // best day of your life
  { id: 4,  a: 410,  b: 480,  set: "highway", light: "day", sunAz: 120, sunEl: 40 }, // sports car
  { id: 5,  a: 480,  b: 580,  set: "market",  light: "interior" },                 // free supermarket cart
  { id: 6,  a: 580,  b: 756,  set: "mansion", light: "golden",  xfade: 6, sunAz: 150, sunEl: 16 }, // mansion + "king of everything"
  { id: 7,  a: 756,  b: 818,  set: "street",  light: "night",   xfade: 8 },        // day three: the lights go out
  { id: 8,  a: 818,  b: 895,  set: "plant",   light: "night" },                    // nobody runs the power plant
  { id: 9,  a: 895,  b: 947,  set: "kitchen", light: "night" },                    // the taps run dry
  { id: 10, a: 947,  b: 1022, set: "market",  light: "night" },                    // the food rots
  { id: 11, a: 1022, b: 1300, set: "tower",   light: "night",   xfade: 6 },        // radio tower, "Hello?", static
  { id: 12, a: 1300, b: 1582, set: "street",  light: "golden",  xfade: 8, sunAz: 25, sunEl: 14 }, // a thousand strangers
  { id: 13, a: 1582, b: TOTAL, set: "mansion", light: "night",  xfade: 8 },        // "...is a neighbor."
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "alarm_clock"
    | "wind_gust"
    | "phone_ringout"
    | "whoosh"
    | "engine_rev"
    | "cart_rattle"
    | "crown_ding"
    | "power_down"
    | "music_stop"
    | "music_lonely"
    | "steam_hiss"
    | "tap_sputter"
    | "water_drip"
    | "flies_buzz"
    | "radio_static"
    | "ghost_chime"
    | "crowd_murmur"
    | "music_resolve";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 3,    type: "alarm_clock",   gain: 0.6,  pan: 0.25,  desc: "Bedside alarm beeps, nobody else hears it" },
  { frame: 100,  type: "wind_gust",     gain: 0.8,  pan: 0.0,   desc: "Wind through an empty street" },
  { frame: 212,  type: "phone_ringout", gain: 0.7,  pan: 0.15,  desc: "Phone rings out, nobody picks up" },
  { frame: 349,  type: "whoosh",        gain: 0.8,  pan: -0.3,  desc: "Briefcase tossed away (no boss)" },
  { frame: 412,  type: "engine_rev",    gain: 0.9,  pan: 0.0,   desc: "Sports car roars down the empty highway" },
  { frame: 484,  type: "cart_rattle",   gain: 0.7,  pan: 0.0,   desc: "Overloaded shopping cart rattles past the empty checkout" },
  { frame: 693,  type: "crown_ding",    gain: 0.8,  pan: 0.0,   desc: "Crown sparkle as you declare yourself king" },
  { frame: 756,  type: "music_stop",    gain: 1.0,  pan: 0.0,   desc: "Score drops out on day three" },
  { frame: 794,  type: "power_down",    gain: 1.0,  pan: 0.0,   desc: "City grid winds down, windows go dark block by block" },
  { frame: 822,  type: "steam_hiss",    gain: 0.75, pan: -0.1,  desc: "Cooling towers exhale their last steam" },
  { frame: 880,  type: "music_lonely",  gain: 1.0,  pan: 0.0,   desc: "Sparse music-box motif for the empty world" },
  { frame: 900,  type: "tap_sputter",   gain: 0.8,  pan: 0.0,   desc: "Kitchen tap coughs air" },
  { frame: 918,  type: "water_drip",    gain: 0.8,  pan: 0.05,  desc: "Second to last drop" },
  { frame: 932,  type: "water_drip",    gain: 0.65, pan: -0.05, desc: "Last drop" },
  { frame: 955,  type: "flies_buzz",    gain: 0.7,  pan: -0.2,  desc: "Flies over rotting supermarket shelves" },
  { frame: 1026, type: "wind_gust",     gain: 0.9,  pan: 0.0,   desc: "High wind on the radio tower" },
  { frame: 1186, type: "radio_static",  gain: 0.85, pan: 0.1,   desc: "Only static answers" },
  { frame: 1398, type: "ghost_chime",   gain: 0.7,  pan: -0.3,  desc: "Every light: the electrician appears" },
  { frame: 1426, type: "ghost_chime",   gain: 0.7,  pan: 0.3,   desc: "Every tap: the plumber appears" },
  { frame: 1449, type: "ghost_chime",   gain: 0.75, pan: 0.0,   desc: "Every slice of bread: the baker appears" },
  { frame: 1492, type: "crowd_murmur",  gain: 0.8,  pan: 0.0,   desc: "A thousand strangers fill the street" },
  { frame: 1578, type: "music_resolve", gain: 1.0,  pan: 0.0,   desc: "Warm resolve pad under the final line" },
];

// ---------------- Shared kinematics (used by sets.ts and cameras) ----------------
/** [YOU] dialogue windows from words.json, in frames */
export const YOU_TALK: [number, number][] = [[696, 757], [1135, 1184]];
export const talkK = (f: number) => {
  for (const [a, b] of YOU_TALK) if (f >= a && f < b) return 0.3 + 0.6 * Math.abs(Math.sin(f * 0.47));
  return 0;
};
/** Shot 4 treadmill speed (m/s) */
export const HWY_SPEED = 34;
/** Shot 5 cart position along the aisle */
export const cartZ = (f: number) => 6.4 - 4.2 * clamp01((f - 480) / 106);
/** Shot 11 ladder climb height (root y) */
export const climbY = (f: number) => 11 + (f - 1022) * 0.09;
export const TOWER_TOP = 30;
/** Shot 7 blackout wave: frame at which a window at depth z goes dark (far -> near) */
export const blackoutAt = (z: number, jitter = 0) => 792 + 20 * clamp01(1 - (z + 30) / 170) + 4 * jitter;
/** Shot 12 memory wave: windows light back up near -> far as the strangers appear */
export const relightAt = (z: number, jitter = 0) => 1490 + 55 * clamp01((z + 30) / 170) + 8 * jitter;

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
  // Shot 1: bedroom medium -> punch-in on the wide-awake face
  1: [
    { f: 0,  s: (f) => dolly([0.75, 1.5, -2.15], [-0.45, 1.02, 1.3], pushK(f, 0, 0.003, 0.006, 24), { fov: 42 }) },
    { f: 42, cut: true, s: (f) => dolly([0.35, 1.38, -0.95], [-0.5, 1.16, 1.45], pushK(f, 42, 0.003), { fov: 38, roll: -0.03 }) },
  ],
  // Shot 2: high wide of the dead-quiet street -> low pass by an abandoned car door -> phone to the ear
  2: [
    { f: 96,  s: (f) => dolly([0.4, 6.2, -8.5], [0, 1.4, 16], pushK(f, 96, 0.0022), { fov: 46 }) },
    { f: 141, cut: true, s: (f) => dolly([-8.0 + (f - 141) * 0.012, 1.7, 2.4], [-3.5, 0.8, 7.0], pushK(f, 141, 0.0026), { fov: 40, roll: 0.03 }) },
    { f: 207, cut: true, s: (f) => dolly([1.0, 1.45, -1.3], [0.3, 1.25, 1.5], pushK(f, 207, 0.0028), { fov: 38 }) },
  ],
  // Shot 3: low hero angle on the victory dance -> high crane as you run down the centre line
  3: [
    { f: 265, s: (f) => dolly([-0.9, 0.75, -1.5], [0.3, 1.3, 1.5], pushK(f, 265, 0.0024), { fov: 44, roll: -0.03 }) },
    { f: 366, cut: true, s: (f) => dolly([0, 7.5, -6.5], [0, 1.0, 13], pushK(f, 366, 0.0026), { fov: 44 }) },
  ],
  // Shot 4: front three-quarter on the convertible, drifting to the side
  4: [
    { f: 410, s: (f) => dolly([2.7, 1.15, 5.6], [-0.2, 1.0, 0.2], pushK(f, 410, 0.003, 0.006, 24), { fov: 40, roll: 0.04 }) },
    { f: 440, dur: 30, s: (f) => dolly([5.2, 1.5, 1.6], [-0.2, 1.0, 0.0], pushK(f, 440, 0.0024), { fov: 38, roll: -0.02 }) },
  ],
  // Shot 5: backing down the aisle ahead of the overloaded cart
  5: [
    { f: 480, s: (f) => dolly([-1.7, 1.5, cartZ(f) - 4.2], [0.05, 1.0, cartZ(f) + 0.3], pushK(f, 480, 0.0022), { fov: 42 }) },
  ],
  // Shot 6: worm's-eye wide of the mansion -> coronation close-up on the porch
  6: [
    { f: 580, s: (f) => dolly([-2.6, 0.9, -21], [0, 4.0, 6], pushK(f, 580, 0.0022), { fov: 46 }) },
    { f: 693, cut: true, s: (f) => dolly([0.55, 1.6, 0.5], [0, 1.72, 3.2], pushK(f, 693, 0.003, 0.006, 26), { fov: 36, roll: 0.03 }) },
  ],
  // Shot 7: rooftop-height look down the avenue as the grid fails
  7: [
    { f: 756, s: (f) => dolly([0, 10.5, -14], [0, 6.0, 30], pushK(f, 756, 0.0022), { fov: 44 }) },
  ],
  // Shot 8: abandoned hard hat in the foreground, cooling towers going quiet
  8: [
    { f: 818, s: (f) => dolly([0.4, 0.7, -3.0], [0.6, 5.0, 30], pushK(f, 818, 0.0018), { fov: 46, roll: -0.03 }) },
  ],
  // Shot 9: kitchen tap close-up
  9: [
    { f: 895, s: (f) => dolly([0.5, 1.5, -3.0], [-0.4, 1.2, 0.8], pushK(f, 895, 0.003), { fov: 44 }) },
  ],
  // Shot 10: candle-lit aisle of rotting shelves
  10: [
    { f: 947, s: (f) => dolly([0.55, 1.4, 0.6], [-1.5, 1.2, 3.9], pushK(f, 947, 0.0028), { fov: 42, roll: 0.03 }) },
  ],
  // Shot 11: crane up the ladder -> platform close-up for "Hello?" -> long pull-back into the dark
  11: [
    { f: 1022, s: (f) => ({ pos: [8.5, climbY(f) + 1.0, -13.5], look: [0, climbY(f) + 2.2, 0], fov: 42 }) },
    { f: 1130, cut: true, s: (f) => dolly([0.8, TOWER_TOP + 1.5, -3.3], [0.1, TOWER_TOP + 1.2, 0], pushK(f, 1130, 0.0025), { fov: 38 }) },
    { f: 1226, dur: 40, s: (f) => dolly([8, TOWER_TOP + 7, -36], [0, TOWER_TOP - 2, 0], pushK(f, 1226, -0.0014), { fov: 40 }) },
  ],
  // Shot 12: alone in the golden street -> rise as the strangers fade in around you
  12: [
    { f: 1300, s: (f) => dolly([0.35, 1.5, -1.9], [0, 1.3, 2], pushK(f, 1300, 0.0022), { fov: 38 }) },
    { f: 1384, dur: 36, s: (f) => dolly([0, 3.6, -7.5], [0, 1.35, 10], pushK(f, 1384, 0.0018), { fov: 44 }) },
  ],
  // Shot 13: king on his own doorstep -> slow pull-back to the dark house
  13: [
    { f: 1582, s: (f) => dolly([0.7, 1.0, 0.4], [0, 0.95, 2.95], pushK(f, 1582, 0.002), { fov: 38 }) },
    { f: 1632, dur: 40, s: (f) => dolly([0, 0.9, -18], [0, 3.9, 5], pushK(f, 1632, -0.0016), { fov: 46 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [8 / FPS, 0.6],     // eyes snap open
  [349 / FPS, 0.6],   // briefcase toss
  [693 / FPS, 0.5],   // crown
  [796 / FPS, 0.9],   // grid goes down
  [1449 / FPS, 0.45], // baker pops in
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
  { f: 0,    cInf: 10 },                                    // bedroom MS
  { f: 42,   cInf: 13 },                                    // face CU
  { f: 96,   cInf: 0 },                                     // street wide
  { f: 141,  cInf: 11 },                                    // car door insert
  { f: 207,  cInf: 13 },                                    // phone MS
  { f: 265,  cInf: 10 },                                    // dance MS
  { f: 366,  cInf: 0 },                                     // crane wide
  { f: 410,  cInf: 10, focus: () => [-0.4, 1.2, -0.3] },    // convertible
  { f: 480,  cInf: 10, focus: (f) => [0, 1.1, cartZ(f)] },  // cart
  { f: 580,  cInf: 0 },                                     // mansion wide
  { f: 693,  cInf: 14 },                                    // coronation CU
  { f: 756,  cInf: 0 },                                     // avenue wide
  { f: 818,  cInf: 0 },                                     // plant wide (hard hat foreground)
  { f: 895,  cInf: 13 },                                    // tap insert
  { f: 947,  cInf: 11 },                                    // rotten shelf
  { f: 1022, cInf: 0 },                                     // tower wide
  { f: 1130, cInf: 12, focus: () => [0, TOWER_TOP + 1.3, 0] }, // platform CU
  { f: 1226, dur: 30, cInf: 0 },                            // pull-back
  { f: 1300, cInf: 12 },                                    // lonely MS
  { f: 1384, dur: 30, cInf: 0 },                            // crowd wide
  { f: 1582, cInf: 12 },                                    // doorstep MS
  { f: 1632, dur: 36, cInf: 0 },                            // final wide
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
