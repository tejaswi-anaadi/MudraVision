// tools/diagnose.mjs
// Explain WHY a reference pose classifies the way it does.
//
//   node tools/diagnose.mjs <mudraId> [<mudraId> ...]
//
// For each id: measured finger-curl scores from the pose's landmarks, then
// per-constraint scores for the expected mudra and for the top-scoring winner.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, preprocessHands, explain } from '../classifier.js';
import { resetSmoothing, tickFrame } from '../landmarks.js';
import { MUDRA_BY_ID } from '../mudras.js';
import { landmarksFor } from './_space.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const f2 = (n) => (typeof n === 'number' ? n.toFixed(2) : String(n));

for (const id of process.argv.slice(2)) {
  const pose = JSON.parse(readFileSync(join(ROOT, 'poses', `${id}.json`), 'utf8'));
  resetSmoothing(); tickFrame();
  const { lm, aspect, world } = landmarksFor(pose, id, process.env.SPACE || 'live');
  const hands = preprocessHands([lm], [[{ categoryName: pose.handedness || 'Right' }]], aspect, world ? [world] : null);
  const h = hands[0];
  const r = classify(hands);
  const win = r.allScores[0];
  const me = r.allScores.find(s => s.id === id);

  console.log(`\n=== ${id}  (winner: ${win.id} ${f2(win.score)} | expected: ${f2(me?.score ?? 0)}, rank ${r.allScores.findIndex(s => s.id === id) + 1})`);
  console.log('  curl  ' + Object.entries(h.st.curlScore).map(([k, v]) => `${k}:${f2(v)}`).join('  '));
  console.log(`  spread ${f2(h.st.spread)}  thumbIdxAngle ${f2(h.st.thumbIndexAngle)}  cluster ${f2(h.st.clusterDistance)}  palm ${h.st.palmFacing}`);

  for (const [label, mid] of [['expected', id], ['winner', win.id]]) {
    const m = MUDRA_BY_ID[mid];
    if (!m?.constraints) continue;
    console.log(`  -- ${label}: ${mid}`);
    for (const e of explain(m.constraints, h.lm, h.st)) {
      const tag = e.score < 0.6 ? '  ◄ LOW' : '';
      console.log(`     ${e.type.padEnd(15)} ${(e.finger || '').padEnd(7)} w${e.weight}  ${f2(e.score)}${tag}`);
    }
  }
}
