// Single-source master timeline for "What If You Woke Up as a Billionaire?" (1,985 frames @ 30 fps = 66.2 s).
// Shot boundaries are fitted to voice/billionaire/words.json (ElevenLabs alignment). Exported to
// out/billionaire/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1985; // 66.17 s (voice ends at 65.26 s)
export const SCORE_STYLE = "bouncy";
export type V3 = [number, number, number];
export type SetName = "bedroom" | "estate" | "boardroom" | "street";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** springy overshoot 0 -> 1 (settles by u = 1) */
export const springIn = (u: number) => { const x = clamp01(u); return 1 - Math.exp(-6 * x) * Math.cos(9 * x) * (1 - x); };

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  set: SetName;
  light: LightMode;
  xfade?: number;
  hud?: "bank" | "phone";
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 130,  set: "bedroom",   light: "interior", hud: "bank" },
  { id: 2,  a: 130,  b: 295,  set: "bedroom",   light: "interior" },
  { id: 3,  a: 295,  b: 382,  set: "estate",    light: "day",      xfade: 6 },
  { id: 4,  a: 382,  b: 494,  set: "estate",    light: "day" },
  { id: 5,  a: 494,  b: 636,  set: "bedroom",   light: "night",    xfade: 8, hud: "phone" },
  { id: 6,  a: 636,  b: 738,  set: "estate",    light: "night",    xfade: 6 },
  { id: 7,  a: 738,  b: 878,  set: "boardroom", light: "interior", xfade: 6 },
  { id: 8,  a: 878,  b: 1075, set: "boardroom", light: "interior" },
  { id: 9,  a: 1075, b: 1198, set: "boardroom", light: "interior" },
  { id: 10, a: 1198, b: 1294, set: "boardroom", light: "interior", xfade: 8 },
  { id: 11, a: 1294, b: 1442, set: "estate",    light: "golden",   xfade: 8, sunAz: 14, sunEl: 7 },
  { id: 12, a: 1442, b: 1560, set: "street",    light: "night",    xfade: 8 },
  { id: 13, a: 1560, b: 1660, set: "street",    light: "night" },
  { id: 14, a: 1660, b: 1708, set: "street",    light: "night" },
  { id: 15, a: 1708, b: 1856, set: "street",    light: "night" },
  { id: 16, a: 1856, b: TOTAL, set: "street",   light: "night" },
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Dialogue windows (frames, from words.json) for mouth flaps ----------------
export const TALK = {
  butler: [[297, 375]] as [number, number][],
  cousin: [[640, 730]] as [number, number][],
  hero: [[745, 790], [882, 1000]] as [number, number][], // telling jokes / pitching the sandwich
  sal: [[1664, 1705], [1893, 1957]] as [number, number][],
  salAsked: [[1592, 1650]] as [number, number][], // hero asks Sal for an honest opinion
};
export const talking = (wins: [number, number][], f: number) => wins.some(([a, b]) => f >= a && f < b);
/** 0..1 mouth flap while inside a talk window */
export const mouthAt = (wins: [number, number][], f: number, rate = 12) =>
  talking(wins, f) ? 0.25 + 0.6 * Math.abs(Math.sin((f / FPS) * rate + 0.6 * Math.sin(f * 0.37))) : 0;

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = { frame: number; type: string; gain?: number; pan?: number; desc: string };

export const EVENTS: StoryEvent[] = [
  { frame: 40,   type: "cash_register", gain: 0.9,  pan: 0.0,  desc: "Bank banner: balance one billion" },
  { frame: 140,  type: "alarm_ring",    gain: 0.9,  pan: -0.25, desc: "Twin-bell alarm clock rattling on the silver tray" },
  { frame: 298,  type: "heli_whir",     gain: 0.8,  pan: -0.3, desc: "Helicopter rotor warming up on the lawn" },
  { frame: 394,  type: "car_whoosh",    gain: 0.9,  pan: -0.4, desc: "Gold supercar zooms in" },
  { frame: 405,  type: "tire_screech",  gain: 0.6,  pan: -0.1, desc: "Supercar skids to a stop" },
  { frame: 411,  type: "cash_register", gain: 0.85, pan: 0.15, desc: "Ka-ching on the purchase" },
  { frame: 457,  type: "yacht_horn",    gain: 0.9,  pan: 0.3,  desc: "Yacht horn blast" },
  { frame: 506,  type: "phone_buzz",    gain: 0.8,  pan: 0.0,  desc: "Phone buzz 1" },
  { frame: 532,  type: "phone_buzz",    gain: 0.8,  pan: 0.0,  desc: "Phone buzz 2" },
  { frame: 556,  type: "phone_buzz",    gain: 0.85, pan: 0.0,  desc: "Phone buzz 3" },
  { frame: 574,  type: "phone_buzz",    gain: 0.9,  pan: 0.0,  desc: "Phone buzz 4" },
  { frame: 590,  type: "phone_buzz",    gain: 0.9,  pan: 0.0,  desc: "Phone buzz 5" },
  { frame: 602,  type: "phone_buzz",    gain: 0.95, pan: 0.0,  desc: "Phone buzz 6" },
  { frame: 642,  type: "gate_rattle",   gain: 0.9,  pan: 0.0,  desc: "Cousins rattle the gold gate" },
  { frame: 748,  type: "crowd_laugh",   gain: 0.8,  pan: 0.0,  desc: "Board laughs at the joke" },
  { frame: 800,  type: "crowd_laugh",   gain: 0.95, pan: 0.15, desc: "Laughs at the bad joke" },
  { frame: 840,  type: "crowd_laugh",   gain: 1.15, pan: -0.1, desc: "Roars at the worst joke" },
  { frame: 999,  type: "stamp",         gain: 1.0,  pan: 0.0,  desc: "FUNDED stamp on the big screen" },
  { frame: 1003, type: "cash_register", gain: 0.9,  pan: 0.1,  desc: "Billion-dollar ka-ching" },
  { frame: 1110, type: "door_open",     gain: 0.8,  pan: -0.35, desc: "Boardroom door swings open" },
  { frame: 1166, type: "record_scratch", gain: 0.9, pan: 0.0,  desc: "Record scratch: lampshade reveal" },
  { frame: 1180, type: "applause",      gain: 1.0,  pan: 0.0,  desc: "Board applauds the lampshade" },
  { frame: 1296, type: "music_stop",    gain: 1.0,  pan: 0.0,  desc: "Score drops out for the You see pivot" },
  { frame: 1444, type: "music_resume",  gain: 1.0,  pan: 0.0,  desc: "Soft night theme at the hot-dog cart" },
  { frame: 1565, type: "sizzle",        gain: 0.8,  pan: 0.1,  desc: "Hot dogs sizzling on the cart grill" },
  { frame: 1796, type: "pen_scribble",  gain: 0.9,  pan: -0.1, desc: "Scribbling the million-dollar check" },
  { frame: 1838, type: "paper_tear",    gain: 0.9,  pan: 0.0,  desc: "Tearing the check out of the book" },
  { frame: 1934, type: "final_sting",   gain: 1.0,  pan: 0.0,  desc: "Button sting on terrible" },
];

// ---------------- Shared kinematics (used by sets.ts and CAMS) ----------------
/** Hero sits up in bed: 0 lying -> 1 upright, jolts on "billionaire" (f39) */
export const sitUpK = (f: number) => (f < 36 ? 0 : springIn((f - 36) / 14));
/** Gold supercar x on the drive: zooms in from screen left, skids to a stop at f409 */
export const carX = (f: number) => {
  const u = clamp01((f - 390) / 19);
  return -16 * (1 - u) ** 2.2 + (f >= 409 ? 0.12 * Math.sin((f - 409) * 0.9) * Math.exp(-(f - 409) / 6) : 0);
};
/** Shot 12 street walk: hero x along the sidewalk */
export const walkX = (f: number) => -5.2 + 4.7 * smooth((f - 1446) / 104);
/** Lampshade walk-in (Shot 9): 0 at the door -> 1 at the head of the table */
export const walkInK = (f: number) => smooth((f - 1112) / 52);

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
  // Shot 1: foot-of-bed high angle on the sleeper -> jolts awake (kick f40) -> glide back to reveal the gold bed
  1: [
    { f: 0,  s: (f) => dolly([0, 2.3, 1.15], [0, 1.0, 3.25], pushK(f, 0, 0.003), { fov: 42 }) },
    { f: 62, dur: 30, s: (f) => dolly([0.5, 1.8, -1.6], [0, 1.55, 3.4], pushK(f, 62, 0.0024), { fov: 46, roll: -0.02 }) },
  ],
  // Shot 2: OTS the butler (tray + ringing clock) -> crane up and back: the bed is bigger than his old apartment
  2: [
    { f: 130, cut: true, s: (f) => dolly([3.4, 1.75, 1.4], [-2.2, 1.35, 2.75], pushK(f, 130, 0.0028), { fov: 42 }) },
    { f: 226, dur: 34, s: (f) => dolly([3.2, 4.7, -5.4], [0, 0.8, 2.6], pushK(f, 226, 0.0022), { fov: 52, roll: 0.03 }) },
  ],
  // Shot 3: estate lawn, butler announces the helicopter warming up behind him
  3: [
    { f: 295, s: (f) => dolly([-3.0, 1.5, -6.6], [-4.4, 1.65, 0.2], pushK(f, 295, 0.0026), { fov: 44 }) },
  ],
  // Shot 4: gold supercar skids in (kick f409) -> glide right across the lawn to the yacht at the dock
  4: [
    { f: 382, cut: true, s: (f) => dolly([2.6, 1.35, -6.4], [0.5, 0.95, 1.3], pushK(f, 382, 0.0025), { fov: 42 }) },
    { f: 444, dur: 32, s: (f) => dolly([6.0, 2.6, -11.5], [19.0, 2.1, 3.0], pushK(f, 444, 0.0022), { fov: 50, roll: 0.02 }) },
  ],
  // Shot 5: night, bed, phone glow on his face (phone HUD overlay carries the missed-call counter)
  5: [
    { f: 494, s: (f) => dolly([0.3, 1.66, 0.95], [0, 1.45, 2.85], pushK(f, 494, 0.0028), { fov: 42 }) },
  ],
  // Shot 6: night, inside the gate: cousin pressed to the gold bars -> pull back reveals a crowd of cousins
  6: [
    { f: 636, s: (f) => dolly([0.35, 1.55, -8.4], [0, 1.4, -12.8], pushK(f, 636, 0.003), { fov: 40 }) },
    { f: 684, dur: 30, s: (f) => dolly([1.0, 2.3, -3.6], [0, 1.35, -12.6], pushK(f, 684, 0.0022), { fov: 46 }) },
  ],
  // Shot 7: down the boardroom table: everyone laughing -> glide onto two hysterical execs
  7: [
    { f: 738, s: (f) => dolly([0, 2.2, -4.4], [0, 1.15, 4.0], pushK(f, 738, 0.0024), { fov: 46 }) },
    { f: 796, dur: 26, s: (f) => dolly([0.4, 1.5, 4.5], [-1.0, 1.15, 1.1], pushK(f, 796, 0.0026, 0.006, 30), { fov: 42, roll: 0.03 }) },
    { f: 834, dur: 22, s: (f) => dolly([-0.4, 1.5, 4.5], [1.0, 1.15, -0.2], pushK(f, 834, 0.003, 0.007, 30), { fov: 42, roll: -0.035 }) },
  ],
  // Shot 8: front on the hero holding up the double sandwich; FUNDED screen behind (kick f999)
  8: [
    { f: 878, s: (f) => dolly([0, 1.62, 2.1], [0, 1.9, 6.0], pushK(f, 878, 0.0022), { fov: 44 }) },
    { f: 990, dur: 20, s: (f) => dolly([0.25, 1.7, 2.6], [0, 2.2, 6.6], pushK(f, 990, 0.002), { fov: 48, roll: 0.02 }) },
  ],
  // Shot 9: the door opens, he walks in wearing a lampshade -> board applauds
  9: [
    { f: 1075, cut: true, s: (f) => dolly([0.9, 1.45, 0.4], [-2.4, 1.4, 6.3], pushK(f, 1075, 0.0024), { fov: 40 }) },
    { f: 1172, dur: 22, s: (f) => dolly([0.2, 1.75, -3.2], [-0.4, 1.2, 4.6], pushK(f, 1172, 0.0024), { fov: 46 }) },
  ],
  // Shot 10: next morning, symmetrical wide: the entire board in lampshades
  10: [
    { f: 1198, s: (f) => dolly([0, 2.1, -5.2], [0, 1.1, 4.2], pushK(f, 1198, 0.0026), { fov: 44 }) },
  ],
  // Shot 11: golden hour, alone on the end of the dock beside the yacht; slow pull back (the "You see" pivot)
  11: [
    { f: 1294, s: (f) => dolly([19.2, 1.35, -2.9], [22.0, 0.85, -0.2], 1 / pushK(f, 1294, 0.0022), { fov: 42 }) },
  ],
  // Shot 12: night street tracking shot: hood up, he walks to the hot-dog cart
  12: [
    { f: 1442, s: (f) => { const x = walkX(f); return { pos: [x + 2.9, 1.4, -3.0], look: [x - 0.2, 1.15, 0.6], fov: 42 }; } },
  ],
  // Shot 13: over his shoulder to Sal behind the cart
  13: [
    { f: 1560, cut: true, s: (f) => dolly([1.25, 1.6, -2.0], [-0.1, 1.45, 2.2], pushK(f, 1560, 0.0024), { fov: 40 }) },
  ],
  // Shot 14: Sal close-up: "Kid, you look terrible."
  14: [
    { f: 1660, cut: true, s: (f) => dolly([0.06, 1.55, 0.55], [0, 1.52, 2.15], pushK(f, 1660, 0.0032), { fov: 36 }) },
  ],
  // Shot 15: his delighted close-up -> glide to the side two-shot as he hands over the check
  15: [
    { f: 1708, cut: true, s: (f) => dolly([-0.3, 1.5, 1.45], [0, 1.47, 0.1], pushK(f, 1708, 0.0026), { fov: 38 }) },
    { f: 1782, dur: 28, s: (f) => dolly([6.4, 1.7, 1.0], [0, 1.3, 1.12], pushK(f, 1782, 0.0022), { fov: 46 }) },
  ],
  // Shot 16: insert: Sal squints at the check; push to the end
  16: [
    { f: 1856, cut: true, s: (f) => dolly([0.05, 1.5, 0.3], [0, 1.42, 2.0], pushK(f, 1856, 0.0028, 0.005, 30), { fov: 38 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [40 / FPS, 0.9],    // wakes up a billionaire
  [409 / FPS, 1.1],   // supercar skids in
  [999 / FPS, 0.85],  // FUNDED stamp
  [1166 / FPS, 0.6],  // lampshade reveal
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
  { f: 0,    cInf: 12, focus: (f) => [0, 1.0 + 0.55 * sitUpK(f), 3.3 - 0.5 * sitUpK(f)] }, // sleeper CU
  { f: 62,   dur: 30, cInf: 7, focus: () => [0, 1.55, 2.8] },
  { f: 130,  cInf: 11, focus: () => [0, 1.5, 2.8] },   // past the butler's tray onto the hero
  { f: 226,  dur: 30, cInf: 0 },                         // crane wide: all sharp
  { f: 295,  cInf: 10, focus: () => [-4.2, 1.5, -2.0] }, // butler MS, helicopter soft
  { f: 382,  cInf: 8, focus: () => [0.9, 1.0, 1.0] },
  { f: 444,  dur: 30, cInf: 0 },                         // yacht wide
  { f: 494,  cInf: 13, focus: () => [0, 1.5, 2.75] },   // phone-lit face CU
  { f: 636,  cInf: 12, focus: () => [0, 1.4, -12.7] },  // cousin through the bars
  { f: 684,  dur: 30, cInf: 6, focus: () => [0, 1.4, -12.7] },
  { f: 738,  cInf: 6, focus: () => [0, 1.4, 4.9] },
  { f: 796,  dur: 26, cInf: 12, focus: () => [-1.15, 1.3, 2.5] },
  { f: 834,  cInf: 11, focus: () => [1.15, 1.3, 2.5] },
  { f: 878,  cInf: 11, focus: () => [0, 1.6, 5.2] },    // hero + sandwich, screen soft
  { f: 990,  dur: 20, cInf: 4, focus: () => [0, 1.8, 5.4] },
  { f: 1075, cInf: 10 },
  { f: 1172, dur: 22, cInf: 5 },
  { f: 1198, cInf: 0 },                                  // symmetrical lampshade wide
  { f: 1294, cInf: 10, focus: () => [21.6, 0.7, -0.5] }, // lonely dock
  { f: 1442, cInf: 10 },
  { f: 1560, cInf: 12, focus: () => [0, 1.5, 2.15] },
  { f: 1660, cInf: 14, focus: () => [0, 1.52, 2.15] },  // Sal CU
  { f: 1708, cInf: 14, focus: () => [0, 1.47, 0.15] },  // hero CU
  { f: 1782, dur: 28, cInf: 7, focus: () => [0, 1.3, 1.1] },
  { f: 1856, cInf: 13, focus: () => [0, 1.4, 1.75] },   // check insert
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
