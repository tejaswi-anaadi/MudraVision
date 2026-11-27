// tools/build_refs.mjs
// Pick, for every dataset mudra, its most TYPICAL real frame (the medoid: the
// frame whose features are closest to the class average) and save its 3D
// hand(s) as the reference pose the 3D view shows: poses/ref/<id>.json.
//
//   node tools/build_refs.mjs landmarks.jsonl
//
// Two-hand mudras keep both hands, with hand B placed relative to hand A using
// the image positions (converted to metres via palm length).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { singleHandFeatures, twoHandFeatures, orderHands } from '../features.js';
import { MUDRA_BY_ID } from '../mudras.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poses', 'ref');
mkdirSync(OUT, { recursive: true });

const recs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => JSON.parse(l));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const toHand = (h, w, hh) => ({
  handedness: h.handedness, score: h.score,
  world: h.world.map(([x, y, z]) => ({ x, y, z })),
  pos: h.landmarks.map(([x, y, z]) => ({ x: x * w / hh, y, z: z * w / hh })),
});
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const byClass = new Map();
for (const r of recs) {
  const m = MUDRA_BY_ID[r.id];
  if (!m) continue;
  const hands = r.hands.map(h => toHand(h, r.w, r.h));
  let item;
  if (m.hands === 1) {
    if (!hands.length) continue;
    const h = hands.reduce((a, b) => (b.score > a.score ? b : a));
    item = { f: singleHandFeatures(h.world), hands: [h] };
  } else {
    if (hands.length < 2) continue;
    const [a, b] = orderHands(hands[0], hands[1]);
    item = { f: twoHandFeatures(a, b), hands: [a, b] };
  }
  if (!byClass.has(r.id)) byClass.set(r.id, []);
  byClass.get(r.id).push({ ...item, frame: `${r.folder}/${r.frame}` });
}

const index = [];
for (const [id, items] of byClass) {
  const D = items[0].f.length;
  const mean = new Array(D).fill(0);
  for (const it of items) for (let i = 0; i < D; i++) mean[i] += it.f[i] / items.length;
  const sd = new Array(D).fill(0);
  for (const it of items) for (let i = 0; i < D; i++) sd[i] += (it.f[i] - mean[i]) ** 2 / items.length;
  const dist = (f) => f.reduce((s, v, i) => s + ((v - mean[i]) ** 2) / (sd[i] + 1e-6), 0);
  const best = items.reduce((a, b) => (dist(b.f) < dist(a.f) ? b : a));

  const handsOut = best.hands.map(h => ({ handedness: h.handedness, world: h.world.map(p => ({ x: r6(p.x), y: r6(p.y), z: r6(p.z) })) }));
  if (best.hands.length === 2) {
    // Offset of hand B's wrist from hand A's, in metres (image → world via palm length).
    const [a, b] = best.hands;
    const palmImg = (len(a.pos[0], a.pos[9]) + len(b.pos[0], b.pos[9])) / 2;
    const palmW = (len(a.world[0], a.world[9]) + len(b.world[0], b.world[9])) / 2;
    const k = palmW / palmImg;
    const dx = (b.pos[0].x - a.pos[0].x) * k, dy = (b.pos[0].y - a.pos[0].y) * k;
    // world coords are hand-centred: place each hand's wrist explicitly.
    handsOut[0].wrist = { x: 0, y: 0, z: 0 };
    handsOut[1].wrist = { x: r6(dx), y: r6(dy), z: 0 };
  }
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify({ id, source: best.frame, frames: items.length, hands: handsOut }));
  index.push(id);
}
index.sort();
writeFileSync(join(OUT, '_index.json'), JSON.stringify(index));
console.log(`wrote ${index.length} reference poses to poses/ref/`);
