// tools/features.mjs — measured features of every single-hand fixture (live path).
import { readFileSync } from 'node:fs';
import { preprocessHands } from '../classifier.js';
import { resetSmoothing, tickFrame, normDist, FINGERS } from '../landmarks.js';
import { MUDRA_BY_ID } from '../mudras.js';
import { landmarksFor } from './_space.mjs';
import { fileURLToPath } from 'node:url'; import { dirname, join } from 'node:path';
const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const ids = JSON.parse(readFileSync(join(R,'poses/_index.json'),'utf8'));
const f=(n)=>n.toFixed(2);
console.log('id            thumb idx  mid  ring pink | spread clus tIdxA | t-idx t-mid t-ring t-pink | hands');
for (const id of ids) {
  const m=MUDRA_BY_ID[id]; if(!m||m.hands!==1) continue;
  const p=JSON.parse(readFileSync(join(R,`poses/${id}.json`),'utf8'));
  resetSmoothing(); tickFrame();
  const {lm:L,aspect,world}=landmarksFor(p,id,process.env.SPACE||'live');
  const h=preprocessHands([L],[[{categoryName:p.handedness||'Right'}]],aspect,world?[world]:null)[0];
  const c=h.st.curlScore, lm=h.lm;
  const t=(a)=>f(normDist(lm,4,FINGERS[a].tip));
  console.log(id.padEnd(13), [c.thumb,c.index,c.middle,c.ring,c.pinky].map(f).join('  '),'|',f(h.st.spread),f(h.st.clusterDistance),f(h.st.thumbIndexAngle).padStart(5),'|',t('index'),t('middle'),t('ring'),t('pinky'));
}
