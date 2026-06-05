// tools/test_recognition.mjs
// Deterministic recognition test using the REAL landmarks extracted from the
// reference photos (poses/*.json). Because every classifier feature is 3D
// (rotation-invariant), a mudra that classifies correctly on its canonical
// pose will classify correctly from any viewing angle (modulo real-world z
// noise). So we test the canonical pose + a few synthetic yaw/pitch rotations
// as a robustness sanity check.
//
//   node tools/test_recognition.mjs [id1 id2 ...]
//
// With no args, tests the first 16 Asamyukta hastas.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, preprocessHands } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FIRST_16 = [
  'pataka', 'tripataka', 'ardhapataka', 'kartarimukha', 'mayura',
  'ardhachandra', 'arala', 'shukatunda', 'mushti', 'shikhara',
  'kapittha', 'katakamukha', 'suchi', 'chandrakala', 'padmakosha',
  'sarpasirsha',
];

const ids = process.argv.slice(2).length ? process.argv.slice(2) : FIRST_16;

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

function classifyPose(worldLandmarks, handedness) {
  resetSmoothing();
  tickFrame();
  const r = classify(preprocessHands([worldLandmarks], [[{ categoryName: handedness || 'Right' }]]));
  return r;
}

let pass = 0, fail = 0;
const failures = [];

for (const id of ids) {
  const path = join(ROOT, 'poses', `${id}.json`);
  if (!existsSync(path)) {
    console.log(`  ${id.padEnd(14)} — NO POSE FILE (skipped)`);
    continue;
  }
  const pose = JSON.parse(readFileSync(path, 'utf8'));
  const base = pose.worldLandmarks;

  // Canonical
  const r0 = classifyPose(base, pose.handedness);
  const top0 = r0.allScores[0];
  const me0 = r0.allScores.find(s => s.id === id);
  const okCanonical = top0 && top0.id === id;

  // Angle robustness
  let angleHits = 0;
  const angleDetail = [];
  for (const [name, yaw, pitch] of ANGLES) {
    const r = classifyPose(rotate(base, yaw, pitch), pose.handedness);
    const top = r.allScores[0];
    const ok = top && top.id === id;
    if (ok) angleHits++;
    angleDetail.push(`${name}:${ok ? '✓' : '✗' + (top ? top.id.slice(0, 4) : '-')}`);
  }

  const status = okCanonical ? '✓' : '✗';
  if (okCanonical) pass++; else { fail++; failures.push(id); }
  const top3 = r0.allScores.slice(0, 3).map(s => `${s.id}:${s.score.toFixed(2)}`).join(' ');
  console.log(`${status} ${id.padEnd(14)} ${top3.padEnd(46)}  angles ${angleHits}/${ANGLES.length}  ${angleDetail.join(' ')}`);
}

console.log(`\n${pass} pass · ${fail} fail` + (failures.length ? `  →  ${failures.join(', ')}` : ''));
