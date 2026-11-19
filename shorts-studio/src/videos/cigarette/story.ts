// Single-source master timeline for "The Beggar's Gutter Trick" (how the cigarette was made): 1,860 frames @ 30 fps = 62.0 s.
// Shot boundaries are fitted to voice/cigarette/words.json (ElevenLabs, 60.36 s, 168 WPM) so every cut lands on a line or
// word onset. Exported to out/cigarette/timeline.json via scripts/export_timeline.mjs (camRig = the core/camera.ts preset
// each hand-tuned camera move is modelled on; the moves themselves live in CAMS below).
import type { LightMode } from "../core/lights";

export const FPS = 30;
export const TOTAL = 1860; // 62.0 s: voice ends f1811 ("cigarette."), ~1.6 s payoff hold
export const AUDIO_PROFILE = "cigarette"; // audio/profile_cigarette.py: period foley + manifest SFX + 5-mood score
export type V3 = [number, number, number];
export type SetName = "street" | "factory" | "camp" | "office" | "barn";

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
  camRig?: string;
  xfade?: number;
  hud?: "testrun";
  sunAz?: number;
  sunEl?: number;
};

// Lighting progression: daylight_crisp (Seville) -> sunset_glow (factory) -> night_spotlight (war camp, boss office)
// -> rainy_overcast (leaky barn, calm underdog, reveal).
export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 46,   set: "street",  light: "daylight_crisp", camRig: "tight_impact_shake" },
  { id: 2,  a: 46,   b: 112,  set: "street",  light: "daylight_crisp", camRig: "low_ground_wide" },
  { id: 3,  a: 112,  b: 196,  set: "street",  light: "daylight_crisp", camRig: "overpass_push_in" },
  { id: 4,  a: 196,  b: 276,  set: "street",  light: "daylight_crisp", camRig: "high_tactical_three_quarter" },
  { id: 5,  a: 276,  b: 322,  set: "street",  light: "daylight_crisp", camRig: "low_bumper_track" },
  { id: 6,  a: 322,  b: 400,  set: "street",  light: "daylight_crisp", camRig: "sitcom_desk_medium" },
  { id: 7,  a: 400,  b: 440,  set: "street",  light: "daylight_crisp", camRig: "tight_impact_shake" },
  { id: 8,  a: 440,  b: 508,  set: "street",  light: "daylight_crisp", camRig: "low_hero_tilt" },
  { id: 9,  a: 508,  b: 600,  set: "factory", light: "sunset_glow",    camRig: "high_tactical_three_quarter", xfade: 8 },
  { id: 10, a: 600,  b: 686,  set: "factory", light: "sunset_glow",    camRig: "overpass_push_in" },
  { id: 11, a: 686,  b: 752,  set: "camp",    light: "night_spotlight", camRig: "low_ground_wide", xfade: 6 },
  { id: 12, a: 752,  b: 840,  set: "camp",    light: "night_spotlight", camRig: "overpass_push_in" },
  { id: 13, a: 840,  b: 930,  set: "office",  light: "night_spotlight", camRig: "overpass_push_in", xfade: 8 },
  { id: 14, a: 930,  b: 1010, set: "office",  light: "night_spotlight", camRig: "sitcom_desk_medium" },
  { id: 15, a: 1010, b: 1110, set: "office",  light: "night_spotlight", camRig: "low_hero_tilt" },
  { id: 16, a: 1110, b: 1200, set: "office",  light: "night_spotlight", camRig: "tight_impact_shake" },
  { id: 17, a: 1200, b: 1285, set: "office",  light: "night_spotlight", camRig: "sitcom_desk_medium" },
  { id: 18, a: 1285, b: 1345, set: "barn",    light: "rainy_overcast",  camRig: "reverse_cabin_reveal" },
  { id: 19, a: 1345, b: 1420, set: "barn",    light: "rainy_overcast",  camRig: "low_ground_wide" },
  { id: 20, a: 1420, b: 1500, set: "barn",    light: "rainy_overcast",  camRig: "passenger_cabin_reveal" },
  { id: 21, a: 1500, b: 1560, set: "barn",    light: "rainy_overcast",  camRig: "tight_impact_shake" },
  { id: 22, a: 1560, b: 1665, set: "barn",    light: "rainy_overcast",  camRig: "device_pov_hud", hud: "testrun" },
  { id: 23, a: 1665, b: 1760, set: "barn",    light: "rainy_overcast",  camRig: "reverse_cabin_reveal" },
  { id: 24, a: 1760, b: TOTAL, set: "barn",   light: "rainy_overcast",  camRig: "low_hero_tilt" },
];

export const FLASH_AT = -1;

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- Music mood map (audio/mix.py build_score) ----------------
export const MUSIC_CUES = [
  { frame: 0,    mood: "mischievous_groove" },  // gutter hustle in sunny Seville
  { frame: 508,  mood: "driving_escalation" },  // factories -> war -> the $75,000 prize
  { frame: 1285, mood: "tense_rainy" },         // leaky barn, the calm kid
  { frame: 1498, mood: "silence_drop" },        // dead stop right before the crank
  { frame: 1770, mood: "resolve_chord" },       // reveal: "the cigarette."
];

// Character dialogue FX for the 4-track mixer (BOSS rides the telephone bandpass)
export const DIALOGUE_FX = { boss: "phone" };

// ---------------- Foley Event Table (exported to timeline.json) ----------------
export type StoryEvent = { frame: number; type: string; gain?: number; pan?: number; desc: string };

export const EVENTS: StoryEvent[] = [
  { frame: 0,    type: "carriage_rumble", gain: 1.0,  pan: -0.2,  desc: "Iron-rimmed carriage wheels + galloping hooves on cobbles" },
  { frame: 3,    type: "cigar_crunch",    gain: 1.25, pan: -0.1,  desc: "CRUNCH: fat cigar flattened under the wheel" },
  { frame: 14,   type: "cigar_crunch",    gain: 0.6,  pan: -0.1,  desc: "Rear wheel finishes the job" },
  { frame: 150,  type: "whoosh_transition", gain: 0.8, pan: -0.2, desc: "Beggar lunges for the gutter" },
  { frame: 158,  type: "pop_in",          gain: 0.75, pan: -0.2,  desc: "Snatch!" },
  { frame: 330,  type: "tobacco_shred",   gain: 0.85, pan: -0.25, desc: "Shredding old cigar leaf" },
  { frame: 362,  type: "tobacco_shred",   gain: 0.8,  pan: -0.25, desc: "Shredding old cigar leaf" },
  { frame: 404,  type: "paper_rustle",    gain: 0.9,  pan: -0.1,  desc: "Scrap paper rolled tight around the leaf" },
  { frame: 446,  type: "coin_clink",      gain: 0.9,  pan: -0.15, desc: "Copper coin dropped in his palm" },
  { frame: 452,  type: "cash_register",   gain: 0.7,  pan: -0.1,  desc: "Ka-ching: sold for pennies" },
  { frame: 478,  type: "crowd_murmur",    gain: 0.8,  pan: 0.0,   desc: "The poor crowd in, coins up" },
  { frame: 504,  type: "whoosh_transition", gain: 0.75, pan: 0.2, desc: "Sweep into the factory" },
  { frame: 654,  type: "pop_in",          gain: 0.7,  pan: 0.15,  desc: "Chalk slate: 4 a minute" },
  { frame: 684,  type: "whoosh_transition", gain: 0.8, pan: 0.0,  desc: "Into the war" },
  { frame: 702,  type: "cannon_boom",     gain: 1.3,  pan: 0.15,  desc: "Field cannon fires: 'war.'" },
  { frame: 771,  type: "paper_rustle",    gain: 0.75, pan: -0.2,  desc: "Newspaper torn and rolled" },
  { frame: 812,  type: "whoosh_transition", gain: 0.6, pan: 0.3, desc: "Kit bag slung for home" },
  { frame: 1016, type: "poster_unroll",   gain: 0.9,  pan: -0.25, desc: "Prize poster unfurls" },
  { frame: 1047, type: "cash_register",   gain: 0.85, pan: -0.2,  desc: "$75,000" },
  { frame: 1134, type: "bell_phone",      gain: 0.9,  pan: 0.2,   desc: "Candlestick telephone bell" },
  { frame: 1160, type: "bell_phone",      gain: 0.85, pan: 0.2,   desc: "Candlestick telephone bell" },
  { frame: 1188, type: "pop_in",          gain: 0.6,  pan: 0.2,   desc: "Earpiece snatched off the hook" },
  { frame: 1252, type: "counter_flip",    gain: 0.9,  pan: -0.3,  desc: "FAILED MACHINES flips 41 -> 42" },
  { frame: 1282, type: "whoosh_transition", gain: 0.7, pan: 0.0,  desc: "Into the barn" },
  { frame: 1350, type: "thunder",         gain: 1.0,  pan: -0.2,  desc: "Rolling thunder over the barn" },
  { frame: 1432, type: "metal_clank",     gain: 0.8,  pan: 0.2,   desc: "Wrench on iron" },
  { frame: 1466, type: "metal_clank",     gain: 0.7,  pan: 0.25,  desc: "Wrench on iron" },
  { frame: 1478, type: "drip",            gain: 0.7,  pan: -0.3,  desc: "Roof leak into the bucket" },
  { frame: 1511, type: "crank_ratchet",   gain: 1.0,  pan: 0.2,   desc: "One crank" },
  { frame: 1527, type: "machine_start",   gain: 1.25, pan: 0.0,   desc: "The machine roars to life (loops to the end)" },
  { frame: 1562, type: "camera_beep",     gain: 0.7,  pan: 0.0,   desc: "Test-run REC beep" },
  { frame: 1591, type: "counter_flip",    gain: 0.6,  pan: 0.25,  desc: "Output counter" },
  { frame: 1647, type: "counter_flip",    gain: 0.7,  pan: 0.25,  desc: "Output counter: 120,000 / day" },
  { frame: 1724, type: "thunder",         gain: 0.85, pan: 0.1,   desc: "Low rumble on 'deadliest'" },
  { frame: 1782, type: "drip",            gain: 0.6,  pan: 0.0,   desc: "Last drip before the reveal" },
];

// ---------------- Shared kinematics (sets.ts poses + CAMS framing read the same functions) ----------------
/** Street: carriage body centre z (moves +z at 6 m/s; front wheel crushes the cigar at f3) */
export const CARRIAGE_X = -0.75;
export const CIGAR_POS: V3 = [-1.6, 0.04, 6.0];
export const carZ = (f: number) => 5 + 0.2 * (f - 3);
/** Street: the beggar scrambles from his wall to the gutter and back to his step */
export const beggarPos = (f: number): V3 => {
  if (f < 128) return [-3.65, 0, 8.2];
  if (f < 152) { const k = smooth((f - 128) / 24); return [lerp(-3.65, -2.25, k), 0, lerp(8.2, 6.55, k)]; }
  return [-2.25, 0, 6.55];
};
export const BEGGAR_STEP: V3 = [-3.45, 0, 9.0];
/** Barn: flywheel angle (rad) after the crank */
export const flyAngle = (f: number) => (f < 1511 ? 0 : f < 1527 ? 0.9 * smooth((f - 1511) / 16) : 0.9 + (f - 1527) * 0.55);
/** Barn: machine output count (200 / min shown on the test-run HUD) */
export const outputCount = (f: number) => (f < 1530 ? 0 : Math.floor((f - 1530) * (200 / 60 / FPS) * 60 * 0.6));

// ---------------- Camera Grammar (smootherstep glides, creeping holds, handheld breath, 7f kicks) ----------------
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

/** exponential creep-in factor (1 -> <1) with an optional punch-in burst */
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
/** lateral truck: slide pos + look sideways together (dx per frame along x / z) */
const truck = (pos: V3, look: V3, f: number, f0: number, vx: number, vz = 0, rest: Partial<Cam> = {}): ShotCam => {
  const d = f - f0;
  return { pos: [pos[0] + vx * d, pos[1], pos[2] + vz * d], look: [look[0] + vx * d, look[1], look[2] + vz * d], ...rest };
};

export const CAMS: Record<number, CamKey[]> = {
  // 1: COLD OPEN: low quarter angle on the cigar in the gutter; the iron wheel rolls over it on f3
  1: [{ f: 0, s: (f) => dolly([-2.55, 0.26, 6.95], [-1.55, 0.12, 5.95], pushK(f, 0, 0.003), { fov: 46, roll: 0.03 }) }],
  // 2: near-cobble wide: the flattened cigar foreground, the carriage + rich man rolling away
  2: [{ f: 46, s: (f) => dolly([-1.35, 0.2, 4.4], [-0.6, 0.9, 16.0], pushK(f, 46, 0.0022), { fov: 44 }) }],
  // 3: high start pushing into the beggar's close-up as he snatches it
  3: [
    { f: 112, s: (f) => dolly([0.4, 3.6, 3.2], [-2.6, 0.6, 7.0], pushK(f, 112, 0.0024), { fov: 42 }) },
    { f: 140, dur: 40, s: (f) => dolly([-0.75, 1.25, 4.45], [-2.2, 0.85, 6.5], pushK(f, 140, 0.0024), { fov: 42 }) },
  ],
  // 4: elevated 3/4 establishing of the Seville street with the cathedral tower at its end
  4: [{ f: 196, s: (f) => truck([2.6, 6.6, -3.0], [-0.6, 1.4, 22.0], f, 196, -0.006, 0.012, { fov: 44 }) }],
  // 5: cigar-shop price board -> tilt down to the free butts in the gutter
  5: [
    { f: 276, s: (f) => dolly([2.6, 1.9, 11.0], [4.15, 2.0, 12.25], pushK(f, 276, 0.0025), { fov: 40 }) },
    { f: 290, dur: 26, s: (f) => dolly([1.5, 1.2, 9.4], [2.75, 0.15, 11.6], pushK(f, 290, 0.003), { fov: 40 }) },
  ],
  // 6: across the crate "desk": butts pile foreground third, the beggar shredding
  6: [{ f: 322, s: (f) => truck([-0.55, 1.15, 10.4], [-3.15, 0.75, 8.95], f, 322, 0, -0.004, { fov: 42 }) }],
  // 7: insert: rolling the scrap paper tube
  7: [{ f: 400, s: (f) => dolly([-2.3, 0.95, 8.55], [-2.88, 0.45, 9.0], pushK(f, 400, 0.004), { fov: 40, roll: -0.04 }) }],
  // 8: low hero tilt: the beggar sells, the poor crowd in
  8: [{ f: 440, s: (f) => dolly([-0.6, 0.4, 11.2], [-3.1, 1.45, 8.9], pushK(f, 440, 0.0024, 0.004, 24), { fov: 48, roll: 0.02 }) }],
  // 9: FACTORY: high 3/4 lateral track over rows of hand-rollers (sunset through the arched windows)
  9: [{ f: 508, s: (f) => truck([3.3, 4.6, -2.0], [-0.6, 0.7, 12.0], f, 508, 0, 0.022, { fov: 46 }) }],
  // 10: push into one roller; the chalk slate "4 / MINUTE" pops behind her
  10: [{ f: 600, s: (f) => dolly([-0.1, 2.1, 2.9], [-2.75, 1.05, 5.0], pushK(f, 600, 0.0055), { fov: 40 }) }],
  // 11: WAR: low wide behind the field cannon; muzzle flash on "war"
  11: [{ f: 686, s: (f) => dolly([1.4, 0.55, 2.1], [3.6, 1.0, 13.0], pushK(f, 686, 0.0022, 0.006, 20), { fov: 46 }) }],
  // 12: push from high into the soldier rolling newspaper by the fire, kit bag for home
  12: [{ f: 752, s: (f) => dolly([1.6, 2.6, -2.2], [-0.85, 0.95, 0.75], pushK(f, 752, 0.0028), { fov: 42 }) }],
  // 13: OFFICE: overpass push-in on the desperate tobacco boss under the spotlight
  13: [{ f: 840, s: (f) => dolly([0.15, 2.3, -3.0], [0.0, 1.25, 0.9], pushK(f, 840, 0.0052), { fov: 42 }) }],
  // 14: across the desk: a tiny tray of hand-rolled sticks vs a tower of orders
  14: [{ f: 930, s: (f) => truck([1.05, 1.08, -1.55], [-0.05, 0.98, 0.45], f, 930, -0.004, 0, { fov: 40 }) }],
  // 15: low hero tilt: the $75,000 prize poster unfurls, the boss jabs at it
  15: [{ f: 1010, s: (f) => dolly([-0.35, 0.55, 1.35], [-1.75, 1.7, 3.5], pushK(f, 1010, 0.0024), { fov: 50, roll: 0.025 }) }],
  // 16: candlestick telephone rattles on its bell; the boss snatches the earpiece
  16: [{ f: 1110, s: (f) => dolly([1.25, 1.06, -0.75], [0.62, 0.95, -0.08], pushK(f, 1110, 0.0035), { fov: 38 }) }],
  // 17: sitcom medium: FAILED MACHINES flip counter foreground, the boss guffawing into the phone
  17: [{ f: 1200, s: (f) => truck([-0.45, 1.12, -1.85], [0.12, 1.05, 0.55], f, 1200, 0.003, 0, { fov: 40 }) }],
  // 18: BARN: the kid at the wall telephone, rain behind him, calm as you like
  18: [{ f: 1285, s: (f) => dolly([1.15, 1.5, 2.85], [3.35, 1.25, 4.75], pushK(f, 1285, 0.003), { fov: 42 }) }],
  // 19: exterior low wide: the leaky barn in the downpour, warm lantern spilling from the door
  19: [{ f: 1345, s: (f) => truck([-14.0, 1.1, -5.0], [-2.5, 2.2, 3.0], f, 1345, 0.014, 0.01, { fov: 46 }) }],
  // 20: low interior looking up across the kid at the machine + the hanging lantern
  20: [{ f: 1420, s: (f) => dolly([-0.55, 0.5, 0.45], [0.95, 1.4, 2.15], pushK(f, 1420, 0.0024), { fov: 52, roll: -0.02 }) }],
  // 21: tight on the crank; impact kick on "crank", second on "roars"
  21: [{ f: 1500, s: (f) => dolly([1.6, 1.45, 1.55], [1.3, 1.05, 3.05], pushK(f, 1500, 0.0028, 0.006, 20), { fov: 46 }) }],
  // 22: test-run POV down the output chute (HUD)
  22: [{ f: 1560, s: (f) => dolly([0.05, 1.32, 0.55], [0.0, 0.92, 2.15], pushK(f, 1560, 0.0022), { fov: 50 }) }],
  // 23: reverse reveal over the growing pile onto the kid's face (lantern flicker on "deadliest")
  23: [{ f: 1665, s: (f) => dolly([-0.75, 1.05, 1.0], [1.45, 1.3, 2.35], pushK(f, 1665, 0.0024), { fov: 40 }) }],
  // 24: payoff: one finished stick rolls off the pile toward the lens; low push in
  24: [{ f: 1760, s: (f) => dolly([0.55, 0.98, 1.05], [0.05, 0.86, 1.95], pushK(f, 1760, 0.0034), { fov: 36, roll: 0.02 }) }],
};

// 7-frame sign-alternating impact kicks ([time_s, amplitude])
export const KICKS: [number, number][] = [
  [3 / FPS, 1.5],     // CRUNCH
  [702 / FPS, 1.3],   // cannon
  [1016 / FPS, 0.45], // poster unfurls
  [1252 / FPS, 0.4],  // counter flip
  [1511 / FPS, 0.9],  // crank
  [1527 / FPS, 1.1],  // machine roars
];

export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};

/** subtle deterministic handheld breath so no shot is ever locked-off */
const breath = (f: number, id: number): V3 => [
  0.006 * Math.sin(f * 0.071 + id) + 0.003 * Math.sin(f * 0.19 + id * 2.1),
  0.005 * Math.sin(f * 0.053 + id * 0.7) + 0.002 * Math.sin(f * 0.23 + id),
  0.004 * Math.sin(f * 0.061 + id * 1.3),
];

export const camAt = (id: number, f: number): Cam => {
  const c0 = runKeys(CAMS[id], f);
  const b = breath(f, id);
  const c: Cam = { ...c0, pos: [c0.pos[0] + b[0], c0.pos[1] + b[1], c0.pos[2] + b[2]] };
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
  { f: 0,    cInf: 14, focus: () => CIGAR_POS },
  { f: 46,   cInf: 7 },
  { f: 112,  cInf: 6 },
  { f: 140,  dur: 30, cInf: 11, focus: (f) => [beggarPos(f)[0], 0.9, beggarPos(f)[2]] },
  { f: 196,  cInf: 0 },
  { f: 276,  cInf: 6 },
  { f: 322,  cInf: 9 },
  { f: 400,  cInf: 14 },
  { f: 440,  cInf: 8 },
  { f: 508,  cInf: 2 },
  { f: 600,  cInf: 10 },
  { f: 686,  cInf: 5 },
  { f: 752,  cInf: 9 },
  { f: 840,  cInf: 8 },
  { f: 930,  cInf: 10 },
  { f: 1010, cInf: 5 },
  { f: 1110, cInf: 13 },
  { f: 1200, cInf: 8 },
  { f: 1285, cInf: 10 },
  { f: 1345, cInf: 2 },
  { f: 1420, cInf: 8 },
  { f: 1500, cInf: 12 },
  { f: 1560, cInf: 9 },
  { f: 1665, cInf: 10 },
  { f: 1760, cInf: 14, focus: () => [0.05, 0.86, 1.95] },
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
