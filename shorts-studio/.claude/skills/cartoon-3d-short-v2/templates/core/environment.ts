// Reusable Environmental Storytelling, Weather, Lighting & Micro-Gag Helpers for Three.js / Remotion shorts.
// Every helper is 100% deterministic by frame number (safe for parallel/resumable frame renders) and puts
// non-inked atmospheric / emissive / particle meshes on layer `NOINK`.
import * as THREE from "three";
import { NOINK } from "./ink";
import { LIGHTS, LOOK, LIGHT_ATMOS, LightMode, isNightLight, isSunsetLight } from "./lights";
import { cashBillTex, cloudHD, skylineTex } from "./paint";

const seeded = (seed: number) => {
  let s = Math.floor(seed * 7919 + 104729) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

// ---------------- 1. Time-of-Day Gradient Sky Dome ----------------

export type SkyDomeRig = {
  mesh: THREE.Mesh;
  uniforms: {
    uTop: { value: THREE.Color };
    uHor: { value: THREE.Color };
    uMid: { value: THREE.Color };
    uCurve: { value: THREE.Vector3 };
    uSunDir: { value: THREE.Vector3 };
    uSunCol: { value: THREE.Color };
  };
  applyMode: (mode: LightMode, camAzRad?: number) => void;
};

/** Gradient sky dome with optional glowing sun/moon disc driven by any `LightMode` preset. */
export const createSkyDome = (parent: THREE.Object3D, radius = 260): SkyDomeRig => {
  const uniforms = {
    uTop: { value: new THREE.Color(LIGHTS.daylight_crisp.top) },
    uHor: { value: new THREE.Color(LIGHTS.daylight_crisp.hor) },
    uMid: { value: new THREE.Color(LOOK.daylight_crisp.sky.c[2]) },
    uCurve: { value: new THREE.Vector3(...LIGHTS.daylight_crisp.skyCurve) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
    uSunCol: { value: new THREE.Color(LIGHTS.daylight_crisp.sunDisc) },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHor;
      uniform vec3 uMid;
      uniform vec3 uCurve;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        float t1 = smoothstep(uCurve.x, uCurve.y, h);
        float t2 = smoothstep(uCurve.y * 0.65, max(uCurve.z, uCurve.y + 0.05), h);
        vec3 col = mix(uHor, uMid, t1);
        col = mix(col, uTop, t2);
        // Optional glowing sun or moon disc
        float sunDot = dot(normalize(vDir), normalize(uSunDir));
        float disc = smoothstep(0.9965, 0.9985, sunDot);
        float halo = pow(max(sunDot, 0.0), 42.0) * 0.32;
        col += uSunCol * (disc * 0.95 + halo);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), mat);
  mesh.layers.set(NOINK);
  parent.add(mesh);

  const applyMode = (mode: LightMode, camAzRad = 0) => {
    const L = LIGHTS[mode];
    const K = LOOK[mode];
    uniforms.uTop.value.set(L.top);
    uniforms.uHor.value.set(L.hor);
    uniforms.uMid.value.set(K.sky.c[2] ?? L.hor);
    uniforms.uCurve.value.set(...L.skyCurve);
    uniforms.uSunCol.value.set(L.sunDisc);
    const az = camAzRad + (L.az * Math.PI) / 180;
    const el = (L.el * Math.PI) / 180;
    uniforms.uSunDir.value.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    ).normalize();
  };
  applyMode("daylight_crisp");
  return { mesh, uniforms, applyMode };
};

// ---------------- 2. Stylized Cloud Deck ----------------

export type StylizedCloudDeck = {
  group: THREE.Group;
  update: (frame: number, mode: LightMode) => void;
};

/** Stylized painted cumulus cloud deck encircling the sky dome on `NOINK`. */
export const createStylizedCloudDeck = (
  parent: THREE.Object3D,
  opts: { count?: number; radius?: number; minY?: number; maxY?: number; seed?: number } = {},
): StylizedCloudDeck => {
  const { count = 14, radius = 155, minY = 26, maxY = 58, seed = 11 } = opts;
  const r = seeded(seed);
  const group = new THREE.Group();
  const clouds: { sprite: THREE.Sprite; baseAngle: number; y: number; dist: number; speed: number; seed: number }[] = [];
  let lastMode: LightMode | null = null;

  for (let i = 0; i < count; i++) {
    const tex = cloudHD(seed + i * 7, LOOK.daylight_crisp.cloud);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.94, depthWrite: false, fog: true });
    const sprite = new THREE.Sprite(mat);
    const sc = 28 + r() * 26;
    sprite.scale.set(sc * 2.1, sc, 1);
    sprite.layers.set(NOINK);
    group.add(sprite);
    clouds.push({
      sprite,
      baseAngle: (i / count) * Math.PI * 2 + (r() - 0.5) * 0.25,
      y: minY + r() * (maxY - minY),
      dist: radius * (0.85 + r() * 0.25),
      speed: 0.00025 + r() * 0.00025,
      seed: seed + i * 7,
    });
  }
  parent.add(group);

  const update = (frame: number, mode: LightMode) => {
    const atmos = LIGHT_ATMOS[mode];
    group.visible = atmos.clouds && atmos.cloudDensity > 0.05;
    if (!group.visible) return;
    const pal = LOOK[mode].cloud;
    const activeCount = Math.max(2, Math.round(clouds.length * atmos.cloudDensity));
    clouds.forEach((c, idx) => {
      c.sprite.visible = idx < activeCount;
      if (!c.sprite.visible) return;
      if (mode !== lastMode) {
        c.sprite.material.map = cloudHD(c.seed, pal);
        c.sprite.material.opacity = isNightLight(mode) ? 0.55 : 0.94;
        c.sprite.material.needsUpdate = true;
      }
      const ang = c.baseAngle + frame * c.speed;
      c.sprite.position.set(Math.cos(ang) * c.dist, c.y, Math.sin(ang) * c.dist);
    });
    lastMode = mode;
  };
  return { group, update };
};

// ---------------- 3. Overhead Spotlight Cone (`night_spotlight`) ----------------

export type OverheadSpotlightCone = {
  group: THREE.Group;
  light: THREE.SpotLight;
  target: THREE.Object3D;
  cone: THREE.Mesh;
  setActive: (on: boolean, intensity?: number) => void;
};

/** Dramatic warm overhead key spotlight + soft volumetric light cone for `night_spotlight` garage/streetlamp shots. */
export const createOverheadSpotlight = (
  parent: THREE.Object3D,
  opts: {
    pos: [number, number, number];
    targetPos?: [number, number, number];
    color?: string;
    intensity?: number;
    coneHeight?: number;
    coneRadius?: number;
    withHood?: boolean;
  },
): OverheadSpotlightCone => {
  const {
    pos,
    targetPos = [pos[0], 0, pos[2]],
    color = "#ffd28a",
    intensity = 34,
    coneHeight = Math.max(2.5, pos[1] - targetPos[1]),
    coneRadius = coneHeight * 0.42,
    withHood = true,
  } = opts;

  const group = new THREE.Group();
  const target = new THREE.Object3D();
  target.position.set(...targetPos);
  group.add(target);

  const light = new THREE.SpotLight(color, intensity, coneHeight * 2.2, Math.PI * 0.24, 0.55, 1.3);
  light.position.set(...pos);
  light.target = target;
  group.add(light);

  // Volumetric translucent light cone on NOINK
  const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
  coneGeo.translate(0, -coneHeight / 2, 0);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float edge = pow(abs(dot(vNormal, vViewDir)), 1.4);
        float verticalFade = smoothstep(0.0, 0.85, vUv.y);
        gl_FragColor = vec4(uColor, uOpacity * edge * verticalFade);
      }
    `,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(...pos);
  cone.layers.set(NOINK);
  group.add(cone);

  if (withHood) {
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.32, 16),
      new THREE.MeshBasicMaterial({ color: "#1d222e" }),
    );
    hood.position.set(pos[0], pos[1] + 0.12, pos[2]);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#fff6dc" }),
    );
    bulb.position.set(pos[0], pos[1] - 0.04, pos[2]);
    bulb.layers.set(NOINK);
    group.add(hood, bulb);
  }

  parent.add(group);
  return {
    group,
    light,
    target,
    cone,
    setActive: (on: boolean, customIntensity?: number) => {
      group.visible = on;
      light.intensity = on ? (customIntensity ?? intensity) : 0;
    },
  };
};

// ---------------- 4. Diagonal Animated Rain Particle System ----------------

export type RainParticleSystem = {
  mesh: THREE.InstancedMesh;
  update: (frame: number, anchor?: [number, number, number], visible?: boolean) => void;
};

/** Deterministic diagonal rain streaks on `NOINK`, with optional interior cabin exclusion box. */
export const createRainParticles = (
  parent: THREE.Object3D,
  opts: {
    count?: number;
    areaW?: number;
    areaH?: number;
    areaD?: number;
    slantX?: number;
    speedY?: number;
    excludeBox?: { min: [number, number, number]; max: [number, number, number] };
    seed?: number;
  } = {},
): RainParticleSystem => {
  const { count = 420, areaW = 24, areaH = 14, areaD = 28, slantX = -0.22, speedY = 0.72, excludeBox, seed = 41 } = opts;
  const r = seeded(seed);
  const geo = new THREE.PlaneGeometry(0.024, 0.85);
  const mat = new THREE.MeshBasicMaterial({
    color: "#cfe4f5",
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.layers.set(NOINK);
  mesh.frustumCulled = false;

  const drops = Array.from({ length: count }, () => ({
    x: (r() - 0.5) * areaW,
    y: r() * areaH,
    z: (r() - 0.5) * areaD,
    speed: speedY * (0.75 + r() * 0.5),
    len: 0.7 + r() * 0.65,
    yaw: r() * Math.PI,
  }));

  const dummy = new THREE.Object3D();
  parent.add(mesh);

  const update = (frame: number, anchor: [number, number, number] = [0, 0, 0], visible = true) => {
    mesh.visible = visible;
    if (!visible) return;
    const tiltZ = Math.atan2(slantX, -1);
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      const yOff = ((d.y - frame * d.speed) % areaH + areaH) % areaH;
      const xOff = (((d.x + frame * d.speed * slantX + areaW * 0.5) % areaW) + areaW) % areaW - areaW * 0.5;
      const wx = anchor[0] + xOff;
      const wy = anchor[1] + yOff;
      const wz = anchor[2] + d.z;
      if (
        excludeBox &&
        wx > excludeBox.min[0] && wx < excludeBox.max[0] &&
        wy > excludeBox.min[1] && wy < excludeBox.max[1] &&
        wz > excludeBox.min[2] && wz < excludeBox.max[2]
      ) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(wx, wy, wz);
        dummy.rotation.set(0, d.yaw, tiltZ);
        dummy.scale.set(1, d.len, 1);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { mesh, update };
};

// ---------------- 5. Wet Asphalt Reflections (Mirrored Taillights / Headlights) ----------------

export type WetLightEmitter = {
  pos: [number, number, number];
  color: string;
  width?: number;
  length?: number;
  opacity?: number;
};

export type WetAsphaltReflections = {
  group: THREE.Group;
  update: (emitters: WetLightEmitter[], visible: boolean, roadY?: number) => void;
};

/** Glossy wet-road mirrored light reflection streaks under taillights/headlights for `rainy_overcast` shots. */
export const createWetAsphaltReflections = (parent: THREE.Object3D, maxLights = 16): WetAsphaltReflections => {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 256;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(64, 128, 6, 64, 128, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.92)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.42)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const pools: THREE.Mesh[] = [];
  for (let i = 0; i < maxLights; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: "#ff2a2a",
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.layers.set(NOINK);
    m.visible = false;
    group.add(m);
    pools.push(m);
  }
  parent.add(group);

  const update = (emitters: WetLightEmitter[], visible: boolean, roadY = 0.025) => {
    group.visible = visible;
    if (!visible) return;
    for (let i = 0; i < pools.length; i++) {
      const m = pools[i];
      if (i >= emitters.length) {
        m.visible = false;
        continue;
      }
      const e = emitters[i];
      m.visible = true;
      m.position.set(e.pos[0], roadY, e.pos[2]);
      m.scale.set(e.width ?? 1.4, 1, e.length ?? 4.8);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(e.color);
      mat.opacity = e.opacity ?? 0.55;
    }
  };
  return { group, update };
};

// ---------------- 6. Animated Windshield Wiper Rig ----------------

export type WindshieldWiperRig = {
  group: THREE.Group;
  update: (frame: number, fps?: number, active?: boolean, periodSec?: number) => void;
};

/** Hinged dual windshield wiper blades that sweep deterministically across a cabin windshield in rain shots. */
export const createWindshieldWipers = (
  parent: THREE.Object3D,
  opts: { pos?: [number, number, number]; rotX?: number; width?: number; bladeLen?: number } = {},
): WindshieldWiperRig => {
  const { pos = [0, 1.05, 0.88], rotX = -0.35, width = 0.56, bladeLen = 0.58 } = opts;
  const group = new THREE.Group();
  group.position.set(...pos);
  group.rotation.x = rotX;

  const armMat = new THREE.MeshBasicMaterial({ color: "#15171d" });
  const rubberMat = new THREE.MeshBasicMaterial({ color: "#282c36" });
  const pivots: THREE.Group[] = [];

  for (const xOff of [-width * 0.5, width * 0.32]) {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.022, bladeLen, 0.018), armMat);
    arm.position.set(0, bladeLen * 0.5, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, bladeLen * 0.85, 0.028), rubberMat);
    blade.position.set(0, bladeLen * 0.56, 0.012);
    arm.layers.set(NOINK);
    blade.layers.set(NOINK);
    pivot.add(arm, blade);
    group.add(pivot);
    pivots.push(pivot);
  }
  parent.add(group);

  const update = (frame: number, fps = 30, active = true, periodSec = 1.6) => {
    group.visible = active;
    if (!active) return;
    const t = ((frame / fps) % periodSec) / periodSec;
    // Sweep out and back in first 62% of cycle, brief park pause at rest
    const sweep = t < 0.62 ? Math.sin((t / 0.62) * Math.PI) : 0;
    const angle = -1.15 + sweep * 1.95;
    for (const pv of pivots) pv.rotation.z = angle;
  };
  return { group, update };
};

// ---------------- 7. Exploding / Falling Cash Bill Particles ----------------

export type CashExplosionParticles = {
  mesh: THREE.InstancedMesh;
  update: (frame: number, startFrame: number, origin: [number, number, number], mode?: "burst" | "rain") => void;
};

/** Deterministic exploding or raining 3D green cash bill particles on `NOINK`. */
export const createCashExplosion = (
  parent: THREE.Object3D,
  opts: { count?: number; seed?: number; spread?: number } = {},
): CashExplosionParticles => {
  const { count = 72, seed = 77, spread = 2.6 } = opts;
  const r = seeded(seed);
  const geo = new THREE.PlaneGeometry(0.28, 0.14);
  const mat = new THREE.MeshBasicMaterial({ map: cashBillTex(), side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.layers.set(NOINK);
  mesh.frustumCulled = false;

  const bills = Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const sp = 0.8 + r() * spread;
    return {
      vx: Math.cos(a) * sp,
      vy: 2.2 + r() * 3.4,
      vz: Math.sin(a) * sp,
      rx: r() * Math.PI * 2,
      ry: r() * Math.PI * 2,
      rz: r() * Math.PI * 2,
      wx: (r() - 0.5) * 8,
      wy: (r() - 0.5) * 9,
      wz: (r() - 0.5) * 6,
      delay: r() * 0.25,
      flutterPhase: r() * Math.PI * 2,
      rainX: (r() - 0.5) * spread * 2.4,
      rainZ: (r() - 0.5) * spread * 2.4,
      rainYOffset: r() * 5.5,
      fallSpeed: 0.9 + r() * 0.9,
    };
  });

  const dummy = new THREE.Object3D();
  parent.add(mesh);

  const update = (frame: number, startFrame: number, origin: [number, number, number], mode: "burst" | "rain" = "burst") => {
    const elapsed = (frame - startFrame) / 30;
    if (elapsed < 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    for (let i = 0; i < count; i++) {
      const b = bills[i];
      if (mode === "rain") {
        const y = ((b.rainYOffset - elapsed * b.fallSpeed) % 5.5 + 5.5) % 5.5;
        const sway = Math.sin(elapsed * 3.2 + b.flutterPhase) * 0.28;
        dummy.position.set(origin[0] + b.rainX + sway, origin[1] + y, origin[2] + b.rainZ + Math.cos(elapsed * 2.4 + b.flutterPhase) * 0.2);
        dummy.rotation.set(
          b.rx + Math.sin(elapsed * 4 + b.flutterPhase) * 0.9,
          b.ry + elapsed * 1.6,
          b.rz + Math.cos(elapsed * 3.5 + b.flutterPhase) * 0.7,
        );
        dummy.scale.setScalar(1);
      } else {
        const t = Math.max(0, elapsed - b.delay);
        if (t <= 0) {
          dummy.scale.setScalar(0);
        } else {
          // Air drag slows horizontal burst while bills flutter down gently
          const drag = 1 - Math.exp(-t * 2.4);
          const x = origin[0] + (b.vx / 2.4) * drag + Math.sin(t * 5 + b.flutterPhase) * 0.14 * Math.min(1, t);
          const y = Math.max(0.04, origin[1] + b.vy * t - 2.6 * t * t);
          const z = origin[2] + (b.vz / 2.4) * drag + Math.cos(t * 4.2 + b.flutterPhase) * 0.14 * Math.min(1, t);
          dummy.position.set(x, y, z);
          const grounded = y <= 0.045;
          dummy.rotation.set(
            grounded ? Math.PI / 2 : b.rx + b.wx * t,
            b.ry + (grounded ? 0 : b.wy * t),
            grounded ? b.rz : b.rz + b.wz * t,
          );
          dummy.scale.setScalar(1);
        }
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { mesh, update };
};

// ---------------- 8. Crash Debris & Sparks Burst ----------------

export type CrashDebrisSparks = {
  sparks: THREE.InstancedMesh;
  debris: THREE.InstancedMesh;
  update: (frame: number, impactFrame: number, origin: [number, number, number], durationFrames?: number) => void;
};

/** Deterministic collision sparks (bright orange-gold HDR streaks) + tumbling metallic debris shards on `NOINK`. */
export const createCrashDebrisSparks = (
  parent: THREE.Object3D,
  opts: { sparkCount?: number; debrisCount?: number; seed?: number } = {},
): CrashDebrisSparks => {
  const { sparkCount = 46, debrisCount = 18, seed = 99 } = opts;
  const r = seeded(seed);

  const sparkGeo = new THREE.BoxGeometry(0.032, 0.032, 0.24);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.45, 0.35), toneMapped: false });
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
  sparks.layers.set(NOINK);
  sparks.frustumCulled = false;

  const debrisGeo = new THREE.DodecahedronGeometry(0.075, 0);
  const debrisMat = new THREE.MeshBasicMaterial({ color: "#363b45" });
  const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, debrisCount);
  debris.layers.set(NOINK);
  debris.frustumCulled = false;

  const makeItems = (n: number, speedMul: number) =>
    Array.from({ length: n }, () => {
      const a = r() * Math.PI * 2;
      const spd = (1.6 + r() * 4.5) * speedMul;
      return {
        vx: Math.cos(a) * spd,
        vy: (1.5 + r() * 4.2) * speedMul,
        vz: Math.sin(a) * spd,
        rotSpd: (r() - 0.5) * 14,
        sc: 0.65 + r() * 0.9,
      };
    });

  const sparkData = makeItems(sparkCount, 1.25);
  const debrisData = makeItems(debrisCount, 0.85);
  const dummy = new THREE.Object3D();
  parent.add(sparks, debris);

  const update = (frame: number, impactFrame: number, origin: [number, number, number], durationFrames = 26) => {
    const dtFrames = frame - impactFrame;
    if (dtFrames < 0 || dtFrames > durationFrames) {
      sparks.visible = false;
      debris.visible = false;
      return;
    }
    sparks.visible = true;
    debris.visible = true;
    const t = dtFrames / 30;
    const fade = Math.max(0, 1 - dtFrames / durationFrames);

    for (let i = 0; i < sparkCount; i++) {
      const d = sparkData[i];
      const x = origin[0] + d.vx * t;
      const y = Math.max(0.03, origin[1] + d.vy * t - 6.8 * t * t);
      const z = origin[2] + d.vz * t;
      dummy.position.set(x, y, z);
      dummy.lookAt(x + d.vx, y + d.vy - 13.6 * t, z + d.vz);
      dummy.scale.set(d.sc * fade, d.sc * fade, d.sc * (0.4 + 0.9 * fade));
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < debrisCount; i++) {
      const d = debrisData[i];
      const x = origin[0] + d.vx * t;
      const y = Math.max(0.05, origin[1] + d.vy * t - 8.2 * t * t);
      const z = origin[2] + d.vz * t;
      dummy.position.set(x, y, z);
      dummy.rotation.set(d.rotSpd * t, d.rotSpd * 0.7 * t, d.rotSpd * 1.2 * t);
      dummy.scale.setScalar(d.sc * (0.3 + 0.7 * fade));
      dummy.updateMatrix();
      debris.setMatrixAt(i, dummy.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
  };
  return { sparks, debris, update };
};

// ---------------- 9. Animated Flip-Counter / Calendar Prop ----------------

export type FlipCounterProp = {
  group: THREE.Group;
  update: (frame: number, flipFrame: number, flipDuration?: number) => void;
};

const makeCardFace = (header: string, value: string, accent: string): THREE.CanvasTexture => {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 384;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#faf7ef";
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = accent;
  g.fillRect(0, 0, 512, 92);
  g.strokeStyle = "#140e17";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 374);
  g.fillStyle = "#ffffff";
  g.font = "bold 36px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(header, 256, 48);
  g.fillStyle = "#181520";
  g.font = "bold 170px sans-serif";
  g.fillText(value, 256, 245);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** 3D animated desk flip-counter / calendar gag prop (e.g. "CLAIMS PAID: 04 -> 05" or "DAYS SAFE: 12 -> 00"). */
export const createFlipCounterProp = (
  parent: THREE.Object3D,
  opts: {
    pos: [number, number, number];
    yaw?: number;
    scale?: number;
    header?: string;
    beforeValue?: string;
    afterValue?: string;
    accentColor?: string;
  },
): FlipCounterProp => {
  const {
    pos,
    yaw = 0,
    scale = 1,
    header = "DAYS INCIDENT-FREE",
    beforeValue = "01",
    afterValue = "00",
    accentColor = "#d93c36",
  } = opts;

  const group = new THREE.Group();
  group.position.set(...pos);
  group.rotation.y = yaw;
  group.scale.setScalar(scale);

  // Wooden/metal A-frame desk stand
  const standMat = new THREE.MeshBasicMaterial({ color: "#2c313d" });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.24), standMat);
  base.position.set(0, 0.02, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.32, 0.04), standMat);
  back.position.set(0, 0.18, -0.04);
  back.rotation.x = -0.2;
  group.add(base, back);

  // Spiral binding rings along the top
  const ringMat = new THREE.MeshBasicMaterial({ color: "#cfd6e0" });
  for (const rx of [-0.14, 0, 0.14]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16), ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(rx, 0.34, 0.02);
    ring.layers.set(NOINK);
    group.add(ring);
  }

  // Static underneath card (afterValue)
  const afterCard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.27),
    new THREE.MeshBasicMaterial({ map: makeCardFace(header, afterValue, accentColor) }),
  );
  afterCard.position.set(0, 0.195, 0.028);
  afterCard.rotation.x = -0.14;
  afterCard.layers.set(NOINK);
  group.add(afterCard);

  // Hinged front flap (beforeValue) that flips over the top binding ring at `flipFrame`
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 0.33, 0.015);
  const beforeCard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.27),
    new THREE.MeshBasicMaterial({ map: makeCardFace(header, beforeValue, accentColor), side: THREE.DoubleSide }),
  );
  beforeCard.position.set(0, -0.135, 0.02);
  beforeCard.layers.set(NOINK);
  flapPivot.add(beforeCard);
  group.add(flapPivot);

  parent.add(group);

  const update = (frame: number, flipFrame: number, flipDuration = 10) => {
    const t = Math.max(0, Math.min(1, (frame - flipFrame) / Math.max(1, flipDuration)));
    // Snappy ease-in-out flip up & over the spiral rings
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    flapPivot.rotation.x = -0.14 - eased * Math.PI * 1.15;
    flapPivot.visible = t < 0.98;
  };
  return { group, update };
};

// ---------------- 10. Blinking In-World Camera / Device LED ----------------

export type BlinkingDeviceLED = {
  group: THREE.Group;
  update: (frame: number, active?: boolean, periodFrames?: number) => void;
};

/** In-world dashcam / security camera device housing with glossy lens and blinking HDR REC LED on `NOINK`. */
export const createBlinkingDeviceLED = (
  parent: THREE.Object3D,
  opts: { pos: [number, number, number]; yaw?: number; scale?: number; ledColor?: string } = { pos: [0, 0, 0] },
): BlinkingDeviceLED => {
  const { pos, yaw = 0, scale = 1, ledColor = "#ff2424" } = opts;
  const group = new THREE.Group();
  group.position.set(...pos);
  group.rotation.y = yaw;
  group.scale.setScalar(scale);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.085, 0.065), new THREE.MeshBasicMaterial({ color: "#1c202a" }));
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.08, 10), new THREE.MeshBasicMaterial({ color: "#2b303d" }));
  mount.position.set(0, 0.075, 0);
  const lensRim = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.030, 0.024, 16), new THREE.MeshBasicMaterial({ color: "#3d4454" }));
  lensRim.rotation.x = Math.PI / 2;
  lensRim.position.set(-0.015, 0, 0.036);
  const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), new THREE.MeshBasicMaterial({ color: "#295a8f" }));
  lensGlass.position.set(-0.015, 0, 0.049);

  const ledOnColor = new THREE.Color(ledColor).multiplyScalar(2.2);
  const ledOffColor = new THREE.Color("#331010");
  const ledMat = new THREE.MeshBasicMaterial({ color: ledOnColor, toneMapped: false });
  const ledDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), ledMat);
  ledDot.position.set(0.045, 0.022, 0.036);
  const ledBack = new THREE.Mesh(new THREE.SphereGeometry(0.010, 10, 8), ledMat);
  ledBack.position.set(0.045, 0.022, -0.035);

  group.add(body, mount, lensRim, lensGlass, ledDot, ledBack);
  group.traverse((o) => { o.layers.set(NOINK); });
  parent.add(group);

  const update = (frame: number, active = true, periodFrames = 14) => {
    const on = active && Math.floor(frame / periodFrames) % 2 === 0;
    ledMat.color.copy(on ? ledOnColor : ledOffColor);
  };
  return { group, update };
};

// ---------------- 11. City Skyline Backdrop ----------------

export type CitySkylineBackdrop = {
  mesh: THREE.Mesh;
  applyMode: (mode: LightMode) => void;
};

/** Stylized layered city skyline cylinder/strip backdrop that swaps automatically between day/sunset/night palettes. */
export const createCitySkylineBackdrop = (
  parent: THREE.Object3D,
  opts: { radius?: number; height?: number; y?: number; curved?: boolean; pos?: [number, number, number] } = {},
): CitySkylineBackdrop => {
  const { radius = 135, height = 38, y = 14, curved = true, pos = [0, y, 0] } = opts;
  const mat = new THREE.MeshBasicMaterial({
    map: skylineTex("day"),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });
  const geo = curved
    ? new THREE.CylinderGeometry(radius, radius, height, 48, 1, true)
    : new THREE.PlaneGeometry(radius * 2, height);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.layers.set(NOINK);
  parent.add(mesh);

  let lastPalette: "day" | "sunset" | "night" = "day";
  const applyMode = (mode: LightMode) => {
    const p: "day" | "sunset" | "night" = isNightLight(mode) ? "night" : isSunsetLight(mode) ? "sunset" : "day";
    if (p !== lastPalette) {
      mat.map = skylineTex(p);
      mat.needsUpdate = true;
      lastPalette = p;
    }
  };
  return { mesh, applyMode };
};
