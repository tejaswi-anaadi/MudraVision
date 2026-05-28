// capture.js
// Guided 5-angle capture flow. Each angle is gated by THREE live checks
// that the user can see as small dots turning green:
//   1) Position — hand centroid inside the target ring,
//   2) Orientation — palm rotated to match the requested angle (yaw/pitch
//      thresholds against the wrist→MCPs depth deltas),
//   3) Steady — landmarks not jittering frame to frame.
// Only when ALL three hold for HOLD_FRAMES is the photo + landmarks
// captured; a big green tick animates, then the flow advances.

import { loadLandmarker, loadSegmenter, getLoadedSegmenter } from './mediapipe.js';
import {
  normalizeLandmarks, CONNECTIONS, TIP_INDICES, handBBox,
  handCentroid, tickFrame, resetSmoothing,
} from './landmarks.js';
import * as store from './store.js';
import * as knn from './knn.js';

// ============================================================
// Tuning constants
// ============================================================
export const CAPTURE = {
  NUM_ANGLES: 2,
  HOLD_FRAMES: 18,          // ≈ 0.6 s at 30 fps; all 3 gates must hold this long
  STABILITY_MAX_DELTA: 0.014,
  RING_RADIUS: 0.22,
  PHOTO_PAD: 0.22,          // extra padding around bbox so the hand silhouette has room
  POST_CAPTURE_TICK_MS: 1200,
  PRE_CAPTURE_READ_MS: 1500,
};

// Orientation thresholds — measured from raw landmark z values.
//   yaw   = z(index_MCP) − z(pinky_MCP)   — sideways tilt
//   pitch = z(wrist)     − z(middle_MCP)  — forward/back tilt
// Right-wrist pronation/supination is asymmetric (right-tilt with the right
// hand is uncomfortable for many people) so the side and pitch checks accept
// EITHER direction — the user can twist whichever way is natural.
const ORIENT = {
  yawDead: 0.05,
  pitchDead: 0.05,
  yawTilt: 0.08,
  pitchTilt: 0.08,
};

const ANGLES = [
  { label: 'Front', instruction: 'Front — face the camera directly.',           arrow: '•'  },
  { label: 'Side',  instruction: 'Tilt your hand sideways (either direction).', arrow: '↔'  },
];
export function getAngles() { return ANGLES; }

// Per-angle orientation check — uses |yaw| so the user can pick whichever
// wrist rotation is comfortable (right-tilt with the right hand is
// uncomfortable for many).
function orientationOK(lm, angleLabel) {
  const yaw = lm[5].z - lm[17].z;
  const pitch = lm[0].z - lm[9].z;
  switch (angleLabel) {
    case 'Front': return Math.abs(yaw) < ORIENT.yawDead && Math.abs(pitch) < ORIENT.pitchDead;
    case 'Side':  return Math.abs(yaw) > ORIENT.yawTilt;
    default:      return false;
  }
}

// ============================================================
// State
// ============================================================
let video, canvas, ctx;
let stepLabel, stepInstruction, stepArrow, stepProgress, holdBar;
let chkPos, chkOrient, chkSteady;
let bigTick, flash;
let landmarker = null;
let step = 0;
let record = null;
let holdCount = 0;
let lastLm = null;
let stillFrames = 0;
let stepStartedAt = 0;
let running = false;
let advancing = false;     // true between capture-shutter and next-step
let onComplete = null;
let onCancel = null;
let lastVideoTime = -1;

export async function init() {
  video           = document.getElementById('capture-webcam');
  canvas          = document.getElementById('capture-overlay');
  ctx             = canvas.getContext('2d');
  stepLabel       = document.getElementById('capture-step-label');
  stepInstruction = document.getElementById('capture-step-instr');
  stepArrow       = document.getElementById('capture-step-arrow');
  stepProgress    = document.getElementById('capture-step-progress');
  holdBar         = document.getElementById('capture-hold-fill');
  chkPos          = document.getElementById('chk-pos');
  chkOrient       = document.getElementById('chk-orient');
  chkSteady       = document.getElementById('chk-steady');
  bigTick         = document.getElementById('capture-big-tick');
  flash           = document.getElementById('capture-flash');
}

export async function startSession({ name, builtinUpgrade = null, meta = null, onDone, onAbort }) {
  if (!video) await init();
  onComplete = onDone || (() => {});
  onCancel   = onAbort || (() => {});
  record = store.newMudraRecord({ name, builtinUpgrade, meta });
  step = 0;
  holdCount = 0;
  lastLm = null;
  advancing = false;
  lastVideoTime = -1;
  resetSmoothing();

  try { await openCamera(); }
  catch (err) { showError('Camera access denied.'); console.error(err); onCancel(); return; }
  try { landmarker = await loadLandmarker({ numHands: 1 }); }
  catch (err) { showError('Failed to load hand model.'); console.error(err); onCancel(); return; }
  // Load the segmenter in the background — captures will use it when ready,
  // and gracefully fall back to the landmark-only mask if it never loads.
  loadSegmenter().catch(err => console.warn('Segmenter unavailable:', err));

  showStep(0);
  running = true;
  requestAnimationFrame(loop);
}

export function abortSession() {
  running = false;
  closeCamera();
  onCancel && onCancel();
}

// ============================================================
// Camera
// ============================================================
async function openCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

function closeCamera() {
  if (video && video.srcObject) {
    video.pause();
    for (const t of video.srcObject.getTracks()) t.stop();
    video.srcObject = null;
  }
}

// ============================================================
// Loop
// ============================================================
function loop() {
  if (!running) return;
  if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    tickFrame();
    const results = landmarker.detectForVideo(video, performance.now());
    processFrame(results);
  }
  requestAnimationFrame(loop);
}

function processFrame(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hands = results.landmarks || [];
  const worldHands = results.worldLandmarks || [];
  const handedness = results.handednesses || results.handedness || [];

  if (advancing) return;   // frozen during the green-tick animation

  // No hand? Reset all checks.
  if (hands.length !== 1) {
    setChecks({ pos: false, orient: false, steady: false });
    holdCount = 0; stillFrames = 0; lastLm = null;
    setHold(0);
    return;
  }

  const lm = hands[0];
  drawSkeleton(lm, holdCount > 0);

  const posOK    = isCentred(lm);
  const orientOK = orientationOK(lm, ANGLES[step].label);
  const steadyOK = stableEnough(lm);
  setChecks({ pos: posOK, orient: orientOK, steady: steadyOK });

  // Don't allow capture during the user's read-instruction window.
  const inReadWindow = (performance.now() - stepStartedAt) < CAPTURE.PRE_CAPTURE_READ_MS;
  if (inReadWindow) {
    setHold(0);
    holdCount = 0;
    return;
  }

  if (posOK && orientOK && steadyOK) {
    holdCount++;
    setHold(Math.min(1, holdCount / CAPTURE.HOLD_FRAMES));
    if (holdCount >= CAPTURE.HOLD_FRAMES) {
      captureAngle(lm, worldHands[0] || [], handedness[0]?.[0]?.categoryName || 'Right');
    }
  } else {
    // Decay the hold quickly so users see immediate feedback when they break a check.
    holdCount = Math.max(0, holdCount - 2);
    setHold(holdCount / CAPTURE.HOLD_FRAMES);
  }
}

function stableEnough(lm) {
  if (!lastLm) { lastLm = lm.map(p => ({...p})); return false; }
  let maxD = 0;
  for (let i = 0; i < 21; i++) {
    const dx = lm[i].x - lastLm[i].x;
    const dy = lm[i].y - lastLm[i].y;
    const d = Math.hypot(dx, dy);
    if (d > maxD) maxD = d;
  }
  lastLm = lm.map(p => ({...p}));
  if (maxD < CAPTURE.STABILITY_MAX_DELTA) stillFrames++;
  else stillFrames = 0;
  return stillFrames >= 4;
}

function isCentred(lm) {
  const c = handCentroid(lm);
  return Math.hypot(c.x - 0.5, c.y - 0.5) < CAPTURE.RING_RADIUS;
}

// ============================================================
// Capture a single angle — runs the shutter animation
// ============================================================
async function captureAngle(lm, worldLm, handedness) {
  advancing = true;
  const angleSpec = ANGLES[step];
  const normalized = normalizeLandmarks(lm);
  const worldFlat = (worldLm || []).map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
  const photo = await capturePhoto(lm);
  record.angles.push({
    label: angleSpec.label,
    landmarks: normalized,
    worldLandmarks: worldFlat,
    handedness,
    photo,
  });

  flashOnce();
  showBigTick(angleSpec.label);

  // After the tick animation, advance.
  setTimeout(() => {
    hideBigTick();
    advancing = false;
    holdCount = 0;
    stillFrames = 0;
    setHold(0);
    setChecks({ pos: false, orient: false, steady: false });
    step++;
    if (step >= CAPTURE.NUM_ANGLES) {
      running = false;
      closeCamera();
      onComplete && onComplete(record);
    } else {
      showStep(step);
    }
  }, CAPTURE.POST_CAPTURE_TICK_MS);
}

// Capture the hand as a PNG with a transparent background.
//
// Strategy:
//   (a) MediaPipe Selfie Segmenter produces a precise person-vs-background
//       mask following the real hand contours.
//   (b) A landmark-derived "hull" mask (loose silhouette built from the
//       21 landmarks) excludes the arm / wrist area below the hand and any
//       stray hand-tone artefacts elsewhere.
//   (c) The final alpha is the intersection (a) ∩ (b): the segmenter gives
//       the precise edge; the hull confines the region to the hand only.
// If the segmenter hasn't loaded yet, we gracefully fall back to (b) alone.
async function capturePhoto(lm) {
  const bbox = handBBox(lm);
  const W = video.videoWidth, H = video.videoHeight;
  const pad = CAPTURE.PHOTO_PAD;
  const x = Math.max(0, (bbox.minX - pad) * W);
  const y = Math.max(0, (bbox.minY - pad) * H);
  const w = Math.min(W - x, (bbox.maxX - bbox.minX + 2 * pad) * W);
  const h = Math.min(H - y, (bbox.maxY - bbox.minY + 2 * pad) * H);

  // ---- (0) Output canvas: the cropped, mirrored video frame.
  const off = document.createElement('canvas');
  off.width = Math.round(w);
  off.height = Math.round(h);
  const octx = off.getContext('2d');
  octx.save();
  octx.translate(off.width, 0);
  octx.scale(-1, 1);
  octx.drawImage(video, W - x - w, y, w, h, 0, 0, off.width, off.height);
  octx.restore();

  // ---- (a) Segmenter mask — try; tolerate failure.
  let segMask = null;
  try { segMask = await runSelfieSegmenter(off); }
  catch (e) { console.warn('segment failed', e); }

  // ---- (b) Landmark hull mask in output (mirrored) coords.
  const hullMask = buildLandmarkHull(lm, x, y, w, h, off.width, off.height);

  // ---- (c) Intersection: hull AND seg.
  const combined = document.createElement('canvas');
  combined.width = off.width;
  combined.height = off.height;
  const cctx = combined.getContext('2d');
  cctx.drawImage(hullMask, 0, 0);
  if (segMask) {
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(segMask, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
  }

  // Apply combined mask to the cropped video.
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(combined, 0, 0);
  octx.globalCompositeOperation = 'source-over';

  return new Promise(res => off.toBlob(res, 'image/png'));
}

// Run the selfie segmenter on the cropped+mirrored frame and return a
// canvas where alpha=255 for "person" pixels and alpha=0 for background.
async function runSelfieSegmenter(canvas) {
  const segmenter = getLoadedSegmenter();
  if (!segmenter) return null;
  const result = segmenter.segment(canvas);
  const mask = result?.categoryMask;
  if (!mask) return null;
  const mW = mask.width, mH = mask.height;
  const arr = mask.getAsUint8Array();
  const out = document.createElement('canvas');
  out.width = mW; out.height = mH;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(mW, mH);
  // For selfie_segmenter, class 0 = background, class 1 = person. Some
  // builds output 0=person, 1=bg — detect by majority sample at the
  // image centre (should be hand → person).
  let centerVal = arr[Math.floor((mH / 2)) * mW + Math.floor(mW / 2)];
  const personIsZero = centerVal === 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    const o = i * 4;
    img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255;
    const isPerson = personIsZero ? (v === 0) : (v !== 0);
    img.data[o + 3] = isPerson ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  mask.close && mask.close();
  // Scale to match the input canvas if the segmenter chose a different res.
  if (mW !== canvas.width || mH !== canvas.height) {
    const scaled = document.createElement('canvas');
    scaled.width = canvas.width;
    scaled.height = canvas.height;
    const sctx = scaled.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(out, 0, 0, canvas.width, canvas.height);
    return scaled;
  }
  return out;
}

// Build a generous hand-shaped alpha mask from the landmarks. The shape is
// the union of:
//   - a palm disc centred at the average of wrist + 4 MCPs,
//   - rounded thick strokes along every bone,
//   - discs at every landmark (slightly larger at the fingertips).
// The edges are feathered with a small Gaussian blur for smoothness.
function buildLandmarkHull(lm, x, y, w, h, outW, outH) {
  const mask = document.createElement('canvas');
  mask.width = outW;
  mask.height = outH;
  const mctx = mask.getContext('2d');
  const W = video.videoWidth, H = video.videoHeight;
  const px = (i) => ({
    x: outW - ((lm[i].x * W - x) * (outW / w)),
    y: (lm[i].y * H - y) * (outH / h),
  });
  const wristP = px(0), midMcpP = px(9);
  const handPx = Math.hypot(wristP.x - midMcpP.x, wristP.y - midMcpP.y);
  const fingerR = handPx * 0.28;   // finger half-thickness — slightly bigger so segmenter can trim
  const palmR   = handPx * 0.95;   // palm "blob" radius

  mctx.fillStyle = '#fff';
  mctx.strokeStyle = '#fff';
  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  mctx.filter = 'blur(' + Math.max(2, handPx * 0.05) + 'px)';

  // Palm
  const palmPts = [px(0), px(5), px(9), px(13), px(17)];
  const palmC = palmPts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  palmC.x /= palmPts.length; palmC.y /= palmPts.length;
  mctx.beginPath();
  mctx.arc(palmC.x, palmC.y, palmR, 0, Math.PI * 2);
  mctx.fill();
  // Bones
  mctx.lineWidth = fingerR * 2;
  for (const [a, b] of CONNECTIONS) {
    const pa = px(a), pb = px(b);
    mctx.beginPath(); mctx.moveTo(pa.x, pa.y); mctx.lineTo(pb.x, pb.y); mctx.stroke();
  }
  // Joints
  for (let i = 0; i < 21; i++) {
    const p = px(i);
    mctx.beginPath(); mctx.arc(p.x, p.y, fingerR * 1.05, 0, Math.PI * 2); mctx.fill();
  }
  // Fingertip caps
  for (const i of [4, 8, 12, 16, 20]) {
    const p = px(i);
    mctx.beginPath(); mctx.arc(p.x, p.y, fingerR * 1.30, 0, Math.PI * 2); mctx.fill();
  }
  return mask;
}

// ============================================================
// UI helpers
// ============================================================
function showStep(i) {
  const spec = ANGLES[i];
  stepStartedAt = performance.now();
  if (stepLabel)       stepLabel.textContent = `Angle ${i + 1} of ${CAPTURE.NUM_ANGLES}`;
  if (stepInstruction) stepInstruction.textContent = spec.instruction;
  if (stepArrow)       stepArrow.textContent = spec.arrow;
  if (stepProgress)    stepProgress.innerHTML = ANGLES.map((_, k) =>
    `<span class="cap-dot${k < i ? ' done' : k === i ? ' active' : ''}"></span>`).join('');
}

function setHold(v) {
  if (holdBar) holdBar.style.width = Math.round(v * 100) + '%';
}

function setChecks({ pos, orient, steady }) {
  if (chkPos)    chkPos.classList.toggle('ok', !!pos);
  if (chkOrient) chkOrient.classList.toggle('ok', !!orient);
  if (chkSteady) chkSteady.classList.toggle('ok', !!steady);
}

function flashOnce() {
  if (!flash) return;
  flash.classList.remove('flash-on');
  void flash.offsetWidth;
  flash.classList.add('flash-on');
}

function showBigTick(angleLabel) {
  if (!bigTick) return;
  bigTick.querySelector('.tick-label').textContent = `${angleLabel} captured`;
  bigTick.classList.remove('show');
  void bigTick.offsetWidth;
  bigTick.classList.add('show');
}
function hideBigTick() {
  if (bigTick) bigTick.classList.remove('show');
}

function showError(text) {
  if (stepLabel) stepLabel.textContent = 'Capture failed';
  if (stepInstruction) stepInstruction.textContent = text;
}

function drawSkeleton(lm, locking) {
  const W = canvas.width, H = canvas.height;
  const cyan = '#00f0ff', mag = '#ff00e0';
  const glow = locking ? '#39ff7d' : cyan;
  for (const [a, b] of CONNECTIONS) {
    ctx.save();
    ctx.strokeStyle = glow; ctx.shadowColor = glow;
    ctx.shadowBlur = 14; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lm[a].x * W, lm[a].y * H); ctx.lineTo(lm[b].x * W, lm[b].y * H); ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 21; i++) {
    const x = lm[i].x * W, y = lm[i].y * H;
    const isTip = TIP_INDICES.has(i);
    ctx.save();
    ctx.fillStyle = isTip ? mag : cyan; ctx.shadowColor = isTip ? mag : cyan;
    ctx.shadowBlur = isTip ? 14 : 10;
    ctx.beginPath(); ctx.arc(x, y, isTip ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// Save
// ============================================================
export async function saveCapture(displayName) {
  if (!record) throw new Error('no record');
  record.displayName = displayName || record.name;
  await store.saveMudra(record);
  knn.addMudra(record);
  const out = record;
  record = null;
  return out;
}

export function getCurrentRecord() { return record; }
export function isRunning() { return running; }
