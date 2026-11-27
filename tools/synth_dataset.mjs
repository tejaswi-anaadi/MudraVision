// tools/synth_dataset.mjs
// Generate a SYNTHETIC dataset in the recorder's export format from the
// reference-photo fixtures, with per-take rotation and per-frame jitter.
//
//   node tools/synth_dataset.mjs out.json [--takes=4] [--frames=12] [--seed=1]
//
// This exists to smoke-test the recorder -> eval pipeline end to end. It is
// NOT accuracy evidence: it is derived from the same fixtures the rules were
// tuned on. Only recordings made with the real camera measure real accuracy.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MUDRA_BY_ID } from '../mudras.js';
import { buildDatasetJSON, snapshotFrame } from '../recorder.js';
import { landmarksFor, ROOT, WEBCAM_ASPECT } from './_space.mjs';

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gauss = (rnd) => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

function rotate(pts, yawDeg, pitchDeg) {
  const yaw = yawDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  return pts.map(p => {
    const x1 = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
    const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
    return { x: x1, y: p.y * Math.cos(pitch) - z1 * Math.sin(pitch), z: p.y * Math.sin(pitch) + z1 * Math.cos(pitch) };
  });
}
const jitter = (pts, sigma, rnd) => pts.map(p => ({ x: p.x + gauss(rnd) * sigma, y: p.y + gauss(rnd) * sigma, z: p.z + gauss(rnd) * sigma }));

export function makeSynthetic({ takes = 4, frames = 12, seed = 1, ids = null } = {}) {
  const rnd = mulberry32(seed);
  const index = JSON.parse(readFileSync(join(ROOT, 'poses', '_index.json'), 'utf8'));
  const quarantine = existsSync(join(ROOT, 'tools/fixture_quality.json'))
    ? JSON.parse(readFileSync(join(ROOT, 'tools/fixture_quality.json'), 'utf8')) : {};
  const labels = (ids || index).filter(id => MUDRA_BY_ID[id]?.hands === 1 && MUDRA_BY_ID[id].recognize && !quarantine[id]);
  const samples = [];
  let take = 0;
  for (const id of labels) {
    const pose = JSON.parse(readFileSync(join(ROOT, 'poses', `${id}.json`), 'utf8'));
    const { lm } = landmarksFor(pose, id, 'image');
    for (let t = 0; t < takes; t++) {
      take++;
      const yaw = (rnd() - 0.5) * 40, pitch = (rnd() - 0.5) * 30;
      const world = rotate(pose.worldLandmarks, yaw, pitch);
      for (let f = 0; f < frames; f++) {
        // Shape exactly as MediaPipe returns it: arrays + handedness categories.
        const results = {
          landmarks: [jitter(lm, 0.004, rnd)],
          worldLandmarks: [jitter(world, 0.0015, rnd)],
          handednesses: [[{ categoryName: pose.handedness || 'Right', score: 0.95 }]],
        };
        samples.push({
          label: id, nHands: 1, take, frame: f, session: 'synthetic', ts: 0,
          aspect: WEBCAM_ASPECT, video: { w: 1280, h: 720 }, hands: snapshotFrame(results),
        });
      }
    }
  }
  return buildDatasetJSON(samples);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const out = args.find(a => !a.startsWith('--'));
  const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };
  if (!out) { console.error('usage: node tools/synth_dataset.mjs out.json [--takes=4] [--frames=12] [--seed=1]'); process.exit(2); }
  const d = makeSynthetic({ takes: opt('takes', 4), frames: opt('frames', 12), seed: opt('seed', 1) });
  writeFileSync(out, JSON.stringify(d));
  console.log(`wrote ${d.samples.length} synthetic samples to ${out}`);
}
