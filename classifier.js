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
import { RECOGNIZABLE_ONE_HAND, RECOGNIZABLE_TWO_HAND, MUDRA_BY_ID } from './mudras.js';
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
      const n1 = h1.st.palmNormal, n2 = h2.st.palmNormal;
      const dotXZ = n1.x * n2.x + n1.z * n2.z;
      return Math.max(0, Math.min(1, (-dotXZ + 0.2) / 1.2));
    }
    case 'palmsUpward': {
      // y is INVERTED in image coords (down = positive). Palm normal y < 0 → palm faces up.
      const u1 = Math.max(0, Math.min(1, -h1.st.palmNormal.y * 1.5));
      const u2 = Math.max(0, Math.min(1, -h2.st.palmNormal.y * 1.5));
      return Math.min(u1, u2);
    }
    case 'palmsDownward': {
      const d1 = Math.max(0, Math.min(1, h1.st.palmNormal.y * 1.5));
      const d2 = Math.max(0, Math.min(1, h2.st.palmNormal.y * 1.5));
      return Math.min(d1, d2);
    }
    case 'palmsTowardCamera': {
      const c1 = Math.max(0, Math.min(1, -h1.st.palmNormal.z * 1.4));
      const c2 = Math.max(0, Math.min(1, -h2.st.palmNormal.z * 1.4));
      return Math.min(c1, c2);
    }
    case 'palmsBackToBack': {
      // Palms face OUTWARD (one to camera, one away) — antiparallel in z.
      const dotZ = h1.st.palmNormal.z * h2.st.palmNormal.z;
      return Math.max(0, Math.min(1, -dotZ));
    }
    case 'handsParallel': {
      // Both palms face the same direction (parallel normals).
      const n1 = h1.st.palmNormal, n2 = h2.st.palmNormal;
      const dot = n1.x*n2.x + n1.y*n2.y + n1.z*n2.z;
      return Math.max(0, dot);
    }
    case 'handsStacked': {
      // One wrist clearly above the other (y difference in hand-scale units).
      const dy = Math.abs(h1.lm[0].y - h2.lm[0].y);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      return Math.max(0, Math.min(1, (dy / avg - 0.4) / 0.6));
    }
    case 'handsSideBySide': {
      // Hands roughly at the same height, separated horizontally.
      const dy = Math.abs(h1.lm[0].y - h2.lm[0].y);
      const dx = Math.abs(h1.lm[0].x - h2.lm[0].x);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      const sideOK = dx / avg > 0.8;
      const levelOK = dy / avg < 0.4;
      return (sideOK && levelOK) ? 1 : 0;
    }
    case 'handsCrossed': {
      // Wrists close horizontally, and the wrist→middle vectors point in
      // opposing x directions (the forearms cross).
      const dx = Math.abs(h1.lm[0].x - h2.lm[0].x);
      const dy = Math.abs(h1.lm[0].y - h2.lm[0].y);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      const close = dx / avg < 0.7 && dy / avg < 0.5;
      const v1 = h1.lm[9].x - h1.lm[0].x;
      const v2 = h2.lm[9].x - h2.lm[0].x;
      const opposing = Math.sign(v1) !== Math.sign(v2) && Math.abs(v1) > 0.02 && Math.abs(v2) > 0.02;
      return (close && opposing) ? 1 : 0;
    }
    case 'pinkySidesTouching': {
      // Pinky tips close together — for Pushpapuṭa.
      const d = dist3(h1.lm[20], h2.lm[20]);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.5));
    }
    case 'thumbsHooked': {
      // Thumb tips close — for Garuḍa.
      const d = dist3(h1.lm[4], h2.lm[4]);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.4));
    }
    case 'indexFingersLinked': {
      // For Pāśa — two index fingers crossed at their middle joints.
      const d = dist3(h1.lm[6], h2.lm[6]);
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.6));
    }
    case 'fingertipsInterspersed': {
      // For Karkaṭa — interlocked fingers. Average distance between
      // opposing fingertip pairs is small (under-estimate of "interlock").
      const avg = (handScale(h1.lm) + handScale(h2.lm)) / 2;
      const tips = [8, 12, 16, 20];
      let sum = 0;
      for (let i = 0; i < tips.length; i++) {
        // Compare h1 tip i to h2 tip (3-i) — opposing pinky/index pairs.
        sum += dist3(h1.lm[tips[i]], h2.lm[tips[tips.length - 1 - i]]);
      }
      const avgD = sum / tips.length / avg;
      return Math.max(0, Math.min(1, 1 - avgD / 0.7));
    }
    default:
      return 0;
  }
}

function scoreTwoHand(mudra, hands) {
  // Per-hand portion of the score:
  //   - `components: ['mudraIdA', 'mudraIdB']` looks up each component
  //     mudra and evaluates its constraints against each hand; tries both
  //     left/right assignments and takes the better one (for asymmetric
  //     mudras the dancer may use either hand on top).
  //   - `perHand: [...constraints]` applies the same constraints to both
  //     hands (symmetric mudras).
  let ph;
  if (mudra.components) {
    const [aId, bId] = mudra.components;
    const ma = MUDRA_BY_ID[aId];
    const mb = MUDRA_BY_ID[bId];
    if (!ma?.constraints || !mb?.constraints) {
      ph = 0;
    } else {
      const s1a = scoreConstraints(ma.constraints, hands[0].lm, hands[0].st);
      const s1b = scoreConstraints(mb.constraints, hands[1].lm, hands[1].st);
      const s2a = scoreConstraints(mb.constraints, hands[0].lm, hands[0].st);
      const s2b = scoreConstraints(ma.constraints, hands[1].lm, hands[1].st);
      ph = Math.max((s1a + s1b) / 2, (s2a + s2b) / 2);
    }
  } else if (mudra.perHand) {
    const perHandScores = hands.slice(0, 2).map(h => scoreConstraints(mudra.perHand, h.lm, h.st));
    ph = (perHandScores[0] + perHandScores[1]) / 2;
  } else {
    ph = 0.5;
  }
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
