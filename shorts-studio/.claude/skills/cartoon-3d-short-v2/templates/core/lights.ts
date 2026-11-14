// 5-Mode Light Presets + World Look Palettes (day, golden, night, interior, rain).
// Sun is CAMERA-RELATIVE and frozen per shot: az = deg from forward view axis (0 = straight ahead backlight,
// +90 = screen right, 180 = behind camera), el = elevation deg.
export type C3 = [number, number, number];
export type LightMode = "day" | "golden" | "night" | "interior" | "rain";

export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3;
  blob: C3; actorShadow: boolean;
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string;
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;
  bias: number; normalBias: number;
};

export const LIGHTS: Record<LightMode, LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.50, 1.33], shade: [0.30, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.20,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.20, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 320, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 10, el: 8,
    lit: [1.50, 0.68, 0.24], shade: [0.15, 0.15, 0.30], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.10, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.90], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 40, fogFar: 360, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.2, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.50,
    bias: -0.0006, normalBias: 0.03,
  },
  night: {
    az: 42, el: 34,
    lit: [0.55, 0.64, 0.98], shade: [0.14, 0.17, 0.34], lift: [0.03, 0.04, 0.12], lambert: 0.30, sideK: 0.78, term: 0.18,
    charTint: [0.84, 0.88, 1.00], charShade: 0.82, charGrad: 0.09, bodyGrad: 0.24, sideTint: [0.74, 0.78, 0.98],
    blob: [0.38, 0.40, 0.58], actorShadow: false,
    top: "#091126", hor: "#1d2f58", skyCurve: [0.0, 0.55, 0.75], fog: "#18284c", fogNear: 22, fogFar: 240, sunDisc: "#e6eef7",
    sunCol: "#9cb8ff", sunI: 1.4, sky: "#243b6b", ground: "#1b1d36", hemiI: 0.45,
    bias: -0.0003, normalBias: 0.018,
  },
  interior: {
    az: 65, el: 38,
    lit: [1.42, 1.34, 1.24], shade: [0.46, 0.42, 0.54], lift: [0.06, 0.05, 0.09], lambert: 0.28, sideK: 0.88, term: 0.24,
    charTint: [1.0, 0.96, 0.93], charShade: 0.90, charGrad: 0.08, bodyGrad: 0.18, sideTint: [0.90, 0.88, 0.96],
    blob: [0.58, 0.54, 0.60], actorShadow: false,
    top: "#4f8cdb", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#c9d6ea", fogNear: 60, fogFar: 420, sunDisc: "#000000",
    sunCol: "#fff4e4", sunI: 2.2, sky: "#f2eade", ground: "#8c7a6b", hemiI: 0.65,
    bias: -0.00025, normalBias: 0.015,
  },
  rain: {
    az: 80, el: 52,
    lit: [1.05, 1.12, 1.22], shade: [0.34, 0.38, 0.48], lift: [0.05, 0.07, 0.12], lambert: 0.25, sideK: 0.86, term: 0.26,
    charTint: [0.92, 0.95, 1.00], charShade: 0.88, charGrad: 0.06, bodyGrad: 0.18, sideTint: [0.84, 0.88, 0.96],
    blob: [0.48, 0.52, 0.60], actorShadow: false,
    top: "#46596e", hor: "#8fa3b8", skyCurve: [0.0, 0.5, 0.65], fog: "#8fa3b8", fogNear: 18, fogFar: 190, sunDisc: "#000000",
    sunCol: "#d4e2f0", sunI: 1.8, sky: "#9cb0c4", ground: "#4f5866", hemiI: 0.60,
    bias: -0.00025, normalBias: 0.015,
  },
};

export type WorldLook = {
  sky: { c: string[]; e: number[] };
  bounce: C3;
  sat: number;
  cloud: { lit: string; mid: string; shade: string };
};

export const LOOK: Record<LightMode, WorldLook> = {
  day: {
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0], sat: 1.08,
  },
  golden: {
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.05, 0.025, 0.0], sat: 1.10,
  },
  night: {
    sky: { c: ["#1d2f58", "#16264a", "#101c3b", "#0b142e", "#070d20"], e: [0, 4, 10, 20, 42] },
    cloud: { lit: "#3e4d7a", mid: "#2b375c", shade: "#1c2442" },
    bounce: [0.02, 0.03, 0.06], sat: 1.12,
  },
  interior: {
    sky: { c: ["#cfe0f5", "#a8c8ee", "#78aae4", "#5892db", "#3c78cc"], e: [0, 3, 8, 16, 40] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0.16, 0.13, 0.10], sat: 1.05,
  },
  rain: {
    sky: { c: ["#96aab8", "#8398a8", "#6d8294", "#596e82", "#45586b"], e: [0, 3, 9, 18, 40] },
    cloud: { lit: "#b2c0cc", mid: "#8f9fad", shade: "#6d7d8c" },
    bounce: [0.03, 0.04, 0.06], sat: 0.94,
  },
};
