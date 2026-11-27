// tools/test_recognition.mjs
// Deterministic single-hand recognition test using the REAL landmarks
// extracted from the reference photos (poses/*.json).
//
//   node tools/test_recognition.mjs [id1 id2 ...]   # default: every single-hand fixture
//   node tools/test_recognition.mjs --json           # machine-readable result
//   node tools/test_recognition.mjs --update-baseline
//
// Metrics (per fixture, canonical view):
//   top1  – expected mudra has the highest score
//   top3  – expected mudra is in the top 3 distinct mudras
//   lock  – the app would lock it. app.js counts a frame toward its 6-of-8
//           consensus when top score >= CANDIDATE_FLOOR (0.62) and the margin over
//           the runner-up is >= CLASSIFY.margin/2; a steady hold therefore locks.
//   strict – classify().lock: score >= singleThreshold (0.65) and margin >= 0.07
// Plus yaw/pitch robustness: the same landmarks rotated in 3D (all features
// are 3D, so this is a sanity check of rotation invariance).
//
// Fixtures listed in tools/fixture_quality.json are quarantined: the stored
// landmarks do not fit the photo (verified by overlay), so they say nothing
// about the classifier. They are reported but excluded from the score.
//
// tools/baseline.json is a ratchet: every id listed there must keep passing
// top1, otherwise the process exits 1 (used by `npm test`).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, preprocessHands, CLASSIFY, setModels } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';
import { MUDRA_BY_ID } from '../mudras.js';
import { landmarksFor } from './_space.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const JSON_OUT = flags.has('--json');
const UPDATE_BASELINE = flags.has('--update-baseline');
const explicitIds = args.filter(a => !a.startsWith('--'));
// Live app = rules + learned models (models/*.json). --rules-only for the old engine.
if (!flags.has('--rules-only')) {
  const load = (n) => { const p = join(ROOT, 'models', n); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
  setModels({ single: load('single.json'), two: load('two.json') });
}
const mb = args.find(a => a.startsWith('--minblend='));
if (mb) CLASSIFY.minBlend = parseFloat(mb.split('=')[1]);
// --space=live    (default) the live app's path: image landmarks + webcam aspect
//                 for position, worldLandmarks for finger shape
// --space=image   image landmarks only (useWorldLandmarks=false fallback)
// --space=world   metric worldLandmarks (what the Learn viewer uses)
// --space=image   image-normalised landmarks exactly as the live app feeds them,
//                 BUT the photo's own aspect ratio is not the webcam's; use
//                 --aspect=1.78 to emulate a 16:9 webcam frame (x/z stretched
//                 relative to y, as in the app today).
// --space=pixel   image landmarks converted to isotropic pixel space
//                 (x*W, y*H, z*W) — the aspect-corrected form.
const SPACE = (args.find(a => a.startsWith('--space=')) || '--space=live').split('=')[1];
const ASPECT = parseFloat((args.find(a => a.startsWith('--aspect=')) || '--aspect=1.78').split('=')[1]);

const readJson = (p, dflt) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : dflt;
const quarantine = readJson(join(ROOT, 'tools', 'fixture_quality.json'), {});
const baselinePath = join(ROOT, 'tools', 'baseline.json');
const baseline = readJson(baselinePath, []);

const poseIds = readJson(join(ROOT, 'poses', '_index.json'), [])
  .map(x => (typeof x === 'string' ? x : x.id || x.slug));
const ids = explicitIds.length ? explicitIds : poseIds;

// Rotate a point list by yaw (Y axis) then pitch (X axis), in degrees.
function rotate(pts, yawDeg, pitchDeg) {
  const yaw = yawDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  return pts.map(p => {
    const x = p.x, y = p.y, z = p.z || 0;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { x: x1, y: y2, z: z2 };
  });
}

const ANGLES = [
  ['front', 0, 0], ['L25', -25, 0], ['R25', 25, 0],
  ['L40', -40, 0], ['R40', 40, 0], ['down25', 0, 25], ['up25', 0, -25],
];

// In 'image' space the live app passes the webcam aspect so preprocessHands
// can undo the x/y normalisation skew; --legacy reproduces the old behaviour.
function run(lm, handedness, aspect, world) {
  resetSmoothing();
  tickFrame();
  return classify(preprocessHands([lm], [[{ categoryName: handedness || 'Right' }]],
    flags.has('--legacy') ? 1 : aspect, world ? [world] : null));
}

// Distinct-mudra ranking (rule + knn scores can repeat an id).
function distinctRank(allScores) {
  const seen = new Set(), out = [];
  for (const s of allScores) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
  return out;
}

// Mirrors app.js CANDIDATE_FLOOR.
const CANDIDATE_FLOOR = 0.62;
const rows = [];
const skipped = [];

for (const id of ids) {
  const m = MUDRA_BY_ID[id];
  const path = join(ROOT, 'poses', `${id}.json`);
  if (!existsSync(path)) { skipped.push([id, 'no pose file']); continue; }
  if (!m || m.hands !== 1 || !m.recognize) { skipped.push([id, 'not a recognizable single-hand mudra']); continue; }

  const pose = JSON.parse(readFileSync(path, 'utf8'));
  const { lm: base, aspect, world } = landmarksFor(pose, id, SPACE, ASPECT);
  const r0 = run(base, pose.handedness, aspect, world);
  const ranked = distinctRank(r0.allScores);
  const rank = ranked.findIndex(s => s.id === id) + 1;
  const me = ranked.find(s => s.id === id);

  let angleHits = 0;
  const angleDetail = [];
  for (const [name, yaw, pitch] of ANGLES) {
    const r = (world ? run(base, pose.handedness, aspect, rotate(world, yaw, pitch)) : run(rotate(base, yaw, pitch), pose.handedness, aspect));
    const ok = r.allScores[0] && r.allScores[0].id === id;
    if (ok) angleHits++;
    angleDetail.push(`${name}:${ok ? '✓' : '✗'}`);
  }

  rows.push({
    id, quarantined: quarantine[id] || null,
    top1: rank === 1, top3: rank > 0 && rank <= 3,
    lock: rank === 1 && ranked[0].score >= CANDIDATE_FLOOR &&
          ranked[0].score - (ranked[1]?.score ?? 0) >= CLASSIFY.margin * 0.5,
    strict: !!(r0.lock && r0.lock.id === id),   // classify().lock: singleThreshold + margin
    rank, score: me ? +me.score.toFixed(3) : 0,
    winner: ranked[0].id, winnerScore: +ranked[0].score.toFixed(3),
    angleHits, angleDetail,
    top3Text: ranked.slice(0, 3).map(s => `${s.id}:${s.score.toFixed(2)}`).join(' '),
  });
}

const scored = rows.filter(r => !r.quarantined);
const pct = (n) => scored.length ? `${n}/${scored.length} (${Math.round(100 * n / scored.length)}%)` : '0/0';
const summary = {
  fixtures: scored.length,
  quarantined: rows.length - scored.length,
  top1: scored.filter(r => r.top1).length,
  top3: scored.filter(r => r.top3).length,
  lock: scored.filter(r => r.lock).length,
  strict: scored.filter(r => r.strict).length,
  angleRobust: scored.reduce((s, r) => s + r.angleHits, 0) / Math.max(1, scored.length * ANGLES.length),
  failing: scored.filter(r => !r.top1).map(r => r.id),
  confusions: Object.entries(scored.filter(r => !r.top1).reduce((acc, r) => {
    const k = `${r.id} → ${r.winner}`; acc[k] = r.winnerScore; return acc;
  }, {})),
};

if (UPDATE_BASELINE) {
  writeFileSync(baselinePath, JSON.stringify(scored.filter(r => r.top1).map(r => r.id).sort(), null, 2) + '\n');
  console.log(`baseline updated: ${scored.filter(r => r.top1).length} ids`);
}

const regressions = baseline.filter(id => {
  const r = rows.find(x => x.id === id);
  return r && !r.quarantined && !r.top1;
});

if (JSON_OUT) {
  console.log(JSON.stringify({ summary, rows, skipped, regressions }, null, 2));
} else {
  for (const r of rows) {
    const mark = r.quarantined ? '∅' : r.top1 ? '✓' : '✗';
    const lock = r.lock ? (r.strict ? 'LOCK' : 'lock') : '    ';
    console.log(`${mark} ${r.id.padEnd(13)} ${lock} rank ${String(r.rank || '-').padStart(2)}  ${r.top3Text.padEnd(46)} angles ${r.angleHits}/${ANGLES.length}` +
      (r.quarantined ? `   [quarantined: ${r.quarantined}]` : ''));
  }
  if (skipped.length) console.log('\nskipped: ' + skipped.map(([i, why]) => `${i} (${why})`).join(', '));
  console.log(`\nfixtures ${summary.fixtures} (+${summary.quarantined} quarantined)`);
  console.log(`  top-1 ${pct(summary.top1)}   top-3 ${pct(summary.top3)}   would-lock ${pct(summary.lock)}   strict ${pct(summary.strict)}   angle-robust ${(summary.angleRobust * 100).toFixed(0)}%`);
  if (summary.failing.length) console.log(`  failing: ${summary.confusions.map(([k, v]) => `${k} (${v})`).join(', ')}`);
  if (regressions.length) console.log(`\n✗ REGRESSION vs baseline: ${regressions.join(', ')}`);
}

process.exit(regressions.length ? 1 : 0);
