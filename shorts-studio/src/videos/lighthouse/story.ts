// Single-source master timeline for "The Night the Lighthouse Went Dark" (67.67 s / 2,030 frames @ 30 fps).
// Shot boundaries are locked to voice/lighthouse/words.json. Exported to out/lighthouse/timeline.json via
// scripts/export_timeline.mjs so the Python audio mix and QA never drift from the picture.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 2030; // 67.67 s
export type V3 = [number, number, number];
export type SetName = "tower_ext" | "lamp_room" | "bridge";

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
  hud?: "flash" | "signals";
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 110,  set: "tower_ext", light: "night" },
  { id: 2,  a: 110,  b: 165,  set: "lamp_room", light: "interior" },
  { id: 3,  a: 165,  b: 370,  set: "tower_ext", light: "night" },
  { id: 4,  a: 370,  b: 464,  set: "lamp_room", light: "interior" },
  { id: 5,  a: 464,  b: 568,  set: "tower_ext", light: "night",    hud: "flash" },
  { id: 6,  a: 568,  b: 621,  set: "tower_ext", light: "night" },
  { id: 7,  a: 621,  b: 795,  set: "lamp_room", light: "interior" },
  { id: 8,  a: 795,  b: 996,  set: "lamp_room", light: "interior" },
  { id: 9,  a: 996,  b: 1109, set: "tower_ext", light: "night",    xfade: 6 },
  { id: 10, a: 1109, b: 1196, set: "bridge",    light: "night" },
  { id: 11, a: 1196, b: 1354, set: "tower_ext", light: "night",    hud: "signals" },
  { id: 12, a: 1354, b: 1457, set: "tower_ext", light: "night",    xfade: 6 },
  { id: 13, a: 1457, b: 1532, set: "lamp_room", light: "interior" },
  { id: 14, a: 1532, b: 1670, set: "tower_ext", light: "night" },
  { id: 15, a: 1670, b: 1850, set: "tower_ext", light: "golden",   xfade: 8, sunAz: 12, sunEl: 9 },
  { id: 16, a: 1850, b: TOTAL, set: "tower_ext", light: "golden",  sunAz: 150, sunEl: 14 },
];

export const FLASH_AT = -1; // no full-frame white flash; lightning lives inside the planned impact windows

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "thunder"
    | "wave_crash"
    | "switch_clunk"
    | "motor_die"
    | "crank_ratchet"
    | "boot_clang"
    | "ship_horn"
    | "telegraph_bell"
    | "anchor_splash"
    | "gull_cry"
    | "paper_rustle"
    | "mug_sip"
    | "score_resolve"
    | "music_stop";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 24,   type: "thunder",        gain: 0.8,  pan: 0.3,   desc: "Distant lightning behind the tower" },
  { frame: 52,   type: "wave_crash",     gain: 0.7,  pan: -0.2,  desc: "Storm swell breaks on the rock" },
  { frame: 150,  type: "switch_clunk",   gain: 0.9,  pan: 0.0,   desc: "Teaser: keeper throws the main light switch" },
  { frame: 190,  type: "wave_crash",     gain: 0.9,  pan: 0.2,   desc: "Wave smashes the rocks below the tower" },
  { frame: 236,  type: "wave_crash",     gain: 1.1,  pan: -0.15, desc: "Big breaker explodes over the rocks" },
  { frame: 300,  type: "ship_horn",      gain: 0.6,  pan: -0.3,  desc: "Cargo convoy horn far out at sea" },
  { frame: 598,  type: "thunder",        gain: 1.25, pan: 0.0,   desc: "Lightning bolt strikes the lantern roof" },
  { frame: 624,  type: "motor_die",      gain: 1.0,  pan: 0.15,  desc: "Rotation motor sparks, whines down and dies" },
  { frame: 797,  type: "crank_ratchet",  gain: 0.85, pan: -0.1,  desc: "Keeper winds the hand crank" },
  { frame: 838,  type: "boot_clang",     gain: 1.0,  pan: 0.2,   desc: "Keeper kicks the dead motor housing" },
  { frame: 1040, type: "ship_horn",      gain: 0.8,  pan: -0.2,  desc: "Lead ship answers the steady light" },
  { frame: 1168, type: "telegraph_bell", gain: 0.9,  pan: 0.25,  desc: "Engine telegraph rung to FULL AHEAD" },
  { frame: 1512, type: "switch_clunk",   gain: 1.1,  pan: 0.0,   desc: "Main light switch pulled, lamp dies" },
  { frame: 1529, type: "music_stop",     gain: 1.0,  pan: 0.0,   desc: "Score drops out into the dark" },
  { frame: 1614, type: "anchor_splash",  gain: 1.0,  pan: 0.2,   desc: "Lead ship lets go its anchor" },
  { frame: 1640, type: "anchor_splash",  gain: 0.6,  pan: -0.4,  desc: "Second anchor further out" },
  { frame: 1672, type: "score_resolve",  gain: 1.0,  pan: 0.0,   desc: "Warm sunrise chord" },
  { frame: 1690, type: "gull_cry",       gain: 0.7,  pan: -0.3,  desc: "Gulls over the calm morning sea" },
  { frame: 1780, type: "paper_rustle",   gain: 0.8,  pan: 0.1,   desc: "Captains wave their complaint forms" },
  { frame: 1800, type: "gull_cry",       gain: 0.5,  pan: 0.35,  desc: "Second gull" },
  { frame: 1862, type: "paper_rustle",   gain: 0.9,  pan: 0.0,   desc: "Lead captain shakes his complaint" },
  { frame: 1952, type: "mug_sip",        gain: 0.8,  pan: 0.0,   desc: "Keeper sips his tea" },
];

// ---------------- Lamp, Storm & Fleet Kinematics (shared by sets.ts, cameras and the HUD) ----------------
/** World position of the lamp inside the lantern room on top of the tower (tower_ext set) */
export const LAMP: V3 = [0, 20.3, 0];
export const BEAM_PERIOD = 72;          // frames per revolution while the motor runs
const W = (Math.PI * 2) / BEAM_PERIOD;
const DIE0 = 605, DIE1 = 695;           // motor winds down after the lightning strike (f598) and seizes
const STUCK = Math.PI;                  // seized pointing straight out to sea (-z), at the shipping lane

/** Beam yaw; direction = (sin a, 0, cos a) */
export const lampAngle = (f: number): number => {
  const coast = (W * (DIE1 - DIE0)) / 3;
  if (f <= DIE0) return STUCK - coast - W * (DIE0 - f);
  if (f < DIE1) { const s = (f - DIE0) / (DIE1 - DIE0); return STUCK - coast + coast * (1 - (1 - s) ** 3); }
  // hand crank (f795-829): the carriage lurches twice and falls back
  if (f >= 795 && f < 829) return STUCK + 0.3 * Math.abs(Math.sin((Math.PI * (f - 795)) / 17));
  return STUCK;
};

export const SWITCH_TEASE = 150, SWITCH_OFF = 1512;
/** Lamp brightness 0..1 (5-frame filament fade at each switch throw; Shot 2 is a flash-forward teaser) */
export const lampOn = (f: number): number => {
  if (f >= SWITCH_TEASE && f < 165) return 1 - clamp01((f - SWITCH_TEASE + 1) / 5);
  if (f >= SWITCH_OFF) return 1 - clamp01((f - SWITCH_OFF + 1) / 5);
  return 1;
};

/** Lightning strikes [frame, strength]; each has a matching impact kick below, so QA treats the flash as planned */
export const STRIKES: [number, number][] = [[24, 0.55], [598, 1.0]];
export const lightningK = (f: number): number => {
  let k = 0;
  for (const [f0, g] of STRIKES) {
    const n = f - f0;
    if (n >= 0 && n < 8) k = Math.max(k, g * (1 - n / 8) ** 2);
  }
  return k;
};

/** Storm strength: 1 through the night, easing to a calm 0.1 swell by sunrise */
export const stormK = (f: number): number => (f < 1670 ? 1 : 0.1);
export const waveY = (x: number, z: number, t: number, amp: number): number =>
  amp * (0.5 * Math.sin(0.16 * z + 1.3 * t + 0.05 * x) + 0.3 * Math.sin(0.09 * x - 0.9 * t + 0.07 * z) + 0.2 * Math.sin(0.31 * (x + z) + 2.1 * t));

/** Breakers hit the rock every 46 frames (f ... 190, 236 ...) */
export const CRASH_PERIOD = 46, CRASH_PHASE = 6;

/** Knife-switch throw 0 (ON, lever up) .. 1 (OFF): teaser in Shot 2, the real thing in Shot 13 */
export const leverK = (f: number): number => (f < 165 ? smooth((f - 146) / 6) : smooth((f - 1506) / 7));
/** How hard the beam hits a viewer out in the shipping lane (-z): 0..1 flash envelope for the HUD */
export const seaFlashK = (f: number): number => lampOn(f) * Math.max(0, -Math.cos(lampAngle(f))) ** 12;

/** Wheelhouse of the lead ship (bridge set origin) */
export const BRIDGE: V3 = [0, 4.6, -80];

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
const B = (x: number, y: number, z: number): V3 => [BRIDGE[0] + x, BRIDGE[1] + y, BRIDGE[2] + z];
/** slow deck roll for shots filmed aboard a ship */
const sway = (f: number) => 0.022 * Math.sin(f * 0.07);

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1: storm wide, low over the swell, pushing at the tower and its sweeping beam
  1: [
    { f: 0, s: (f) => dolly([13, 5.2, -47], [0, 12.2, 0], pushK(f, 0, 0.003, 0.006, 30), { fov: 47, roll: 0.02 }) },
  ],
  // Shot 2 (flash-forward): hand on the big knife switch
  2: [
    { f: 110, cut: true, s: (f) => dolly([0.45, 1.42, 3.75], [-0.9, 1.12, 1.6], pushK(f, 110, 0.0035, 0.007, 30), { fov: 36, roll: -0.03 }) },
  ],
  // Shot 3: breakers under the tower -> the convoy crawling past
  3: [
    { f: 165, cut: true, s: (f) => dolly([11.5, 2.3, -22], [0.5, 9.5, 0], pushK(f, 165, 0.0024), { fov: 60, roll: 0.03 }) },
    { f: 280, cut: true, s: (f) => dolly([-10, 11, -152], [0, 6, -60], pushK(f, 280, 0.0022), { fov: 46, roll: sway(f) }) },
  ],
  // Shot 4: the keeper and his spinning lamp
  4: [
    { f: 370, cut: true, s: (f) => dolly([4.5, 1.75, 0.45], [0, 1.42, 0.38], pushK(f, 370, 0.0026), { fov: 48 }) },
  ],
  // Shot 5: a ship's-eye view of the flashing warning
  5: [
    { f: 464, cut: true, s: (f) => dolly([0, 6.5, -82], [0, 16.5, 0], pushK(f, 464, 0.0022), { fov: 40, roll: sway(f) }) },
  ],
  // Shot 6: the bolt finds the lantern roof
  6: [
    { f: 568, cut: true, s: (f) => dolly([-15, 8.5, -38], [0, 17.5, 0], pushK(f, 568, 0.003, 0.006, 30), { fov: 44, roll: -0.03 }) },
  ],
  // Shot 7: motor dies (low angle past the housing) -> the light that just sits there
  7: [
    { f: 621, cut: true, s: (f) => dolly([3.7, 0.95, -0.95], [0.1, 1.15, -0.2], pushK(f, 621, 0.0026), { fov: 50, roll: 0.03 }) },
    { f: 704, cut: true, s: (f) => dolly([4.6, 1.7, 0.5], [0, 1.5, 0.38], pushK(f, 704, 0.0028), { fov: 46 }) },
  ],
  // Shot 8: crank / kick / beg / shout / nothing
  8: [
    { f: 795, cut: true, s: (f) => dolly([4.0, 1.5, 0.3], [0.3, 1.1, 0.36], pushK(f, 795, 0.003), { fov: 44 }) },
    { f: 832, cut: true, s: (f) => dolly([3.7, 0.85, -0.62], [0.45, 0.92, -0.38], pushK(f, 832, 0.003), { fov: 50, roll: -0.04 }) },
    { f: 856, cut: true, s: (f) => dolly([3.1, 0.8, 0.15], [0.3, 1.1, 0.5], pushK(f, 856, 0.003), { fov: 46 }) },
    { f: 894, cut: true, s: (f) => dolly([2.5, 1.5, 1.55], [0.55, 1.36, 0.85], pushK(f, 894, 0.0032, 0.006, 26), { fov: 34, roll: 0.03 }) },
    { f: 961, cut: true, s: (f) => dolly([4.9, 1.8, 0.55], [0, 1.45, 0.38], pushK(f, 961, 0.0022), { fov: 46 }) },
  ],
  // Shot 9: the lead ship swings her bow at the steady light
  9: [
    { f: 996, s: (f) => dolly([-14, 8.5, -114], [-5.5, 7.5, -60], pushK(f, 996, 0.0024), { fov: 44, roll: sway(f) }) },
  ],
  // Shot 10: wheelhouse over-the-shoulder -> captain front close-up
  10: [
    { f: 1109, cut: true, s: (f) => dolly(B(0.35, 1.8, -1.55), B(0.0, 1.78, 2.6), pushK(f, 1109, 0.0026), { fov: 52, roll: sway(f) * 1.5 }) },
    { f: 1164, cut: true, s: (f) => dolly(B(0.5, 1.88, 2.5), B(0.02, 1.42, 0.15), pushK(f, 1164, 0.0034, 0.006, 24), { fov: 36, roll: sway(f) * 1.5 }) },
  ],
  // Shot 11: what the steady light says to a sailor (HUD signal cards)
  11: [
    { f: 1196, cut: true, s: (f) => dolly([0, 8, -86], [0, 12.5, 0], pushK(f, 1196, 0.002), { fov: 40, roll: sway(f) }) },
  ],
  // Shot 12: crane over the lantern: the beam as a runway onto the rocks
  12: [
    { f: 1354, s: (f) => dolly([13, 40, 27], [-1, 3, -44], pushK(f, 1354, 0.0022), { fov: 50, roll: 0.03 }) },
  ],
  // Shot 13: the switch
  13: [
    { f: 1457, cut: true, s: (f) => dolly([0.6, 1.45, 3.95], [-0.9, 1.12, 1.6], pushK(f, 1457, 0.003, 0.006, 30), { fov: 38 }) },
  ],
  // Shot 14: dark tower -> anchors go down
  14: [
    { f: 1532, cut: true, s: (f) => dolly([11, 5.5, -50], [0, 12.5, 0], pushK(f, 1532, 0.0024), { fov: 46, roll: -0.02 }) },
    { f: 1568, cut: true, s: (f) => dolly([-17, 4.8, -128], [1.5, 3.8, -100], pushK(f, 1568, 0.0022), { fov: 46, roll: sway(f) }) },
  ],
  // Shot 15: sunrise over the anchored fleet -> the queue of captains at the keeper's door
  15: [
    { f: 1670, s: (f) => dolly([9, 31, 36], [0, 5, -62], pushK(f, 1670, 0.002), { fov: 50 }) },
    { f: 1748, cut: true, s: (f) => dolly([1.9, 4.9, -2.9], [-0.15, 4.25, -6.5], pushK(f, 1748, 0.0024), { fov: 50 }) },
  ],
  // Shot 16: furious captain close-up -> the keeper and his tea
  16: [
    { f: 1850, cut: true, s: (f) => dolly([0.35, 4.5, -2.9], [0.02, 4.42, -4.6], pushK(f, 1850, 0.003), { fov: 36, roll: 0.03 }) },
    { f: 1906, cut: true, s: (f) => dolly([-0.55, 4.42, -5.6], [0, 4.25, -3.0], pushK(f, 1906, 0.0026, 0.0045, 40), { fov: 36 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [24 / FPS, 0.5],    // distant thunder
  [150 / FPS, 0.7],   // teaser switch throw
  [236 / FPS, 0.9],   // big breaker
  [598 / FPS, 1.5],   // lightning strike
  [838 / FPS, 1.0],   // boot vs motor housing
  [1168 / FPS, 0.5],  // telegraph slammed to FULL
  [1512 / FPS, 1.1],  // the switch
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
  { f: 0,    cInf: 0 },  // storm wide
  { f: 110,  cInf: 13 }, // switch insert
  { f: 165,  cInf: 0 },  // breakers + convoy wides
  { f: 370,  cInf: 10 }, // keeper + lamp MS
  { f: 464,  cInf: 0 },  // HUD shot stays sharp
  { f: 568,  cInf: 0 },
  { f: 621,  cInf: 12 }, // motor insert
  { f: 704,  cInf: 10 },
  { f: 795,  cInf: 11 }, // crank MS
  { f: 832,  cInf: 12 }, // kick insert
  { f: 856,  cInf: 11 },
  { f: 894,  cInf: 14 }, // keeper CU
  { f: 961,  cInf: 10 },
  { f: 996,  cInf: 0 },  // sea wide
  { f: 1109, cInf: 10, focus: () => LAMP }, // OTS: the steady light sharp, captain soft in the foreground
  { f: 1164, cInf: 13 }, // captain CU
  { f: 1196, cInf: 0 },  // HUD shot
  { f: 1354, cInf: 0 },  // crane wide
  { f: 1457, cInf: 13 }, // the switch
  { f: 1532, cInf: 0 },  // dark wides
  { f: 1670, cInf: 0 },  // sunrise wide
  { f: 1748, cInf: 10 }, // queue of captains
  { f: 1850, cInf: 14 }, // captain CU
  { f: 1906, cInf: 12 }, // keeper MS
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
