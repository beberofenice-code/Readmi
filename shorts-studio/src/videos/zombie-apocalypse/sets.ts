// Modular 3D Set Registry for "What If You Woke Up in a Zombie Apocalypse?": bedroom, street, square.
// Only the active shot's set Group is visible per frame; the cast (you, the zombies, the host) lives on the world root and
// is posed per shot. Readable props (phone, clock, flyer, banner, plaque) use unlit MeshBasicMaterial faces on NOINK.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D, RigPose, RigStyle } from "../core/rig25d";
import { FPS, SHOTS, V3, camAt, garyPos, heroStreetPos, lerp, smooth, zombie1Z } from "./story";

// ---------------- small builders ----------------
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 18) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
/** deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a: number, b: number, k: number) => a + wrapPi(b - a) * k;

/** Unlit readable prop: textured face plane + lam backing card (the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3", depth = 0.025) => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, depth, col("sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = depth / 2 + 0.002;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

// ---------------- painted textures ----------------
const phoneTex = () => ctex("za_phone", 256, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#1d2440"); gr.addColorStop(1, "#3a2a52");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#ffffff"; g.textAlign = "center";
  g.font = "bold 64px sans-serif"; g.fillText("11:47", 128, 92);
  g.font = "20px sans-serif"; g.fillText("Saturday", 128, 122);
  g.fillStyle = "#e5483d"; g.beginPath(); g.roundRect(18, 150, 220, 92, 18); g.fill();
  g.fillStyle = "#ffffff"; g.font = "bold 58px sans-serif"; g.fillText("40", 128, 205);
  g.font = "bold 22px sans-serif"; g.fillText("MISSED CALLS", 128, 232);
  const rows: [string, string][] = [["Mike", "14"], ["Sara", "11"], ["Jen", "15"]];
  rows.forEach(([n, c], i) => {
    const y = 270 + i * 72;
    g.fillStyle = "rgba(255,255,255,0.16)"; g.beginPath(); g.roundRect(18, y, 220, 60, 12); g.fill();
    g.fillStyle = "#ff6b5e"; g.beginPath(); g.arc(46, y + 30, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.textAlign = "left"; g.font = "bold 26px sans-serif"; g.fillText(n, 72, y + 39);
    g.textAlign = "right"; g.fillStyle = "#ffb3ab"; g.fillText("(" + c + ")", 226, y + 39); g.textAlign = "center";
  });
});
const clockTex = () => ctex("za_clock", 256, 160, (g) => {
  g.fillStyle = "#15161c"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#ff3b2f"; g.font = "bold 92px monospace"; g.textAlign = "center"; g.fillText("11:47", 128, 112);
  g.font = "bold 20px monospace"; g.fillText("SAT  AM", 128, 146);
});
const windowTex = () => ctex("za_window", 512, 448, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 448); gr.addColorStop(0, "#8796a8"); gr.addColorStop(1, "#c3c9cf");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 448);
  const houses: [number, number, number, string][] = [[-20, 150, 230, "#9a8f86"], [190, 120, 180, "#8b9a90"], [350, 170, 200, "#a39a8a"]];
  for (const [x, w, h, c] of houses) {
    g.fillStyle = c; g.fillRect(x, 448 - 120 - h * 0.6, w, h);
    g.fillStyle = "#6d5f58"; g.beginPath(); g.moveTo(x - 10, 448 - 120 - h * 0.6); g.lineTo(x + w / 2, 448 - 190 - h * 0.6); g.lineTo(x + w + 10, 448 - 120 - h * 0.6); g.fill();
    g.fillStyle = "#3e4552"; for (let k = 0; k < 2; k++) g.fillRect(x + 22 + k * (w - 70), 448 - 100 - h * 0.45, 34, 30);
  }
  g.fillStyle = "#5c616b"; g.fillRect(0, 448 - 90, 512, 90);
  g.fillStyle = "#d9d2bf"; for (let x = 10; x < 512; x += 90) g.fillRect(x, 448 - 48, 46, 6);
  g.fillStyle = "#c2392f"; g.beginPath(); g.ellipse(300, 448 - 70, 50, 20, 0, 0, Math.PI * 2); g.fill(); // abandoned car
});
const flyerTex = () => ctex("za_flyer", 300, 400, (g) => {
  g.fillStyle = "#f6f1df"; g.fillRect(0, 0, 300, 400);
  g.fillStyle = "#3f8a3a"; g.fillRect(0, 0, 300, 120);
  g.fillStyle = "#f6f1df"; g.font = "bold 38px sans-serif"; g.textAlign = "center";
  g.fillText("CHARITY", 150, 50); g.fillText("ZOMBIE WALK", 150, 96);
  g.fillStyle = "#3f8a3a"; for (let x = 12; x < 300; x += 34) { g.beginPath(); g.ellipse(x, 120, 7, 12 + (x % 3) * 5, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#241726"; g.font = "bold 30px sans-serif"; g.fillText("SATURDAY 10 AM", 150, 182);
  g.font = "bold 24px sans-serif"; g.fillText("TOWN SQUARE", 150, 218);
  g.fillStyle = "#c8262c"; g.font = "bold 22px sans-serif"; g.fillText("COSTUME CONTEST!", 150, 258);
  g.save(); g.translate(150, 330); g.rotate(-0.12); g.fillStyle = "#2a4fb8"; g.font = "italic bold 40px serif"; g.fillText("I'm in!!", 0, 0); g.restore();
});
const bannerTex = () => ctex("za_banner", 1024, 220, (g) => {
  g.fillStyle = "#3f8a3a"; g.fillRect(0, 0, 1024, 220);
  g.fillStyle = "#2d6a2a"; g.fillRect(0, 190, 1024, 30);
  g.fillStyle = "#f6f1df"; g.font = "bold 92px sans-serif"; g.textAlign = "center"; g.fillText("CHARITY ZOMBIE WALK", 512, 112);
  g.fillStyle = "#ffd447"; g.font = "bold 50px sans-serif"; g.fillText("5K  ·  FUN RUN  ·  COSTUME CONTEST", 512, 172);
  g.fillStyle = "#3f8a3a"; for (let x = 20; x < 1024; x += 46) { g.beginPath(); g.ellipse(x, 220, 9, 10 + (x % 5) * 4, 0, 0, Math.PI * 2); g.fill(); }
});
const contestTex = () => ctex("za_contest", 512, 128, (g) => {
  g.fillStyle = "#241726"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#ffd447"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.fillText("MOST REALISTIC", 256, 56);
  g.fillStyle = "#f6f1df"; g.fillText("COSTUME", 256, 108);
});
const plaqueTex = () => ctex("za_plaque", 256, 96, (g) => {
  g.fillStyle = "#2b2230"; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#e3b23c"; g.lineWidth = 6; g.strokeRect(6, 6, 244, 84);
  g.fillStyle = "#f3d27a"; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.fillText("BEST ZOMBIE", 128, 62);
});
const callTex = (name: string) => ctex("za_call_" + name, 128, 256, (g) => {
  g.fillStyle = "#1c2a3a"; g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "bold 18px sans-serif"; g.fillText("CALLING...", 64, 52);
  g.font = "bold 26px sans-serif"; g.fillText("YOU", 64, 92);
  g.fillStyle = "#34c759"; g.beginPath(); g.arc(64, 186, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffffff"; g.font = "bold 30px sans-serif"; g.fillText(name[0], 64, 197);
});

// ---------------- props ----------------
/** Frying pan: grip at the origin, handle along +y, pan face perpendicular to z */
const makePan = () => {
  const g = new THREE.Group();
  const iron = col("za_iron", "#2d2f36");
  g.add(box(0.032, 0.26, 0.022, col("za_handle", "#5b3a26"), 0, 0.1, 0));
  const disc = cyl(0.14, 0.12, 0.04, iron, 0, 0.36, 0, 22);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  return g;
};
/** Cooking pot helmet: sits on the head pivot (or in a hand), upside down */
const makePot = (banana = false) => {
  const g = new THREE.Group();
  const steel = col("za_steel", "#a8b0ba");
  g.add(cyl(0.2, 0.215, 0.18, steel, 0, 0, 0, 24));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.014, 6, 24).rotateX(Math.PI / 2), steel);
  rim.position.y = -0.09; g.add(rim);
  g.add(box(0.07, 0.03, 0.04, col("za_iron", "#2d2f36"), 0.25, 0.0, 0), box(0.07, 0.03, 0.04, col("za_iron", "#2d2f36"), -0.25, 0.0, 0));
  if (banana) {
    const peel = col("za_banana", "#f0d24a");
    for (let i = 0; i < 4; i++) {
      const p = box(0.05, 0.015, 0.16, peel, 0, 0.1, 0);
      p.geometry.translate(0, 0, 0.08);
      p.rotation.set(-0.5, (i / 4) * Math.PI * 2 + 0.3, 0);
      g.add(p);
    }
    g.add(box(0.03, 0.06, 0.03, col("za_banana_tip", "#6b4a2a"), 0, 0.13, 0));
  }
  return g;
};
const makeTrophy = () => {
  const g = new THREE.Group();
  const gold = col("za_gold", "#e3b23c");
  const pts = [[0, 0], [0.09, 0], [0.09, 0.03], [0.03, 0.05], [0.025, 0.14], [0.06, 0.17], [0.11, 0.24], [0.12, 0.33], [0.0, 0.33]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), gold);
  cup.castShadow = true;
  g.add(cup, box(0.2, 0.08, 0.14, col("za_trophy_base", "#3a2b33"), 0, -0.04, 0));
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), gold);
    h.position.set(s * 0.12, 0.25, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(h);
  }
  const plaque = sign(0.16, 0.06, plaqueTex(), "#2b2230", 0.01);
  plaque.g.position.set(0, -0.04, 0.075);
  g.add(plaque.g);
  return g;
};
const makeHandPhone = (name: string) => {
  const g = new THREE.Group();
  g.add(box(0.07, 0.14, 0.012, col("za_phone_body", "#202228"), 0, 0, 0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.124), new THREE.MeshBasicMaterial({ map: callTex(name) }));
  scr.position.z = 0.007; scr.layers.set(NOINK);
  g.add(scr);
  return g;
};
const makeMic = () => {
  const g = new THREE.Group();
  g.add(cyl(0.016, 0.012, 0.16, col("za_mic", "#1e1f24"), 0, 0.03, 0, 10));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), col("za_mic_head", "#8d929b"));
  ball.position.y = 0.12; g.add(ball);
  return g;
};
/** Simple low-poly parked / abandoned car (faces +z); optional open driver door */
const makeCar = (hex: string, doorOpen = false) => {
  const root = new THREE.Group();
  const body = col("za_car_" + hex, hex), dark = col("za_car_dark", "#2d323d"), glass = col("za_car_glass", "#6c7f9e");
  root.add(box(1.86, 0.56, 4.2, body, 0, 0.52, 0), box(1.62, 0.52, 2.1, body, 0, 1.04, -0.15));
  root.add(box(1.52, 0.42, 0.08, glass, 0, 1.04, 0.9), box(1.52, 0.42, 0.08, glass, 0, 1.04, -1.2));
  root.add(box(0.06, 0.36, 1.6, glass, -0.81, 1.06, -0.15), box(0.06, 0.36, 1.6, glass, 0.81, 1.06, -0.15));
  root.add(box(1.92, 0.22, 0.22, dark, 0, 0.34, 2.12), box(1.92, 0.22, 0.22, dark, 0, 0.34, -2.12));
  const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16).rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.92, 1.3], [0.92, 1.3], [-0.92, -1.3], [0.92, -1.3]]) {
    const w = new THREE.Mesh(wGeo, dark); w.position.set(wx, 0.32, wz); w.castShadow = true; root.add(w);
  }
  if (doorOpen) {
    const hinge = new THREE.Group(); hinge.position.set(-0.93, 0, 0.55); hinge.rotation.y = -0.9;
    hinge.add(box(0.06, 0.56, 1.1, body, 0, 0.6, -0.55));
    root.add(hinge);
  }
  return root;
};
/** Suburban house facing +x or -x (front face toward the street) */
const makeHouse = (hexWall: string, hexRoof: string, w = 7, d = 7, h = 4.2) => {
  const g = new THREE.Group();
  g.add(box(d, h, w, col("za_wall_" + hexWall, hexWall), 0, h / 2, 0));
  const roofMat = col("za_roof_" + hexRoof, hexRoof);
  const rA = box(d * 0.62, 0.2, w + 0.5, roofMat, -d * 0.24, h + 0.95, 0); rA.rotation.z = 0.62;
  const rB = box(d * 0.62, 0.2, w + 0.5, roofMat, d * 0.24, h + 0.95, 0); rB.rotation.z = -0.62;
  g.add(rA, rB);
  const win = new THREE.MeshBasicMaterial({ color: "#5d6f86" }), trim = col("za_trim", "#f2ede2");
  for (const [z, y] of [[-w * 0.28, 1.5], [w * 0.28, 1.5], [-w * 0.28, 3.2], [w * 0.28, 3.2]]) {
    g.add(box(0.06, 1.0, 1.1, trim, -d / 2 - 0.02, y, z), box(0.07, 0.84, 0.94, win, -d / 2 - 0.04, y, z));
  }
  g.add(box(0.07, 2.0, 1.0, col("za_door", "#5a3d2e"), -d / 2 - 0.03, 1.0, 0));
  return g;
};
const makeTree = (s = 1) => {
  const g = new THREE.Group();
  g.add(cyl(0.14 * s, 0.2 * s, 2.0 * s, col("za_bark", "#7a5236"), 0, 1.0 * s, 0, 10));
  const leaf = col("za_leaf", "#4f9a3f");
  for (const [x, y, z, r] of [[0, 2.5, 0, 1.15], [0.55, 2.1, 0.2, 0.8], [-0.5, 2.2, -0.25, 0.85]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r * s, 14, 10), leaf);
    b.position.set(x * s, y * s, z * s); b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  return g;
};

// ---------------- cast helpers ----------------
const ZSKIN = ["#b5c79f", "#a9c2a8", "#c2c9a0", "#9fb8a0", "#bfc4b0"];
const SHIRT = ["#7d6b5a", "#3f6e9e", "#8e3b3b", "#5f7d4a", "#6b5b8e", "#c48a3a", "#4a4f5a", "#9e6b8a", "#3b7d7d", "#b0a48a", "#d0d4d8"];
const ZHAIR = ["#3d4a33", "#2d2a26", "#5a4632", "#6b6b6b", "#7a3a2a", "#1f1f1f"];
const zombieStyle = (k: number, extra: Partial<RigStyle> = {}): RigStyle => ({
  skin: ZSKIN[k % ZSKIN.length], jacket: SHIRT[(k * 7) % SHIRT.length], hair: ZHAIR[(k * 5) % ZHAIR.length],
  torn: true, zombie: true, seed: 40 + k, bib: String(100 + ((k * 37) % 300)), ...extra,
});

/** Gait: feet swing forward/back with lift, body bobs. hz = steps per second (each foot) */
const gait = (t: number, hz: number, ph: number, stride = 0.15, lift = 0.06) => {
  const w = 2 * Math.PI * hz * t + ph, s = Math.sin(w);
  return {
    footL: [-0.12, 0.04 + lift * Math.max(0, s), 0.05 + stride * s] as V3,
    footR: [0.12, 0.04 + lift * Math.max(0, -s), 0.05 - stride * s] as V3,
    bob: 0.022 * Math.abs(Math.cos(w)),
  };
};
/** Classic zombie shamble: arms out front, slight hunch, head lolling */
const zPose = (pos: V3, yaw: number, t: number, ph: number, walkHz = 0.85, o: Partial<RigPose> = {}): RigPose => {
  const g = walkHz > 0 ? gait(t, walkHz, ph, 0.13, 0.05) : { footL: [-0.12, 0.04, 0.05] as V3, footR: [0.12, 0.04, 0.05] as V3, bob: 0 };
  const sw = Math.sin(t * 2.3 + ph);
  return {
    pos: [pos[0], pos[1] + g.bob, pos[2]], yaw: yaw + 0.05 * sw, lean: 0.16, expr: "neutral",
    headYaw: 0.14 * Math.sin(t * 1.3 + ph), headPitch: 0.06,
    handL: [-0.17, 1.17 + 0.04 * sw, 0.47], handR: [0.17, 1.13 - 0.04 * sw, 0.49],
    footL: g.footL, footR: g.footR, ...o,
  };
};
/** Relaxed costume-party stance (post-reveal): arms down / waving, chatting, grinning */
const partyPose = (pos: V3, yaw: number, t: number, k: number, o: Partial<RigPose> = {}): RigPose => {
  const wave = k % 3 === 0, chat = k % 3 === 1, ph = k * 1.7;
  const w = Math.sin(t * 7 + ph);
  return {
    pos, yaw, lean: 0.02, expr: k % 4 === 0 ? "laugh" : "grin", headYaw: 0.18 * Math.sin(t * 0.9 + ph),
    mouthOpen: chat ? 0.3 + 0.35 * Math.abs(Math.sin(t * 9 + ph)) : 0,
    handL: [-0.26, 0.78, 0.12], handR: wave ? [0.32 + 0.08 * w, 1.62, 0.12] : [0.26, 0.8, 0.14], ...o,
  };
};

export class MultiSetWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();
  private m4 = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private q = new THREE.Quaternion();

  // cast
  private hero: HeroRig25D;
  private heroDirty: HeroRig25D;
  private zombie1: HeroRig25D;
  private gary: HeroRig25D;
  private crowd: HeroRig25D[] = [];
  private host: HeroRig25D;
  // props
  private pan: THREE.Group;
  private panOnBed: THREE.Group;
  private potHand: THREE.Group;
  private potHead: THREE.Group;
  private potHeadDirty: THREE.Group;
  private garyBump: THREE.Mesh;
  private stars: THREE.Mesh[] = [];
  private trophy: THREE.Group;
  private mic: THREE.Group;
  private friendPhones: THREE.Group[] = [];
  private confetti: THREE.InstancedMesh;
  // bedroom
  private clock: THREE.Group;
  private phone: THREE.Group;
  private couch: THREE.Group;
  private fridgeDoor: THREE.Group;
  private fridgeLight: THREE.MeshBasicMaterial;
  // street
  private dumpLid: THREE.Group;
  private papers: THREE.InstancedMesh;

  constructor() {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 36, 20), this.skyMat);
    this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    for (const name of ["bedroom", "street", "square"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    this.buildBedroom();
    this.buildStreet();
    this.buildSquare();

    // ---- cast ----
    const heroStyle: RigStyle = { jacket: "#6f8fd6", stripes: "#e9eef9", hair: "#5a3b2a", seed: 3 };
    this.hero = new HeroRig25D(R, heroStyle);
    this.heroDirty = new HeroRig25D(R, { ...heroStyle, grime: true, seed: 5 });
    this.zombie1 = new HeroRig25D(R, zombieStyle(1, { jacket: "#7d6b5a", bib: "117" }));
    this.gary = new HeroRig25D(R, zombieStyle(2, { skin: "#a9c2a8", jacket: "#3f6e9e", hair: "#2d2a26", bib: "88" }));
    for (let k = 0; k < 22; k++) this.crowd.push(new HeroRig25D(R, zombieStyle(k + 3)));
    this.host = new HeroRig25D(R, { jacket: "#d4473a", tie: "#1d2233", hair: "#2a1d18", seed: 31 });

    // ---- props ----
    this.pan = makePan(); R.add(this.pan);
    this.potHand = makePot(); R.add(this.potHand);
    this.potHead = makePot(); this.potHead.position.set(0, 0.4, 0); this.hero.headPivot.add(this.potHead);
    this.potHeadDirty = makePot(true); this.potHeadDirty.position.set(0, 0.4, 0); this.heroDirty.headPivot.add(this.potHeadDirty);
    this.garyBump = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), col("za_bump", "#e88a8a"));
    this.garyBump.position.set(0.06, 0.41, 0.03); this.garyBump.layers.set(NOINK);
    this.gary.headPivot.add(this.garyBump);
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.022 : 0.055;
      if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = new THREE.ShapeGeometry(starShape), starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.45, 0.35), side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(starGeo, starMat); s.layers.set(NOINK); this.stars.push(s); R.add(s); }
    this.trophy = makeTrophy(); R.add(this.trophy);
    this.mic = makeMic(); R.add(this.mic);
    for (const n of ["Mike", "Sara", "Jen"]) { const p = makeHandPhone(n); this.friendPhones.push(p); R.add(p); }
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.035), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 220);
    const cc = ["#ff4d4d", "#ffd447", "#4dc3ff", "#7ee36b", "#ff7ad9", "#ffffff"].map((h) => new THREE.Color(h));
    for (let i = 0; i < 220; i++) this.confetti.setColorAt(i, cc[i % cc.length]);
    this.confetti.layers.set(NOINK);
    R.add(this.confetti);
  }

  // ======================= SETS =======================
  private buildBedroom() {
    // Room interior x -2.6..2.6, z -1.5..2.6, back wall z = 2.6 (cameras look +z from the open front)
    const S = this.sets.bedroom;
    const floor = box(5.4, 0.1, 4.6, col("za_floor", "#a0714d"), 0, -0.05, 0.55, false);
    S.add(floor, box(2.4, 0.02, 1.6, col("za_rug", "#c25b4a"), 0.25, 0.01, 0.35, false));
    const wallBack = col("za_wall_back", "#9fb7c9"), wallSide = col("za_wall_side", "#b6c8d4");
    S.add(box(5.4, 2.8, 0.1, wallBack, 0, 1.4, 2.65, false), box(0.1, 2.8, 4.6, wallSide, -2.65, 1.4, 0.55, false), box(0.1, 2.8, 4.6, wallSide, 2.65, 1.4, 0.55, false));
    S.add(box(5.4, 0.12, 0.05, col("za_skirting", "#f2ede2"), 0, 0.06, 2.59, false));
    // Bed (head against the back wall, along the left wall)
    const wood = col("za_bedwood", "#7a4f33");
    S.add(box(1.5, 0.3, 2.2, wood, -1.75, 0.25, 1.35), box(1.5, 1.0, 0.1, wood, -1.75, 0.5, 2.52));
    S.add(box(1.42, 0.16, 2.1, col("za_mattress", "#f1ece2"), -1.75, 0.47, 1.38));
    S.add(box(0.9, 0.14, 0.42, col("za_pillow", "#ffffff"), -1.75, 0.62, 2.18));
    S.add(box(1.48, 0.2, 1.75, col("za_blanket", "#e0a33a"), -1.75, 0.66, 1.12));
    // Nightstand, alarm clock (rattles), phone (buzzes)
    S.add(box(0.5, 0.5, 0.45, col("za_nightstand", "#8a5a3a"), -0.62, 0.25, 2.25));
    this.clock = new THREE.Group();
    this.clock.position.set(-0.76, 0.5, 2.22);
    const cbody = box(0.24, 0.16, 0.1, col("za_clockbody", "#c93b3b"), 0, 0.09, 0);
    const cface = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.11), new THREE.MeshBasicMaterial({ map: clockTex() }));
    cface.position.set(0, 0.09, -0.052); cface.rotation.y = Math.PI; cface.layers.set(NOINK);
    const bellMat = col("za_bell", "#d8c060");
    const bellL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), bellMat); bellL.position.set(-0.07, 0.17, 0);
    const bellR = bellL.clone(); bellR.position.x = 0.07;
    this.clock.add(cbody, cface, bellL, bellR);
    S.add(this.clock);
    this.phone = new THREE.Group();
    this.phone.position.set(-0.42, 0.506, 2.12);
    this.phone.add(box(0.09, 0.012, 0.18, col("za_phone_body", "#202228"), 0, 0, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), new THREE.MeshBasicMaterial({ map: phoneTex() }));
    scr.rotation.x = -Math.PI / 2; scr.rotation.z = Math.PI; scr.position.y = 0.0075; scr.layers.set(NOINK);
    this.phone.add(scr);
    S.add(this.phone);
    // Window (painted overcast street beyond) on the back wall
    const win = sign(1.2, 1.05, windowTex(), "#f2ede2", 0.05);
    win.g.rotation.y = Math.PI; win.g.position.set(1.0, 1.55, 2.58);
    S.add(win.g);
    S.add(box(1.32, 0.08, 0.12, col("za_trim", "#f2ede2"), 1.0, 1.0, 2.55), box(0.05, 1.05, 0.06, col("za_trim", "#f2ede2"), 1.0, 1.55, 2.56));
    // Door on the right wall + the Zombie Walk flyer beside it (foreshadowing)
    S.add(box(0.06, 2.05, 0.95, col("za_bdoor", "#e9e2d2"), 2.6, 1.03, 0.65));
    S.add(box(0.05, 0.08, 0.08, col("za_knob", "#e8c45a"), 2.55, 1.0, 0.28));
    const fly = sign(0.3, 0.4, flyerTex(), "#f6f1df", 0.01);
    fly.g.rotation.y = -Math.PI / 2; fly.g.position.set(2.59, 1.5, 1.6); fly.g.rotation.z = 0.04;
    S.add(fly.g);
    // Couch (pushed against the door in Shot 9), seat facing -x
    this.couch = new THREE.Group();
    const mustard = col("za_couch", "#c9a23f");
    this.couch.add(box(0.8, 0.4, 1.7, mustard, 0, 0.2, 0), box(0.2, 0.5, 1.7, mustard, 0.3, 0.62, 0));
    this.couch.add(box(0.8, 0.22, 0.18, mustard, 0, 0.5, 0.86), box(0.8, 0.22, 0.18, mustard, 0, 0.5, -0.86));
    this.couch.add(box(0.5, 0.12, 0.7, col("za_cushion", "#d9b452"), -0.08, 0.46, 0.4), box(0.5, 0.12, 0.7, col("za_cushion", "#d9b452"), -0.08, 0.46, -0.4));
    S.add(this.couch);
    // Mini fridge in the back-right corner: open front, lit interior, one sad ketchup bottle
    const fr = new THREE.Group(); fr.position.set(2.1, 0, 2.25);
    const white = col("za_fridge", "#e8e8e4");
    fr.add(box(0.62, 0.05, 0.6, white, 0, 0.84, 0), box(0.62, 0.05, 0.6, white, 0, 0.025, 0));
    fr.add(box(0.05, 0.86, 0.6, white, -0.285, 0.43, 0), box(0.05, 0.86, 0.6, white, 0.285, 0.43, 0), box(0.62, 0.86, 0.05, white, 0, 0.43, 0.28));
    this.fridgeLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.08, 0.9) });
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.74), this.fridgeLight);
    inner.position.set(0, 0.44, 0.25); inner.rotation.y = Math.PI; inner.layers.set(NOINK);
    fr.add(inner, box(0.52, 0.015, 0.5, col("za_shelf", "#cfd6dc"), 0, 0.42, 0));
    fr.add(cyl(0.025, 0.03, 0.12, col("za_ketchup", "#c8262c"), 0.0, 0.49, -0.15, 10), cyl(0.012, 0.012, 0.03, col("za_cap", "#f4f1e0"), 0.0, 0.565, -0.15, 8));
    this.fridgeDoor = new THREE.Group(); this.fridgeDoor.position.set(-0.31, 0, -0.3);
    this.fridgeDoor.add(box(0.62, 0.86, 0.05, white, 0.31, 0.43, -0.025), box(0.03, 0.3, 0.04, col("za_iron", "#2d2f36"), 0.55, 0.5, -0.07));
    fr.add(this.fridgeDoor);
    S.add(fr);
    // Pan lying on the bed while you shove the couch
    this.panOnBed = makePan();
    this.panOnBed.position.set(-1.35, 0.79, 0.7); this.panOnBed.rotation.set(-Math.PI / 2, 0, 0.6);
    S.add(this.panOnBed);
    // Exterior ground beyond the open front (never really seen, avoids a void under low angles)
    S.add(box(30, 0.05, 30, col("za_bed_out", "#5f6670"), 0, -0.14, 0, false));
  }

  private buildStreet() {
    // Road along z (x -4..4), sidewalks to +-6.2, lawns, houses at x = +-10.5; cameras mostly look +z
    const S = this.sets.street;
    const asphalt = twoTone(new THREE.MeshPhongMaterial({ color: "#555a66", specular: "#6f788a", shininess: 30 }));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 160), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 20); road.receiveShadow = true;
    S.add(road);
    for (const sx of [-1, 1]) {
      S.add(box(2.2, 0.04, 160, col("za_sidewalk", "#b9b3a6"), sx * 5.1, 0.0, 20, false));
      S.add(box(0.18, 0.12, 160, col("za_curb", "#9e988b"), sx * 4.05, 0.04, 20, false));
      S.add(box(40, 0.04, 160, col("za_lawn", "#7a9a52"), sx * 26.2, -0.01, 20, false));
    }
    for (let i = 0; i < 26; i++) S.add(box(0.16, 0.01, 2.2, col("za_dash", "#e8e0c4"), 0, 0.006, -40 + i * 6, false));
    // Houses lining both sides
    const walls = ["#d9c7a3", "#b9c9b0", "#c9b3b3", "#aebfd0", "#e2d6b8", "#c2b59b"], roofs = ["#7a4a3c", "#5a5f6e", "#8e5a3c", "#4f5a4a"];
    for (let i = 0; i < 12; i++) {
      for (const sx of [-1, 1]) {
        const h = makeHouse(walls[(i * 3 + (sx > 0 ? 1 : 0)) % walls.length], roofs[(i + (sx > 0 ? 2 : 0)) % roofs.length], 7, 7, 3.8 + (i % 3) * 0.4);
        h.position.set(sx * 12.0, 0, -30 + i * 9.5); h.rotation.y = sx > 0 ? 0 : Math.PI;
        S.add(h);
      }
    }
    // Wooden fence + back gate on the right (you sneak out here in Shot 11)
    const fence = col("za_fence", "#c7b089");
    for (let z = -12; z < 30; z += 0.5) if (Math.abs(z - 1.6) > 0.6) S.add(box(0.08, 1.1, 0.12, fence, 6.4, 0.55, z));
    S.add(box(0.06, 0.08, 42, fence, 6.4, 0.85, 9), box(0.06, 0.08, 42, fence, 6.4, 0.35, 9));
    const gate = new THREE.Group(); gate.position.set(6.4, 0, 1.0); gate.rotation.y = 1.1;
    for (let k = 0; k < 3; k++) gate.add(box(0.06, 1.05, 0.12, fence, 0, 0.55, 0.15 + k * 0.4));
    S.add(gate);
    // Abandoned cars (A: door open, B: Gary hides behind it, C: sideways far down, D: foreground left)
    const cars: [string, boolean, number, number, number][] = [["#c2392f", true, -2.4, 5, 0.35], ["#e2e6ea", false, 2.4, 15, -0.15], ["#3d6fb5", false, -1.6, 29, 1.25], ["#6b8f4a", false, -2.9, -5, -0.1]];
    for (const [hex, door, x, z, yaw] of cars) { const c = makeCar(hex, door); c.position.set(x, 0, z); c.rotation.y = yaw; S.add(c); }
    // Dumpster (centre 5.1, 8.0), hinged lid at the back edge (x = 5.65)
    const green = col("za_dumpster", "#3f7a52"), dk = col("za_dumpster_dk", "#2c5a3b");
    const D = new THREE.Group(); D.position.set(5.1, 0, 8.0);
    D.add(box(1.1, 0.12, 1.9, dk, 0, 0.12, 0));
    D.add(box(0.08, 1.15, 1.9, green, -0.51, 0.6, 0), box(0.08, 1.15, 1.9, green, 0.51, 0.6, 0));
    D.add(box(1.1, 1.15, 0.08, green, 0, 0.6, 0.91), box(1.1, 1.15, 0.08, green, 0, 0.6, -0.91));
    for (const z of [-0.7, 0.7]) for (const x of [-0.4, 0.4]) D.add(cyl(0.07, 0.07, 0.1, col("za_car_dark", "#2d323d"), x, 0.05, z, 10));
    D.add(box(0.04, 0.3, 0.9, col("za_trash_label", "#e8e0c4"), -0.56, 0.75, 0));
    this.dumpLid = new THREE.Group(); this.dumpLid.position.set(0.55, 1.19, 0);
    this.dumpLid.add(box(1.14, 0.06, 1.96, dk, -0.57, 0, 0));
    D.add(this.dumpLid);
    S.add(D);
    // Trash bags, overturned bin, hydrant, street lamps
    const bag = col("za_bag", "#2a2c33");
    for (const [x, z, s] of [[4.3, 6.6, 1], [4.5, 9.6, 0.8], [-4.6, 12, 0.9], [4.4, 18, 1.1]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 12, 10), bag); b.scale.set(1, 0.8, 1); b.position.set(x, 0.24 * s, z); b.castShadow = true; S.add(b);
    }
    const bin = cyl(0.28, 0.24, 0.85, col("za_bin", "#7b8590"), -4.5, 0.28, 8.5, 14); bin.rotation.z = Math.PI / 2; S.add(bin);
    S.add(cyl(0.12, 0.14, 0.6, col("za_hydrant", "#d0392f"), 4.6, 0.3, 13.2, 12));
    for (const z of [-6, 10, 26, 42]) for (const sx of [-1, 1]) {
      S.add(box(0.12, 4.2, 0.12, col("za_pole", "#3a3f4a"), sx * 4.45, 2.1, z), box(0.8, 0.08, 0.12, col("za_pole", "#3a3f4a"), sx * 4.1, 4.16, z));
    }
    // Scattered paper (a few blow across the road in Shot 4)
    this.papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshBasicMaterial({ color: "#efeadc", side: THREE.DoubleSide }), 24);
    this.papers.layers.set(NOINK);
    S.add(this.papers);
  }

  private buildSquare() {
    // Plaza centre (0,0,0); stage at z 12.5..15.5 (behind every pre-reveal camera), buildings all round
    const S = this.sets.square;
    S.add(box(70, 0.1, 70, col("za_paving", "#c9bfa8"), 0, -0.05, 0, false));
    for (let i = -6; i <= 6; i++) {
      S.add(box(0.06, 0.01, 50, col("za_paving_line", "#b3a98f"), i * 3, 0.002, 0, false), box(50, 0.01, 0.06, col("za_paving_line", "#b3a98f"), 0, 0.002, i * 3, false));
    }
    // Stage + banner + contest sign + balloons
    const stageMat = col("za_stage", "#6b4a34");
    S.add(box(7, 0.9, 3, stageMat, 0, 0.45, 14), box(7.1, 0.12, 3.1, col("za_stage_top", "#8a6448"), 0, 0.9, 14));
    S.add(box(1.4, 0.45, 0.6, stageMat, 0, 0.225, 12.2), box(1.4, 0.22, 0.6, stageMat, 0, 0.11, 11.6));
    for (const x of [-3.7, 3.7]) S.add(box(0.14, 4.6, 0.14, col("za_pole", "#3a3f4a"), x, 2.3, 15.2));
    const banner = sign(7.2, 1.55, bannerTex(), "#2d6a2a", 0.04);
    banner.g.rotation.y = Math.PI; banner.g.position.set(0, 3.65, 15.2);
    S.add(banner.g);
    const contest = sign(2.4, 0.6, contestTex(), "#241726", 0.04);
    contest.g.rotation.y = Math.PI; contest.g.position.set(0, 0.5, 12.47);
    S.add(contest.g);
    const bcols = [[2.2, 0.35, 0.35], [2.2, 1.9, 0.4], [0.4, 1.3, 2.2], [0.5, 2.0, 0.6], [2.0, 0.6, 1.9]];
    for (const [bx, bz] of [[-3.9, 12.6], [3.9, 12.6], [-3.9, 15.4], [3.9, 15.4]]) {
      for (let k = 0; k < 5; k++) {
        const [r, g, b] = bcols[(k + Math.abs(bx)) % 5 | 0];
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(r * 0.55, g * 0.55, b * 0.55) }));
        ball.scale.set(1, 1.15, 1); ball.position.set(bx + Math.cos(k * 1.3) * 0.32, 2.4 + (k % 3) * 0.35, bz + Math.sin(k * 1.3) * 0.32);
        ball.layers.set(NOINK);
        S.add(ball, box(0.01, 1.4, 0.01, col("za_string", "#f2ede2"), bx, 1.6, bz, false));
      }
    }
    // Bunting from the banner poles out to the buildings
    const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.14, 0, 0), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(0, -0.3, 0)]);
    flagGeo.computeVertexNormals();
    const fcols = ["#e5483d", "#ffd447", "#4da3e5", "#7ee36b"];
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(sx * 3.7, 4.5, 15.2), b = new THREE.Vector3(sx * 16, 5.5, 6);
      for (let i = 1; i < 22; i++) {
        const u = i / 22, p = a.clone().lerp(b, u); p.y -= Math.sin(Math.PI * u) * 1.2;
        const fl = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ color: fcols[i % 4], side: THREE.DoubleSide }));
        fl.position.copy(p); fl.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; fl.layers.set(NOINK);
        S.add(fl);
      }
    }
    // Buildings around the plaza (shop fronts), trees
    const walls = ["#d9c7a3", "#c9b3b3", "#aebfd0", "#e2d6b8", "#b9c9b0", "#d6a98a"];
    const shop = (x: number, z: number, yaw: number, w: number, h: number, k: number) => {
      const g = new THREE.Group();
      g.add(box(w, h, 6, col("za_bwall_" + k, walls[k % walls.length]), 0, h / 2, 0));
      g.add(box(w + 0.3, 0.3, 6.3, col("za_cornice", "#f2ede2"), 0, h + 0.15, 0));
      const win = new THREE.MeshBasicMaterial({ color: "#5d6f86" });
      for (let fl = 0; fl < Math.floor(h / 3); fl++) for (let c = 0; c < Math.floor(w / 2.6); c++) {
        g.add(box(1.2, 1.3, 0.08, win, -w / 2 + 1.4 + c * 2.6, 2.2 + fl * 3, -3.02));
      }
      g.add(box(w * 0.9, 0.5, 0.6, col("za_awning_" + (k % 3), ["#c8463c", "#3f7a52", "#3f6e9e"][k % 3]), 0, 3.2, -3.3));
      g.position.set(x, 0, z); g.rotation.y = yaw;
      S.add(g);
    };
    for (let i = 0; i < 6; i++) shop(-15 + i * 6.2, -19, Math.PI, 6, 7 + (i % 3) * 2.5, i);
    for (let i = 0; i < 6; i++) shop(-15 + i * 6.2, 24, 0, 6, 8 + (i % 2) * 3, i + 2);
    for (let i = 0; i < 6; i++) { shop(-21, -14 + i * 6.4, -Math.PI / 2, 6, 7 + (i % 3) * 2, i + 1); shop(21, -14 + i * 6.4, Math.PI / 2, 6, 8 + (i % 2) * 2, i + 3); }
    for (const [x, z, s] of [[-9, -9, 1.1], [9, -9, 1.0], [-10, 8, 1.2], [10, 9, 1.1], [-14, 0, 1.0], [14, 1, 1.0]]) {
      const t = makeTree(s); t.position.set(x, 0, z); S.add(t);
    }
  }

  // ======================= LIGHT RIG =======================
  private shotSun(id: number, L: typeof LIGHTS.day) {
    let v = this.sunCache.get(id);
    if (v) return v;
    const s = SHOTS[id - 1];
    const c = camAt(id, Math.floor((s.a + s.b) / 2));
    const fx = c.look[0] - c.pos[0], fz = c.look[2] - c.pos[2], n = Math.hypot(fx, fz) || 1;
    const ux = fx / n, uz = fz / n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = ux * Math.cos(az) - uz * Math.sin(az), hz = uz * Math.cos(az) + ux * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  /** Attach a prop to a hand: world position at the hand, oriented by the rig yaw + a pitch about the rig's x axis */
  private attach(rig: HeroRig25D, side: "L" | "R", obj: THREE.Object3D, yaw: number, pitch: number, roll = 0) {
    rig.handWorld(side, this.tmpV);
    obj.position.copy(this.tmpV);
    obj.rotation.set(pitch, yaw, roll, "YXZ");
    obj.visible = true;
  }
  private holdBetween(rig: HeroRig25D, obj: THREE.Object3D, yaw: number, fwd = 0.04, dy = 0) {
    rig.handWorld("L", this.tmpV); rig.handWorld("R", this.tmpV2);
    obj.position.copy(this.tmpV).add(this.tmpV2).multiplyScalar(0.5);
    obj.position.x += Math.sin(yaw) * fwd; obj.position.z += Math.cos(yaw) * fwd; obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.visible = true;
  }

  // ======================= PER-SHOT POSES =======================
  private poseBedroom(id: number, f: number, t: number) {
    // alarm clock rattles through the hook; phone buzzes during the insert
    const ring = f < 50 ? Math.sin(f * 2.9) * 0.08 : 0;
    this.clock.rotation.set(0, Math.PI + 0.25, ring);
    const buzzEnv = smooth((f - 131) / 8) * (1 - smooth((f - 175) / 8));
    const buzz = buzzEnv * 0.0018 * (f % 2 ? 1 : -1);
    this.phone.position.set(-0.42 + buzz, 0.506, 2.12);
    this.phone.rotation.set(0, 0.2 + buzz * 1.5, 0);
    this.couch.position.set(id === 9 ? lerp(1.15, 2.12, smooth((f - 572) / 32)) : id >= 9 ? 2.12 : 1.15, 0, 0.65);
    this.fridgeDoor.rotation.y = id === 10 ? 1.35 + 0.55 * smooth((f - 625) / 28) : 0; // swings out into the room
    this.fridgeLight.color.setRGB(1.15, 1.08, 0.9).multiplyScalar(id === 10 ? 1 : 0.3);
    this.panOnBed.visible = id >= 9;

    if (id <= 2) {
      // bolt upright in bed (f5-14, overshoot), then hands-on-cheeks panic
      const up = f < 5 ? 0 : Math.min(1.08, 1.08 * smooth((f - 5) / 8)) - 0.08 * smooth((f - 13) / 6);
      const lean = lerp(-1.32, 0.06, up);
      const pk = smooth((f - 12) / 8);
      const shake = id === 2 ? 0.22 * Math.sin(t * 13) : 0.05 * Math.sin(t * 9);
      this.hero.pose({
        pos: [-1.75, -0.12, 1.55], yaw: Math.PI, lean, armsFollowLean: true,
        expr: f < 6 ? "neutral" : "shock", blink: f < 6 ? 1 : 0,
        mouthOpen: f < 8 ? 0 : 0.35 + 0.4 * Math.abs(Math.sin(t * (id === 2 ? 11 : 6))),
        headYaw: f < 12 ? 0 : shake, headPitch: f < 6 ? -0.3 : -0.05,
        handL: [lerp(-0.26, -0.17, pk), lerp(0.74, 1.42, pk), lerp(0.25, 0.17, pk)],
        handR: [lerp(0.26, 0.17, pk), lerp(0.74, 1.42, pk), lerp(0.25, 0.17, pk)],
        footL: [-0.12, 0.66, 0.85], footR: [0.12, 0.66, 0.85],
      });
    } else if (id === 7) {
      const nod = 0.12 * Math.max(0, Math.sin((f - 440) * 0.25)) * (f > 440 && f < 470 ? 1 : 0);
      this.hero.pose({ pos: [0.2, 0, 0.6], yaw: Math.PI, expr: "stern", headPitch: nod, lean: 0.03,
        handL: [-0.28, 0.82, 0.14], handR: [0.28, 0.82, 0.14] });
    } else if (id === 8) {
      // pan whips up (f490-500), left hand plants the pot on the head (f526-538)
      const up = smooth((f - 490) / 9), pot = smooth((f - 526) / 12), down = smooth((f - 542) / 10);
      const hL: V3 = f < 538 ? [lerp(-0.3, -0.06, pot), lerp(0.88, 1.8, pot), lerp(0.16, 0.02, pot)] : [lerp(-0.06, -0.27, down), lerp(1.8, 1.0, down), lerp(0.02, 0.2, down)];
      this.hero.pose({ pos: [0.2, 0, 0.6], yaw: Math.PI, expr: "stern", lean: 0.02, headPitch: f >= 538 && f < 545 ? 0.1 : 0,
        handL: hL, handR: [lerp(0.28, 0.3, up), lerp(0.85, 1.28, up), lerp(0.14, 0.18, up)] });
      this.attach(this.hero, "R", this.pan, Math.PI, lerp(0.9, 0.12, up));
      this.potHead.visible = f >= 538;
      if (f < 538) {
        this.hero.handWorld("L", this.tmpV);
        this.potHand.position.set(this.tmpV.x, this.tmpV.y + 0.06 + 0.04 * pot, this.tmpV.z);
        this.potHand.rotation.set(0, 0, 0);
        this.potHand.visible = true;
      }
    } else if (id === 9) {
      const cx = this.couch.position.x;
      const g = gait(t, 1.6, 0, 0.14, 0.05);
      this.hero.pose({ pos: [cx - 0.78, 0, 0.62], yaw: Math.PI / 2, lean: 0.38, armsFollowLean: true, expr: "stern",
        handL: [-0.24, 0.98, 0.42], handR: [0.24, 0.98, 0.42], footL: [-0.12, 0.04 + 0.05 * Math.max(0, Math.sin(t * 10)), -0.1 + g.footL[2]], footR: [0.12, 0.04, -0.15 + g.footR[2]] });
    } else if (id === 10) {
      // peering into the fridge (camera sits inside it, looking back out at you)
      // squats and bends right down so the face fills the fridge opening
      this.hero.pose({ pos: [1.95, -0.36, 0.98], yaw: 0, lean: 1.1, armsFollowLean: true, expr: "neutral",
        headPitch: -0.75, blink: 0, handL: [-0.32, 0.9, 0.62], handR: [0.32, 0.9, 0.62],
        footL: [-0.14, 0.44, 0.12], footR: [0.14, 0.44, 0.12] });
    }
    this.potHead.visible = this.potHead.visible || id >= 9;
  }

  private poseStreet(id: number, f: number, t: number) {
    // papers: a few drift / tumble across the road (Shot 4), the rest lie still
    for (let i = 0; i < 24; i++) {
      const moving = i < 6 && id === 4;
      const x = moving ? -5 + ((t - 6.1) * (1.6 + hash(i) * 0.8) + hash(i * 3) * 8) : (hash(i * 1.7) - 0.5) * 8;
      const z = moving ? 4 + hash(i * 5.1) * 14 : -4 + hash(i * 2.3) * 30;
      const y = moving ? 0.15 + 0.35 * Math.abs(Math.sin(t * 2.4 + i)) : 0.012;
      this.m4.makeRotationFromEuler(new THREE.Euler(moving ? t * 3 + i : -Math.PI / 2, hash(i) * 3, moving ? t * 2 : 0));
      this.m4.setPosition(x, y, z);
      this.papers.setMatrixAt(i, this.m4);
    }
    this.papers.instanceMatrix.needsUpdate = true;
    const lidOpen = id === 17 ? (f < 1088 ? -1.75 : -1.75 * (1 - smooth((f - 1088) / 6))) : id === 18 ? -1.25 * smooth((f - 1118) / 12) : id === 16 ? -1.75 : 0;
    this.dumpLid.rotation.z = lidOpen;

    if (id === 5 || id === 6) {
      // first zombie: limping down the centre line, right leg dragging
      const z = zombie1Z(f), s = Math.sin(t * 2 * Math.PI * 0.75);
      this.zombie1.pose(zPose([0.0, 0, z], Math.PI, t, 0.4, 0, {
        footL: [-0.12, 0.04 + 0.06 * Math.max(0, s), 0.08 + 0.16 * s], footR: [0.15, 0.035, -0.28 + 0.04 * s],
        pos: [0.0, 0.015 * Math.abs(s), z], lean: 0.2, headYaw: 0.25 * Math.sin(t * 0.8), mouthOpen: f > 262 && f < 300 ? 0.5 : 0,
      }));
    }
    if (id >= 11 && id <= 15) {
      // you: sneaking with the pan, pot on your head
      const p = heroStreetPos(f);
      const sneakK = id === 11 ? 1 : id === 12 ? 1 - smooth((f - 726) / 18) : 0;
      const g = gait(t, 1.3, 0, 0.12 * sneakK, 0.05 * sneakK);
      let hR: V3 = [0.26, 1.06, 0.34], pitch = 1.0, expr: RigPose["expr"] = "stern", yaw = id === 11 ? -0.46 : 0.05;
      let hL: V3 = [-0.2, 0.96, 0.32];
      if (id === 12 && f >= 750) { expr = "shock"; hR = [0.24, 1.32, 0.3]; pitch = 0.35; }
      if (id === 13) { expr = "shock"; hR = [0.24, 1.32, 0.3]; pitch = 0.35; }
      if (id === 14) {
        // wind-up f845-868 -> swing f868-880 (BONK) -> follow-through
        const w = smooth((f - 846) / 20), s = smooth((f - 868) / 12), ft = smooth((f - 880) / 10);
        hR = [lerp(lerp(0.26, 0.32, w), 0.06, s) - 0.28 * ft, lerp(lerp(1.15, 1.55, w), 1.36, s) - 0.32 * ft, lerp(lerp(0.3, -0.22, w), 0.56, s) - 0.15 * ft];
        pitch = lerp(lerp(0.4, -0.7, w), 1.45, s) + 0.5 * ft;
        hL = [-0.22, 1.0 + 0.1 * w, 0.28];
        expr = f < 890 ? "stern" : "shock";
      }
      if (id === 15) { expr = "shock"; hR = [0.27, 0.95, 0.3]; pitch = 1.2; }
      this.hero.pose({ pos: [p[0], -0.06 * sneakK, p[2]], yaw, lean: lerp(id === 14 ? 0.08 : 0.04, 0.3, sneakK), armsFollowLean: true,
        expr, headYaw: id === 11 ? 0.3 * Math.sin(t * 2.2) : 0, handL: hL, handR: hR,
        footL: [g.footL[0], g.footL[1] + 0.06 * sneakK, g.footL[2]], footR: [g.footR[0], g.footR[1] + 0.06 * sneakK, g.footR[2]] });
      this.potHead.visible = true;
      this.attach(this.hero, "R", this.pan, yaw, pitch);
    }
    if (id >= 12 && id <= 16) {
      // Gary: hidden behind car B, lurches out, gets BONKed, rubs his bump
      const p = garyPos(f), h = heroStreetPos(f);
      const rise = smooth((f - 721) / 26);
      const yaw = id === 16 ? 0 : f < 721 ? -0.6 : yawTo(p, h);
      if (id === 16) {
        const z = 13.7 + (f - 978) * 0.03;
        this.gary.pose(zPose([1.0, 0, z], 0, t, 1.1, 0.8, { handL: [-0.06, 1.64, 0.06], expr: "stern" }));
      } else if (id <= 13) {
        this.gary.pose(zPose([p[0], lerp(-0.45, 0, rise), p[2]], yaw, t, 1.1, f > 752 ? 0.7 : 0, {
          lean: lerp(0.55, 0.16, rise), mouthOpen: f >= 803 && f < 840 ? 0.55 + 0.35 * Math.abs(Math.sin(t * 5)) : f > 724 && f < 760 ? 0.6 : 0,
          handL: rise < 0.6 ? [-0.25, 0.85, 0.3] : [-0.17, 1.2, 0.5], handR: rise < 0.6 ? [0.25, 0.85, 0.3] : [0.17, 1.16, 0.52] }));
      } else {
        const hit = f >= 880, rec = Math.exp(-(f - 880) / 9);
        const talk = id === 15 && f < 972 ? 0.3 + 0.5 * Math.abs(Math.sin(t * 13)) : 0;
        this.gary.pose(zPose(p, yaw, t, 1.1, 0, {
          lean: hit ? 0.1 - 0.3 * rec : 0.16, headYaw: hit ? 0.7 * rec * Math.cos((f - 880) * 0.5) : 0.1 * Math.sin(t),
          expr: !hit ? "neutral" : f < 905 ? "pained" : "stern", mouthOpen: talk,
          handL: hit && f > 895 ? [-0.06 + 0.03 * Math.sin(t * 9), 1.64, 0.06 + 0.03 * Math.cos(t * 9)] : [-0.17, 1.17, 0.47],
          handR: hit ? [0.24, 0.92, 0.2] : [0.17, 1.13, 0.49] }));
      }
      this.garyBump.visible = f >= 880;
      // cartoon stars circling the bump
      if (f >= 882 && f < 978) {
        this.gary.headPivot.getWorldPosition(this.tmpV);
        this.stars.forEach((s, i) => {
          const a = t * 6 + (i / 3) * Math.PI * 2;
          s.position.set(this.tmpV.x + Math.cos(a) * 0.26, this.tmpV.y + 0.42 + 0.03 * Math.sin(a * 2), this.tmpV.z + Math.sin(a) * 0.26);
          s.rotation.set(0, -a, 0);
          s.visible = true;
        });
      }
    }
    if (id >= 16 && id <= 18) {
      // the shuffling crowd, all heading the same way (+z, toward the square)
      for (let k = 0; k < 18; k++) {
        const c = this.crowd[k];
        // Shot 16 spreads them across the road; 17-18 cameras stand in the +x lane, so the horde keeps to the far lane
        const x = id === 16 ? -3.3 + (k % 6) * 1.32 + (hash(k) - 0.5) * 0.5 : -3.4 + (k % 6) * 0.66 + (hash(k) - 0.5) * 0.3;
        const z = -3 + Math.floor(k / 6) * 6.5 + hash(k * 3) * 4 + (f - 978) * (0.026 + 0.008 * hash(k * 7));
        c.pose(zPose([x, 0, z], 0.08 * (hash(k * 2) - 0.5), t, k * 1.3, 0.8 + 0.2 * hash(k)));
      }
    }
    if (id === 16 || id === 17) {
      const shock = id === 16;
      if (shock || f < 1068) {
        this.hero.pose({ pos: [4.15, 0, 7.15], yaw: -Math.PI / 2 + (shock ? 0.35 * Math.sin(t * 2.4) : 0.3), lean: 0.05, expr: "shock",
          headYaw: shock ? 0.35 * Math.sin(t * 3.1) : 0, handL: [-0.22, 1.0, 0.3], handR: [0.26, 1.2, 0.3] });
      } else if (f < 1090) {
        // dive: arc over the lip into the dumpster
        const k = smooth((f - 1068) / 20);
        const pos: V3 = [lerp(4.15, 5.05, k), lerp(0, 0.3, k) + 1.0 * Math.sin(Math.PI * k), lerp(7.15, 8.0, k)];
        this.hero.pose({ pos, yaw: Math.PI / 2, lean: lerp(0.2, 1.3, k), armsFollowLean: true, expr: "shock",
          handL: [-0.15, 1.7, 0.5], handR: [0.15, 1.7, 0.5], footL: [-0.12, 0.25, -0.3], footR: [0.12, 0.35, -0.2] });
      }
      if (this.hero.root.visible) { this.potHead.visible = true; this.attach(this.hero, "R", this.pan, this.hero.root.rotation.y, 2.2); }
    }
    if (id === 18) {
      // climb out, covered head to toe
      const rise = smooth((f - 1124) / 22), out = smooth((f - 1150) / 34);
      const pos: V3 = [lerp(5.05, 4.0, out), lerp(lerp(-0.95, 0.15, rise), 0, out) + 0.45 * Math.sin(Math.PI * out), lerp(8.0, 8.35, out)];
      const yaw = lerp(-Math.PI / 2, -2.1, smooth((f - 1185) / 20));
      const looking = smooth((f - 1192) / 14);
      this.heroDirty.pose({ pos, yaw, lean: 0.05 + 0.35 * Math.sin(Math.PI * out), expr: f < 1190 ? "pained" : "shock",
        headPitch: 0.32 * looking, handL: [lerp(-0.25, -0.42, looking), lerp(1.0, 1.05, looking), 0.25], handR: [lerp(0.25, 0.42, looking), 1.05, 0.25],
        footL: out > 0 && out < 1 ? [-0.12, 0.3, 0.2] : undefined });
      this.attach(this.heroDirty, "R", this.pan, yaw, 1.6, 0.4);
    }
  }

  /** Square crowd slots: a loose ring round the plaza centre; slots 0-2 (the friends) stand just behind you (-z) */
  private ringSlot(k: number): V3 {
    if (k === 0) return [-0.58, 0, -1.85];
    if (k === 1) return [0.05, 0, -2.15];
    if (k === 2) return [0.66, 0, -1.8];
    const a = (k / 19) * Math.PI * 2 + 0.4, r = 2.1 + (k % 4) * 0.95 + hash(k) * 0.5;
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 0.6 && Math.abs(x) < 1.1) x += x < 0 ? -1.2 : 1.2; // keep an aisle to the camera side (+z)
    return [x, 0, z];
  }
  /** Stage-front slots for the announcement: rows facing the stage */
  private stageSlot(k: number): V3 {
    const row = Math.floor(k / 8), c = k % 8;
    return [-3.2 + c * 0.92 + (row % 2) * 0.4 + (hash(k) - 0.5) * 0.25, 0, 11.4 - row * 0.95 + (hash(k * 3) - 0.5) * 0.3];
  }

  private poseSquare(id: number, f: number, t: number) {
    const heroP: V3 = id === 19 ? (() => { const k = smooth((f - 1230) / 62); return [lerp(-4.6, 0, k), 0, lerp(0.9, 0, k)] as V3; })() : [0, 0, 0];
    // ---- crowd ----
    for (let k = 0; k < 22; k++) {
      const c = this.crowd[k];
      if (id <= 23) {
        const p = this.ringSlot(k), ph = k * 1.9;
        const mill = Math.PI * 2 * hash(k * 5.3);
        const turnK = id === 19 ? 0 : id === 20 ? smooth((f - 1318 - (k % 7) * 4) / 10) : 1;
        const face = yawTo(p, heroP);
        if (id <= 21) {
          const step = id === 21 ? 0.25 * smooth((f - 1380) / 30) : 0; // shuffle a step closer for the last stand
          const d = Math.hypot(p[0], p[2]) || 1;
          const pos: V3 = [p[0] - (p[0] / d) * step, 0, p[2] - (p[2] / d) * step];
          c.pose(zPose(pos, lerpAngle(mill, face, turnK), t, ph, 0, { headYaw: (1 - turnK) * 0.2 * Math.sin(t + ph), expr: turnK > 0.6 ? "shock" : "neutral" }));
        } else if (id === 22) {
          c.pose(partyPose(p, face + 0.3 * Math.sin(ph), t, k));
        } else if (k <= 2) {
          // friends hold up their phones (still calling you)
          const ph2 = Math.sin(t * 3 + k);
          c.pose(partyPose(p, face, t, k, { expr: k === 1 ? "laugh" : "grin", mouthOpen: k === 1 ? 0.45 : 0,
            handR: [0.16, 1.3 + 0.04 * ph2, 0.42], handL: k === 0 ? [-0.36, 1.25, 0.2] : [-0.26, 0.8, 0.14] }));
          this.attach(c, "R", this.friendPhones[k], face, 0, 0);
          this.friendPhones[k].rotation.set(-0.15, face, 0.1 * ph2);
        } else {
          c.pose(partyPose(p, face, t, k));
        }
      } else {
        const p = this.stageSlot(k);
        const back = id === 24 && f >= 1766 ? smooth((f - 1768 - (k % 5) * 3) / 12) : 0;
        const toHero = yawTo(p, [0, 0, 0]);
        const cheer = (id === 24 && f > 1784) || id === 25;
        c.pose(partyPose(p, lerpAngle(0.1 * (hash(k) - 0.5), toHero, back), t, k, cheer ? {
          handL: [-0.3, 1.6 + 0.08 * Math.sin(t * 8 + k), 0.1], handR: [0.3, 1.6 + 0.08 * Math.cos(t * 8 + k), 0.1], expr: "laugh", mouthOpen: 0.4 } : {}));
      }
    }
    // ---- you ----
    if (id <= 24) {
      let o: Partial<RigPose> = {};
      let pitch = 1.1, roll = 0;
      if (id === 19) {
        const g = gait(t, f < 1292 ? 1.1 : 0, 0, 0.14, 0.05);
        o = { yaw: lerpAngle(1.35, 0, smooth((f - 1280) / 20)), expr: "pained", headPitch: 0.3, footL: g.footL, footR: g.footR,
          handL: [-0.3, 0.98, 0.2], handR: [0.28, 1.0, 0.25] };
      } else if (id === 20) {
        o = { yaw: 0, expr: "shock", headYaw: 0.4 * Math.sin((f - 1311) * 0.12) * (f < 1345 ? 1 : 0.2), handL: [-0.26, 1.05, 0.25], handR: [0.27, 1.12, 0.3] };
      } else if (id === 21) {
        const up = smooth((f - 1376) / 18);
        o = { yaw: 0, expr: "stern", lean: -0.05 * up, handL: [-0.3, lerp(1.0, 1.1, up), lerp(0.25, 0.32, up)], handR: [lerp(0.27, 0.16, up), lerp(1.12, 1.98, up), lerp(0.3, 0.08, up)] };
        pitch = lerp(1.1, -0.15, up);
      } else if (id === 22) {
        const dn = smooth((f - 1470) / 30);
        o = { yaw: 0, expr: "shock", headYaw: 0.5 * Math.sin((f - 1448) * 0.05), handL: [-0.28, 0.95, 0.2], handR: [lerp(0.16, 0.27, dn), lerp(1.98, 0.95, dn), lerp(0.08, 0.25, dn)] };
        pitch = lerp(-0.15, 1.2, dn);
      } else if (id === 23) {
        o = { yaw: Math.PI, expr: f < 1630 ? "shock" : "neutral", handL: [-0.27, 0.9, 0.2], handR: [0.27, 0.92, 0.25] };
      } else if (id === 24) {
        const g = f >= 1766 ? smooth((f - 1772) / 14) : 0;
        o = { yaw: 0, expr: f >= 1772 ? "shock" : "neutral", headYaw: -0.25 * g, handL: [-0.27, 0.9, 0.2], handR: [0.27, 0.95, 0.25] };
      }
      this.heroDirty.pose({ pos: heroP, lean: 0.03, ...o });
      this.attach(this.heroDirty, "R", this.pan, this.heroDirty.root.rotation.y, pitch, roll);
    } else {
      // on stage with the trophy; grins + lifts it on "best zombie"
      const lift = smooth((f - 1922) / 10);
      this.heroDirty.pose({ pos: [0.55, 0.96, 13.15], yaw: Math.PI, expr: f >= 1918 ? "grin" : "neutral",
        headYaw: f < 1880 ? 0.25 * Math.sin(t * 1.6) : 0,
        handL: [-0.13, lerp(1.08, 1.3, lift), 0.3], handR: [0.13, lerp(1.08, 1.3, lift), 0.3] });
      this.holdBetween(this.heroDirty, this.trophy, Math.PI, 0.02, -0.02);
    }
    // ---- host ----
    if (id >= 24) {
      const talking = id === 24 && f < 1788;
      const point = id === 24 ? smooth((f - 1760) / 8) : 0;
      const clap = id === 25 ? Math.abs(Math.sin(t * 9)) : 0;
      const hostYaw = id === 25 ? Math.PI - 0.5 : Math.PI;
      this.host.pose({ pos: id === 25 ? [-0.95, 0.96, 13.35] : [-1.0, 0.96, 13.4], yaw: hostYaw, expr: "grin",
        mouthOpen: talking ? 0.3 + 0.5 * Math.abs(Math.sin(t * 12)) : id === 25 ? 0.4 : 0,
        handL: id === 25 ? [-0.06 - 0.08 * clap, 1.22, 0.36] : [-0.08, 1.38, 0.22],
        handR: id === 25 ? [0.06 + 0.08 * clap, 1.22, 0.36] : [lerp(0.28, 0.3, point), lerp(0.95, 1.3, point), lerp(0.15, 0.62, point)] });
      if (id === 24) { this.attach(this.host, "L", this.mic, hostYaw, -0.5); }
    }
    // ---- confetti ----
    if (id === 25) {
      this.confetti.visible = true;
      for (let i = 0; i < 220; i++) {
        const age = (f - 1803) / FPS - hash(i * 1.9) * 0.4;
        const x = (hash(i * 3.3) - 0.5) * 7, z = 11 + hash(i * 7.1) * 4.5;
        const y = age < 0 ? -10 : 6.5 + 2.5 * hash(i) - age * (0.9 + 0.5 * hash(i * 2.2)) - (age < 0.4 ? -3 * (0.4 - age) : 0);
        this.m4.makeRotationFromEuler(new THREE.Euler(t * 5 + i, t * 3.1 + i * 0.7, Math.sin(t * 6 + i)));
        this.m4.setPosition(x + 0.3 * Math.sin(t * 2 + i), Math.max(-10, y), z);
        this.confetti.setMatrixAt(i, this.m4);
      }
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "bedroom" ? 9 : 28;
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias;

    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

    const su = this.skyMat.uniforms;
    K.sky.c.forEach((hex, idx) => untone(hex, su["c" + idx].value));
    const elRad = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(elRad[1], elRad[2], elRad[3], elRad[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog;

    // hide every actor / loose prop, then pose what this shot needs
    for (const r of [this.hero, this.heroDirty, this.zombie1, this.gary, this.host, ...this.crowd]) r.root.visible = false;
    for (const o of [this.pan, this.potHand, this.trophy, this.mic, this.confetti, ...this.stars, ...this.friendPhones]) o.visible = false;
    this.potHead.visible = false;
    this.garyBump.visible = false;

    if (s.set === "bedroom") this.poseBedroom(id, f, t);
    else if (s.set === "street") this.poseStreet(id, f, t);
    else this.poseSquare(id, f, t);

    // camera-clip guard: never let the lens end up inside an actor (its BackSide ink hull would fill the frame)
    for (const r of [this.hero, this.heroDirty, this.zombie1, this.gary, this.host, ...this.crowd]) {
      if (!r.root.visible) continue;
      const p = r.root.position, dy = cam.position.y - p.y;
      if (dy > -0.2 && dy < 2.0 && Math.hypot(cam.position.x - p.x, cam.position.z - p.z) < 0.5) r.root.visible = false;
    }

    return focus;
  }
}

