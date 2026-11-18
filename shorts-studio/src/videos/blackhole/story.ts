// Single-source master timeline for "What If You Fell Into a Black Hole?" (1,935 frames @ 30 fps = 64.5 s).
// Exported to out/blackhole/timeline.json via scripts/export_timeline.mjs so Python audio and QA never drift.
// Shot boundaries are cut to voice/blackhole/words.json (ElevenLabs read, 63.4 s).
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1935; // 64.50 s
export const SCORE = "space";
export type V3 = [number, number, number];
export type SetName = "space" | "ship" | "inside";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  set: SetName;
  light: LightMode;
  xfade?: number;
  hud?: "scope" | "split";
  sunAz?: number;
  sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 148,  set: "space",  light: "night", sunAz: 120, sunEl: 25 },
  { id: 2,  a: 148,  b: 325,  set: "space",  light: "night", xfade: 6, sunAz: 140, sunEl: 30 },
  { id: 3,  a: 325,  b: 478,  set: "space",  light: "night", sunAz: 160, sunEl: 40 },
  { id: 4,  a: 478,  b: 603,  set: "ship",   light: "interior", xfade: 8, sunAz: 150, sunEl: 40 },
  { id: 5,  a: 603,  b: 689,  set: "space",  light: "night", hud: "scope", sunAz: 160, sunEl: 30 },
  { id: 6,  a: 689,  b: 742,  set: "space",  light: "night", sunAz: 130, sunEl: 25 },
  { id: 7,  a: 742,  b: 899,  set: "space",  light: "night", hud: "scope", sunAz: 160, sunEl: 30 },
  { id: 8,  a: 899,  b: 1102, set: "space",  light: "golden", sunAz: 30, sunEl: -20 },
  { id: 9,  a: 1102, b: 1305, set: "space",  light: "night", sunAz: 120, sunEl: 30 },
  { id: 10, a: 1305, b: 1393, set: "space",  light: "night", sunAz: 140, sunEl: 25 },
  { id: 11, a: 1393, b: 1549, set: "inside", light: "night", xfade: 6, sunAz: 110, sunEl: 20 },
  { id: 12, a: 1549, b: 1744, set: "space",  light: "night", xfade: 8, hud: "split", sunAz: 150, sunEl: 35 },
  { id: 13, a: 1744, b: 1866, set: "ship",   light: "interior", xfade: 6, sunAz: 150, sunEl: 40 },
  { id: 14, a: 1866, b: TOTAL, set: "inside", light: "night", sunAz: 110, sunEl: 20 },
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley & Physics Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "sting_hit" | "shimmer" | "deep_boom" | "photon_zap" | "whoosh" | "scope_servo" | "radio_click"
    | "clock_slow" | "freeze_hit" | "fire_roar" | "burn_whoomp" | "ash_scatter" | "music_stop" | "music_resume"
    | "soft_chime" | "low_rumble" | "stretch_creak" | "boing" | "bell_toll" | "music_resolve";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 52,   type: "sting_hit",     gain: 1.0,  pan: 0.0,  desc: "Hook stinger on 'die twice'" },
  { frame: 246,  type: "shimmer",       gain: 0.8,  pan: 0.2,  desc: "Starlight bends around the black hole like a lens" },
  { frame: 362,  type: "deep_boom",     gain: 1.0,  pan: 0.0,  desc: "EVENT HORIZON label ring lights up" },
  { frame: 418,  type: "photon_zap",    gain: 0.7,  pan: -0.3, desc: "Photon 1 spirals in and vanishes" },
  { frame: 436,  type: "photon_zap",    gain: 0.7,  pan: 0.3,  desc: "Photon 2 spirals in and vanishes" },
  { frame: 452,  type: "photon_zap",    gain: 0.7,  pan: 0.0,  desc: "Photon 3 fails to climb back out" },
  { frame: 474,  type: "whoosh",        gain: 0.8,  pan: 0.0,  desc: "Dissolve to the ship" },
  { frame: 548,  type: "scope_servo",   gain: 0.8,  pan: 0.25, desc: "Friend racks the telescope focus" },
  { frame: 601,  type: "radio_click",   gain: 0.8,  pan: 0.0,  desc: "Comms open: friend talks" },
  { frame: 606,  type: "clock_slow",    gain: 0.75, pan: 0.0,  desc: "Suit clock ticks slowing toward the freeze" },
  { frame: 687,  type: "radio_click",   gain: 0.8,  pan: 0.0,  desc: "Astronaut keys his radio" },
  { frame: 827,  type: "freeze_hit",    gain: 1.0,  pan: 0.0,  desc: "Astronaut freezes at the edge like a photo" },
  { frame: 905,  type: "fire_roar",     gain: 1.0,  pan: 0.0,  desc: "Firewall of radiation flares up at the horizon" },
  { frame: 1016, type: "burn_whoomp",   gain: 1.1,  pan: 0.0,  desc: "Astronaut flashes and burns" },
  { frame: 1032, type: "ash_scatter",   gain: 0.9,  pan: 0.1,  desc: "Ash drifts over the horizon surface" },
  { frame: 1140, type: "music_stop",    gain: 1.0,  pan: 0.0,  desc: "Score drops out on 'Nothing.'" },
  { frame: 1206, type: "soft_chime",    gain: 0.8,  pan: 0.0,  desc: "Astronaut glides through the horizon membrane" },
  { frame: 1357, type: "music_resume",  gain: 1.0,  pan: 0.0,  desc: "Ominous score returns on 'It does, later.'" },
  { frame: 1359, type: "low_rumble",    gain: 1.0,  pan: 0.0,  desc: "Ominous rumble" },
  { frame: 1393, type: "whoosh",        gain: 0.9,  pan: 0.0,  desc: "Plunge deep inside" },
  { frame: 1436, type: "stretch_creak", gain: 0.9,  pan: 0.0,  desc: "Feet pulled harder than the head" },
  { frame: 1520, type: "boing",         gain: 0.9,  pan: 0.0,  desc: "Full spaghettification twang" },
  { frame: 1549, type: "whoosh",        gain: 0.7,  pan: 0.0,  desc: "Pull back to both sides" },
  { frame: 1600, type: "shimmer",       gain: 0.6,  pan: -0.3, desc: "OUTSIDE label appears" },
  { frame: 1640, type: "shimmer",       gain: 0.6,  pan: 0.3,  desc: "INSIDE label appears" },
  { frame: 1748, type: "bell_toll",     gain: 0.85, pan: 0.0,  desc: "Funeral bell on the ship" },
  { frame: 1866, type: "music_resolve", gain: 1.0,  pan: 0.0,  desc: "Playful music-box button" },
  { frame: 1881, type: "boing",         gain: 1.0,  pan: 0.0,  desc: "Noodle astronaut waves" },
];

// ---------------- Story Kinematics (shared by sets.ts and CAMS) ----------------
export const SHIP: V3 = [30, -1.2, 72];
/** ship-local -> world */
export const sh = (x: number, y: number, z: number): V3 => [SHIP[0] + x, SHIP[1] + y, SHIP[2] + z];
/** event horizon radius (black hole centred at the origin) */
export const R_H = 10;
/** inside-set origin (far from everything else; the black hole objects are hidden there) */
export const IN0: V3 = [0, -400, 0];

/** astronaut root (feet) position in the space set */
export const astroPos = (f: number): V3 => {
  if (f < 148) return [2.35, -0.6, 31.5 - 0.004 * f];
  if (f < 325) return [0.6, -0.4, 27.6 - 0.006 * (f - 148)];
  if (f < 742) return [0.3, -0.5, 20.4 - 1.6 * smooth((f - 603) / 139)];
  if (f < 899) { const u = clamp01((f - 742) / 85); return [0.3, -0.5, 10.9 + 7.9 * (1 - u) * (1 - u)]; }
  if (f < 1102) return [0.3, -0.5, 10.9];
  if (f < 1393) return [0.3, -0.5, 13.3 - 6 * ((f - 1102) / 203)];
  return [0.3, -0.5, 6.2];
};
/** red-shift / dimming of the astronaut as seen from the ship (0..1), frozen after f827 */
export const redK = (f: number) => (f >= 742 && f < 1102 ? smooth((f - 752) / 75) : 0);
/** firewall flare level 0..1 (shot 8) */
export const fireK = (f: number) => (f >= 899 && f < 1102 ? smooth((f - 905) / 45) * (1 - 0.35 * smooth((f - 1060) / 40)) : 0);
/** astronaut burn: 0 = intact, 1 = gone to ash (shot 8) */
export const burnK = (f: number) => (f >= 899 && f < 1102 ? smooth((f - 1000) / 32) : 0);
/** spaghettification stretch factor (inside set) */
export const stretchS = (f: number) => (f >= 1866 ? 8.5 + 0.4 * Math.sin((f - 1866) * 0.12) : 1 + 4.6 * smooth((f - 1430) / 92) ** 1.3);

/** time-dilated suit clock (seconds) as seen through the ship telescope: rate falls to 0 at f827 */
export const suitClock = (f: number) => {
  let t = 12.4;
  const end = Math.min(f, 827);
  for (let k = 603; k < end; k++) {
    const p = clamp01((k - 603) / 224);
    t += Math.max(0, 1 - p ** 0.7) / FPS;
  }
  return t;
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
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];
/** narrow-fov telescope that keeps a slowly creeping zoom (fov shrinks instead of dollying) */
const scope = (f: number, f0: number, fov0: number): ShotCam => {
  const a = astroPos(f);
  return { pos: sh(0.2, 1.3, -2.2), look: add(a, 0, 0.85, 0), fov: fov0 * pushK(f, f0, 0.0022) };
};
/** inside-set framing that grows with the stretch (head stays ~1.5 m above IN0) */
const insideCam = (f: number, side: number, dist: number): ShotCam => {
  const s = stretchS(f);
  const midY = IN0[1] + 1.5 - 0.62 * s;
  const d = dist * (0.75 + 0.42 * s);
  return { pos: [IN0[0] + side * d * 0.45, midY + 0.4 + 0.08 * s, IN0[2] + d], look: [IN0[0], midY, IN0[2]], fov: 40 };
};

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1: wide establishing push - tiny astronaut drifting toward the giant black hole
  1: [
    { f: 0, s: (f) => dolly([2.7, 0.5, 36.2], [0.2, 0.2, 14], pushK(f, 0, 0.0012), { fov: 50, roll: 0.03 }) },
  ],
  // Shot 2: medium on the astronaut, black hole and lensed stars behind; glide orbit
  2: [
    { f: 148, s: (f) => dolly(add(astroPos(f), 1.7, 1.25, 3.4), add(astroPos(f), 0, 1.05, 0), pushK(f, 148, 0.0022), { fov: 40 }) },
    { f: 236, dur: 36, s: (f) => dolly(add(astroPos(f), -2.3, 1.7, 3.0), add(astroPos(f), 0, 1.1, 0), pushK(f, 236, 0.0025), { fov: 42, roll: -0.03 }) },
  ],
  // Shot 3: wide on the black hole and its labelled event horizon; photons fall in
  3: [
    { f: 325, cut: true, s: (f) => dolly([0, 6.5, 50], [0, 3.0, 0], pushK(f, 325, 0.0018, 0.004, 30), { fov: 42 }) },
  ],
  // Shot 4: ship interior - friend at the telescope, black hole in the window
  4: [
    { f: 478, s: (f) => dolly(sh(1.9, 1.5, 2.6), sh(-0.1, 1.45, -1.6), pushK(f, 478, 0.0022), { fov: 44 }) },
    { f: 540, dur: 30, s: (f) => dolly(sh(1.75, 1.5, 1.6), sh(-0.05, 1.45, -1.5), pushK(f, 540, 0.0028), { fov: 40 }) },
  ],
  // Shot 5: telescope POV of the astronaut (scope HUD)
  5: [
    { f: 603, cut: true, s: (f) => scope(f, 603, 6.4) },
  ],
  // Shot 6: astronaut close-up, "Mine's fine! Totally normal!"
  6: [
    { f: 689, cut: true, s: (f) => dolly(add(astroPos(f), 0.55, 1.42, 1.75), add(astroPos(f), 0, 1.38, 0), pushK(f, 689, 0.0035), { fov: 36 }) },
  ],
  // Shot 7: telescope POV again - redder, dimmer, slower, frozen at the edge
  7: [
    { f: 742, cut: true, s: (f) => scope(f, 742, 6.0) },
  ],
  // Shot 8: outside close on the frozen astronaut as the firewall flares and burns him to ash
  8: [
    { f: 899, cut: true, s: (f) => dolly([7.6, 1.5, 15.0], [0.3, 0.7, 10.9], pushK(f, 899, 0.0022), { fov: 42 }) },
    { f: 985, dur: 26, s: (f) => dolly([4.0, 1.25, 13.1], [0.3, 0.75, 10.9], pushK(f, 985, 0.003, 0.006, 30), { fov: 40, roll: 0.035 }) },
  ],
  // Shot 9: the astronaut's own view - drifting calmly through the horizon
  9: [
    { f: 1102, cut: true, s: (f) => dolly(add(astroPos(f), 3.2, 1.1, 0.6), add(astroPos(f), 0, 0.95, -0.3), pushK(f, 1102, 0.0022), { fov: 40 }) },
    { f: 1146, cut: true, s: (f) => dolly(add(astroPos(f), 1.9, 1.35, -2.4), add(astroPos(f), 0, 1.0, 0), pushK(f, 1146, 0.0022), { fov: 42 }) },
  ],
  // Shot 10: close-up inside the horizon - "Huh. I thought this would hurt." / "It does, later."
  10: [
    { f: 1305, cut: true, s: (f) => dolly(add(astroPos(f), 0.6, 1.45, -1.7), add(astroPos(f), 0, 1.38, 0), pushK(f, 1305, 0.0025), { fov: 36 }) },
    { f: 1359, dur: 30, s: (f) => dolly(add(astroPos(f), 0.25, 1.42, -1.25), add(astroPos(f), 0, 1.4, 0), pushK(f, 1359, 0.0032), { fov: 34, roll: -0.04 }) },
  ],
  // Shot 11: deep inside - spaghettification (framing grows with the stretch)
  11: [
    { f: 1393, s: (f) => insideCam(f, 1, 3.6) },
  ],
  // Shot 12: wide pull-back - the ship outside, the horizon between the two stories
  12: [
    { f: 1549, s: (f) => dolly([-17, 12, 44], [3, 1.5, 8], 1 / pushK(f, 1549, 0.0018), { fov: 46, roll: 0.02 }) },
  ],
  // Shot 13: the funeral on the ship
  13: [
    { f: 1744, s: (f) => dolly(sh(1.35, 1.5, 1.5), sh(-0.2, 1.15, -1.2), pushK(f, 1744, 0.0024), { fov: 42 }) },
  ],
  // Shot 14: the noodle waves
  14: [
    { f: 1866, cut: true, s: (f) => ({ ...dolly([IN0[0] + 1.4, IN0[1] - 0.6, IN0[2] + 5.6], [IN0[0], IN0[1] - 2.4, IN0[2]], pushK(f, 1866, 0.0035)), fov: 46 }) },
  ],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [52 / FPS, 0.9],    // "die twice"
  [827 / FPS, 0.7],   // freeze
  [1016 / FPS, 1.4],  // burn flash
  [1520 / FPS, 1.0],  // spaghetti
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
  { f: 0,    cInf: 0 },   // establishing wide
  { f: 148,  cInf: 11 },  // astronaut MS, black hole soft behind
  { f: 325,  cInf: 0 },   // horizon wide, all sharp
  { f: 478,  cInf: 12 },  // ship interior MS
  { f: 603,  cInf: 0 },   // telescope POV (HUD)
  { f: 689,  cInf: 13 },  // astronaut CU
  { f: 742,  cInf: 0 },   // telescope POV (HUD)
  { f: 899,  cInf: 10 },  // firewall MS
  { f: 1102, cInf: 11 },  // crossing MS
  { f: 1305, cInf: 13 },  // astronaut CU
  { f: 1393, cInf: 10 },  // spaghetti
  { f: 1549, cInf: 0 },   // wide split (HUD)
  { f: 1744, cInf: 12 },  // funeral MS
  { f: 1866, cInf: 12 },  // noodle CU
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
