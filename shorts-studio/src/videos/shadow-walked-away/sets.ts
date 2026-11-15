// Modular 3D Set Registry for "What If Your Shadow Walked Away?": street (origin-locked sidewalk treadmill), office,
// apartment, beach. Only the active shot's set Group is visible per frame; shared twoTone materials keep draw calls low.
// The man's rig never casts into the shadow map: his shadow is its own character (FlatShadow on the ground, HeroRig25D
// once it stands up), which is exactly what lets it leave.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HeroRig25D, RigPose } from "../core/rig25d";
import { FPS, SHOTS, SUN_WORLD, V3, camAt, finalManZ, lerp, scrollAt, shadowDir, shadowLeadX, smooth, talk, walkSpeedMps } from "./story";

const SHADOW_HEX = "#221c46";
const SHADOW_EYE = "#f6f2ff";
const GROUND_SHADOW_HEX = "#38384d"; // flat-on-the-ground tone (reads like the scene's real cast shadows at 0.9 opacity)

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam("sw_" + key, () => ({ color: hex }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect) */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const noink = <T extends THREE.Object3D>(o: T) => { o.layers.set(NOINK); return o; };

/** Unlit readable prop: textured face plane (+z) + lam backing card (so the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3") => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, 0.02, col("sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.012;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

/** Merge a group's static lit meshes by material (hundreds of set-dressing boxes -> a handful of draw calls).
 *  Skips NOINK (unlit / animated sprites) and anything flagged userData.dyn. */
const mergeStatic = (grp: THREE.Group) => {
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const o of [...grp.children]) {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.children.length || m.userData.dyn || m.layers.mask !== 1 || Array.isArray(m.material) || !m.castShadow) continue;
    m.updateMatrix();
    const g = m.geometry.clone().applyMatrix4(m.matrix);
    by.set(m.material, [...(by.get(m.material) ?? []), g]);
    grp.remove(m);
  }
  for (const [mat, geos] of by) {
    const mm = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mm.castShadow = true; mm.receiveShadow = true;
    grp.add(mm);
  }
};

// ---------------- Canvas2D painters ----------------
type G2 = CanvasRenderingContext2D;
const limb = (g: G2, x0: number, y0: number, x1: number, y1: number, w: number, c: string) => {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round";
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
};
const blob = (g: G2, x: number, y: number, rx: number, ry: number, c: string) => {
  g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
};

/** Flat silhouette of the bean-head man (380 x 680 px = 0.95 x 1.7 m). pose: 0 idle, 1 / 2 waving, 3 standing with eyes */
const silhouetteTex = (pose: number) =>
  ctex("sw_silhouette_" + pose, 380, 680, (g) => {
    const c = pose === 3 ? SHADOW_HEX : GROUND_SHADOW_HEX;
    g.clearRect(0, 0, 380, 680);
    limb(g, 162, 410, 152, 650, 22, c); limb(g, 218, 410, 230, 650, 22, c);          // legs
    blob(g, 146, 662, 30, 15, c); blob(g, 238, 662, 30, 15, c);                        // feet
    limb(g, 122, 255, 90, 400, 19, c); blob(g, 88, 408, 17, 17, c);                    // left arm + hand
    if (pose === 1 || pose === 2) {
      const hx = pose === 1 ? 338 : 306;
      limb(g, 258, 255, 300, 190, 19, c); limb(g, 300, 190, hx, 96, 19, c); blob(g, hx, 90, 19, 19, c);
    } else { limb(g, 258, 255, 290, 400, 19, c); blob(g, 292, 408, 17, 17, c); }
    g.fillStyle = c; g.beginPath(); g.roundRect(112, 205, 156, 226, 76); g.fill();     // torso
    blob(g, 190, 128, 96, 88, c);                                                      // head
    if (pose === 3) {
      blob(g, 160, 128, 11, 14, SHADOW_EYE); blob(g, 220, 128, 11, 14, SHADOW_EYE);
      g.strokeStyle = SHADOW_EYE; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.ellipse(190, 160, 20, 10, 0, 0.2, Math.PI - 0.2); g.stroke();
    }
  });

/** Little shadow guy for the postcard art. arms: "up" | "surf" | "dance" */
const shadowGuy = (g: G2, x: number, y: number, s: number, arms: string, tilt = 0) => {
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  const c = SHADOW_HEX;
  if (arms === "surf") { limb(g, -18, 60, -46, 118, 13, c); limb(g, 18, 60, 52, 112, 13, c); }
  else if (arms === "dance") { limb(g, -16, 60, -34, 124, 13, c); limb(g, 16, 60, 58, 96, 13, c); }
  else { limb(g, -16, 60, -20, 112, 13, c); limb(g, 16, 60, 20, 112, 13, c); }
  if (arms === "up") { limb(g, -40, -4, -78, -86, 12, c); limb(g, 40, -4, 78, -86, 12, c); blob(g, -80, -92, 11, 11, c); blob(g, 80, -92, 11, 11, c); }
  else if (arms === "surf") { limb(g, -40, 0, -104, -16, 12, c); limb(g, 40, 0, 104, -28, 12, c); blob(g, -108, -16, 11, 11, c); blob(g, 108, -30, 11, 11, c); }
  else { limb(g, -40, -2, -92, -70, 12, c); limb(g, 40, 4, 96, 40, 12, c); blob(g, -96, -76, 11, 11, c); blob(g, 100, 44, 11, 11, c); }
  g.fillStyle = c; g.beginPath(); g.roundRect(-46, -30, 92, 110, 44); g.fill();
  blob(g, 0, -78, 58, 53, c);
  blob(g, -19, -80, 8, 10, SHADOW_EYE); blob(g, 19, -80, 8, 10, SHADOW_EYE);
  g.strokeStyle = SHADOW_EYE; g.lineWidth = 6; g.lineCap = "round";
  g.beginPath(); g.ellipse(0, -58, 17, 11, 0, 0.15, Math.PI - 0.15); g.stroke();
  g.restore();
};

const postcardFrame = (g: G2, title: string, sub: string, bandHex: string) => {
  const W = 720, H = 1008;
  g.fillStyle = "#fffaf0"; g.fillRect(0, H - 250, W, 250);
  g.fillStyle = bandHex; g.fillRect(0, H - 250, W, 16);
  g.fillStyle = "#241726"; g.textAlign = "center";
  g.font = "900 78px sans-serif"; g.fillText(title, W / 2, H - 150);
  g.font = "italic bold 44px serif"; g.fillStyle = "#5a4a66"; g.fillText(sub, W / 2, H - 70);
  g.strokeStyle = "#fffaf0"; g.lineWidth = 36; g.strokeRect(18, 18, W - 36, H - 36);
  g.strokeStyle = "#241726"; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
};

const postcardTex = (kind: number) =>
  ctex("sw_postcard_" + kind, 720, 1008, (g) => {
    const W = 720, H = 760;
    if (kind === 0) {
      // Rollercoaster
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#3b8fe0"); sky.addColorStop(1, "#bfe3ff");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const [cx, cy, r] of [[120, 130, 60], [190, 150, 46], [560, 220, 52], [620, 240, 40]]) blob(g, cx, cy, r * 1.5, r * 0.7, "#ffffff");
      g.fillStyle = "#6fbf5c"; g.fillRect(0, H - 90, W, 90);
      const track = (dy: number, w: number, c: string) => {
        g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
        g.moveTo(-20, 640 + dy); g.bezierCurveTo(160, 620 + dy, 230, 250 + dy, 380, 250 + dy);
        g.bezierCurveTo(540, 250 + dy, 560, 600 + dy, 760, 520 + dy); g.stroke();
      };
      g.strokeStyle = "#8a4b3a"; g.lineWidth = 10;
      for (let x = 40; x < 720; x += 70) { g.beginPath(); g.moveTo(x, H - 60); g.lineTo(x + 20, 330 + Math.abs(x - 380) * 0.75); g.stroke(); }
      track(0, 30, "#241726"); track(0, 18, "#e2453c");
      g.save(); g.translate(372, 232); g.rotate(-0.04);
      g.fillStyle = "#241726"; g.beginPath(); g.roundRect(-98, -34, 196, 76, 20); g.fill();
      g.fillStyle = "#ffcf3f"; g.beginPath(); g.roundRect(-90, -26, 180, 60, 14); g.fill();
      g.restore();
      shadowGuy(g, 372, 150, 1.05, "up", -0.05);
      g.fillStyle = "#241726"; g.font = "900 64px sans-serif"; g.textAlign = "center";
      g.save(); g.translate(560, 120); g.rotate(0.14); g.fillStyle = "#ffffff"; g.fillText("WHEEE!", 3, 3); g.fillStyle = "#e2453c"; g.fillText("WHEEE!", 0, 0); g.restore();
      postcardFrame(g, "THRILL PARK", "wish you were here!", "#e2453c");
    } else if (kind === 1) {
      // Surfing
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#ffb65c"); sky.addColorStop(1, "#ffe9b8");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      blob(g, 560, 170, 86, 86, "#fff3c4");
      g.fillStyle = "#1f9bb5"; g.fillRect(0, 430, W, 330);
      g.fillStyle = "#2bb6c9"; g.beginPath(); g.moveTo(-10, 760); g.lineTo(-10, 330);
      g.bezierCurveTo(120, 150, 380, 120, 470, 260); g.bezierCurveTo(400, 220, 300, 250, 300, 360);
      g.bezierCurveTo(300, 500, 520, 560, 730, 520); g.lineTo(730, 760); g.closePath(); g.fill();
      g.strokeStyle = "#ffffff"; g.lineWidth = 22; g.lineCap = "round"; g.beginPath(); g.moveTo(-10, 330);
      g.bezierCurveTo(120, 150, 380, 120, 470, 260); g.stroke();
      for (let i = 0; i < 9; i++) blob(g, 440 + i * 9 + hash(i) * 30, 270 + hash(i * 3) * 50, 14, 14, "#ffffff");
      g.save(); g.translate(430, 560); g.rotate(-0.16);
      g.fillStyle = "#241726"; g.beginPath(); g.ellipse(0, 0, 196, 30, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd23f"; g.beginPath(); g.ellipse(0, 0, 186, 21, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e2453c"; g.fillRect(-30, -20, 22, 40);
      g.restore();
      shadowGuy(g, 430, 440, 1.0, "surf", -0.12);
      postcardFrame(g, "SURF'S UP", "day 3: only fell off twice", "#1f9bb5");
    } else {
      // Wedding dance floor
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3a2a66"); bg.addColorStop(1, "#7d4a9c");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#241726"; g.lineWidth = 5; g.beginPath(); g.moveTo(-10, 90); g.quadraticCurveTo(360, 190, 730, 90); g.stroke();
      for (let i = 0; i < 12; i++) { const u = i / 11, x = 30 + u * 660, y = 92 + 100 * (1 - (2 * u - 1) ** 2) * 0.5; blob(g, x, y + 14, 16, 16, ["#ffd86b", "#ff8fa3", "#8fe0ff"][i % 3]); }
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        g.fillStyle = (r + c) % 2 ? "#f2e6ff" : "#c9a6ea";
        const y0 = 560 + r * 50, y1 = y0 + 50, p0 = 0.55 + r * 0.15, p1 = p0 + 0.15;
        g.beginPath(); g.moveTo(360 + (c - 3) * 120 * p0, y0); g.lineTo(360 + (c - 2) * 120 * p0, y0);
        g.lineTo(360 + (c - 2) * 120 * p1, y1); g.lineTo(360 + (c - 3) * 120 * p1, y1); g.closePath(); g.fill();
      }
      // bride + groom, baffled, in the back
      g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(150, 400); g.lineTo(96, 560); g.lineTo(204, 560); g.closePath(); g.fill();
      blob(g, 150, 372, 34, 31, "#ffe2c2"); blob(g, 139, 370, 4, 5, "#241726"); blob(g, 161, 370, 4, 5, "#241726");
      g.fillStyle = "#2f3350"; g.beginPath(); g.roundRect(552, 404, 70, 156, 26); g.fill();
      blob(g, 587, 372, 34, 31, "#ffe2c2"); blob(g, 576, 370, 4, 5, "#241726"); blob(g, 598, 370, 4, 5, "#241726");
      shadowGuy(g, 372, 470, 1.25, "dance", 0.1);
      g.fillStyle = "#ffd86b"; g.font = "900 46px sans-serif"; g.textAlign = "center";
      for (const [x, y] of [[250, 300], [520, 290], [470, 220]]) g.fillText("♪", x, y);
      postcardFrame(g, "BEST WEDDING", "no idea whose it was", "#7d4a9c");
    }
  });

const listTex = () =>
  ctex("sw_someday_list", 512, 700, (g) => {
    g.fillStyle = "#f3e7b8"; g.fillRect(0, 0, 512, 700);
    g.fillStyle = "#e6d79e"; g.fillRect(0, 0, 512, 20);
    g.strokeStyle = "#cdbd86"; g.lineWidth = 3;
    for (let y = 190; y < 680; y += 118) { g.beginPath(); g.moveTo(30, y + 60); g.lineTo(482, y + 60); g.stroke(); }
    g.fillStyle = "#241726"; g.textAlign = "center"; g.font = "900 92px sans-serif"; g.fillText("SOMEDAY", 256, 122);
    g.fillRect(70, 142, 372, 9);
    g.textAlign = "left"; g.font = "bold 50px sans-serif";
    ["rollercoaster", "learn to surf", "dance!", "see the sun"].forEach((s, i) => {
      const y = 232 + i * 118;
      g.strokeStyle = "#241726"; g.lineWidth = 7; g.strokeRect(40, y - 44, 54, 54);
      g.fillText(s, 118, y);
    });
    blob(g, 256, 14, 15, 15, "#d1262b");
  });

const ticketTex = () =>
  ctex("sw_ticket", 880, 400, (g) => {
    g.fillStyle = "#fff7e3"; g.fillRect(0, 0, 880, 400);
    g.fillStyle = "#f08a2c"; g.fillRect(0, 0, 880, 92);
    g.fillStyle = "#ffffff"; g.font = "900 62px sans-serif"; g.textAlign = "left"; g.fillText("ONE WAY", 36, 68);
    g.textAlign = "right"; g.font = "bold 40px sans-serif"; g.fillText("SEAT 1A", 846, 62);
    g.fillStyle = "#241726"; g.textAlign = "center"; g.font = "900 132px sans-serif"; g.fillText("THE BEACH", 440, 250);
    g.font = "bold 44px monospace"; g.fillText("DEPARTS: TODAY", 440, 336);
    g.strokeStyle = "#241726"; g.lineWidth = 8; g.strokeRect(4, 4, 872, 392);
    g.setLineDash([14, 12]); g.lineWidth = 5; g.beginPath(); g.moveTo(700, 100); g.lineTo(700, 392); g.stroke();
  });

const shackSignTex = () =>
  ctex("sw_shack_sign", 768, 256, (g) => {
    g.fillStyle = "#2a8fa3"; g.fillRect(0, 0, 768, 256);
    g.strokeStyle = "#fff7e3"; g.lineWidth = 12; g.strokeRect(12, 12, 744, 232);
    g.fillStyle = "#fff7e3"; g.textAlign = "center"; g.font = "900 124px sans-serif"; g.fillText("SURF SHACK", 384, 172);
  });

const calendarTex = () =>
  ctex("sw_calendar", 384, 448, (g) => {
    g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 384, 448);
    g.fillStyle = "#c93b3b"; g.fillRect(0, 0, 384, 112);
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "900 78px sans-serif"; g.fillText("MONDAY", 192, 84);
    g.fillStyle = "#241726"; g.font = "900 250px sans-serif"; g.fillText("14", 192, 372);
    g.strokeStyle = "#241726"; g.lineWidth = 8; g.strokeRect(4, 4, 376, 440);
  });

const glintTex = () =>
  ctex("sw_sea_glints", 256, 1024, (g, r) => {
    g.clearRect(0, 0, 256, 1024);
    for (let i = 0; i < 150; i++) {
      const y = r() * 1024, w = 20 + r() * (60 + 150 * (1 - y / 1024)), x = 128 + (r() - 0.5) * (40 + 150 * (1 - y / 1024));
      g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`;
      g.beginPath(); g.ellipse(x, y, w / 2, 2.2 + r() * 2.5, 0, 0, Math.PI * 2); g.fill();
    }
  });

const haloTex = () =>
  ctex("sw_sun_halo", 256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 6, 128, 128, 128);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.25, "rgba(255,255,255,0.45)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  });

/** The man's detached shadow while it is still flat: a hinged silhouette card (lying on the ground or standing up). */
class FlatShadow {
  root = new THREE.Group();
  private hinge = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: silhouetteTex(0), transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, fog: false, alphaTest: 0.5 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7).translate(0, 0.85, 0), this.mat);
    this.mesh.layers.set(NOINK);
    this.mesh.renderOrder = 2;
    this.hinge.add(this.mesh);
    this.root.add(this.hinge);
    parent.add(this.root);
  }
  /** heading: yaw so that the lying card points along world (-sin h, -cos h); k: 0 flat on the ground .. 1 upright */
  set(x: number, z: number, heading: number, k: number, len: number, pose = 0, y = 0.02) {
    this.root.visible = true;
    this.root.position.set(x, y, z);
    this.root.rotation.set(0, heading, 0);
    this.hinge.rotation.set(-Math.PI / 2 * (1 - k), 0, 0);
    this.mesh.scale.set(1, len / 1.7, 1);
    const standing = k > 0.6;
    this.mat.map = silhouetteTex(standing ? 3 : pose);
    // lying: ground-shadow grey-violet; as it lifts it deepens toward the living shadow's indigo
    const d = standing ? 0 : k / 0.6;
    this.mat.color.setRGB(lerp(1, 0.4, d), lerp(1, 0.29, d), lerp(1, 0.82, d));
    this.mat.opacity = lerp(0.9, 1, k);
    this.mat.depthWrite = k > 0.97; // upright: occlude the ink lines of whatever is behind it
  }
}

type Gait = Pick<RigPose, "footL" | "footR" | "handL" | "handR">;
/** Walk / run cycle in rig-local space (+z forward). ph advances pi per step; amp 0..1 scales the whole cycle. */
const gait = (ph: number, stride: number, lift: number, arm = 0.22, amp = 1): Gait => {
  const c = Math.cos(ph) * amp, s = Math.sin(ph) * amp;
  return {
    footL: [-0.11, 0.04 + lift * Math.max(0, -s), stride * c],
    footR: [0.11, 0.04 + lift * Math.max(0, s), -stride * c],
    handL: [-0.27, 0.8 + 0.05 * Math.abs(c), -arm * c + 0.06],
    handR: [0.27, 0.8 + 0.05 * Math.abs(c), arm * c + 0.06],
  };
};

const BEACH_MAN: V3 = [-0.3, 0, -2.2];       // waiting in the shack's shade
const BEACH_LIT: V3 = [1.0, 0, 1.4];         // where he ends up, in the light
const BEACH_SEAT: V3 = [1.2, -0.56, 5.2];    // the shadow, sitting on its towel
/** 0 = inside the shack's cast shade on the sand, 1 = in the sun (soft 0.5 m edge) */
const beachLit = (x: number, z: number) => {
  if (z > 1.5) return 1;
  const right = -0.4 + 0.204 * (4 - z), left = -3.6 + 0.204 * (1.5 - z);
  return Math.max(smooth((x - right + 0.3) / 0.6), smooth((left - x + 0.3) / 0.6));
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
  private tint = new THREE.Color();

  private man: HeroRig25D;
  private shadow: HeroRig25D;
  private flat: FlatShadow;
  private briefcase: THREE.Group;
  // street
  private streetScroll = new THREE.Group();
  private strands: THREE.Mesh[] = [];
  // office
  private coworkers: HeroRig25D[] = [];
  // apartment
  private fallCards: THREE.Mesh[] = [];
  private postcard: { g: THREE.Group; face: THREE.Mesh };
  private thumbs = new THREE.Group();
  private phone: THREE.Mesh;
  private ticket: { g: THREE.Group; face: THREE.Mesh };
  // beach
  private sunDisc: THREE.Mesh;
  private sunHalo: THREE.Mesh;
  private glints: THREE.Mesh;
  private foam: THREE.Mesh[] = [];
  private shoes: THREE.Mesh[] = [];

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
    this.sky.renderOrder = -10;
    R.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);

    for (const name of ["street", "office", "apartment", "beach"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    this.buildStreet();
    this.buildOffice();
    this.buildApartment();
    this.buildBeach();

    // ---- Cast ----
    this.man = new HeroRig25D(R, { jacket: "#5d6676", tie: "#c2453c", hair: "#3b2a1e", boots: "#3a2c28" });
    this.shadow = new HeroRig25D(R, { skin: SHADOW_HEX, jacket: SHADOW_HEX, boots: SHADOW_HEX, faceInk: SHADOW_EYE });
    this.flat = new FlatShadow(R);
    this.briefcase = new THREE.Group();
    const leather = col("briefcase", "#7a4a2c");
    this.briefcase.add(box(0.36, 0.25, 0.1, leather, 0, -0.17, 0), box(0.12, 0.05, 0.03, col("briefcase_handle", "#2d2320"), 0, -0.03, 0),
      box(0.06, 0.04, 0.11, col("briefcase_clasp", "#e8c45a"), 0, -0.07, 0));
    R.add(this.briefcase);
  }

  // ---- 1. STREET: origin-locked sidewalk treadmill (Shots 1-4). The walker stays at x = 0; modules scroll in -x. ----
  private buildStreet() {
    const st = this.sets.street;
    st.add(box(240, 0.3, 4, col("sidewalk", "#c9c5bd"), 0, -0.15, 0.4));          // sidewalk z -1.6..2.4, top y 0
    st.add(box(240, 0.3, 0.22, col("curb", "#a9a59c"), 0, -0.17, -1.7));
    st.add(box(240, 0.2, 9, col("asphalt", "#565a66"), 0, -0.27, -6.3));          // road z -10.8..-1.8
    st.add(box(240, 0.3, 3, col("sidewalk", "#c9c5bd"), 0, -0.15, -12.3));
    const S = this.streetScroll;
    st.add(S);
    const P = 16; // module period (two buildings); every module is identical, so wrapping by P is seamless
    const glass = col("st_glass", "#7f9cc4"), trim = col("st_trim", "#ecebe6"), dark = col("st_dark", "#3a3f4a");
    const wallA = col("st_wallA", "#9aa5b6"), wallB = col("st_wallB", "#b9ae9f"), wallC = col("st_wallC", "#8d97a3"), wallD = col("st_wallD", "#a79f97");
    const lineMat = col("st_line", "#efe6c6"), leaf = col("st_leaf", "#5fa052"), trunk = col("st_trunk", "#6b4a34");
    for (let i = -4; i <= 4; i++) {
      const x0 = i * P;
      // building A (blue-grey offices) and B (warm grey, awning shop): fronts at z = 2.4
      S.add(box(7.8, 7.6, 5, wallA, x0, 3.8, 4.9), box(7.8, 9.2, 5, wallB, x0 + 8, 4.6, 4.9));
      S.add(box(8.0, 0.3, 5.2, dark, x0, 7.75, 4.9), box(8.0, 0.3, 5.2, dark, x0 + 8, 9.35, 4.9));
      for (const bx of [x0, x0 + 8]) {
        for (let r = 0; r < (bx === x0 ? 2 : 3); r++) for (const wx of [-2.4, 0, 2.4]) {
          S.add(box(1.5, 1.3, 0.08, trim, bx + wx, 3.9 + r * 2.1, 2.38), box(1.26, 1.06, 0.1, glass, bx + wx, 3.9 + r * 2.1, 2.36));
        }
      }
      S.add(box(1.3, 2.3, 0.1, dark, x0 - 2.3, 1.15, 2.37), box(3.6, 1.7, 0.1, glass, x0 + 1.4, 1.45, 2.37), box(3.8, 0.12, 0.2, trim, x0 + 1.4, 0.55, 2.34));
      S.add(box(1.2, 2.2, 0.1, col("st_doorB", "#5c7a6a"), x0 + 8 + 2.5, 1.1, 2.37), box(3.4, 1.6, 0.1, glass, x0 + 8 - 1.3, 1.5, 2.37));
      const awn = box(3.8, 0.1, 1.0, col("st_awning", "#c0584e"), x0 + 8 - 1.3, 2.62, 1.95); awn.rotation.x = 0.28;
      S.add(awn);
      // street furniture along the curb: lamp, tree, hydrant
      // (x offsets chosen so no tree / lamp shade ever falls on the man in the static shots: he must visibly have no shadow)
      S.add(box(0.12, 4.4, 0.12, dark, x0 + 13, 2.2, -1.25), box(0.12, 0.1, 0.9, dark, x0 + 13, 4.36, -0.85), box(0.34, 0.14, 0.4, trim, x0 + 13, 4.26, -0.5));
      S.add(box(0.22, 2.7, 0.22, trunk, x0 + 9, 1.35, -1.15));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10), leaf);
      crown.scale.set(1, 0.9, 1); crown.position.set(x0 + 9, 3.3, -1.15); crown.castShadow = true;
      S.add(crown);
      S.add(box(0.26, 0.55, 0.26, col("st_hydrant", "#d1483b"), x0 + 15, 0.27, -1.2), box(0.4, 0.1, 0.16, col("st_hydrant", "#d1483b"), x0 + 15, 0.36, -1.2));
      // road centre dashes and the far side of the street
      for (const dx of [0, 4, 8, 12]) S.add(box(2.0, 0.02, 0.16, lineMat, x0 + dx, -0.16, -6.3));
      S.add(box(7.8, 8.4, 5, wallC, x0, 4.2, -16.3), box(7.8, 6.6, 5, wallD, x0 + 8, 3.3, -16.3));
      for (const bx of [x0, x0 + 8]) for (const wx of [-2.4, 0, 2.4]) S.add(box(1.26, 1.06, 0.1, glass, bx + wx, 3.6, -13.78));
    }
    mergeStatic(S);
    // stretchy strands between his heels and the shadow while it peels (Shot 2)
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5),
        new THREE.MeshBasicMaterial({ color: GROUND_SHADOW_HEX, transparent: true, opacity: 0.9, depthWrite: false }));
      m.layers.set(NOINK); m.renderOrder = 2;
      this.strands.push(m);
      st.add(m);
    }
  }

  // ---- 2. OPEN-PLAN OFFICE (Shot 5): flat fluorescent panels, identical desks receding in depth ----
  private buildOffice() {
    const off = this.sets.office;
    off.add(box(11, 0.1, 18, col("of_carpet", "#8792a3"), 0, -0.05, 3.5));
    off.add(box(11, 3.4, 0.2, col("of_wall", "#d9d6cf"), 0, 1.7, 11.5), box(0.2, 3.4, 18, col("of_wall", "#d9d6cf"), -5.4, 1.7, 3.5), box(0.2, 3.4, 18, col("of_wall", "#d9d6cf"), 5.4, 1.7, 3.5));
    const ceil = box(11, 0.1, 18, col("of_ceiling", "#e6e4de"), 0, 3.4, 3.5); ceil.castShadow = false;
    off.add(ceil);
    const panel = glow(1.9, 1.95, 2.0);
    for (const px of [-2.6, 0, 2.6]) for (let pz = -2; pz <= 10; pz += 3) off.add(noink(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.6), panel)).translateX(px).translateY(3.33).translateZ(pz));
    const deskMat = col("of_desk", "#b9a68c"), part = col("of_partition", "#a3acb8"), mon = col("of_monitor", "#2d323d"), chair = col("of_chair", "#4d5564");
    const desks: [number, number][] = [[0, 0], [-1.85, 2.6], [1.85, 2.6], [0, 5.2], [-1.85, 7.8], [1.85, 7.8]];
    for (const [dx, dz] of desks) {
      off.add(box(1.5, 0.06, 0.8, deskMat, dx, 0.75, dz), box(0.06, 0.72, 0.7, deskMat, dx - 0.7, 0.36, dz), box(0.06, 0.72, 0.7, deskMat, dx + 0.7, 0.36, dz));
      off.add(box(0.46, 0.32, 0.04, mon, dx + 0.42, 1.0, dz - 0.18), box(0.06, 0.12, 0.06, mon, dx + 0.42, 0.82, dz - 0.16), box(0.4, 0.02, 0.14, col("of_keys", "#e9e7e1"), dx, 0.79, dz + 0.12));
      off.add(noink(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), glow(0.75, 0.95, 1.25))).translateX(dx + 0.42).translateY(1.0).translateZ(dz - 0.155));
      off.add(box(0.06, 1.25, 1.9, part, dx - 0.9, 0.62, dz + 0.35));
      off.add(box(0.5, 0.07, 0.48, chair, dx, 0.47, dz + 0.66), box(0.46, 0.55, 0.06, chair, dx, 0.82, dz + 0.92), box(0.07, 0.44, 0.07, chair, dx, 0.22, dz + 0.66));
    }
    const cal = sign(0.7, 0.82, calendarTex());
    cal.g.position.set(1.2, 2.0, 11.38); cal.g.rotation.y = Math.PI;
    off.add(cal.g);
    off.add(box(0.5, 1.0, 0.5, col("of_cooler", "#dfe6ee"), -4.6, 0.5, 4.2), box(0.34, 0.5, 0.34, col("of_bottle", "#8fc6ea"), -4.6, 1.25, 4.2));
    mergeStatic(off);
    const outfits = [{ jacket: "#6b7382", tie: "#3f5a8a", hair: "#2a2a2a" }, { jacket: "#7a7f8a", tie: "#4f6a4f", hair: "#8a5a34" }, { jacket: "#646c7c", tie: "#7a4a6a", hair: "#c9a36a" }];
    outfits.forEach((o) => this.coworkers.push(new HeroRig25D(off, o)));
  }

  // ---- 3. APARTMENT (Shots 6-9): front door with mail slot, the SOMEDAY list, floor lamp ----
  private buildApartment() {
    const ap = this.sets.apartment;
    ap.add(box(12, 0.1, 9, col("ap_floor", "#a9794f"), 0, -0.05, -1.5));
    ap.add(box(12, 3.2, 0.3, col("ap_wall", "#d8c7a8"), 0, 1.6, 2.35));              // wall face at z = 2.2
    ap.add(box(12, 0.14, 0.34, col("ap_skirting", "#f2ebdc"), 0, 0.07, 2.34));
    ap.add(box(1.2, 2.24, 0.06, col("ap_frame", "#f2ebdc"), -0.9, 1.12, 2.19), box(1.0, 2.1, 0.06, col("ap_door", "#3f7f86"), -0.9, 1.05, 2.17));
    ap.add(box(0.3, 0.07, 0.03, col("ap_brass", "#e3b94f"), -0.9, 1.0, 2.13), box(0.09, 0.09, 0.07, col("ap_brass", "#e3b94f"), -0.52, 1.08, 2.12));
    ap.add(box(0.86, 0.025, 0.55, col("ap_mat", "#b5564e"), -0.9, 0.012, 1.7));
    const list = sign(0.5, 0.68, listTex(), "#f3e7b8");
    list.g.position.set(0.75, 1.5, 2.185); list.g.rotation.set(0, Math.PI, 0.03);
    ap.add(list.g);
    // floor lamp (warm HDR shade) + framed picture, behind the postcard inserts
    ap.add(box(0.05, 1.42, 0.05, col("ap_lamp_pole", "#3a3f4a"), 2.95, 0.71, 1.9), box(0.3, 0.04, 0.3, col("ap_lamp_pole", "#3a3f4a"), 2.95, 0.02, 1.9));
    ap.add(noink(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.3, 18), glow(2.6, 1.85, 0.95))).translateX(2.95).translateY(1.55).translateZ(1.9));
    ap.add(box(0.5, 0.62, 0.04, col("ap_picframe", "#6b4a34"), 1.95, 1.85, 2.17), box(0.4, 0.52, 0.05, col("ap_pic", "#8fb6c9"), 1.95, 1.85, 2.16));
    ap.add(box(0.7, 0.5, 0.42, col("ap_cabinet", "#7b5a3c"), 1.7, 0.25, 1.95));
    // warm sconce + its light pool on the door (additive, unlit)
    ap.add(noink(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glow(2.8, 1.9, 0.9))).translateX(-0.22).translateY(1.78).translateZ(2.1));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: haloTex(), color: new THREE.Color(0.55, 0.34, 0.14),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(-0.45, 1.5, 2.1);
    ap.add(noink(pool));
    // moonlit window left of the door
    ap.add(box(1.3, 1.3, 0.05, col("ap_frame", "#f2ebdc"), -2.6, 1.6, 2.19));
    ap.add(noink(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateY(Math.PI), glow(0.35, 0.5, 0.95))).translateX(-2.6).translateY(1.6).translateZ(2.16));

    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshBasicMaterial({ map: postcardTex(k % 3), side: THREE.DoubleSide }));
      m.geometry.rotateY(Math.PI); // printed side toward the room (-z)
      m.layers.set(NOINK);
      this.fallCards.push(m);
      ap.add(m);
    }
    this.postcard = sign(0.42, 0.588, postcardTex(0), "#fffaf0");
    const thumbMat = new THREE.MeshBasicMaterial({ color: "#241726" });
    for (const sx of [-1, 1]) {
      const th = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), thumbMat);
      th.scale.set(1, 1.25, 0.5); th.position.set(sx * 0.165, -0.262, -0.02);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), thumbMat);
      arm.position.set(sx * 0.36, -0.42, -0.04); arm.rotation.z = sx * 0.9;
      this.thumbs.add(noink(th), noink(arm));
    }
    this.postcard.g.add(this.thumbs);
    ap.add(this.postcard.g);
    mergeStatic(ap);
    this.phone = box(0.07, 0.14, 0.02, col("ap_phone", "#22252c"));
    this.ticket = sign(0.44, 0.2, ticketTex(), "#fff7e3");
    ap.add(this.phone, this.ticket.g);
  }

  // ---- 4. BEACH AT SUNSET (Shots 10-14): sun over the sea (+z); the surf shack throws a long shade toward -z ----
  private buildBeach() {
    const be = this.sets.beach;
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(500, 420).rotateX(-Math.PI / 2), col("be_sand", "#ecd9a8"));
    sand.position.set(0, 0, -199); sand.receiveShadow = true;                            // z -409..11
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(500, 2.6).rotateX(-Math.PI / 2), col("be_wet", "#b79c7c"));
    wet.position.set(0, 0.004, 9.9); wet.receiveShadow = true;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: untone("#e0926c") }));
    sea.position.set(0, 0.008, 360.6);
    const seaNear = new THREE.Mesh(new THREE.PlaneGeometry(900, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: untone("#7fa3b4"), transparent: true, opacity: 0.55, depthWrite: false }));
    seaNear.position.set(0, 0.012, 16.6);
    be.add(sand, wet, sea, noink(seaNear));
    for (let k = 0; k < 2; k++) {
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(500, 0.16).rotateX(-Math.PI / 2), glow(1.25, 1.1, 1.0));
      this.foam.push(noink(fm));
      be.add(fm);
    }
    this.glints = new THREE.Mesh(new THREE.PlaneGeometry(26, 170).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glintTex(), color: new THREE.Color(2.6, 1.5, 0.6), transparent: true, depthWrite: false, fog: false }));
    be.add(noink(this.glints));
    // surf shack: x -3.6..-0.4, z 1.5..4.0
    const plank = col("be_plank", "#d9a066"), roofM = col("be_roof", "#b5483e"), white = col("be_white", "#f5efe0");
    be.add(box(3.2, 3.0, 2.5, plank, -2.0, 1.5, 2.75));
    for (let k = 0; k < 4; k++) be.add(box(0.08, 3.0, 2.54, white, -3.4 + k * 0.93, 1.5, 2.75));
    const rf = box(3.7, 0.14, 1.75, roofM, -2.0, 3.32, 2.02); rf.rotation.x = -0.42;
    const rb = box(3.7, 0.14, 1.75, roofM, -2.0, 3.32, 3.48); rb.rotation.x = 0.42;
    be.add(rf, rb, box(3.2, 0.5, 2.3, plank, -2.0, 3.2, 2.75));
    be.add(box(1.5, 1.0, 0.08, col("be_shutter", "#2a8fa3"), -2.4, 1.7, 1.47), box(0.8, 1.9, 0.08, col("be_shutter", "#2a8fa3"), -1.0, 0.95, 1.47));
    const ss = sign(1.9, 0.62, shackSignTex(), "#fff7e3");
    ss.g.position.set(-2.0, 2.72, 1.44); ss.g.rotation.y = Math.PI;
    be.add(ss.g);
    const b1 = box(0.5, 2.0, 0.07, col("be_board1", "#ffd23f"), -3.3, 1.0, 1.25); b1.rotation.x = 0.14;
    be.add(b1);
    // the shadow's little camp, in the sun: towel + drink
    be.add(box(1.0, 0.02, 1.7, col("be_towel", "#e5574f"), BEACH_SEAT[0], 0.012, BEACH_SEAT[2] + 0.25));
    for (let k = 0; k < 3; k++) be.add(box(1.0, 0.022, 0.16, white, BEACH_SEAT[0], 0.013, BEACH_SEAT[2] - 0.3 + k * 0.55));
    be.add(box(0.1, 0.16, 0.1, col("be_cup", "#f5efe0"), BEACH_SEAT[0] + 0.62, 0.08, BEACH_SEAT[2] + 0.2), box(0.02, 0.2, 0.02, roofM, BEACH_SEAT[0] + 0.64, 0.22, BEACH_SEAT[2] + 0.2));
    // palms + dunes
    const trunk = col("be_trunk", "#8a6240"), frond = col("be_frond", "#4f9a55");
    const palm = (x: number, z: number, h: number, leanX: number) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, h, 8).translate(0, h / 2, 0), trunk);
      tr.castShadow = true; tr.rotation.z = -leanX;
      g.add(tr);
      const top = new THREE.Group();
      top.position.set(Math.sin(leanX) * h, Math.cos(leanX) * h, 0);
      for (let k = 0; k < 7; k++) {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 1.9).translate(0, 0, 0.95), frond);
        fr.castShadow = true;
        fr.rotation.set(0.5 + 0.25 * hash(k + x), (k / 7) * Math.PI * 2, 0, "YXZ");
        top.add(fr);
      }
      g.add(top);
      g.position.set(x, 0, z);
      be.add(g);
    };
    palm(5.4, 7.2, 4.6, 0.22); palm(-6.0, 6.4, 5.2, -0.18); palm(7.6, 3.0, 5.0, 0.12);
    palm(-4.2, -11, 5.4, -0.15); palm(3.4, -14, 4.8, 0.2); palm(-1.2, -19, 5.6, 0.1); palm(7.5, -22, 5.0, -0.2); palm(-8, -24, 5.2, 0.15);
    for (const [dx, dz, s] of [[-9, -30, 9], [6, -34, 11], [-22, -38, 13], [22, -30, 10], [0, -46, 15]]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), col("be_dune", "#e3cd98"));
      d.scale.set(s, s * 0.22, s * 0.7); d.position.set(dx, -0.05, dz); d.receiveShadow = true;
      be.add(d);
    }
    mergeStatic(be);
    // kicked-off shoes
    const shoeGeo = new THREE.SphereGeometry(0.06, 14, 10).scale(1.0, 0.75, 1.9);
    for (let k = 0; k < 2; k++) { const sh = new THREE.Mesh(shoeGeo, col("be_shoe", "#3a2c28")); sh.castShadow = true; this.shoes.push(sh); be.add(sh); }
    // sun disc + halo (camera-anchored, HDR -> bloom)
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(24, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(7.5, 4.6, 1.9), fog: false, transparent: true, depthWrite: false }));
    this.sunHalo = new THREE.Mesh(new THREE.CircleGeometry(150, 40), new THREE.MeshBasicMaterial({ map: haloTex(), color: new THREE.Color(1.5, 0.75, 0.3), fog: false,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -5; this.sunHalo.renderOrder = -6;
    be.add(noink(this.sunDisc), noink(this.sunHalo));
  }

  private shotSun(id: number, L: typeof LIGHTS.day) {
    let v = this.sunCache.get(id);
    if (v) return v;
    const s = SHOTS[id - 1];
    const w = SUN_WORLD[s.set];
    if (w) v = new THREE.Vector3(...w).normalize();
    else {
      const c = camAt(id, Math.floor((s.a + s.b) / 2));
      const fx = c.look[0] - c.pos[0], fz = c.look[2] - c.pos[2], n = Math.hypot(fx, fz) || 1;
      const ux = fx / n, uz = fz / n;
      const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
      const hx = ux * Math.cos(az) - uz * Math.sin(az), hz = uz * Math.cos(az) + ux * Math.sin(az);
      v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    }
    this.sunCache.set(id, v);
    return v;
  }

  /** Hang the briefcase from a hand of the man's rig (after pose()) */
  private carry(side: "L" | "R", yaw: number, swing = 0) {
    this.man.handWorld(side, this.tmpV);
    this.briefcase.visible = true;
    this.briefcase.position.copy(this.tmpV);
    this.briefcase.rotation.set(swing, yaw + Math.PI / 2, 0, "YXZ");
  }

  private holdBetween(rig: HeroRig25D, obj: THREE.Object3D, yaw: number, fwd = 0.04, dy = 0) {
    rig.handWorld("L", this.tmpV); rig.handWorld("R", this.tmpV2);
    obj.position.copy(this.tmpV).add(this.tmpV2).multiplyScalar(0.5);
    obj.position.x += Math.sin(yaw) * fwd; obj.position.z += Math.cos(yaw) * fwd; obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.visible = true;
  }

  private poseStreet(id: number, f: number, t: number) {
    const sd = shadowDir("street");
    const h0 = Math.atan2(-sd.dx, -sd.dz);              // lying heading: card points along the shadow direction
    const L0 = Math.min(2.0, 1.6 * sd.perM);
    const mx = 0, mz = 0.3;
    const blink = Math.floor(f / 3) % 41 === 0 ? 1 : 0;
    this.streetScroll.position.x = -(scrollAt(f) % 16);
    for (const s of this.strands) s.visible = false;

    if (id === 1) {
      // The hook. f14-36 the flat shadow slides free, f36-72 hinges upright, f86 (cut) it is a person: stretches, strolls off.
      const look = smooth((f - 30) / 12);
      this.man.pose({ pos: [mx, 0, mz], yaw: 2.65, expr: f >= 44 ? "shock" : "neutral", blink: f < 30 ? blink : 0,
        headYaw: -0.75 * look, headPitch: 0.28 * (1 - look),
        handL: [-0.12 - 0.14 * look, 1.04 - 0.24 * look, 0.3 - 0.18 * look], handR: [0.27, 0.78, 0.1] });
      this.carry("R", 2.65);
      const bx = mx + sd.dx * 1.1, bz = mz + sd.dz * 1.1;
      if (f < 86) {
        const slide = 1.1 * smooth((f - 14) / 22), k = smooth((f - 36) / 36);
        const stretch = 1 + 0.07 * Math.sin(Math.max(0, f - 72) * 0.45) * smooth((f - 72) / 6);
        this.flat.set(mx + sd.dx * slide, mz + sd.dz * slide, lerp(h0, -Math.PI, k), k, lerp(L0, 1.7, k) * stretch, k > 0.6 ? 3 : 0);
      } else {
        const up = smooth((f - 88) / 12) * (1 - smooth((f - 106) / 10));
        const turn = smooth((f - 114) / 10);
        const walked = Math.max(0, f - 124) / FPS * 1.1;
        const g = walked > 0 ? gait(walked * Math.PI / 0.56, 0.28, 0.1) : {};
        this.shadow.pose({ pos: [bx + walked, 0, bz], yaw: lerp(Math.PI, Math.PI / 2, turn), lean: -0.14 * up, expr: "grin",
          headPitch: -0.25 * up, blink: f > 100 && f < 106 ? 1 : 0,
          handL: [-0.3 - 0.1 * up, 0.78 + 1.0 * up, 0.06], handR: [0.3 + 0.1 * up, 0.78 + 1.0 * up, 0.06], ...g });
      }
    } else if (id === 2) {
      // Commute treadmill -> stop -> the shadow stretches away from his heels and snaps free (f300)
      const v = walkSpeedMps(f) / 1.3;
      const ph = scrollAt(f) * Math.PI / 0.6;
      const down = smooth((f - 286) / 10);
      const hop = f >= 300 ? 0.1 * Math.sin(Math.min(1, (f - 300) / 9) * Math.PI) : 0;
      const g = gait(ph, 0.3, 0.1, 0.2, v);
      this.man.pose({ pos: [mx, hop + 0.02 * Math.abs(Math.sin(ph)) * v, mz], yaw: Math.PI / 2, lean: 0.06 * v, blink,
        expr: f >= 300 ? "shock" : "neutral", headPitch: 0.5 * down, ...g, handR: [0.27, 0.8, 0.04] });
      this.carry("R", Math.PI / 2, 0.12 * Math.sin(ph) * v);
      const pull = 0.5 * smooth((f - 284) / 16), snap = f >= 300 ? 0.2 + 0.3 * smooth((f - 300) / 30) : 0;
      const d = pull + snap, k = 0.24 * smooth((f - 302) / 30);
      this.flat.set(mx + sd.dx * d, mz + sd.dz * d, h0, k, L0 * (1 + 0.03 * Math.sin(ph) * v));
      if (f >= 284 && f < 300) {
        this.strands.forEach((s, i) => {
          s.visible = true;
          s.position.set(mx + (i ? 0.02 : -0.02), 0.021, mz + (i ? 0.11 : -0.11));
          s.rotation.set(0, h0, 0);
          s.scale.set(0.1 * (1 - 0.75 * pull / 0.5), 1, d + 0.12);
        });
      }
    } else if (id === 3) {
      // "Hey! You can't leave. You're attached!" / "Not anymore."
      const mYaw = 1.7, point = smooth((f - 350) / 6), hop = f < 352 ? 0.09 * Math.sin(clamp(f - 339, 0, 11) / 11 * Math.PI) : 0;
      this.man.pose({ pos: [mx, hop, mz], yaw: mYaw, expr: "stern", mouthOpen: talk("man", f), lean: 0.1 * point, headYaw: 0.3,
        handL: [-0.1 - 0.17 * (1 - point), 0.8 + 0.5 * point + 0.03 * Math.sin(f * 0.8) * point, 0.1 + 0.52 * point], handR: [0.27, 0.78, 0.1] });
      this.carry("R", mYaw);
      const shrug = smooth((f - 408) / 8) * (1 - smooth((f - 428) / 8)), go = smooth((f - 432) / 8);
      this.shadow.pose({ pos: [1.9 + 0.5 * go * go, 0, 0.9], yaw: lerp(-1.88, Math.PI / 2 - 6.283, go) , expr: "grin", mouthOpen: talk("shadow", f),
        lean: 0.3 * go, headYaw: -0.3 * go,
        handL: [-0.3 - 0.16 * shrug, 0.78 + 0.34 * shrug, 0.1], handR: [0.3 + 0.16 * shrug, 0.78 + 0.34 * shrug, 0.1] });
    } else if (id === 4) {
      // Chase: he sprints with the briefcase; the shadow pulls away, whips past the lens; he gives up (briefcase drops f556)
      const v = walkSpeedMps(f) / 4.2;
      const ph = scrollAt(f) * Math.PI / 0.95;
      const quit = smooth((f - 536) / 20);
      const g = gait(ph, 0.44, 0.24, 0.34, v);
      const dropped = f >= 548;
      this.man.pose({ pos: [mx, 0.05 * Math.abs(Math.sin(ph)) * v, mz], yaw: Math.PI / 2, lean: 0.26 * v + 0.5 * quit, expr: "pained",
        mouthOpen: 0.35 + 0.3 * Math.abs(Math.sin(t * 9)), headPitch: -0.2 * v + 0.15 * quit, ...g,
        handL: quit > 0 ? [-0.14, lerp(0.8, 0.62, quit), lerp(0.06, 0.3, quit)] : g.handL,
        handR: quit > 0 ? [0.14, lerp(0.8, 0.62, quit), lerp(0.06, 0.3, quit)] : g.handR });
      if (!dropped) this.carry("R", Math.PI / 2, 0.5 * Math.sin(ph) * v);
      else {
        const fall = clamp((f - 548) / 8, 0, 1);
        this.briefcase.visible = true;
        this.briefcase.position.set(mx + 0.42, lerp(0.7, 0.3, fall * fall) + (f >= 556 ? 0.06 * Math.abs(Math.sin((f - 556) * 0.7)) * Math.exp(-(f - 556) / 5) : 0), mz - 0.3);
        this.briefcase.rotation.set(0, 0.3, 0);
      }
      if (f < 515) {
        const sph = (scrollAt(f) + shadowLeadX(f)) * Math.PI / 0.8;
        this.shadow.pose({ pos: [shadowLeadX(f), 0.05 * Math.abs(Math.sin(sph)), 0.55], yaw: Math.PI / 2, lean: 0.3, expr: "grin",
          ...gait(sph, 0.46, 0.26, 0.36) });
      }
    }
  }

  private poseOffice(f: number, t: number) {
    const type = (k: number) => 0.035 * Math.abs(Math.sin(t * 15 + k * 1.7));
    const lookDown = smooth((f - 653) / 16);
    this.man.pose({ pos: [0, -0.08, 0.6], yaw: Math.PI, expr: "neutral", blink: Math.floor(f / 3) % 29 === 0 ? 1 : 0,
      headYaw: -1.3 * lookDown, headPitch: 0.12 + 0.22 * lookDown, lean: 0.06,
      handL: lookDown > 0 ? [lerp(-0.14, -0.36, lookDown), lerp(0.9, 0.62, lookDown), lerp(0.42, 0.1, lookDown)] : [-0.14, 0.9 + type(0), 0.42],
      handR: [0.14, 0.9 + (lookDown > 0.5 ? 0 : type(1)), 0.42], footL: [-0.1, 0.12, 0.3], footR: [0.1, 0.12, 0.34] });
    const seats: [number, number][] = [[-1.85, 2.6], [1.85, 2.6], [0, 5.2]];
    this.coworkers.forEach((r, i) => {
      r.pose({ pos: [seats[i][0], -0.08, seats[i][1] + 0.6], yaw: Math.PI, expr: "neutral", headPitch: 0.14 + 0.03 * Math.sin(t * 2 + i),
        blink: Math.floor((f + i * 11) / 3) % 31 === 0 ? 1 : 0,
        handL: [-0.14, 0.9 + type(i + 2), 0.42], handR: [0.14, 0.9 + type(i + 5), 0.42], footL: [-0.1, 0.12, 0.3], footR: [0.1, 0.12, 0.34] });
    });
  }

  private poseApartment(id: number, f: number, t: number) {
    for (const c of this.fallCards) c.visible = false;
    this.postcard.g.visible = false;
    this.phone.visible = false;
    this.ticket.g.visible = false;
    if (id === 6) {
      // Postcards drop through the mail slot and pile up on the mat
      this.fallCards.forEach((c, i) => {
        const t0 = 760 + i * 8.5, a = (f - t0) / FPS;
        if (a < 0) return;
        c.visible = true;
        const tl = 0.62 + 0.05 * i, u = Math.min(1, a / tl), e = u * u;
        const lx = -0.9 + (hash(i * 3.1) - 0.5) * 0.5, lz = 1.72 - hash(i * 5.7) * 0.3;
        c.position.set(lerp(-0.9, lx, u) + 0.06 * Math.sin(a * 14 + i) * (1 - u), lerp(1.0, 0.03 + i * 0.006, e), lerp(2.1, lz, Math.sqrt(u)));
        c.rotation.set(lerp(-0.2, Math.PI / 2, smooth(u * 1.15)) + 0.5 * Math.sin(a * 11 + i * 2) * (1 - u), 0, (hash(i * 9.3) - 0.5) * 1.4 * u, "YXZ");
      });
    } else if (id === 7) {
      // Held-up postcard inserts: rollercoaster (814), surfing (864), wedding (917)
      const seg = f < 864 ? 0 : f < 917 ? 1 : 2, s0 = [814, 864, 917][seg];
      (this.postcard.face.material as THREE.MeshBasicMaterial).map = postcardTex(seg);
      this.postcard.g.visible = true;
      this.postcard.g.position.set(2.4 + 0.004 * Math.sin(t * 1.7), 1.32 + 0.006 * Math.sin(t * 2.3) - 0.05 * (1 - smooth((f - s0) / 8)), 0.6);
      this.postcard.g.rotation.set(-0.05, Math.PI, 0.02 * Math.sin(t * 1.3 + seg * 2));
    } else if (id === 8) {
      // Over his shoulder: the list he pinned up years ago
      const droop = smooth((f - 1052) / 18);
      this.man.pose({ pos: [0.2, 0, 0.75], yaw: 0.2, expr: "neutral", headPitch: -0.16 + 0.34 * droop, headYaw: 0.1,
        handL: [-0.25, 0.78, 0.1], handR: [0.25, 0.78, 0.1] });
    } else if (id === 9) {
      if (f < 1124) {
        // "calls in sick": phone to the ear, theatrical cough into his fist
        const cough = smooth((f - 1094) / 5) * (1 - smooth((f - 1116) / 5));
        const hack = cough * Math.abs(Math.sin((f - 1094) * 0.8));
        const yaw = Math.PI - 0.12;
        this.man.pose({ pos: [0.05, 0, 0.9], yaw, expr: cough > 0.3 ? "pained" : "grin", lean: 0.12 * hack, headPitch: 0.1 * hack,
          mouthOpen: cough > 0.3 ? 0.3 + 0.6 * hack : 0.4 * Math.abs(Math.sin(t * 12)),
          handR: [0.21, 1.38, 0.1], handL: [lerp(-0.25, -0.03, cough), lerp(0.78, 1.27, cough), lerp(0.1, 0.24, cough)] });
        this.man.handWorld("R", this.tmpV);
        this.phone.visible = true;
        this.phone.position.copy(this.tmpV).add(this.tmpV2.set(0.02, 0.03, -0.02));
        this.phone.rotation.set(0, yaw, 0.2);
      } else {
        // "buys a ticket": ONE WAY - THE BEACH
        const pop = 1 - smooth((f - 1124) / 7), bob = 0.012 * Math.sin(t * 7);
        this.man.pose({ pos: [0.05, 0, 0.9], yaw: Math.PI, expr: "grin", headPitch: 0.12,
          handL: [-0.21, 1.0 + bob + 0.1 * pop, 0.34], handR: [0.21, 1.0 + bob + 0.1 * pop, 0.34] });
        this.holdBetween(this.man, this.ticket.g, Math.PI, 0.03, 0.02);
        this.ticket.g.rotation.x = 0.12;
      }
    }
  }

  private poseBeach(id: number, f: number, t: number, cam: THREE.PerspectiveCamera, sunDir: THREE.Vector3) {
    const sd = shadowDir("beach");
    const h0 = Math.atan2(-sd.dx, -sd.dz);
    // sun disc + halo ride with the camera (they are at infinity); glitter strip runs from the shore toward the sun
    this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 760);
    this.sunHalo.position.copy(cam.position).addScaledVector(sunDir, 770);
    this.sunDisc.lookAt(cam.position); this.sunHalo.lookAt(cam.position);
    const az = Math.atan2(sunDir.x, sunDir.z);
    this.glints.position.set(cam.position.x + Math.tan(az) * (96 - cam.position.z), 0.02, 96);
    this.glints.rotation.y = az;
    (this.glints.material as THREE.MeshBasicMaterial).map!.offset.y = (t * 0.012) % 1;
    this.foam.forEach((m, k) => m.position.set(0, 0.016, 10.7 + k * 1.5 + 0.45 * Math.sin(t * 0.9 + k * 2.1)));
    for (const s of this.shoes) s.visible = false;
    const shade = (x: number, z: number) => { const k = beachLit(x, z); this.tint.setRGB(lerp(0.5, 1, k), lerp(0.52, 1, k), lerp(0.74, 1, k)); this.man.setTint(this.tint); };
    const seated = (yaw: number, extra: Partial<RigPose> = {}) => this.shadow.pose({ pos: BEACH_SEAT, yaw, lean: -0.16, expr: "smile",
      handL: [-0.36, 0.6, -0.22], handR: [0.36, 0.6, -0.22], footL: [-0.14, 0.6, 0.62], footR: [0.14, 0.6, 0.58], ...extra });
    const blink = Math.floor(f / 3) % 43 === 0 ? 1 : 0;

    if (id === 10) {
      if (f < 1218) {
        // He trudges in through the shack's shade; the shadow is a tiny figure in the sun by the water
        const u = smooth((f - 1150) / 58), z = lerp(-5.4, BEACH_MAN[2], u), walking = u < 1 ? 1 : 0;
        this.man.pose({ pos: [BEACH_MAN[0], 0, z], yaw: 0, expr: "neutral", ...gait((z + 5.4) * Math.PI / 0.56, 0.28, 0.1, 0.2, walking) });
        shade(BEACH_MAN[0], z);
        seated(0);
      } else if (f < 1259) {
        // "Why did you leave me?"
        const plea = smooth((f - 1220) / 8);
        this.man.pose({ pos: BEACH_MAN, yaw: 0.14, expr: "stern", mouthOpen: talk("man", f), blink,
          handL: [-0.27 - 0.12 * plea, 0.78 + 0.2 * plea, 0.1 + 0.2 * plea], handR: [0.27 + 0.12 * plea, 0.78 + 0.2 * plea, 0.1 + 0.2 * plea] });
        shade(BEACH_MAN[0], BEACH_MAN[2]);
      } else {
        // Behind the shadow: it only ever looks at the sun
        seated(0, { headYaw: -0.5 * smooth((f - 1305) / 24), expr: "neutral" });
      }
    } else if (id === 11) {
      // "...he hadn't stood in the sun for years": from the shade he looks down at its edge, then up at the light
      const up = smooth((f - 1380) / 18);
      this.man.pose({ pos: BEACH_MAN, yaw: 0.1, expr: "neutral", headPitch: 0.4 - 0.55 * up, headYaw: -0.2 * up,
        handL: [-0.26, 0.78, 0.08], handR: [0.26, 0.78, 0.08] });
      shade(BEACH_MAN[0], BEACH_MAN[2]);
      seated(0, { headYaw: -0.5, expr: "neutral" });
    } else if (id === 12) {
      // "I didn't leave. I just got tired of waiting."
      const pat = smooth((f - 1452) / 8), tap = 0.05 * Math.abs(Math.sin((f - 1452) * 0.45)) * pat;
      seated(-2.94, { expr: f >= 1436 && f < 1446 ? "neutral" : "smile", mouthOpen: talk("shadow", f), headYaw: 0.1 * Math.sin(t * 1.2),
        headPitch: -0.05, blink: f >= 1437 && f < 1441 ? 1 : 0, lean: -0.1,
        handR: [0.36 + 0.14 * pat, 0.6 + tap, -0.22 + 0.42 * pat] });
    } else if (id === 13) {
      const kickL = smooth((f - 1507) / 5) * (1 - smooth((f - 1514) / 6)), kickR = smooth((f - 1523) / 5) * (1 - smooth((f - 1530) / 6));
      const offL = f >= 1513, offR = f >= 1529;
      this.man.setBarefoot(offL, offR);
      // shoes: on his feet (rig boots) -> short arcs -> resting in the sand
      const shoe = (i: number, t0: number, to: V3, spin: number) => {
        if (f < t0) return;
        const u = clamp((f - t0) / 6, 0, 1), sh = this.shoes[i];
        const from: V3 = [BEACH_MAN[0] + (i ? 0.11 : -0.11), 0.28, BEACH_MAN[2] + 0.45];
        sh.visible = true;
        sh.position.set(lerp(from[0], to[0], u), lerp(from[1], 0.05, u) + 0.5 * Math.sin(u * Math.PI), lerp(from[2], to[2], u));
        sh.rotation.set(spin * 3 * u + (1 - u) * 0.4, spin + u * 2, 0.2 * spin);
      };
      shoe(0, 1513, [-1.25, 0.05, -0.9], 1.1); shoe(1, 1529, [0.35, 0.05, -0.6], -0.9);

      if (f < 1550) {
        this.man.pose({ pos: [BEACH_MAN[0], 0.03 * (kickL + kickR), BEACH_MAN[2]], yaw: 0, expr: "smile",
          footL: [-0.11, 0.04 + 0.26 * kickL, 0.05 + 0.4 * kickL], footR: [0.11, 0.04 + 0.26 * kickR, 0.05 + 0.4 * kickR],
          handL: [-0.3 - 0.1 * kickR, 0.8 + 0.1 * kickR, 0.05], handR: [0.3 + 0.1 * kickL, 0.8 + 0.1 * kickL, 0.05] });
        shade(BEACH_MAN[0], BEACH_MAN[2]);
        seated(-2.94);
        return;
      }
      // He walks out of the shade (f1552-1606) and stands in the sun; the shadow gets up and jogs round behind him
      const u = clamp((f - 1552) / 54, 0, 1), e = smooth(u);
      const px = lerp(BEACH_MAN[0], BEACH_LIT[0], e), pz = lerp(BEACH_MAN[2], BEACH_LIT[2], e);
      const dist = Math.hypot(BEACH_LIT[0] - BEACH_MAN[0], BEACH_LIT[2] - BEACH_MAN[2]) * e;
      const heading = Math.atan2(BEACH_LIT[0] - BEACH_MAN[0], BEACH_LIT[2] - BEACH_MAN[2]);
      const arrived = smooth((f - 1604) / 10);
      const lookBack = smooth((f - 1622) / 12);
      this.man.pose({ pos: [px, 0, pz], yaw: lerp(heading, 0.1, arrived), expr: "smile", blink: f > 1606 && f < 1612 ? 1 : 0,
        headPitch: -0.22 * arrived + 0.5 * lookBack, headYaw: 0.55 * lookBack,
        ...gait(dist * Math.PI / 0.56, 0.28, 0.1, 0.2, u > 0 && u < 1 ? 1 : 0),
        ...(arrived > 0 ? { handL: [-0.3 - 0.14 * arrived, 0.8 + 0.06 * arrived, 0.06] as V3, handR: [0.3 + 0.14 * arrived, 0.8 + 0.06 * arrived, 0.06] as V3 } : {}) });
      shade(px, pz);
      const qx = BEACH_LIT[0] + sd.dx * 1.3, qz = BEACH_LIT[2] + sd.dz * 1.3;
      if (f < 1612) {
        const rise = smooth((f - 1556) / 13), w = smooth((f - 1568) / 44);
        const sx = lerp(BEACH_SEAT[0], qx, w) + 1.0 * Math.sin(Math.PI * w), sz = lerp(BEACH_SEAT[2], qz, w);
        const w2 = Math.min(1, w + 0.02);
        const nx = lerp(BEACH_SEAT[0], qx, w2) + 1.0 * Math.sin(Math.PI * w2), nz = lerp(BEACH_SEAT[2], qz, w2);
        const yaw = w > 0 && w < 1 ? Math.atan2(nx - sx, nz - sz) : -2.94;
        const g = gait(w * 5.4 * Math.PI / 0.7, 0.4, 0.2, 0.3, w > 0 && w < 1 ? 1 : 0);
        this.shadow.pose({ pos: [sx, BEACH_SEAT[1] * (1 - rise), sz], yaw: lerp(-2.94, yaw, smooth(w * 6)), expr: "grin", lean: lerp(-0.16, 0.2 * (w < 1 ? 1 : 0), rise),
          footL: rise < 1 ? [-0.14, lerp(0.6, 0.04, rise), lerp(0.62, 0.05, rise)] : g.footL,
          footR: rise < 1 ? [0.14, lerp(0.6, 0.04, rise), lerp(0.58, 0.05, rise)] : g.footR,
          handL: rise < 1 ? [-0.36, lerp(0.6, 0.8, rise), lerp(-0.22, 0.06, rise)] : g.handL,
          handR: rise < 1 ? [0.36, lerp(0.6, 0.8, rise), lerp(-0.22, 0.06, rise)] : g.handR });
      } else {
        // ...and folds itself flat again, sliding its feet back to his heels
        const k = 1 - smooth((f - 1613) / 22), join = smooth((f - 1616) / 24);
        this.flat.set(lerp(qx, BEACH_LIT[0], join), lerp(qz, BEACH_LIT[2], join), lerp(h0, -0.62, k), k, lerp(2.7, 1.7, k), k > 0.6 ? 3 : 0);
      }
    } else if (id === 14) {
      // He walks inland with the sun behind him: for once the shadow leads and he follows. It waves first.
      const z = finalManZ(f), dist = (f - 1661) / FPS;
      const wave = f >= 1766 && f < 1822;
      const see = smooth((f - 1772) / 12);
      this.man.setBarefoot(true);
      this.man.setTint("#ffffff");
      const g = gait(dist * Math.PI / 0.52, 0.26, 0.09, 0.18);
      this.man.pose({ pos: [3.2, 0.015 * Math.abs(Math.sin(dist * Math.PI / 0.52)), z], yaw: Math.PI, expr: see > 0.5 ? "grin" : "smile",
        headPitch: 0.34 * see, blink: Math.floor(f / 3) % 37 === 0 ? 1 : 0, ...g,
        handR: f >= 1790 ? [0.3 + 0.12 * smooth((f - 1790) / 8), 0.8 + 0.5 * smooth((f - 1790) / 8), 0.12 + 0.03 * Math.sin(f * 0.7)] : g.handR });
      this.flat.set(3.2, z, h0, 0, 2.5 * (1 + 0.02 * Math.sin(dist * Math.PI / 0.52)), wave ? 1 + (Math.floor(f / 6) % 2) : 0);
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
    const Rr = s.set === "beach" ? 24 : 28;
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

    // 3. Reset the cast, then pose the active shot
    this.man.root.visible = false;
    this.shadow.root.visible = false;
    this.flat.root.visible = false;
    this.briefcase.visible = false;
    this.man.setTint("#ffffff");
    this.man.setBarefoot(false);

    if (s.set === "street") this.poseStreet(id, f, t);
    else if (s.set === "office") this.poseOffice(f, t);
    else if (s.set === "apartment") this.poseApartment(id, f, t);
    else this.poseBeach(id, f, t, cam, sunDir);

    return focus;
  }
}

function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }
