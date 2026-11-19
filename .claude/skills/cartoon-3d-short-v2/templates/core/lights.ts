// Reusable Time-of-Day & Weather Lighting Presets + World Look Palettes.
// Supports both the 4 cinema presets (`daylight_crisp`, `sunset_glow`, `night_spotlight`, `rainy_overcast`)
// and legacy v2 aliases (`day`, `golden`, `night`, `interior`, `rain`) so existing shorts stay 100% compatible.
// Sun is CAMERA-RELATIVE and frozen per shot: az = deg from forward view axis (0 = straight ahead backlight,
// +90 = screen right, 180 = behind camera), el = elevation deg.
export type C3 = [number, number, number];

export type CinemaLightPreset =
  | "daylight_crisp"
  | "sunset_glow"
  | "night_spotlight"
  | "rainy_overcast";

export type LegacyLightMode = "day" | "golden" | "night" | "interior" | "rain";
export type LightMode = LegacyLightMode | CinemaLightPreset;

export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3;
  blob: C3; actorShadow: boolean;
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string;
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;
  bias: number; normalBias: number;
};

/** Environmental atmosphere & post-fx hints paired with each lighting preset */
export type LightAtmosphere = {
  clouds: boolean;
  cloudDensity: number;          // 0..1 stylized cloud coverage
  rain: boolean;                 // animated diagonal rain streaks
  wetAsphalt: boolean;           // glossy reflective wet road mirroring emissive taillights
  wipersRecommended: boolean;    // interior/HUD wiper sweep cue
  overheadSpotlight: boolean;    // warm overhead key spotlight cone (garage / streetlamp)
  spotlightColor: string;
  emissiveGain: number;          // multiplier for headlights/taillights/LEDs
  bloomThreshold: number;
  bloomIntensity: number;
  rimGlow: boolean;              // warm low-angle rim emphasis
};

export const LIGHTS: Record<LightMode, LightPreset> = {
  // ---- Legacy v2 presets (preserved verbatim for existing shorts) ----
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

  // ---- 4 Cinema Lighting & Weather Presets ----
  /** 1. Cobalt blue sky dome, stylized clouds, sharp directional sunlight + soft ground shadows, vibrant materials */
  daylight_crisp: {
    az: 72, el: 52,
    lit: [1.66, 1.58, 1.40], shade: [0.28, 0.30, 0.40], lift: [0.05, 0.07, 0.13], lambert: 0.38, sideK: 0.84, term: 0.16,
    charTint: [1.0, 0.96, 0.93], charShade: 0.87, charGrad: 0.08, bodyGrad: 0.22, sideTint: [0.88, 0.90, 0.98],
    blob: [0.58, 0.56, 0.62], actorShadow: true,
    top: "#1c5cc4", hor: "#a8d2fa", skyCurve: [0.0, 0.45, 0.65], fog: "#a8d2fa", fogNear: 35, fogFar: 360, sunDisc: "#fff7db",
    sunCol: "#fff6e5", sunI: 3.15, sky: "#cfe6ff", ground: "#b69c78", hemiI: 0.58,
    bias: -0.00025, normalBias: 0.015,
  },
  /** 2. Indigo-to-peach twilight sky, warm low-angle rim lighting, emissive glowing headlights/taillights + halo */
  sunset_glow: {
    az: 14, el: 9,
    lit: [1.62, 0.78, 0.34], shade: [0.16, 0.14, 0.34], lift: [0.05, 0.05, 0.19], lambert: 0.36, sideK: 0.80, term: 0.08,
    charTint: [1.0, 0.80, 0.58], charShade: 0.86, charGrad: 0.11, bodyGrad: 0.26, sideTint: [0.80, 0.74, 0.96],
    blob: [0.70, 0.68, 0.90], actorShadow: true,
    top: "#2d2864", hor: "#ffbc82", skyCurve: [0.04, 0.55, 0.95], fog: "#ec9c7e", fogNear: 32, fogFar: 340, sunDisc: "#ffd29d",
    sunCol: "#ffa256", sunI: 5.4, sky: "#cc96b4", ground: "#6f5358", hemiI: 0.48,
    bias: -0.00055, normalBias: 0.028,
  },
  /** 3. Dark blue night sky with dramatic warm overhead key spotlights (garage/streetlamp cones) & high contrast */
  night_spotlight: {
    az: 36, el: 58,
    lit: [1.28, 1.02, 0.68], shade: [0.10, 0.13, 0.29], lift: [0.02, 0.03, 0.10], lambert: 0.34, sideK: 0.72, term: 0.14,
    charTint: [0.96, 0.89, 0.82], charShade: 0.76, charGrad: 0.12, bodyGrad: 0.28, sideTint: [0.64, 0.70, 0.96],
    blob: [0.30, 0.32, 0.52], actorShadow: true,
    top: "#050a1a", hor: "#122146", skyCurve: [0.0, 0.50, 0.72], fog: "#0e1a38", fogNear: 18, fogFar: 210, sunDisc: "#e8eef8",
    sunCol: "#ffd89e", sunI: 2.35, sky: "#1c2e59", ground: "#121526", hemiI: 0.34,
    bias: -0.0003, normalBias: 0.018,
  },
  /** 4. Moody slate/teal overcast sky, diagonal rain streaks, glossy reflective wet asphalt, optional wiper sweeps */
  rainy_overcast: {
    az: 84, el: 50,
    lit: [0.96, 1.08, 1.18], shade: [0.26, 0.33, 0.42], lift: [0.04, 0.07, 0.11], lambert: 0.24, sideK: 0.85, term: 0.28,
    charTint: [0.90, 0.95, 1.00], charShade: 0.85, charGrad: 0.07, bodyGrad: 0.20, sideTint: [0.78, 0.86, 0.94],
    blob: [0.42, 0.48, 0.56], actorShadow: false,
    top: "#2b3f4e", hor: "#6f8796", skyCurve: [0.0, 0.48, 0.68], fog: "#6c8494", fogNear: 16, fogFar: 175, sunDisc: "#000000",
    sunCol: "#c5dbe8", sunI: 1.75, sky: "#7e96a6", ground: "#3b4652", hemiI: 0.58,
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
  daylight_crisp: {
    sky: { c: ["#b7dafc", "#84bdf5", "#4c96e6", "#2974d1", "#1852b5"], e: [0, 3, 9, 18, 42] },
    cloud: { lit: "#ffffff", mid: "#e6eefc", shade: "#bfd0f0" },
    bounce: [0.01, 0.01, 0.0], sat: 1.14,
  },
  sunset_glow: {
    sky: { c: ["#ffd294", "#ffaa78", "#de7b7c", "#7c4c86", "#2c2661"], e: [0, 4, 10, 20, 42] },
    cloud: { lit: "#ffdcb0", mid: "#f09684", shade: "#7c659e" },
    bounce: [0.08, 0.035, 0.01], sat: 1.15,
  },
  night_spotlight: {
    sky: { c: ["#15254d", "#0e1a3a", "#09122b", "#060c1f", "#030714"], e: [0, 4, 10, 20, 42] },
    cloud: { lit: "#34446e", mid: "#212d4f", shade: "#121a33" },
    bounce: [0.06, 0.04, 0.02], sat: 1.16,
  },
  rainy_overcast: {
    sky: { c: ["#7d96a3", "#647e8d", "#4d6776", "#395161", "#283c4a"], e: [0, 3, 9, 18, 40] },
    cloud: { lit: "#9eb1bc", mid: "#748996", shade: "#4d616e" },
    bounce: [0.02, 0.045, 0.06], sat: 0.90,
  },
};

export const LIGHT_ATMOS: Record<LightMode, LightAtmosphere> = {
  day: {
    clouds: true, cloudDensity: 0.55, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: false, spotlightColor: "#fff4d6", emissiveGain: 1.0, bloomThreshold: 1.0, bloomIntensity: 0.45, rimGlow: false,
  },
  golden: {
    clouds: true, cloudDensity: 0.65, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: false, spotlightColor: "#ffb86c", emissiveGain: 1.4, bloomThreshold: 0.9, bloomIntensity: 0.62, rimGlow: true,
  },
  night: {
    clouds: true, cloudDensity: 0.35, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: true, spotlightColor: "#ffd494", emissiveGain: 1.7, bloomThreshold: 0.85, bloomIntensity: 0.72, rimGlow: false,
  },
  interior: {
    clouds: true, cloudDensity: 0.3, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: false, spotlightColor: "#fff0d6", emissiveGain: 1.1, bloomThreshold: 1.0, bloomIntensity: 0.45, rimGlow: false,
  },
  rain: {
    clouds: true, cloudDensity: 0.85, rain: true, wetAsphalt: true, wipersRecommended: true,
    overheadSpotlight: false, spotlightColor: "#cfe0f0", emissiveGain: 1.5, bloomThreshold: 0.9, bloomIntensity: 0.6, rimGlow: false,
  },
  daylight_crisp: {
    clouds: true, cloudDensity: 0.65, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: false, spotlightColor: "#fff5de", emissiveGain: 1.0, bloomThreshold: 1.05, bloomIntensity: 0.42, rimGlow: false,
  },
  sunset_glow: {
    clouds: true, cloudDensity: 0.70, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: false, spotlightColor: "#ffbe7a", emissiveGain: 1.55, bloomThreshold: 0.88, bloomIntensity: 0.68, rimGlow: true,
  },
  night_spotlight: {
    clouds: true, cloudDensity: 0.30, rain: false, wetAsphalt: false, wipersRecommended: false,
    overheadSpotlight: true, spotlightColor: "#ffd28a", emissiveGain: 1.85, bloomThreshold: 0.82, bloomIntensity: 0.78, rimGlow: false,
  },
  rainy_overcast: {
    clouds: true, cloudDensity: 0.92, rain: true, wetAsphalt: true, wipersRecommended: true,
    overheadSpotlight: false, spotlightColor: "#b8d2e0", emissiveGain: 1.65, bloomThreshold: 0.88, bloomIntensity: 0.65, rimGlow: false,
  },
};

export const isRainLight = (mode: LightMode): boolean => mode === "rain" || mode === "rainy_overcast";
export const isNightLight = (mode: LightMode): boolean => mode === "night" || mode === "night_spotlight";
export const isSunsetLight = (mode: LightMode): boolean => mode === "golden" || mode === "sunset_glow";
export const isDayLight = (mode: LightMode): boolean => mode === "day" || mode === "daylight_crisp";
