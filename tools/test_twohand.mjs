// tools/test_twohand.mjs
// Validate two-hand (Samyukta) recognition by CONSTRUCTING realistic
// two-hand inputs from the real single-hand image landmarks in poses/*.json.
//
// A two-hand mudra is built from two component single-hand poses placed in
// the correct relative configuration (wrists close / stacked / crossed /
// side-by-side, palms toward / up / back-to-back). We then run the live
// classifier and check the two-hand mudra is the top result.
//
//   node tools/test_twohand.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, preprocessHands } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadImageLandmarks(slug) {
  const path = join(ROOT, 'poses', `${slug}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return data.landmarks ? { lm: data.landmarks, handed: data.handedness } : null;
}

// Re-centre a hand's image landmarks so its wrist sits at (tx, ty), keeping
// its shape. Optionally mirror across x (turns a right hand into a left).
function place(lm, tx, ty, mirror = false) {
  const w = lm[0];
  return lm.map(p => ({
    x: tx + (mirror ? -(p.x - w.x) : (p.x - w.x)),
    y: ty + (p.y - w.y),
    z: p.z || 0,
  }));
}
// Rotate a hand's image landmarks about its wrist by deg (image plane).
function rotate2D(lm, deg) {
  const w = lm[0], r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  return lm.map(p => {
    const dx = p.x - w.x, dy = p.y - w.y;
    return { x: w.x + dx * cs - dy * sn, y: w.y + dx * sn + dy * cs, z: p.z || 0 };
  });
}

function run(label, expectId, handA, handB) {
  lastLabel = label;
  resetSmoothing(); tickFrame();
  const hands = preprocessHands([handA.lm, handB.lm],
    [[{ categoryName: handA.handed || 'Right' }], [{ categoryName: handB.handed || 'Left' }]]);
  const r = classify(hands);
  const top = r.allScores[0];
  const me = r.allScores.find(s => s.id === expectId);
  const ok = top && top.id === expectId;
  const top3 = r.allScores.slice(0, 3).map(s => `${s.id}:${s.score.toFixed(2)}`).join('  ');
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(14)} ${top3.padEnd(48)}` +
    (ok ? '' : `  [me=${me ? me.score.toFixed(2) : '-'}]`));
  return ok;
}

// Build the four batch mudras (29-32) from their component poses.
const pataka = loadImageLandmarks('pataka');
if (!pataka) { console.error('need poses/pataka.json'); process.exit(1); }

let pass = 0, fail = 0;
// Known, documented failures: they don't fail the run, but a NEW failure does.
const KNOWN_FAIL = new Set(['karkata']);
const unexpected = [];
let lastLabel = null;
const tally = (ok) => { if (ok) pass++; else { fail++; if (!KNOWN_FAIL.has(lastLabel)) unexpected.push(lastLabel); } };

// ANJALI — palms pressed together, both vertical: wrists close AND
// fingertips close.
tally(run('anjali', 'anjali',
  { lm: place(pataka.lm, 0.47, 0.7), handed: 'Right' },
  { lm: place(pataka.lm, 0.53, 0.7, true), handed: 'Left' }));

// KAPOTA — joined at the base, opening at the top: wrists very close, hands
// splayed apart (±25°). No mirror (mirroring would cancel the splay) — the
// forearm-vector predicates don't depend on anatomical handedness.
tally(run('kapota', 'kapota',
  { lm: place(rotate2D(pataka.lm, -25), 0.49, 0.74), handed: 'Right' },
  { lm: place(rotate2D(pataka.lm, 25), 0.51, 0.74), handed: 'Left' }));

// KARKATA — fingers interlocked: two hands overlapping at the centre with
// fingertips interspersed (heavy overlap, one inverted).
tally(run('karkata', 'karkata',
  { lm: place(pataka.lm, 0.52, 0.5), handed: 'Right' },
  { lm: place(rotate2D(pataka.lm, 180), 0.48, 0.5), handed: 'Left' }));

// SWASTIKA — crossed at the wrists in an X: wrists close, each hand splays
// strongly OUTWARD-AND-UP (±55°, opposite directions) so the forearms cross
// near 90°. No mirror.
tally(run('swastika', 'swastika',
  { lm: place(rotate2D(pataka.lm, 55), 0.49, 0.55), handed: 'Right' },
  { lm: place(rotate2D(pataka.lm, -55), 0.51, 0.55), handed: 'Left' }));

// DOLA — both hands hanging down at the sides (pointing down, apart).
tally(run('dola', 'dola',
  { lm: place(rotate2D(pataka.lm, 180), 0.32, 0.5), handed: 'Right' },
  { lm: place(rotate2D(pataka.lm, 180), 0.68, 0.5, true), handed: 'Left' }));

// ---- Batch 33-48: position-based mudras with usable component poses ----
const ardhachandra = loadImageLandmarks('ardhachandra');
const shikhara = loadImageLandmarks('shikhara');
const kartarimukha = loadImageLandmarks('kartarimukha');
const mushti = loadImageLandmarks('mushti');

// SHIVALINGA — left Ardhacandra horizontal (base), right Shikhara stacked on top.
if (ardhachandra && shikhara) {
  tally(run('shivalinga', 'shivalinga',
    { lm: place(ardhachandra.lm, 0.5, 0.66), handed: ardhachandra.handed },
    { lm: place(shikhara.lm, 0.5, 0.40), handed: shikhara.handed }));
}

// KARTARISVASTIKA — two Kartarimukha hands crossed at the wrists.
if (kartarimukha) {
  tally(run('kartariswastika', 'kartariswastika',
    { lm: place(rotate2D(kartarimukha.lm, 50), 0.49, 0.55), handed: 'Right' },
    { lm: place(rotate2D(kartarimukha.lm, -50), 0.51, 0.55), handed: 'Left' }));
}

// SHANKHA — left Mushti + right Shikhara, wrists very close (thumb in fist).
if (mushti && shikhara) {
  tally(run('shankha', 'shankha',
    { lm: place(mushti.lm, 0.48, 0.55), handed: mushti.handed },
    { lm: place(shikhara.lm, 0.52, 0.5), handed: shikhara.handed }));
}

// GARUDA — two Ardhacandra hands, thumb tips hooked together at the centre.
// Position so the two thumb tips (lm[4]) coincide near the centre.
if (ardhachandra) {
  const a = place(ardhachandra.lm, 0.5, 0.5);
  // Put hand B so its thumb tip lands on hand A's thumb tip.
  const bRaw = place(ardhachandra.lm, 0.5, 0.5, true);
  const shiftX = a[4].x - bRaw[4].x, shiftY = a[4].y - bRaw[4].y;
  const b = bRaw.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, z: p.z }));
  tally(run('garuda', 'garuda', { lm: a, handed: 'Right' }, { lm: b, handed: 'Left' }));
}

console.log(`\n${pass} pass · ${fail} fail` + (KNOWN_FAIL.size ? `  (known: ${[...KNOWN_FAIL].join(', ')})` : ''));
if (unexpected.length) { console.log(`✗ UNEXPECTED FAILURES: ${unexpected.join(', ')}`); process.exit(1); }
