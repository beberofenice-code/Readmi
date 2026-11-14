// Modular 3D Set Registry for the Dashcam Short: car_cabin, highway (origin-locked treadmill), driveway, office, pool.
// Only the active shot's set Group is visible per frame; shared twoTone materials keep draw calls minimal.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D } from "../core/rig25d";
import { FPS, SHOTS, camAt, highwaySpeedMps, smooth } from "./story";

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** Procedural low-poly stylised car with glowing brake-light bar, wheels, and swap-ready rear bumper */
export class ToonCar {
  root = new THREE.Group();
  brakeBar: THREE.Mesh;
  brakeMat: THREE.MeshBasicMaterial;
  bumperClean: THREE.Mesh;
  bumperCrushed: THREE.Mesh;
  wheels: THREE.Mesh[] = [];

  constructor(bodyHex: string, woodPanel = false) {
    const bodyMat = lam("car_" + bodyHex, () => ({ color: bodyHex }));
    const darkMat = lam("car_dark", () => ({ color: "#2d323d" }));
    const glassMat = lam("car_glass", () => ({ color: "#6c85b5" }));

    const lower = box(1.86, 0.56, 4.2, bodyMat, 0, 0.52, 0);
    const cabin = box(1.62, 0.52, 2.1, bodyMat, 0, 1.04, -0.15);
    const windF = box(1.52, 0.42, 0.08, glassMat, 0, 1.04, 0.90);
    const windR = box(1.52, 0.42, 0.08, glassMat, 0, 1.04, -1.20);
    this.root.add(lower, cabin, windF, windR);

    if (woodPanel) {
      const woodMat = lam("car_wood", () => ({ color: "#9c6239" }));
      this.root.add(box(1.90, 0.24, 2.8, woodMat, 0, 0.54, -0.1));
    }

    this.bumperClean = box(1.92, 0.22, 0.22, darkMat, 0, 0.34, -2.12);
    this.bumperCrushed = box(1.96, 0.24, 0.26, darkMat, 0, 0.28, -1.98);
    this.bumperCrushed.rotation.set(0.22, 0.08, -0.12);
    this.bumperCrushed.visible = false;
    this.root.add(this.bumperClean, this.bumperCrushed);

    // HDR emissive brake bar (> 1.0 triggers BloomEffect naturally)
    this.brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.06, 0.06) });
    this.brakeBar = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.12, 0.06), this.brakeMat);
    this.brakeBar.position.set(0, 0.66, -2.11);
    this.brakeBar.layers.set(NOINK);
    this.root.add(this.brakeBar);

    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    wGeo.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.92, 1.3], [0.92, 1.3], [-0.92, -1.3], [0.92, -1.3]]) {
      const w = new THREE.Mesh(wGeo, darkMat);
      w.position.set(wx, 0.32, wz);
      w.castShadow = true;
      this.wheels.push(w);
      this.root.add(w);
    }
  }

  setBraking(on: boolean) {
    this.brakeMat.color.setRGB(on ? 2.6 : 0.45, on ? 0.18 : 0.05, on ? 0.12 : 0.05);
  }

  setCrushed(crushed: boolean) {
    this.bumperClean.visible = !crushed;
    this.bumperCrushed.visible = crushed;
  }
}

/** Deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect) */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

/** Box with its local origin at one end, so it can be hinged (pedal levers, wipers) */
const lever = (w: number, h: number, d: number, mat: THREE.Material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0), mat);
  m.castShadow = true;
  return m;
};

/** Unlit readable prop: textured face plane + lam backing card (so the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3") => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, 0.025, col("sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.014;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

const makeCheckTex = () =>
  ctex("giant_check", 1024, 470, (g) => {
    g.fillStyle = "#e9f3e2"; g.fillRect(0, 0, 1024, 470);
    g.strokeStyle = "#2e6b45"; g.lineWidth = 16; g.strokeRect(12, 12, 1000, 446);
    g.fillStyle = "#2e6b45"; g.font = "bold 46px sans-serif"; g.textAlign = "left";
    g.fillText("MEGAMUTUAL INSURANCE", 48, 84);
    g.font = "bold 34px sans-serif"; g.fillStyle = "#241726";
    g.fillText("PAY TO THE ORDER OF:", 48, 172);
    g.font = "italic bold 54px serif"; g.fillText("The Guy With The Neck", 48, 236);
    g.fillStyle = "#ffffff"; g.fillRect(610, 270, 370, 108);
    g.strokeStyle = "#241726"; g.lineWidth = 6; g.strokeRect(610, 270, 370, 108);
    g.fillStyle = "#241726"; g.font = "bold 76px monospace"; g.textAlign = "center";
    g.fillText("$25,000", 795, 350);
    g.textAlign = "left"; g.font = "bold 30px sans-serif";
    g.fillText("MEMO: PAIN & SUFFERING", 48, 420);
  });

const makeInvoiceTex = (paid: boolean) =>
  ctex("invoice_" + (paid ? "paid" : "open"), 384, 512, (g) => {
    g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 384, 512);
    g.fillStyle = "#241726"; g.font = "bold 34px sans-serif"; g.textAlign = "center";
    g.fillText("INVOICE", 192, 58);
    g.font = "bold 22px sans-serif"; g.textAlign = "left";
    const rows: [string, string][] = [["Rear bumper", "$2,400"], ["Paint + labor", "$1,150"], ["Neck X-ray", "$1,850"], ["Doctor visits", "$2,300"]];
    rows.forEach(([a, b], i) => { g.fillText(a, 28, 130 + i * 52); g.textAlign = "right"; g.fillText(b, 356, 130 + i * 52); g.textAlign = "left"; });
    g.fillRect(28, 336, 328, 5);
    g.font = "bold 30px sans-serif"; g.fillText("TOTAL", 28, 386); g.textAlign = "right"; g.fillText("$7,700", 356, 386);
    if (paid) {
      g.save(); g.translate(192, 300); g.rotate(-0.32);
      g.strokeStyle = "#d1262b"; g.lineWidth = 12; g.strokeRect(-150, -62, 300, 124);
      g.fillStyle = "#d1262b"; g.font = "bold 104px sans-serif"; g.textAlign = "center"; g.fillText("PAID", 0, 38);
      g.restore();
    }
  });

const makeTicketTex = () =>
  ctex("traffic_ticket", 192, 288, (g) => {
    g.fillStyle = "#fff6c8"; g.fillRect(0, 0, 192, 288);
    g.fillStyle = "#241726"; g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.fillText("CITATION", 96, 40);
    g.fillStyle = "#8a8170";
    for (let i = 0; i < 7; i++) g.fillRect(20, 70 + i * 28, 152 - (i % 3) * 30, 7);
    g.fillStyle = "#d1262b"; g.font = "bold 22px sans-serif"; g.fillText("AT FAULT", 96, 274);
  });

const makeBillTex = () =>
  ctex("cash_bundle", 128, 64, (g) => {
    g.fillStyle = "#7fbf6a"; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = "#3f7a3a"; g.lineWidth = 6; g.strokeRect(4, 4, 120, 56);
    g.fillStyle = "#3f7a3a"; g.beginPath(); g.ellipse(64, 32, 16, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f2eadb"; g.fillRect(52, 0, 24, 64); // paper band
  });

/** Lime supercar: squashed ToonCar + rear wing */
const makeSupercar = () => {
  const c = new ToonCar("#9be33c");
  c.root.scale.set(1.06, 0.78, 1.08);
  const dark = col("car_dark", "#2d323d");
  c.root.add(box(1.8, 0.06, 0.34, dark, 0, 1.12, -1.92), box(0.08, 0.3, 0.12, dark, -0.6, 0.95, -1.92), box(0.08, 0.3, 0.12, dark, 0.6, 0.95, -1.92));
  return c;
};

/** White box truck (cab + cargo box), modelled facing +z like ToonCar; `body` can be rocked on impact */
const makeBoxTruck = () => {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const white = col("truck_white", "#eef0f2"), cab = col("truck_cab", "#3d6fb5"), dark = col("car_dark", "#2d323d");
  body.add(box(2.4, 2.6, 4.6, white, 0, 2.0, -0.6));
  body.add(box(2.42, 0.32, 4.62, col("truck_stripe", "#e2563b"), 0, 1.35, -0.6));
  body.add(box(2.2, 1.9, 1.6, cab, 0, 1.45, 2.6));
  body.add(box(1.9, 0.7, 0.06, col("car_glass", "#6c85b5"), 0, 1.85, 3.42));
  const wGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 16).rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.1, 2.4], [1.1, 2.4], [-1.1, -1.9], [1.1, -1.9]]) {
    const w = new THREE.Mesh(wGeo, dark); w.position.set(wx, 0.46, wz); w.castShadow = true; body.add(w);
  }
  return { root, body };
};

/** Police cruiser: dark ToonCar + white doors + roof light bar (red/blue HDR halves) */
const makeCruiser = () => {
  const c = new ToonCar("#1d2233");
  const white = col("cop_white", "#f1f2f4");
  c.root.add(box(1.9, 0.44, 1.7, white, 0, 0.56, 0.05));
  const red = glow(0.4, 0.04, 0.04), blue = glow(0.04, 0.08, 0.4);
  const redBar = box(0.62, 0.13, 0.26, red, -0.34, 1.37, -0.15), blueBar = box(0.62, 0.13, 0.26, blue, 0.34, 1.37, -0.15);
  redBar.layers.set(NOINK); blueBar.layers.set(NOINK);
  c.root.add(redBar, blueBar, box(1.4, 0.06, 0.3, col("car_dark", "#2d323d"), 0, 1.29, -0.15));
  return { car: c, red, blue };
};

/** Unlit crisp sign texture for Shot 7 ("DAYS SINCE DALE'S LAST NECK INJURY") */
const makeFlipSignTex = (digit: string) =>
  ctex("injury_sign_" + digit, 512, 320, (g) => {
    g.fillStyle = "#f5efe2";
    g.fillRect(0, 0, 512, 320);
    g.strokeStyle = "#241726";
    g.lineWidth = 12;
    g.strokeRect(10, 10, 492, 300);
    g.fillStyle = "#241726";
    g.font = "bold 30px sans-serif";
    g.textAlign = "center";
    g.fillText("DAYS SINCE LAST", 256, 66);
    g.fillText("NECK INJURY", 256, 104);
    g.fillStyle = "#d93b3b";
    g.fillRect(176, 128, 160, 162);
    g.fillStyle = "#ffffff";
    g.font = "bold 124px monospace";
    g.fillText(digit, 256, 252);
  });

export class MultiSetWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();

  // Dynamic set props & characters
  private scammerCar: ToonCar;
  private victimCar: ToonCar;
  private buddyTruck: ToonCar;
  private wagonCar: ToonCar;
  private roadDashes: THREE.InstancedMesh;
  private rainStreaks: THREE.InstancedMesh;
  private scammerRig: HeroRig25D;
  private quietDriverRig: HeroRig25D;
  private agentRig: HeroRig25D;
  private brakePedal: THREE.Group;
  private brakePad: THREE.Mesh;
  private cabLeadCar: ToonCar;
  // Driveway set (Shots 4, 6, 9)
  private garageDoor: THREE.Group;
  private garageInside: THREE.Group;
  private windowMat: THREE.MeshBasicMaterial;
  private lampBulb: THREE.Mesh;
  private drvRedCar: ToonCar;
  private drvVictimCar: ToonCar;
  private supercar: ToonCar;
  private truck: { root: THREE.Group; body: THREE.Group };
  private cruiser: { car: ToonCar; red: THREE.MeshBasicMaterial; blue: THREE.MeshBasicMaterial };
  private doctorRig: HeroRig25D;
  private trooperRig: HeroRig25D;
  private rearDriverRig: HeroRig25D;
  private checkSign: { g: THREE.Group; face: THREE.Mesh };
  private invoiceSign: { g: THREE.Group; face: THREE.Mesh };
  private ticket: THREE.Mesh;
  private bills: THREE.InstancedMesh;
  private cashFloor: THREE.InstancedMesh;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private wiperMesh: THREE.Mesh;
  private deskSignBoard: THREE.Mesh;
  private scrollZ = 0;
  private m4 = new THREE.Matrix4();

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

    for (const name of ["car_cabin", "highway", "driveway", "office", "pool"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    // ---- 1. CAR CABIN SET (Shots 1 & 11) ----
    // Open-sided cabin (no passenger door, so the camera can sit there), seats split into cushion / backrest /
    // headrest so the driver sits ON the seat instead of inside a solid block, real footwell with hinged pedals.
    const cab = this.sets.car_cabin;
    const dashMat = col("cab_dash", "#383c47");
    const trimMat = col("cab_trim", "#4b505c");
    const seatMat = col("cab_seat", "#6e5849");
    cab.add(box(1.8, 0.06, 2.7, col("cab_floor", "#2f323a"), 0, 0.12, 0.15));            // floor pan
    cab.add(box(0.62, 0.02, 0.8, col("cab_mat", "#9a948a"), -0.2, 0.16, 0.55));          // driver floor mat
    cab.add(box(1.72, 0.36, 0.62, dashMat, 0, 0.82, 0.96));                              // dashboard (y .64-1.0)
    cab.add(box(0.44, 0.09, 0.22, dashMat, -0.32, 1.04, 0.74));                          // instrument hood
    cab.add(box(1.72, 0.5, 0.08, trimMat, 0, 0.38, 1.24));                               // firewall
    for (const sx of [-0.32, 0.38]) {
      cab.add(box(0.56, 0.14, 0.55, seatMat, sx, 0.45, -0.1));                           // cushion (top 0.52)
      const back = box(0.54, 0.72, 0.12, seatMat, sx, 0.88, -0.45);
      back.rotation.x = -0.14;
      cab.add(back, box(0.3, 0.2, 0.1, seatMat, sx, 1.38, -0.55));                       // backrest + headrest
    }
    // Driver door + window frame (passenger side left open for the camera)
    cab.add(box(0.06, 0.62, 1.7, trimMat, -0.88, 0.62, 0.05));
    cab.add(box(0.06, 0.06, 1.5, trimMat, -0.88, 1.62, -0.02), box(0.07, 0.72, 0.08, trimMat, -0.88, 1.28, -0.78));
    // Windshield: glass + A-pillars + header, tilted back from (y 1.0, z 1.25) to (y 1.66, z 0.72)
    const wsTilt = -Math.atan2(0.53, 0.66), wsLen = Math.hypot(0.66, 0.53);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, wsLen, 0.01),
      new THREE.MeshBasicMaterial({ color: "#bcd4ee", transparent: true, opacity: 0.12, depthWrite: false }));
    glass.position.set(0, 1.33, 0.985); glass.rotation.x = wsTilt;
    cab.add(glass);
    for (const px of [-0.84, 0.84]) {
      const pillar = box(0.08, wsLen, 0.07, trimMat, px, 1.33, 0.985);
      pillar.rotation.x = wsTilt;
      cab.add(pillar);
    }
    cab.add(box(1.76, 0.07, 0.12, trimMat, 0, 1.68, 0.7));                               // windshield header
    cab.add(box(1.76, 0.05, 1.5, col("cab_headliner", "#d8d2c4"), 0, 1.71, -0.05));     // roof / headliner
    // Steering wheel + column
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 8, 30), col("cab_wheel", "#1f2128"));
    wheel.position.set(-0.32, 1.04, 0.52); wheel.rotation.x = -0.45; wheel.castShadow = true;
    const column = box(0.05, 0.05, 0.3, dashMat, -0.32, 0.98, 0.7);
    column.rotation.x = -0.45;
    cab.add(wheel, column);
    // Hinged pedals (pivot under the dash, pads down in the footwell)
    const pedalMat = col("pedal", "#b9bec7");
    this.brakePedal = new THREE.Group();
    this.brakePedal.position.set(-0.16, 0.62, 0.88);
    const bLever = lever(0.03, 0.38, 0.03, pedalMat); bLever.rotation.x = 0.36;
    const bPad = box(0.21, 0.13, 0.035, pedalMat, 0, -0.355, -0.13); bPad.rotation.x = 0.36;
    this.brakePedal.add(bLever, bPad);
    this.brakePad = bPad;
    const gasPedal = new THREE.Group();
    gasPedal.position.set(0.12, 0.62, 0.9);
    const gLever = lever(0.025, 0.36, 0.025, pedalMat); gLever.rotation.x = 0.3;
    gasPedal.add(gLever, box(0.08, 0.16, 0.025, pedalMat, 0, -0.36, -0.1));
    cab.add(this.brakePedal, gasPedal);
    // Little dashcam box taped to the windshield (Shot 11 hero prop): lens out, red REC dot facing the driver
    const camBox = box(0.16, 0.1, 0.08, col("dashcam_body", "#24262d"), -0.05, 1.43, 0.74);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16).rotateX(Math.PI / 2), col("dashcam_lens", "#0c0d10"));
    lens.position.set(-0.05, 1.43, 0.79);
    const tapeMat = col("tape", "#e9dfb8");
    const tapeA = box(0.026, 0.12, 0.006, tapeMat, -0.115, 1.43, 0.698), tapeB = box(0.026, 0.12, 0.006, tapeMat, 0.015, 1.43, 0.698);
    tapeA.rotation.z = 0.12; tapeB.rotation.z = -0.12;
    const recDot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow(1.9, 0.08, 0.06));
    recDot.position.set(-0.02, 1.455, 0.698);
    recDot.layers.set(NOINK);
    cab.add(camBox, lens, tapeA, tapeB, recDot);
    // Outside world for the windows: road + grass, and the scammer's car stopped ahead (Shot 11)
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 240), twoTone(new THREE.MeshPhongMaterial({ color: "#4b505c", specular: "#6f788a", shininess: 45 })));
    road2.rotation.x = -Math.PI / 2; road2.position.set(0.6, -0.01, 0); road2.receiveShadow = true;
    const grass2 = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), col("hwy_grass", "#6eb043"));
    grass2.rotation.x = -Math.PI / 2; grass2.position.y = -0.03; grass2.receiveShadow = true;
    cab.add(road2, grass2);
    for (let i = 0; i < 12; i++) cab.add(box(0.16, 0.01, 2.4, col("dash", "#f5e9c8"), 2.1, 0.0, -20 + i * 6));
    this.cabLeadCar = new ToonCar("#d43b3b");
    this.cabLeadCar.root.position.set(-0.15, 0, 6.6);
    this.cabLeadCar.setBraking(true);
    this.cabLeadCar.setCrushed(true);
    cab.add(this.cabLeadCar.root);
    this.quietDriverRig = new HeroRig25D(cab, { jacket: "#b8443c", hair: "#4a3628" });

    // ---- 2. HIGHWAY TREADMILL SET (Shots 2, 3, 5, 10, 12) ----
    const hwy = this.sets.highway;
    const asphaltMat = twoTone(new THREE.MeshPhongMaterial({ color: "#4b505c", specular: "#6f788a", shininess: 45 }));
    const grassMat = lam("hwy_grass", () => ({ color: "#6eb043" }));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 280), asphaltMat);
    road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
    const shoulderL = new THREE.Mesh(new THREE.PlaneGeometry(120, 280), grassMat);
    shoulderL.rotation.x = -Math.PI / 2; shoulderL.position.set(-67, -0.02, 0); shoulderL.receiveShadow = true;
    const shoulderR = shoulderL.clone(); shoulderR.position.set(67, -0.02, 0);
    hwy.add(road, shoulderL, shoulderR);

    this.roadDashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 2.6).rotateX(-Math.PI / 2), lam("dash", () => ({ color: "#f5e9c8" })), 40);
    hwy.add(this.roadDashes);

    this.scammerCar = new ToonCar("#d43b3b");
    this.victimCar = new ToonCar("#eaeef5");
    this.buddyTruck = new ToonCar("#282c38");
    this.wagonCar = new ToonCar("#5a7d9a", true);
    hwy.add(this.scammerCar.root, this.victimCar.root, this.buddyTruck.root, this.wagonCar.root);

    this.wiperMesh = box(0.03, 0.72, 0.02, dashMat, 0, 0.95, -2.15);
    hwy.add(this.wiperMesh);

    // Slanted 400-streak rain particle system on NOINK
    const rainGeo = new THREE.BoxGeometry(0.012, 0.55, 0.012);
    const rainMat = new THREE.MeshBasicMaterial({ color: "#dcebff", transparent: true, opacity: 0.42 });
    this.rainStreaks = new THREE.InstancedMesh(rainGeo, rainMat, 360);
    this.rainStreaks.layers.set(NOINK);
    R.add(this.rainStreaks);

    // ---- 3. SUBURBAN DRIVEWAY SET (Shots 4, 6, 9) ----
    // House front faces -z at z = 2.45; driveway runs to a street along x at z ~ -11.8 (cameras look +z).
    const drv = this.sets.driveway;
    drv.add(box(60, 0.1, 60, grassMat, 0, -0.05, 0));
    drv.add(box(5.2, 0.12, 10.8, col("concrete", "#cfc6b4"), 0, -0.04, -2.95));         // driveway z -8.35..2.45
    drv.add(box(60, 0.12, 7, col("street", "#55596a"), 0, -0.035, -11.85));              // street z -15.35..-8.35
    drv.add(box(60, 0.18, 0.3, col("curb", "#bdb6a6"), 0, 0.0, -15.4), box(60, 0.18, 0.3, col("curb", "#bdb6a6"), 0, 0.0, -8.3));
    for (let i = -6; i <= 6; i++) drv.add(box(2.2, 0.01, 0.16, col("dash", "#f5e9c8"), i * 4.5, 0.03, -11.85));
    // House shell around an open-able garage cavity (x -2.3..2.3, y 0..2.8, z 2.45..7.6)
    const cream = col("house_cream", "#ecdab2");
    drv.add(box(2.45, 5.2, 7.5, cream, -3.525, 2.6, 6.2), box(2.45, 5.2, 7.5, cream, 3.525, 2.6, 6.2));
    drv.add(box(4.6, 2.4, 7.5, cream, 0, 4.0, 6.2), box(4.6, 2.8, 2.35, cream, 0, 1.4, 8.775));
    const roofMat = col("roof", "#8e4a3c");
    const roofF = box(10.4, 0.2, 4.55, roofMat, 0, 6.1, 4.12); roofF.rotation.x = -0.41;
    const roofB = box(10.4, 0.2, 4.55, roofMat, 0, 6.1, 8.28); roofB.rotation.x = 0.41;
    drv.add(roofF, roofB);
    // Windows (unlit: cool glass by day, warm HDR glow at night) + front door
    this.windowMat = new THREE.MeshBasicMaterial({ color: "#86a6cf" });
    const trim = col("window_trim", "#f7f3ea");
    for (const [wx, wy, ww, wh] of [[-3.5, 1.6, 1.4, 1.1], [-3.5, 3.9, 1.4, 1.1], [3.5, 3.9, 1.4, 1.1], [0, 4.0, 1.8, 1.0]]) {
      drv.add(box(ww + 0.16, wh + 0.16, 0.06, trim, wx, wy, 2.44));
      drv.add(box(ww, wh, 0.06, this.windowMat, wx, wy, 2.41));
    }
    drv.add(box(1.0, 2.1, 0.08, col("front_door", "#3f6b8f"), 3.5, 1.05, 2.42));
    drv.add(box(0.12, 0.12, 0.05, col("knob", "#e8c45a"), 3.15, 1.05, 2.37));
    for (const bx of [-4.3, -2.75, 2.75]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), col("bush", "#4f9a3f"));
      bush.scale.set(1.2, 0.85, 0.9); bush.position.set(bx, 0.4, 1.95); bush.castShadow = true;
      drv.add(bush);
    }
    // Garage door (closed in Shots 4 & 9, rolled up in Shot 6)
    this.garageDoor = new THREE.Group();
    this.garageDoor.add(box(4.6, 2.8, 0.12, col("garage_door", "#ddd6c6"), 0, 1.4, 2.42));
    for (let k = 1; k < 4; k++) this.garageDoor.add(box(4.5, 0.04, 0.03, col("garage_groove", "#bfb6a3"), 0, k * 0.7, 2.35));
    drv.add(this.garageDoor);
    // Garage interior: warm self-lit walls, ceiling bulb, and a mountain of cash bundles (Shot 6)
    this.garageInside = new THREE.Group();
    const warm = new THREE.MeshBasicMaterial({ color: "#8a6440" }), warmDark = new THREE.MeshBasicMaterial({ color: "#5e4430" });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.8).rotateY(Math.PI), warm); backWall.position.set(0, 1.4, 7.58);
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 2.8).rotateY(Math.PI / 2), warmDark); sideL.position.set(-2.28, 1.4, 5.02);
    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 2.8).rotateY(-Math.PI / 2), warmDark); sideR.position.set(2.28, 1.4, 5.02);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.15).rotateX(Math.PI / 2), warmDark); ceil.position.set(0, 2.78, 5.02);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), glow(3.0, 2.3, 1.2)); bulb.position.set(0, 2.62, 4.4); bulb.layers.set(NOINK);
    const moundMat = new THREE.MeshBasicMaterial({ color: "#4f8f45" });
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), moundMat);
    mound.scale.set(2.15, 1.75, 2.6); mound.position.set(0, 0, 6.0);
    this.garageInside.add(backWall, sideL, sideR, ceil, bulb, mound);
    const billMat = new THREE.MeshBasicMaterial({ map: makeBillTex() });
    const bundleGeo = new THREE.BoxGeometry(0.32, 0.09, 0.16);
    const heapPts: [number, number, number, number][] = [];
    for (let gx = -2.0; gx <= 2.0; gx += 0.3) for (let gz = 3.6; gz <= 7.4; gz += 0.17) {
      const r = (gx / 2.15) ** 2 + ((gz - 6.0) / 2.6) ** 2;
      if (r < 1) heapPts.push([gx + hash(gx * 7 + gz) * 0.1, 1.75 * Math.sqrt(1 - r), gz, hash(gx * 13 - gz * 3) * Math.PI]);
    }
    const heap = new THREE.InstancedMesh(bundleGeo, billMat, heapPts.length);
    heapPts.forEach(([x, y, z, yaw], k) => {
      this.m4.makeRotationFromEuler(new THREE.Euler(0.25 * Math.sin(k), yaw, 0.2 * Math.cos(k * 1.7)));
      this.m4.setPosition(x, y, z);
      heap.setMatrixAt(k, this.m4);
    });
    this.garageInside.add(heap);
    this.cashFloor = new THREE.InstancedMesh(bundleGeo, billMat, 40);
    for (let k = 0; k < 40; k++) {
      this.m4.makeRotationY(hash(k * 3.1) * Math.PI);
      this.m4.setPosition(-2.0 + 4.0 * hash(k * 1.7 + 0.3), 0.05 + 0.09 * (k % 3), 1.2 + 2.2 * hash(k * 2.3 + 0.7));
      this.cashFloor.setMatrixAt(k, this.m4);
    }
    this.garageInside.add(this.cashFloor);
    drv.add(this.garageInside);
    // Street lamp + mailbox
    drv.add(box(0.12, 4.2, 0.12, col("lamp_pole", "#3a3f4a"), -4.4, 2.1, -7.6), box(0.9, 0.08, 0.12, col("lamp_pole", "#3a3f4a"), -4.0, 4.16, -7.6));
    this.lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glow(2.6, 2.1, 1.3));
    this.lampBulb.position.set(-3.6, 4.02, -7.6); this.lampBulb.layers.set(NOINK);
    drv.add(this.lampBulb);
    drv.add(box(0.08, 1.0, 0.08, col("mail_post", "#6b4a34"), 3.0, 0.5, -7.8), box(0.26, 0.24, 0.46, col("mailbox", "#3b5c8c"), 3.0, 1.1, -7.8));
    // Vehicles
    this.drvRedCar = new ToonCar("#d43b3b");
    this.drvVictimCar = new ToonCar("#7fa0c8");
    this.supercar = makeSupercar();
    this.truck = makeBoxTruck();
    this.cruiser = makeCruiser();
    drv.add(this.drvRedCar.root, this.drvVictimCar.root, this.supercar.root, this.truck.root, this.cruiser.car.root);
    // Supporting cast + held props
    this.doctorRig = new HeroRig25D(drv, { jacket: "#f4f6f8", tie: "#4f8fc9", hair: "#8c8c8c" });
    this.trooperRig = new HeroRig25D(drv, { jacket: "#2b3a5c", tie: "#141a28", hair: "#2a2a2a" });
    this.rearDriverRig = new HeroRig25D(drv, { jacket: "#4f8f5f", hair: "#7a4a2a" });
    this.checkSign = sign(1.3, 0.6, makeCheckTex());
    this.invoiceSign = sign(0.34, 0.45, makeInvoiceTex(false), "#9c6b3f");
    this.ticket = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.18), new THREE.MeshBasicMaterial({ map: makeTicketTex(), side: THREE.DoubleSide }));
    this.ticket.layers.set(NOINK);
    drv.add(this.checkSign.g, this.invoiceSign.g, this.ticket);
    // Fluttering payout bills (Shot 4 money rain)
    const billGeo = new THREE.PlaneGeometry(0.16, 0.075);
    this.bills = new THREE.InstancedMesh(billGeo, new THREE.MeshBasicMaterial({ map: makeBillTex(), side: THREE.DoubleSide }), 60);
    this.bills.layers.set(NOINK);
    drv.add(this.bills);

    // ---- 4. INSURANCE OFFICE SET (Shot 7) ----
    const off = this.sets.office;
    off.add(box(8, 0.1, 8, lam("off_floor", () => ({ color: "#c9b89e" })), 0, -0.05, 0));
    off.add(box(2.4, 0.82, 1.1, lam("off_desk", () => ({ color: "#8c5a38" })), 0, 0.41, 0));
    this.agentRig = new HeroRig25D(off, { jacket: "#3b5998", tie: "#c93b3b", hair: "#2e241f" });
    this.deskSignBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.29),
      new THREE.MeshBasicMaterial({ map: makeFlipSignTex("2") })
    );
    this.deskSignBoard.layers.set(NOINK);
    this.deskSignBoard.position.set(0.45, 0.97, -0.35);
    this.deskSignBoard.rotation.y = Math.PI;
    off.add(this.deskSignBoard);

    // ---- 5. NIGHT HOT TUB / POOL SET (Shot 8) ----
    const pool = this.sets.pool;
    pool.add(box(12, 0.1, 12, lam("deck_wood", () => ({ color: "#8c5e3c" })), 0, -0.05, 0));
    const tubWall = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.85, 24), lam("tub", () => ({ color: "#6e472b" })));
    tubWall.position.set(0, 0.42, 0);
    const tubWater = new THREE.Mesh(new THREE.CircleGeometry(1.22, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#39b8d6" }));
    tubWater.position.set(0, 0.78, 0);
    pool.add(tubWall, tubWater);
    // Glowing overhead string bulbs (HDR > 1.0 triggers warm Bloom)
    const bulbGeo = new THREE.SphereGeometry(0.07, 10, 10);
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.85) });
    for (let i = -3; i <= 3; i++) {
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(i * 0.65, 2.35 - Math.cos(i * 0.4) * 0.18, 0.8);
      b.layers.set(NOINK);
      pool.add(b);
    }

    this.scammerRig = new HeroRig25D(R, { jacket: "#3d4452", vest: "#ebd63b", hair: "#3b2a1e" });
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

  /** Place a held prop group between a rig's hands, facing the rig's forward (+z rotated by yaw) */
  private holdBetween(rig: HeroRig25D, obj: THREE.Object3D, yaw: number, fwd = 0.04, dy = 0) {
    rig.handWorld("L", this.tmpV); rig.handWorld("R", this.tmpV2);
    obj.position.copy(this.tmpV).add(this.tmpV2).multiplyScalar(0.5);
    obj.position.x += Math.sin(yaw) * fwd; obj.position.z += Math.cos(yaw) * fwd; obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.visible = true;
  }

  private poseDriveway(id: number, f: number, t: number, night: boolean) {
    if (night) this.windowMat.color.setRGB(2.2, 1.55, 0.7); else this.windowMat.color.setRGB(0.42, 0.55, 0.74);
    this.lampBulb.visible = night;
    this.garageDoor.visible = id !== 6;
    this.garageInside.visible = id === 6;
    this.drvRedCar.root.visible = id === 4 || id === 9;
    this.drvVictimCar.root.visible = id === 9;
    this.supercar.root.visible = id === 6;
    this.truck.root.visible = id === 6;
    this.cruiser.car.root.visible = id === 9;
    this.checkSign.g.visible = false;
    this.invoiceSign.g.visible = false;
    this.ticket.visible = false;
    this.bills.visible = false;
    this.drvRedCar.setBraking(false);

    if (id === 4) {
      // Payout montage: doctor with the stamped invoice (left), scammer in a neck brace with a giant check (right)
      this.drvRedCar.setCrushed(false);
      this.drvRedCar.root.position.set(-3.1, 0, -0.2);
      this.drvRedCar.root.rotation.set(0, 0.3, 0);
      const dYaw = Math.PI + 0.22;
      this.doctorRig.pose({ pos: [-1.35, 0, -0.9], yaw: dYaw, expr: f >= 325 ? "smile" : "neutral",
        handL: [-0.13, 1.02, 0.3], handR: [0.13, 1.02, 0.3], mouthOpen: f < 325 ? 0.4 * Math.abs(Math.sin(t * 11)) : 0 });
      (this.invoiceSign.face.material as THREE.MeshBasicMaterial).map = makeInvoiceTex(f >= 325);
      this.holdBetween(this.doctorRig, this.invoiceSign.g, dYaw, 0.03, 0.08);
      this.invoiceSign.g.rotation.x = -0.25;
      const sYaw = Math.PI - 0.2;
      const bob = 0.03 * Math.sin(t * 6);
      this.scammerRig.pose({ pos: [1.35, 0, -0.8], yaw: sYaw, expr: "grin", brace: true,
        handL: [-0.6, 0.94 + bob, 0.3], handR: [0.6, 0.94 + bob, 0.3] });
      this.holdBetween(this.scammerRig, this.checkSign.g, sYaw, 0.03, -0.02);
      if (f >= 400) {
        this.bills.visible = true;
        for (let k = 0; k < 60; k++) {
          const age = (f - 400) / FPS - hash(k * 2.7) * 1.2;
          const y = age < 0 ? 50 : 3.2 - age * (0.9 + 0.3 * hash(k * 5.1));
          const x = 1.35 + (hash(k * 1.3) - 0.5) * 2.6 + 0.25 * Math.sin(t * 3 + k);
          const z = -0.8 + (hash(k * 4.9) - 0.5) * 1.8;
          this.m4.makeRotationFromEuler(new THREE.Euler(t * 3 + k, t * 2.2 + k * 0.7, Math.sin(t * 5 + k) * 0.8));
          this.m4.setPosition(x, Math.max(0.03, y), z);
          this.bills.setMatrixAt(k, this.m4);
        }
        this.bills.instanceMatrix.needsUpdate = true;
      }
    } else if (id === 6) {
      // Night: garage stuffed with cash (scammer in shades), then the lime supercar reverses into a box truck (f905)
      this.scammerRig.style.shades = true;
      const cheer = Math.abs(Math.sin(t * 5));
      this.scammerRig.pose({ pos: [0.5, 0, 3.0], yaw: Math.PI, expr: "grin", brace: true,
        handL: [-0.45, 1.5 + 0.12 * cheer, 0.12], handR: [0.45, 1.5 + 0.12 * cheer, 0.12] });
      const back = smooth((f - 880) / 25) ** 1.6;
      const impactZ = -6.15;
      let z = -2.9 + (impactZ + 2.9) * back;
      if (f >= 905) z = impactZ + 0.28 * Math.sin(Math.min(1, (f - 905) / 10) * Math.PI) * Math.exp(-(f - 905) / 14);
      this.supercar.root.position.set(1.9, 0, z);
      this.supercar.root.rotation.set(0, 0.06, 0);
      this.supercar.setBraking(f >= 903);
      this.supercar.setCrushed(f >= 905);
      this.truck.root.position.set(2.6, 0, -9.6);
      this.truck.root.rotation.set(0, Math.PI / 2, 0);
      this.truck.body.rotation.z = f >= 905 ? 0.045 * Math.sin((f - 905) * 0.9) * Math.exp(-(f - 905) / 9) : 0;
    } else if (id === 9) {
      // Night street: trooper tickets the frustrated rear driver (foreground) while the neck-brace scammer smirks
      this.drvRedCar.setCrushed(true);
      this.drvRedCar.setBraking(true);
      this.drvRedCar.root.position.set(1.7, 0, -11.0);
      this.drvRedCar.root.rotation.set(0, Math.PI / 2, 0);
      this.drvVictimCar.setCrushed(false);
      this.drvVictimCar.root.position.set(-3.05, 0, -11.0);
      this.drvVictimCar.root.rotation.set(0, Math.PI / 2, 0);
      this.cruiser.car.root.position.set(-1.9, 0, -7.4);
      this.cruiser.car.root.rotation.set(0, Math.PI / 2 + 0.5, 0);
      const ph = Math.floor(f / 4) % 2;
      this.cruiser.red.color.setRGB(ph ? 3.2 : 0.35, ph ? 0.15 : 0.03, ph ? 0.12 : 0.03);
      this.cruiser.blue.color.setRGB(ph ? 0.03 : 0.12, ph ? 0.05 : 0.3, ph ? 0.3 : 3.4);
      const rant = Math.abs(Math.sin(t * 7));
      this.rearDriverRig.pose({ pos: [-0.62, 0, -14.75], yaw: 2.2, expr: "stern", mouthOpen: 0.25 + 0.5 * rant,
        handL: [-0.42, 1.38 + 0.08 * rant, 0.18], handR: [0.42, 1.38 + 0.08 * (1 - rant), 0.18] });
      const tYaw = -2.15;
      this.trooperRig.pose({ pos: [0.42, 0, -14.4], yaw: tYaw, expr: "stern", cap: true,
        handL: [-0.12, 1.0, 0.22], handR: [0.1, 1.08, 0.42] });
      this.trooperRig.handWorld("R", this.tmpV);
      this.ticket.position.copy(this.tmpV).add(new THREE.Vector3(0, 0.08, 0));
      this.ticket.rotation.set(-0.2, tYaw, 0);
      this.ticket.visible = true;
      this.scammerRig.pose({ pos: [0.25, 0, -12.45], yaw: Math.PI + 0.1, expr: "grin", brace: true,
        headYaw: 0.15 * Math.sin(t * 1.5), handL: [0.14, 0.98, 0.2], handR: [-0.14, 1.02, 0.22] });
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;

    // 1. Toggle active set only
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    // 2. Camera & Light Rig
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = 28;
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

    // 3. Rain particle animation (active in rain shots 10-12)
    this.rainStreaks.visible = s.light === "rain";
    if (this.rainStreaks.visible) {
      const qRain = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.14));
      for (let i = 0; i < 360; i++) {
        const rx = ((i * 73.1) % 18) - 9 + cam.position.x;
        const rz = ((i * 31.7) % 24) - 12 + cam.position.z;
        let ry = 6.0 - (((t * 16 + i * 0.37) % 6.2));
        if (s.set === "car_cabin" && Math.abs(rx - 0.0) < 1.0 && rz > -1.3 && rz < 1.35) ry = -50; // not inside the car
        this.m4.compose(new THREE.Vector3(rx, ry, rz), qRain, new THREE.Vector3(1, 1, 1));
        this.rainStreaks.setMatrixAt(i, this.m4);
      }
      this.rainStreaks.instanceMatrix.needsUpdate = true;
    }

    // 4. Pose per-shot actors & vehicles
    this.scammerRig.root.visible = false;
    this.quietDriverRig.root.visible = false;
    this.agentRig.root.visible = false;
    this.wiperMesh.visible = false;
    this.scammerRig.style.shades = false;
    for (const r of [this.doctorRig, this.trooperRig, this.rearDriverRig]) r.root.visible = false;
    if (s.set === "driveway") this.poseDriveway(id, f, t, s.light === "night");

    if (id === 1) {
      // Boot rests on the gas, lifts across (f8-12), then stomps the brake pad (f12-17; brake_slam event at f14)
      const lift = smooth((f - 8) / 4), stomp = smooth((f - 12) / 5);
      this.brakePedal.rotation.x = -0.34 * stomp;
      this.brakePedal.updateMatrixWorld(true);
      const pad = this.brakePad.getWorldPosition(this.tmpV);
      const root: [number, number, number] = [-0.32, -0.12, -0.12];
      const gas: [number, number, number] = [0.12, 0.24, 0.6];
      // boot toe presses the pad face (boot centre = foot + (0, .025, .05), half-length ~.114)
      const brake: [number, number, number] = [pad.x, pad.y - 0.02 + 0.12 * (1 - stomp) * lift, pad.z - 0.2 - 0.06 * (1 - stomp) * lift];
      const foot = gas.map((g, k) => g + (brake[k] - g) * lift) as [number, number, number];
      this.scammerRig.pose({
        pos: root,
        expr: f >= 10 ? "grin" : "neutral",
        headYaw: 0.55 * smooth((f - 4) / 8),
        lean: 0.05,
        footR: [foot[0] - root[0], foot[1] - root[1], foot[2] - root[2]],
        footL: [0.02 - 0.32 - root[0] - 0.12, 0.2 - root[1], 0.5 - root[2]],
        handL: [-0.17, 1.16, 0.62],
        handR: [0.17, 1.16, 0.62],
      });
    } else if (s.set === "highway") {
      const spd = highwaySpeedMps(f);
      this.scrollZ = (f * spd) / FPS;
      for (let i = 0; i < 40; i++) {
        const dz = (((i * 6 - this.scrollZ) % 240) + 240) % 240 - 120;
        this.m4.makeTranslation(0, 0.02, dz);
        this.roadDashes.setMatrixAt(i, this.m4);
      }
      this.roadDashes.instanceMatrix.needsUpdate = true;

      const braking = (f >= 16 && f < 95) || (f >= 1385 && f < 1440) || (f >= 1675 && f < 1760);
      this.scammerCar.setBraking(braking);
      this.scammerCar.setCrushed((id === 2 && f >= 78) || id === 3 || (id === 10 && f >= 1418));
      this.scammerCar.root.position.set(0, 0, id === 12 ? 5.5 - 2.4 * smooth((f - 1675) / 35) : 0);

      this.victimCar.root.visible = id === 2 || id === 3 || id === 5;
      this.buddyTruck.root.visible = id === 5 && f >= 660;
      this.wagonCar.root.visible = id === 10 || id === 12;

      if (id === 2) {
        const gap = f < 78 ? -7.5 + 3.3 * smooth((f - 42) / 36) : -4.2;
        this.victimCar.root.position.set(0, 0, gap);
      } else if (id === 5) {
        this.victimCar.root.position.set(0, 0, -5.8);
        this.buddyTruck.root.position.set(-2.9, 0, -5.6 + 1.5 * smooth((f - 660) / 35));
      } else if (id === 10) {
        this.wagonCar.root.position.set(0, 0, f < 1418 ? -6.8 + 2.6 * smooth((f - 1385) / 33) : -4.2);
      } else if (id === 12) {
        this.wagonCar.root.position.set(0, 0, -3.8);
        this.wiperMesh.visible = f < 1790;
        this.wiperMesh.rotation.z = Math.sin(t * 5.2) * 0.65;
      }

      if (id === 3 && f >= 168) {
        this.scammerRig.pose({
          pos: [-1.35, 0, -1.6],
          yaw: 1.75, // rig faces +z: turn toward the camera on the shoulder side
          lean: 0.18,
          expr: "pained",
          handR: [0.08, 1.32, 0.12], // clutching neck!
        });
      }
    } else if (id === 7) {
      const digit = f >= 1005 ? "0" : "2";
      (this.deskSignBoard.material as THREE.MeshBasicMaterial).map = makeFlipSignTex(digit);
      this.agentRig.pose({
        pos: [0, 0.05, 0.55],
        yaw: Math.PI,
        expr: "stern",
        mouthOpen: f >= 960 && f < 1065 ? 0.5 * Math.abs(Math.sin(t * 14)) : 0,
        handR: [0.16, 1.32, 0.08], // holding office receiver to ear
      });
    } else if (id === 8) {
      this.scammerRig.pose({
        pos: [0, -0.35, 0],
        yaw: Math.PI,
        expr: "grin",
        mouthOpen: 0.55 * Math.abs(Math.sin(t * 13)),
        handL: [-0.18, 1.32, 0.08], // phone in hot tub
      });
    } else if (id === 11) {
      // Calm driver, hands on the wheel, then lifts his right hand to point at the taped dashcam (f1545-1563)
      const pointK = smooth((f - 1545) / 18);
      const rest: [number, number, number] = [0.17, 1.16, 0.62], tip: [number, number, number] = [0.22, 1.5, 0.74];
      this.quietDriverRig.pose({
        pos: [-0.32, -0.12, -0.12],
        expr: "neutral",
        blink: Math.floor(f / 3) % 37 === 0 ? 1 : 0,
        headYaw: 0.32 - 0.12 * pointK,
        headPitch: -0.12 * pointK,
        handL: [-0.17, 1.16, 0.62],
        handR: rest.map((r, k) => r + (tip[k] - r) * pointK) as [number, number, number],
        footL: [-0.1, 0.32, 0.62],
        footR: [0.1, 0.32, 0.72],
      });
      // Scammer outside, in front of his stopped car, clutching his neck
      this.scammerRig.pose({ pos: [0.4, 0, 4.0], yaw: Math.PI - 0.15, lean: 0.12, expr: "pained", brace: false, handR: [0.08, 1.32, 0.12], handL: [-0.2, 0.9, 0.18] });
    }

    return focus;
  }
}
