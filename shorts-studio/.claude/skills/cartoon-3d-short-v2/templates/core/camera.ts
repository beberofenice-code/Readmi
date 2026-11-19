// Dynamic Camera Choreography System & 12 Reusable Camera Rig Presets.
// Enforces dynamic pacing (cuts every 2.0-3.5s, 18-25 shots per 60s short) and guarantees intentional
// motion on EVERY shot (slow push-in, lateral tracking, subtle handheld drift, or damped impact shake)
// — never a static frozen camera.
export type V3 = [number, number, number];

export type Cam = {
  pos: V3;
  look: V3;
  fov: number;
  roll?: number;
};

export type ShotCam = {
  id?: number;
  name?: string;
  start: number;
  end: number;
  cam: (t: number, frame: number) => Cam;
};

export type CamKey = [number, V3, V3, number, number?];

export type CameraRigName =
  | "hood_windshield"
  | "interior_dash_pov"
  | "tight_impact_shake"
  | "low_ground_wide"
  | "low_bumper_track"
  | "high_tactical_three_quarter"
  | "low_hero_tilt"
  | "sitcom_desk_medium"
  | "overpass_push_in"
  | "passenger_cabin_reveal"
  | "device_pov_hud"
  | "reverse_cabin_reveal";

/** Enforced viral pacing constants (checked by `validateShotPacing` and `short_qa.py`). */
export const PACING_RULES = {
  minShotSec: 2.0,
  maxShotSec: 3.5,
  targetShotsPer60s: [18, 25] as const,
  /** Minimum world-unit camera travel / FOV shift expected over a shot so no camera is frozen */
  minMotionPerShot: 0.015,
};

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  pos: lerp3(a.pos, b.pos, t),
  look: lerp3(a.look, b.look, t),
  fov: lerp(a.fov, b.fov, t),
  roll: lerp(a.roll ?? 0, b.roll ?? 0, t),
});

/** Smooth camera glide between two poses with optional cosine ease. */
export const glide = (a: Cam, b: Cam, t: number): Cam => mixCam(a, b, smooth(t));

/** Subtle continuous FOV push-in (positive zoom narrows FOV). */
export const pushK = (base: Cam, t: number, fovDelta = -4.5, drift = 0.03, frame = 0): Cam => {
  const hd = handheldDrift(frame, drift, 0.9, 3);
  return {
    pos: add3(base.pos, hd.posOffset),
    look: add3(base.look, hd.lookOffset),
    fov: base.fov + fovDelta * smooth(t),
    roll: (base.roll ?? 0) + hd.roll,
  };
};

/** Linear/smooth dolly move from `posA` to `posB` tracking `lookA` -> `lookB`. */
export const dolly = (posA: V3, posB: V3, lookA: V3, lookB: V3, fovA: number, fovB: number, t: number): Cam => {
  const s = smooth(t);
  return { pos: lerp3(posA, posB, s), look: lerp3(lookA, lookB, s), fov: lerp(fovA, fovB, s), roll: 0 };
};

/** Multi-keyframe smoothstep camera spline. */
export const runKeys = (keys: CamKey[], t: number): Cam => {
  if (!keys.length) return { pos: [0, 2, 5], look: [0, 1, 0], fov: 42, roll: 0 };
  if (t <= keys[0][0]) return { pos: keys[0][1], look: keys[0][2], fov: keys[0][3], roll: keys[0][4] ?? 0 };
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const u = smooth((t - keys[i - 1][0]) / Math.max(1e-5, keys[i][0] - keys[i - 1][0]));
      return mixCam(
        { pos: keys[i - 1][1], look: keys[i - 1][2], fov: keys[i - 1][3], roll: keys[i - 1][4] ?? 0 },
        { pos: keys[i][1], look: keys[i][2], fov: keys[i][3], roll: keys[i][4] ?? 0 },
        u,
      );
    }
  }
  const last = keys[keys.length - 1];
  return { pos: last[1], look: last[2], fov: last[3], roll: last[4] ?? 0 };
};

/**
 * Damped harmonic spring camera shake triggered on an exact impact/collision frame.
 * Zero before `impactFrame`, crisp high-frequency punch on impact, decays cleanly to rest.
 */
export const dampedSpringShake = (
  frame: number,
  impactFrame: number,
  opts: { amp?: number; freq?: number; decay?: number; fps?: number; rollAmp?: number } = {},
): { posOffset: V3; lookOffset: V3; roll: number } => {
  const { amp = 0.24, freq = 28, decay = 8.5, fps = 30, rollAmp = 0.045 } = opts;
  const dt = (frame - impactFrame) / fps;
  if (dt < 0 || dt > 1.4) {
    return { posOffset: [0, 0, 0], lookOffset: [0, 0, 0], roll: 0 };
  }
  const env = Math.exp(-decay * dt);
  const sx = Math.sin(dt * freq * 1.13) * env * amp;
  const sy = Math.cos(dt * freq * 1.47) * env * amp * 0.85;
  const sz = Math.sin(dt * freq * 0.89 + 0.7) * env * amp * 0.45;
  const roll = Math.sin(dt * freq * 1.25 + 0.4) * env * rollAmp;
  return {
    posOffset: [sx, sy, sz],
    lookOffset: [sx * 0.65, sy * 0.65, 0],
    roll,
  };
};

/**
 * Deterministic subtle handheld breathing / road vibration drift so no shot ever looks frozen.
 */
export const handheldDrift = (
  frame: number,
  amp = 0.032,
  speed = 1.0,
  seed = 1,
): { posOffset: V3; lookOffset: V3; roll: number } => {
  const t = (frame / 30) * speed;
  const p = seed * 1.73;
  const dx = (Math.sin(t * 1.9 + p) * 0.6 + Math.sin(t * 4.3 + p * 2.1) * 0.4) * amp;
  const dy = (Math.cos(t * 1.5 + p * 0.7) * 0.65 + Math.sin(t * 3.7 + p * 1.4) * 0.35) * amp * 0.8;
  const dz = Math.sin(t * 1.1 + p * 1.3) * amp * 0.35;
  const roll = Math.sin(t * 1.35 + p) * amp * 0.14;
  return {
    posOffset: [dx, dy, dz],
    lookOffset: [dx * 0.35, dy * 0.35, 0],
    roll,
  };
};

/** Composes handheld drift and optional damped impact shake kicks onto a base camera pose. */
export const evalCamWithKicks = (
  base: Cam,
  frame: number,
  fps = 30,
  opts: { driftAmp?: number; driftSeed?: number; impactFrames?: number[]; shakeAmp?: number } = {},
): Cam => {
  const { driftAmp = 0.028, driftSeed = 1, impactFrames = [], shakeAmp = 0.24 } = opts;
  const hd = handheldDrift(frame, driftAmp, 1.0, driftSeed);
  let pos = add3(base.pos, hd.posOffset);
  let look = add3(base.look, hd.lookOffset);
  let roll = (base.roll ?? 0) + hd.roll;

  for (const imp of impactFrames) {
    const sh = dampedSpringShake(frame, imp, { amp: shakeAmp, fps });
    pos = add3(pos, sh.posOffset);
    look = add3(look, sh.lookOffset);
    roll += sh.roll;
  }
  return { pos, look, fov: base.fov, roll };
};

// ---------------- 12 Reusable Camera Rig Presets ----------------

export type CameraRigOptions = {
  /** World-space anchor point (vehicle origin, character position, desk center, or impact point) */
  anchor?: V3;
  /** Optional world-space look target override */
  target?: V3;
  /** Facing yaw in radians (0 = looking along +z) */
  yaw?: number;
  /** Exact impact frame (used by `tight_impact_shake` or any rig with shake) */
  impactFrame?: number;
  /** FPS for impact shake timing (default 30) */
  fps?: number;
  /** Motion amplitude multiplier (default 1.0) */
  motionScale?: number;
  /** Shake amplitude for impact rigs (default 0.26) */
  shakeAmp?: number;
  /** Side flip (-1 or +1) for left/right handed framing */
  side?: -1 | 1;
  /** Seed for deterministic handheld drift */
  seed?: number;
};

export type CameraRigFn = (t: number, frame: number) => Cam;

const rotY = (v: V3, yaw: number): V3 => {
  if (!yaw) return v;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};

const localToWorld = (anchor: V3, offset: V3, yaw: number): V3 => add3(anchor, rotY(offset, yaw));

/**
 * 1. `hood_windshield`: Mounted on vehicle hood angled slightly up through the windshield at the driver's face.
 * Includes subtle road vibration + gradual push-in toward the driver's expression.
 */
export const hood_windshield = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 11 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const vib = handheldDrift(frame, 0.022 * motionScale, 2.6, seed);
    const basePos = localToWorld(anchor, [side * (0.18 - 0.10 * s), 1.18 + 0.04 * s, 2.35 - 0.28 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [side * -0.22, 1.42, 0.15], yaw);
    return {
      pos: add3(basePos, vib.posOffset),
      look: add3(baseLook, vib.lookOffset),
      fov: lerp(38, 34, s),
      roll: vib.roll * 0.7,
    };
  };
};

/**
 * 2. `interior_dash_pov`: Positioned behind the steering wheel and glowing instrument cluster looking forward
 * out the windshield. Includes subtle cabin suspension bounce & drift.
 */
export const interior_dash_pov = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = -1, seed = 12 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.024 * motionScale, 1.8, seed);
    const basePos = localToWorld(anchor, [side * 0.34, 1.34 + 0.02 * s, -0.32 + 0.14 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [side * 0.18, 1.16, 6.5], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(54, 50, s),
      roll: hd.roll,
    };
  };
};

/**
 * 3. `tight_impact_shake`: Low quarter-angle close-up on a collision/action point with damped spring
 * camera shake on the exact `impactFrame` + dramatic punch-in.
 */
export const tight_impact_shake = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0.7, 0], target, yaw = 0, impactFrame = 15, fps = 30, motionScale = 1, shakeAmp = 0.28, side = 1, seed = 13 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const basePos = localToWorld(anchor, [side * (2.6 - 0.45 * s), 0.72 + 0.10 * s, 2.2 - 0.35 * s], yaw);
    const baseLook = target ?? anchor;
    const base: Cam = {
      pos: basePos,
      look: baseLook,
      fov: lerp(40, 33, s),
      roll: side * 0.025 * (1 - s),
    };
    return evalCamWithKicks(base, frame, fps, {
      driftAmp: 0.02 * motionScale,
      driftSeed: seed,
      impactFrames: [impactFrame],
      shakeAmp: shakeAmp * motionScale,
    });
  };
};

/**
 * 4. `low_ground_wide`: Near-asphalt low angle exaggerating character poses and vehicle scale,
 * with a crisp lateral slide + upward tilt.
 */
export const low_ground_wide = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 14 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.025 * motionScale, 0.9, seed);
    const basePos = localToWorld(anchor, [side * (2.8 - 1.1 * s * motionScale), 0.34 + 0.08 * s, 5.4 - 0.55 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 1.25, 0], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(50, 46, s),
      roll: hd.roll,
    };
  };
};

/**
 * 5. `low_bumper_track`: Gliding low right in front of a moving vehicle's grille while background
 * traffic streams past.
 */
export const low_bumper_track = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 15 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const weave = Math.sin(t * Math.PI * 1.2) * 0.22 * motionScale;
    const road = handheldDrift(frame, 0.026 * motionScale, 2.8, seed);
    const basePos = localToWorld(anchor, [side * (0.95 - 0.35 * s) + weave, 0.44 + 0.05 * s, 4.1 - 0.45 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 0.85, 0.4], yaw);
    return {
      pos: add3(basePos, road.posOffset),
      look: add3(baseLook, road.lookOffset),
      fov: lerp(46, 42, s),
      roll: road.roll * 0.9,
    };
  };
};

/**
 * 6. `high_tactical_three_quarter`: Elevated 3/4 side angle built to make multi-vehicle or spatial
 * geometry crystal clear, with a continuous smooth lateral orbit.
 */
export const high_tactical_three_quarter = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 16 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.022 * motionScale, 0.7, seed);
    const basePos = localToWorld(anchor, [side * (7.2 - 1.2 * s * motionScale), 5.8 - 0.55 * s, 7.6 - 0.9 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 0.75, 0], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(40, 36, s),
      roll: hd.roll * 0.4,
    };
  };
};

/**
 * 7. `low_hero_tilt`: Slightly tilted upward hero shot for peaks of greed, victory, or dramatic reveals.
 * Slow upward pedestal + confident push-in.
 */
export const low_hero_tilt = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 17 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.022 * motionScale, 0.85, seed);
    const basePos = localToWorld(anchor, [side * (0.45 - 0.25 * s), 0.78 + 0.16 * s, 2.75 - 0.48 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 1.58, 0], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(42, 35, s),
      roll: side * 0.045 + hd.roll,
    };
  };
};

/**
 * 8. `sitcom_desk_medium`: Eye-level medium shot across a desk/counter with a foreground comedic prop
 * on one third and rich office/skyline depth behind.
 */
export const sitcom_desk_medium = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 18 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.018 * motionScale, 0.8, seed);
    const basePos = localToWorld(anchor, [side * (0.35 - 0.18 * s), 1.38 + 0.03 * s, 2.65 - 0.38 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [side * -0.10, 1.24, 0], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(38, 34, s),
      roll: hd.roll * 0.5,
    };
  };
};

/**
 * 9. `overpass_push_in`: Starts from an elevated wide vantage point and smoothly zooms/pushes straight
 * into a character's close-up reaction.
 */
export const overpass_push_in = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 19 } = opts;
  return (t, frame) => {
    const s = easeOutCubic(t);
    const hd = handheldDrift(frame, 0.02 * motionScale, 0.9, seed);
    const startPos = localToWorld(anchor, [side * 2.2, 6.2, 9.5], yaw);
    const endPos = localToWorld(anchor, [side * 0.35, 1.58, 2.15], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 1.38, 0], yaw);
    return {
      pos: add3(lerp3(startPos, endPos, s), hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(46, 32, s),
      roll: hd.roll * 0.5,
    };
  };
};

/**
 * 10. `passenger_cabin_reveal`: Low interior angle looking up across a seated character toward a key
 * prop mounted above (e.g., rearview mirror dashcam, visor, overhead sign).
 */
export const passenger_cabin_reveal = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = 1, seed = 20 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.02 * motionScale, 1.2, seed);
    const basePos = localToWorld(anchor, [side * 0.52, 0.96 + 0.06 * s, -0.35 + 0.14 * s], yaw);
    const startLook = localToWorld(anchor, [side * -0.25, 1.28, 0.2], yaw);
    const endLook = target ?? localToWorld(anchor, [0, 1.58, 0.72], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(lerp3(startLook, endLook, s), hd.lookOffset),
      fov: lerp(46, 40, s),
      roll: hd.roll,
    };
  };
};

/**
 * 11. `device_pov_hud`: Literal in-world wide-angle camera/screen lens view designed to pair with
 * `<DiegeticHUD>` (dashcam, bodycam, security cam, or phone REC).
 */
export const device_pov_hud = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, seed = 21 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const vib = handheldDrift(frame, 0.015 * motionScale, 3.2, seed);
    const basePos = localToWorld(anchor, [0, 1.48, 0.76 + 0.08 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [0, 1.22, 12.0], yaw);
    return {
      pos: add3(basePos, vib.posOffset),
      look: add3(baseLook, vib.lookOffset),
      fov: lerp(64, 62, s),
      roll: vib.roll * 0.4,
    };
  };
};

/**
 * 12. `reverse_cabin_reveal`: Reverse angle from the front dashboard/windshield looking back at the
 * driver/character and active blinking device LED.
 */
export const reverse_cabin_reveal = (opts: CameraRigOptions = {}): CameraRigFn => {
  const { anchor = [0, 0, 0], target, yaw = 0, motionScale = 1, side = -1, seed = 22 } = opts;
  return (t, frame) => {
    const s = smooth(t);
    const hd = handheldDrift(frame, 0.02 * motionScale, 1.1, seed);
    const basePos = localToWorld(anchor, [side * (0.14 + 0.16 * s), 1.44 - 0.04 * s, 0.88 - 0.18 * s], yaw);
    const baseLook = target ?? localToWorld(anchor, [side * 0.22, 1.32, -0.35], yaw);
    return {
      pos: add3(basePos, hd.posOffset),
      look: add3(baseLook, hd.lookOffset),
      fov: lerp(44, 38, s),
      roll: hd.roll * 0.6,
    };
  };
};

export const CAMERA_RIGS: Record<CameraRigName, (opts?: CameraRigOptions) => CameraRigFn> = {
  hood_windshield,
  interior_dash_pov,
  tight_impact_shake,
  low_ground_wide,
  low_bumper_track,
  high_tactical_three_quarter,
  low_hero_tilt,
  sitcom_desk_medium,
  overpass_push_in,
  passenger_cabin_reveal,
  device_pov_hud,
  reverse_cabin_reveal,
};

/** Instantiate any of the 12 reusable camera rig presets by name. */
export const createCameraRig = (preset: CameraRigName, opts?: CameraRigOptions): CameraRigFn =>
  CAMERA_RIGS[preset](opts);

// ---------------- Pacing & Motion Validator ----------------

export type PacingViolation = {
  shotId: number;
  name: string;
  issue: string;
};

export type PacingReport = {
  ok: boolean;
  shotCount: number;
  totalSec: number;
  shotsPer60s: number;
  avgShotSec: number;
  violations: PacingViolation[];
};

/**
 * Validates that a shot list honors the 2.0-3.5s pacing rule (18-25 shots per 60s)
 * and that every shot includes intentional camera motion (no frozen cameras).
 */
export const validateShotPacing = (
  shots: ShotCam[],
  fps = 30,
  opts: { allowQuickCutMinSec?: number } = {},
): PacingReport => {
  const { allowQuickCutMinSec = 1.6 } = opts;
  const violations: PacingViolation[] = [];
  if (!shots.length) {
    return { ok: false, shotCount: 0, totalSec: 0, shotsPer60s: 0, avgShotSec: 0, violations: [{ shotId: 0, name: "none", issue: "Empty shot list" }] };
  }
  const totalFrames = Math.max(...shots.map((s) => s.end)) - Math.min(...shots.map((s) => s.start));
  const totalSec = totalFrames / fps;
  const shotsPer60s = totalSec > 0 ? (shots.length / totalSec) * 60 : 0;

  shots.forEach((s, idx) => {
    const id = s.id ?? idx + 1;
    const name = s.name ?? `shot_${id}`;
    const durSec = (s.end - s.start) / fps;
    if (durSec > PACING_RULES.maxShotSec + 0.05) {
      violations.push({ shotId: id, name, issue: `Shot duration ${durSec.toFixed(2)}s exceeds ${PACING_RULES.maxShotSec}s pacing limit (split or add angle cut)` });
    } else if (durSec < allowQuickCutMinSec) {
      violations.push({ shotId: id, name, issue: `Shot duration ${durSec.toFixed(2)}s is shorter than ${allowQuickCutMinSec}s readability floor` });
    }
    // Check that camera moves across the shot (never frozen)
    const c0 = s.cam(0, s.start);
    const cMid = s.cam(0.5, Math.round((s.start + s.end) / 2));
    const c1 = s.cam(1, s.end);
    const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const motion =
      dist(c0.pos, c1.pos) +
      dist(c0.pos, cMid.pos) +
      dist(c0.look, c1.look) +
      Math.abs(c0.fov - c1.fov) * 0.05;
    if (motion < PACING_RULES.minMotionPerShot) {
      violations.push({ shotId: id, name, issue: `Frozen static camera detected (motion=${motion.toFixed(4)} < ${PACING_RULES.minMotionPerShot})` });
    }
  });

  return {
    ok: violations.length === 0,
    shotCount: shots.length,
    totalSec,
    shotsPer60s: Number(shotsPer60s.toFixed(1)),
    avgShotSec: Number((totalSec / shots.length).toFixed(2)),
    violations,
  };
};
