// Shared 3D studio for the Pant Snake films: the painted 9-segment sensor snake on a street-light pole,
// the cans inside it, the 12 belly coils, the cable, the pod and its key.
// Units: metres in the scene. Geometry from the light-pole snake v2 and the sensor snake (19 Oct 2026).
import * as THREE from '../three/three.module.min.js';

export const G = {
  R: 141.22, c: 65.145, dth: 1.505346, J0: 671.75, AZ0: 26.18 * Math.PI / 180,
  tubeR: 63, boreR: 60, n: 9, build: 'BBCBDCEEE', mouth: 1674.3, qrZ: 1397,
  qrAz: (85.6 - 86.25 * 2) * Math.PI / 180, viewAz: (66.8 - 86.25 * 2) * Math.PI / 180,
};
// tail centre line (pole frame: azimuth deg, height mm, radius mm, half-width mm), from the parts page
const TAIL = [[-58.36,418.2,155.9,63.0],[-57.49,403.1,151.2,63.0],[-55.41,390.1,143.6,63.0],[-56.15,377.4,147.7,63.0],[-58.36,367.8,158.3,61.2],[-57.06,353.5,154.5,46.9],[-54.64,341.3,146.5,34.7],[-53.66,337.0,146.5,30.4],[-53.53,353.0,145.4,46.4],[-53.52,368.8,143.2,62.2],[-53.8,384.6,140.7,63.0],[-54.02,400.5,139.1,63.0],[-53.82,416.5,138.5,63.0],[-53.18,432.4,138.4,63.0],[-52.1,448.2,138.3,63.0],[-50.54,463.7,138.4,63.0],[-48.58,479.0,138.3,63.0],[-46.28,494.0,138.5,63.0],[-43.62,508.6,139.8,63.0],[-40.6,522.7,140.9,63.0],[-37.39,536.6,141.9,63.0],[-33.88,550.0,142.3,63.0],[-30.03,562.8,142.5,63.0],[-25.89,575.0,142.5,63.0],[-21.5,586.7,142.4,63.0],[-16.89,597.9,142.3,63.0],[-12.07,608.5,142.3,63.0],[-7.08,618.6,142.2,63.0],[-1.93,628.3,142.2,63.0],[3.37,637.4,142.1,63.0],[8.8,646.0,142.1,63.0],[14.34,654.2,142.0,63.0],[19.96,662.1,142.1,63.0],[25.66,669.6,142.1,63.0]];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const polar = (az, zmm, rmm) => V(rmm * Math.cos(az) / 1000, zmm / 1000, -rmm * Math.sin(az) / 1000);
export const helixAt = (th, r = G.R) => polar(G.AZ0 + th, G.J0 + G.c * th, r);

/* ---------- the can path: from the tail floor up the tail, round the coil, into the head ---------- */
function buildPath() {
  const pts = [];
  for (let i = 7; i < TAIL.length; i++) pts.push(polar(TAIL[i][0] * Math.PI / 180, TAIL[i][1], TAIL[i][2]));
  // join smoothly onto the helix
  const thHead = 218 / Math.hypot(G.R, G.c);
  const thEnd = G.n * G.dth + thHead;
  const N = 400;
  for (let i = 1; i <= N; i++) pts.push(helixAt(thEnd * i / N));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  // distance (mm) where the coil starts (joint 0)
  const tailPts = pts.slice(0, TAIL.length - 7);
  let tailLen = 0; for (let i = 1; i < tailPts.length; i++) tailLen += tailPts[i].distanceTo(tailPts[i - 1]);
  return { curve, len: len * 1000, tailLen: tailLen * 1000, thEnd };
}
export const PATH = buildPath();
const UP = V(0, 1, 0);
// point, tangent (uphill) and belly direction at distance d (mm) from the tail floor
export function pathAt(dmm) {
  const u = THREE.MathUtils.clamp(dmm / PATH.len, 0, 1);
  const p = PATH.curve.getPointAt(u), t = PATH.curve.getTangentAt(u);
  const b = UP.clone().multiplyScalar(-1).addScaledVector(t, t.y).normalize();   // straight down, square to the tube
  return { p, t, b };
}
export const thetaToD = th => PATH.tailLen + th * Math.hypot(G.R, G.c);

/* ---------- coils: 12 tabs in the belly wall (9-segment build, tail up B B C B D C E E E) ---------- */
export const COILS = (() => {
  const out = []; const segMM = G.dth * Math.hypot(G.R, G.c);
  [...G.build].forEach((t, i) => {
    const th0 = i * G.dth;
    const at = f => ({ seg: i + 1, d: thetaToD(th0 + f * G.dth) });
    if (t === 'E') { out.push(at(1 / 3), at(2 / 3)); }
    else if (t === 'D') out.push({ seg: i + 1, d: thetaToD(th0 + G.dth) - 74 });
    else out.push(at(.5));
  });
  return out;                                       // 12, ordered from the tail up
})();
export const CHIPS = [{ seg: 3, coils: [0, 1, 2, 3] }, { seg: 5, coils: [4, 5, 6, 7] }, { seg: 8, coils: [8, 9, 10, 11] }];

/* ---------- small helpers ---------- */
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

async function loadSNK2(url) {
  const buf = await (await fetch(url)).arrayBuffer(), dv = new DataView(buf);
  const nv = dv.getUint32(4, true), nf = dv.getUint32(8, true), big = dv.getUint32(12, true);
  const lo = [0, 1, 2].map(i => dv.getFloat32(16 + 4 * i, true)), hi = [0, 1, 2].map(i => dv.getFloat32(28 + 4 * i, true));
  const s = [0, 1, 2].map(k => (hi[k] - lo[k]) / 65535);
  let off = 40;
  const q = new Uint16Array(buf, off, nv * 3); off += nv * 6;
  const uq = new Uint16Array(buf, off, nv * 2); off += nv * 4;
  const index = big ? new Uint32Array(buf.slice(off, off + nf * 12)) : new Uint16Array(buf.slice(off, off + nf * 6));
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    const x = lo[0] + q[3 * i] * s[0], y = lo[1] + q[3 * i + 1] * s[1], z = lo[2] + q[3 * i + 2] * s[2];
    pos[3 * i] = x / 1000; pos[3 * i + 1] = z / 1000; pos[3 * i + 2] = -y / 1000;
    uv[2 * i] = uq[2 * i] / 65535; uv[2 * i + 1] = uq[2 * i + 1] / 65535;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  // smooth normals across UV seams: weld by quantised position, keep sharp edges (> 50 deg) sharp
  const key = new Map(), id = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) { const k = q[3 * i] + ',' + q[3 * i + 1] + ',' + q[3 * i + 2]; let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } id[i] = v; }
  const fn = new Float32Array(nf * 3), acc = new Float32Array(key.size * 3), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let f = 0; f < nf; f++) {
    const a = index[3 * f], b = index[3 * f + 1], c = index[3 * f + 2];
    A.fromArray(pos, 3 * a); B.fromArray(pos, 3 * b); C.fromArray(pos, 3 * c);
    B.sub(A); C.sub(A); B.cross(C);                 // area weighted
    fn[3 * f] = B.x; fn[3 * f + 1] = B.y; fn[3 * f + 2] = B.z;
    for (const v of [a, b, c]) { const j = 3 * id[v]; acc[j] += B.x; acc[j + 1] += B.y; acc[j + 2] += B.z; }
  }
  const nrm = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { const j = 3 * id[i]; const l = Math.hypot(acc[j], acc[j + 1], acc[j + 2]) || 1; nrm[3 * i] = acc[j] / l; nrm[3 * i + 1] = acc[j + 1] / l; nrm[3 * i + 2] = acc[j + 2] / l; }
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}
// glow mask: where the livery uses the glow-in-the-dark green
function glowMask(img) {
  const k = Math.min(1, 512 / img.width);           // the mask needs no more detail than this
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const on = Math.abs(a[i] - 124) < 30 && Math.abs(a[i + 1] - 240) < 30 && Math.abs(a[i + 2] - 107) < 40;
    a[i] = a[i + 1] = a[i + 2] = on ? 255 : 0; a[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- the studio ---------- */
export async function createStudio({ canvas, base = 'assets/snake-v3/', onProgress = () => {} }) {
  // ask for the lightest context that still looks good; fall back step by step on weaker or busy machines
  let renderer = null, lastErr;
  for (const o of [{ antialias: true }, { antialias: false }, { antialias: false, powerPreference: 'low-power' }]) {
    try { renderer = new THREE.WebGLRenderer({ canvas, ...o }); break; } catch (e) { lastErr = e; }
  }
  if (!renderer) { const e = new Error('webgl'); e.code = 'webgl'; e.cause = lastErr; throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  // give the graphics memory back when the page is left; a page restored from the back button reloads
  addEventListener('pagehide', () => { renderer.dispose(); renderer.forceContextLoss(); });
  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#13171D'), NIGHT = new THREE.Color('#06080C');
  scene.background = BG.clone(); scene.fog = new THREE.Fog(BG.clone(), 7, 26);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 80);
  const headlight = new THREE.PointLight('#ffffff', 0, 0, 0); headlight.position.set(.3, .4, 0); camera.add(headlight); scene.add(camera);

  // studio light box for reflections
  const pmrem = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: '#10151b', side: THREE.BackSide })));
  [[V(0, 8, 0), 14, 3, '#ffffff'], [V(8, 3, 4), 2.5, 8, '#dbe9ff'], [V(-8, 2, -3), 2, 6, '#5CC8F0'], [V(2, 1.5, 9), 7, 1.2, '#fff1dc']].forEach(([p, w, h, c]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.copy(p); m.lookAt(0, 0, 0); env.add(m);
  });
  scene.environment = pmrem.fromScene(env, 0.04).texture;

  const hemi = new THREE.HemisphereLight('#c9dcf0', '#1a1f26', 1.1); scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff4e6', 3.4); key.position.set(2.6, 5.2, 3.4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.6, bottom: -.4, near: 1, far: 14 }); key.shadow.bias = -0.0003; key.shadow.normalBias = .01;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#5CC8F0', 1.6); rim.position.set(-4, 3, -3); scene.add(rim);
  const lamp = new THREE.SpotLight('#ffd9a0', 0, 9, .55, .6, 1.2); lamp.position.set(.95, 5.6, 0); lamp.target.position.set(.4, 0, 0); scene.add(lamp, lamp.target);

  // pavement and pole
  const pave = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#171c22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const s = 20 + Math.random() * 4; g.fillStyle = `rgb(${s},${s + 4},${s + 9})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); }
  });
  pave.wrapS = pave.wrapT = THREE.RepeatWrapping; pave.repeat.set(30, 30);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshStandardMaterial({ map: pave, roughness: .92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#7d868f', metalness: .75, roughness: .38 });
  const pole = new THREE.Group(); scene.add(pole);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.054, .064, 6, 64), poleMat); shaft.position.y = 3; shaft.castShadow = true; shaft.receiveShadow = true; pole.add(shaft);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.085, .09, .16, 48), poleMat); foot.position.y = .08; pole.add(foot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, 1.1, 24), poleMat); arm.rotation.z = Math.PI / 2 - .12; arm.position.set(.5, 5.95, 0); pole.add(arm);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(.5, .07, .2), new THREE.MeshStandardMaterial({ color: '#3a4149', metalness: .6, roughness: .4 })); lampHead.position.set(1.0, 6.0, 0); pole.add(lampHead);
  const lampLens = new THREE.Mesh(new THREE.PlaneGeometry(.44, .16), new THREE.MeshBasicMaterial({ color: '#2a2f35' })); lampLens.rotation.x = Math.PI / 2; lampLens.position.set(1.0, 5.963, 0); pole.add(lampLens);

  /* snake parts */
  const snake = new THREE.Group(); scene.add(snake);
  const MAN = await (await fetch(base + 'parts.json')).json(), manifest = MAN.parts;
  const parts = {}, mats = [], twins = [];
  const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, opacity: 0 });
  const tl = new THREE.TextureLoader();
  let done = 0;
  await Promise.all(manifest.map(async p => {
    const [geo, img] = await Promise.all([loadSNK2(base + p.file + '.bin'), p.tex ? tl.loadAsync(base + p.tex + '.webp') : null]);
    let mat;
    if (img) {
      img.flipY = false; img.colorSpace = THREE.SRGBColorSpace; img.anisotropy = 4;
      mat = new THREE.MeshPhysicalMaterial({ map: img, roughness: .42, clearcoat: .45, clearcoatRoughness: .28, envMapIntensity: 1.1,
        emissive: '#7CF06B', emissiveMap: glowMask(img.image), emissiveIntensity: 0 });
    } else mat = new THREE.MeshPhysicalMaterial({ color: p.color || '#0B2A5B', roughness: .45, clearcoat: .4, envMapIntensity: .7 });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.name = p.name; m.renderOrder = 2;
    // depth-only twin: in x-ray only the nearest skin is drawn, so the inner walls never show through as torn panels
    const pre = new THREE.Mesh(geo, preMat); pre.renderOrder = 1; pre.visible = false; m.add(pre); twins.push(pre);
    const g = new THREE.Group(); if (!p.abs) { g.rotation.y = G.AZ0 + p.k * G.dth; g.position.y = (G.J0 + p.k * G.c * G.dth) / 1000; } g.add(m); snake.add(g);
    parts[p.name] = { mesh: m, group: g, k: p.k };
    mats.push(mat); onProgress(++done / manifest.length);
  }));

  /* cans and bottles inside the bore */
  const CAN_L = .115, CAN_R = .033;
  const canGeo = new THREE.LatheGeometry([[0, -.0575], [.026, -.0575], [.031, -.054], [.033, -.047], [.033, .044], [.0285, .053], [.0265, .0575], [0, .0575]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  canGeo.rotateX(Math.PI / 2);                               // axis along +z
  const canMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: .9, roughness: .28, envMapIntensity: 1.1 });
  const CAN_COLS = ['#c9ced3', '#d8433b', '#2f6fd6', '#e4b43c', '#1fa36a', '#c9ced3', '#7a46c9', '#e7e9ec'].map(c => new THREE.Color(c));
  const MAXI = 40;
  const cans = new THREE.InstancedMesh(canGeo, canMat, MAXI); cans.castShadow = true; cans.count = 0; cans.frustumCulled = false; scene.add(cans);
  const botGeo = new THREE.LatheGeometry([[0, -.113], [.031, -.113], [.033, -.105], [.033, .03], [.024, .07], [.0135, .095], [.0135, .113], [0, .113]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  botGeo.rotateX(Math.PI / 2);
  const botMat = new THREE.MeshPhysicalMaterial({ color: '#bfe8d8', roughness: .08, transmission: .85, thickness: .01, transparent: true, opacity: .55, metalness: 0 });
  const bottles = new THREE.InstancedMesh(botGeo, botMat, MAXI); bottles.count = 0; bottles.frustumCulled = false; scene.add(bottles);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _z = V(0, 0, 1);
  // items: [{d (mm from tail floor, centre), kind:'can'|'bottle', col}] ; returns the d-spans of cans
  function setItems(items) {
    let nc = 0, nb = 0;
    for (const it of items) {
      const { p, t } = pathAt(Math.max(0, it.d));
      _q.setFromUnitVectors(_z, t); const s = it.scale ?? 1;
      _m.compose(it.pos || p, _q, V(s, s, s));
      if (it.kind === 'bottle') { bottles.setMatrixAt(nb++, _m); }
      else { cans.setMatrixAt(nc, _m); cans.setColorAt(nc, CAN_COLS[(it.col ?? nc) % CAN_COLS.length]); nc++; }
    }
    cans.count = nc; bottles.count = nb;
    cans.instanceMatrix.needsUpdate = true; if (cans.instanceColor) cans.instanceColor.needsUpdate = true; bottles.instanceMatrix.needsUpdate = true;
  }

  /* coils, cable, chips (seen through the shell) */
  const coilTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#2a1608'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e3a15a'; g.lineWidth = 4;
    for (let i = 0; i < 9; i++) { const m = 8 + i * 7; g.beginPath(); g.roundRect(m, m, w - 2 * m, h - 2 * m, 10); g.stroke(); }
  });
  const coilGeo = new THREE.PlaneGeometry(.06, .03);
  const sensor = new THREE.Group(); scene.add(sensor);
  const coilMeshes = COILS.map(cl => {
    const mat = new THREE.MeshStandardMaterial({ map: coilTex, emissive: '#FFB547', emissiveMap: coilTex, emissiveIntensity: 0, roughness: .35, metalness: .5, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(coilGeo, mat);
    const { p, t, b } = pathAt(cl.d);
    m.position.copy(p).addScaledVector(b, .0615);
    const x = t.clone(), z = b.clone().negate(), y = z.clone().cross(x);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    sensor.add(m); return m;
  });
  const glowTex = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,200,110,1)'); r.addColorStop(.35, 'rgba(255,181,71,.45)'); r.addColorStop(1, 'rgba(255,181,71,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const glows = coilMeshes.map(m => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); sp.scale.set(.13, .13, 1); sp.position.copy(m.position); sensor.add(sp); return sp; });
  // the cable runs along the belly in the keel channel, from the top coil down to the pod and on to the lowest
  const dLo = COILS[0].d - 40, dHi = COILS[COILS.length - 1].d + 40, cablePts = [];
  for (let i = 0; i <= 160; i++) { const d = lerp(dLo, dHi, i / 160), { p, b } = pathAt(d); cablePts.push(p.clone().addScaledVector(b, .0655)); }
  const cableMat = new THREE.MeshStandardMaterial({ color: '#5CC8F0', emissive: '#5CC8F0', emissiveIntensity: .5, roughness: .4, transparent: true, opacity: 0, depthWrite: false });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 320, .0025, 8), cableMat); sensor.add(cable);
  // keel ghost: the ridge itself, for the x-ray view
  const keelPts = []; for (let i = 0; i <= 200; i++) { const d = lerp(PATH.tailLen, thetaToD(G.n * G.dth), i / 200), { p, b } = pathAt(d); keelPts.push(p.clone().addScaledVector(b, .066)); }
  const keelMat = new THREE.MeshBasicMaterial({ color: '#5CC8F0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const keel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(keelPts), 400, .004, 6), keelMat); sensor.add(keel);
  const chipMat = new THREE.MeshStandardMaterial({ color: '#1f6b47', emissive: '#7CF06B', emissiveIntensity: 0, roughness: .5, transparent: true, opacity: 0, depthWrite: false });
  const chipMeshes = CHIPS.map(ch => {
    const dd = ch.seg === 5 ? thetaToD(4 * G.dth) + 48 : thetaToD((ch.seg - .5) * G.dth) + 30;
    const { p, t, b } = pathAt(dd);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.014, .004, .02), chipMat.clone());
    m.position.copy(p).addScaledVector(b, .066); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().negate()); sensor.add(m); return m;
  });

  /* radio pulse rings from the pod */
  const ringMat = new THREE.MeshBasicMaterial({ color: '#7CF06B', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), ringMat.clone()); r.rotation.x = -Math.PI / 2; scene.add(r); return r; });
  const podD = thetaToD(4 * G.dth + .81);
  const podAt = pathAt(podD);
  function setRadio(t, on) {
    rings.forEach((r, i) => {
      const u = ((t * .55 + i / 3) % 1);
      r.position.copy(podAt.p).addScaledVector(podAt.b, .08);
      const s = .05 + u * .9; r.scale.set(s, s, s); r.material.opacity = on * (1 - u) * (1 - u) * .8;
    });
  }


  /* the pod: tray, battery, board, antenna, bolts; the lid and the key */
  const pod = (() => {
    const SP = MAN.pod.spine;                      // [x mm along the lid, outer-surface point (m), outward normal], from the docked lid
    const spine = x => {
      let i = 0; while (i < SP.length - 2 && SP[i + 1][0] < x) i++;
      const A = SP[i], B = SP[i + 1], u = (x - A[0]) / (B[0] - A[0]);
      const p = V(A[1], A[2], A[3]).lerp(V(B[1], B[2], B[3]), u), n = V(A[4], A[5], A[6]).lerp(V(B[4], B[5], B[6]), u).normalize();
      const t = V(B[1] - A[1], B[2] - A[2], B[3] - A[3]).normalize(); t.addScaledVector(n, -t.dot(n)).normalize();
      return { p, n, t, s: t.clone().cross(n).normalize() };
    };
    const mm = v => v / 1000;
    // put obj at x along the lid, `depth` mm in from the outer surface, `z` mm to the side; x axis along the belly
    const place = (obj, x, depth, z = 0) => {
      const f = spine(x); obj.position.copy(f.p).addScaledVector(f.n, -mm(depth)).addScaledVector(f.s, mm(z));
      obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.t, f.n, f.s)); return obj;
    };
    const inside = new THREE.Group(); scene.add(inside);
    const grey = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: .7 });
    const pcb = new THREE.MeshStandardMaterial({ color: '#13704a', roughness: .5 });
    const shield = new THREE.MeshStandardMaterial({ color: '#c7ccd1', metalness: .9, roughness: .3 });
    const black = new THREE.MeshStandardMaterial({ color: '#15181c', roughness: .5 });
    const boxM = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(mm(w), mm(h), mm(d)), mat); m.castShadow = true; return m; };
    inside.add(place(boxM(120, 3, 34, grey), 2, 18));                                   // tray
    const bat = new THREE.Group(); place(bat, 8, 10.5, -9); inside.add(bat);
    const cyl = (r, l, mat, open = false) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(r), mm(r), mm(l), 32, 1, open), mat); m.rotation.z = Math.PI / 2; return m; };
    bat.add(cyl(7.25, 50.5, shield), cyl(7.4, 30, new THREE.MeshStandardMaterial({ color: '#1d5fb8', roughness: .5 }), true));
    inside.add(place(boxM(46, 1.6, 16, pcb), 6, 15.8, 9));                              // board
    inside.add(place(boxM(15, 2.5, 15, shield), 0, 13.8, 9));                           // RAK3172 radio
    inside.add(place(boxM(5, 1.2, 5, black), 21, 14.4, 9));                             // LDC1614 reader
    const antMat = new THREE.MeshStandardMaterial({ color: '#e0a050', emissive: '#e0a050', emissiveIntensity: 0, metalness: .6, roughness: .35 });
    inside.add(place(boxM(82, .4, 8, antMat), 10, 3.2, 0));                             // antenna under the lid
    inside.add(place(boxM(12, 7, 30, grey), -62, 13));                                  // bolt guide
    const bolts = [-8, 8].map(z => { const g = new THREE.Group(); inside.add(g);
      const pin = boxM(14, 3.2, 7.6, new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: .5 })); g.add(pin);
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(mm(3), mm(3), mm(2), 24), shield); mag.position.set(mm(3), mm(-2.2), 0); g.add(mag);
      return { g, z }; });
    inside.visible = false;
    // the key: three N52 magnets in a white printed block, the arrow points to the head
    const key = new THREE.Group(); scene.add(key);
    const keyMat = new THREE.MeshPhysicalMaterial({ color: '#ecebe6', roughness: .55, clearcoat: .2 });
    const kb = boxM(69, 22, 40, keyMat); kb.position.y = mm(11); key.add(kb);
    [[-12, -12], [-12, 12], [14, 0]].forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(5), mm(5), mm(5), 32), shield); m.position.set(mm(x), mm(2.4), mm(z)); key.add(m); });
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([[-14, -5], [6, -5], [6, -11], [20, 0], [6, 11], [6, 5], [-14, 5]].map(([x, z]) => new THREE.Vector2(mm(x), mm(z))))), new THREE.MeshBasicMaterial({ color: '#0B2A5B', side: THREE.DoubleSide }));
    arrow.rotation.x = -Math.PI / 2; arrow.position.y = mm(22.2); key.add(arrow);
    key.visible = false;
    // the lid, re-parented to a pivot at its top hook
    let lid = null; const pivot = new THREE.Group(); scene.add(pivot); place(pivot, 88, 4);
    const pivotHome = { p: pivot.position.clone(), q: pivot.quaternion.clone() }, f88 = spine(88);
    if (parts.podlid) { const m = parts.podlid.mesh; m.parent.updateMatrixWorld(true); pivot.updateMatrixWorld(true); pivot.attach(m); lid = m; }
    const keyHome = spine(-52);
    function set({ inside: showIn = false, key: k = 0, bolts: bo = 0, tip = 0, slide = 0, out = 0, antenna = 0 } = {}) {
      inside.visible = showIn;
      bolts.forEach(b => place(b.g, -62 + 4.5 * bo, 6.5, b.z));
      antMat.emissiveIntensity = antenna;
      key.visible = k > 0;
      place(key, -52, 0); key.position.addScaledVector(keyHome.n, mm((1 - ease(k)) * 160 + 80 * out)).addScaledVector(keyHome.t, -mm(7 * slide));
      pivot.position.copy(pivotHome.p).addScaledVector(f88.t, -mm(7 * slide)).addScaledVector(f88.n, mm(80 * out));
      pivot.quaternion.copy(pivotHome.q); pivot.rotateZ(-tip * 2 * Math.PI / 180);
    }
    return { inside, key, lid, pivot, set, spine };
  })();

  /* modes */
  const state = { xray: 0, night: 0, glow: 0 };
  function setXray(f) {
    state.xray = f;
    for (const m of mats) {
      const o = 1 - .86 * f; m.transparent = o < .999; m.opacity = o; m.depthWrite = !m.transparent;
      m.clearcoat = .45 * (1 - f); m.envMapIntensity = 1.1 * (1 - .75 * f);
    }
    for (const t of twins) t.visible = f > .001;
    for (const m of coilMeshes) m.material.opacity = Math.max(m.userData.show || 0, f);
    glows.forEach(g => g.userData.x = f);
    cableMat.opacity = f; keelMat.opacity = f * .35;
    chipMeshes.forEach(c => c.material.opacity = f);
  }
  function setCoil(i, level) {                                 // level 0..1 = how strongly it sees a can
    const m = coilMeshes[i]; m.material.emissiveIntensity = 2.6 * level;
    glows[i].material.opacity = level * Math.max(.35, glows[i].userData.x || 0);
  }
  function coilsFromItems(items) {
    return COILS.map(cl => items.some(it => it.kind !== 'bottle' && Math.abs(it.d - cl.d) < 58) ? 1 : 0);
  }
  function setNight(f) {
    state.night = f;
    scene.background.copy(BG).lerp(NIGHT, f); scene.fog.color.copy(scene.background);
    key.intensity = 3.4 * (1 - .92 * f); rim.intensity = 1.6 * (1 - .6 * f); hemi.intensity = 1.1 * (1 - .8 * f);
    renderer.toneMappingExposure = 1.45 - .35 * f;
    lamp.intensity = 14 * f; lampLens.material.color.set(f > .3 ? '#ffe6b5' : '#2a2f35');
  }
  function setGlow(f) { state.glow = f; for (const m of mats) m.emissiveIntensity = 1.4 * f; }

  function orbit(az, el, d, ty, fov = 30, shift = 0) {       // az in pole frame (radians), el radians; shift > 0 puts the pole right of centre
    camera.fov = fov; camera.updateProjectionMatrix();
    const right = V(Math.sin(az), 0, Math.cos(az)).multiplyScalar(shift);
    camera.position.set(Math.cos(az) * Math.cos(el) * d, ty + Math.sin(el) * d, -Math.sin(az) * Math.cos(el) * d).add(right);
    camera.lookAt(V(0, ty, 0).add(right));
  }
  function look(pos, target, fov = 30) { camera.fov = fov; camera.updateProjectionMatrix(); camera.position.copy(pos); camera.lookAt(target); }
  function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function project(p, w, h) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, vis: v.z < 1 && v.z > -1 }; }
  function isolate(names) {                                     // show only these parts (null = everything)
    for (const k in parts) parts[k].mesh.visible = !names || names.includes(k);
    pole.visible = !names; sensor.visible = !names;
  }
  const render = () => renderer.render(scene, camera);

  return { THREE, renderer, scene, camera, snake, parts, pole, ground, cans, bottles, setItems, coilMeshes, setCoil, coilsFromItems,
    cable, chipMeshes, pod, setXray, setNight, setGlow, setRadio, orbit, look, resize, project, render, isolate, headlight, podAt, state, lamp };
}

/* items arriving at the mouth one after another and sliding down to rest on the ones below.
   seq: list of 'can' | 'bottle'; t: seconds since the first drop; returns [{d, kind, col}] and how many rest */
export const LEN = { can: 121.7, bottle: 231 };
export function fillAt(t, seq, { gap = .45, speed = 1500, start = 0 } = {}) {
  const items = []; let rest = 0, nRest = 0, base = start;
  seq.forEach((kind, k) => {
    const L = LEN[kind], dRest = base + L / 2; base += L;
    const t0 = k * gap; if (t < t0) return;
    const dTop = PATH.len - 40, travel = (dTop - dRest) / speed;
    const u = Math.min(1, (t - t0) / travel);
    const d = dTop - (dTop - dRest) * (u * u * .35 + u * .65);
    items.push({ d, kind, col: k, resting: u >= 1 }); if (u >= 1) nRest++;
  });
  return { items, nRest };
}

/* ---------- when 3D can't run: a still picture and a retry button instead of a dead screen ---------- */
export function fallback(screen, poster, why) {
  const old = screen.querySelector('.loading'); if (old) old.remove();
  const d = document.createElement('div'); d.className = 'fallback';
  d.innerHTML = `<img alt="" src="${poster}"><div><b>The 3D view could not start</b><span></span><button type="button">Try again</button></div>`;
  d.querySelector('span').textContent = why === 'webgl'
    ? 'Your browser has no graphics memory free for it right now. Close other tabs with 3D or video, then try again.'
    : 'Something went wrong while loading. Try again in a moment.';
  d.querySelector('button').onclick = () => location.reload();
  screen.appendChild(d);
}
