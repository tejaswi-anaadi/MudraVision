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
import { singleHandFeatures, twoHandFeatures, mirrorHand, orderHands, predict, handsGap } from './features.js';

// ============================================================
// Tuning
// ============================================================
export const CLASSIFY = {
  // Minimum overall score to be considered for a lock (two-hand mudras).
  threshold: 0.80,
  // Single-hand scores are blended with their worst constraint (minBlend), so
  // a correct-but-imperfect hand lands lower than it used to.
  singleThreshold: 0.65,
  // Required gap over the second-best different mudra.
  margin: 0.07,
  // When two hands are visible and a Samyukta mudra clears its own
  // threshold, prefer it over single-hand candidates.
  twoHandPriority: true,
  // Measure finger SHAPE (curl, spread, palm normal) on MediaPipe's metric
  // worldLandmarks when available. Image landmarks have a weak z, so a finger
  // bending toward the camera looks straight; world landmarks are isotropic
  // and carry a far better depth estimate. Positions BETWEEN two hands always
  // come from the image landmarks (world coords are hand-centred).
  // Set false to fall back to the aspect-corrected image landmarks.
  useWorldLandmarks: true,
  // Single-hand only (two-hand scoring is unchanged). Blend the WORST
  // constraint into the weighted mean:
  //   score = mean * (1 - minBlend) + minScore * minBlend
  // A plain weighted mean lets a mudra with one clearly-violated constraint
  // still score ~0.88, so near-twins (Tripatāka/Ardhapatāka, Arāla/Patāka)
  // sit within a hair of each other. Counting the worst constraint widens the
  // gap between a hand that satisfies everything and one that breaks a rule.
  minBlend: 0.3,
  // Learned models (models/*.json): a two-hand result from the model is
  // accepted once its probability reaches this; otherwise we fall through to
  // the per-hand pass.
  modelTwoAccept: 0.5,
  // Two-hand mudras keep the hands together. If the closest points of the two
  // hands are further apart than this (palm lengths), the two-hand model's
  // answer is down-weighted — it was never shown two unrelated hands.
  // (Set from the dataset: see tools/train_model.py output.)
  twoHandMaxGap: 1.6,
};

// ============================================================
// Learned models — set by app.js at boot (setModels). When absent, the rule
// engine alone is used, exactly as before.
// ============================================================
let MODELS = { single: null, two: null };
export function setModels(m = {}) { MODELS = { single: m.single || null, two: m.two || null }; }
export function getModels() { return MODELS; }

const modelHand = (h) => ({ world: h.world || h.lm, pos: h.pos });
const avg = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const toMap = (classes, p) => Object.fromEntries(classes.map((c, i) => [c, p[i]]));

// Probabilities from the hand AND its mirror image, averaged — so the model
// doesn't care which hand the dancer uses.
function predictSingle(h) {
  const m = MODELS.single, H = modelHand(h);
  return toMap(m.classes, avg(predict(m, singleHandFeatures(H.world)),
                              predict(m, singleHandFeatures(mirrorHand(H).world))));
}
function predictTwo(a, b) {
  const m = MODELS.two, A = modelHand(a), B = modelHand(b);
  const [p, q] = orderHands(A, B);
  const [mp, mq] = orderHands(mirrorHand(A), mirrorHand(B));
  return toMap(m.classes, avg(predict(m, twoHandFeatures(p, q)), predict(m, twoHandFeatures(mp, mq))));
}

// Merge model probabilities with rule scores. Mudras the model knows take its
// probability; mudras it was never trained on (deity/avatar combinations,
// Samdamsha) keep their rule score, discounted by how confident the model is
// that the hand is one it does know.
function mergeWithModel(ruleScores, probs, handsRef) {
  const pmax = Math.max(...Object.values(probs));
  const out = ruleScores.map(s => (probs[s.id] != null
    ? { ...s, score: probs[s.id], ruleScore: s.score, source: 'model' }
    : { ...s, score: s.score * (1 - pmax), ruleScore: s.score }));
  const seen = new Set(out.map(s => s.id));
  for (const [id, p] of Object.entries(probs)) {
    if (!seen.has(id) && MUDRA_BY_ID[id]) out.push({ id, score: p, mudra: MUDRA_BY_ID[id], hands: handsRef, source: 'model' });
  }
  return out;
}

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
function scoreConstraints(constraints, lm, st, blend = 0) {
  let totalW = 0, gotW = 0, minS = 1;
  for (const c of constraints) {
    const w = c.weight ?? 1;
    const sc = evalConstraint(c, lm, st);
    totalW += w;
    gotW += w * sc;
    // Only constraints that matter (weight >= 0.5) can drag the minimum.
    if (w >= 0.5 && sc < minS) minS = sc;
  }
  if (totalW <= 0) return 0;
  const mean = gotW / totalW;
  return blend > 0 ? mean * (1 - blend) + minS * blend : mean;
}

// ============================================================
// Structural penalties — "unexplained evidence"
//
// A weighted average of the constraints a mudra DOES specify can't see
// salient features it does NOT mention. Permissive mudras (Arāla, Alapadma,
// Padmakośa …) therefore win on hands that obviously do something their spec
// is silent about: a thumb pinched to a fingertip, or all five tips drawn
// into a bud. These penalties dock a mudra when the hand shows such a
// feature and the mudra's constraints never account for it.
// ============================================================
export const PENALTY = {
  touchDist: 0.30,     // thumb-tip ↔ fingertip distance (hand-scales) counted as a pinch
  touchFactor: 0.88,   // multiplier per unexplained pinch
  maxTouches: 2,
  bud: 0.50,           // all-tip cluster distance counted as a converged bud
  budMaxMeanCurl: 0.50,// ...but only when the fingers are not simply a fist
  budFactor: 0.70,
};

function explainsTouch(constraints, finger) {
  return constraints.some(c =>
    (c.type === 'touch' || c.type === 'notTouch') &&
    c.fingers.includes('thumb') && c.fingers.includes(finger));
}
function explainsBud(constraints) {
  return constraints.some(c => c.type === 'clustered' || c.type === 'touch');
}

function structuralFactor(constraints, lm, st) {
  let factor = 1, pinches = 0;
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    if (normDist(lm, FINGERS.thumb.tip, FINGERS[f].tip) < PENALTY.touchDist &&
        !explainsTouch(constraints, f)) pinches++;
  }
  factor *= Math.pow(PENALTY.touchFactor, Math.min(pinches, PENALTY.maxTouches));

  const c = st.curlScore;
  const meanCurl = (c.index + c.middle + c.ring + c.pinky) / 4;
  if (st.clusterDistance < PENALTY.bud && meanCurl < PENALTY.budMaxMeanCurl &&
      !explainsBud(constraints)) {
    factor *= PENALTY.budFactor;
  }
  return factor;
}

// ============================================================
// Two-hand predicates
// ============================================================
// Geometry between the two hands uses `pos` (shared image space), never the
// per-hand `lm` shape landmarks (hand-centred when they are world coords).
function evalTwoHand(t, h1, h2) {
  switch (t.type) {
    case 'wristsClose': {
      const a = h1.pos[0], b = h2.pos[0];
      const avgScale = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      const d = dist3(a, b) / avgScale;
      const limit = t.threshold ?? 1.0;
      // Smooth: 1 well inside, fades to 0 at 1.6 * limit.
      return Math.max(0, Math.min(1, 1 - d / (limit * 1.6)));
    }
    case 'bothPointUp': {
      const up1 = h1.pos[12].y < h1.pos[9].y - 0.02;
      const up2 = h2.pos[12].y < h2.pos[9].y - 0.02;
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
      const dy = Math.abs(h1.pos[0].y - h2.pos[0].y);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      return Math.max(0, Math.min(1, (dy / avg - 0.4) / 0.6));
    }
    case 'handsSideBySide': {
      // Hands roughly at the same height, separated horizontally.
      const dy = Math.abs(h1.pos[0].y - h2.pos[0].y);
      const dx = Math.abs(h1.pos[0].x - h2.pos[0].x);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      const sideOK = dx / avg > 0.8;
      const levelOK = dy / avg < 0.4;
      return (sideOK && levelOK) ? 1 : 0;
    }
    case 'handsCrossed': {
      // Wrists close horizontally, and the wrist→middle vectors point in
      // opposing x directions (the forearms cross).
      const dx = Math.abs(h1.pos[0].x - h2.pos[0].x);
      const dy = Math.abs(h1.pos[0].y - h2.pos[0].y);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      const close = dx / avg < 0.7 && dy / avg < 0.5;
      const v1 = h1.pos[9].x - h1.pos[0].x;
      const v2 = h2.pos[9].x - h2.pos[0].x;
      const opposing = Math.sign(v1) !== Math.sign(v2) && Math.abs(v1) > 0.02 && Math.abs(v2) > 0.02;
      return (close && opposing) ? 1 : 0;
    }
    case 'pinkySidesTouching': {
      // Pinky tips close together — for Pushpapuṭa.
      const d = dist3(h1.pos[20], h2.pos[20]);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.5));
    }
    case 'thumbsHooked': {
      // Thumb tips close — for Garuḍa.
      const d = dist3(h1.pos[4], h2.pos[4]);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.4));
    }
    case 'indexFingersLinked': {
      // For Pāśa — two index fingers crossed at their middle joints.
      const d = dist3(h1.pos[6], h2.pos[6]);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / 0.6));
    }
    case 'fingertipsInterspersed': {
      // For Karkaṭa — interlocked fingers. Average distance between
      // opposing fingertip pairs is small (under-estimate of "interlock").
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      const tips = [8, 12, 16, 20];
      let sum = 0;
      for (let i = 0; i < tips.length; i++) {
        // Compare h1 tip i to h2 tip (3-i) — opposing pinky/index pairs.
        sum += dist3(h1.pos[tips[i]], h2.pos[tips[tips.length - 1 - i]]);
      }
      const avgD = sum / tips.length / avg;
      return Math.max(0, Math.min(1, 1 - avgD / 0.7));
    }
    case 'fingertipsClose': {
      // Middle fingertips near each other — whole palms together (Añjali).
      const d = dist3(h1.pos[12], h2.pos[12]);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      return Math.max(0, Math.min(1, 1 - d / avg / (t.threshold ?? 1.0)));
    }
    case 'fingertipsApart': {
      // Middle fingertips clearly separated while wrists stay close — the
      // "opening at the top" of Kapota.
      const d = dist3(h1.pos[12], h2.pos[12]);
      const avg = (handScale(h1.pos) + handScale(h2.pos)) / 2;
      const min = t.min ?? 1.0;
      return Math.max(0, Math.min(1, (d / avg - min) / 0.8));
    }
    case 'forearmsCrossed': {
      // Angle between the two wrist→middle-MCP vectors. A true cross (X)
      // peaks near 90°; parallel hands (Añjali) score ~0. This replaces the
      // old sign-based test that false-fired on parallel upward hands.
      const v1x = h1.pos[9].x - h1.pos[0].x, v1y = h1.pos[9].y - h1.pos[0].y;
      const v2x = h2.pos[9].x - h2.pos[0].x, v2y = h2.pos[9].y - h2.pos[0].y;
      const cos = (v1x*v2x + v1y*v2y) /
                  (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
      const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      // 1 at 90°, 0 at 0° or 180°.
      return Math.max(0, Math.min(1, 1 - Math.abs(ang - 90) / 60));
    }
    case 'forearmsParallel': {
      // Wrist→middle vectors nearly aligned (both hands the same way up).
      const v1x = h1.pos[9].x - h1.pos[0].x, v1y = h1.pos[9].y - h1.pos[0].y;
      const v2x = h2.pos[9].x - h2.pos[0].x, v2y = h2.pos[9].y - h2.pos[0].y;
      const cos = (v1x*v2x + v1y*v2y) /
                  (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
      return Math.max(0, cos);
    }
    case 'bothPointDown': {
      const d1 = h1.pos[12].y > h1.pos[9].y + 0.02;
      const d2 = h2.pos[12].y > h2.pos[9].y + 0.02;
      return (d1 ? 0.5 : 0) + (d2 ? 0.5 : 0);
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
    let two = RECOGNIZABLE_TWO_HAND
      .map(m => ({ id: m.id, score: scoreTwoHand(m, hands), mudra: m, hands, source: 'rule' }));
    let accept = CLASSIFY.threshold;
    if (MODELS.two) {
      const probs = predictTwo(hands[0], hands[1]);
      // Hands far apart are not one two-hand mudra: damp the model's answer.
      const gap = handsGap(modelHand(hands[0]), modelHand(hands[1]));
      if (gap > CLASSIFY.twoHandMaxGap) {
        const k = Math.max(0, 1 - (gap - CLASSIFY.twoHandMaxGap) / CLASSIFY.twoHandMaxGap);
        for (const id of Object.keys(probs)) probs[id] *= k;
      }
      two = mergeWithModel(two, probs, hands);
      accept = CLASSIFY.modelTwoAccept;
    }
    two.sort((a, b) => b.score - a.score);
    if (two[0] && two[0].score >= accept) {
      const top = two[0];
      const second = two[1] || { score: 0 };
      const lock = (top.score - second.score >= CLASSIFY.margin) ? top : null;
      return { lock, top, second, allScores: two, source: top.source };
    }
  }

  // Single-hand RULE pass — every built-in mudra scored against every hand.
  const allScores = [];
  for (const h of hands) {
    let scores = RECOGNIZABLE_ONE_HAND.map(m => ({
      id: m.id,
      score: scoreConstraints(m.constraints, h.lm, h.st, CLASSIFY.minBlend) *
             structuralFactor(m.constraints, h.lm, h.st),
      mudra: m,
      hands: [h],
      source: 'rule',
    }));
    if (MODELS.single) scores = mergeWithModel(scores, predictSingle(h), [h]);
    allScores.push(...scores);
  }

  // k-NN pass — captured mudras compete head-to-head with rules.
  for (const h of hands) {
    // kNN vectors were captured from image-normalised landmarks (capture.js),
    // so keep matching in that space, not the aspect-corrected one.
    const vec = normalizeLandmarks(h.norm || h.lm);
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
  const lock = (top.score >= CLASSIFY.singleThreshold &&
                top.score - second.score >= CLASSIFY.margin) ? top : null;
  return { lock, top, second, allScores, source: top.source };
}

// ============================================================
// preprocessHands(): smooth landmarks per identity, compute hand state.
// handedness: optional array from MediaPipe (categories per hand).
// ============================================================
//
// aspect: video width / height. MediaPipe's image landmarks normalise x by
// the frame width and y by the frame height, so on a 16:9 frame a given
// physical distance spans ~1.78x more x-units than y-units. That skews every
// 3D angle, distance and hand-scale; z uses roughly x's scale. Scaling x and
// z by the aspect puts the hand in an isotropic space (height units).
//
// worldList: optional MediaPipe worldLandmarks, one array per hand.
//
// Each returned hand carries:
//   lm    – the SHAPE landmarks the rule classifier scores (world when
//           available and enabled, otherwise isotropic image)
//   pos   – isotropic image landmarks; used for geometry BETWEEN hands
//   norm  – image-normalised landmarks; used for drawing and kNN (stored
//           captures were recorded in that space)
export function preprocessHands(landmarksList, handedness = [], aspect = 1, worldList = null) {
  const k = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const used = new Set();
  return (landmarksList || []).map((lm, i) => {
    const cat = handedness?.[i]?.[0]?.categoryName;
    // Smoothing identity. MediaPipe often labels BOTH hands "Right" when they
    // overlap or interlock; keying both on "mp-Right" made the second hand be
    // smoothed INTO the first one, scrambling every two-hand mudra. Keep ids
    // unique within a frame.
    let handId = cat ? `mp-${cat}` : `idx-${i}`;
    if (used.has(handId)) handId = `${handId}#${i}`;
    used.add(handId);
    const norm = applySmoothing(lm, handId);
    const pos = k === 1 ? norm : norm.map(p => ({ x: p.x * k, y: p.y, z: p.z * k }));
    const w = worldList?.[i];
    const world = (w && w.length === 21) ? applySmoothing(w, `${handId}:world`) : null;
    const shape = (CLASSIFY.useWorldLandmarks && world) ? world : pos;
    return { lm: shape, pos, norm, world, raw: lm, st: handState(shape), handId };
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
