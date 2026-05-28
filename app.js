// app.js
// Top-level driver. Manages the three views (Learn, Practice, Capture), loads
// captured mudras on boot and registers them in the k-NN index for instant
// recognition, and renders the cards with the priority visual (scanned >
// source > svg).

import { CONNECTIONS, TIP_INDICES, FINGER_NAMES, tickFrame, resetSmoothing,
         normalizeLandmarks } from './landmarks.js';
import { classify, preprocessHands, CLASSIFY } from './classifier.js';
import { MUDRA_BY_ID, MUDRAS, CATEGORIES, MUDRAS_BY_CATEGORY } from './mudras.js';
import { getSvg } from './svg.js';
import { mudraArt, renderVisual, getAvailableTypes, pickBaseVisual,
         setScannedFront, clearScannedFront, viewFromBuiltin, viewFromCapture,
         wireImageFallbacks, preloadSourcePhotos, setAvailablePoses,
         hasPose } from './art.js';
import * as store from './store.js';
import * as knn from './knn.js';
import * as capture from './capture.js';
import { loadLandmarker, getLoadedLandmarker } from './mediapipe.js';

// ============================================================
// Tuning
// ============================================================
const BUFFER_SIZE = 8;
const LOCK_FRAMES_NEEDED = 6;
const CANDIDATE_FLOOR = 0.62;
const HINT_FLOOR = 0.70;
const LOST_HAND_RESET_FRAMES = 6;
const HERO_CYCLE = ['pataka','alapadma','mukula','hamsasya','shikhara','mayura','suchi','ardhachandra'];
const NEON = {
  bone: '#00f0ff', boneCore: '#caf6ff',
  tip: '#ff00e0',  joint: '#00f0ff',
  lockGlow: '#39ff7d', searchGlow: '#00f0ff',
};

// ============================================================
// Captured-mudra library — kept in memory after boot, refreshed when
// the user adds, deletes, or imports.
// ============================================================
let CAPTURES = [];      // array of records from IndexedDB
const captureBlobURLs = new Map();   // captureId → front-photo URL (also stored in art.js)

async function loadCaptures() {
  CAPTURES = await store.getAllMudras().catch(() => []);
  for (const c of CAPTURES) {
    const front = c.angles?.[0]?.photo;
    if (front) {
      const url = URL.createObjectURL(front);
      captureBlobURLs.set(c.id, url);
      setScannedFront(c.id, url);
      if (c.builtinUpgrade) setScannedFront(c.builtinUpgrade, url);
    }
    knn.addMudra(c);
  }
}

function libraryViews() {
  const items = [];
  // All built-ins (in their categories), then captures.
  for (const m of MUDRAS) items.push(viewFromBuiltin(m));
  for (const c of CAPTURES) items.push(viewFromCapture(c));
  return items;
}

function viewForId(id, source) {
  if (source === 'knn') {
    const c = CAPTURES.find(x => x.id === id);
    return c ? viewFromCapture(c) : null;
  }
  const m = MUDRA_BY_ID[id];
  return m ? viewFromBuiltin(m) : null;
}

// ============================================================
// Boot
// ============================================================
(async function bootstrap() {
  await loadCaptures();
  // Build the in-memory set of mudras that have a pose file (built by
  // tools/extract_poses.py from real photos) so the renderer can show
  // the 3D wireframe option when one is available.
  fetch('poses/_index.json')
    .then(r => r.ok ? r.json() : [])
    .then(arr => setAvailablePoses(arr))
    .catch(() => {});
  capture.init && capture.init();
  buildCatalog();
  populateUpgradeDropdown();
  animateHero();
  wireNavigation();
  applyHashView();
  window.addEventListener('hashchange', applyHashView);
  // After first paint, prefetch every source photo in the background so
  // the Practice card paints instantly when a mudra locks.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(preloadSourcePhotos, { timeout: 1500 });
  } else {
    setTimeout(preloadSourcePhotos, 1200);
  }
})();

function populateUpgradeDropdown() {
  const sel = document.getElementById('capture-upgrade');
  if (!sel) return;
  // Wipe and rebuild — always reflects current state.
  while (sel.options.length > 1) sel.remove(1);
  // Group by category for readability.
  const groups = {};
  for (const m of MUDRAS) {
    (groups[m.category] || (groups[m.category] = [])).push(m);
  }
  for (const cat of CATEGORIES) {
    const items = groups[cat.id];
    if (!items) continue;
    const og = document.createElement('optgroup');
    og.label = cat.title;
    for (const m of items) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.names.iast} — ${m.names.en}`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

// ============================================================
// LEARN VIEW — catalog of built-ins + captures
// ============================================================
function buildCatalog() {
  const root = document.getElementById('mudra-sections');
  if (!root) return;
  // Compose category list — add a synthetic "captured" category if there are
  // any captures (and not all of them are upgrades that should sit next to
  // their built-in counterpart).
  const sections = CATEGORIES.map(c => ({ ...c, items: MUDRAS_BY_CATEGORY[c.id].map(viewFromBuiltin) }));
  const capturedItems = CAPTURES.map(viewFromCapture);
  if (capturedItems.length) {
    sections.unshift({
      id: 'captured', title: 'Your Captures',
      subtitle: 'Mudras you have scanned with the camera',
      items: capturedItems,
    });
  }
  root.innerHTML = sections.map(sec => `
    <section class="cat" id="cat-${sec.id}">
      <header class="cat-header">
        <h2 class="cat-title">${sec.title}</h2>
        <span class="cat-count">${sec.items.length}</span>
        <p class="cat-subtitle">${sec.subtitle}</p>
      </header>
      <div class="mudra-grid">
        ${sec.items.map(cardHtml).join('')}
      </div>
    </section>`).join('');
  wireImageFallbacks(root);
  // Wire capture-card delete buttons.
  root.querySelectorAll('[data-delete-capture]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-capture');
      if (!confirm('Delete this captured mudra?')) return;
      await store.deleteMudra(id);
      knn.removeMudra(id);
      clearScannedFront(id);
      const rec = CAPTURES.find(x => x.id === id);
      if (rec?.builtinUpgrade) clearScannedFront(rec.builtinUpgrade);
      const url = captureBlobURLs.get(id);
      if (url) URL.revokeObjectURL(url);
      captureBlobURLs.delete(id);
      CAPTURES = CAPTURES.filter(x => x.id !== id);
      buildCatalog();
    });
  });
}

function cardHtml(view) {
  const captured = view.kind === 'capture';
  return `
    <article class="grid-card${view.is3D ? ' is-3d' : ''}" data-id="${view.id}" data-reliable="${!!view.reliable}">
      ${captured ? `<button class="cap-card-del" data-delete-capture="${view.id}" title="Delete">×</button>` : ''}
      <div class="grid-card-art" data-hands="${view.hands}">${mudraArt(view)}</div>
      <div class="grid-card-names">
        <div class="grid-card-sa">${view.names.sa || '·'}</div>
        <div class="grid-card-iast">${view.displayName}${view.is3D ? ' <span class="threed-badge">3D</span>' : ''}</div>
        <div class="grid-card-en">${view.names.en || ''}</div>
      </div>
      ${view.howto ? `<div class="grid-card-howto"><span class="grid-card-howto-label">Form</span>${view.howto}</div>` : ''}
      <div class="grid-card-usage"><span class="grid-card-usage-label">Viniyoga</span>${view.usage}</div>
    </article>`;
}

// Cycle hero glyph.
function animateHero() {
  const glyphHost = document.getElementById('hero-glyph');
  if (!glyphHost) return;
  let i = 0;
  const render = () => {
    const id = HERO_CYCLE[i % HERO_CYCLE.length];
    const m = MUDRA_BY_ID[id];
    if (!m) { i++; return; }
    const view = viewFromBuiltin(m);
    glyphHost.style.opacity = '0';
    glyphHost.style.transition = 'opacity 400ms ease';
    setTimeout(() => {
      glyphHost.innerHTML = mudraArt(view);
      wireImageFallbacks(glyphHost);
      glyphHost.style.opacity = '1';
    }, 400);
    i++;
  };
  render();
  setInterval(render, 3200);
}

// ============================================================
// Navigation
// ============================================================
function wireNavigation() {
  document.querySelectorAll('[data-go]').forEach(el => {
    if (el.tagName === 'BUTTON' && !el.hasAttribute('type')) el.setAttribute('type', 'button');
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const target = el.getAttribute('data-go');
      const newHash = target === 'learn' ? '' : `#${target}`;
      if (newHash) history.replaceState(null, '', newHash);
      else history.replaceState(null, '', location.pathname + location.search);
      setView(target);
    });
  });
  // Capture form submit
  const form = document.getElementById('capture-form');
  if (form) form.addEventListener('submit', startCaptureFromForm);
  const saveBtn = document.getElementById('capture-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', onCaptureSave);
  const retakeBtn = document.getElementById('capture-retake-btn');
  if (retakeBtn) retakeBtn.addEventListener('click', onCaptureRetake);
}

function applyHashView() {
  const hash = window.location.hash;
  const view = hash === '#practice' ? 'practice'
             : hash === '#capture'  ? 'capture'
             : 'learn';
  setView(view);
}

function setView(view) {
  document.body.dataset.view = view;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-go') === view);
  });
  if (view === 'practice') {
    enterPractice();
    window.scrollTo(0, 0);
  } else {
    exitPractice();
  }
  if (view === 'capture') {
    showCaptureForm();
    window.scrollTo(0, 0);
  } else {
    if (capture.isRunning && capture.isRunning()) capture.abortSession();
  }
}

// ============================================================
// CAPTURE flow glue
// ============================================================
function showCaptureForm() {
  document.getElementById('capture-stage').classList.add('hidden');
  document.getElementById('capture-review').classList.add('hidden');
  document.getElementById('capture-form-panel').classList.remove('hidden');
  // Dropdown is populated once at bootstrap; this just resets selection.
}

async function startCaptureFromForm(e) {
  e.preventDefault();
  const name = document.getElementById('capture-name').value.trim();
  if (!name) return;
  const upgrade = document.getElementById('capture-upgrade').value || null;
  document.getElementById('capture-form-panel').classList.add('hidden');
  document.getElementById('capture-stage').classList.remove('hidden');
  await capture.startSession({
    name,
    builtinUpgrade: upgrade,
    onDone: showReviewScreen,
    onAbort: () => showCaptureForm(),
  });
}

let pendingViewer = null;
let pendingTurntable = null;

async function showReviewScreen(record) {
  document.getElementById('capture-stage').classList.add('hidden');
  document.getElementById('capture-review').classList.remove('hidden');
  // Build the 3D viewer + photo turntable from the captured angles.
  const { HandSkeleton3D, PhotoTurntable } = await import('./viewer3d.js');
  const skelHost = document.getElementById('review-skeleton');
  const ttHost = document.getElementById('review-turntable');
  skelHost.innerHTML = '';
  ttHost.innerHTML = '';
  pendingViewer = new HandSkeleton3D(skelHost);
  if (record.angles[0]?.worldLandmarks?.length) {
    pendingViewer.setPose(record.angles[0].worldLandmarks);
  }
  pendingTurntable = new PhotoTurntable(
    ttHost,
    record.angles.map(a => a.photo),
    record.angles.map(a => a.label),
  );
  // Pre-fill displayName preview
  const display = computeDisplayName(record.name, record.builtinUpgrade);
  document.getElementById('review-display-name').textContent = display;
  document.getElementById('review-3d-tag').style.display = (display.endsWith('· 3D') ? '' : 'none');
}

function computeDisplayName(name, builtinUpgrade) {
  if (builtinUpgrade) return name + ' · 3D';
  const lc = name.toLowerCase();
  // Conflict with a built-in or an existing capture name?
  const conflictBuiltin = MUDRAS.some(m =>
    m.names.iast.toLowerCase() === lc ||
    m.names.en.toLowerCase() === lc ||
    m.id.toLowerCase() === lc);
  const conflictCapture = CAPTURES.some(c => c.name.toLowerCase() === lc);
  return (conflictBuiltin || conflictCapture) ? `${name} · 3D` : name;
}

async function onCaptureSave() {
  const record = capture.getCurrentRecord();
  if (!record) return;
  // Optional meta from review screen
  const sa = document.getElementById('review-sa')?.value?.trim() || '';
  const iast = document.getElementById('review-iast')?.value?.trim() || '';
  const en = document.getElementById('review-en')?.value?.trim() || '';
  const usage = document.getElementById('review-usage')?.value?.trim() || '';
  if (sa || iast || en || usage) {
    record.meta = { sa, iast, en, usage };
  }
  const displayName = computeDisplayName(record.name, record.builtinUpgrade);
  const saved = await capture.saveCapture(displayName);
  // Register the scanned front URL globally so cards re-render with it.
  const frontBlob = saved.angles[0]?.photo;
  if (frontBlob) {
    const url = URL.createObjectURL(frontBlob);
    captureBlobURLs.set(saved.id, url);
    setScannedFront(saved.id, url);
    if (saved.builtinUpgrade) setScannedFront(saved.builtinUpgrade, url);
  }
  CAPTURES.push(saved);
  buildCatalog();
  // Tear down viewer / turntable.
  if (pendingViewer) { pendingViewer.destroy(); pendingViewer = null; }
  if (pendingTurntable) { pendingTurntable.destroy(); pendingTurntable = null; }
  // Bounce back to the form for the next capture.
  document.getElementById('capture-review').classList.add('hidden');
  showCaptureForm();
  document.getElementById('capture-form').reset();
  // Confirmation chip
  flashConfirmation(`Saved "${saved.displayName}". Try it in Practice!`);
}

function onCaptureRetake() {
  if (pendingViewer) { pendingViewer.destroy(); pendingViewer = null; }
  if (pendingTurntable) { pendingTurntable.destroy(); pendingTurntable = null; }
  document.getElementById('capture-review').classList.add('hidden');
  showCaptureForm();
}

function flashConfirmation(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('show'); void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ============================================================
// PRACTICE view
// ============================================================
let practiceVideo, practiceCanvas, practiceCtx;
let cardEl, statusEl, confEl, hintEl, debugEl, loaderEl;
let lastVideoTime = -1;
const buffer = [];
let currentLockId = null;
let currentLockSource = null;
let cardTimer = null;
let debugMode = false;
let modelLoaded = false;
let domWired = false;
let framesSinceHand = 0;

async function enterPractice() {
  if (!domWired) {
    await initPractice();
    return;
  }
  try {
    if (!practiceVideo.srcObject) {
      setLoader('Requesting camera…');
      await startWebcam();
      hideLoader();
    } else {
      await practiceVideo.play().catch(() => {});
    }
    if (modelLoaded) statusEl.textContent = 'Searching…';
  } catch (err) {
    setLoader('Camera access denied. Allow camera and reload, or go back to Learn.');
    console.error(err);
  }
}

function exitPractice() {
  if (practiceVideo && practiceVideo.srcObject) {
    practiceVideo.pause();
    for (const t of practiceVideo.srcObject.getTracks()) t.stop();
    practiceVideo.srcObject = null;
    lastVideoTime = -1;
  }
  buffer.length = 0;
  currentLockId = null;
  currentLockSource = null;
  hideCard();
}

async function initPractice() {
  practiceVideo = document.getElementById('webcam');
  practiceCanvas = document.getElementById('overlay');
  practiceCtx = practiceCanvas.getContext('2d');
  cardEl   = document.getElementById('card');
  statusEl = document.getElementById('status-text');
  confEl   = document.getElementById('conf-fill');
  hintEl   = document.getElementById('hint');
  debugEl  = document.getElementById('debug');
  loaderEl = document.getElementById('loader');

  window.addEventListener('keydown', (e) => {
    if ((e.key === 'd' || e.key === 'D') && document.body.dataset.view === 'practice') {
      debugMode = !debugMode;
      debugEl.classList.toggle('visible', debugMode);
    }
  });
  window.addEventListener('pagehide', exitPractice);
  domWired = true;

  try {
    await startWebcam();
  } catch (err) {
    setLoader('Camera access denied. Allow camera and reload, or go back to Learn.');
    console.error(err);
    return;
  }
  try {
    await loadLandmarker({ numHands: 2 });
    modelLoaded = true;
  } catch (err) {
    setLoader('Failed to load hand model. Check your connection and reload.');
    console.error(err);
    return;
  }
  hideLoader();
  statusEl.textContent = 'Searching…';
  requestAnimationFrame(loop);
}

function setLoader(t) { loaderEl.textContent = t; loaderEl.classList.add('visible'); }
function hideLoader() { loaderEl.classList.remove('visible'); }

async function startWebcam() {
  setLoader('Requesting camera…');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  practiceVideo.srcObject = stream;
  await new Promise(res => practiceVideo.addEventListener('loadedmetadata', res, { once: true }));
  await practiceVideo.play();
  practiceCanvas.width  = practiceVideo.videoWidth;
  practiceCanvas.height = practiceVideo.videoHeight;
}

function loop() {
  const hl = getLoadedLandmarker();
  if (hl && practiceVideo.readyState >= 2 &&
      document.body.dataset.view === 'practice' &&
      practiceVideo.currentTime !== lastVideoTime) {
    lastVideoTime = practiceVideo.currentTime;
    const results = hl.detectForVideo(practiceVideo, performance.now());
    processResults(results);
  }
  requestAnimationFrame(loop);
}

function processResults(results) {
  practiceCtx.clearRect(0, 0, practiceCanvas.width, practiceCanvas.height);
  tickFrame();
  const lmList = results.landmarks || [];
  if (lmList.length === 0) {
    framesSinceHand++;
    if (framesSinceHand === LOST_HAND_RESET_FRAMES) resetSmoothing();
    pushBuffer(null);
    updateUI({ lock: null, top: null });
    if (debugMode) debugEl.textContent = 'No hand detected.';
    return;
  }
  framesSinceHand = 0;
  const hands = preprocessHands(lmList, results.handednesses || results.handedness);
  const result = classify(hands);
  const drawMode = currentLockId ? 'lock' : 'search';
  for (const h of hands) drawSkeleton(h.lm, drawMode);

  if (result.top && result.top.score >= CANDIDATE_FLOOR &&
      result.top.score - (result.second?.score || 0) >= CLASSIFY.margin * 0.5) {
    pushBuffer(`${result.top.source || 'rule'}:${result.top.id}`);
  } else {
    pushBuffer(null);
  }
  updateUI(result);
  if (debugMode) drawDebug(hands, result);
}

function pushBuffer(key) {
  buffer.push(key);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
}
function bufferConsensus() {
  if (buffer.length < BUFFER_SIZE) return null;
  const counts = new Map();
  for (const k of buffer) if (k) counts.set(k, (counts.get(k) || 0) + 1);
  let bestKey = null, bestCount = 0;
  for (const [k, c] of counts) if (c > bestCount) { bestKey = k; bestCount = c; }
  return bestCount >= LOCK_FRAMES_NEEDED ? bestKey : null;
}

function updateUI(result) {
  const topScore = result.top ? result.top.score : 0;
  confEl.style.width = Math.round(topScore * 100) + '%';
  confEl.style.background = topScore >= CLASSIFY.threshold
    ? 'linear-gradient(90deg, #39ff7d, #00f0ff)'
    : 'linear-gradient(90deg, #00f0ff, #ff00e0)';

  const consensus = bufferConsensus();
  if (consensus !== `${currentLockSource}:${currentLockId}`) {
    if (consensus) {
      const [src, id] = consensus.split(/:(.+)/);
      currentLockSource = src;
      currentLockId = id;
      showCard(id, src);
    } else if (currentLockId) {
      currentLockId = null; currentLockSource = null;
      hideCard();
    }
  }

  if (currentLockId) {
    const view = viewForId(currentLockId, currentLockSource);
    statusEl.textContent = view?.displayName || currentLockId;
    hintEl.textContent = view?.is3D ? '3D scanned mudra'
                       : view?.hands === 2 ? '(two-hand mudrā)' : '';
  } else if (result.top && result.top.score >= HINT_FLOOR) {
    const view = viewForId(result.top.id, result.top.source);
    statusEl.textContent = 'Hold steady…';
    hintEl.textContent = view ? `Looks like ${view.displayName}` : '';
  } else {
    statusEl.textContent = 'Searching…';
    hintEl.textContent = '';
  }
}

function showCard(id, source) {
  const view = viewForId(id, source);
  if (!view) return;
  const wasVisible = cardEl.classList.contains('visible');
  if (cardTimer) clearTimeout(cardTimer);
  cardEl.classList.remove('visible');
  const delay = wasVisible ? 180 : 0;
  cardTimer = setTimeout(() => {
    cardEl.innerHTML = renderPracticeCard(view);
    wireImageFallbacks(cardEl);
    wirePracticeToggle(cardEl, view);
    requestAnimationFrame(() => cardEl.classList.add('visible'));
  }, delay);
}

function hideCard() {
  if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
  cardEl.classList.remove('visible');
}

// Practice card: shows the priority visual + a segmented toggle of the
// available types (svg / source / scanned). Photos are rendered EAGER so
// they paint the moment the card appears, not after a fresh fetch.
function renderPracticeCard(view) {
  const base = pickBaseVisual(view);
  const types = getAvailableTypes(view);
  return `
    <div class="card-art" data-current-type="${base.type}">${renderVisual(view, base.type, { eager: true })}</div>
    <div class="card-toggle">
      ${types.map(t => `
        <button class="toggle-btn${t === base.type ? ' active' : ''}" data-type="${t}">${t}</button>
      `).join('')}
    </div>
    <div class="card-text">
      <div class="card-sa">${view.names.sa || '·'}</div>
      <div class="card-iast">${view.displayName}${view.is3D ? ' <span class="threed-badge">3D</span>' : ''}</div>
      <div class="card-en">${view.names.en || ''}</div>
      <div class="card-usage">${view.usage}</div>
    </div>`;
}

function wirePracticeToggle(root, view) {
  // The 3D toggle is special — it instantiates a Three.js viewer instead
  // of swapping an <img>/svg in.
  let viewer3d = null;
  const cleanup = () => {
    if (viewer3d) { viewer3d.destroy(); viewer3d = null; }
  };
  root.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = btn.dataset.type;
      const artEl = root.querySelector('.card-art');
      cleanup();
      if (t === '3d') {
        artEl.innerHTML = '<div class="card-3d"></div>';
        const host = artEl.querySelector('.card-3d');
        const [{ HandSkeleton3D, loadPose }] = await Promise.all([import('./viewer3d.js')]);
        const wl = await getWorldLandmarksFor(view, loadPose);
        viewer3d = new HandSkeleton3D(host, { autoRotate: true });
        if (wl) viewer3d.setPose(wl.points, wl.handedness);
      } else {
        artEl.innerHTML = renderVisual(view, t, { eager: true });
      }
      artEl.dataset.currentType = t;
      root.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      wireImageFallbacks(artEl);
    });
  });
}

// Resolve worldLandmarks for a mudra view, in priority order:
//   1) the user's own capture (if any),
//   2) the offline-extracted poses/{slug}.json.
async function getWorldLandmarksFor(view, loadPose) {
  if (view.kind === 'capture' && view.record?.angles?.[0]?.worldLandmarks?.length) {
    return {
      points: view.record.angles[0].worldLandmarks,
      handedness: view.record.angles[0].handedness || 'Right',
    };
  }
  const slug = view.builtinUpgrade || view.id;
  const data = await loadPose(slug);
  if (!data) return null;
  return {
    points: data.worldLandmarks,
    handedness: data.handedness || 'Right',
  };
}

// ---- Neon skeleton (unchanged) ----
function drawSkeleton(lm, mode) {
  const W = practiceCanvas.width, H = practiceCanvas.height;
  const t = performance.now();
  const pulse = 0.5 + 0.5 * Math.sin(t / 380);
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const pad = 28;
  const bx = minX * W - pad, by = minY * H - pad;
  const bw = (maxX - minX) * W + pad * 2, bh = (maxY - minY) * H + pad * 2;
  const glow = mode === 'lock' ? NEON.lockGlow : NEON.searchGlow;
  const c = practiceCtx;
  c.save();
  c.strokeStyle = glow; c.shadowColor = glow;
  c.shadowBlur = 24 + pulse * 14; c.lineWidth = 1.5;
  c.globalAlpha = 0.18 + pulse * 0.18;
  roundRect(c, bx, by, bw, bh, 20); c.stroke();
  c.restore();
  for (const [a, b] of CONNECTIONS) {
    const p1 = { x: lm[a].x * W, y: lm[a].y * H };
    const p2 = { x: lm[b].x * W, y: lm[b].y * H };
    drawBone(p1, p2);
  }
  for (let i = 0; i < lm.length; i++) {
    drawJoint({ x: lm[i].x * W, y: lm[i].y * H }, TIP_INDICES.has(i), t, i);
  }
}
function drawBone(p1, p2) {
  const c = practiceCtx;
  c.save(); c.lineCap = 'round';
  c.strokeStyle = NEON.bone; c.shadowColor = NEON.bone;
  c.shadowBlur = 18; c.lineWidth = 6;
  c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
  c.shadowBlur = 0; c.strokeStyle = NEON.boneCore; c.lineWidth = 2;
  c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
  c.restore();
}
function drawJoint(p, isTip, t, idx) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 360 + idx * 0.7);
  const r = (isTip ? 6.5 : 4.6) + pulse * 1.4;
  const color = isTip ? NEON.tip : NEON.joint;
  const c = practiceCtx;
  c.save();
  c.fillStyle = color; c.shadowColor = color;
  c.shadowBlur = isTip ? 20 : 14;
  c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2); c.fill();
  c.restore();
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawDebug(hands, result) {
  const lines = [`Hands: ${hands.length}    Buffer: ${buffer.filter(Boolean).length}/${BUFFER_SIZE}    Lock: ${currentLockId || '—'} (${currentLockSource || '·'})`];
  lines.push(`k-NN index: ${knn.size()} vectors across ${knn.mudraCount()} mudras`);
  hands.forEach((h, i) => {
    lines.push(`— Hand ${i + 1}  (${h.handId})  palm=${h.st.palmFacing} —`);
    for (const f of FINGER_NAMES) {
      const score = h.st.curlScore[f].toFixed(2);
      lines.push(`  ${f.padEnd(7)} ${h.st.curl[f].padEnd(9)} (${score})  dir=${h.st.dir[f]}`);
    }
    lines.push(`  spread=${h.st.spread.toFixed(2)}  th∠idx=${h.st.thumbIndexAngle.toFixed(0)}°  cluster=${h.st.clusterScore.toFixed(2)}`);
  });
  if (result.allScores && result.allScores.length) {
    lines.push('— Top scores —');
    for (const s of result.allScores.slice(0, 6)) {
      const id = (s.displayName || s.id).padEnd(18);
      const src = (s.source || '·').padEnd(4);
      const dist = s.nearestDist != null ? ` d=${s.nearestDist.toFixed(3)}` : '';
      lines.push(`  ${id} ${src} ${s.score.toFixed(3)}${dist}`);
    }
  }
  debugEl.textContent = lines.join('\n');
}
