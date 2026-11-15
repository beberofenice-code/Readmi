// Single-source master timeline for the 62.2 s Dashcam short (1,867 frames @ 30 fps).
// Exported to out/dashcam/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1867; // 62.23 s
export type V3 = [number, number, number];
export type SetName = "car_cabin" | "highway" | "driveway" | "office" | "pool";

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
  hud?: "dashcam";
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 42,   set: "car_cabin", light: "day" },
  { id: 2,  a: 42,   b: 126,  set: "highway",   light: "day" },
  { id: 3,  a: 126,  b: 295,  set: "highway",   light: "day" },
  { id: 4,  a: 295,  b: 465,  set: "driveway",  light: "day",      xfade: 6 },
  { id: 5,  a: 465,  b: 815,  set: "highway",   light: "golden",   xfade: 6, sunAz: 10, sunEl: 8 },
  { id: 6,  a: 815,  b: 945,  set: "driveway",  light: "night",    xfade: 8 },
  { id: 7,  a: 945,  b: 1075, set: "office",    light: "interior", xfade: 6 },
  { id: 8,  a: 1075, b: 1145, set: "pool",      light: "night" },
  { id: 9,  a: 1145, b: 1305, set: "driveway",  light: "night",    xfade: 6 },
  { id: 10, a: 1305, b: 1490, set: "highway",   light: "rain",     xfade: 8 },
  { id: 11, a: 1490, b: 1645, set: "car_cabin", light: "rain" },
  { id: 12, a: 1645, b: TOTAL, set: "highway",  light: "rain",     hud: "dashcam" },
];

export const FLASH_AT = -1; // No white flash needed; hard cut from brake pedal to highway smash

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "brake_slam"
    | "tire_screech"
    | "crash_impact"
    | "cash_register"
    | "money_rain"
    | "lane_swoop"
    | "phone_ring"
    | "counter_flip"
    | "hottub_bubbles"
    | "siren_chirp"
    | "wiper_sweep"
    | "music_stop"
    | "camera_beep";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 14,   type: "brake_slam",    gain: 0.9,  pan: 0.1,  desc: "Boot stomps brake pedal inside scammer sedan" },
  { frame: 20,   type: "tire_screech",  gain: 1.0,  pan: 0.0,  desc: "Locked highway tires screeching on dry asphalt" },
  { frame: 78,   type: "crash_impact",  gain: 1.2,  pan: -0.1, desc: "White SUV rear-ends red sedan bumper" },
  { frame: 325,  type: "cash_register", gain: 0.85, pan: -0.2, desc: "PAID stamp lands on repair invoice" },
  { frame: 405,  type: "money_rain",    gain: 0.9,  pan: 0.15, desc: "Fat insurance settlement check + fluttering cash" },
  { frame: 695,  type: "lane_swoop",    gain: 0.8,  pan: -0.35, desc: "Accomplice black pickup boxes victim into right lane" },
  { frame: 905,  type: "crash_impact",  gain: 1.15, pan: 0.25, desc: "Lime supercar backs into box truck for payout" },
  { frame: 952,  type: "phone_ring",    gain: 0.75, pan: 0.0,  desc: "Insurance claims adjuster desk call" },
  { frame: 1005, type: "counter_flip",  gain: 0.8,  pan: 0.2,  desc: "Days Since Neck Injury sign flips 2 -> 0" },
  { frame: 1075, type: "hottub_bubbles",gain: 0.7,  pan: 0.0,  desc: "Backyard hot tub jets bubbling at night" },
  { frame: 1160, type: "siren_chirp",   gain: 0.65, pan: -0.3, desc: "Police cruiser strobe & ticket handoff" },
  { frame: 1388, type: "tire_screech",  gain: 0.95, pan: 0.0,  desc: "Wet-road hydroplane brake-check screech" },
  { frame: 1418, type: "crash_impact",  gain: 1.1,  pan: 0.0,  desc: "Old wood-panel wagon taps scammer bumper in rain" },
  { frame: 1486, type: "music_stop",    gain: 1.0,  pan: 0.0,  desc: "Hard score dropout as quiet driver stays calm" },
  { frame: 1585, type: "camera_beep",   gain: 0.85, pan: 0.15, desc: "Little windshield dashcam REC beep" },
  { frame: 1650, type: "wiper_sweep",   gain: 0.65, pan: 0.0,  desc: "Dashcam POV windshield wiper sweep 1" },
  { frame: 1715, type: "wiper_sweep",   gain: 0.65, pan: 0.0,  desc: "Dashcam POV windshield wiper sweep 2" },
  { frame: 1780, type: "wiper_sweep",   gain: 0.65, pan: 0.0,  desc: "Dashcam POV windshield wiper sweep 3" },
];

// ---------------- Treadmill & Vehicle Kinematics ----------------
export const highwaySpeedMps = (f: number): number => {
  if (f < 16) return 24;
  if (f < 78) return 24 * (1 - smooth((f - 16) / 48));
  if (f >= 465 && f < 815) return 22;
  if (f >= 1305 && f < 1388) return 24;
  if (f >= 1388 && f < 1418) return 24 * (1 - smooth((f - 1388) / 28));
  if (f >= 1645 && f < 1710) return 24.1 * (1 - smooth((f - 1675) / 32)); // 54 MPH -> 0 MPH on Dashcam HUD
  return 0;
};

/** Shot 10 wood-panel wagon (victim car) position; shared by sets.ts and the hood-cam in CAMS[10] */
export const wagonZ = (f: number) => (f < 1418 ? -6.8 + 2.6 * smooth((f - 1385) / 33) : -4.2);

/** Brake-light level 0..1, eased over 4 frames at each edge (no single-frame light pops) */
export const brakeK = (f: number) => {
  const win: [number, number][] = [[16, 95], [1385, 1440], [1675, 1760]];
  let k = 0;
  for (const [a, b] of win) k = Math.max(k, Math.min(1, Math.max(0, (f - a + 1) / 4), Math.max(0, (b - f) / 4)));
  return k;
};

export const dashcamMph = (f: number): number => highwaySpeedMps(f) * 2.23694;

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
  // Shot 1: Cabin low-angle push to brake pedal slam
  1: [
    { f: 0,  s: (f) => dolly([1.75, 0.92, 0.12], [-0.3, 0.86, 0.15], pushK(f, 0, 0.003, 0.006, 24), { fov: 56 }) },
    { f: 13, cut: true, s: (f) => dolly([0.66, 0.54, 0.4], [-0.16, 0.27, 0.74], pushK(f, 13, 0.0035), { fov: 48, roll: -0.04 }) },
  ],
  // Shot 2: Highway side-tracking -> bumper smash close-up
  2: [
    { f: 42, s: (f) => dolly([5.8, 1.55, -2.8], [0, 0.95, -1.2], pushK(f, 42, 0.0025), { fov: 42 }) },
    { f: 68, dur: 22, s: (f) => dolly([3.2, 1.05, -3.4], [0, 0.75, -2.4], pushK(f, 68, 0.003, 0.006, 28), { fov: 36, roll: 0.045 }) },
  ],
  // Shot 3: Victim windshield POV -> roadside neck-clutch acting beat
  3: [
    { f: 126, cut: true, s: (f) => dolly([0, 1.32, -4.6], [0, 1.05, -0.5], pushK(f, 126, 0.0022), { fov: 44 }) },
    { f: 168, cut: true, s: (f) => dolly([2.6, 1.25, -2.9], [-0.6, 1.15, -1.5], pushK(f, 168, 0.0025), { fov: 38, roll: -0.035 }) },
  ],
  // Shot 4: Suburban driveway lateral pan across repair bill, doctor, agent & cash pile
  4: [
    { f: 295, s: (f) => dolly([-2.3, 1.6, -6.3], [-1.45, 1.2, -0.8], pushK(f, 295, 0.002), { fov: 40 }) },
    { f: 350, dur: 36, s: (f) => dolly([2.0, 1.6, -6.3], [1.35, 1.25, -0.8], pushK(f, 350, 0.0028, 0.0055, 32), { fov: 40 }) },
  ],
  // Shot 5: Golden-hour highway target selection + 2-car box-in crane rise
  5: [
    { f: 465, s: (f) => dolly([1.8, 1.6, 4.8], [0, 1.15, -3.5], pushK(f, 465, 0.002), { fov: 40 }) },
    { f: 585, dur: 28, s: (f) => dolly([-3.8, 2.5, -10.5], [0, 0.95, -3.4], pushK(f, 585, 0.0022), { fov: 42 }) },
    { f: 685, dur: 34, s: (f) => dolly([0.4, 5.8, -10.5], [-0.8, 1.0, -1.5], pushK(f, 685, 0.0025), { fov: 44, roll: 0.04 }) },
  ],
  // Shot 6: Night cash-stuffed garage -> whip glide to supercar crash
  6: [
    { f: 815, s: (f) => dolly([0.8, 1.6, -5.4], [0.3, 1.25, 3.2], pushK(f, 815, 0.0026), { fov: 44 }) },
    { f: 880, dur: 20, s: (f) => dolly([11.0, 3.0, -1.4], [1.7, 1.1, -7.0], pushK(f, 880, 0.003, 0.006, 26), { fov: 46, roll: -0.05 }) },
  ],
  // Shot 7: Insurance skyscraper office symmetrical dolly to desk counter flip
  7: [
    { f: 945, s: (f) => dolly([0.2, 1.48, -3.6], [0, 1.22, 0.2], pushK(f, 945, 0.0024), { fov: 38 }) },
    { f: 998, dur: 24, s: (f) => dolly([0.45, 1.28, -1.85], [0.35, 1.06, 0.1], pushK(f, 998, 0.003), { fov: 35 }) },
  ],
  // Shot 8: Night backyard hot tub close-medium
  8: [
    { f: 1075, cut: true, s: (f) => dolly([-0.4, 1.38, -3.1], [0, 1.12, 0], pushK(f, 1075, 0.0032), { fov: 38 }) },
  ],
  // Shot 9: Night driveway trooper ticketing victim in foreground, smug scammer behind
  9: [
    { f: 1145, s: (f) => dolly([-0.15, 1.5, -18.6], [0.0, 1.2, -12.6], pushK(f, 1145, 0.0022), { fov: 44, roll: 0.03 }) },
    { f: 1215, dur: 30, s: (f) => dolly([-0.05, 1.48, -17.4], [0.15, 1.3, -12.5], pushK(f, 1215, 0.002), { fov: 40, roll: 0.02 }) },
  ],
  // Shot 10: Rainy highway wood-panel wagon profile -> victim windshield POV crash
  10: [
    { f: 1305, s: (f) => dolly([5.2, 1.45, -3.8], [0, 1.05, -3.6], pushK(f, 1305, 0.0024), { fov: 40 }) },
    // hood-cam rides with the wagon (a fixed camera let the wagon drive through the lens at f1405-1412)
    { f: 1372, cut: true, s: (f) => ({ pos: [0, 1.5, wagonZ(f) + 0.5], look: [0, 0.95, wagonZ(f) + 6.0], fov: 50 }) },
    // "...and out he comes, clutching his neck": 3/4 angle on the scammer beside his crushed bumper
    { f: 1440, cut: true, s: (f) => dolly([3.6, 1.5, -6.0], [0.7, 1.05, -2.2], pushK(f, 1440, 0.0024), { fov: 40 }) },
  ],
  // Shot 11: Quiet driver cabin OTS -> glide zoom to taped windshield dashcam
  11: [
    { f: 1490, cut: true, s: (f) => dolly([0.05, 1.55, -1.25], [-0.12, 1.36, 0.78], pushK(f, 1490, 0.0022), { fov: 44 }) },
    { f: 1568, dur: 26, s: (f) => dolly([0.06, 1.42, 0.1], [-0.05, 1.43, 0.74], pushK(f, 1568, 0.0035, 0.006, 30), { fov: 36 }) },
  ],
  // Shot 12: Wide fisheye Dashcam HUD playback -> exterior reverse push onto dashcam lens
  12: [
    { f: 1645, cut: true, s: (f) => dolly([0, 1.36, -2.6], [0, 1.05, 6.0], pushK(f, 1645, 0.0018), { fov: 64 }) },
    { f: 1790, cut: true, s: (f) => dolly([0.15, 1.42, -1.1], [0, 1.34, -2.55], pushK(f, 1790, 0.0032, 0.0065, 36), { fov: 36 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [18 / FPS, 0.8],    // brake pedal stomp
  [78 / FPS, 1.5],    // first rear-end crash
  [325 / FPS, 0.55],  // PAID stamp slam
  [905 / FPS, 1.35],  // supercar crash
  [1418 / FPS, 1.25], // rainy highway bumper tap
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
  { f: 0,    cInf: 12 }, // interior pedal CU
  { f: 42,   cInf: 0 },  // highway wide sharp
  { f: 68,   dur: 22, cInf: 10 }, // bumper impact
  { f: 126,  cInf: 8 },
  { f: 168,  cInf: 13 }, // roadside scammer MS
  { f: 295,  cInf: 7 },  // driveway props
  { f: 465,  cInf: 0 },  // golden highway wide
  { f: 815,  cInf: 9 },  // night cash garage
  { f: 945,  cInf: 14 }, // office desk skyline blurred behind window
  { f: 1075, cInf: 14 }, // hot tub night bokeh on string lights
  { f: 1145, cInf: 11 }, // trooper foreground / scammer background
  { f: 1305, cInf: 6 },
  { f: 1440, cInf: 10 }, // scammer out of the car, rain bokeh behind
  { f: 1490, cInf: 13 }, // calm driver & dashcam box CU
  { f: 1645, cInf: 0 },  // dashcam wide fisheye all-in-focus
  { f: 1790, cInf: 14 }, // final push onto dashcam lens
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
