// Modular 3D Set Registry for the Lighthouse Short: tower_ext (rock, tower, storm sea, cargo fleet, pier),
// lamp_room (lantern room with the rotating lamp, motor, hand crank and knife switch) and bridge (lead ship's
// wheelhouse, parked out in the shipping lane so the real tower is visible through its windows).
// Only the active shot's sets are visible per frame; shared twoTone materials keep draw calls low.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D } from "../core/rig25d";
import {
  FPS, SHOTS, V3, BRIDGE, LAMP, CRASH_PERIOD, CRASH_PHASE, STRIKES, SWITCH_OFF,
  BEAM_PERIOD, camAt, lampAngle, lampOn, leverK, lightningK, smooth, stormK, waveY,
} from "./story";

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
/** Deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam("lh_" + key, () => ({ color: hex }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect); never fogged */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
const noink = <T extends THREE.Object3D>(o: T) => { o.traverse((c) => c.layers.set(NOINK)); return o; };

/** World point -> a rig's local frame (rig at `pos`, turned by `yaw`) for hand / foot targets */
const toLocal = (pos: V3, yaw: number, w: V3): V3 => {
  const dx = w[0] - pos[0], dz = w[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, w[1] - pos[1], dx * s + dz * c];
};

const beamTex = () =>
  ctex("lh_beam_fade", 8, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#8a8a8a"); gr.addColorStop(0.8, "#1c1c1c"); gr.addColorStop(1, "#000000");
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  });

const glareTex = () =>
  ctex("lh_glare", 256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.18, "rgba(255,244,214,0.75)");
    gr.addColorStop(0.5, "rgba(255,226,170,0.22)");
    gr.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });

const switchSignTex = () =>
  ctex("lh_switch_sign", 384, 256, (g) => {
    g.fillStyle = "#f5efe2"; g.fillRect(0, 0, 384, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 12; g.strokeRect(8, 8, 368, 240);
    g.fillStyle = "#241726"; g.font = "bold 74px sans-serif"; g.textAlign = "center";
    g.fillText("MAIN", 192, 96);
    g.fillStyle = "#c8402f"; g.font = "bold 92px sans-serif";
    g.fillText("LIGHT", 192, 204);
  });

const complaintTex = () =>
  ctex("lh_complaint", 256, 352, (g) => {
    g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 256, 352);
    g.strokeStyle = "#241726"; g.lineWidth = 8; g.strokeRect(4, 4, 248, 344);
    g.fillStyle = "#c8402f"; g.font = "bold 34px sans-serif"; g.textAlign = "center";
    g.fillText("COMPLAINT", 128, 56);
    g.fillStyle = "#8a8170";
    for (let i = 0; i < 7; i++) g.fillRect(28, 92 + i * 34, 200 - (i % 3) * 44, 10);
  });

const questionTex = () =>
  ctex("lh_question", 128, 160, (g) => {
    g.clearRect(0, 0, 128, 160);
    g.font = "bold 150px sans-serif"; g.textAlign = "center";
    g.lineWidth = 18; g.strokeStyle = "#241726"; g.strokeText("?", 64, 134);
    g.fillStyle = "#ffe36e"; g.fillText("?", 64, 134);
  });

const chartTex = () =>
  ctex("lh_chart", 384, 256, (g) => {
    g.fillStyle = "#e8dcbc"; g.fillRect(0, 0, 384, 256);
    g.strokeStyle = "#6b4a34"; g.lineWidth = 10; g.strokeRect(5, 5, 374, 246);
    g.strokeStyle = "#7fa6c4"; g.lineWidth = 5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(20, 50 + i * 40); g.bezierCurveTo(120, 20 + i * 40, 240, 90 + i * 40, 364, 44 + i * 40); g.stroke(); }
    g.fillStyle = "#c8402f"; g.beginPath(); g.arc(280, 150, 14, 0, Math.PI * 2); g.fill();
  });

const SHIP_HULLS = ["#2f3d5c", "#5c2f33", "#2f5c4a", "#3a3f4a", "#5c4a2f", "#40305c"];
const BOX_COLS = ["#d9593b", "#3f7fbf", "#e2b23b", "#4f9a5f", "#c9c4b8", "#8f5fb5"];

/** Low-poly cargo ship, bow toward +z, waterline at y = 0. Lights use the shared HDR materials passed in. */
const makeShip = (i: number, winMat: THREE.Material, mastMat: THREE.Material) => {
  const g = new THREE.Group();
  const hull = col("hull_" + (i % SHIP_HULLS.length), SHIP_HULLS[i % SHIP_HULLS.length]);
  const white = col("ship_white", "#f1eee6"), dark = col("ship_dark", "#2a2d36");
  g.add(box(4, 2.6, 13, hull, 0, 0.7, -1));
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(2.31, 2.31, 2.6, 3), hull);
  bow.position.set(0, 0.7, 6.65); bow.castShadow = true;
  g.add(bow);
  g.add(box(4.06, 0.5, 13.04, col("hull_boot", "#8e3328"), 0, -0.35, -1));         // red boot-topping at the waterline
  g.add(box(3.3, 2.5, 3.0, white, 0, 3.25, -5.4));                                   // deck house
  g.add(box(3.7, 0.16, 3.4, dark, 0, 4.58, -5.4));                                   // wheelhouse roof
  const win = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.06), winMat);
  win.position.set(0, 3.85, -3.87); win.layers.set(NOINK);
  g.add(win);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), winMat);
    sw.position.set(sx * 1.68, 3.85, -4.9); sw.layers.set(NOINK);
    g.add(sw);
  }
  g.add(cyl(0.55, 0.62, 1.9, col("funnel_" + (i % 3), ["#c8402f", "#e2b23b", "#3f7fbf"][i % 3]), 0, 5.5, -6.2, 14));
  g.add(cyl(0.58, 0.58, 0.4, dark, 0, 6.5, -6.2, 14));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const n = 1 + Math.floor(hash(i * 7.3 + r * 3.1 + c * 1.7) * 2);
    for (let k = 0; k < n; k++) {
      const ci = Math.floor(hash(i * 3.7 + r * 5.3 + c * 2.9 + k * 9.1) * BOX_COLS.length);
      g.add(box(1.72, 1.25, 2.9, col("cont_" + ci, BOX_COLS[ci]), c ? 0.93 : -0.93, 2.63 + k * 1.27, -1.3 + r * 3.2));
    }
  }
  g.add(box(0.14, 3.2, 0.14, dark, 0, 3.6, 5.0));                                    // foremast
  const mast = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mastMat);
  mast.position.set(0, 5.3, 5.0); mast.layers.set(NOINK);
  g.add(mast);
  return g;
};

/** Jagged HDR lightning bolt between two points (hidden until its strike frame) */
const makeBolt = (a: V3, b: V3, seed: number) => {
  const g = new THREE.Group(), mat = glow(5.5, 5.5, 7.5);
  const pts: THREE.Vector3[] = [];
  const N = 9;
  for (let k = 0; k <= N; k++) {
    const u = k / N, j = k === 0 || k === N ? 0 : 1;
    pts.push(new THREE.Vector3(
      a[0] + (b[0] - a[0]) * u + j * (hash(seed + k * 1.9) - 0.5) * 6,
      a[1] + (b[1] - a[1]) * u,
      a[2] + (b[2] - a[2]) * u + j * (hash(seed + k * 4.3) - 0.5) * 4));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < N; k++) {
    const d = pts[k + 1].clone().sub(pts[k]);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 5), mat);
    m.scale.set(1, d.length(), 1);
    m.position.copy(pts[k]).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.clone().normalize());
    g.add(m);
  }
  g.visible = false;
  return noink(g);
};

/** Anchored-fleet layout for the sunrise shots: [x, z, heading] */
const ANCHORED: [number, number, number][] = [
  [-14, -48, 2.3], [-5, -70, 2.0], [-24, -84, 2.5], [9, -58, 2.2], [17, -90, 1.9], [-2, -104, 2.4],
  [-34, -114, 2.1], [23, -120, 2.3], [3, -134, 2.0], [-17, -146, 2.4], [31, -150, 2.2], [12, -38, 2.6],
];

const SEA_N = 140, SEA_SIZE = 420, SEA_CZ = -60;
const N_SPRAY = 60, N_RAIN = 360, N_PANEL = 16, N_SPARK = 16, N_SMOKE = 7;
const ROOM_R = 2.65;
const POD: V3 = [-0.9, 0, 1.6], POD_YAW = 0.585;   // knife-switch podium in the lamp room
const ROOM_LAMP: V3 = [0, 1.63, 0];
const MOTOR: V3 = [0.35, 0.25, -0.95];
const CRANK: V3 = [0.6, 0.85, 0];

export class LighthouseWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private camQ = new THREE.Quaternion();
  private flashCol = new THREE.Color("#93a8dc");
  private tmpCol = new THREE.Color();

  // exterior
  private sea: THREE.Mesh;
  private seaPos: THREE.BufferAttribute;
  private ships: THREE.Group[] = [];
  private shipWin = glow(2.4, 1.7, 0.8);
  private shipMast = glow(2.6, 2.6, 2.4);
  private towerWin = glow(1.6, 1.1, 0.5);
  private extLamp: THREE.Mesh;
  private extLampMat = glow(3.2, 2.6, 1.3);
  private extBeam: THREE.Group;
  private beamMat: THREE.MeshBasicMaterial;
  private glare: THREE.Mesh;
  private glareMat: THREE.MeshBasicMaterial;
  private bolts: THREE.Group[] = [];
  private spray: THREE.InstancedMesh;
  private sprayMat: THREE.MeshBasicMaterial;
  private rain: THREE.InstancedMesh;
  private rainMat: THREE.MeshBasicMaterial;
  private sunDisc: THREE.Mesh;
  private qMarks: THREE.Mesh[] = [];
  private anchor: THREE.Group;
  private chain: THREE.Mesh;
  private papers: THREE.Mesh[] = [];
  private mug: THREE.Mesh;

  // lamp room
  private panels: { o: THREE.Object3D; az: number }[] = [];
  private carriage = new THREE.Group();
  private lensMat = glow(1.6, 1.25, 0.6);
  private bullMat = glow(3.5, 2.9, 1.5);
  private roomBeam: THREE.Group;
  private crank = new THREE.Group();
  private motor = new THREE.Group();
  private motorLed = glow(0.2, 2.4, 0.4);
  private sparks: THREE.InstancedMesh;
  private smoke: THREE.InstancedMesh;
  private lever = new THREE.Group();
  private leverKnob: THREE.Mesh;

  // bridge
  private wheel = new THREE.Group();
  private telegraph = new THREE.Group();
  private teleKnob: THREE.Mesh;

  // cast
  private keeper: HeroRig25D;
  private captains: HeroRig25D[] = [];

  constructor() {
    const R = this.root;
    // 5-stop elevation sky shader (shared by all sets)
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

    for (const name of ["tower_ext", "lamp_room", "bridge"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    // =================== 1. TOWER EXTERIOR: sea, rock, tower, pier, fleet ===================
    const ext = this.sets.tower_ext;
    const seaMat = twoTone(new THREE.MeshPhongMaterial({ color: "#2b6f98", specular: "#8fb4d0", shininess: 50, flatShading: true }));
    const seaGeo = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_N, SEA_N).rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeo, seaMat);
    this.sea.position.set(0, 0, SEA_CZ);
    this.sea.receiveShadow = true;
    this.sea.frustumCulled = false;
    this.seaPos = seaGeo.getAttribute("position") as THREE.BufferAttribute;
    const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), col("sea_far", "#2b6f98"));
    seaFar.position.set(0, -1.3, SEA_CZ);
    ext.add(this.sea, seaFar);

    // Rock island (faceted so the ink pass draws its creases) + boulders
    const rockMat = col("rock", "#636b78"), rockDark = col("rock_dark", "#4d5562");
    const facet = (geo: THREE.BufferGeometry) => { const g2 = geo.toNonIndexed(); g2.computeVertexNormals(); return g2; };
    const island = new THREE.Mesh(facet(new THREE.CylinderGeometry(6.6, 9.6, 4.2, 9)), rockMat);
    island.position.set(0, 0.9, 0); island.castShadow = true; island.receiveShadow = true;
    ext.add(island);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + hash(k) * 0.3, r = 8.2 + hash(k * 2.7) * 3.2, s = 1.0 + hash(k * 5.1) * 1.7;
      if (Math.abs(Math.sin(a) * r) < 2.2 && Math.cos(a) < 0) continue; // keep the pier lane (-z) clear
      const b = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(s, 0)), k % 2 ? rockMat : rockDark);
      b.position.set(Math.sin(a) * r, 0.2 + hash(k * 3.3) * 0.6, Math.cos(a) * r);
      b.rotation.set(hash(k * 1.1) * 3, hash(k * 2.3) * 3, 0);
      b.scale.set(1, 0.75, 1); b.castShadow = true; b.receiveShadow = true;
      ext.add(b);
    }

    // Tower: four red/white bands tapering from r 2.3 (y 3) to r 1.55 (y 19)
    const tWhite = col("tower_white", "#f2efe6"), tRed = col("tower_red", "#c8402f"), iron = col("iron", "#3a3f4a");
    const rAt = (y: number) => 2.3 - (0.75 * (y - 3)) / 16;
    for (let k = 0; k < 4; k++) ext.add(cyl(rAt(7 + k * 4), rAt(3 + k * 4), 4, k % 2 ? tRed : tWhite, 0, 5 + k * 4, 0, 28));
    ext.add(cyl(2.4, 2.4, 0.3, iron, 0, 19.15, 0, 28));                                   // gallery deck
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.32, 0.045, 6, 36).rotateX(Math.PI / 2), iron);
    rail.position.y = 20.15;
    ext.add(rail);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ext.add(box(0.06, 0.9, 0.06, iron, Math.sin(a) * 2.32, 19.7, Math.cos(a) * 2.32));
    }
    ext.add(cyl(1.32, 1.42, 0.5, tWhite, 0, 19.55, 0, 20));                               // lantern base
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      ext.add(box(0.09, 1.5, 0.09, iron, Math.sin(a) * 1.27, 20.55, Math.cos(a) * 1.27)); // lantern mullions
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.35, 16), col("tower_roof", "#8e3328"));
    roof.position.set(0, 21.97, 0); roof.castShadow = true;
    ext.add(roof, cyl(0.16, 0.16, 0.3, iron, 0, 22.7, 0, 10), box(0.05, 0.9, 0.05, iron, 0, 23.2, 0));
    ext.add(box(1.25, 2.3, 0.2, col("door_frame", "#e6dfd0"), 0, 4.1, -2.2), box(1.0, 2.05, 0.2, col("door", "#7a3b2e"), 0, 4.02, -2.26));
    ext.add(box(0.1, 0.1, 0.08, col("brass", "#c9a24a"), 0.32, 4.0, -2.38));
    for (const [wy, wr] of [[9.2, rAt(9.2)], [14.2, rAt(14.2)]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.1), this.towerWin);
      w.position.set(0, wy, -wr - 0.02); w.layers.set(NOINK);
      ext.add(box(0.75, 1.05, 0.1, iron, 0, wy, -wr + 0.02), w);
    }
    // Landing + pier (captains queue here at sunrise)
    ext.add(box(4.6, 0.6, 3.8, col("landing", "#a9a294"), 0, 2.7, -4.0));
    ext.add(box(2.2, 0.22, 15.2, col("pier", "#9a6b42"), 0, 2.89, -13.4));
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) ext.add(box(0.24, 4.2, 0.24, col("pier_post", "#6b4a34"), sx * 0.95, 0.9, -7.2 - k * 3.3));

    // Lamp, beam, glare
    this.extLamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), this.extLampMat);
    this.extLamp.position.set(...LAMP); this.extLamp.layers.set(NOINK);
    ext.add(this.extLamp);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.86, 0.5), map: beamTex(), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const mkBeam = (len: number, rad: number) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 28, 1, true).translate(0, -len / 2, 0).rotateX(-Math.PI / 2), this.beamMat);
      m.layers.set(NOINK); m.frustumCulled = false;
      g.add(m);
      return g;
    };
    this.extBeam = mkBeam(520, 30);
    this.extBeam.position.set(...LAMP);
    ext.add(this.extBeam);
    this.glareMat = new THREE.MeshBasicMaterial({
      map: glareTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
    });
    this.glare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glareMat);
    this.glare.layers.set(NOINK); this.glare.renderOrder = 20; this.glare.frustumCulled = false;
    R.add(this.glare);

    // Fleet
    for (let i = 0; i < 12; i++) {
      const s = makeShip(i, this.shipWin, this.shipMast);
      this.ships.push(s);
      ext.add(s);
    }
    this.anchor = new THREE.Group();
    this.anchor.add(box(0.12, 0.9, 0.12, iron, 0, 0.45, 0), box(0.8, 0.14, 0.14, iron, 0, 0.07, 0), box(0.4, 0.1, 0.1, iron, 0, 0.9, 0));
    this.chain = box(0.07, 1, 0.07, iron);
    ext.add(this.anchor, this.chain);
    for (let k = 0; k < 3; k++) {
      const qm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), new THREE.MeshBasicMaterial({ map: questionTex(), transparent: true, alphaTest: 0.4, fog: false }));
      qm.layers.set(NOINK); qm.visible = false;
      this.qMarks.push(qm);
      ext.add(qm);
    }

    // Storm FX: lightning bolts, spray, rain; sunrise disc
    this.bolts.push(makeBolt([60, 110, 150], [38, 18, 170], 3.1), makeBolt([-9, 80, 8], [0, 23.6, 0], 7.7));
    ext.add(...this.bolts);
    this.sprayMat = new THREE.MeshBasicMaterial({ color: "#aebfdc" });
    this.spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6), this.sprayMat, N_SPRAY);
    this.spray.layers.set(NOINK); this.spray.frustumCulled = false;
    ext.add(this.spray);
    this.rainMat = new THREE.MeshBasicMaterial({ color: "#c9dcff", transparent: true, opacity: 0.3 });
    this.rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.6, 0.014), this.rainMat, N_RAIN);
    this.rain.layers.set(NOINK); this.rain.frustumCulled = false;
    R.add(this.rain);
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(34, 40), glow(3.4, 2.0, 0.9));
    this.sunDisc.layers.set(NOINK);
    R.add(this.sunDisc);

    // Sunrise props: complaint forms + the keeper's mug
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.275), new THREE.MeshBasicMaterial({ map: complaintTex(), side: THREE.DoubleSide }));
      p.layers.set(NOINK); p.visible = false;
      this.papers.push(p);
      ext.add(p);
    }
    this.mug = cyl(0.05, 0.045, 0.1, col("mug", "#f4f1ea"), 0, 0, 0, 14);
    ext.add(this.mug);

    // =================== 2. LAMP ROOM (origin = floor centre; sea / stuck beam = -z) ===================
    const lr = this.sets.lamp_room;
    lr.add(cyl(ROOM_R + 0.1, ROOM_R + 0.1, 0.1, col("room_floor", "#8a6a4a"), 0, -0.05, 0, 32));
    const wallMat = col("room_wall", "#e9e4d6");
    for (let k = 0; k < N_PANEL; k++) {
      const az = (k / N_PANEL) * Math.PI * 2;
      const g = new THREE.Group();
      const panel = box((2 * Math.PI * ROOM_R) / N_PANEL + 0.04, 0.85, 0.1, wallMat, 0, 0.425, 0);
      const cap = box((2 * Math.PI * ROOM_R) / N_PANEL + 0.06, 0.07, 0.16, iron, 0, 0.88, 0);
      const post = box(0.07, 1.95, 0.07, iron, (Math.PI * ROOM_R) / N_PANEL, 1.87, 0);
      g.add(panel, cap, post);
      g.position.set(Math.sin(az) * ROOM_R, 0, Math.cos(az) * ROOM_R);
      g.rotation.y = az;
      lr.add(g);
      this.panels.push({ o: g, az });
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ROOM_R, 0.07, 6, 40).rotateX(Math.PI / 2), iron);
    ring.position.y = 2.86;
    const ceilMat = twoTone(new THREE.MeshLambertMaterial({ color: "#8e3328", side: THREE.DoubleSide }));
    const ceil = new THREE.Mesh(new THREE.ConeGeometry(ROOM_R + 0.2, 1.1, 20, 1, true), ceilMat);
    ceil.position.y = 3.42;
    lr.add(ring, ceil);
    // Lamp: iron pedestal + rotating brass carriage with the glowing lens and its bullseye
    const brass = col("brass", "#c9a24a");
    lr.add(cyl(0.42, 0.52, 1.0, col("pedestal", "#3d4350"), 0, 0.5, 0, 20));
    this.carriage.position.set(0, 1.0, 0);
    this.carriage.add(cyl(0.56, 0.56, 0.12, brass, 0, 0.06, 0, 24));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.92, 22), this.lensMat);
    lens.position.y = 0.63; lens.layers.set(NOINK);
    this.carriage.add(lens);
    for (const ry of [0.2, 0.63, 1.06]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 6, 28).rotateX(Math.PI / 2), brass);
      t.position.y = ry; t.castShadow = true;
      this.carriage.add(t);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      this.carriage.add(box(0.035, 0.9, 0.035, brass, Math.sin(a) * 0.43, 0.63, Math.cos(a) * 0.43));
    }
    const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 22).rotateX(Math.PI / 2), this.bullMat);
    bull.position.set(0, 0.63, 0.43); bull.layers.set(NOINK);
    const bullRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 26), brass);
    bullRing.position.set(0, 0.63, 0.45);
    const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.47, 0.3, 18), brass);
    lampCap.position.y = 1.26;
    this.carriage.add(bull, bullRing, lampCap);
    lr.add(this.carriage);
    this.roomBeam = mkBeam(40, 3.2);
    this.roomBeam.position.set(...ROOM_LAMP);
    lr.add(this.roomBeam);
    // Hand crank on the pedestal (+x side, axis along x)
    this.crank.position.set(...CRANK);
    const crankWheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 24).rotateY(Math.PI / 2), iron);
    this.crank.add(crankWheel, box(0.03, 0.4, 0.03, iron), box(0.03, 0.03, 0.4, iron), box(0.12, 0.05, 0.05, brass, 0.07, 0.2, 0));
    lr.add(this.crank, box(0.2, 0.08, 0.08, iron, 0.5, 0.85, 0));
    // Rotation motor + drive shaft + status LED
    this.motor.position.set(...MOTOR);
    this.motor.add(box(0.56, 0.5, 0.5, col("motor", "#5b6880"), 0, 0, 0), box(0.6, 0.06, 0.54, iron, 0, 0.28, 0));
    for (let k = 0; k < 4; k++) this.motor.add(box(0.03, 0.34, 0.52, iron, -0.2 + k * 0.13, 0, 0));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.motorLed);
    led.position.set(0.29, 0.14, 0.14); led.layers.set(NOINK);
    this.motor.add(led);
    lr.add(this.motor, box(0.09, 0.09, 0.62, iron, 0.2, 0.3, -0.5));
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.11), glow(4.5, 3.4, 1.0), N_SPARK);
    this.sparks.layers.set(NOINK); this.sparks.frustumCulled = false;
    this.smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: "#6d6f78", transparent: true, opacity: 0.55, depthWrite: false }), N_SMOKE);
    this.smoke.layers.set(NOINK); this.smoke.frustumCulled = false;
    lr.add(this.sparks, this.smoke);
    // Knife-switch podium
    const pod = new THREE.Group();
    pod.position.set(...POD); pod.rotation.y = POD_YAW;
    pod.add(box(0.3, 0.92, 0.22, col("pod_wood", "#7a5234"), 0, 0.46, 0), box(0.34, 0.42, 0.07, col("pod_slate", "#3b4048"), 0, 1.02, 0.1));
    pod.add(box(0.05, 0.09, 0.05, brass, -0.05, 1.17, 0.15), box(0.05, 0.09, 0.05, brass, 0.05, 1.17, 0.15), box(0.14, 0.07, 0.07, brass, 0, 0.9, 0.15));
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.18), new THREE.MeshBasicMaterial({ map: switchSignTex() }));
    signFace.position.set(0, 0.56, 0.115); signFace.layers.set(NOINK);
    pod.add(signFace);
    this.lever.position.set(0, 0.9, 0.16);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.035).translate(0, 0.18, 0), brass);
    arm.castShadow = true;
    this.leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), col("knob_red", "#d1362b"));
    this.leverKnob.position.set(0, 0.39, 0);
    this.lever.add(arm, this.leverKnob);
    pod.add(this.lever);
    lr.add(pod);

    // =================== 3. BRIDGE (wheelhouse of the lead ship, bow toward the tower = +z) ===================
    const br = this.sets.bridge;
    br.position.set(...BRIDGE);
    const brWall = col("bridge_wall", "#d9d2c0"), brTrim = col("bridge_trim", "#4b5563");
    br.add(box(4.2, 0.1, 3.5, col("bridge_floor", "#7a5a40"), 0, -0.05, 0));
    br.add(box(4.2, 2.6, 0.1, brWall, 0, 1.3, -1.72));
    for (const sx of [-1, 1]) br.add(box(0.1, 1.0, 3.5, brWall, sx * 2.08, 0.5, 0), box(0.1, 0.14, 3.5, brTrim, sx * 2.08, 2.5, 0));
    br.add(box(3.3, 1.0, 0.55, brTrim, 0, 0.5, 1.02), box(3.4, 0.06, 0.62, col("bridge_top", "#2f3640"), 0, 1.03, 1.02));
    br.add(box(4.2, 0.12, 0.14, brTrim, 0, 1.0, 1.7), box(4.2, 0.14, 0.14, brTrim, 0, 2.5, 1.7), box(4.4, 0.1, 3.8, brTrim, 0, 2.62, 0));
    for (const px of [-2.05, -0.7, 0.7, 2.05]) br.add(box(0.1, 1.5, 0.1, brTrim, px, 1.75, 1.7));
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.74), new THREE.MeshBasicMaterial({ map: chartTex() }));
    chart.position.set(-0.55, 1.62, -1.66); chart.layers.set(NOINK);
    br.add(chart);
    this.wheel.position.set(0, 1.1, 0.66);
    this.wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.032, 8, 28), col("wheel_wood", "#8c5a38")));
    for (let k = 0; k < 4; k++) { const sp = box(0.64, 0.04, 0.04, col("wheel_wood", "#8c5a38")); sp.rotation.z = (k / 4) * Math.PI; this.wheel.add(sp); }
    br.add(this.wheel, box(0.08, 0.08, 0.2, brTrim, 0, 1.1, 0.78));
    br.add(cyl(0.07, 0.09, 1.0, brass, 0.78, 0.5, 0.42, 12));
    this.telegraph.position.set(0.78, 1.1, 0.42);
    const tHead = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 20).rotateZ(Math.PI / 2), brass);
    const tArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(0.07, 0.15, 0), iron);
    this.teleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), col("knob_red", "#d1362b"));
    this.teleKnob.position.set(0.07, 0.31, 0);
    const tLever = new THREE.Group();
    tLever.add(tArm, this.teleKnob);
    this.telegraph.add(tHead, tLever);
    this.telegraph.userData.lever = tLever;
    br.add(this.telegraph);
    // Foredeck seen through the windows
    const fHull = col("hull_0", SHIP_HULLS[0]);
    br.add(box(4.4, 0.5, 13, fHull, 0, -2.75, 8.2));
    const fBow = new THREE.Mesh(new THREE.CylinderGeometry(2.54, 2.54, 0.5, 3), fHull);
    fBow.position.set(0, -2.75, 15.97);
    br.add(fBow);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const ci = Math.floor(hash(r * 5.3 + c * 2.9) * BOX_COLS.length);
      br.add(box(1.72, 1.25, 2.9, col("cont_" + ci, BOX_COLS[ci]), c ? 0.93 : -0.93, -1.87, 4.0 + r * 3.2));
    }
    br.add(box(0.14, 3.4, 0.14, brTrim, 0, -0.8, 14.6));
    const fLight = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), this.shipMast);
    fLight.position.set(0, 1.0, 14.6); fLight.layers.set(NOINK);
    br.add(fLight);

    // =================== CAST ===================
    this.keeper = new HeroRig25D(R, { jacket: "#e8b923", tie: "#3b5c8c", hair: "#d8d8d8" });
    const hairs = ["#5b4636", "#2a2a2a", "#b0703a", "#8c8c8c"], coats = ["#27365a", "#2f4a44", "#4a2f3a", "#33405e"];
    for (let k = 0; k < 4; k++) this.captains.push(new HeroRig25D(R, { jacket: coats[k], tie: "#e8c45a", hair: hairs[k] }));
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

  /** One burst of `n` spray blobs written into instances [i0, i0+n) */
  private burst(i0: number, n: number, age: number, o: V3, seed: number, power: number, spread: number) {
    for (let j = 0; j < n; j++) {
      const h1 = hash(seed + j * 1.7), h2 = hash(seed + j * 3.3), h3 = hash(seed + j * 7.9);
      const vy = power * (0.55 + 0.45 * h2);
      const y = o[1] + vy * age - 6.5 * age * age;
      const sc = age < 0 || age > 1.7 || y < -0.6 ? 0 : (0.5 + 0.9 * h3) * (1 - 0.45 * age);
      this.v1.set(o[0] + (h1 - 0.5) * spread * (1 + 1.4 * age), y, o[2] + (h3 - 0.5) * spread * 0.6 - 1.8 * age * h2);
      this.v2.setScalar(Math.max(sc, 0.0001));
      this.m4.compose(this.v1, this.q.identity(), this.v2);
      this.spray.setMatrixAt(i0 + j, this.m4);
    }
  }

  private placeShip(i: number, x: number, z: number, heading: number, t: number, amp: number, visible = true) {
    const s = this.ships[i];
    s.visible = visible;
    if (!visible) return;
    s.position.set(x, 0.35 * waveY(x, z, t, amp), z);
    s.rotation.set(0.035 * amp * Math.sin(t * 1.1 + i * 1.7), heading, 0.05 * amp * Math.sin(t * 0.8 + i * 2.9), "YXZ");
  }

  private poseFleet(id: number, f: number, t: number, amp: number) {
    for (let i = 0; i < 12; i++) this.ships[i].visible = false;
    this.anchor.visible = false; this.chain.visible = false;
    for (const q of this.qMarks) q.visible = false;
    const E = Math.PI / 2;
    if (id === 3 && f >= 276) {
      // convoy crawling east past the rocks
      const v = (f - 280) * 0.05;
      const rows: [number, number][] = [[-20, -98], [9, -84], [-9, -66], [15, -50], [-42, -60], [-52, -92]];
      rows.forEach(([x, z], i) => this.placeShip(i, x + v, z, E, t, amp));
    } else if (id === 9) {
      // the leader swings her bow at the steady light; the rest follow in line astern
      const turn = smooth((f - 1012) / 78);
      this.placeShip(0, -7 + 4 * turn, -80 + 5 * turn, E * (1 - turn), t, amp);
      this.placeShip(1, -38 + (f - 996) * 0.04, -88, E, t, amp);
      this.placeShip(2, 22 - 8 * turn, -52, E * (1 - 0.5 * turn), t, amp);
    } else if (id === 12) {
      // twelve ships filing down the beam toward the rocks
      for (let i = 0; i < 12; i++) this.placeShip(i, (i % 2 ? 4.5 : -4.5) + (hash(i * 2.1) - 0.5) * 3, -40 - i * 17 + (f - 1354) * 0.06, 0, t, amp);
    } else if (id === 14 && f >= 1564) {
      // dead stop in the dark; anchors down
      const lay: [number, number, number][] = [[2, -100, 2.45], [21, -73, 2.2], [33, -48, 2.6], [48, -26, 2.3]];
      lay.forEach(([x, z, h], i) => this.placeShip(i, x, z, h, t, amp * 0.8));
      const s0 = this.ships[0];
      s0.updateMatrixWorld(true);
      const hawse = s0.localToWorld(this.v1.set(2.02, 1.7, 4.6));
      const fall = Math.max(0, f - 1604) / FPS;
      const ay = Math.max(-6, hawse.y - 0.6 - 9 * fall * fall);
      this.anchor.visible = f >= 1600 && ay > -5.9;
      this.anchor.position.set(hawse.x, ay - 0.9, hawse.z);
      this.chain.visible = f >= 1600;
      const len = Math.max(0.05, hawse.y - ay);
      this.chain.scale.set(1, len, 1);
      this.chain.position.set(hawse.x, hawse.y - len / 2, hawse.z);
      [1578, 1586, 1594].forEach((f0, k) => {
        const qm = this.qMarks[k], sc = smooth((f - f0) / 5) * (1 + 0.06 * Math.sin(t * 6 + k));
        qm.visible = f >= f0;
        const sp = this.ships[k].position;
        qm.position.set(sp.x, sp.y + 9.2 + 0.3 * Math.sin(t * 3 + k), sp.z);
        qm.scale.setScalar(Math.max(0.001, sc) * (1 + 0.45 * k));
        qm.quaternion.copy(this.camQ);
      });
    } else if (id >= 15) {
      ANCHORED.forEach(([x, z, h], i) => this.placeShip(i, x, z, h + 0.04 * Math.sin(t * 0.3 + i), t, amp));
    }
  }

  private poseLampRoom(id: number, f: number, t: number, cam: THREE.PerspectiveCamera, on: number) {
    // hide the wall panels on the camera's side of the room
    const camAz = Math.atan2(cam.position.x, cam.position.z);
    for (const p of this.panels) {
      let d = Math.abs(p.az - camAz) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      p.o.visible = d > 1.25;
    }
    const a = lampAngle(f);
    this.carriage.rotation.y = a;
    this.roomBeam.rotation.y = a;
    this.lensMat.color.setRGB(0.12 + 1.5 * on, 0.11 + 1.15 * on, 0.1 + 0.5 * on);
    this.bullMat.color.setRGB(0.14 + 3.4 * on, 0.13 + 2.8 * on, 0.12 + 1.4 * on);
    // motor: LED dies with the lightning strike, housing jolts when kicked (f838)
    const dead = f >= 600;
    if (dead) this.motorLed.color.setRGB(0.3, 0.03, 0.03); else this.motorLed.color.setRGB(0.2, 2.4, 0.4);
    const kn = f - 838;
    const jolt = kn >= 0 && kn < 24 ? Math.exp(-kn / 5) * Math.cos(kn * 1.3) : 0;
    this.motor.position.set(MOTOR[0] - 0.03 * jolt, MOTOR[1], MOTOR[2] - 0.07 * jolt);
    this.motor.rotation.x = -0.1 * jolt;
    // sparks: when the motor seizes (f621-655) and a few more on the kick
    for (let k = 0; k < N_SPARK; k++) {
      const f0 = k < 11 ? 621 + Math.floor(hash(k * 3.1) * 26) : 838 + (k - 11);
      const age = (f - f0) / FPS;
      const live = age >= 0 && age < 0.55;
      const dx = (hash(k * 1.3) - 0.3) * 3.2, dz = (hash(k * 5.7) - 0.5) * 2.6, vy = 2.2 + 2.4 * hash(k * 9.1);
      this.v1.set(MOTOR[0] + 0.1 + dx * age, MOTOR[1] + 0.3 + vy * age - 6 * age * age, MOTOR[2] + dz * age);
      this.v2.setScalar(live ? 1 - age : 0.0001);
      this.q.setFromEuler(new THREE.Euler(k, age * 9 + k, 0));
      this.m4.compose(this.v1, this.q, this.v2);
      this.sparks.setMatrixAt(k, this.m4);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < N_SMOKE; k++) {
      const age = (((f - 626) / FPS) * 0.55 + k / N_SMOKE) % 1;
      const live = f >= 626 + k * 6 && f < 1100;
      this.v1.set(MOTOR[0] + 0.05 + 0.18 * Math.sin(k * 2.4 + age * 4), MOTOR[1] + 0.32 + 1.5 * age, MOTOR[2] + 0.12 * Math.cos(k * 1.9 + age * 3));
      this.v2.setScalar(live ? (0.45 + 1.1 * age) * (1 - age) * 1.6 : 0.0001);
      this.m4.compose(this.v1, this.q.identity(), this.v2);
      this.smoke.setMatrixAt(k, this.m4);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    // crank + knife switch
    const crankA = f >= 795 && f < 829 ? (f - 795) * 0.42 : 0.6;
    this.crank.rotation.x = crankA;
    this.lever.rotation.x = -0.3 + 2.0 * leverK(f);

    const K = this.keeper;
    const talk = (a0: number, b0: number) => (f >= a0 && f < b0 ? 0.3 + 0.6 * Math.abs(Math.sin(t * 13)) : 0);
    const blink = Math.floor(f / 3) % 31 === 0 ? 1 : 0;
    if (id === 2 || id === 13) {
      // behind the podium, reaching over for the lever
      const pos: V3 = [POD[0] - 0.44 * Math.sin(POD_YAW), 0, POD[2] - 0.44 * Math.cos(POD_YAW)];
      this.lever.updateWorldMatrix(true, true);
      const kw = this.leverKnob.getWorldPosition(this.v1);
      const grab = id === 2 ? smooth((f - 112) / 14) : smooth((f - 1464) / 22);
      const hand = toLocal(pos, POD_YAW, [kw.x, kw.y + 0.02, kw.z - 0.02]);
      const rest: V3 = [0.26, 0.82, 0.14];
      const thrown = leverK(f);
      K.pose({
        pos, yaw: POD_YAW, lean: 0.1 + 0.12 * thrown, expr: thrown > 0.5 ? "pained" : "stern", blink,
        headPitch: 0.2 - 0.1 * thrown,
        handR: rest.map((r, k) => r + (hand[k] - r) * grab) as V3,
        handL: [-0.2, 1.0, 0.2],
      });
    } else if (id === 4) {
      // proud of his spinning lamp: polishing the brass
      const pos: V3 = [0.32, 0, 1.02], yaw = 2.2;
      const rub: V3 = [0.36 + 0.03 * Math.sin(t * 9), 1.52 + 0.07 * Math.sin(t * 7), 0.5];
      K.pose({ pos, yaw, expr: "smile", blink, headYaw: 0.25, handR: toLocal(pos, yaw, rub), handL: [-0.24, 0.84, 0.1] });
    } else if (id === 7) {
      const pos: V3 = [0.3, 0, 1.02], yaw = 2.2;
      const jump = f < 704 ? 0.12 * Math.abs(Math.sin(Math.min(1, Math.max(0, (f - 624) / 16)) * Math.PI)) : 0;
      const scratch = smooth((f - 740) / 16);
      K.pose({
        pos: [pos[0], jump, pos[2]], yaw, expr: f < 730 ? "shock" : "stern", blink: f > 730 ? blink : 0,
        headYaw: f < 704 ? 0.9 : 0.55, headPitch: f < 704 ? 0.15 : -0.05,
        handL: f < 704 ? [-0.42, 1.45, 0.12] : [-0.25, 0.8, 0.1],
        handR: f < 704 ? [0.42, 1.45, 0.12] : [0.26 - 0.1 * scratch, 0.8 + 0.85 * scratch + 0.02 * Math.sin(t * 14) * scratch, 0.12],
      });
    } else if (id === 8) {
      if (f < 832) {
        // both hands on the crank handle
        const pos: V3 = [0.66, 0, 0.74], yaw = 2.5;
        const hw: V3 = [CRANK[0] + 0.1, CRANK[1] + 0.2 * Math.cos(crankA), CRANK[2] + 0.2 * Math.sin(crankA)];
        const h = toLocal(pos, yaw, hw);
        K.pose({ pos, yaw, lean: 0.22, expr: "pained", headPitch: 0.15, handL: [h[0] - 0.04, h[1], h[2]], handR: [h[0] + 0.04, h[1], h[2]] });
      } else if (f < 856) {
        // the kick: right boot into the motor housing at f838, then hopping
        const pos: V3 = [0.74, 0, -0.2], yaw = 2.8;
        const sw = f < 838 ? smooth((f - 832) / 6) : 1 - 0.75 * smooth((f - 838) / 8);
        const hop = f >= 840 ? 0.07 * Math.abs(Math.sin((f - 840) * 0.55)) : 0;
        const tgt = toLocal(pos, yaw, [MOTOR[0] + 0.12, 0.3, MOTOR[2] + 0.36]);
        const rest: V3 = [0.12, 0.04, 0.05];
        K.pose({
          pos: [pos[0], hop, pos[2]], yaw, lean: -0.12, expr: f >= 838 ? "pained" : "stern", mouthOpen: f >= 839 ? 0.8 : 0,
          footR: rest.map((r, k) => r + (tgt[k] - r) * sw) as V3,
          handL: [-0.5, 1.15, 0.05], handR: [0.5, 1.2, 0.05],
        });
      } else if (f < 894) {
        // on his knees, begging the lamp
        const pos: V3 = [0.72, -0.4, 0.82], yaw = 2.5;
        const sh = 0.03 * Math.sin(t * 16);
        K.pose({
          pos, yaw, expr: "pained", headPitch: -0.32, mouthOpen: 0.3 + 0.2 * Math.sin(t * 9),
          handL: [-0.04, 1.42 + sh, 0.36], handR: [0.04, 1.42 + sh, 0.36],
          footL: [-0.13, 0.44, -0.34], footR: [0.13, 0.44, -0.34],
        });
      } else if (f < 961) {
        // "Come on, spin, you rusty old thing!"
        const pos: V3 = [0.55, 0, 0.85], yaw = 1.75;
        const sh = Math.sin(t * 15);
        K.pose({
          pos, yaw, expr: "stern", mouthOpen: talk(894, 958), headYaw: 0.35, lean: 0.06,
          handL: [-0.36, 1.62 + 0.07 * sh, 0.16], handR: [0.36, 1.62 - 0.07 * sh, 0.16],
        });
      } else {
        // "Nothing."
        const slump = smooth((f - 961) / 14);
        K.pose({ pos: [0.3, 0, 1.02], yaw: 2.2, lean: 0.22 * slump, headPitch: 0.3 * slump, expr: "neutral", blink: 1, handL: [-0.24, 0.66, 0.08], handR: [0.24, 0.66, 0.08] });
      }
    }
  }

  private poseBridge(f: number, t: number) {
    const C = this.captains[0];
    const pos: V3 = [BRIDGE[0], BRIDGE[1], BRIDGE[2] + 0.15];
    this.wheel.rotation.z = 0.25 * Math.sin(t * 1.4);
    const ring = smooth((f - 1165) / 5);
    (this.telegraph.userData.lever as THREE.Group).rotation.x = -0.7 + 1.5 * ring;
    const talk = f >= 1109 && f < 1193 ? 0.3 + 0.6 * Math.abs(Math.sin(t * 13)) : 0;
    if (f < 1164) {
      const pt = smooth((f - 1112) / 12);
      C.pose({
        pos, yaw: 0, expr: "grin", mouthOpen: talk, cap: true, headYaw: -0.2,
        handL: [-0.23, 1.12, 0.5],
        handR: [0.23 + 0.08 * pt, 1.12 + 0.5 * pt + 0.02 * Math.sin(t * 8), 0.5 + 0.12 * pt],
      });
    } else {
      this.telegraph.updateWorldMatrix(true, true);
      const kw = this.teleKnob.getWorldPosition(this.v1);
      const h = toLocal(pos, 0, [kw.x, kw.y, kw.z - 0.03]);
      // rig-local +x is the captain's left when he faces +z, so the telegraph (world +x) is worked with handL
      C.pose({ pos, yaw: 0, expr: "grin", mouthOpen: talk, cap: true, lean: 0.08, handR: [-0.23, 1.12, 0.5], handL: h });
    }
  }

  private poseSunrise(id: number, f: number, t: number) {
    const K = this.keeper, C = this.captains;
    const spots: V3[] = [[0, 3, -4.6], [-0.36, 3, -5.9], [0.32, 3, -7.2], [-0.22, 3, -8.5]];
    const shoutK = f >= 1850 ? 1 - smooth((f - 1895) / 9) : 0;
    C.forEach((c, k) => {
      const w = Math.sin(t * (7 + k) + k * 2.1);
      const lead = k === 0;
      c.pose({
        pos: spots[k], yaw: (k % 2 ? 0.12 : -0.1), cap: true, expr: "stern", lean: lead ? 0.04 + 0.08 * shoutK : 0.04,
        mouthOpen: lead ? shoutK * (0.35 + 0.6 * Math.abs(Math.sin(t * 13))) : 0.25 + 0.3 * Math.abs(Math.sin(t * (9 + k * 1.3) + k)),
        handR: lead && f >= 1906 ? [0.27, 0.78, 0.1] : [0.34, 1.52 + 0.09 * w, 0.2 + 0.05 * w],
        handL: lead && f < 1906 ? [-0.3, 1.2 + 0.05 * w, 0.3] : [-0.26, 0.9, 0.12],
      });
      const p = this.papers[k];
      c.handWorld("R", this.v1);
      p.visible = true;
      p.position.copy(this.v1).add(this.v2.set(0, 0.15, 0.02));
      p.rotation.set(-0.15 + 0.2 * w, 0.3 * w, 0.2 * w);
      if (lead && f >= 1906) { p.position.y -= 0.3; p.rotation.set(0.2, 0, Math.PI); }
    });
    // keeper at his door: shrug on "He did.", then the tea
    const shrug = smooth((f - 1906) / 8) * (1 - smooth((f - 1926) / 10));
    const sip = smooth((f - 1938) / 14) * (1 - smooth((f - 1966) / 14));
    const kp: V3 = [0, 3, -3.0];
    K.pose({
      pos: kp, yaw: Math.PI, expr: f >= 1975 ? "smile" : f >= 1906 ? "neutral" : "smile", blink: sip > 0.6 || Math.floor(f / 3) % 29 === 0 ? 1 : 0,
      headPitch: -0.12 * sip, headYaw: 0.1 * shrug,
      handL: [-0.3 - 0.16 * shrug, 0.82 + 0.3 * shrug, 0.14],
      handR: [0.24 - 0.2 * sip + 0.14 * shrug, 0.95 + 0.42 * sip + 0.12 * shrug, 0.2 + 0.04 * sip],
    });
    K.handWorld("R", this.v1);
    this.mug.visible = true;
    this.mug.position.copy(this.v1).add(this.v2.set(0, 0.04, -0.03));
    this.mug.rotation.set(-0.5 * sip, 0, 0);
    void id;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;
    const inRoom = s.set === "lamp_room", night = s.light !== "golden";
    const on = lampOn(f), amp = 1.15 * stormK(s.a), fl = inRoom ? 0.4 * lightningK(f) : lightningK(f);

    // 1. Active sets (the bridge shot keeps the exterior so the real tower sits beyond its windows)
    this.sets.tower_ext.visible = !inRoom;
    this.sets.lamp_room.visible = inRoom;
    this.sets.bridge.visible = s.set === "bridge";

    // 2. Camera & light rig
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    this.camQ.copy(cam.quaternion);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    // lamp room: the room is lit by its lamp, so the whole rig dims when the switch is thrown
    const dim = inRoom ? 0.1 + 0.9 * on : 1;
    const boost = 1 + 2.6 * fl;
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI * dim * boost;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI * dim * boost;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "tower_ext" && c.fov >= 44 ? 46 : 28;
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();

    const lk = dim * boost, sk = (0.2 + 0.8 * dim) * (1 + 1.2 * fl);
    TONE.uLitCol.value.set(L.lit[0] * lk, L.lit[1] * lk, L.lit[2] * lk);
    TONE.uShadeCol.value.set(L.shade[0] * sk, L.shade[1] * sk, L.shade[2] * (sk + (1 - dim) * 0.25));
    TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    const ck = (0.24 + 0.76 * dim) * (1 + 0.5 * fl);
    CHAR.uCharTint.value.set(L.charTint[0] * ck, L.charTint[1] * ck, L.charTint[2] * (ck + (1 - dim) * 0.2));
    CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

    // sky + fog: the lamp room looks out on the same storm night; lightning lifts both
    const skyLook = inRoom ? LOOK.night : K, fogL = inRoom ? LIGHTS.night : L;
    const su = this.skyMat.uniforms;
    skyLook.sky.c.forEach((hex, idx) => { untone(this.tmpCol.set(hex).lerp(this.flashCol, 0.7 * fl), su["c" + idx].value); });
    const elRad = skyLook.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(elRad[1], elRad[2], elRad[3], elRad[4]);
    this.sky.position.copy(cam.position);
    untone(this.tmpCol.set(fogL.fog).lerp(this.flashCol, 0.6 * fl), this.fog.color);
    this.fog.near = fogL.fogNear; this.fog.far = fogL.fogFar * (night && !inRoom ? 1.25 : 1);
    scene.fog = this.fog;

    // 3. Sea
    if (!inRoom) {
      const P = this.seaPos, n = P.count;
      for (let i = 0; i < n; i++) P.setY(i, waveY(P.getX(i), P.getZ(i) + SEA_CZ, t, amp));
      P.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
    }

    // 4. Lamp, beam, glare (exterior or lamp-room instance)
    const a = lampAngle(f);
    this.extBeam.rotation.y = a;
    this.extLampMat.color.setRGB(0.1 + 3.1 * on, 0.1 + 2.5 * on, 0.1 + 1.2 * on);
    this.extBeam.visible = on > 0.01; this.roomBeam.visible = on > 0.01;
    const lampPos = inRoom ? this.v3.set(...ROOM_LAMP) : this.v3.set(...LAMP);
    const dx = cam.position.x - lampPos.x, dz = cam.position.z - lampPos.z, dh = Math.hypot(dx, dz) || 1;
    const align = (Math.sin(a) * dx + Math.cos(a) * dz) / dh;
    // A spinning beam sweeping across the lens would wash the frame for 1-2 frames: thin the cone as it
    // swings toward camera and let the glare sprite carry the flash instead.
    const spin = Math.min(1, Math.abs(lampAngle(f + 1) - a) / ((Math.PI * 2) / BEAM_PERIOD));
    const thin = 1 - 0.88 * spin * smooth((align - 0.5) / 0.38);
    this.beamMat.opacity = (inRoom ? 0.16 : 0.24) * on * thin;
    const g = on * Math.max(0, align) ** 12;
    const dist = cam.position.distanceTo(lampPos);
    this.glare.visible = on > 0.01;
    this.glare.position.copy(lampPos);
    this.glare.quaternion.copy(this.camQ);
    this.glare.scale.setScalar(dist * (inRoom ? 0.16 + 0.2 * g : 0.07 + 0.2 * g));
    const gi = on * (inRoom ? 0.5 + 0.9 * g : 1.0 + 1.6 * g);
    this.glareMat.color.setRGB(1.5 * gi, 1.25 * gi, 0.8 * gi);

    // 5. Storm FX
    const tw = night ? 0.25 + 0.75 * on : 0;
    this.towerWin.color.setRGB(0.2 + 1.4 * tw, 0.24 + 0.86 * tw, 0.3 + 0.2 * tw);
    this.shipWin.color.setRGB(night ? 2.4 : 0.35, night ? 1.7 : 0.45, night ? 0.8 : 0.6);
    this.shipMast.color.setRGB(night ? 2.6 : 0.9, night ? 2.6 : 0.9, night ? 2.4 : 0.85);
    STRIKES.forEach(([f0], k) => { const nfr = f - f0; this.bolts[k].visible = nfr >= 0 && nfr < 5 && nfr !== 2; });
    const storm = f < 1670 || (id < 15);
    this.rain.visible = storm && night;
    if (this.rain.visible) {
      this.q.setFromEuler(new THREE.Euler(0.05, 0, 0.2));
      cam.getWorldDirection(this.v2);
      const roomDepth = Math.hypot(cam.position.x, cam.position.z) + ROOM_R + 0.1;
      for (let i = 0; i < N_RAIN; i++) {
        const rx = ((i * 73.1) % 18) - 9 + cam.position.x;
        const rz = ((i * 31.7) % 24) - 12 + cam.position.z;
        let ry = cam.position.y + 5.0 - ((t * 19 + i * 0.37) % 9);
        if (inRoom) {
          // only beyond the far windows: never between the lens and the room
          const depth = (rx - cam.position.x) * this.v2.x + (rz - cam.position.z) * this.v2.z;
          if (depth < roomDepth || Math.hypot(rx, rz) < ROOM_R + 0.2) ry = -80;
        } else if (s.set === "bridge" && Math.abs(rx - BRIDGE[0]) < 2.3 && Math.abs(rz - BRIDGE[2]) < 2.0) ry = -80;
        this.v1.set(rx, ry, rz);
        this.m4.compose(this.v1, this.q, this.one);
        this.rain.setMatrixAt(i, this.m4);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
    // breakers on the rock (instances 0-43) + anchor splashes (44-59)
    const sprayLum = night ? 0.5 + 1.3 * fl : 1.25;
    this.sprayMat.color.setRGB(0.62 * sprayLum, 0.7 * sprayLum, 0.86 * sprayLum);
    this.spray.visible = !inRoom && id < 15;
    if (this.spray.visible) {
      const nB = Math.floor((f - CRASH_PHASE) / CRASH_PERIOD);
      const age = (f - (nB * CRASH_PERIOD + CRASH_PHASE)) / FPS;
      this.burst(0, 44, age, [(hash(nB * 1.3) - 0.5) * 7 + 4.5, 0.4, -9.4 + hash(nB * 2.9)], nB * 17.3, 10.5, 5.5);
      const s0 = this.ships[0].position;
      this.burst(44, 16, id === 14 ? (f - 1614) / FPS : -1, [s0.x + 2.4, 0.2, s0.z + 3.4], 5.1, 6.5, 1.6);
      this.spray.instanceMatrix.needsUpdate = true;
    }
    // sunrise disc sits on the frozen sun direction
    this.sunDisc.visible = !night;
    if (!night) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 820);
      this.sunDisc.position.y = cam.position.y * 0 + 46;
      this.sunDisc.lookAt(cam.position);
    }

    // 6. Cast & props
    this.keeper.root.visible = false;
    for (const cp of this.captains) cp.root.visible = false;
    for (const p of this.papers) p.visible = false;
    this.mug.visible = false;
    if (inRoom) this.poseLampRoom(id, f, t, cam, on);
    else {
      this.poseFleet(id, f, t, amp);
      if (s.set === "bridge") this.poseBridge(f, t);
      if (id >= 15) this.poseSunrise(id, f, t);
    }
    void SWITCH_OFF;
    return focus;
  }
}
