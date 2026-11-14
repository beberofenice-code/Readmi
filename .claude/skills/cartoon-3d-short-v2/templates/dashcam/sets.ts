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
  private pedalMesh: THREE.Mesh;
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
    const cab = this.sets.car_cabin;
    const dashMat = lam("cab_dash", () => ({ color: "#383c47" }));
    const seatMat = lam("cab_seat", () => ({ color: "#6e5849" }));
    cab.add(box(1.7, 0.55, 0.65, dashMat, 0, 0.68, 0.78)); // Dashboard
    cab.add(box(0.62, 0.78, 0.55, seatMat, -0.32, 0.52, -0.18)); // Driver seat
    cab.add(box(0.62, 0.78, 0.55, seatMat, 0.38, 0.52, -0.18));  // Passenger seat
    this.pedalMesh = box(0.14, 0.22, 0.05, lam("pedal", () => ({ color: "#22252c" })), -0.14, 0.24, 0.68);
    cab.add(this.pedalMesh);
    // Little taped dashcam box on windshield (Shot 11 hero prop)
    const camBox = box(0.16, 0.11, 0.09, dashMat, 0, 1.34, 0.72);
    const recDot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.1, 0.1) }));
    recDot.position.set(0.05, 1.35, 0.67);
    recDot.layers.set(NOINK);
    cab.add(camBox, recDot);
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
    const drv = this.sets.driveway;
    drv.add(box(40, 0.1, 40, grassMat, 0, -0.05, 0));
    drv.add(box(6.5, 0.12, 18, lam("concrete", () => ({ color: "#cfc6b4" })), 0, -0.04, -2));
    drv.add(box(9.5, 5.2, 7.5, lam("house_cream", () => ({ color: "#ecdab2" })), 0, 2.6, 6.2));
    drv.add(box(4.6, 2.8, 0.2, lam("garage_cash", () => ({ color: "#5c9c49" })), 0, 1.4, 2.42)); // Cash-packed garage

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
        const ry = 6.0 - (((t * 16 + i * 0.37) % 6.2));
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

    if (id === 1) {
      const stomp = smooth((f - 12) / 5);
      this.pedalMesh.rotation.x = 0.35 * stomp;
      this.scammerRig.pose({
        pos: [-0.32, 0.15, -0.12],
        expr: stomp > 0.5 ? "grin" : "neutral",
        footR: [0.18, 0.10 - 0.05 * stomp, 0.76 + 0.08 * stomp],
        handL: [-0.22, 0.92, 0.42],
        handR: [0.18, 0.92, 0.42],
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
          yaw: 0.4,
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
      const pointK = smooth((f - 1545) / 18);
      this.quietDriverRig.pose({
        pos: [-0.32, 0.15, -0.12],
        expr: "neutral",
        handR: [0.22 * (1 - pointK) + 0.30 * pointK, 0.85 + 0.42 * pointK, 0.25 + 0.48 * pointK], // calm point to windshield dashcam
      });
    }

    return focus;
  }
}
