// tools/test_models.mjs — sanity checks for the shipped learned models (npm test).
// Accuracy itself is measured by tools/train_model.py (models/eval.json).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { predict, SINGLE_DIM, TWO_DIM } from '../features.js';
import { MUDRA_BY_ID } from '../mudras.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };

for (const [name, dim, hands] of [['single', SINGLE_DIM, 1], ['two', TWO_DIM, 2]]) {
  const p = join(ROOT, 'models', `${name}.json`);
  if (!existsSync(p)) { check(false, `models/${name}.json exists`); continue; }
  const m = JSON.parse(readFileSync(p, 'utf8'));
  check(m.mean.length === dim && m.layers[0].W.length === dim, `${name}: input size ${dim} matches features.js`);
  // The single-hand model also knows two-hand mudras as they look when
  // MediaPipe detects only one of the two hands, so only require ids to exist.
  check(m.classes.every(c => MUDRA_BY_ID[c] && (hands === 1 || MUDRA_BY_ID[c].hands === 2)),
        `${name}: all ${m.classes.length} classes are mudras in mudras.js${hands === 2 ? ' (two-hand)' : ''}`);
  const p0 = predict(m, new Array(dim).fill(0));
  check(Math.abs(p0.reduce((a, b) => a + b, 0) - 1) < 1e-6 && p0.every(v => v >= 0), `${name}: predict() returns a probability distribution`);
}
const ev = join(ROOT, 'models', 'eval.json');
if (existsSync(ev)) {
  const e = JSON.parse(readFileSync(ev, 'utf8'));
  console.log(`  held-out accuracy recorded at training: single ${(100 * e.single.top1).toFixed(1)}%, two ${(100 * e.two.top1).toFixed(1)}%`);
  // Guard against a retrain that silently gets worse.
  check(e.single.top1 >= 0.80, 'single-hand held-out top-1 ≥ 80%');
  check(e.two.top1 >= 0.90, 'two-hand held-out top-1 ≥ 90%');
}
process.exit(failed ? 1 : 0);
