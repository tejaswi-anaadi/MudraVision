// features.js
// Feature vectors for the learned mudra models (models/*.json). The SAME code
// runs in the browser (live recognition) and in Node (tools/build_features.mjs)
// when the models are trained, so training and inference can never drift.
//
// A "hand" here is { world: [21 × {x,y,z}], pos: [21 × {x,y,z}] }:
//   world – MediaPipe worldLandmarks (metres, camera-aligned axes): finger shape
//   pos   – image landmarks in isotropic units (x and z scaled by width/height):
//           where the hands are relative to each other.

const WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9, PINKY_MCP = 17;
const TIPS = [4, 8, 12, 16, 20];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]) || 1e-9;
const unit = (a) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const arr = (p) => Array.isArray(p) ? [p[0], p[1], p[2] || 0] : [p.x, p.y, p.z || 0];

function angle(a, b, c) {           // angle at b, in [0, 1] (0 = folded back, 1 = straight)
  const u = sub(a, b), v = sub(c, b);
  const cos = dot(u, v) / (norm(u) * norm(v));
  return Math.acos(Math.max(-1, Math.min(1, cos))) / Math.PI;
}

// Orthonormal frame attached to the hand: y = wrist→middle knuckle, x = toward
// the index side (pinky→index knuckle, made orthogonal), z = x × y.
export function handFrame(P) {
  const y = unit(sub(P[MIDDLE_MCP], P[WRIST]));
  const across = sub(P[INDEX_MCP], P[PINKY_MCP]);
  const x = unit(sub(across, scale(y, dot(across, y))));
  const z = cross(x, y);
  return { x, y, z, origin: P[WRIST], len: norm(sub(P[MIDDLE_MCP], P[WRIST])) };
}

const FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

// Shape features of one hand from its world landmarks. 90 numbers.
export function singleHandFeatures(worldLm) {
  const P = worldLm.map(arr);
  const F = handFrame(P);
  const inv = 1 / F.len;
  const local = (p) => { const d = sub(p, F.origin); return [dot(d, F.x) * inv, dot(d, F.y) * inv, dot(d, F.z) * inv]; };
  const out = [];
  // 1) every landmark in the hand frame (wrist and middle knuckle are fixed: skipped)
  for (let i = 0; i < 21; i++) if (i !== WRIST && i !== MIDDLE_MCP) out.push(...local(P[i]));
  // 2) joint angles: knuckle, middle and end joint of each finger
  for (const [m, p, d, t] of FINGERS) {
    out.push(angle(P[WRIST], P[m], P[p]), angle(P[m], P[p], P[d]), angle(P[p], P[d], P[t]));
  }
  // 3) distances (in palm lengths): thumb tip to each fingertip, adjacent
  //    fingertips, and each fingertip to the palm centre
  const centre = scale([WRIST, INDEX_MCP, MIDDLE_MCP, 13, PINKY_MCP]
    .reduce((s, i) => [s[0] + P[i][0], s[1] + P[i][1], s[2] + P[i][2]], [0, 0, 0]), 1 / 5);
  for (let k = 1; k < 5; k++) out.push(norm(sub(P[4], P[TIPS[k]])) * inv);
  for (let k = 1; k < 4; k++) out.push(norm(sub(P[TIPS[k]], P[TIPS[k + 1]])) * inv);
  for (const t of TIPS) out.push(norm(sub(P[t], centre)) * inv);
  // 4) orientation: world "up" and "toward camera" expressed in the hand frame
  const up = [0, -1, 0], toCam = [0, 0, -1];
  out.push(dot(up, F.x), dot(up, F.y), dot(up, F.z), dot(toCam, F.x), dot(toCam, F.y), dot(toCam, F.z));
  return out;
}
export const SINGLE_DIM = 90;

// Relation features for two hands (A = the hand further left in the image).
// Uses image positions for where the hands are, world frames for how they are
// turned relative to each other. 197 numbers.
export function twoHandFeatures(a, b) {
  const fa = singleHandFeatures(a.world), fb = singleHandFeatures(b.world);
  const PA = a.pos.map(arr), PB = b.pos.map(arr);
  const la = norm(sub(PA[MIDDLE_MCP], PA[WRIST])), lb = norm(sub(PB[MIDDLE_MCP], PB[WRIST]));
  const L = (la + lb) / 2 || 1e-9;
  const dw = sub(PB[WRIST], PA[WRIST]);
  const out = [...fa, ...fb, dw[0] / L, dw[1] / L, norm(dw) / L];
  const A = handFrame(a.world.map(arr)), B = handFrame(b.world.map(arr));
  for (const u of [A.x, A.y, A.z]) for (const v of [B.x, B.y, B.z]) out.push(dot(u, v));
  for (const i of [0, 4, 8, 12, 20]) out.push(norm(sub(PA[i], PB[i])) / L);
  return out;
}
export const TWO_DIM = 197;

// Closest approach of two hands, in palm lengths (image positions).
export function handsGap(a, b) {
  const PA = a.pos.map(arr), PB = b.pos.map(arr);
  const L = (norm(sub(PA[MIDDLE_MCP], PA[WRIST])) + norm(sub(PB[MIDDLE_MCP], PB[WRIST]))) / 2 || 1e-9;
  let best = Infinity;
  for (const p of PA) for (const q of PB) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best) best = d;
  }
  return best / L;
}

// Mirror a hand left↔right (image x flipped, world x negated). Used for
// training augmentation and to make predictions chirality-independent.
export function mirrorHand(h) {
  const m = (p) => { const q = arr(p); return [-q[0], q[1], q[2]]; };
  return { world: h.world.map(m), pos: h.pos.map(m) };
}

// Order two hands left-to-right by their wrist position in the image.
export function orderHands(a, b) {
  return arr(a.pos[WRIST])[0] <= arr(b.pos[WRIST])[0] ? [a, b] : [b, a];
}

// ------------------------------------------------------------------
// Inference for the exported MLP (see tools/train_model.py)
// ------------------------------------------------------------------
export function predict(model, x) {
  const n = x.length;
  const z = new Array(n);
  for (let i = 0; i < n; i++) z[i] = (x[i] - model.mean[i]) / model.scale[i];
  let h = z;
  for (let L = 0; L < model.layers.length; L++) {
    const { W, b } = model.layers[L];             // W: [in][out]
    const out = b.slice();
    for (let i = 0; i < h.length; i++) {
      const hi = h[i];
      if (hi === 0) continue;
      const row = W[i];
      for (let j = 0; j < out.length; j++) out[j] += hi * row[j];
    }
    h = L < model.layers.length - 1 ? out.map(v => (v > 0 ? v : 0)) : out;
  }
  const m = Math.max(...h);
  const e = h.map(v => Math.exp(v - m));
  const s = e.reduce((p, q) => p + q, 0);
  return e.map(v => v / s);
}
