// classifier.js
// Continuous-score mudra classifier. Each constraint returns a [0, 1]
// satisfaction score (partial credit) rather than a binary pass/fail, so
// the overall mudra score moves smoothly as the user adjusts their hand —
// which makes the rolling buffer in app.js much more decisive.

import {
  FINGERS, tipsTouching, normDist, handScale, handState, TOUCH, dist3,
  curlMatchScore, touchScore, directionMatchScore, clusterScore,
  applySmoothing, fingerCurlScore, palmCentroid, normalizeLandmarks,
} from './landmarks.js';
import { RECOGNIZABLE_ONE_HAND, RECOGNIZABLE_TWO_HAND } from './mudras.js';
import * as knn from './knn.js';

// ============================================================
// Tuning
// ============================================================
export const CLASSIFY = {
  // Minimum overall score to be considered for a lock.
  threshold: 0.80,
  // Required gap over the second-best different mudra.
  margin: 0.07,
  // When two hands are visible and a Samyukta mudra clears its own
  // threshold, prefer it over single-hand candidates.
  twoHandPriority: true,
};

const asArray = (x) => Array.isArray(x) ? x : [x];

// ============================================================
// Per-constraint evaluation — returns a [0, 1] satisfaction score.
// ============================================================
function evalConstraint(c, lm, st) {
  switch (c.type) {
    case 'curl':
      return curlMatchScore(lm, c.finger, c.state);

    case 'direction':
      return directionMatchScore(lm, c.finger, c.dir);

    case 'touch':
      return touchScore(lm, c.fingers[0], c.fingers[1], c.threshold ?? TOUCH.tipToTip);

    case 'notTouch':
      return 1 - touchScore(lm, c.fingers[0], c.fingers[1], c.threshold ?? TOUCH.tipToTip);

    case 'spread':
      return bandScore(st.spread, c.min, c.max, c.soft ?? 0.08);

    case 'thumbIndexAngle':
      return bandScore(st.thumbIndexAngle, c.min, c.max, c.soft ?? 25);

    case 'clustered':
      return clusterScore(lm);

    case 'palmFacing':
      return asArray(c.facing).includes(st.palmFacing) ? 1 : 0.2;

    case 'custom':
      return Number(c.test(lm, st)) || 0;

    default:
      return 0;
  }
}

// Soft band scorer. Returns 1 inside [min, max], decays linearly over `soft`
// outside, hits 0 beyond. Either bound can be null.
function bandScore(value, min, max, soft) {
  if (min != null && value < min) {
    return Math.max(0, 1 - (min - value) / soft);
  }
  if (max != null && value > max) {
    return Math.max(0, 1 - (value - max) / soft);
  }
  return 1;
}

// ============================================================
// Score a list of constraints — weighted average of per-constraint scores.
// ============================================================
function scoreConstraints(constraints, lm, st) {
  let totalW = 0, gotW = 0;
  for (const c of constraints) {
    const w = c.weight ?? 1;
    totalW += w;
    gotW += w * evalConstraint(c, lm, st);
  }
  return totalW > 0 ? gotW / totalW : 0;
}

// ============================================================
// Two-hand predicates
// ============================================================
function evalTwoHand(t, h1, h2) {
  switch (t.type) {
    case 'wristsClose': {
      const a = h1.lm[0], b = h2.lm[0];
      const avgScale = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      const d = dist3(a, b) / avgScale;
      const limit = t.threshold ?? 1.0;
      // Smooth: 1 well inside, fades to 0 at 1.6 * limit.
      return Math.max(0, Math.min(1, 1 - d / (limit * 1.6)));
    }
    case 'bothPointUp': {
      const up1 = h1.lm[12].y < h1.lm[9].y - 0.02;
      const up2 = h2.lm[12].y < h2.lm[9].y - 0.02;
      return (up1 ? 0.5 : 0) + (up2 ? 0.5 : 0);
    }
    case 'palmsTowardEachOther': {
      // Palm normals roughly antiparallel along the x axis.
      const n1 = h1.st.palmNormal, n2 = h2.st.palmNormal;
      const dotXZ = n1.x * n2.x + n1.z * n2.z;
      // Antiparallel: dot ≈ -1 → score 1; aligned: dot=1 → score 0.
      return Math.max(0, Math.min(1, (-dotXZ + 0.2) / 1.2));
    }
    default:
      return 0;
  }
}

function scoreTwoHand(mudra, hands) {
  const perHandScores = hands.slice(0, 2).map(h => scoreConstraints(mudra.perHand, h.lm, h.st));
  const ph = (perHandScores[0] + perHandScores[1]) / 2;
  let totalW = 0, gotW = 0;
  for (const t of (mudra.twoHand || [])) {
    const w = t.weight ?? 1;
    totalW += w;
    gotW += w * evalTwoHand(t, hands[0], hands[1]);
  }
  const th = totalW > 0 ? gotW / totalW : 1;
  return ph * 0.6 + th * 0.4;
}

// ============================================================
// classify() — main entry point.
// hands: array of { lm, st, raw, handId } (preprocessed)
// ============================================================
export function classify(hands) {
  if (!hands || hands.length === 0) {
    return { lock: null, top: null, second: null, allScores: [], source: null };
  }

  // Two-hand pass first, but only lock when score is clearly above threshold.
  if (CLASSIFY.twoHandPriority && hands.length >= 2) {
    const two = RECOGNIZABLE_TWO_HAND
      .map(m => ({ id: m.id, score: scoreTwoHand(m, hands), mudra: m, hands, source: 'rule' }))
      .sort((a, b) => b.score - a.score);
    if (two[0] && two[0].score >= CLASSIFY.threshold) {
      const top = two[0];
      const second = two[1] || { score: 0 };
      const lock = (top.score - second.score >= CLASSIFY.margin) ? top : null;
      return { lock, top, second, allScores: two, source: 'rule' };
    }
  }

  // Single-hand RULE pass — every built-in mudra scored against every hand.
  const allScores = [];
  for (const h of hands) {
    for (const m of RECOGNIZABLE_ONE_HAND) {
      allScores.push({
        id: m.id,
        score: scoreConstraints(m.constraints, h.lm, h.st),
        mudra: m,
        hands: [h],
        source: 'rule',
      });
    }
  }

  // k-NN pass — captured mudras compete head-to-head with rules.
  for (const h of hands) {
    const vec = normalizeLandmarks(h.lm);
    const r = knn.classify(vec);
    if (r && r.score >= 0.30) {
      // Small bias for "· 3D" upgrades over their generic built-in: when the
      // user has scanned their own hand, prefer it.
      const bias = r.builtinUpgrade ? 0.05 : 0;
      allScores.push({
        id: r.id,
        displayName: r.displayName,
        builtinUpgrade: r.builtinUpgrade,
        is3D: r.is3D,
        score: Math.min(1, r.score + bias),
        hands: [h],
        source: 'knn',
        nearestDist: r.nearestDist,
        angleLabel: r.angleLabel,
      });
    }
  }

  allScores.sort((a, b) => b.score - a.score);
  const top = allScores[0];
  if (!top) return { lock: null, top: null, second: null, allScores: [], source: null };
  const second = allScores.find(s => s.id !== top.id) || { score: 0 };
  const lock = (top.score >= CLASSIFY.threshold &&
                top.score - second.score >= CLASSIFY.margin) ? top : null;
  return { lock, top, second, allScores, source: top.source };
}

// ============================================================
// preprocessHands(): smooth landmarks per identity, compute hand state.
// handedness: optional array from MediaPipe (categories per hand).
// ============================================================
export function preprocessHands(landmarksList, handedness = []) {
  return (landmarksList || []).map((lm, i) => {
    const cat = handedness?.[i]?.[0]?.categoryName;
    const handId = cat ? `mp-${cat}` : `idx-${i}`;
    const smoothed = applySmoothing(lm, handId);
    return { lm: smoothed, raw: lm, st: handState(smoothed), handId };
  });
}

// Per-constraint detail for the debug overlay.
export function explain(constraints, lm, st) {
  return constraints.map(c => ({
    type: c.type, finger: c.finger,
    weight: c.weight ?? 1,
    score: evalConstraint(c, lm, st),
  }));
}
