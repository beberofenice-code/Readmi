// Modular 3D Set Registry for "What If You Think 100x Faster?": kitchen, bedroom, study, office, street, terrace.
// Only the active shot's set Group is visible per frame; shared twoTone materials keep draw calls minimal.
// Cameras sit at -z looking +z (screen-right = world -x); every rig faces local +z, so yaw = PI looks at the lens.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex, rep, facadeHD } from "../core/paint";
import { untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D, RigPose } from "../core/rig25d";
import {
  FPS, SHOTS, V3, camAt, smooth, clamp01, walkX, bossMouth,
  SIT_UP, BOOK_SHUT, CHESS_MOVES, KING_FALLS, SNEEZE, BOSS_SPEAKS, DAY_FLIPS, PIGEON_LANDS, TOAST_POP,
} from "./story";

// ---------------- tiny builders ----------------
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam("t100_" + key, () => ({ color: hex }));
const tex = (key: string, t: THREE.Texture) => lam("t100_tex_" + key, () => ({ map: t }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect) */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const noink = <T extends THREE.Object3D>(o: T) => { o.traverse((c) => c.layers.set(NOINK)); return o; };

/** Unlit readable face that looks toward -z (the lens), on NOINK so the ink pass never traces the lettering */
const face = (w: number, h: number, t: THREE.Texture, x = 0, y = 0, z = 0, opts: THREE.MeshBasicMaterialParameters = {}) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: t, ...opts }));
  m.position.set(x, y, z);
  m.layers.set(NOINK);
  return m;
};
/** Sign = lam backing card (gets an ink outline) + unlit face, facing -z */
const sign = (w: number, h: number, t: THREE.Texture, backHex = "#f4efe3", x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.add(box(w + 0.04, h + 0.04, 0.03, col("sign_" + backHex, backHex)));
  const f = face(w, h, t, 0, 0, -0.017);
  g.add(f);
  g.position.set(x, y, z);
  return { g, face: f };
};
/** world point -> rig-local target for a rig standing at pos with the given yaw */
const toLocal = (pos: V3, yaw: number, w: V3): V3 => {
  const dx = w[0] - pos[0], dz = w[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, w[1] - pos[1], dx * s + dz * c];
};
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** quick blink every `every` frames, 2 frames long (Milo blinks a lot: he is bored 100x faster) */
const blinkAt = (f: number, every = 46, off = 0) => ((f + off) % every < 2 ? 1 : 0);

/** Planted-foot walk cycle in rig-local space (ph in cycles; stance foot travels +A -> -A, so speed = 4A / period) */
const walkPose = (ph: number, A = 0.22): Pick<RigPose, "footL" | "footR" | "handL" | "handR"> & { bob: number } => {
  const leg = (p: number): [number, number] => {
    const u = ((p % 1) + 1) % 1;
    if (u < 0.5) return [0.04, A - 4 * A * u];
    const s = (u - 0.5) * 2;
    return [0.04 + 0.1 * Math.sin(Math.PI * s), -A + 2 * A * s];
  };
  const L = leg(ph), R = leg(ph + 0.5);
  return {
    footL: [-0.1, L[0], L[1]], footR: [0.1, R[0], R[1]],
    handL: [-0.27, 0.78, 0.06 - 0.75 * L[1]], handR: [0.27, 0.78, 0.06 - 0.75 * R[1]],
    bob: 0.022 * Math.abs(Math.sin(ph * Math.PI * 2)),
  };
};

// ---------------- painted textures ----------------
const INKC = "#241726";
const checker = (key: string, a: string, b: string) =>
  ctex("t100_chk_" + key, 256, 256, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    g.fillStyle = b; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    g.strokeStyle = "rgba(60,40,40,0.18)"; g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128); g.strokeRect(128, 0, 128, 128); g.strokeRect(0, 128, 128, 128);
  });
const woodFloor = (key: string, base: string, line: string) =>
  ctex("t100_wood_" + key, 512, 512, (g, r) => {
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,240,210" : "70,40,20"},${0.04 + r() * 0.06})`;
      g.fillRect(0, i * 64, 512, 64);
      g.fillStyle = line; g.fillRect(0, i * 64, 512, 3);
      const off = Math.floor(r() * 400);
      g.fillRect(off, i * 64, 3, 64); g.fillRect((off + 256) % 512, i * 64, 3, 64);
    }
  });
const clockFaceTex = () =>
  ctex("t100_clockface", 256, 256, (g) => {
    g.fillStyle = "#fbf7ec"; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INKC; g.lineWidth = 6; g.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r0 = i % 3 ? 104 : 92;
      g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114); g.stroke();
    }
  });
const textTex = (key: string, w: number, h: number, bg: string, draw: (g: CanvasRenderingContext2D) => void) =>
  ctex("t100_" + key, w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.textAlign = "center"; g.textBaseline = "middle"; draw(g); });

const BOARD = "#2c5a4c";
const chalkLine = (key: string, text: string, size = 58, color = "#f3f1e6", fontFace = "italic 58px serif") =>
  textTex("chalk_" + key, 1024, 128, BOARD, (g) => {
    g.fillStyle = color; g.font = fontFace.replace("58px", size + "px"); g.textAlign = "left";
    g.fillText(text, 18, 68);
    g.globalAlpha = 0.25; g.fillText(text, 20, 70); g.globalAlpha = 1; // chalk smear
  });
const dayPageTex = (n: number) =>
  textTex("daypage_" + n, 384, 448, "#fbf8ef", (g) => {
    g.fillStyle = "#c93b3b"; g.fillRect(0, 0, 384, 96);
    g.fillStyle = "#ffffff"; g.font = "900 56px Inter, sans-serif"; g.fillText("MEETING", 192, 52);
    g.fillStyle = INKC; g.font = "800 64px Inter, sans-serif"; g.fillText("DAY", 192, 168);
    g.font = "900 230px Inter, sans-serif"; g.fillText(String(n), 192, 326);
  });
const tallyTex = () =>
  ctex("t100_tally", 1536, 1366, (g, r) => {
    g.fillStyle = "#f0dfbf"; g.fillRect(0, 0, 1536, 1366);
    g.strokeStyle = "#3a2c3a"; g.lineCap = "round";
    for (let y = 30; y < 1340; y += 62) for (let x = 24; x < 1500; x += 74) {
      const jx = x + (r() - 0.5) * 8, jy = y + (r() - 0.5) * 8;
      g.lineWidth = 5 + r() * 2;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(jx + k * 12 + (r() - 0.5) * 3, jy); g.lineTo(jx + k * 12 + (r() - 0.5) * 4, jy + 42); g.stroke(); }
      g.beginPath(); g.moveTo(jx - 8, jy + 36 + (r() - 0.5) * 8); g.lineTo(jx + 46, jy + 6 + (r() - 0.5) * 8); g.stroke();
    }
  });
const bannerTex = () =>
  textTex("banner", 1024, 256, "#ffd95a", (g) => {
    g.strokeStyle = "#e2563b"; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 242);
    g.fillStyle = INKC; g.font = "900 96px Inter, sans-serif"; g.textAlign = "left";
    g.fillText("HAPPY", 40, 86);
    g.fillText("80th", 410, 86);
    g.strokeStyle = "#d1262b"; g.lineWidth = 14; g.beginPath(); g.moveTo(396, 100); g.lineTo(650, 66); g.stroke();
    g.fillStyle = "#d1262b"; g.font = "italic 900 104px serif"; g.save(); g.translate(690, 84); g.rotate(-0.06); g.fillText("8,000th", 0, 0); g.restore();
    g.fillStyle = INKC; g.font = "900 92px Inter, sans-serif"; g.fillText("BIRTHDAY, MILO", 40, 190);
  });
const chessTex = () =>
  ctex("t100_chess", 256, 256, (g) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? "#7a5236" : "#f0dcb8"; g.fillRect(i * 32, j * 32, 32, 32); }
  });
const haTex = () =>
  ctex("t100_ha", 256, 160, (g) => {
    g.clearRect(0, 0, 256, 160);
    g.fillStyle = "#fff6e4"; g.strokeStyle = INKC; g.lineWidth = 10;
    g.beginPath(); g.roundRect(8, 8, 240, 144, 44); g.fill(); g.stroke();
    g.fillStyle = "#e0457b"; g.font = "900 96px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("HA", 128, 84);
  });
const skylineTex = () =>
  ctex("t100_skyline", 1024, 384, (g, r) => {
    g.clearRect(0, 0, 1024, 384);
    let x = 0;
    while (x < 1024) {
      const w = 50 + r() * 90, h = 110 + r() * 250;
      g.fillStyle = r() > 0.5 ? "#141d3c" : "#1a2548"; g.fillRect(x, 384 - h, w, h);
      for (let wy = 384 - h + 14; wy < 372; wy += 22) for (let wx = x + 8; wx < x + w - 12; wx += 18) {
        if (r() > 0.6) { g.fillStyle = r() > 0.3 ? "#f5c869" : "#9fd4ff"; g.fillRect(wx, wy, 8, 11); }
      }
      x += w + 2;
    }
  });
const bookShelfTex = () =>
  ctex("t100_shelf", 256, 512, (g, r) => {
    g.fillStyle = "#6b4630"; g.fillRect(0, 0, 256, 512);
    const cols = ["#c93b3b", "#3f7fd6", "#e8c45a", "#4f9c94", "#8a5fb5", "#e2823b", "#f1ede2"];
    for (let s = 0; s < 5; s++) {
      let x = 10;
      while (x < 236) { const w = 14 + r() * 18, h = 62 + r() * 24; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, s * 102 + 96 - h, w, h); x += w + 2; }
      g.fillStyle = "#4d3222"; g.fillRect(0, s * 102 + 96, 256, 8);
    }
  });

/** Curved streaks whipping round Milo's head: the visual shorthand for a mind running at x100 */
class ThoughtSparks {
  root = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  constructor(parent: THREE.Object3D) {
    const cols = [glow(2.6, 2.1, 0.55), glow(0.6, 2.2, 2.6), glow(2.6, 1.0, 1.9)];
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.33 + k * 0.035, 0.011, 6, 20, 1.5), cols[k]);
      m.layers.set(NOINK);
      this.rings.push(m);
      this.root.add(m);
    }
    this.root.visible = false;
    parent.add(this.root);
  }
  update(rig: HeroRig25D, t: number, k: number) {
    this.root.visible = k > 0.01;
    if (!this.root.visible) return;
    rig.headPivot.getWorldPosition(this.root.position);
    this.root.position.y += 0.36;
    this.rings.forEach((m, i) => {
      m.rotation.set(Math.PI / 2 + 0.28 * Math.sin(i * 2.1 + 0.4), 0.25 * Math.cos(i * 1.7), 0, "YXZ");
      m.rotateZ(t * (17 + i * 5) * (i % 2 ? -1 : 1) + i * 2.1);
      m.scale.setScalar(k);
    });
  }
}

/** Low-poly pigeon; body along +x (flies toward -x when yaw = PI) */
class Pigeon {
  root = new THREE.Group();
  private wings: THREE.Mesh[] = [];
  constructor(parent: THREE.Object3D) {
    const grey = col("pigeon", "#8d93a3"), dark = col("pigeon_dark", "#5d6375");
    const body = ball(0.09, grey); body.scale.set(1.5, 0.95, 0.9);
    const head = ball(0.05, dark, 0.13, 0.07, 0);
    const beak = box(0.05, 0.02, 0.02, col("beak", "#e8a23b"), 0.19, 0.06, 0);
    const tail = box(0.1, 0.015, 0.07, dark, -0.16, 0.02, 0);
    this.root.add(body, head, beak, tail);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.2).translate(0, 0, 0.1 * s), dark);
      w.position.set(0, 0.04, 0.05 * s);
      w.castShadow = true;
      this.wings.push(w);
      this.root.add(w);
    }
    parent.add(this.root);
  }
  /** flap = 0 folded .. 1 full beat amplitude */
  set(x: number, y: number, z: number, yaw: number, t: number, flap: number) {
    this.root.visible = true;
    this.root.position.set(x, y, z);
    this.root.rotation.set(0, yaw, 0);
    const a = flap * (0.25 + 0.95 * Math.sin(t * 34));
    this.wings[0].rotation.x = a; this.wings[1].rotation.x = -a;
    const fold = 1 - 0.55 * (1 - flap);
    this.wings[0].scale.z = fold; this.wings[1].scale.z = fold;
  }
}

type Piece = { m: THREE.Group; home: V3 };

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
  private dummy = new THREE.Object3D();

  // cast
  private milo: HeroRig25D;
  private oldMilo: HeroRig25D;
  private boss: HeroRig25D;
  private gm: HeroRig25D;
  private date: HeroRig25D;
  private statue: HeroRig25D;
  private sparks: ThoughtSparks;
  // kitchen
  private kitDecor = new THREE.Group();
  private kitTally = new THREE.Group();
  private kitClockHand: THREE.Mesh;
  private toast: THREE.Group;
  private toasterLever: THREE.Mesh;
  private toasterGlow: THREE.MeshBasicMaterial;
  private coffeeStream: THREE.Mesh;
  private coffeeDrop: THREE.Mesh;
  private book = new THREE.Group();
  private bookOpen = new THREE.Group();
  private bookShut: THREE.Mesh;
  private bookL: THREE.Mesh;
  private bookR: THREE.Mesh;
  private bookPages: THREE.Mesh[] = [];
  private cake = new THREE.Group();
  private cakeFlames: THREE.Mesh[] = [];
  // bedroom
  private bedWall: THREE.MeshLambertMaterial;
  private bedWindow: THREE.MeshBasicMaterial;
  private bedMoon: THREE.Mesh;
  private alarm = new THREE.Group();
  private alarmFace: THREE.Mesh;
  private sheepCard = new THREE.Group();
  private sheepCanvas: HTMLCanvasElement;
  private sheepTex: THREE.CanvasTexture;
  private sheepShown = -1;
  private lampGlow: THREE.MeshBasicMaterial;
  // study
  private chessSet = new THREE.Group();
  private queen: Piece;
  private victims: Piece[] = [];
  private king: Piece;
  private boardLines: { m: THREE.Mesh; t: THREE.Texture; x: number; w: number; a: number; b: number }[] = [];
  private dust: THREE.InstancedMesh;
  // office
  private calTop = new THREE.Group();
  private calTopFace: THREE.Mesh;
  private calUnderFace: THREE.Mesh;
  private offClockHand: THREE.Mesh;
  private monitorGlow: THREE.MeshBasicMaterial;
  // street
  private lampRed: THREE.MeshBasicMaterial;
  private lampAmber: THREE.MeshBasicMaterial;
  private lampGreen: THREE.MeshBasicMaterial;
  private pigeon: Pigeon;
  private pigeon2: Pigeon;
  private cobweb: THREE.Mesh;
  // terrace
  private candle: THREE.Mesh;
  private flame: THREE.Mesh;
  private wax: THREE.Mesh;
  private has: THREE.Mesh[] = [];

  constructor() {
    const R = this.root;
    // 5-stop elevation Sky Shader (shared across all sets)
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

    for (const name of ["kitchen", "bedroom", "study", "office", "street", "terrace"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }
    this.buildKitchen();
    this.buildBedroom();
    this.buildStudy();
    this.buildOffice();
    this.buildStreet();
    this.buildTerrace();

    this.milo = new HeroRig25D(R, { jacket: "#3f7fd6", hair: "#3b2a1e" });
    this.sparks = new ThoughtSparks(R);
  }

  /** wall clock: lam rim (inked) + unlit face + hinged second hand; returns the hand */
  private wallClock(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.28, rimHex = "#e2563b") {
    const rim = cyl(r + 0.03, r + 0.03, 0.05, col("clock_rim_" + rimHex, rimHex), x, y, z, 28);
    rim.rotation.x = Math.PI / 2;
    const f = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: clockFaceTex() }));
    f.position.set(x, y, z - 0.027); f.layers.set(NOINK);
    const dark = new THREE.MeshBasicMaterial({ color: INKC });
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.03, r * 0.5, 0.004).translate(0, r * 0.25, 0), dark);
    const minute = new THREE.Mesh(new THREE.BoxGeometry(0.022, r * 0.78, 0.004).translate(0, r * 0.39, 0), dark);
    const second = new THREE.Mesh(new THREE.BoxGeometry(0.01, r * 0.86, 0.004).translate(0, r * 0.43, 0), new THREE.MeshBasicMaterial({ color: "#d1262b" }));
    hour.rotation.z = 2.2; minute.rotation.z = -0.7;
    for (const h of [hour, minute, second]) { h.position.set(x, y, z - 0.032); h.layers.set(NOINK); }
    parent.add(rim, f, hour, minute, second);
    return second;
  }

  // ---- 1. KITCHEN (Shots 1, 3, 13, 14): island counter between the lens and Milo ----
  private buildKitchen() {
    const k = this.sets.kitchen;
    k.add(box(10, 0.1, 10, tex("kit_floor", rep(checker("kit", "#f3ead8", "#d9b99a"), 9, 9)), 0, -0.05, 0));
    const wallM = col("kit_wall", "#f0dfbf");
    k.add(box(10, 6, 0.2, wallM, 0, 3, 2.42, false), box(0.2, 6, 10, wallM, 3.6, 3, 0, false), box(0.2, 6, 10, wallM, -3.6, 3, 0, false));
    k.add(box(10, 0.12, 0.06, col("kit_skirt", "#c9b08c"), 0, 0.06, 2.3));
    // back run: base cabinets + worktop, fridge
    const cab = col("kit_cab", "#4f9c94"), top = col("kit_top", "#f3ede2"), knob = col("kit_knob", "#f1d48a");
    k.add(box(6.4, 0.88, 0.6, cab, 0, 0.44, 2.0), box(6.5, 0.05, 0.66, top, 0, 0.905, 1.98));
    for (let i = -3; i <= 3; i++) k.add(box(0.03, 0.74, 0.02, col("kit_cab_line", "#3f837c"), i * 0.9 + 0.45, 0.44, 1.695), box(0.05, 0.05, 0.03, knob, i * 0.9, 0.66, 1.68));
    k.add(box(0.95, 2.0, 0.75, col("fridge", "#e6ebee"), 2.65, 1.0, 1.95), box(0.04, 0.5, 0.04, col("fridge_h", "#9aa3ad"), 2.3, 1.3, 1.56));
    const pot = cyl(0.16, 0.14, 0.18, col("pot", "#d9584a"), 1.2, 1.02, 1.95); k.add(pot, box(0.44, 0.03, 0.04, col("pot_h", "#2d2a33"), 1.2, 1.08, 1.95));
    const plantPot = cyl(0.1, 0.08, 0.16, col("plant_pot", "#e2823b"), -1.6, 1.01, 2.0);
    const leaves = ball(0.2, col("plant", "#4f9a3f"), -1.6, 1.26, 2.0); leaves.scale.set(1, 1.15, 1);
    k.add(plantPot, leaves);
    // wall decor (hidden in Shot 13, when the wall is all tally marks)
    for (const sx of [-1.95, 1.95]) {
      this.kitDecor.add(box(1.9, 0.85, 0.36, cab, sx, 2.35, 2.14));
      this.kitDecor.add(box(0.03, 0.75, 0.02, col("kit_cab_line", "#3f837c"), sx, 2.35, 1.955), box(0.05, 0.05, 0.03, knob, sx - 0.12, 2.05, 1.94), box(0.05, 0.05, 0.03, knob, sx + 0.12, 2.05, 1.94));
    }
    this.kitClockHand = this.wallClock(this.kitDecor, -0.1, 2.5, 2.3);
    k.add(this.kitDecor);
    const tally = face(4.2, 3.74, tallyTex(), 0, 3.05, 2.31);
    const banner = sign(1.7, 0.42, bannerTex(), "#e2563b", 0, 2.2, 2.26);
    this.kitTally.add(tally, banner.g);
    k.add(this.kitTally);

    // island
    k.add(box(2.5, 0.88, 0.8, col("kit_island", "#d98a4f"), 0, 0.44, 0), box(2.66, 0.05, 0.96, top, 0, 0.905, 0));
    for (const dx of [-0.82, 0, 0.82]) k.add(box(0.7, 0.62, 0.02, col("kit_island_p", "#c57740"), dx, 0.46, -0.405), box(0.2, 0.03, 0.03, knob, dx, 0.7, -0.42));

    // toaster (hero prop), front face toward the lens
    const T = new THREE.Group(); T.position.set(-0.42, 0.93, -0.1);
    const chrome = col("toaster", "#d3d7e0"), dark = col("toaster_dark", "#2d2a33");
    T.add(box(0.36, 0.2, 0.2, chrome, 0, 0.115, 0), box(0.38, 0.03, 0.22, dark, 0, 0.015, 0), box(0.34, 0.02, 0.18, chrome, 0, 0.225, 0));
    for (const sz of [-0.045, 0.045]) T.add(box(0.27, 0.012, 0.036, dark, 0, 0.2365, sz));
    this.toasterGlow = glow(2.4, 0.8, 0.2);
    for (const sz of [-0.045, 0.045]) { const gl = box(0.25, 0.004, 0.026, this.toasterGlow, 0, 0.2435, sz, false); gl.layers.set(NOINK); T.add(gl); }
    T.add(box(0.012, 0.13, 0.03, dark, 0.186, 0.12, 0)); // lever slot
    this.toasterLever = box(0.05, 0.03, 0.06, col("toaster_lever", "#e2563b"), 0.2, 0.08, 0);
    T.add(this.toasterLever);
    const dial = cyl(0.028, 0.028, 0.02, col("toaster_lever", "#e2563b"), -0.1, 0.09, -0.105, 14); dial.rotation.x = Math.PI / 2; T.add(dial);
    this.toast = new THREE.Group();
    const bread = col("toast", "#e0a85e"), crust = col("crust", "#a8682f");
    for (const sz of [-0.045, 0.045]) {
      this.toast.add(box(0.21, 0.2, 0.02, bread, 0, 0, sz), box(0.225, 0.03, 0.026, crust, 0, 0.1, sz), box(0.016, 0.2, 0.026, crust, -0.108, 0, sz), box(0.016, 0.2, 0.026, crust, 0.108, 0, sz));
    }
    T.add(this.toast);
    k.add(T);

    // coffee machine + mug + the stream that has barely left the spout (Shot 3)
    const C = new THREE.Group(); C.position.set(0.6, 0.93, 0.1);
    const red = col("coffee_body", "#c0353a");
    C.add(box(0.3, 0.04, 0.32, red, 0, 0.02, 0), box(0.3, 0.46, 0.12, red, 0, 0.23, 0.1), box(0.3, 0.13, 0.32, red, 0, 0.4, 0));
    C.add(box(0.05, 0.05, 0.05, col("toaster_dark", "#2d2a33"), 0, 0.31, -0.06), box(0.2, 0.012, 0.2, col("coffee_tray", "#8e8f99"), 0, 0.046, -0.05));
    const btn = ball(0.02, glow(0.3, 2.2, 0.6), -0.09, 0.4, -0.162); btn.layers.set(NOINK); btn.castShadow = false; C.add(btn);
    const mug = cyl(0.05, 0.045, 0.1, col("mug", "#fbf7ec"), 0, 0.102, -0.06);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 14), col("mug", "#fbf7ec")); handle.position.set(-0.06, 0.1, -0.06);
    C.add(mug, handle);
    const coffee = col("coffee", "#5a3420");
    this.coffeeStream = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 8).translate(0, -0.5, 0), coffee);
    this.coffeeStream.position.set(0, 0.285, -0.06);
    this.coffeeDrop = ball(0.012, coffee);
    C.add(this.coffeeStream, this.coffeeDrop);
    k.add(C);

    // book (Shot 3): open halves with page stacks + riffling pages, or snapped shut
    const cover = col("book_cover", "#8a3fb5"), paper = col("paper", "#fbf7ec");
    this.bookL = box(0.15, 1, 0.21, paper, -0.08, 0, 0); this.bookR = box(0.15, 1, 0.21, paper, 0.08, 0, 0);
    this.bookOpen.add(box(0.34, 0.012, 0.23, cover, 0, -0.006, 0), this.bookL, this.bookR);
    for (let i = 0; i < 4; i++) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.002, 0.2).translate(0.075, 0, 0), paper);
      this.bookPages.push(pg); this.bookOpen.add(pg);
    }
    this.bookShut = box(0.17, 0.06, 0.23, cover);
    this.book.add(this.bookOpen, this.bookShut);
    k.add(this.book);

    // birthday cake (Shot 13)
    this.cake.position.set(0, 0.93, -0.08);
    this.cake.add(cyl(0.26, 0.26, 0.015, col("plate", "#f3ede2"), 0, 0.008, 0, 28), cyl(0.2, 0.2, 0.13, col("cake", "#f29bb4"), 0, 0.08, 0, 28), cyl(0.205, 0.205, 0.03, col("icing", "#fff6e4"), 0, 0.15, 0, 28));
    const num = sign(0.2, 0.15, textTex("eighty", 256, 192, "#fff6e4", (g) => { g.fillStyle = "#d1262b"; g.font = "900 150px Inter, sans-serif"; g.fillText("80", 128, 104); }), "#e2563b", 0, 0.33, 0);
    this.cake.add(num.g, box(0.012, 0.12, 0.012, col("stick", "#c9b08c"), 0, 0.2, 0.01));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, cx = Math.cos(a) * 0.15, cz = Math.sin(a) * 0.15;
      this.cake.add(cyl(0.008, 0.008, 0.07, col("candle_" + (i % 3), ["#6fc3e8", "#ffe36e", "#9be38a"][i % 3]), cx, 0.2, cz, 8));
      const fl = ball(0.014, glow(3.0, 2.0, 0.7), cx, 0.25, cz); fl.scale.y = 1.6; fl.layers.set(NOINK); fl.castShadow = false;
      this.cakeFlames.push(fl); this.cake.add(fl);
    }
    k.add(this.cake);
    this.oldMilo = new HeroRig25D(k, { jacket: "#3f7fd6", hair: "#dcdde2" });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 16), col("party_hat", "#e2563b"));
    hat.position.set(0, 0.52, 0); hat.castShadow = true;
    this.oldMilo.headPivot.add(hat, ball(0.03, col("party_pom", "#ffe36e"), 0, 0.66, 0));
  }

  // ---- 2. BEDROOM (Shot 2 morning, Shot 12 night): single bed along z, head toward +z ----
  private buildBedroom() {
    const b = this.sets.bedroom;
    b.add(box(10, 0.1, 10, tex("bed_floor", rep(woodFloor("bed", "#c99669", "rgba(90,55,30,0.5)"), 5, 5)), 0, -0.05, 0));
    this.bedWall = col("bed_wall", "#bcd3e6") as THREE.MeshLambertMaterial;
    b.add(box(10, 6, 0.2, this.bedWall, 0, 3, 2.3, false), box(0.2, 6, 10, this.bedWall, 3.2, 3, 0, false), box(0.2, 6, 10, this.bedWall, -3.2, 3, 0, false));
    b.add(box(2.6, 0.02, 2.2, col("rug", "#e8c45a"), 0.0, 0.01, 0.4), box(2.2, 0.022, 1.8, col("rug_in", "#f29b5a"), 0.0, 0.012, 0.4));
    const wood = col("bed_wood", "#7a5236");
    b.add(box(1.22, 0.3, 2.15, wood, 0.15, 0.15, 0.95), box(1.1, 0.26, 2.05, col("mattress", "#f2efe8"), 0.15, 0.42, 0.95));
    b.add(box(1.26, 1.15, 0.1, wood, 0.15, 0.78, 2.07), box(1.26, 0.5, 0.08, wood, 0.15, 0.3, -0.14));
    b.add(box(0.72, 0.12, 0.42, col("pillow", "#ffffff"), 0.15, 0.6, 1.66));
    b.add(box(1.16, 0.36, 0.86, col("blanket", "#e2583e"), 0.15, 0.72, 0.31), box(1.17, 0.37, 0.14, col("blanket_fold", "#fbf7ec"), 0.15, 0.72, 0.8));
    for (const bz of [0.0, 0.27, 0.54]) b.add(box(1.168, 0.364, 0.07, col("blanket_stripe", "#f29b5a"), 0.15, 0.72, bz));
    // nightstand + alarm clock (tilts to face the lens of whichever shot is running)
    b.add(box(0.42, 0.5, 0.42, col("nightstand", "#8a5a3c"), -0.66, 0.25, 1.82), box(0.3, 0.04, 0.02, col("kit_knob", "#f1d48a"), -0.66, 0.36, 1.6));
    this.alarm.position.set(-0.64, 0.5, 1.78);
    this.alarm.add(box(0.3, 0.17, 0.1, col("alarm", "#2b2d36"), 0, 0.085, 0));
    this.alarmFace = face(0.26, 0.13, this.alarmTex("7:00", "AM"), 0, 0.085, -0.052);
    this.alarm.add(this.alarmFace, ball(0.03, col("alarm_bell", "#e8c45a"), -0.09, 0.19, 0), ball(0.03, col("alarm_bell", "#e8c45a"), 0.09, 0.19, 0));
    b.add(this.alarm);
    // lamp on the far side, window with sky / moon, framed picture
    b.add(cyl(0.03, 0.05, 0.9, col("lamp_pole", "#3a3f4a"), 1.15, 0.45, 2.0), cyl(0.12, 0.2, 0.26, col("lamp_shade", "#fff0c8"), 1.15, 1.02, 2.0));
    this.lampGlow = glow(0.2, 0.18, 0.14);
    const bulb = ball(0.06, this.lampGlow, 1.15, 0.94, 2.0); bulb.layers.set(NOINK); bulb.castShadow = false; b.add(bulb);
    this.bedWindow = new THREE.MeshBasicMaterial({ color: "#9cc8f2" });
    b.add(box(1.16, 1.36, 0.06, col("window_trim", "#f7f3ea"), 1.9, 1.95, 2.19));
    const pane = box(1.0, 1.2, 0.06, this.bedWindow, 1.9, 1.95, 2.17, false); b.add(pane);
    b.add(box(0.04, 1.2, 0.07, col("window_trim", "#f7f3ea"), 1.9, 1.95, 2.165), box(1.0, 0.04, 0.07, col("window_trim", "#f7f3ea"), 1.9, 1.95, 2.165));
    this.bedMoon = ball(0.13, glow(2.4, 2.3, 1.9), 2.1, 2.2, 2.13); this.bedMoon.layers.set(NOINK); this.bedMoon.castShadow = false;
    b.add(this.bedMoon);
    const pic = sign(0.5, 0.38, textTex("pic", 256, 192, "#8fd0e8", (g) => {
      g.fillStyle = "#ffe36e"; g.beginPath(); g.arc(190, 54, 26, 0, 7); g.fill();
      g.fillStyle = "#5fae5a"; g.beginPath(); g.moveTo(0, 192); g.lineTo(80, 70); g.lineTo(150, 192); g.fill();
      g.fillStyle = "#4f9a3f"; g.beginPath(); g.moveTo(90, 192); g.lineTo(180, 100); g.lineTo(256, 192); g.fill();
    }), "#7a5236", -1.5, 2.05, 2.17);
    b.add(pic.g);
    // sheep counter thought card (Shot 12), lying flat so the top-down lens reads it
    this.sheepCanvas = document.createElement("canvas"); this.sheepCanvas.width = 512; this.sheepCanvas.height = 256;
    this.sheepTex = new THREE.CanvasTexture(this.sheepCanvas); this.sheepTex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: this.sheepTex, transparent: true, alphaTest: 0.5 }));
    card.rotation.set(-Math.PI / 2, 0, Math.PI); // faces up, text upright for a lens whose screen-up is +z
    this.sheepCard.add(card);
    for (const [dx, dz, r] of [[0.0, 0.26, 0.035], [0.0, 0.36, 0.024]] as V3[]) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#fff6e4" }));
      dot.position.set(dx, 0, dz); this.sheepCard.add(dot);
    }
    noink(this.sheepCard);
    this.sheepCard.position.set(0.02, 1.32, 0.5);
    b.add(this.sheepCard);
  }

  private alarmTex(time: string, ampm: string) {
    return textTex("alarm_" + time + ampm, 256, 128, "#101418", (g) => {
      g.fillStyle = "#ff5a4c"; g.font = "700 84px DejaVu Sans Mono, monospace"; g.fillText(time, 110, 68);
      g.font = "700 30px DejaVu Sans Mono, monospace"; g.fillText(ampm, 224, 92);
    });
  }

  private drawSheep(n: number) {
    if (n === this.sheepShown) return;
    this.sheepShown = n;
    const g = this.sheepCanvas.getContext("2d")!;
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = "#fff6e4"; g.strokeStyle = INKC; g.lineWidth = 12;
    g.beginPath(); g.roundRect(10, 10, 492, 236, 70); g.fill(); g.stroke();
    g.fillStyle = INKC; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 56px Inter, sans-serif"; g.fillText("SHEEP COUNTED", 256, 82);
    g.font = "900 92px Inter, sans-serif"; g.fillStyle = "#3f7fd6"; g.fillText(n.toLocaleString("en-US"), 256, 172);
    this.sheepTex.needsUpdate = true;
  }

  // ---- 3. STUDY (Shot 4 chess, Shot 5 blackboard) ----
  private buildStudy() {
    const s = this.sets.study;
    s.add(box(10, 0.1, 10, tex("study_floor", rep(woodFloor("study", "#b9814f", "rgba(70,40,20,0.55)"), 5, 5)), 0, -0.05, 0));
    const wallM = col("study_wall", "#e3cfa8");
    s.add(box(10, 6, 0.2, wallM, 0, 3, 2.1, false), box(0.2, 6, 10, wallM, 3.4, 3, 0, false), box(0.2, 6, 10, wallM, -3.4, 3, 0, false));
    s.add(box(10, 1.0, 0.05, col("study_dado", "#8e5f3d"), 0, 0.5, 1.98, false));
    for (const sx of [1.75, -2.25]) {
      s.add(box(1.0, 3.2, 0.36, col("shelf", "#6b4630"), sx, 1.6, 1.82));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 3.1).rotateY(Math.PI), tex("shelf_books", bookShelfTex()));
      f.position.set(sx, 1.6, 1.635); f.receiveShadow = true; s.add(f);
    }
    // portrait blackboard: lam frame + unlit board + chalk lines revealed by a left-to-right wipe
    s.add(box(1.86, 2.26, 0.07, col("board_frame", "#8a5a3c"), -0.25, 1.85, 1.97), box(1.86, 0.05, 0.12, col("board_frame", "#8a5a3c"), -0.25, 0.74, 1.92));
    const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: BOARD }));
    boardFace.position.set(-0.25, 1.85, 1.932); s.add(boardFace);
    const title = face(1.56, 0.195, chalkLine("title", "UNSOLVED SINCE 1723:", 66, "#ffe36e", "900 58px Inter, sans-serif"), -0.25, 2.72, 1.928);
    s.add(title);
    const lines: [string, number, number, number, string?][] = [
      ["ζ(s) = Σ 1/nˢ = Π (1 − p⁻ˢ)⁻¹", 512, 530, 62],
      ["∫₀^∞ xˢ⁻¹/(eˣ − 1) dx = Γ(s)·ζ(s)", 530, 548, 58],
      ["let s = ½ + it,  t ∈ ℝ", 548, 566, 62],
      ["⇒ |ξ(s)|² ≥ 0 ,  ∀ n > 2", 566, 584, 62],
      ["∴ Re(s) = ½   (obviously)", 604, 611, 62],
      ["... carry the 1 ...", 610, 615, 62],
      ["Q.E.D.  ✓", 614, 620, 104, "#9be38a"],
    ];
    lines.forEach(([text, a, b2, size, colr], i) => {
      const t = chalkLine("l" + i, text, size, colr ?? "#f3f1e6");
      const w = 1.56, m = face(w, 0.195, t, -0.25, 2.42 - i * 0.235 - (i === 6 ? 0.06 : 0), 1.928);
      this.boardLines.push({ m, t, x: -0.25, w, a, b: b2 });
      s.add(m);
    });
    s.add(box(0.12, 0.03, 0.04, col("chalk", "#fbf7ec"), 0.2, 0.78, 1.9), box(0.2, 0.06, 0.08, col("eraser", "#6b4630"), -0.6, 0.795, 1.9));
    // chalk-dust burst for the sneeze
    this.dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: "#fdfbf2", transparent: true, opacity: 0.85 }), 26);
    this.dust.layers.set(NOINK); this.dust.frustumCulled = false; s.add(this.dust);

    // chess table, stools, board and pieces (hidden in Shot 5)
    const C = this.chessSet;
    C.add(box(0.66, 0.04, 0.66, col("chess_table", "#6b4630"), 0, 0.74, 0), cyl(0.05, 0.08, 0.72, col("chess_table", "#6b4630"), 0, 0.36, 0), cyl(0.26, 0.28, 0.04, col("chess_table", "#6b4630"), 0, 0.02, 0));
    for (const sx of [0.55, -0.55]) C.add(cyl(0.19, 0.17, 0.06, col("stool", "#c0353a"), sx, 0.45, 0.02), cyl(0.04, 0.05, 0.42, col("stool_leg", "#3a3f4a"), sx, 0.21, 0.02));
    const brd = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.016, 0.46), [col("chess_edge", "#4d3222"), col("chess_edge", "#4d3222"), tex("chess", chessTex()), col("chess_edge", "#4d3222"), col("chess_edge", "#4d3222"), col("chess_edge", "#4d3222")]);
    brd.position.set(0, 0.768, 0); brd.receiveShadow = true; C.add(brd);
    const white = col("piece_w", "#fbf3df"), black = col("piece_b", "#33303c");
    const SQ = 0.0575, sqPos = (i: number, j: number): V3 => [(i - 3.5) * SQ, 0.776, (j - 3.5) * SQ];
    const piece = (mat: THREE.Material, i: number, j: number, h: number, kind: "pawn" | "queen" | "king" | "rook") => {
      const g = new THREE.Group();
      g.add(cyl(0.012, 0.021, h, mat, 0, h / 2, 0, 12));
      if (kind === "rook") g.add(cyl(0.02, 0.02, 0.016, mat, 0, h, 0, 12));
      else g.add(ball(kind === "pawn" ? 0.015 : 0.017, mat, 0, h + 0.008, 0));
      if (kind === "king") g.add(box(0.008, 0.03, 0.008, mat, 0, h + 0.035, 0), box(0.022, 0.008, 0.008, mat, 0, h + 0.038, 0));
      if (kind === "queen") g.add(cyl(0.02, 0.012, 0.012, mat, 0, h - 0.002, 0, 10));
      const home = sqPos(i, j);
      g.position.set(...home);
      C.add(g);
      return { m: g, home } as Piece;
    };
    // white (Milo, +x side) and black (grandmaster, -x side)
    piece(white, 7, 4, 0.062, "king"); piece(white, 7, 0, 0.044, "rook"); piece(white, 6, 2, 0.034, "pawn"); piece(white, 6, 5, 0.034, "pawn"); piece(white, 5, 6, 0.034, "pawn");
    this.queen = piece(white, 6, 3, 0.056, "queen");
    this.victims = [piece(black, 4, 5, 0.034, "pawn"), piece(black, 2, 3, 0.044, "rook"), piece(black, 3, 6, 0.034, "pawn"), piece(black, 1, 5, 0.034, "pawn")];
    this.king = piece(black, 0, 4, 0.062, "king");
    piece(black, 1, 2, 0.034, "pawn"); piece(black, 0, 7, 0.044, "rook"); piece(black, 1, 0, 0.034, "pawn");
    C.add(box(0.14, 0.07, 0.06, col("chess_clock", "#2b2d36"), 0, 0.795, 0.28));
    s.add(C);
    this.gm = new HeroRig25D(s, { jacket: "#6a4a8c", tie: "#e8c45a", hair: "#c9c9cf" });
  }

  // ---- 4. OFFICE (Shot 6 greeting, Shot 7 meeting) ----
  private buildOffice() {
    const o = this.sets.office;
    o.add(box(10, 0.1, 10, tex("off_floor", rep(checker("off", "#8793a8", "#7e8a9f"), 10, 10)), 0, -0.05, 0));
    const wallM = col("off_wall", "#dbe4ea");
    o.add(box(10, 6, 0.2, wallM, 0, 3, 2.5, false), box(0.2, 6, 10, wallM, 3.6, 3, 0, false), box(0.2, 6, 10, wallM, -3.6, 3, 0, false));
    o.add(box(10, 0.14, 0.06, col("off_skirt", "#9aa7b5"), 0, 0.07, 2.38, false));
    // desk + props
    const wood = col("off_desk", "#a06a3f"), woodD = col("off_desk_d", "#855532");
    o.add(box(2.1, 0.06, 0.92, wood, 0.25, 0.75, 0), box(0.06, 0.72, 0.86, woodD, 1.24, 0.36, 0), box(0.06, 0.72, 0.86, woodD, -0.74, 0.36, 0), box(1.96, 0.5, 0.04, woodD, 0.25, 0.47, -0.4));
    const mon = new THREE.Group(); mon.position.set(1.0, 0.78, 0.12); mon.rotation.y = -0.5;
    this.monitorGlow = glow(0.75, 0.9, 1.05);
    const scr = box(0.5, 0.3, 0.012, this.monitorGlow, 0, 0.3, 0.02, false); scr.layers.set(NOINK);
    mon.add(box(0.56, 0.36, 0.035, col("monitor", "#2b2d36"), 0, 0.3, 0), scr, box(0.06, 0.14, 0.04, col("monitor", "#2b2d36"), 0, 0.08, -0.01), box(0.24, 0.02, 0.16, col("monitor", "#2b2d36"), 0, 0.01, 0));
    o.add(mon);
    o.add(box(0.4, 0.02, 0.14, col("keyboard", "#3a3f4a"), 0.55, 0.79, 0.18), cyl(0.045, 0.04, 0.1, col("mug_o", "#e2563b"), 0.02, 0.83, 0.1));
    o.add(box(0.26, 0.012, 0.34, col("paper", "#fbf7ec"), -0.35, 0.786, 0.05), box(0.26, 0.012, 0.34, col("paper", "#fbf7ec"), -0.32, 0.798, 0.07));
    const plate = sign(0.34, 0.1, textTex("nameplate", 512, 150, "#2b2d36", (g) => { g.fillStyle = "#f1d48a"; g.font = "900 104px Inter, sans-serif"; g.fillText("MILO", 256, 80); }), "#f1d48a", 0.55, 0.835, -0.36);
    plate.g.rotation.x = 0.25; o.add(plate.g);
    o.add(cyl(0.2, 0.18, 0.06, col("chair_seat", "#3f6b8f"), 0.55, 0.46, 0.62), box(0.44, 0.6, 0.06, col("chair_seat", "#3f6b8f"), 0.55, 0.86, 0.86), cyl(0.04, 0.04, 0.42, col("stool_leg", "#3a3f4a"), 0.55, 0.22, 0.62));
    // wall: tear-off meeting calendar, quarterly chart, clock, window blinds, door
    o.add(box(0.7, 0.9, 0.05, col("cal_back", "#c93b3b"), -1.25, 2.12, 2.38));
    this.calUnderFace = face(0.6, 0.7, dayPageTex(1), -1.25, 2.07, 2.352);
    o.add(this.calUnderFace);
    this.calTop.position.set(-1.25, 2.42, 2.346);
    this.calTopFace = face(0.6, 0.7, dayPageTex(1), 0, -0.35, 0, { side: THREE.DoubleSide });
    this.calTop.add(this.calTopFace);
    o.add(this.calTop);
    const chart = sign(1.0, 0.72, textTex("chart", 512, 368, "#fbf8ef", (g) => {
      g.fillStyle = INKC; g.font = "900 44px Inter, sans-serif"; g.fillText("Q3 SYNERGY", 256, 44);
      g.strokeStyle = "#9aa7b5"; g.lineWidth = 4; g.beginPath(); g.moveTo(50, 90); g.lineTo(50, 320); g.lineTo(480, 320); g.stroke();
      const hs = [60, 96, 82, 140, 120, 196];
      hs.forEach((h, i) => { g.fillStyle = i % 2 ? "#3f7fd6" : "#4f9c94"; g.fillRect(74 + i * 66, 320 - h, 44, h); });
      g.strokeStyle = "#d1262b"; g.lineWidth = 8; g.beginPath(); g.moveTo(70, 270); g.lineTo(200, 230); g.lineTo(300, 240); g.lineTo(460, 110); g.stroke();
    }), "#3a3f4a", 0.45, 2.1, 2.37);
    o.add(chart.g);
    this.offClockHand = this.wallClock(o, 1.55, 2.5, 2.39, 0.24, "#3a3f4a");
    const blind = this.blindTex();
    o.add(box(1.3, 1.5, 0.06, col("window_trim", "#f7f3ea"), 2.6, 1.9, 2.38), face(1.16, 1.36, blind, 2.6, 1.9, 2.345));
    o.add(box(1.0, 2.2, 0.06, col("off_door", "#b98a5a"), -2.6, 1.1, 2.38), ball(0.04, col("kit_knob", "#f1d48a"), -2.25, 1.05, 2.33));
    const pp = cyl(0.16, 0.12, 0.3, col("plant_pot", "#e2823b"), 1.9, 0.15, 1.7), pl = ball(0.34, col("plant", "#4f9a3f"), 1.9, 0.72, 1.7); pl.scale.set(0.9, 1.4, 0.9);
    o.add(pp, pl, box(0.5, 1.1, 0.5, col("filing", "#9aa7b5"), -1.9, 0.55, 1.95), box(0.3, 0.03, 0.02, col("off_skirt", "#9aa7b5"), -1.9, 0.8, 1.69), box(0.3, 0.03, 0.02, col("off_skirt", "#9aa7b5"), -1.9, 0.4, 1.69));
    this.boss = new HeroRig25D(o, { jacket: "#4a4f5c", tie: "#c93b3b", hair: "#2e241f" });
  }

  private blindTex() {
    return ctex("t100_blinds", 256, 300, (g) => {
      g.fillStyle = "#9cc8f2"; g.fillRect(0, 0, 256, 300);
      g.fillStyle = "#f4efe3"; for (let y = 0; y < 300; y += 24) g.fillRect(0, y, 256, 15);
    });
  }

  // ---- 5. STREET (Shot 8 red light, Shot 10 walk, Shot 11 statue): pavement along x, road toward the lens ----
  private buildStreet() {
    const s = this.sets.street;
    s.add(box(90, 0.2, 9, col("st_road", "#565a6b"), 8, -0.22, -5.1), box(90, 0.24, 5.2, col("st_pave", "#d2c8b5"), 8, -0.12, 2.0));
    s.add(box(90, 0.14, 0.18, col("st_curb", "#b5ad9b"), 8, -0.07, -0.6));
    for (let i = -18; i <= 22; i++) s.add(box(0.03, 0.005, 5.0, col("st_joint", "#bdb39f"), i * 2.0, 0.002, 2.0, false));
    for (let i = 0; i < 8; i++) s.add(box(2.7, 0.012, 0.52, col("st_zebra", "#f4efe3"), -0.1, -0.112, -1.3 - i * 1.0, false));
    for (let i = -12; i <= 20; i++) if (Math.abs(i * 3 + 0.1) > 2.4) s.add(box(1.5, 0.012, 0.14, col("st_zebra", "#f4efe3"), i * 3, -0.112, -5.0, false));
    // building row behind the pavement (does not cast: the low golden sun sits behind it)
    const fac = [
      { wall: "#f1c9a0", shutter: "#4f9c94" }, { wall: "#e9a48f", shutter: "#f4efe3" }, { wall: "#cfe0c8", shutter: "#8a5a3c" },
      { wall: "#f3e0a8", shutter: "#c0353a" }, { wall: "#c9d3ea", shutter: "#3f6b8f" }, { wall: "#f0b9c0", shutter: "#6a4a8c" },
      { wall: "#f1c9a0", shutter: "#3f6b8f" }, { wall: "#d6e6c0", shutter: "#c0353a" },
    ];
    const awn = ["#e2563b", "#3f7fd6", "#e8c45a", "#4f9c94"];
    fac.forEach((o, i) => {
      const w = 6, h = 8.5 + (i % 3) * 1.4, x = -15 + i * 6;
      s.add(box(w - 0.04, h, 4, col("st_bld_" + i, o.wall), x, h / 2, 6.62, false));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h).rotateY(Math.PI), tex("st_fac_" + i, facadeHD("t100_" + i, w, h, { ...o, door: true, brick: i % 4 === 2 })));
      f.position.set(x, h / 2, 4.6); f.receiveShadow = true; s.add(f);
      s.add(box(w + 0.1, 0.3, 4.2, col("st_cornice", "#8e6a55"), x, h + 0.15, 6.62, false));
      if (i % 2 === 0) { const a = box(2.6, 0.06, 1.0, col("st_awn_" + (i % 4), awn[(i / 2) % 4]), x, 2.75, 4.15); a.rotation.x = 0.35; s.add(a); }
    });
    // street furniture
    for (const lx of [-6.5, 5.5, 17.0]) {
      s.add(cyl(0.05, 0.07, 3.6, col("lamp_pole", "#3a3f4a"), lx, 1.8, 3.6), box(0.5, 0.06, 0.08, col("lamp_pole", "#3a3f4a"), lx, 3.58, 3.4));
      const l = ball(0.13, glow(1.3, 1.2, 1.0), lx, 3.46, 3.2); l.layers.set(NOINK); l.castShadow = false; s.add(l);
    }
    for (const tx of [2.9, -4.4, 12.5, 23.5]) {
      s.add(cyl(0.09, 0.12, 1.5, col("trunk", "#7a5236"), tx, 0.75, 3.3));
      const c1 = ball(0.8, col("tree", "#5fae5a"), tx, 2.2, 3.3), c2 = ball(0.55, col("tree2", "#4f9a3f"), tx + 0.45, 2.75, 3.2); c1.scale.y = 1.15;
      s.add(c1, c2, box(0.9, 0.06, 0.9, col("tree_bed", "#8a6a4a"), tx, 0.03, 3.3));
    }
    s.add(cyl(0.11, 0.13, 0.5, col("hydrant", "#d1262b"), -2.6, 0.25, -0.33), ball(0.11, col("hydrant", "#d1262b"), -2.6, 0.52, -0.33), box(0.36, 0.08, 0.08, col("hydrant", "#d1262b"), -2.6, 0.34, -0.33));
    s.add(box(1.5, 0.06, 0.42, col("bench", "#8a5a3c"), 1.4, 0.45, 3.9), box(1.5, 0.4, 0.05, col("bench", "#8a5a3c"), 1.4, 0.75, 4.1), box(0.06, 0.45, 0.4, col("lamp_pole", "#3a3f4a"), 0.75, 0.22, 3.9), box(0.06, 0.45, 0.4, col("lamp_pole", "#3a3f4a"), 2.05, 0.22, 3.9));
    // traffic light beside the crossing; lamps face the lens
    const dark = col("signal", "#2b2d36");
    s.add(cyl(0.06, 0.08, 3.5, dark, -0.85, 1.75, 0.95), box(0.36, 1.02, 0.26, dark, -0.85, 3.0, 0.78));
    this.lampRed = glow(3, 0.3, 0.2); this.lampAmber = glow(0.3, 0.2, 0.05); this.lampGreen = glow(0.05, 0.3, 0.12);
    [this.lampRed, this.lampAmber, this.lampGreen].forEach((m, i) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.115, 20).rotateY(Math.PI), m);
      d.position.set(-0.85, 3.32 - i * 0.32, 0.648); d.layers.set(NOINK); s.add(d);
      const hood = box(0.3, 0.03, 0.14, dark, -0.85, 3.46 - i * 0.32, 0.6); s.add(hood);
    });
    // cobweb strung between Milo and the pole (Shot 8: he has been here a while)
    this.cobweb = face(0.9, 0.9, ctex("t100_web", 256, 256, (g) => {
      g.clearRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 3;
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; g.beginPath(); g.moveTo(8, 8); g.lineTo(8 + Math.cos(a) * 250, 8 + Math.sin(a) * 250); g.stroke(); }
      for (let r = 50; r < 250; r += 44) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2, rr = r * (i % 2 ? 0.93 : 1); const x = 8 + Math.cos(a) * rr, y = 8 + Math.sin(a) * rr; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    }), -0.36, 1.75, 0.93, { transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
    this.cobweb.scale.x = -1; // fan out from the pole toward his head
    s.add(this.cobweb);
    // statue plaza (Shot 11) at x = 20
    const stone = col("stone", "#b9b4a8"), stoneD = col("stone_d", "#a39d90");
    s.add(box(1.7, 0.16, 1.7, stoneD, 20, 0.08, 0), box(1.1, 1.04, 1.1, stone, 20, 0.68, 0), box(1.3, 0.1, 1.3, stoneD, 20, 1.2, 0));
    const plaque = sign(0.8, 0.44, textTex("plaque", 512, 282, "#8c6a2e", (g) => {
      g.strokeStyle = "#f1d48a"; g.lineWidth = 8; g.strokeRect(10, 10, 492, 262);
      g.fillStyle = "#f8e3a4"; g.font = "900 110px Inter, sans-serif"; g.fillText("GENIUS", 256, 110);
      g.font = "italic 700 44px serif"; g.fillText("(still thinking)", 256, 216);
    }), "#5e4720", 20, 0.7, -0.566);
    s.add(plaque.g);
    for (const hx of [18.3, 21.7]) { const h = ball(0.55, col("hedge", "#4f9a3f"), hx, 0.4, 1.4); h.scale.set(1.3, 0.9, 1); s.add(h); }
    this.statue = new HeroRig25D(s, { jacket: "#a9adb6", hair: "#8d929c", skin: "#c3c6cd" });
    const anyS = this.statue as unknown as { bootL: THREE.Mesh; bootR: THREE.Mesh };
    anyS.bootR.material = anyS.bootL.material = new THREE.MeshBasicMaterial({ color: "#8d929c" });
    this.pigeon = new Pigeon(s);
    this.pigeon2 = new Pigeon(s);
  }

  // ---- 6. TERRACE RESTAURANT (Shot 9, night) ----
  private buildTerrace() {
    const t = this.sets.terrace;
    t.add(box(14, 0.1, 12, tex("ter_floor", rep(woodFloor("ter", "#9a6a46", "rgba(50,30,20,0.6)"), 6, 6)), 0, -0.05, 0));
    const rail = col("ter_rail", "#3a3247");
    t.add(box(14, 0.08, 0.1, rail, 0, 1.0, 1.9));
    for (let i = -8; i <= 8; i++) t.add(box(0.06, 1.0, 0.06, rail, i * 0.8, 0.5, 1.9));
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(46, 17).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: skylineTex(), transparent: true, alphaTest: 0.5 }));
    sk.position.set(0, 4.0, 22); sk.layers.set(NOINK); t.add(sk);
    const moon = ball(1.0, glow(1.9, 1.85, 1.6), 3.4, 11.5, 30); moon.layers.set(NOINK); moon.castShadow = false; t.add(moon);
    // string bulbs (HDR > 1 -> warm bloom + bokeh)
    const bulbMat = glow(2.6, 1.8, 0.85), bulbGeo = new THREE.SphereGeometry(0.06, 10, 8);
    for (let i = -6; i <= 6; i++) {
      const b = new THREE.Mesh(bulbGeo, bulbMat); b.position.set(i * 0.42, 2.72 - Math.cos(i * 0.5) * 0.16, 1.3 + (i % 2) * 0.05); b.layers.set(NOINK); t.add(b);
      const b2 = new THREE.Mesh(bulbGeo, bulbMat); b2.position.set(i * 0.6 + 0.2, 3.05 - Math.cos(i * 0.45) * 0.2, 2.6); b2.layers.set(NOINK); t.add(b2);
    }
    // table for two
    const cloth = col("ter_cloth", "#f4efe3");
    t.add(cyl(0.44, 0.44, 0.03, cloth, 0, 0.745, 0, 28), cyl(0.445, 0.47, 0.2, cloth, 0, 0.63, 0, 28), cyl(0.05, 0.07, 0.72, rail, 0, 0.36, 0), cyl(0.24, 0.26, 0.04, rail, 0, 0.02, 0));
    for (const sx of [0.52, -0.52]) {
      t.add(cyl(0.19, 0.17, 0.06, col("ter_chair", "#b5443c"), sx, 0.45, 0.05), cyl(0.04, 0.05, 0.42, rail, sx, 0.21, 0.05));
      t.add(cyl(0.11, 0.11, 0.012, col("plate", "#f3ede2"), sx * 0.52, 0.767, -0.12, 20));
      const glass = cyl(0.03, 0.012, 0.07, col("wine", "#a82a4c"), sx * 0.34, 0.86, 0.14, 12);
      t.add(glass, cyl(0.006, 0.006, 0.07, col("glass_stem", "#dfe8ee"), sx * 0.34, 0.795, 0.14, 8), cyl(0.028, 0.028, 0.006, col("glass_stem", "#dfe8ee"), sx * 0.34, 0.763, 0.14, 12));
    }
    // candle that visibly burns down while he waits for the laugh to end
    t.add(cyl(0.06, 0.07, 0.02, col("candle_dish", "#e8c45a"), 0, 0.77, 0.0, 16));
    this.wax = cyl(0.03, 0.03, 0.012, col("candle_wax", "#fbf3df"), 0, 0.784, 0.0, 16);
    this.candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 14).translate(0, 0.5, 0), col("candle_wax", "#fbf3df"));
    this.candle.position.set(0, 0.78, 0); this.candle.castShadow = true;
    this.flame = ball(0.02, glow(3.4, 2.2, 0.7)); this.flame.layers.set(NOINK); this.flame.castShadow = false;
    t.add(this.wax, this.candle, this.flame);
    // her laugh, drifting up one syllable at a time
    for (let i = 0; i < 3; i++) {
      const h = face(0.26, 0.163, haTex(), 0, 0, 0, { transparent: true, alphaTest: 0.5 });
      this.has.push(h); t.add(h);
    }
    for (const px of [-2.6, 2.7]) { const pp = cyl(0.2, 0.15, 0.4, col("plant_pot", "#e2823b"), px, 0.2, 1.5), pl = ball(0.4, col("plant_n", "#3f8a4f"), px, 0.9, 1.5); pl.scale.y = 1.5; t.add(pp, pl); }
    this.date = new HeroRig25D(t, { jacket: "#d1457c", hair: "#7a2e1e" });
  }

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

  /** Pose a rig hinged at the hips: theta = PI/2 lies flat on its back (head toward +z), 0 sits upright facing the lens.
   *  Hand / foot targets are given in WORLD space. */
  private poseHinged(rig: HeroRig25D, hip: V3, theta: number, p: Omit<RigPose, "pos" | "yaw" | "handL" | "handR" | "footL" | "footR">,
    w: { handL: V3; handR: V3; footL: V3; footR: V3 }) {
    const d = this.dummy;
    d.rotation.set(theta, Math.PI, 0);
    d.position.set(hip[0], hip[1] - 0.72 * Math.cos(theta), hip[2] - 0.72 * Math.sin(theta));
    d.updateMatrixWorld(true);
    const L = (v: V3) => d.worldToLocal(this.tmpV.set(...v)).toArray() as V3;
    rig.pose({ ...p, pos: d.position.toArray() as V3, yaw: Math.PI, handL: L(w.handL), handR: L(w.handR), footL: L(w.footL), footR: L(w.footR) });
    rig.root.rotation.set(theta, Math.PI, 0);
    rig.root.updateMatrixWorld(true);
  }

  // ---------------- per-set animation ----------------
  private poseKitchen(id: number, f: number, t: number) {
    this.kitDecor.visible = id !== 13;
    this.kitTally.visible = id === 13;
    this.cake.visible = id === 13;
    this.book.visible = id === 3;
    this.coffeeStream.visible = this.coffeeDrop.visible = id === 3;
    this.kitClockHand.rotation.z = -Math.floor(t) * (Math.PI / 30) - 0.4; // one honest tick per real second

    // toaster: glowing while it works; the toast finally jumps at TOAST_POP
    const u = f - TOAST_POP;
    const popped = id === 14 && u >= 0;
    const rise = popped ? 0.105 * (1 - Math.exp(-u / 1.5)) + 0.09 * Math.exp(-u / 5) * Math.sin(u * 0.7) : 0;
    this.toast.position.y = 0.128 + Math.max(0, rise);
    this.toasterLever.position.y = popped ? 0.08 + 0.09 * smooth(u / 2) : 0.08;
    const heat = popped ? Math.exp(-u / 6) : 1;
    const pulse = 0.85 + 0.15 * Math.sin(t * 5.0);
    this.toasterGlow.color.setRGB(0.12 + 2.5 * heat * pulse, 0.05 + 0.8 * heat * pulse, 0.03 + 0.18 * heat);

    if (id === 1 || id === 14) {
      // Milo behind the island, glaring at the toaster; drumming fingers at x100 impatience
      const drum = 0.022 * Math.abs(Math.sin(t * 19));
      const saying = id === 14 && f >= 1803 && f < 1830;
      const gotIt = popped ? smooth(u / 5) : 0;
      this.milo.pose({
        pos: [-0.05, 0, 0.62], yaw: Math.PI,
        lean: 0.1 + 0.02 * Math.sin(t * 1.3) - 0.07 * gotIt,
        headYaw: 0.38 * (1 - gotIt), headPitch: 0.3 - 0.36 * gotIt,
        expr: popped ? (u > 14 ? "smile" : "shock") : "stern",
        mouthOpen: saying ? 0.3 + 0.5 * Math.abs(Math.sin((f - 1803) * 0.42)) : 0,
        blink: popped ? 0 : blinkAt(f, 38),
        handL: [-0.24, 0.965, 0.38], handR: [0.24, 0.965 + drum, 0.38],
      });
    } else if (id === 3) {
      // riffles through an entire book while the coffee stream creeps one finger-width out of the spout
      const p = smooth((f - 300) / (BOOK_SHUT - 300));
      const shut = f >= BOOK_SHUT;
      this.milo.pose({
        pos: [0.1, 0, 0.62], yaw: Math.PI, lean: 0.06,
        headPitch: shut ? 0.0 : 0.3, headYaw: shut ? -0.25 * smooth((f - BOOK_SHUT - 2) / 6) : 0.06 * Math.sin(t * 9),
        expr: shut ? "grin" : f < 300 ? "smile" : "neutral",
        handL: [-0.17, 1.1, 0.33], handR: [0.17, 1.1 + (shut ? 0 : 0.012 * Math.sin(t * 40)), 0.33],
      });
      this.book.position.set(0.1, 1.115, 0.27);
      this.book.rotation.set(-0.6, 0, 0);
      this.bookOpen.visible = !shut; this.bookShut.visible = shut;
      const hl = 0.004 + 0.05 * p, hr = 0.054 - 0.05 * p;
      this.bookL.scale.y = hr; this.bookL.position.y = hr / 2;   // world -x half = his right = unread pile
      this.bookR.scale.y = hl; this.bookR.position.y = hl / 2;
      this.bookPages.forEach((pg, i) => {
        const a = ((t * 21 + i * 0.25) % 1) * Math.PI;
        pg.visible = f >= 300 && !shut;
        pg.position.set(0, 0.058, 0);
        pg.rotation.z = Math.PI - a; // sweeps from the unread side over to the read side
      });
      const len = 0.012 + 0.085 * smooth((f - 262) / 150);
      this.coffeeStream.scale.y = len;
      this.coffeeDrop.position.set(0, 0.285 - len - 0.006, -0.06);
      this.sparks.update(this.milo, t, shut ? 0.5 : smooth((f - 296) / 8));
    } else if (id === 13) {
      // 80th birthday, 8,000 felt years of tally marks behind him
      this.cakeFlames.forEach((fl, i) => fl.scale.set(1, 1.5 + 0.35 * Math.sin(t * 13 + i * 2.2), 1));
      this.oldMilo.pose({
        pos: [0, 0, 0.62], yaw: Math.PI, lean: 0.08, expr: "stern",
        headPitch: 0.08 + 0.02 * Math.sin(t * 0.9), blink: blinkAt(f, 52),
        handL: [-0.3, 0.965, 0.36], handR: [0.3, 0.965, 0.36],
      });
    }
  }

  private poseBedroom(id: number, f: number, t: number) {
    const night = id === 12;
    this.bedWall.color.set(night ? "#8f9ed0" : "#bcd3e6");
    this.bedWindow.color.set(night ? "#16264a" : "#9cc8f2");
    this.bedMoon.visible = night;
    this.sheepCard.visible = night;
    this.lampGlow.color.setRGB(0.2, 0.18, 0.14);
    const hip: V3 = [0.15, 0.72, 0.75];
    const feet = { footL: [0.27, 0.66, 0.1] as V3, footR: [0.03, 0.66, 0.1] as V3 };
    const af = this.alarmFace.material as THREE.MeshBasicMaterial;
    if (!night) {
      // alarm rattles at 7:00; at SIT_UP he jack-knifes upright, wide awake and already bored of waking up
      const ring = f < SIT_UP + 6 ? 1 : Math.exp(-(f - SIT_UP - 6) / 8);
      this.alarm.rotation.set(0.25, 0.5, 0.09 * ring * Math.sin(f * 2.6));
      this.alarm.scale.setScalar(1.25);
      af.map = this.alarmTex("7:00", "AM"); af.color.setRGB(1.5, 1.5, 1.5);
      const u = (f - SIT_UP) / 6;
      const k = u < 0 ? 0 : u < 1 ? smooth(u) : 1 + 0.1 * Math.exp(-(f - SIT_UP - 6) / 5) * Math.sin((f - SIT_UP - 6) * 0.8);
      const theta = (Math.PI / 2) * (1 - k) + 0.04;
      const up = clamp01(k);
      this.poseHinged(this.milo, hip, theta, {
        expr: f < SIT_UP ? "neutral" : f < 214 ? "shock" : "smile",
        blink: f < SIT_UP ? 1 : blinkAt(f, 30),
        headPitch: -0.12 * (1 - up), headYaw: up * (0.35 - 0.2 * smooth((f - 200) / 14)),
        mouthOpen: f >= SIT_UP && f < 168 ? 0.7 : 0,
      }, {
        handL: lerp3([0.5, 0.93, 0.62], [0.5, 0.93, 0.45], up), handR: lerp3([-0.2, 0.93, 0.62], [-0.2, 0.93, 0.45], up), ...feet,
      });
      this.sparks.update(this.milo, t, smooth((f - 160) / 12));
    } else {
      // flat on his back, eyes like saucers, counting sheep at x100
      this.alarm.rotation.set(1.15, 0, 0);
      this.alarm.scale.setScalar(1.2);
      const mins = Math.min(7, Math.floor((f - 1441) / 19));
      af.map = this.alarmTex("11:0" + mins, "PM"); af.color.setRGB(2.4, 2.4, 2.4);
      this.drawSheep(480000 + (f - 1441) * 137);
      this.sheepCard.position.y = 1.32 + 0.02 * Math.sin(t * 1.7);
      const toss = 0.06 * Math.sin(t * 0.9);
      this.poseHinged(this.milo, hip, Math.PI / 2, {
        expr: "shock", blink: blinkAt(f, 34), headYaw: toss, headPitch: -0.1,
      }, {
        handL: [0.5, 0.93, 0.62 + 0.02 * Math.sin(t * 17)], handR: [-0.2, 0.93, 0.62], ...feet,
      });
      this.sparks.update(this.milo, t, 0);
    }
  }

  private poseStudy(id: number, f: number, t: number) {
    this.chessSet.visible = id === 4;
    this.dust.visible = false;
    // chalk lines: wipe from the left of each line (texture repeat + plane scale stay in step)
    for (const L of this.boardLines) {
      const k = id === 5 ? clamp01((f - L.a) / (L.b - L.a)) : 0;
      L.m.visible = k > 0.001;
      L.m.scale.x = Math.max(k, 0.001);
      L.m.position.x = L.x + ((1 - k) * L.w) / 2;
      L.t.repeat.set(Math.max(k, 0.001), 1);
    }
    if (id === 4) {
      // four moves in four seconds: the white queen hops down the board, each hop removing a black piece
      const q = this.queen;
      let pos = q.home;
      CHESS_MOVES.forEach((m, i) => {
        const v = this.victims[i];
        if (f >= m) pos = lerp3(i ? this.victims[i - 1].home : q.home, v.home, smooth((f - m) / 3));
        v.m.scale.setScalar(1 - smooth((f - m - 1) / 3));
        v.m.visible = f < m + 4;
      });
      const hop = CHESS_MOVES.reduce((a, m) => Math.max(a, f >= m && f < m + 3 ? Math.sin(((f - m) / 3) * Math.PI) : 0), 0);
      q.m.position.set(pos[0], pos[1] + 0.035 * hop, pos[2]);
      const fall = f - KING_FALLS;
      this.king.m.rotation.z = fall < 0 ? 0 : -(Math.PI / 2) * Math.min(1, (fall / 5) ** 2) + (fall >= 5 ? 0.12 * Math.exp(-(fall - 5) / 3) * Math.abs(Math.sin((fall - 5) * 0.9)) : 0);

      const mPos: V3 = [0.55, -0.22, 0.02], mYaw = Math.PI + 0.75;
      const playing = f >= CHESS_MOVES[0] - 4 && f < KING_FALLS;
      const bored = smooth((f - 458) / 10);
      const rest = toLocal(mPos, mYaw, [0.26, 0.8, -0.06]);
      const grab = toLocal(mPos, mYaw, [q.m.position.x, q.m.position.y + 0.09, q.m.position.z]);
      const chin: V3 = [0.1, 1.2, 0.2];
      const yawn = f >= 464 && f < 496 ? Math.sin(((f - 464) / 32) * Math.PI) : 0;
      this.milo.pose({
        pos: mPos, yaw: mYaw, lean: 0.12 - 0.06 * bored,
        headYaw: -0.3 - 0.35 * bored, headPitch: 0.22 * (1 - bored) - 0.12 * yawn,
        expr: bored > 0.5 ? "neutral" : "smile", mouthOpen: 0.95 * yawn, blink: yawn > 0.3 ? 1 : 0,
        handR: playing ? grab : lerp3(rest, chin, bored), handL: toLocal(mPos, mYaw, [0.3, 0.8, 0.12]),
        footL: [-0.1, 0.26, 0.32], footR: [0.1, 0.26, 0.32],
      });
      const gPos: V3 = [-0.55, -0.22, 0.02], gYaw = Math.PI - 0.75;
      const stunned = f >= CHESS_MOVES[1];
      this.gm.pose({
        pos: gPos, yaw: gYaw, lean: stunned ? 0.02 : 0.14,
        headYaw: 0.3, headPitch: stunned ? 0.3 : 0.2,
        expr: stunned ? "shock" : "stern", mouthOpen: f >= KING_FALLS ? 0.8 : 0,
        handL: stunned ? [-0.2, 1.42, 0.12] : toLocal(gPos, gYaw, [-0.26, 0.8, -0.06]),
        handR: stunned ? [0.2, 1.42, 0.12] : toLocal(gPos, gYaw, [-0.3, 0.8, 0.12]),
        footL: [-0.1, 0.26, 0.32], footR: [0.1, 0.26, 0.32],
      });
      this.sparks.update(this.milo, t, 1 - bored);
    } else {
      // blackboard: chalk hand tracks the line being written; the last three lines land inside one sneeze
      const mPos: V3 = [0.72, 0, 1.38], mYaw = Math.PI + 0.55;
      let hand: V3 = [0.3, 1.5, 1.86];
      this.boardLines.forEach((L, i) => {
        if (f >= L.a) { const k = clamp01((f - L.a) / (L.b - L.a)); hand = [L.x + L.w / 2 - k * L.w * 0.75, L.m.position.y + 0.02 * Math.sin(f * 2.3), 1.88]; }
      });
      hand[0] = Math.max(-0.15, Math.min(hand[0], 0.5));
      const inhale = smooth((f - 600) / 10) * (f < SNEEZE ? 1 : 0);
      const u = f - SNEEZE;
      const snap = u >= 0 ? Math.exp(-u / 5) : 0;
      const done = smooth((u - 8) / 8);
      this.milo.pose({
        pos: mPos, yaw: mYaw, lean: -0.1 * inhale + 0.3 * snap,
        headYaw: 0.35 * (1 - done) - 0.3 * done, headPitch: -0.35 * inhale + 0.45 * snap,
        expr: u >= 0 && u < 6 ? "pained" : done > 0.5 ? "grin" : inhale > 0.3 ? "shock" : "neutral",
        mouthOpen: inhale > 0.3 ? 0.7 : 0,
        handR: toLocal(mPos, mYaw, hand), handL: inhale > 0.3 || snap > 0.3 ? [-0.1, 1.3, 0.24] : undefined,
      });
      if (u >= 0 && u < 26) {
        this.dust.visible = true;
        this.milo.headPivot.getWorldPosition(this.tmpV);
        for (let i = 0; i < 26; i++) {
          const a = hash(i * 3.1) * 1.6 - 0.8, sp = 0.5 + hash(i * 7.7) * 1.3, age = u / FPS;
          const d = sp * age * (1 - 0.9 * age);
          this.m4.makeScale(1 + u * 0.09, 1 + u * 0.09, 1 + u * 0.09);
          this.m4.setPosition(this.tmpV.x - 0.25 - d * (0.5 + 0.4 * Math.cos(a)), this.tmpV.y + 0.08 + d * Math.sin(a) * 0.8 - 0.1 * age, this.tmpV.z - 0.3 - d * 0.9 * hash(i * 1.9));
          this.dust.setMatrixAt(i, this.m4);
        }
        this.dust.instanceMatrix.needsUpdate = true;
        (this.dust.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - u / 26);
      }
      this.sparks.update(this.milo, t, 1 - done);
    }
  }

  private poseOffice(id: number, f: number, t: number) {
    this.offClockHand.rotation.z = -Math.floor(t) * (Math.PI / 30) + 0.9;
    this.monitorGlow.color.setRGB(0.75 + 0.04 * Math.sin(t * 3), 0.9, 1.05);
    // tear-off calendar
    let done = 0, flipK = 0;
    for (const m of DAY_FLIPS) { if (f >= m + 7) done++; else if (f >= m) flipK = (f - m) / 7; }
    const day = id === 7 ? 1 + done : 1;
    (this.calTopFace.material as THREE.MeshBasicMaterial).map = dayPageTex(day);
    (this.calUnderFace.material as THREE.MeshBasicMaterial).map = dayPageTex(flipK > 0 ? day + 1 : day);
    this.calTop.rotation.x = id === 7 ? smooth(flipK) * 2.7 : 0;

    const mPos: V3 = [0.55, -0.2, 0.62];
    const seat = { footL: [-0.1, 0.24, 0.3] as V3, footR: [0.1, 0.24, 0.3] as V3 };
    if (id === 6) {
      // boss ambles in at a perfectly normal pace and says three words; Milo ages visibly
      const arrive = smooth((f - 642) / 76);
      const bx = -2.35 + 1.8 * arrive;
      const walking = f < 718;
      const ph = ((f - 642) / FPS) / 1.05;
      const w = walkPose(walking ? ph : 0.0, 0.17);
      const settle = smooth((f - 712) / 12);
      const bYaw = Math.PI - 0.95 + 0.5 * settle;
      const wave = smooth((f - BOSS_SPEAKS + 6) / 16) * (1 - smooth((f - 812) / 14));
      const mo = bossMouth(f);
      this.boss.pose({
        pos: [bx, walking ? w.bob : 0, 0.95], yaw: bYaw, lean: 0.04,
        headYaw: -0.25 * settle, expr: f >= BOSS_SPEAKS - 8 ? "smile" : "neutral", mouthOpen: mo,
        footL: walking ? w.footL : undefined, footR: walking ? w.footR : undefined,
        handL: walking ? w.handL : undefined,
        handR: walking ? w.handR : lerp3([0.27, 0.78, 0.1], [0.36 + 0.06 * Math.sin(t * 1.6), 1.5, 0.12], wave),
      });
      const cu = f >= 826;
      const look = smooth((f - 668) / 14);
      const watch = smooth((f - 764) / 10) * (1 - smooth((f - 796) / 10));
      const type = f < 664 ? 1 : 0;
      const drum = f >= BOSS_SPEAKS ? 0.02 * Math.abs(Math.sin(t * 21)) : 0;
      this.milo.pose({
        pos: mPos, yaw: Math.PI, lean: cu ? 0.1 : 0.05,
        headYaw: cu ? 0 : 0.5 * look * (1 - watch), headPitch: cu ? 0.05 : 0.3 * watch,
        expr: f < BOSS_SPEAKS + 20 ? "neutral" : "stern", blink: blinkAt(f, cu ? 50 : 26),
        handL: lerp3([-0.18, 1.0 + 0.015 * type * Math.sin(t * 38), 0.42], [-0.06, 1.22, 0.3], watch),
        handR: [0.18, 1.0 + 0.015 * type * Math.sin(t * 38 + 1.7) + drum, 0.42], ...seat,
      });
      this.sparks.update(this.milo, t, 0.55 * type);
    } else {
      // the meeting: boss narrates a chart in slow motion, Milo melts onto the desk, the calendar runs out of days
      const melt = smooth((f - 904) / 50);
      const bPos: V3 = [-0.1, 0, 1.75], bYaw = Math.PI + 0.35;
      this.boss.pose({
        pos: bPos, yaw: bYaw, expr: "smile", headYaw: -0.3,
        mouthOpen: 0.45 + 0.4 * Math.sin(t * 1.5),
        handL: toLocal(bPos, bYaw, [0.1, 1.85 + 0.05 * Math.sin(t * 0.8), 2.25]), handR: [0.27, 0.8, 0.12],
      });
      this.milo.pose({
        pos: mPos, yaw: Math.PI, lean: 0.1 + 0.95 * melt, headPitch: 0.25 * melt, headYaw: 0.5 * melt,
        expr: melt > 0.6 ? "pained" : "stern", blink: blinkAt(f, 30),
        handL: [-0.3, 1.0, 0.5], handR: [0.3, 1.0, 0.5], ...seat,
      });
      this.sparks.update(this.milo, t, 0);
    }
  }

  private poseStreet(id: number, f: number, t: number) {
    const red = id === 8;
    this.lampRed.color.setRGB(red ? 2.3 : 0.32, red ? 0.1 : 0.05, red ? 0.07 : 0.04);
    this.lampGreen.color.setRGB(red ? 0.04 : 0.1, red ? 0.26 : 2.1, red ? 0.1 : 0.35);
    this.cobweb.visible = red;
    this.pigeon.root.visible = false;
    this.pigeon2.root.visible = false;
    if (id === 8) {
      // stuck at the kerb under a red light, foot tapping at x100
      const tap = Math.max(0, Math.sin(t * 15));
      this.milo.pose({
        pos: [0.15, 0, 0.3], yaw: Math.PI, lean: 0.04,
        headYaw: 0.42, headPitch: -0.36, expr: "stern", blink: blinkAt(f, 24),
        handL: [-0.12, 1.0, 0.2], handR: [0.12, 1.04, 0.22],
        footR: [0.12, 0.04 + 0.045 * tap, 0.12],
      });
      this.cobweb.rotation.z = 0.02 * Math.sin(t * 1.3);
      this.sparks.update(this.milo, t, 0.8);
    } else if (id === 10) {
      // the pivot: a completely ordinary walk at 1 m/s, with a mind doing laps around his own head
      const x = walkX(f);
      const ph = ((f - 1179) / FPS) / 0.88;
      const w = walkPose(ph, 0.22);
      this.milo.pose({
        pos: [x, w.bob, 0.3], yaw: -(Math.PI / 2) - 0.5, lean: 0.05,
        headYaw: -0.2, expr: "stern", blink: blinkAt(f, 28),
        mouthOpen: f >= 1271 && f < 1292 ? 0.3 + 0.4 * Math.abs(Math.sin((f - 1271) * 0.3)) : 0,
        footL: w.footL, footR: w.footR, handL: w.handL, handR: w.handR,
      });
      this.sparks.update(this.milo, t, 1 - 0.6 * smooth((f - 1296) / 20));
      // pigeons overtake him without even trying
      const px = x + 6.5 - ((f - 1292) / FPS) * 5.2;
      this.pigeon.set(px, 2.25 + 0.12 * Math.sin(t * 3), 1.3, Math.PI, t, 1);
      this.pigeon2.set(px + 1.3, 2.75 + 0.1 * Math.sin(t * 3.4 + 1), 2.0, Math.PI, t + 0.1, 1);
    } else {
      // a genius trapped inside a statue; a pigeon makes itself at home
      this.milo.root.visible = false;
      this.statue.pose({
        pos: [20, 1.25, 0], yaw: Math.PI - 0.3, lean: 0.06, headYaw: 0.2, headPitch: -0.1, expr: "stern",
        handR: [0.14, 1.34, 0.26], handL: [-0.3, 0.86, -0.12],
        footL: [-0.1, 0.04, 0.2], footR: [0.1, 0.1, -0.2],
      });
      const k = smooth((f - (PIGEON_LANDS - 26)) / 26);
      const landed = f >= PIGEON_LANDS;
      this.statue.headPivot.getWorldPosition(this.tmpV);
      const hx = this.tmpV.x, hy = this.tmpV.y + 0.48, hz = this.tmpV.z;
      const squash = landed ? 0.03 * Math.exp(-(f - PIGEON_LANDS) / 3) : 0;
      this.pigeon.set(hx + 2.6 * (1 - k), hy + 1.5 * (1 - k) ** 1.6 - squash, hz - 0.2 * (1 - k), Math.PI + 0.4, t, landed ? Math.exp(-(f - PIGEON_LANDS) / 4) : 1);
      this.sparks.update(this.statue, t, 0.9);
    }
  }

  private poseTerrace(f: number, t: number) {
    // she laughs for six real seconds; the candle keeps the felt time
    const burn = clamp01((f - 1039) / 140);
    const h = 0.26 - 0.2 * burn;
    this.candle.scale.y = h;
    this.wax.scale.set(1 + 1.6 * burn, 1, 1 + 1.6 * burn);
    const fl = 1 + 0.25 * Math.sin(t * 17) + 0.12 * Math.sin(t * 29);
    this.flame.position.set(0.004 * Math.sin(t * 9), 0.78 + h + 0.03, 0);
    this.flame.scale.set(1, 1.9 * fl, 1);
    const dPos: V3 = [-0.52, -0.22, 0.05], dYaw = Math.PI - 0.6;
    const lw = 0.5 + 0.5 * Math.sin(t * 2.4);
    this.date.pose({
      pos: [dPos[0], dPos[1] + 0.012 * lw, dPos[2]], yaw: dYaw, lean: -0.06 - 0.06 * lw,
      headYaw: 0.25, headPitch: -0.22 - 0.1 * lw, expr: "laugh", mouthOpen: 0.55 + 0.45 * lw,
      handL: [-0.12, 1.22 + 0.02 * lw, 0.22], handR: toLocal(dPos, dYaw, [-0.24, 0.8, -0.1]),
      footL: [-0.1, 0.26, 0.32], footR: [0.1, 0.26, 0.32],
    });
    this.date.headPivot.getWorldPosition(this.tmpV);
    this.has.forEach((m, i) => {
      const u = (((t - 1039 / FPS) * 0.3 + i / 3) % 1 + 1) % 1;
      m.position.set(this.tmpV.x - 0.12 + 0.1 * Math.sin(u * 5 + i * 2), this.tmpV.y + 0.42 + 0.8 * u, this.tmpV.z - 0.1 + 0.25 * i);
      m.scale.setScalar(Math.max(0.001, Math.sin(Math.PI * u) ** 0.6));
      m.rotation.z = 0.15 * Math.sin(i * 2.3 + u * 3);
    });
    const mPos: V3 = [0.52, -0.22, 0.05], mYaw = Math.PI + 0.6;
    const fade = smooth((f - 1085) / 20);
    this.milo.pose({
      pos: mPos, yaw: mYaw, lean: 0.14 + 0.06 * fade,
      headYaw: -0.3 - 0.25 * fade, headPitch: 0.06 * fade,
      expr: fade < 0.5 ? "smile" : "stern", blink: blinkAt(f, 22),
      handR: lerp3(toLocal(mPos, mYaw, [0.2, 0.8, -0.16]), [0.08, 1.2, 0.2], fade),
      handL: toLocal(mPos, mYaw, [0.26, 0.79 + 0.02 * Math.abs(Math.sin(t * 20)), 0.1]),
      footL: [-0.1, 0.26, 0.32], footR: [0.1, 0.26, 0.32],
    });
    this.sparks.update(this.milo, t, 0.5 * fade);
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;

    // 1. Toggle active set only
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    // 2. Camera & Light Rig
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0);
    if (s.id === 12) cam.up.set(0, 0, 1); // top-down bed shot: screen-up is +z (toward the headboard)
    cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = 14;
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();

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

    // 3. Pose per-shot actors & props
    this.milo.root.visible = false;
    for (const r of [this.oldMilo, this.boss, this.gm, this.date, this.statue]) r.root.visible = false;
    this.sparks.root.visible = false;

    if (s.set === "kitchen") this.poseKitchen(id, f, t);
    else if (s.set === "bedroom") this.poseBedroom(id, f, t);
    else if (s.set === "study") this.poseStudy(id, f, t);
    else if (s.set === "office") this.poseOffice(id, f, t);
    else if (s.set === "street") this.poseStreet(id, f, t);
    else this.poseTerrace(f, t);

    return focus;
  }
}
