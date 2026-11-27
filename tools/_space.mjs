// tools/_space.mjs — shared landmark-space selection for the test tools.
//
//   world  metric worldLandmarks (what the Learn 3D viewer shows)
//   live   image landmarks (+webcam aspect) for position AND worldLandmarks
//          for finger shape — EXACTLY the live app's path (default)
//   image  image landmarks only (CLASSIFY.useWorldLandmarks=false fallback)
//   pixel  isotropic pixel-space reference (should equal `image`)
//
// Photos are not webcam frames, so for `image` the x/z coordinates are first
// stretched to emulate a 16:9 frame; preprocessHands then undoes it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WEBCAM_ASPECT = 16 / 9;

export function pngSize(file) {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export function landmarksFor(pose, id, space = 'live', aspect = WEBCAM_ASPECT) {
  if (space === 'world') return { lm: pose.worldLandmarks, aspect: 1 };
  if (space === 'live') {
    const r = landmarksFor(pose, id, 'image', aspect);
    return { ...r, world: pose.worldLandmarks };
  }
  const { w, h } = pngSize(join(ROOT, 'images', `${id}.png`));
  const lm = pose.landmarks;
  if (space === 'pixel') return { lm: lm.map(p => ({ x: p.x * w, y: p.y * h, z: (p.z || 0) * w })), aspect: 1 };
  const k = (w / h) / aspect;
  return { lm: lm.map(p => ({ x: p.x * k, y: p.y, z: (p.z || 0) * k })), aspect };
}
