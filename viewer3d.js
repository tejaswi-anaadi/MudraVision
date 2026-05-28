// viewer3d.js
// Holographic-wireframe hand viewer + photo turntable.
//
//   HandSkeleton3D builds a hand-like body procedurally from 21 worldLandmarks:
//     - tapered tube bones (thick at wrist, thin at fingertips) — built from
//       CylinderGeometry + sphere caps, since three r128 has no CapsuleGeometry,
//     - sphere joints at every landmark,
//     - a triangulated palm shell (wrist + thumb-CMC + the four MCPs),
//     - a wireframe overlay on every mesh,
//     - a translucent inner shell for body depth,
//     - a "faked" additive bloom (two scaled wireframe copies),
//     - a glowing additive disc at the palm centre.
//
// The geometry ALWAYS comes from real landmark data — either a user's
// capture or a pose extracted from a real source photograph by
// tools/extract_poses.py. Never image-generated.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

const PALETTE = {
  bg:         0x05030d,
  wireframe:  0x00f0ff,
  glow:       0x00f0ff,
  core:       0xffffff,
  accent:     0xff00e0,
  green:      0x39ff7d,
};

// MediaPipe Hands topology — bones we draw as tubes.
const CONNECTIONS = [
  [0,1],[0,5],[5,9],[9,13],[13,17],[0,17],   // palm web
  [1,2],[2,3],[3,4],                          // thumb
  [5,6],[6,7],[7,8],                          // index
  [9,10],[10,11],[11,12],                     // middle
  [13,14],[14,15],[15,16],                    // ring
  [17,18],[18,19],[19,20],                    // pinky
];
// Palm webbing: triangulate the palm "quad" using the wrist and the four MCPs.
// Triangles are wound so the front-face matches the palm side; both sides are
// rendered with DoubleSide anyway.
const PALM_TRIS = [
  [0, 5, 9],
  [0, 9, 13],
  [0, 13, 17],
  [5, 9, 1],     // also stitch in the thumb base for completeness
];

// Per-landmark base radius for the bone "skeleton". Tapers from wrist (thick)
// to fingertips (thin) so the wireframe reads like a hand. Tuned for the
// hand body that emerges after centering: total span ~1 unit, so these
// numbers are read as fractions of the hand's wrist-to-middle-MCP length.
const JOINT_RADII = (function () {
  const r = new Array(21).fill(0.040);
  r[0] = 0.080;                                            // wrist — thickest
  for (const i of [1, 5, 9, 13, 17]) r[i] = 0.060;         // MCPs
  for (const i of [2, 6, 10, 14, 18]) r[i] = 0.045;        // PIPs / thumb MCP
  for (const i of [3, 7, 11, 15, 19]) r[i] = 0.034;        // DIPs
  for (const i of [4, 8, 12, 16, 20]) r[i] = 0.028;        // tips
  return r;
})();

// ============================================================
// HandSkeleton3D
// ============================================================
export class HandSkeleton3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { autoRotate: true, wireOnly: true, ...opts };
    this._sizeFromContainer();

    this.scene = new THREE.Scene();
    this.scene.background = null;          // transparent — let CSS show through
    this.camera = new THREE.PerspectiveCamera(40, this.w / this.h, 0.01, 100);
    this.camera.position.set(0, 0, 2.2);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(this.w, this.h);
    this.renderer.setClearColor(0x000000, 0);   // transparent
    this.renderer.domElement.style.cssText =
      'width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
    container.appendChild(this.renderer.domElement);

    this.root = new THREE.Group();           // user-rotated
    this.handGroup = new THREE.Group();      // contains all meshes — re-built on setPose
    this.root.add(this.handGroup);
    this.scene.add(this.root);

    // Palm core glow — a billboarded additive disc.
    this.coreSprite = makeCoreSprite();
    this.root.add(this.coreSprite);

    this._wireRotation();
    this._wireResize();

    this._lastT = performance.now();
    this._animate();
  }

  _sizeFromContainer() {
    this.w = Math.max(180, this.container.clientWidth  || 360);
    this.h = Math.max(180, this.container.clientHeight || 360);
  }

  // Replace the hand geometry with one built from `worldLandmarks` — an
  // array of 21 { x, y, z } in real-world (metres) coords from MediaPipe.
  // `handedness` is "Left" or "Right" — used to mirror left hands so they
  // face the camera the same way.
  setPose(worldLandmarks, handedness = 'Right') {
    if (!worldLandmarks || worldLandmarks.length < 21) return;

    // 1) Translate so the wrist is at the origin and flip Y/Z for screen-up.
    //    For Left hands we mirror x so the wireframe reads the same from
    //    the front regardless of which hand was scanned.
    const w = worldLandmarks[0];
    const mirror = handedness === 'Left' ? -1 : 1;
    const SCALE = 4.5;
    let pts = worldLandmarks.map(p => new THREE.Vector3(
      mirror * (p.x - w.x) * SCALE,
      -(p.y - w.y) * SCALE,
      -(p.z - w.z) * SCALE,
    ));

    // 2) Centre on the hand's BBOX so the wrist-anchored geometry sits
    //    nicely in the camera view (otherwise hand-up gestures push the
    //    fingertips off the top of the canvas).
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for (const p of pts) {
      if (p.x<minX) minX=p.x; if (p.y<minY) minY=p.y; if (p.z<minZ) minZ=p.z;
      if (p.x>maxX) maxX=p.x; if (p.y>maxY) maxY=p.y; if (p.z>maxZ) maxZ=p.z;
    }
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2, cz=(minZ+maxZ)/2;
    // 3) Scale-to-fit so different hand sizes fill the viewport similarly.
    const span = Math.max(maxX-minX, maxY-minY, maxZ-minZ) || 1;
    const fitScale = 1.4 / span;
    pts = pts.map(p => new THREE.Vector3(
      (p.x - cx) * fitScale,
      (p.y - cy) * fitScale,
      (p.z - cz) * fitScale,
    ));

    // Tear down any previous hand.
    this._clearHand();

    // ---- 1. Tube bones (CylinderGeometry between each pair + sphere caps)
    for (const [a, b] of CONNECTIONS) {
      this.handGroup.add(makeBoneTube(pts[a], pts[b], JOINT_RADII[a], JOINT_RADII[b], PALETTE.wireframe));
    }

    // ---- 2. Joint spheres — accent only the wrist and the 5 fingertips
    //         so the wireframe stays readable.
    const TIP_INDICES = new Set([4, 8, 12, 16, 20]);
    for (let i = 0; i < 21; i++) {
      const isAccent = (i === 0) || TIP_INDICES.has(i);
      this.handGroup.add(makeJointSphere(pts[i], JOINT_RADII[i] * 1.05,
                                         isAccent ? PALETTE.accent : PALETTE.wireframe));
    }

    // ---- 3. Palm webbing — a thin translucent shell across the palm.
    this.handGroup.add(makePalmShell(pts, PALETTE.wireframe));

    // ---- 4. Faked bloom: two scaled-up additive copies of the wireframe.
    this.handGroup.add(makeBloomHalo(this.handGroup, 1.06, 0.18));
    this.handGroup.add(makeBloomHalo(this.handGroup, 1.13, 0.10));

    // ---- 5. Palm core: position the glow sprite at the palm centroid
    //         (avg of wrist, index MCP, middle MCP, ring MCP, pinky MCP).
    const palmCentre = pts[0].clone().add(pts[5]).add(pts[9]).add(pts[13]).add(pts[17]).divideScalar(5);
    this.coreSprite.position.copy(palmCentre);
  }

  setHighlight(active) {
    const color = active ? PALETTE.green : PALETTE.wireframe;
    this.handGroup.traverse(m => {
      if (m.userData && m.userData.tintable && m.material && m.material.color) {
        m.material.color.set(color);
      }
    });
  }

  _clearHand() {
    while (this.handGroup.children.length) {
      const m = this.handGroup.children.pop();
      m.geometry && m.geometry.dispose && m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach(x => x.dispose && x.dispose());
        else m.material.dispose && m.material.dispose();
      }
    }
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
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      this.root.rotation.y += dx * 0.01;
      this.root.rotation.x += dy * 0.01;
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
    if (this.opts.autoRotate) this.root.rotation.y += dt * 0.45;
    // Subtle pulse on the core sprite.
    const pulse = 0.85 + 0.15 * Math.sin(now / 600);
    this.coreSprite.scale.setScalar(0.55 * pulse);
    (this.coreSprite.material).opacity = 0.55 + 0.20 * pulse;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._resizeObs && this._resizeObs.disconnect();
    this._clearHand();
    this.renderer.dispose();
    try { this.container.removeChild(this.renderer.domElement); } catch {}
  }
}

// ============================================================
// Geometry helpers
// ============================================================

// A bone between two points: an oriented cylinder that tapers from
// radius rA at point a to radius rB at point b, capped with two
// spheres so it reads as a finger segment. We add an EdgesGeometry
// overlay so the wireframe lines pop.
function makeBoneTube(a, b, rA, rB, color) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-5) return g;

  // Tapered cylinder.
  const cyl = new THREE.CylinderGeometry(rB, rA, len, 10, 1, true);
  // Position so the cylinder runs along the segment.
  const cylMesh = new THREE.Mesh(cyl, makeWireMat(color, 0.65));
  cylMesh.userData.tintable = true;
  // Edges overlay
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cyl, 1),
    makeLineMat(color, 0.95),
  );
  edges.userData.tintable = true;

  // Orient (cylinder's local axis is Y).
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const orient = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  cylMesh.position.copy(mid);
  cylMesh.quaternion.copy(orient);
  edges.position.copy(mid);
  edges.quaternion.copy(orient);

  g.add(cylMesh);
  g.add(edges);
  return g;
}

function makeJointSphere(pos, r, color) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(r, 12, 10);
  const mesh = new THREE.Mesh(geo, makeWireMat(color, 0.7));
  mesh.userData.tintable = true;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 1),
    makeLineMat(color, 0.95),
  );
  edges.userData.tintable = true;
  mesh.position.copy(pos);
  edges.position.copy(pos);
  g.add(mesh);
  g.add(edges);
  return g;
}

function makePalmShell(pts, color) {
  // Triangulate the palm. We build a single BufferGeometry from PALM_TRIS.
  const positions = [];
  for (const [a, b, c] of PALM_TRIS) {
    positions.push(pts[a].x, pts[a].y, pts[a].z);
    positions.push(pts[b].x, pts[b].y, pts[b].z);
    positions.push(pts[c].x, pts[c].y, pts[c].z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.userData.tintable = true;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 1),
    makeLineMat(color, 0.9),
  );
  edges.userData.tintable = true;
  const g = new THREE.Group();
  g.add(shell);
  g.add(edges);
  return g;
}

// Faked bloom: clone the existing handGroup contents at a slightly larger
// scale, with additive blending and low opacity, to suggest a glow halo
// without needing the postprocessing module from three's examples (which
// can be flaky on the +esm CDN bundle for older three releases).
function makeBloomHalo(handGroup, scale, opacity) {
  const halo = new THREE.Group();
  handGroup.traverse(child => {
    if (!child.isMesh && !child.isLineSegments) return;
    const cloned = child.clone();
    if (cloned.material) {
      cloned.material = cloned.material.clone();
      cloned.material.transparent = true;
      cloned.material.opacity = opacity;
      cloned.material.depthWrite = false;
      cloned.material.blending = THREE.AdditiveBlending;
    }
    halo.add(cloned);
  });
  halo.scale.setScalar(scale);
  return halo;
}

// A billboarded glowing disc at the palm core.
function makeCoreSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.20, 'rgba(180,250,255,0.85)');
  grad.addColorStop(0.55, 'rgba(0,240,255,0.35)');
  grad.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(0.55);
  return s;
}

function makeWireMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    wireframe: true,
    depthWrite: false,
  });
}
function makeLineMat(color, opacity) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ============================================================
// PhotoTurntable — unchanged 2.5D widget for the 5 capture angles
// ============================================================
export class PhotoTurntable {
  constructor(container, photos, labels = []) {
    this.container = container;
    this.photos = photos;
    this.labels = labels;
    this.urls = photos.map(p => URL.createObjectURL(p));
    this.idx = 0;
    this._build();
    this._wire();
  }
  _build() {
    this.container.innerHTML = '';
    this.container.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;touch-action:none;user-select:none;';
    const stage = document.createElement('div');
    stage.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;cursor:ew-resize;';
    this.img = document.createElement('img');
    this.img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;border-radius:14px;';
    this.img.draggable = false;
    this.img.src = this.urls[0];
    stage.appendChild(this.img);
    this.container.appendChild(stage);
    const dots = document.createElement('div');
    dots.className = 'turntable-dots';
    dots.style.cssText = 'display:flex;gap:6px;';
    this._dots = [];
    for (let i = 0; i < this.urls.length; i++) {
      const d = document.createElement('span');
      d.className = 'turntable-dot' + (i === 0 ? ' active' : '');
      d.style.cssText = 'width:8px;height:8px;border-radius:50%;background:rgba(0,240,255,0.2);transition:200ms;';
      d.dataset.idx = String(i);
      d.addEventListener('click', () => this.setIndex(i));
      dots.appendChild(d);
      this._dots.push(d);
    }
    this.container.appendChild(dots);
    const lbl = document.createElement('div');
    lbl.className = 'turntable-label';
    lbl.style.cssText = 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(238,243,255,0.55);';
    lbl.textContent = this.labels[0] || `1 / ${this.urls.length}`;
    this.container.appendChild(lbl);
    this._lbl = lbl;
    this._stage = stage;
  }
  setIndex(i) {
    const clamped = Math.max(0, Math.min(this.urls.length - 1, i));
    if (clamped === this.idx) return;
    this.idx = clamped;
    this.img.src = this.urls[clamped];
    this._lbl.textContent = this.labels[clamped] || `${clamped + 1} / ${this.urls.length}`;
    for (let k = 0; k < this._dots.length; k++) {
      this._dots[k].style.background = (k === clamped)
        ? 'var(--neon-cyan, #00f0ff)' : 'rgba(0,240,255,0.20)';
    }
  }
  _wire() {
    let dragging = false, startX = 0, startIdx = 0;
    const STEP_PX = 80;
    this._stage.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX; startIdx = this.idx;
      this._stage.setPointerCapture(e.pointerId);
    });
    this._stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      this.setIndex(Math.round(startIdx + delta / STEP_PX));
    });
    const end = (e) => {
      dragging = false;
      try { this._stage.releasePointerCapture(e.pointerId); } catch {}
    };
    this._stage.addEventListener('pointerup', end);
    this._stage.addEventListener('pointercancel', end);
  }
  destroy() {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.container.innerHTML = '';
  }
}

// ============================================================
// Pose loader — fetches `poses/{slug}.json` once per slug, with a
// small in-memory cache. Returns null if the pose file is missing.
// ============================================================
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
