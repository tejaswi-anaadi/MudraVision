// tools/eval_dataset.mjs
// Measure recognition accuracy on REAL recorded hands (see recorder.js).
//
//   node tools/eval_dataset.mjs dataset.json [more.json ...]
//     --test-frac=0.3     share of each mudra's takes held out as the TEST set
//     --split=all         no split: report everything as one set
//     --target=0.95       accuracy bar for the verdict (default 0.95)
//     --gate              exit 1 if the TEST set misses the bar (for CI)
//     --json              machine-readable output
//
// Methodology
// - Samples are replayed through the live pipeline: image landmarks + aspect
//   for position, worldLandmarks for finger shape (preprocessHands/classify).
// - The split is BY TAKE. Frames of one take are near-duplicates, so a
//   frame-level split would leak. Per mudra the most recent takes are held out
//   as TEST; tune rules on DEV only, then report TEST. A mudra with a single
//   take can't be split and counts as DEV only.
// - "lock" mirrors app.js: a frame is a candidate when top score >= 0.62 and
//   margin >= margin/2; the app locks when 6 of the last 8 frames agree.
//   That take-level outcome (correct / wrong / no lock) is what a user sees.
// - Headline numbers are MACRO averages over mudras, so a mudra with many
//   takes cannot hide a mudra with few.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { classify, preprocessHands, CLASSIFY } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';
import { MUDRA_BY_ID } from '../mudras.js';

// Mirrors app.js.
const BUFFER_SIZE = 8, LOCK_FRAMES_NEEDED = 6, CANDIDATE_FLOOR = 0.62;

function runFrame(sample) {
  const H = sample.hands;
  const hands = preprocessHands(
    H.map(h => h.landmarks),
    H.map(h => [{ categoryName: h.handedness || 'Right' }]),
    sample.aspect || 1,
    H.map(h => h.worldLandmarks));
  return classify(hands);
}

function distinct(allScores) {
  const seen = new Set(), out = [];
  for (const s of allScores) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
  return out;
}

// One take = the frames of (label, take) in capture order. Returns the
// frame-level hits and the take-level lock outcome.
function evalTake(label, frames) {
  // Frame level: every frame on its own (no cross-frame smoothing).
  let top1 = 0, top3 = 0;
  const wrong = {};
  for (const f of frames) {
    resetSmoothing(); tickFrame();
    const ranked = distinct(runFrame(f).allScores);
    const rank = ranked.findIndex(s => s.id === label) + 1;
    if (rank === 1) top1++; else if (ranked[0]) wrong[ranked[0].id] = (wrong[ranked[0].id] || 0) + 1;
    if (rank > 0 && rank <= 3) top3++;
  }
  // Take level: replay the app's consensus buffer with smoothing across frames.
  resetSmoothing();
  const buffer = [];
  let locked = null;
  for (const f of frames) {
    tickFrame();
    const r = runFrame(f);
    const second = r.allScores.find(s => s.id !== r.top?.id);
    const ok = r.top && r.top.score >= CANDIDATE_FLOOR &&
               r.top.score - (second?.score || 0) >= CLASSIFY.margin * 0.5;
    buffer.push(ok ? `${r.top.source || 'rule'}:${r.top.id}` : null);
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    if (!locked && buffer.length === BUFFER_SIZE) {
      const counts = new Map();
      for (const k of buffer) if (k) counts.set(k, (counts.get(k) || 0) + 1);
      for (const [k, c] of counts) if (c >= LOCK_FRAMES_NEEDED) { locked = k.split(/:(.+)/)[1]; break; }
    }
  }
  const outcome = locked === null ? 'none' : locked === label ? 'correct' : 'wrong';
  return { top1, top3, n: frames.length, outcome, lockedAs: locked, wrong };
}

export function evaluate(samples, { testFrac = 0.3, split = 'take', target = 0.95 } = {}) {
  const warnings = [];
  const byLabel = new Map();
  for (const s of samples) {
    const m = MUDRA_BY_ID[s.label];
    if (!m) { warnings.push(`unknown label "${s.label}" skipped`); continue; }
    if (!s.hands || s.hands.length !== m.hands) { warnings.push(`${s.label}: sample with ${s.hands?.length} hands, mudra needs ${m.hands} — skipped`); continue; }
    if (!byLabel.has(s.label)) byLabel.set(s.label, new Map());
    const takes = byLabel.get(s.label);
    if (!takes.has(s.take)) takes.set(s.take, []);
    takes.get(s.take).push(s);
  }

  const perLabel = {};
  const unsplittable = [];
  for (const [label, takes] of byLabel) {
    const ids = [...takes.keys()].sort((a, b) => a - b);
    let testIds = new Set();
    if (split === 'take') {
      if (ids.length >= 2) testIds = new Set(ids.slice(-Math.max(1, Math.round(ids.length * testFrac))));
      else unsplittable.push(label);
    }
    const sets = { dev: [], test: [] };
    for (const id of ids) {
      const frames = takes.get(id).sort((a, b) => a.frame - b.frame);
      const r = evalTake(label, frames);
      r.take = id;
      sets[testIds.has(id) ? 'test' : 'dev'].push(r);
    }
    perLabel[label] = sets;
  }

  const agg = (setName) => {
    const rows = [];
    for (const [label, sets] of Object.entries(perLabel)) {
      const t = sets[setName];
      if (!t.length) continue;
      const frames = t.reduce((a, x) => a + x.n, 0);
      const wrong = {};
      for (const x of t) for (const [k, v] of Object.entries(x.wrong)) wrong[k] = (wrong[k] || 0) + v;
      const lockedWrong = {};
      for (const x of t) if (x.outcome === 'wrong') lockedWrong[x.lockedAs] = (lockedWrong[x.lockedAs] || 0) + 1;
      rows.push({
        label, takes: t.length, frames,
        top1: t.reduce((a, x) => a + x.top1, 0) / frames,
        top3: t.reduce((a, x) => a + x.top3, 0) / frames,
        lockCorrect: t.filter(x => x.outcome === 'correct').length / t.length,
        lockWrong: t.filter(x => x.outcome === 'wrong').length / t.length,
        lockNone: t.filter(x => x.outcome === 'none').length / t.length,
        confusedWith: Object.entries(wrong).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k),
        lockedWrongAs: Object.keys(lockedWrong),
      });
    }
    const mean = (k) => rows.length ? rows.reduce((a, r) => a + r[k], 0) / rows.length : null;
    return {
      mudras: rows.length, takes: rows.reduce((a, r) => a + r.takes, 0), frames: rows.reduce((a, r) => a + r.frames, 0),
      macro: { top1: mean('top1'), top3: mean('top3'), lockCorrect: mean('lockCorrect'), lockWrong: mean('lockWrong'), lockNone: mean('lockNone') },
      rows: rows.sort((a, b) => a.lockCorrect - b.lockCorrect || a.top1 - b.top1),
    };
  };

  const dev = agg('dev'), test = agg('test');
  const primary = split === 'take' ? test : dev;
  const score = primary.macro.lockCorrect;
  return { dev, test, unsplittable, warnings, target,
           verdict: score == null ? 'no-data' : score >= target ? 'pass' : 'fail',
           score, evaluatedOn: split === 'take' ? 'test' : 'all' };
}

// ------------------------------------------------------------------
const pct = (x) => x == null ? '  – ' : `${(100 * x).toFixed(0)}%`.padStart(4);

function printSet(name, a) {
  if (!a.mudras) { console.log(`\n${name}: no data`); return; }
  console.log(`\n${name}: ${a.mudras} mudras · ${a.takes} takes · ${a.frames} frames`);
  console.log(`  macro  lock-correct ${pct(a.macro.lockCorrect)}   lock-wrong ${pct(a.macro.lockWrong)}   no-lock ${pct(a.macro.lockNone)}   frame top-1 ${pct(a.macro.top1)}   top-3 ${pct(a.macro.top3)}`);
  console.log('  weakest first:');
  console.log('    mudra            takes  lock✓  lock✗  none  top-1  confused with');
  for (const r of a.rows.slice(0, 15)) {
    console.log(`    ${r.label.padEnd(16)} ${String(r.takes).padStart(4)}  ${pct(r.lockCorrect)}   ${pct(r.lockWrong)}  ${pct(r.lockNone)}  ${pct(r.top1)}   ${[...new Set([...r.lockedWrongAs, ...r.confusedWith])].join(', ')}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const files = args.filter(a => !a.startsWith('--'));
  const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
  if (!files.length) { console.error('usage: node tools/eval_dataset.mjs dataset.json [...] [--test-frac=0.3] [--split=all] [--target=0.95] [--gate] [--json]'); process.exit(2); }

  const samples = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    if (d.schema !== 1) { console.error(`${f}: unsupported schema ${d.schema}`); process.exit(2); }
    // Takes are numbered per browser; offset them so files never collide.
    const off = samples.reduce((m, s) => Math.max(m, s.take), 0);
    for (const s of d.samples) samples.push({ ...s, take: s.take + off });
  }
  const res = evaluate(samples, {
    testFrac: parseFloat(opt('test-frac', '0.3')),
    split: opt('split', 'take'),
    target: parseFloat(opt('target', '0.95')),
  });

  if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else {
    for (const w of [...new Set(res.warnings)]) console.log(`! ${w}`);
    printSet('DEV  (tune rules on this)', res.dev);
    if (res.evaluatedOn === 'test') printSet('TEST (report this; do not tune on it)', res.test);
    if (res.unsplittable.length) console.log(`\n! only one take, DEV only: ${res.unsplittable.join(', ')}`);
    const label = res.verdict === 'pass' ? 'PASS' : res.verdict === 'fail' ? 'FAIL' : 'NO DATA';
    console.log(`\n${label}: ${res.evaluatedOn} macro lock-correct ${pct(res.score)} vs target ${pct(res.target)}`);
  }
  if (args.includes('--gate') && res.verdict !== 'pass') process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
