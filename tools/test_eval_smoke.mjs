// tools/test_eval_smoke.mjs — recorder → eval pipeline smoke test (runs in `npm test`).
// Checks plumbing and invariants only; synthetic data says nothing about accuracy.
import { makeSynthetic } from './synth_dataset.mjs';
import { evaluate } from './eval_dataset.mjs';
import { frameMatches, summarize, snapshotFrame, TAKE } from '../recorder.js';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };

const ds = makeSynthetic({ takes: 4, frames: 12, seed: 7 });
const labels = new Set(ds.samples.map(s => s.label));
check(ds.schema === 1 && ds.samples.length === labels.size * 4 * 12, `dataset shape (${labels.size} mudras × 4 takes × 12 frames)`);
check(ds.samples.every(s => frameMatches(s.hands, 1)), 'every sample passes the recorder hand-count check');
check(!('id' in ds.samples[0]), 'export strips internal ids');

// snapshotFrame must copy, never alias MediaPipe's reused result objects.
const raw = { landmarks: [Array.from({ length: 21 }, (_, i) => ({ x: i, y: i, z: i }))],
  worldLandmarks: [Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))], handednesses: [[{ categoryName: 'Left', score: 0.9 }]] };
const snap = snapshotFrame(raw); raw.landmarks[0][3].x = 999;
check(snap[0].landmarks[3].x === 3 && snap[0].handedness === 'Left', 'snapshotFrame deep-copies');
check(!frameMatches(snapshotFrame({ landmarks: [], worldLandmarks: [] }), 1), 'empty frame is rejected');
check(frameMatches(snapshotFrame(raw), 2) === false, 'wrong hand count is rejected');

const sum = summarize(ds.samples);
check(Object.values(sum).every(v => v.takes === 4 && v.samples === 48 && v.done === (4 >= TAKE.goalTakes)), 'summarize counts takes/samples');

const res = evaluate(ds.samples, { testFrac: 0.3 });
const devTakes = res.dev.takes, testTakes = res.test.takes;
check(testTakes === labels.size * 1 && devTakes === labels.size * 3, `take-based split: 3 dev + 1 test take per mudra (${devTakes}/${testTakes})`);
check(res.test.rows.every(r => r.frames === 12), 'test set holds whole takes (no frame-level leakage)');
check(res.score != null && ['pass', 'fail'].includes(res.verdict), `verdict computed (${(100 * res.score).toFixed(0)}%)`);

const one = evaluate(makeSynthetic({ takes: 1, frames: 12, seed: 7, ids: ['pataka'] }).samples);
check(one.unsplittable.includes('pataka') && one.test.mudras === 0, 'single-take mudra is DEV-only');

process.exit(failed ? 1 : 0);
