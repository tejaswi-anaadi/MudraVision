// viewer3d.js
// 3D hand viewer + photo turntable.
//
//   HandSkeleton3D renders a solid, softly lit hand "maquette" from 21
//   worldLandmarks: smooth skin-toned finger segments (tapered cylinders with
//   rounded joints), a closed palm with real thickness, and a short forearm,
//   on a light parchment backdrop (CSS). Drag to rotate; it turns slowly on
//   its own until touched.
//
// The geometry ALWAYS comes from real landmark data — a pose measured from
// real photographs (poses/*.json). Never image-generated.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

const SKIN = 0xd7a07c;        // warm medium skin tone
const SKIN_HI = 0xc9a04a;     // highlight tint when a mudra is locked (warm gold)

// MediaPipe Hands topology.
const FINGER_BONES = [
  [1, 2], [2, 3], [3, 4],          // thumb
  [5, 6], [6, 7], [7, 8],          // index
  [9, 10], [10, 11], [11, 12],     // middle
  [13, 14], [14, 15], [15, 16],    // ring
  [17, 18], [18, 19], [19, 20],    // pinky
];
// Palm outline (wrist, thumb base, index..pinky knuckles) — closed into a slab.
const PALM_RING = [0, 1, 5, 9, 13, 17];
// Rounded palm edges.
const PALM_EDGES = [[0, 1], [1, 5], [5, 9], [9, 13], [13, 17], [17, 0]];

// Joint radii as a fraction of the hand's wrist→middle-knuckle length, so the
// hand keeps natural proportions at any scale.
const RADIUS = (() => {
  const r = new Array(21).fill(0.095);
  r[0] = 0.21;                                   // wrist
  r[1] = 0.17; r[2] = 0.13; r[3] = 0.11; r[4] = 0.095;   // thumb
  for (const i of [5, 9, 13]) r[i] = 0.115;     // knuckles
  r[17] = 0.10;
  for (const i of [6, 10, 14]) r[i] = 0.10;     // PIP
  r[18] = 0.09;
  for (const i of [7, 11, 15]) r[i] = 0.09;     // DIP
  r[19] = 0.08;
  for (const i of [8, 12, 16]) r[i] = 0.08;     // tips
  r[20] = 0.072;
  return r;
})();
const PALM_HALF_THICKNESS = 0.095;

// ============================================================
// HandSkeleton3D
// ============================================================
export class HandSkeleton3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { autoRotate: true, ...opts };
    this._sizeFromContainer();

    this.scene = new THREE.Scene();
    this.scene.background = null;              // CSS backdrop shows through
    this.camera = new THREE.PerspectiveCamera(36, this.w / this.h, 0.01, 100);
    this.camera.position.set(0, 0, 3.0);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(this.w, this.h);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.cssText =
      'width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
    container.appendChild(this.renderer.domElement);

    // Soft studio lighting: warm sky/ground fill + a key light + a rim light.
    this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0x7a5a44, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.2, 1.8, 2.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe2c4, 0.7);
    rim.position.set(-2, 0.5, -1.5);
    this.scene.add(rim);

    this.material = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.58, metalness: 0.0 });

    this.root = new THREE.Group();
    this.handGroup = new THREE.Group();
    this.root.add(this.handGroup);
    this.scene.add(this.root);

    this._wireRotation();
    this._wireResize();
    this._lastT = performance.now();
    this._animate();
  }

  _sizeFromContainer() {
    this.w = Math.max(180, this.container.clientWidth  || 360);
    this.h = Math.max(180, this.container.clientHeight || 360);
  }

  // `worldLandmarks`: 21 { x, y, z } in metres (MediaPipe world coordinates).
  // `handedness` "Left" mirrors x so either hand faces the viewer the same way.
  setPose(worldLandmarks, handedness = 'Right') {
    if (!worldLandmarks || worldLandmarks.length < 21) return;
    this.setHands([{ world: worldLandmarks, handedness }], { mirrorLeft: true });
  }

  // One or two hands: [{ world, handedness, wrist? }]. `wrist` (metres) places
  // each hand's wrist — world landmarks are hand-centred, so two-hand mudras
  // need it to sit the hands correctly relative to each other.
  setHands(hands, { mirrorLeft = false } = {}) {
    hands = (hands || []).filter(h => h?.world?.length >= 21);
    if (!hands.length) return;
    let sets = hands.map(h => {
      const w0 = h.world[0], off = h.wrist || { x: 0, y: 0, z: 0 };
      const mirror = (mirrorLeft && h.handedness === 'Left') ? -1 : 1;
      return h.world.map(p => new THREE.Vector3(
        mirror * (p.x - w0.x) + off.x, -(p.y - w0.y + off.y), -(p.z - w0.z + off.z)));
    });

    // Scale so the wrist→middle-knuckle length is 1 unit.
    const palmLen = sets.reduce((s, P) => s + P[9].distanceTo(P[0]), 0) / sets.length || 1;
    sets = sets.map(P => P.map(p => p.multiplyScalar(1 / palmLen)));
    // Each forearm continues away from its knuckles; include it when fitting.
    const forearms = sets.map(P => {
      const dir = P[0].clone().sub(P[9]).normalize();
      return [P[0].clone(), P[0].clone().add(dir.multiplyScalar(0.7))];
    });
    const box = new THREE.Box3().setFromPoints([...sets.flat(), ...forearms.map(f => f[1])]);
    box.expandByScalar(RADIUS[0]);
    const centre = box.getCenter(new THREE.Vector3());
    sets = sets.map(P => P.map(p => p.sub(centre)));
    forearms.forEach(f => { f[0].sub(centre); f[1].sub(centre); });
    const span = Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1;
    this.handGroup.scale.setScalar(1.55 / span);

    this._clearHand();
    const mat = this.material;
    const add = (m) => { if (m) this.handGroup.add(m); };
    sets.forEach((pts, k) => {
      // Fingers: tapered segments with a sphere at every joint.
      for (const [a, b] of FINGER_BONES) add(segment(pts[a], pts[b], RADIUS[a], RADIUS[b], mat));
      for (let i = 1; i < 21; i++) add(sphere(pts[i], RADIUS[i], mat));
      // Palm: a closed slab across the knuckles, with rounded edges.
      add(palmSlab(pts, mat));
      for (const [a, b] of PALM_EDGES) add(segment(pts[a], pts[b], PALM_HALF_THICKNESS, PALM_HALF_THICKNESS, mat));
      add(sphere(pts[0], RADIUS[0], mat));
      // A short forearm.
      add(segment(forearms[k][0], forearms[k][1], RADIUS[0], RADIUS[0] * 1.06, mat));
    });
  }

  setHighlight(active) {
    this.material.color.set(active ? SKIN_HI : SKIN);
  }

  _clearHand() {
    this.handGroup.traverse(m => { if (m.geometry) m.geometry.dispose(); });
    this.handGroup.clear();
  }

  _wireRotation() {
    const el = this.renderer.domElement;
    let drag = false, lastX = 0, lastY = 0;
    el.addEventListener('pointerdown', (e) => {
      drag = true; lastX = e.clientX; lastY = e.clientY;
      el.style.cursor = 'grabbing';
      this.opts.autoRotate = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.root.rotation.y += (e.clientX - lastX) * 0.01;
      this.root.rotation.x += (e.clientY - lastY) * 0.01;
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = (e) => {
      drag = false;
      el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  _wireResize() {
    this._resizeObs = new ResizeObserver(() => {
      this._sizeFromContainer();
      this.camera.aspect = this.w / this.h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.w, this.h);
    });
    this._resizeObs.observe(this.container);
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    const now = performance.now();
    const dt = (now - this._lastT) / 1000;
    this._lastT = now;
    if (this.opts.autoRotate) this.root.rotation.y += dt * 0.35;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._resizeObs && this._resizeObs.disconnect();
    this._clearHand();
    this.material.dispose();
    this.renderer.dispose();
    try { this.container.removeChild(this.renderer.domElement); } catch {}
  }
}

// ============================================================
// Geometry helpers
// ============================================================
const UP = new THREE.Vector3(0, 1, 0);

// Tapered, smooth cylinder from a (radius rA) to b (radius rB).
function segment(a, b, rA, rB, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-5) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, 24, 1, true), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

function sphere(p, r, mat) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
  mesh.position.copy(p);
  return mesh;
}

// Closed palm slab: the palm outline offset to both sides of the palm plane.
function palmSlab(pts, mat) {
  const ring = PALM_RING.map(i => pts[i]);
  const centre = ring.reduce((c, p) => c.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
  const normal = new THREE.Vector3()
    .crossVectors(pts[5].clone().sub(pts[0]), pts[17].clone().sub(pts[0])).normalize()
    .multiplyScalar(PALM_HALF_THICKNESS);
  const top = ring.map(p => p.clone().add(normal));
  const bot = ring.map(p => p.clone().sub(normal));
  const cT = centre.clone().add(normal), cB = centre.clone().sub(normal);
  const pos = [];
  const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(cT, top[i], top[j]);
    tri(cB, bot[j], bot[i]);
    tri(top[i], bot[i], bot[j]);
    tri(top[i], bot[j], top[j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, m);
}

// ============================================================
// Pose loader — fetches `poses/{slug}.json` once per slug, with a
// small in-memory cache. Returns null if the pose file is missing.
// ============================================================
const _refCache = new Map();
// Reference pose from the dataset (tools/build_refs.mjs): the most typical of
// ~100 real frames of this mudra, with both hands for two-hand mudras.
export async function loadRefPose(slug) {
  if (!slug) return null;
  if (_refCache.has(slug)) return _refCache.get(slug);
  let data = null;
  try {
    const res = await fetch(`poses/ref/${slug}.json`);
    if (res.ok) data = await res.json();
  } catch {}
  _refCache.set(slug, data);
  return data;
}

const _poseCache = new Map();
export async function loadPose(slug) {
  if (!slug) return null;
  if (_poseCache.has(slug)) return _poseCache.get(slug);
  try {
    const res = await fetch(`poses/${slug}.json`);
    if (!res.ok) {
      _poseCache.set(slug, null);
      return null;
    }
    const data = await res.json();
    _poseCache.set(slug, data);
    return data;
  } catch {
    _poseCache.set(slug, null);
    return null;
  }
}
