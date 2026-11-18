// Single-source master timeline for "What If You Woke Up 10 Years in the Future?" (1,950 frames @ 30 fps = 65.0 s).
// Shot boundaries are fitted to voice/ten-years-future/words.json (ElevenLabs read at tempo 1.10, 63.07 s): every cut
// lands on a line or word onset. Exported to out/ten-years-future/timeline.json via scripts/export_timeline.mjs.
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1950; // 65.0 s: voice ends f1892 ("coffee."), ~1.9 s payoff hold
export const AUDIO_PROFILE = "future"; // audio/mix.py -> audio/profile_future.py
export type V3 = [number, number, number];
export type SetName = "hospital" | "apartment" | "city";

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

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 56,   set: "hospital",  light: "interior", sunAz: 150, sunEl: 40 },
  { id: 2,  a: 56,   b: 126,  set: "hospital",  light: "interior", sunAz: 150, sunEl: 40 },
  { id: 3,  a: 126,  b: 170,  set: "hospital",  light: "interior", sunAz: 150, sunEl: 45 },
  { id: 4,  a: 170,  b: 224,  set: "hospital",  light: "interior", sunAz: 160, sunEl: 40 },
  { id: 5,  a: 224,  b: 300,  set: "hospital",  light: "interior", sunAz: 200, sunEl: 40 },
  { id: 6,  a: 300,  b: 345,  set: "hospital",  light: "interior", sunAz: 150, sunEl: 40 },
  { id: 7,  a: 345,  b: 404,  set: "city",      light: "day" },
  { id: 8,  a: 404,  b: 460,  set: "city",      light: "day" },
  { id: 9,  a: 460,  b: 582,  set: "apartment", light: "night",    xfade: 8 },
  { id: 10, a: 582,  b: 692,  set: "apartment", light: "night" },
  { id: 11, a: 692,  b: 843,  set: "hospital",  light: "interior", xfade: 8, sunAz: 150, sunEl: 40 },
  { id: 12, a: 843,  b: 870,  set: "hospital",  light: "interior", sunAz: 150, sunEl: 40 },
  { id: 13, a: 870,  b: 912,  set: "hospital",  light: "interior", sunAz: 160, sunEl: 40 },
  { id: 14, a: 912,  b: 980,  set: "city",      light: "day" },
  { id: 15, a: 980,  b: 1060, set: "city",      light: "day" },
  { id: 16, a: 1060, b: 1158, set: "city",      light: "day" },
  { id: 17, a: 1158, b: 1256, set: "city",      light: "day" },
  { id: 18, a: 1256, b: 1340, set: "city",      light: "day" },
  { id: 19, a: 1340, b: 1410, set: "city",      light: "day" },
  { id: 20, a: 1410, b: 1465, set: "city",      light: "day" },
  { id: 21, a: 1465, b: 1532, set: "city",      light: "day" },
  { id: 22, a: 1532, b: 1566, set: "city",      light: "day" },
  { id: 23, a: 1566, b: 1665, set: "city",      light: "golden",   xfade: 6 },
  { id: 24, a: 1665, b: 1767, set: "city",      light: "golden" },
  { id: 25, a: 1767, b: TOTAL, set: "city",     light: "golden" },
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Foley Event Table (exported to timeline.json) ----------------
export type StoryEvent = {
  frame: number;
  type:
    | "eye_pop" | "whoosh" | "beard_rustle" | "robot_hover" | "robot_beep" | "dramatic_sting" | "hover_pass"
    | "drone_buzz" | "flashback_swell" | "keyboard_typing" | "mouse_click" | "coin_ding" | "app_chime" | "slot_riser"
    | "jackpot" | "iv_rip" | "run_steps" | "car_horn" | "screen_tap" | "atm_confirm" | "cash_pour" | "choir_ahh"
    | "door_chime" | "cup_place" | "record_scratch" | "music_stop" | "register_ching" | "error_buzz" | "sip"
    | "sad_trombone";
  gain?: number;
  pan?: number;
  desc: string;
};

export const EVENTS: StoryEvent[] = [
  { frame: 6,    type: "eye_pop",         gain: 0.8,  pan: -0.1,  desc: "Cartoon eye-pop as your eyes snap open" },
  { frame: 12,   type: "whoosh",          gain: 0.8,  pan: -0.2,  desc: "Bolt upright in the hospital bed" },
  { frame: 134,  type: "beard_rustle",    gain: 0.8,  pan: -0.1,  desc: "Ten years of beard rustling over the blanket" },
  { frame: 170,  type: "robot_hover",     gain: 0.85, pan: 0.4,   desc: "Nurse-bot hovers in, servo whir" },
  { frame: 198,  type: "robot_beep",      gain: 0.7,  pan: 0.2,   desc: "Pulse check beep" },
  { frame: 316,  type: "dramatic_sting",  gain: 0.9,  pan: 0.0,   desc: "Dun-dun-DUN on 'ten years'" },
  { frame: 350,  type: "hover_pass",      gain: 0.8,  pan: -0.5,  desc: "Flying car swooshes past the window" },
  { frame: 372,  type: "hover_pass",      gain: 0.7,  pan: 0.5,   desc: "Flying car the other way" },
  { frame: 392,  type: "hover_pass",      gain: 0.6,  pan: -0.2,  desc: "Distant flying car" },
  { frame: 408,  type: "drone_buzz",      gain: 0.9,  pan: 0.1,   desc: "Pizza drone buzzing toward camera" },
  { frame: 452,  type: "flashback_swell", gain: 0.9,  pan: 0.0,   desc: "Reverse-cymbal swell into the flashback" },
  { frame: 474,  type: "keyboard_typing", gain: 0.7,  pan: 0.0,   desc: "Late-night typing" },
  { frame: 530,  type: "keyboard_typing", gain: 0.6,  pan: 0.0,   desc: "More typing" },
  { frame: 655,  type: "mouse_click",     gain: 0.9,  pan: 0.05,  desc: "Click BUY" },
  { frame: 660,  type: "coin_ding",       gain: 0.8,  pan: 0.0,   desc: "PotatoCoin purchase ding" },
  { frame: 684,  type: "flashback_swell", gain: 0.8,  pan: 0.0,   desc: "Swell back to the present" },
  { frame: 746,  type: "app_chime",       gain: 0.8,  pan: 0.0,   desc: "Phone app opens: chart rockets" },
  { frame: 750,  type: "slot_riser",      gain: 0.8,  pan: 0.0,   desc: "Rising tone as the chart climbs" },
  { frame: 843,  type: "jackpot",         gain: 1.0,  pan: 0.0,   desc: "Slot-machine jackpot on 'four million'" },
  { frame: 899,  type: "iv_rip",          gain: 1.0,  pan: -0.2,  desc: "Tape rip + IV line pop" },
  { frame: 904,  type: "whoosh",          gain: 0.8,  pan: 0.2,   desc: "Leap out of bed" },
  { frame: 914,  type: "run_steps",       gain: 0.8,  pan: 0.1,   desc: "Bare feet slapping the sidewalk" },
  { frame: 982,  type: "run_steps",       gain: 0.85, pan: 0.0,   desc: "Bare feet slapping the sidewalk" },
  { frame: 1012, type: "hover_pass",      gain: 1.1,  pan: 0.0,   desc: "Flying taxi swoops overhead" },
  { frame: 1026, type: "car_horn",        gain: 0.9,  pan: 0.3,   desc: "Futuristic taxi horn" },
  { frame: 1088, type: "screen_tap",      gain: 0.8,  pan: 0.2,   desc: "Slap the ATM touchscreen" },
  { frame: 1137, type: "atm_confirm",     gain: 0.9,  pan: 0.2,   desc: "ATM: SOLD" },
  { frame: 1160, type: "cash_pour",       gain: 1.0,  pan: 0.25,  desc: "Bricks of cash thudding out of the ATM" },
  { frame: 1205, type: "choir_ahh",       gain: 0.8,  pan: 0.0,   desc: "Heavenly choir as you hug the cash" },
  { frame: 1296, type: "door_chime",      gain: 0.7,  pan: 0.3,   desc: "Future Beans kiosk chime" },
  { frame: 1345, type: "robot_beep",      gain: 0.6,  pan: 0.3,   desc: "Barista-bot greeting beep" },
  { frame: 1368, type: "cup_place",       gain: 0.8,  pan: 0.2,   desc: "Tiny cup set on the counter" },
  { frame: 1447, type: "record_scratch",  gain: 1.0,  pan: 0.0,   desc: "Record scratch on 'four million'" },
  { frame: 1448, type: "music_stop",      gain: 1.0,  pan: 0.0,   desc: "Score cuts dead" },
  { frame: 1451, type: "register_ching",  gain: 0.9,  pan: 0.2,   desc: "Register display flips to $4,000,000.00" },
  { frame: 1548, type: "error_buzz",      gain: 0.8,  pan: 0.2,   desc: "Robot's flat disapproving buzz" },
  { frame: 1700, type: "register_ching",  gain: 0.6,  pan: 0.3,   desc: "Somebody else pays four million" },
  { frame: 1866, type: "sip",             gain: 0.9,  pan: 0.0,   desc: "Long slurp of the four-million-dollar coffee" },
  { frame: 1896, type: "sad_trombone",    gain: 0.9,  pan: 0.0,   desc: "Wah-wah-wah-waaah" },
];

// ---------------- Shared kinematics (sets.ts poses + CAMS framing read the same functions) ----------------
/** City: you sprint down the right-hand sidewalk (x = 7) toward the ATM at z = 30 */
export const runZ = (f: number) => (f - 912) * 0.17;
/** Payoff curb seat (facing the road, -x) */
export const CURB: V3 = [5.3, -0.52, 52];
/** Kiosk: you at the counter (facing +x), the barista-bot behind it */
export const HERO_KIOSK: V3 = [8.25, 0.15, 45.15];
export const BARISTA: V3 = [9.75, 0.25, 45.6];
/** Pizza drone in Shot 8 flies at the lens */
export const droneP = (f: number): V3 => {
  const k = smooth((f - 404) / 52);
  return [lerp(6, 3.9, k), lerp(10.4, 9.1, k) + 0.08 * Math.sin(f * 0.3), lerp(32, 13.0, k)];
};
/** Flying taxi swoop over you in Shot 15 (from behind, toward camera) */
export const taxiSwoop = (f: number): V3 => {
  const k = clamp01((f - 1000) / 40);
  return [lerp(6.4, 5.4, k), 2.7 + 2.4 * (1 - Math.sin(Math.PI * Math.min(1, k * 0.9 + 0.1))), runZ(f) + lerp(-12, 14, k)];
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
  // 1: eyes snap open: medium from the foot of the bed, punch-in on the bolt upright (2036 wall screen behind)
  1: [{ f: 0, s: (f) => dolly([-0.35, 1.3, -0.85], [-1.45, 1.05, 1.55], pushK(f, 0, 0.0028, 0.006, 20), { fov: 44 }) }],
  // 2: close-up: millionaire / broke
  2: [{ f: 56, s: (f) => dolly([-1.4, 1.32, 0.05], [-1.74, 1.2, 1.55], pushK(f, 56, 0.003), { fov: 42, roll: -0.02 }) }],
  // 3: tilt down the knee-length beard
  3: [
    { f: 126, s: (f) => dolly([-1.5, 1.2, 0.15], [-1.75, 1.28, 1.5], pushK(f, 126, 0.0025), { fov: 42 }) },
    { f: 132, dur: 30, s: (f) => dolly([-1.45, 1.05, 0.0], [-1.75, 0.78, 1.35], pushK(f, 132, 0.0025), { fov: 46 }) },
  ],
  // 4: two-shot: the nurse-bot hovers in and takes your pulse
  4: [{ f: 170, s: (f) => dolly([0.55, 1.45, -0.75], [-1.15, 1.05, 1.45], pushK(f, 170, 0.0024), { fov: 46 }) }],
  // 5: nurse-bot close-up (your POV): "Welcome back..."
  5: [{ f: 224, s: (f) => dolly([-1.5, 1.42, 1.05], [-0.75, 1.52, 1.45], pushK(f, 224, 0.0026), { fov: 40 }) }],
  // 6: your reaction: "...for ten years."
  6: [{ f: 300, s: (f) => dolly([-1.38, 1.34, 0.3], [-1.75, 1.28, 1.55], pushK(f, 300, 0.0026, 0.0065, 26), { fov: 40 }) }],
  // 7: out the window: flying-car traffic between the towers
  7: [{ f: 345, s: (f) => dolly([-1.5, 15.5, -14], [1.5, 10.5, 40], pushK(f, 345, 0.0022), { fov: 50 }) }],
  // 8: pizza drone flies at the lens
  8: [{ f: 404, s: (f) => dolly([3.2, 9.3, 9.6], [4.4, 9.6, 30], pushK(f, 404, 0.0022), { fov: 44 }) }],
  // 9: flashback (2026, night): you at the laptop, lit by the screen
  9: [{ f: 460, s: (f) => dolly([0.6, 1.3, -0.55], [0.0, 1.0, 1.6], pushK(f, 460, 0.0024), { fov: 42 }) }],
  // 10: laptop insert: BUY $200 of PotatoCoin
  10: [{ f: 582, s: (f) => dolly([0.04, 1.2, 1.92], [0.0, 0.93, 0.98], pushK(f, 582, 0.0022, 0.005, 24), { fov: 40 }) }],
  // 11: your-POV phone insert: PotatoCoin +2,000,000 %, then the balance counts up to $4,000,000.00
  11: [
    { f: 692, s: (f) => dolly([-1.74, 1.34, 1.52], [-1.75, 0.95, 1.12], pushK(f, 692, 0.0018), { fov: 40 }) },
    { f: 788, dur: 30, s: (f) => dolly([-1.74, 1.2, 1.38], [-1.75, 0.91, 1.1], pushK(f, 788, 0.002), { fov: 40 }) },
  ],
  // 12: your face on "four million": jaw drop
  12: [{ f: 843, s: (f) => dolly([-1.5, 1.24, 0.42], [-1.75, 1.2, 1.55], pushK(f, 843, 0.003, 0.008, 20), { fov: 40 }) }],
  // 13: rip out the IV, leap out of bed
  13: [{ f: 870, s: (f) => dolly([0.15, 1.35, -0.95], [-1.25, 0.95, 1.2], pushK(f, 870, 0.0028), { fov: 46 }) }],
  // 14: side-tracking sprint down the sidewalk, gown + beard flapping
  14: [{ f: 912, s: (f) => ({ pos: [2.2, 1.5, runZ(f) - 1.0], look: [7.0, 1.25, runZ(f) + 0.9], fov: 44, roll: 0.01 }) }],
  // 15: low front: running at camera, a flying taxi swoops over
  15: [{ f: 980, s: (f) => ({ pos: [5.6, 0.75, runZ(f) + 5.2], look: [7.0, 1.55, runZ(f) - 0.5], fov: 48, roll: -0.02 }) }],
  // 16: over-the-shoulder at the PotatoCoin ATM
  16: [{ f: 1060, s: (f) => dolly([6.75, 1.7, 29.1], [9.25, 1.3, 30.05], pushK(f, 1060, 0.0026), { fov: 42 }) }],
  // 17: bricks of cash pour out; you hug them
  17: [{ f: 1158, s: (f) => dolly([5.7, 1.6, 27.5], [8.6, 0.95, 30.3], pushK(f, 1158, 0.0022), { fov: 46 }) }],
  // 18: wide: strolling up to the Future Beans kiosk
  18: [{ f: 1256, s: (f) => dolly([3.6, 2.4, 37.2], [9.0, 2.0, 45.6], pushK(f, 1256, 0.0022), { fov: 46 }) }],
  // 19: over-the-shoulder onto the barista-bot: "One small coffee."
  19: [{ f: 1340, s: (f) => dolly([7.4, 1.8, 43.95], [9.7, 1.55, 45.6], pushK(f, 1340, 0.0026), { fov: 42 }) }],
  // 20: register insert: price flips to $4,000,000.00 on "four"
  20: [{ f: 1410, s: (f) => dolly([8.35, 1.45, 46.27], [9.12, 1.28, 46.42], pushK(f, 1410, 0.0024, 0.006, 24), { fov: 40 }) }],
  // 21: your face: shock -> laugh
  21: [{ f: 1465, s: (f) => dolly([9.2, 1.5, 44.9], [8.25, 1.38, 45.15], pushK(f, 1465, 0.0028), { fov: 40 }) }],
  // 22: the robot doesn't laugh
  22: [{ f: 1532, s: (f) => dolly([8.4, 1.62, 45.4], [9.75, 1.72, 45.62], pushK(f, 1532, 0.0035), { fov: 40 }) }],
  // 23: golden wide: everyone's a millionaire (cash bricks everywhere, billboard over the street)
  23: [{ f: 1566, s: (f) => dolly([1.6, 2.6, 30], [2.0, 4.5, 80], pushK(f, 1566, 0.002), { fov: 46 }) }],
  // 24: Future Beans menu board
  24: [{ f: 1665, s: (f) => dolly([6.35, 2.4, 46.75], [9.8, 2.35, 46.75], pushK(f, 1665, 0.0024), { fov: 42 }) }],
  // 25: payoff: on the curb in your gown with one tiny coffee; glide out to the flying traffic
  25: [
    { f: 1767, s: (f) => dolly([3.55, 1.05, 49.7], [5.3, 0.95, 52.2], pushK(f, 1767, 0.0022), { fov: 42 }) },
    { f: 1884, dur: 40, s: (f) => dolly([2.3, 1.55, 46.6], [5.0, 2.3, 54.0], pushK(f, 1884, 0.0016), { fov: 48 }) },
  ],
};

// Deliberate one-frame state swaps on diegetic screens (QA treats these frames as planned, like cuts and kicks):
// nurse-bot face talk -> smile, BUY -> ORDER FILLED, Loading -> +2,000,000% chart, ATM SELL ALL -> SOLD!
export const PLANNED_SWAPS: number[] = [256, 660, 746, 1137];

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [6 / FPS, 0.4],      // eyes snap open
  [843 / FPS, 0.65],   // "four million" jackpot
  [899 / FPS, 0.8],    // IV rip
  [1026 / FPS, 0.9],   // taxi swoop + horn
  [1205 / FPS, 0.5],   // dive-hug onto the cash
  [1451 / FPS, 0.85],  // $4,000,000.00
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
  { f: 0,    cInf: 10 },  // medium in bed
  { f: 56,   cInf: 13 },  // CU
  { f: 126,  cInf: 12 },  // beard tilt
  { f: 170,  cInf: 8 },   // two-shot
  { f: 224,  cInf: 13 },  // robot CU
  { f: 300,  cInf: 13 },  // reaction CU
  { f: 345,  cInf: 0 },   // flying traffic wide
  { f: 404,  cInf: 6, focus: (f) => droneP(f) },  // pizza drone
  { f: 460,  cInf: 10 },  // flashback medium
  { f: 582,  cInf: 12 },  // laptop insert
  { f: 692,  cInf: 13 },  // phone insert
  { f: 843,  cInf: 12 },  // CU
  { f: 870,  cInf: 7 },
  { f: 912,  cInf: 9 },   // side-track run
  { f: 980,  cInf: 8, focus: (f) => [7.0, 1.3, runZ(f)] },
  { f: 1060, cInf: 10 },  // ATM OTS
  { f: 1158, cInf: 8 },
  { f: 1256, cInf: 3 },   // kiosk wide: sign must read
  { f: 1340, cInf: 11 },  // barista OTS
  { f: 1410, cInf: 12 },  // register insert
  { f: 1465, cInf: 13 },  // your CU
  { f: 1532, cInf: 13 },  // robot CU
  { f: 1566, cInf: 0 },   // golden wide: billboard must read
  { f: 1665, cInf: 6 },   // menu board
  { f: 1767, cInf: 11 },  // curb CU
  { f: 1884, dur: 40, cInf: 5 },
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
