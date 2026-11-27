// recorder.js
// Labelled-landmark dataset recorder for the Practice view.
//
// Why it exists: the reference photos can't measure real accuracy (35 mudras
// have no photo, several photos are near-identical hands, and the photos are
// also the tuning set). This records real hands, held by a real person in
// front of the real camera, with a label — then tools/eval_dataset.mjs
// replays them through the exact live pipeline and splits by TAKE so
// near-duplicate frames never leak between tuning and test data.
//
// What is stored (nothing leaves the browser until you press Export):
//   raw, unsmoothed MediaPipe landmarks (image + world) per hand,
//   handedness, the video aspect ratio, a label, and take/session ids.
//   No camera frames or photos are kept.
//
// Open the panel with the "● Record" button or the R key in Practice.

export const SCHEMA_VERSION = 1;

// A "take" is one hold of one pose: countdown, then a burst of frames.
export const TAKE = {
  countdownSec: 3,
  frames: 12,          // samples kept per take
  intervalMs: 100,     // gap between sampled frames
  minValid: 8,         // discard the take if fewer frames had the right hand count
  timeoutMs: 6000,     // give up if the hands never settle
  goalTakes: 5,        // takes per mudra before it is marked done
};

// ============================================================
// IndexedDB (own database — does not touch the captured-mudra store)
// ============================================================
// Storage keys keep the pre-rebrand name so existing recordings survive.
const DB_NAME = 'mudravision-dataset';
const STORE = 'samples';
let _db = null;

function openDB() {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('byLabel', 'label');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _db;
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const dataset = {
  addSamples: (samples) => tx('readwrite', s => { for (const x of samples) s.add(x); }),
  getAll: () => tx('readonly', s => s.getAll()),
  clear: () => tx('readwrite', s => s.clear()),
};

// ============================================================
// Pure helpers (also exercised from the browser test and the Node harness)
// ============================================================
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const pt = (p) => ({ x: r5(p.x), y: r5(p.y), z: r5(p.z || 0) });

// Deep, rounded copy of one MediaPipe result. MediaPipe reuses its result
// objects between frames, so a snapshot must copy, never reference.
export function snapshotFrame(results) {
  const lms = results?.landmarks || [];
  const worlds = results?.worldLandmarks || [];
  const handed = results?.handednesses || results?.handedness || [];
  return lms.map((lm, i) => ({
    handedness: handed[i]?.[0]?.categoryName ?? null,
    handednessScore: handed[i]?.[0]?.score != null ? r5(handed[i][0].score) : null,
    landmarks: lm.map(pt),
    worldLandmarks: (worlds[i] || []).map(pt),
  }));
}

// A frame is usable only if the hand count matches the mudra exactly and
// every hand carries full image + world landmarks.
export function frameMatches(hands, needHands) {
  return hands.length === needHands &&
    hands.every(h => h.landmarks.length === 21 && h.worldLandmarks.length === 21);
}

export function summarize(samples, goal = TAKE.goalTakes) {
  const byLabel = {};
  for (const s of samples) {
    const e = (byLabel[s.label] ||= { samples: 0, takes: new Set() });
    e.samples++; e.takes.add(s.take);
  }
  const out = {};
  for (const [k, v] of Object.entries(byLabel)) out[k] = { samples: v.samples, takes: v.takes.size, done: v.takes.size >= goal };
  return out;
}

export function buildDatasetJSON(samples) {
  return {
    schema: SCHEMA_VERSION,
    app: 'mudra-companion',
    createdAt: new Date().toISOString(),
    samples: samples.map(({ id, ...rest }) => rest),
  };
}

// ============================================================
// Controller + UI
// ============================================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function initRecorder({ stage, mudras, categories, notify = () => {}, take = TAKE }) {
  const labels = mudras.filter(m => m.recognize);
  const session = Math.random().toString(36).slice(2, 10);
  let latest = { frameId: 0, hands: [], aspect: 1, w: 0, h: 0 };
  let counts = {};
  let state = 'idle';          // idle | countdown | recording | saving
  let cancelled = false;
  let open = false;

  // ---------- DOM ----------
  const btn = document.createElement('button');
  btn.className = 'rec-toggle'; btn.type = 'button'; btn.textContent = '● Record';
  btn.title = 'Record a labelled hand dataset (R)';

  const panel = document.createElement('section');
  panel.className = 'rec-panel'; panel.hidden = true;
  panel.innerHTML = `
    <header class="rec-head"><strong>Dataset recorder</strong><button class="rec-x" type="button" aria-label="Close">×</button></header>
    <label class="rec-field">Mudrā
      <select class="rec-label"></select>
    </label>
    <div class="rec-need"></div>
    <div class="rec-live" aria-live="polite"></div>
    <div class="rec-actions">
      <button class="rec-go" type="button">Record take <kbd>Space</kbd></button>
      <button class="rec-next" type="button" title="Jump to the next mudrā that still needs takes">Next needed ›</button>
    </div>
    <div class="rec-progress"></div>
    <div class="rec-tip">Hold the pose still, then vary it a little between takes: angle, distance, hand, lighting.
      Aim for ${take.goalTakes}+ takes per mudrā. Data stays in this browser until you export it.</div>
    <div class="rec-actions">
      <button class="rec-export" type="button">Export JSON</button>
      <button class="rec-clear" type="button">Clear all</button>
    </div>`;
  stage.append(btn, panel);

  const $ = (sel) => panel.querySelector(sel);
  const sel = $('.rec-label'), needEl = $('.rec-need'), liveEl = $('.rec-live');
  const goBtn = $('.rec-go'), progEl = $('.rec-progress');

  function need() { return labels.find(m => m.id === sel.value)?.hands ?? 1; }

  function fillSelect(keep) {
    sel.innerHTML = '';
    for (const c of categories) {
      const g = document.createElement('optgroup'); g.label = c.title;
      for (const m of labels.filter(x => x.category === c.id)) {
        const o = document.createElement('option'); o.value = m.id;
        const t = counts[m.id]?.takes || 0;
        o.textContent = `${t >= take.goalTakes ? '✓' : '·'} ${m.names.iast} — ${m.names.en}` +
                        `${m.hands === 2 ? ' (2 hands)' : ''}  [${t}]`;
        g.append(o);
      }
      if (g.children.length) sel.append(g);
    }
    if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
  }

  function refreshUI() {
    const m = labels.find(x => x.id === sel.value);
    needEl.textContent = m ? `Needs ${m.hands} hand${m.hands === 2 ? 's' : ''} in view — ${m.howto}` : '';
    const total = Object.values(counts).reduce((a, c) => a + c.samples, 0);
    const done = Object.values(counts).filter(c => c.done).length;
    progEl.textContent = `${done}/${labels.length} mudrās at ${take.goalTakes}+ takes · ${total} samples`;
    goBtn.disabled = state !== 'idle';
    const n = latest.hands.length, want = need();
    liveEl.textContent = state === 'idle'
      ? `${n} hand${n === 1 ? '' : 's'} detected${n === want ? ' ✓' : ` — need ${want}`}`
      : liveEl.textContent;
    liveEl.dataset.ok = n === want ? '1' : '0';
  }

  async function reload(keep) {
    counts = summarize(await dataset.getAll(), take.goalTakes);
    fillSelect(keep || sel.value);
    refreshUI();
  }

  // ---------- recording ----------
  async function recordTake() {
    if (state !== 'idle') return;
    const label = sel.value, wantHands = need();
    cancelled = false;

    state = 'countdown'; goBtn.disabled = true;
    for (let s = take.countdownSec; s > 0 && !cancelled; s--) {
      liveEl.textContent = `Get ready… ${s}`; liveEl.dataset.ok = '1';
      await sleep(1000);
    }
    if (cancelled) return finish('Cancelled.');

    state = 'recording';
    const kept = [], seen = new Set();
    let bad = 0;
    const t0 = performance.now();
    while (kept.length < take.frames && performance.now() - t0 < take.timeoutMs && !cancelled) {
      await sleep(take.intervalMs);
      if (seen.has(latest.frameId)) continue;           // no new video frame yet
      seen.add(latest.frameId);
      if (frameMatches(latest.hands, wantHands)) {
        kept.push({ hands: latest.hands, aspect: latest.aspect, video: { w: latest.w, h: latest.h } });
      } else bad++;
      liveEl.textContent = `Recording… ${kept.length}/${take.frames}`;
      liveEl.dataset.ok = latest.hands.length === wantHands ? '1' : '0';
    }
    if (cancelled) return finish('Cancelled.');
    if (kept.length < take.minValid) {
      return finish(`Discarded: only ${kept.length}/${take.frames} frames had exactly ${wantHands} hand${wantHands === 1 ? '' : 's'}. Try again.`);
    }

    state = 'saving';
    const all = await dataset.getAll();
    const takeId = all.reduce((m, s) => Math.max(m, s.take), 0) + 1;
    const ts = Date.now();
    await dataset.addSamples(kept.map((k, i) => ({
      label, nHands: wantHands, take: takeId, frame: i, session, ts,
      aspect: k.aspect, video: k.video, hands: k.hands,
    })));
    await reload(label);
    finish(`Saved take ${takeId}: ${kept.length} frames of ${label}` + (bad ? ` (${bad} skipped)` : '') + '.');
  }

  function finish(msg) {
    state = 'idle';
    notify(msg);
    refreshUI();
    liveEl.textContent = msg;               // keep the outcome visible after refresh
    liveEl.dataset.ok = '1';
  }

  function nextNeeded() {
    const order = labels.map(m => m.id);
    const i = order.indexOf(sel.value);
    for (let k = 1; k <= order.length; k++) {
      const id = order[(i + k) % order.length];
      if (!counts[id]?.done) { sel.value = id; refreshUI(); return; }
    }
    notify('Every mudrā has reached its take goal.');
  }

  async function exportJSON() {
    const samples = await dataset.getAll();
    if (!samples.length) return notify('Nothing recorded yet.');
    const blob = new Blob([JSON.stringify(buildDatasetJSON(samples))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mudra-dataset-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    notify(`Exported ${samples.length} samples.`);
  }

  async function clearAll() {
    if (!confirm('Delete every recorded sample from this browser? Export first if you want to keep them.')) return;
    await dataset.clear();
    await reload();
    notify('Dataset cleared.');
  }

  // ---------- wiring ----------
  function setOpen(v) {
    open = v; panel.hidden = !v; btn.classList.toggle('active', v);
    if (v) reload();
  }
  btn.addEventListener('click', () => setOpen(!open));
  $('.rec-x').addEventListener('click', () => setOpen(false));
  sel.addEventListener('change', refreshUI);
  goBtn.addEventListener('click', recordTake);
  $('.rec-next').addEventListener('click', nextNeeded);
  $('.rec-export').addEventListener('click', exportJSON);
  $('.rec-clear').addEventListener('click', clearAll);
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.view !== 'practice') return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') setOpen(!open);
    else if (e.key === ' ' && open && tag !== 'BUTTON') { e.preventDefault(); recordTake(); }
  });

  return {
    // Called by app.js for EVERY processed video frame (including no-hand frames).
    feed(results, aspect, video) {
      if (!open) return;                       // zero cost while the panel is closed
      latest = {
        frameId: latest.frameId + 1,
        hands: snapshotFrame(results),
        aspect: aspect || 1,
        w: video?.videoWidth || 0, h: video?.videoHeight || 0,
      };
      if (open && state === 'idle') refreshUI();
    },
    cancel() { cancelled = true; },
    isOpen: () => open,
    setOpen,
    // exposed for tests
    _state: () => ({ state, counts }),
    _recordTake: recordTake,
    _select: (id) => { sel.value = id; refreshUI(); },
    _reload: reload,
  };
}
