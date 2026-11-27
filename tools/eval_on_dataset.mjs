// tools/eval_on_dataset.mjs
// Run the LIVE classifier (classifier.js classify()) over dataset frames
// extracted by tools/extract_dataset.py, and report accuracy per hand count.
//
//   node tools/eval_on_dataset.mjs landmarks.jsonl [--rules-only] [--blocks=0,1]
//
// --rules-only   disable the learned models (the old rule engine alone)
// --blocks=…     only score frames in these cross-validation blocks (to keep
//                a fair comparison with held-out model results)

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, preprocessHands, setModels } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';
import { MUDRA_BY_ID } from '../mudras.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const rulesOnly = args.includes('--rules-only');

if (!rulesOnly) {
  const load = (n) => existsSync(join(ROOT, 'models', n)) ? JSON.parse(readFileSync(join(ROOT, 'models', n), 'utf8')) : null;
  setModels({ single: load('single.json'), two: load('two.json') });
} else {
  setModels({ single: null, two: null });
}

const recs = readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const stats = { 1: { n: 0, ok: 0, lock: 0, miss: 0 }, 2: { n: 0, ok: 0, lock: 0, miss: 0 } };
const perClass = {};
const confusions = {};

for (const r of recs) {
  const m = MUDRA_BY_ID[r.id];
  if (!m) continue;
  const need = m.hands;
  let hands = r.hands;
  if (need === 1) {
    if (!hands.length) continue;
    hands = [hands.reduce((a, b) => (b.score > a.score ? b : a))];
  } else if (hands.length < 2) continue;
  const aspect = r.w / r.h;
  resetSmoothing(); tickFrame();
  const H = preprocessHands(
    hands.map(h => h.landmarks.map(([x, y, z]) => ({ x, y, z }))),
    hands.map(h => [{ categoryName: h.handedness }]),
    aspect,
    hands.map(h => h.world.map(([x, y, z]) => ({ x, y, z }))));
  const res = classify(H);
  const top = res.allScores[0]?.id;
  const s = stats[need];
  s.n++;
  const ok = top === r.id;
  if (ok) s.ok++; else confusions[`${r.id}→${top}`] = (confusions[`${r.id}→${top}`] || 0) + 1;
  const pc = (perClass[r.id] ||= [0, 0]); pc[1]++; if (ok) pc[0]++;
}

const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '–';
console.log(`${rulesOnly ? 'RULES ONLY' : 'RULES + LEARNED MODELS'} on ${recs.length} dataset frames`);
for (const k of [1, 2]) console.log(`  ${k}-hand: top-1 ${pct(stats[k].ok, stats[k].n)} of ${stats[k].n} frames`);
const macro = Object.values(perClass).map(([a, b]) => a / b);
console.log(`  macro top-1 over ${macro.length} mudras: ${(100 * macro.reduce((x, y) => x + y, 0) / macro.length).toFixed(1)}%`);
const worst = Object.entries(perClass).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).slice(0, 8);
console.log('  weakest: ' + worst.map(([k, [a, b]]) => `${k} ${pct(a, b)}`).join(', '));
console.log('  top confusions: ' + Object.entries(confusions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ×${v}`).join(', '));
