// store.js
// IndexedDB persistence for captured mudras. Photos are stored as Blobs
// (don't use localStorage — these are too big). Wrap everything in a small
// promise API.

const DB_NAME = 'mudravision';
const DB_VERSION = 1;
const STORE = 'mudras';

let _dbPromise = null;
function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('byCreatedAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function withStore(mode, fn) {
  return getDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let out;
    Promise.resolve(fn(store)).then(v => { out = v; });
    tx.oncomplete = () => res(out);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
}
function reqAsync(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

// ============================================================
// CRUD
// ============================================================
export async function saveMudra(record) {
  await withStore('readwrite', s => reqAsync(s.put(record)));
  return record;
}
export function getAllMudras() {
  return withStore('readonly', s => reqAsync(s.getAll()));
}
export function getMudra(id) {
  return withStore('readonly', s => reqAsync(s.get(id)));
}
export function deleteMudra(id) {
  return withStore('readwrite', s => reqAsync(s.delete(id)));
}

// ============================================================
// Factory
// ============================================================
export function newMudraRecord({ name, builtinUpgrade = null, displayName = null, meta = null }) {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) ||
        ('m' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)),
    name,
    displayName: displayName || name,
    is3D: true,
    builtinUpgrade,
    meta,                 // optional { sa, iast, en, usage } for brand-new mudras
    angles: [],
    createdAt: Date.now(),
  };
}

// ============================================================
// Export / import — for backup or transfer.
// JSON shape: same record but photos encoded as base64.
// ============================================================
async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  const u8 = new Uint8Array(buf);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(s);
}
function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type });
}

export async function exportMudra(id) {
  const m = await getMudra(id);
  if (!m) throw new Error('Mudra not found: ' + id);
  const angles = [];
  for (const a of m.angles) {
    angles.push({
      label: a.label,
      landmarks: a.landmarks,
      worldLandmarks: a.worldLandmarks,
      handedness: a.handedness,
      photoBase64: a.photo ? await blobToBase64(a.photo) : null,
      photoType: a.photo ? a.photo.type : 'image/jpeg',
    });
  }
  const json = JSON.stringify({ ...m, angles }, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function importMudra(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  data.angles = (data.angles || []).map(a => ({
    label: a.label,
    landmarks: a.landmarks,
    worldLandmarks: a.worldLandmarks,
    handedness: a.handedness,
    photo: a.photoBase64 ? base64ToBlob(a.photoBase64, a.photoType) : null,
  }));
  data.id = data.id || ('m' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));
  await saveMudra(data);
  return data;
}

// Convenience: download an exported blob as a JSON file.
export async function downloadMudraExport(id) {
  const blob = await exportMudra(id);
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `mudra-${id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
