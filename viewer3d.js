// viewer3d.js
// Two widgets reused across Capture review, Learn cards, and Practice:
//
//   HandSkeleton3D  — rotatable Three.js point-and-line skeleton built from
//                     MediaPipe worldLandmarks. Pointer-drag rotates the
//                     hand group. NOT a mesh — just joints + bones.
//   PhotoTurntable  — the 5 captured angle photos in a strip; dragging
//                     horizontally scrubs between them with snapping.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { CONNECTIONS, TIP_INDICES } from './landmarks.js';

const NEON_CYAN    = 0x00f0ff;
const NEON_MAGENTA = 0xff00e0;
const NEON_GREEN   = 0x39ff7d;

// ============================================================
// HandSkeleton3D
// ============================================================
export class HandSkeleton3D {
  constructor(container) {
    this.container = container;
    this._sizeFromContainer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.w / this.h, 0.01, 100);
    this.camera.position.set(0, 0, 1.4);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.w, this.h);
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
    container.appendChild(this.renderer.domElement);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._buildSkeleton();
    this._wireRotation();
    this._wireResize();

    // Subtle ambient idle rotation until the user touches the widget.
    this.autoRotate = true;
    this._lastT = performance.now();
    this._animate();
  }

  _sizeFromContainer() {
    this.w = Math.max(120, this.container.clientWidth  || 320);
    this.h = Math.max(120, this.container.clientHeight || 320);
  }

  _buildSkeleton() {
    // joints
    this.joints = [];
    for (let i = 0; i < 21; i++) {
      const isTip = TIP_INDICES.has(i);
      const geo = new THREE.SphereGeometry(isTip ? 0.030 : 0.022, 14, 14);
      const mat = new THREE.MeshBasicMaterial({
        color: isTip ? NEON_MAGENTA : NEON_CYAN,
        transparent: true, opacity: 0.95,
      });
      const m = new THREE.Mesh(geo, mat);
      this.group.add(m);
      this.joints.push(m);
    }
    // bones
    this.bones = [];
    for (const [a, b] of CONNECTIONS) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: NEON_CYAN, transparent: true, opacity: 0.85 });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.bones.push({ line, a, b });
    }
  }

  // worldLandmarks: array of { x, y, z } in metres (MediaPipe coords).
  setPose(worldLandmarks) {
    if (!worldLandmarks || worldLandmarks.length < 21) return;
    const wrist = worldLandmarks[0];
    // Centre at wrist, flip y for screen-up, negate z so closer is closer.
    const pts = worldLandmarks.map(p => ({
      x: (p.x - wrist.x) * 5,
      y: -(p.y - wrist.y) * 5,
      z: -(p.z - wrist.z) * 5,
    }));
    for (let i = 0; i < 21; i++) {
      this.joints[i].position.set(pts[i].x, pts[i].y, pts[i].z);
    }
    for (const { line, a, b } of this.bones) {
      const pa = pts[a], pb = pts[b];
      const arr = line.geometry.attributes.position.array;
      arr[0] = pa.x; arr[1] = pa.y; arr[2] = pa.z;
      arr[3] = pb.x; arr[4] = pb.y; arr[5] = pb.z;
      line.geometry.attributes.position.needsUpdate = true;
    }
  }

  setLockedHighlight(on) {
    const color = on ? NEON_GREEN : NEON_CYAN;
    for (const b of this.bones) b.line.material.color.set(color);
  }

  _wireRotation() {
    const el = this.renderer.domElement;
    let drag = false, lastX = 0, lastY = 0;
    el.addEventListener('pointerdown', (e) => {
      drag = true; lastX = e.clientX; lastY = e.clientY;
      el.style.cursor = 'grabbing';
      this.autoRotate = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      this.group.rotation.y += dx * 0.01;
      this.group.rotation.x += dy * 0.01;
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
    if (this.autoRotate) this.group.rotation.y += dt * 0.35;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._resizeObs && this._resizeObs.disconnect();
    this.renderer.dispose();
    try { this.container.removeChild(this.renderer.domElement); } catch {}
  }
}

// ============================================================
// PhotoTurntable
// ============================================================
export class PhotoTurntable {
  // photos: array of Blob (5 captured angle photos, in capture order)
  // labels: optional array of strings (angle names)
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

    // Dot indicator
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
    const STEP_PX = 80;  // pixels per angle step
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
