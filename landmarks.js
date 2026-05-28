// landmarks.js
// Geometry primitives for MediaPipe Hand Landmarker output.
//
// Improvements:
//   1. Temporal smoothing (EMA) per hand identity, dramatically reducing
//      per-frame jitter without much added latency.
//   2. Continuous curl, touch, direction, spread scores in [0, 1] — the
//      classifier now uses partial credit rather than binary pass/fail.
//   3. 3D vector math throughout: x/y/z used for angles and distances so
//      gestures held at oblique angles to the camera are still measured
//      correctly.
//   4. Stable hand scale: average of three palm distances rather than just
//      wrist→middleMCP, so a single finger moving doesn't change scale.
//   5. Thumb extension measured by tip-to-palm-centroid (cleanly separates
//      thumb-across-palm from thumb-out-away from the palm).
//   6. Palm normal vector for orientation-aware constraints.

// ============================================================
// Tuning constants
// ============================================================
export const CURL = {
  // PIP angles (degrees) for finger curl score interpolation.
  pipExtended: 175, pipCurled: 55,
  dipExtended: 175, dipCurled: 70,
  // Thumb: distance from tip to palm centroid (normalized by hand scale).
  thumbExtendedDist: 0.95, thumbCurledDist: 0.30,
};

// Bands map continuous curl score → discrete state, with a tolerance zone
// outside each band where partial credit is awarded.
export const CURL_BANDS = {
  extended: { min: 0.00, max: 0.32, soft: 0.18 },
  half:     { min: 0.28, max: 0.68, soft: 0.15 },
  curled:   { min: 0.65, max: 1.00, soft: 0.18 },
};

export const TOUCH = {
  tipToTip:  0.28,
  tipToBase: 0.40,
  cluster:   0.20,
};

export const SMOOTHING = {
  // EMA factor for landmark filter: alpha=1 → no smoothing, alpha=0 → frozen.
  // 0.55 gives a 3-frame response time at 30fps — feels live but is stable.
  alpha: 0.55,
  // If a hand identity wasn't seen for this many frames, reset its filter
  // (avoids smoothing in a long jump across the screen).
  resetGapFrames: 4,
};

// ============================================================
// MediaPipe 21-point hand landmark indices
// ============================================================
export const FINGERS = {
  thumb:  { cmc: 1,  mcp: 2,  ip: 3,  tip: 4  },
  index:  { mcp: 5,  pip: 6,  dip: 7,  tip: 8  },
  middle: { mcp: 9,  pip: 10, dip: 11, tip: 12 },
  ring:   { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky:  { mcp: 17, pip: 18, dip: 19, tip: 20 },
};
export const FINGER_NAMES = ['thumb','index','middle','ring','pinky'];
export const WRIST = 0;
export const MIDDLE_MCP = 9;
export const INDEX_MCP = 5;
export const RING_MCP = 13;
export const PINKY_MCP = 17;

// ============================================================
// 3D vector helpers
// ============================================================
const z = (p) => p.z || 0;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: z(a) - z(b) });
const dot = (a, b) => a.x*b.x + a.y*b.y + z(a)*z(b);
const mag = (a) => Math.hypot(a.x, a.y, z(a));
const cross = (a, b) => ({
  x: a.y*z(b) - z(a)*b.y,
  y: z(a)*b.x - a.x*z(b),
  z: a.x*b.y - a.y*b.x,
});
const normalize = (a) => { const m = mag(a); return m < 1e-9 ? {x:0,y:0,z:0} : { x:a.x/m, y:a.y/m, z:z(a)/m }; };
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// 3D angle (degrees) at vertex p2.
export function angleAt(p1, p2, p3) {
  const v1 = sub(p1, p2), v2 = sub(p3, p2);
  const c = dot(v1, v2) / (mag(v1) * mag(v2) + 1e-9);
  return Math.acos(clamp(c, -1, 1)) * 180 / Math.PI;
}

// ============================================================
// Hand scale
// ============================================================
// Average of three palm bone lengths — much more stable than wrist→middleMCP
// alone because no single finger flexion changes it.
export function handScale(lm) {
  const d1 = mag(sub(lm[INDEX_MCP],  lm[WRIST]));
  const d2 = mag(sub(lm[MIDDLE_MCP], lm[WRIST]));
  const d3 = mag(sub(lm[PINKY_MCP],  lm[WRIST]));
  return (d1 + d2 + d3) / 3 + 1e-9;
}
export const dist3 = (a, b) => mag(sub(a, b));
export function normDist(lm, i, j) { return dist3(lm[i], lm[j]) / handScale(lm); }
export function normDistP(lm, a, b) { return dist3(a, b) / handScale(lm); }

// ============================================================
// Palm centroid (3D)
// ============================================================
export function palmCentroid(lm) {
  return {
    x: (lm[INDEX_MCP].x + lm[MIDDLE_MCP].x + lm[RING_MCP].x + lm[PINKY_MCP].x) / 4,
    y: (lm[INDEX_MCP].y + lm[MIDDLE_MCP].y + lm[RING_MCP].y + lm[PINKY_MCP].y) / 4,
    z: (z(lm[INDEX_MCP]) + z(lm[MIDDLE_MCP]) + z(lm[RING_MCP]) + z(lm[PINKY_MCP])) / 4,
  };
}

// ============================================================
// Continuous finger curl score in [0, 1]
//   0 = fully extended (straight finger)
//   1 = fully curled (folded into palm)
// ============================================================
export function fingerCurlScore(lm, finger) {
  if (finger === 'thumb') return thumbCurlScore(lm);
  const f = FINGERS[finger];
  const ap = angleAt(lm[f.mcp], lm[f.pip], lm[f.tip]);
  const ad = angleAt(lm[f.pip], lm[f.dip], lm[f.tip]);
  const sp = clamp((CURL.pipExtended - ap) / (CURL.pipExtended - CURL.pipCurled));
  const sd = clamp((CURL.dipExtended - ad) / (CURL.dipExtended - CURL.dipCurled));
  // PIP dominates the visible curl shape; DIP nudges the final answer.
  return clamp(sp * 0.72 + sd * 0.28);
}

// Thumb curl: tip-to-palm-centroid distance, normalized.
//   - thumb folded across palm (Patāka, Muṣṭi): tip near centroid → score 1
//   - thumb pulled away from palm (Śikhara, Ardhacandra): tip far → score 0
export function thumbCurlScore(lm) {
  const c = palmCentroid(lm);
  const d = dist3(lm[FINGERS.thumb.tip], c) / handScale(lm);
  // Linear map: d ≤ thumbCurledDist → 1, d ≥ thumbExtendedDist → 0.
  return clamp((CURL.thumbExtendedDist - d) /
               (CURL.thumbExtendedDist - CURL.thumbCurledDist));
}

// Discrete state from continuous score (for human-readable debug output).
export function fingerCurl(lm, finger) {
  const s = fingerCurlScore(lm, finger);
  if (s < CURL_BANDS.extended.max) return 'extended';
  if (s > CURL_BANDS.curled.min)   return 'curled';
  return 'half';
}

// Continuous match score against a target curl state (or list of states).
// 1.0 if the actual score falls inside the band; smoothly decays outside.
export function curlMatchScore(lm, finger, targetState) {
  const actual = fingerCurlScore(lm, finger);
  const targets = Array.isArray(targetState) ? targetState : [targetState];
  let best = 0;
  for (const t of targets) {
    const band = CURL_BANDS[t];
    if (!band) continue;
    let s;
    if (actual >= band.min && actual <= band.max) {
      s = 1;
    } else {
      const d = actual < band.min ? (band.min - actual) : (actual - band.max);
      s = Math.max(0, 1 - d / band.soft);
    }
    best = Math.max(best, s);
  }
  return best;
}

// ============================================================
// Finger direction (2D dominant + continuous match score)
// ============================================================
export function fingerDirection(lm, finger) {
  const f = FINGERS[finger];
  const base = finger === 'thumb' ? lm[f.cmc] : lm[f.mcp];
  const tip = lm[f.tip];
  const dx = tip.x - base.x, dy = tip.y - base.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}

const DIR_VECTORS = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};
// 1.0 if finger points exactly in target direction; ~0 if opposite.
export function directionMatchScore(lm, finger, targetDir) {
  const f = FINGERS[finger];
  const base = finger === 'thumb' ? lm[f.cmc] : lm[f.mcp];
  const tip = lm[f.tip];
  let vx = tip.x - base.x, vy = tip.y - base.y;
  const v = Math.hypot(vx, vy) + 1e-9;
  vx /= v; vy /= v;
  const targets = Array.isArray(targetDir) ? targetDir : [targetDir];
  let best = 0;
  for (const t of targets) {
    const tv = DIR_VECTORS[t];
    if (!tv) continue;
    // Cosine similarity, remapped: 1 (perfect match) → 1, 0 (perpendicular) → ~0.4, -1 (opposite) → 0
    const cos = vx * tv.x + vy * tv.y;
    best = Math.max(best, clamp((cos + 0.4) / 1.4));
  }
  return best;
}

// ============================================================
// Touch scores (continuous)
// ============================================================
export function touchScore(lm, fingerA, fingerB, threshold = TOUCH.tipToTip) {
  const d = normDist(lm, FINGERS[fingerA].tip, FINGERS[fingerB].tip);
  // 1 at d=0, 0.5 at d≈threshold*0.8, ~0 at d=threshold*1.6
  return clamp(1 - d / (threshold * 1.6));
}
export function tipsTouching(lm, fa, fb, threshold = TOUCH.tipToTip) {
  return normDist(lm, FINGERS[fa].tip, FINGERS[fb].tip) < threshold;
}

// ============================================================
// Spread (average gap between adjacent fingertips)
// ============================================================
export function fingerSpread(lm) {
  const tips = [FINGERS.index.tip, FINGERS.middle.tip, FINGERS.ring.tip, FINGERS.pinky.tip];
  let total = 0;
  for (let i = 0; i < tips.length - 1; i++) total += normDist(lm, tips[i], tips[i+1]);
  return total / (tips.length - 1);
}

// ============================================================
// Other gross measurements
// ============================================================
export function thumbIndexAngle(lm) {
  return angleAt(lm[FINGERS.thumb.tip], lm[WRIST], lm[FINGERS.index.tip]);
}

// True if all five fingertips are clustered together (Mukula).
export function allTipsClustered(lm, threshold = TOUCH.cluster) {
  return clusterScore(lm) >= 1 - 1e-6 ? true : (clusterDistance(lm) < threshold);
}
export function clusterDistance(lm) {
  const tips = FINGER_NAMES.map(n => lm[FINGERS[n].tip]);
  const cx = tips.reduce((s, p) => s + p.x, 0) / tips.length;
  const cy = tips.reduce((s, p) => s + p.y, 0) / tips.length;
  const cz = tips.reduce((s, p) => s + z(p), 0) / tips.length;
  let maxD = 0;
  for (const p of tips) maxD = Math.max(maxD, mag({x:p.x-cx, y:p.y-cy, z:z(p)-cz}));
  return maxD / handScale(lm);
}
export function clusterScore(lm) {
  return clamp(1 - clusterDistance(lm) / TOUCH.cluster);
}

// ============================================================
// Palm orientation
// ============================================================
// Palm normal (3D, unit length). Direction depends on hand orientation;
// take the cross product of two palm vectors so the normal points OUT of
// the palm side that has the fingers (palm-side, not back-side).
export function palmNormal(lm) {
  const v1 = sub(lm[INDEX_MCP], lm[WRIST]);
  const v2 = sub(lm[PINKY_MCP], lm[WRIST]);
  return normalize(cross(v1, v2));
}
// 'camera' (palm faces toward camera), 'away', or 'side'.
// MediaPipe z: smaller (negative) is closer to camera, so a normal with
// negative z points toward camera.
export function palmFacing(lm) {
  const n = palmNormal(lm);
  if (n.z < -0.45) return 'camera';
  if (n.z >  0.45) return 'away';
  return 'side';
}

// ============================================================
// Centroid + bounding box
// ============================================================
export function handCentroid(lm) {
  let x = 0, y = 0, zz = 0;
  for (const p of lm) { x += p.x; y += p.y; zz += z(p); }
  return { x: x / lm.length, y: y / lm.length, z: zz / lm.length };
}
export function handBBox(lm) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// ============================================================
// Temporal smoothing (per-hand EMA filter)
// ============================================================
const smoothing = new Map();      // handId → { lm: [...], lastFrame: N }
let frameCounter = 0;
export function tickFrame() { frameCounter++; }
export function resetSmoothing(handId = null) {
  if (handId === null) smoothing.clear();
  else smoothing.delete(handId);
}
// Apply EMA filter using `handId` (e.g. 'Left'/'Right' from MediaPipe). On
// first sight, or after a gap, the filter snaps to the new position.
export function applySmoothing(lm, handId = 'default') {
  const prev = smoothing.get(handId);
  if (!prev || (frameCounter - prev.lastFrame) > SMOOTHING.resetGapFrames) {
    const fresh = lm.map(p => ({ x: p.x, y: p.y, z: z(p) }));
    smoothing.set(handId, { lm: fresh, lastFrame: frameCounter });
    return fresh;
  }
  const a = SMOOTHING.alpha;
  const next = lm.map((p, i) => ({
    x: a * p.x + (1-a) * prev.lm[i].x,
    y: a * p.y + (1-a) * prev.lm[i].y,
    z: a * z(p) + (1-a) * prev.lm[i].z,
  }));
  smoothing.set(handId, { lm: next, lastFrame: frameCounter });
  return next;
}

// ============================================================
// Full hand state snapshot (computed once per frame)
// ============================================================
export function handState(lm) {
  const curlScore = {}, curl = {}, dir = {};
  for (const f of FINGER_NAMES) {
    curlScore[f] = fingerCurlScore(lm, f);
    curl[f] = curlScore[f] < CURL_BANDS.extended.max ? 'extended'
            : curlScore[f] > CURL_BANDS.curled.min   ? 'curled'
            : 'half';
    dir[f] = fingerDirection(lm, f);
  }
  return {
    curlScore, curl, dir,
    scale: handScale(lm),
    spread: fingerSpread(lm),
    thumbIndexAngle: thumbIndexAngle(lm),
    allTipsClustered: allTipsClustered(lm),
    clusterScore: clusterScore(lm),
    clusterDistance: clusterDistance(lm),
    palmFacing: palmFacing(lm),
    palmNormal: palmNormal(lm),
    centroid: handCentroid(lm),
    palmCentroid: palmCentroid(lm),
  };
}

// ============================================================
// Landmark normalization for k-NN classification.
//
// Returns a flat number[63] (21 points × xyz) that is invariant to
//   1) where the hand is in the frame,
//   2) how big the hand appears,
//   3) the hand's in-plane roll (the wrist→middle_MCP axis is always "up").
// z is kept relative to the wrist so out-of-plane orientation still
// distinguishes mudras.
// ============================================================
export function normalizeLandmarks(lm) {
  if (!lm || lm.length < 21) return null;
  // 1. translate so wrist is origin
  const w = lm[WRIST];
  const wz = z(w);
  const t = lm.map(p => ({ x: p.x - w.x, y: p.y - w.y, z: z(p) - wz }));
  // 2. scale by wrist→middle-MCP distance (after translation)
  const m = t[MIDDLE_MCP];
  const scale = Math.hypot(m.x, m.y, m.z) + 1e-9;
  const s = t.map(p => ({ x: p.x / scale, y: p.y / scale, z: p.z / scale }));
  // 3. rotate around z so wrist→middle_MCP points in the -y direction
  const m2 = s[MIDDLE_MCP];
  const angle = Math.atan2(m2.x, -m2.y);
  const cs = Math.cos(-angle), sn = Math.sin(-angle);
  const out = new Float32Array(63);
  for (let i = 0; i < 21; i++) {
    const p = s[i];
    out[i * 3]     = cs * p.x - sn * p.y;
    out[i * 3 + 1] = sn * p.x + cs * p.y;
    out[i * 3 + 2] = p.z;
  }
  return Array.from(out);
}

// Euclidean distance between two normalized landmark vectors (Float32Array
// or number[]). Used by the k-NN classifier.
export function vectorDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// ============================================================
// MediaPipe skeleton connections
// ============================================================
export const CONNECTIONS = [
  [0,1],[0,5],[5,9],[9,13],[13,17],[0,17],
  [1,2],[2,3],[3,4],
  [5,6],[6,7],[7,8],
  [9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],
  [17,18],[18,19],[19,20],
];
export const TIP_INDICES = new Set([4, 8, 12, 16, 20]);
