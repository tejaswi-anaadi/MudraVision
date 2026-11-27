// tools/build_features.mjs
// Turn tools/extract_dataset.py output into training matrices, using the SAME
// features.js the browser runs.
//
//   node tools/build_features.mjs landmarks.jsonl features.json
//
// Rows: one per detected frame, plus a mirrored copy (aug=1) so the models
// don't care which hand the dancer uses. `g` is a cross-validation block:
// each class's frames, in frame order, split into 5 contiguous blocks. Frames
// of one dancer are contiguous, so a block is (mostly) unseen dancers.

import { readFileSync, writeFileSync } from 'node:fs';
import { singleHandFeatures, twoHandFeatures, mirrorHand, orderHands } from '../features.js';
import { MUDRA_BY_ID } from '../mudras.js';

const [, , inPath, outPath] = process.argv;
const BLOCKS = 5;

const recs = readFileSync(inPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const toHand = (h, w, hh) => {
  const k = w / hh;   // isotropic image coordinates, like preprocessHands(aspect)
  return {
    world: h.world.map(([x, y, z]) => ({ x, y, z })),
    pos: h.landmarks.map(([x, y, z]) => ({ x: x * k, y, z: z * k })),
    score: h.score,
  };
};

// Block index per (folder, frame): rank within the folder's frames.
const byFolder = new Map();
for (const r of recs) {
  if (!byFolder.has(r.folder)) byFolder.set(r.folder, []);
  byFolder.get(r.folder).push(r.frame);
}
const blockOf = new Map();
for (const [folder, frames] of byFolder) {
  frames.sort((a, b) => a - b);
  frames.forEach((f, i) => blockOf.set(`${folder}:${f}`, Math.floor(i * BLOCKS / frames.length)));
}

const single = { X: [], y: [], g: [], aug: [], frame: [] };
const two = { X: [], y: [], g: [], aug: [], frame: [] };
const skipped = { noHand: 0, needTwo: 0, seenAsOne: 0 };

for (const r of recs) {
  const m = MUDRA_BY_ID[r.id];
  if (!m) continue;
  const g = blockOf.get(`${r.folder}:${r.frame}`);
  const key = `${r.folder}:${r.frame}`;
  const hands = r.hands.map(h => toHand(h, r.w, r.h));
  if (m.hands === 1) {
    if (!hands.length) { skipped.noHand++; continue; }
    const h = hands.reduce((best, x) => (x.score > best.score ? x : best));
    for (const [aug, hh] of [[0, h], [1, mirrorHand(h)]]) {
      single.X.push(singleHandFeatures(hh.world)); single.y.push(r.id);
      single.g.push(g); single.aug.push(aug); single.frame.push(key);
    }
  } else {
    if (hands.length === 1) {
      // MediaPipe often finds only ONE hand when two hands overlap or interlock
      // (it happens live too). Teach the single-hand model what this two-hand
      // mudra looks like when seen that way, so it can still be recognised.
      const h = hands[0];
      for (const [aug, hh] of [[0, h], [1, mirrorHand(h)]]) {
        single.X.push(singleHandFeatures(hh.world)); single.y.push(r.id);
        single.g.push(g); single.aug.push(aug); single.frame.push(key);
      }
      skipped.seenAsOne++;
      continue;
    }
    if (hands.length < 2) { skipped.needTwo++; continue; }
    const [a, b] = orderHands(hands[0], hands[1]);
    const [ma, mb] = orderHands(mirrorHand(hands[0]), mirrorHand(hands[1]));
    for (const [aug, A, B] of [[0, a, b], [1, ma, mb]]) {
      two.X.push(twoHandFeatures(A, B)); two.y.push(r.id);
      two.g.push(g); two.aug.push(aug); two.frame.push(key);
    }
  }
}

const round = (M) => M.map(row => row.map(v => Math.round(v * 1e5) / 1e5));
single.X = round(single.X); two.X = round(two.X);
writeFileSync(outPath, JSON.stringify({ single, two }));
const count = (d) => d.y.filter((_, i) => !d.aug[i]).length;
console.log(`single-hand frames ${count(single)} (${new Set(single.y).size} classes); ` +
            `two-hand frames ${count(two)} (${new Set(two.y).size} classes); skipped ${JSON.stringify(skipped)}`);
