// knn.js
// k-NN classifier over captured mudra landmarks.
//
// Each entry in the in-memory index is one captured angle (5 per mudra).
// `classify(vector)` returns the k=3 majority-voted mudra id with a
// distance-based confidence in [0, 1].
//
// `addMudra(record)` registers all 5 angles immediately — no rebuild step —
// so a freshly captured mudra is recognised on the next camera frame.

import { vectorDistance } from './landmarks.js';

// ============================================================
// Tuning
// ============================================================
export const KNN = {
  K: 3,
  // Distances below this map to confidence 1; distances at this map to 0.
  // Tune by watching the debug overlay during a misrecognition.
  MAX_DIST: 0.55,
  // Below this score we won't even put the k-NN result on the candidate list.
  MIN_SCORE: 0.55,
};

// ============================================================
// In-memory index
// ============================================================
let index = [];   // { id, displayName, builtinUpgrade, angleLabel, vector }

export function clear() { index = []; }

export function addMudra(record) {
  if (!record || !record.angles) return;
  for (const a of record.angles) {
    if (!a.landmarks || a.landmarks.length !== 63) continue;
    index.push({
      id: record.id,
      displayName: record.displayName,
      builtinUpgrade: record.builtinUpgrade || null,
      is3D: !!record.is3D,
      angleLabel: a.label,
      vector: a.landmarks,
    });
  }
}

export function removeMudra(id) {
  index = index.filter(e => e.id !== id);
}

export function size() { return index.length; }
export function mudraCount() { return new Set(index.map(e => e.id)).size; }

// ============================================================
// Classify
// ============================================================
export function classify(vector) {
  if (!vector || index.length === 0) return null;
  const scored = index.map(e => ({ e, d: vectorDistance(vector, e.vector) }));
  scored.sort((a, b) => a.d - b.d);
  const k = Math.min(KNN.K, scored.length);
  const topK = scored.slice(0, k);
  // Majority vote by mudra id
  const votes = new Map();
  for (const t of topK) votes.set(t.e.id, (votes.get(t.e.id) || 0) + 1);
  let bestId = null, bestVotes = 0;
  for (const [id, v] of votes) if (v > bestVotes) { bestId = id; bestVotes = v; }
  const winner = topK.find(t => t.e.id === bestId);
  const conf = Math.max(0, Math.min(1, 1 - winner.d / KNN.MAX_DIST));
  return {
    id: bestId,
    displayName: winner.e.displayName,
    builtinUpgrade: winner.e.builtinUpgrade,
    is3D: winner.e.is3D,
    score: conf,
    nearestDist: winner.d,
    angleLabel: winner.e.angleLabel,
  };
}
