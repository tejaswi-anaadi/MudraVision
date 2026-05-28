// art.js
// Returns mudra art in one of three flavours, picked by priority:
//
//   scanned (user's Capture front photo)  >  source (shipped image)  >  svg
//
// Built-in mudras may have any of the three. Captured mudras always have a
// scanned photo and may inherit a source image from their builtinUpgrade slug.

import { getSvg } from './svg.js';

// ============================================================
// Photo source registry
// ============================================================
const PHOTOS_JISHA = new Set([
  'alapadma', 'anjali', 'arala', 'ardhachandra', 'ardhapataka',
  'bhramara', 'chandrakala', 'chatura', 'garuda', 'hamsapaksha',
  'hamsasya', 'kangula', 'kapittha', 'kapota', 'karkata',
  'kartarimukha', 'katakamukha', 'mayura', 'mrigashirsha',
  'mukula', 'mushti', 'padmakosha', 'pataka', 'sarpasirsha',
  'shikhara', 'shukatunda', 'simhamukha', 'suchi', 'swastika',
  'tamrachuda', 'tripataka', 'trishula',
]);
const PHOTOS_WIKIMEDIA = new Set(['shivalinga', 'varaha']);
export const PHOTO_IDS = new Set([...PHOTOS_JISHA, ...PHOTOS_WIKIMEDIA]);

export function hasPhoto(slug) {
  return PHOTO_IDS.has(slug);
}

function photoSource(slug) {
  if (PHOTOS_JISHA.has(slug)) return 'jisha';
  if (PHOTOS_WIKIMEDIA.has(slug)) return 'wikimedia';
  return null;
}

// ============================================================
// Scanned-photo registry — captured mudras' front-angle blob URLs.
// Keyed by the built-in slug (for upgrades) AND the capture's own id.
// app.js calls setScannedFront() after each capture is saved or loaded
// from IndexedDB, so the renderer always knows the latest URL.
// ============================================================
const scannedFronts = new Map();   // key: builtin slug OR capture uuid → blobURL

export function setScannedFront(key, blobURL) {
  // Revoke any previous URL for that key to avoid leaks.
  const prev = scannedFronts.get(key);
  if (prev && prev !== blobURL) URL.revokeObjectURL(prev);
  scannedFronts.set(key, blobURL);
}
export function clearScannedFront(key) {
  const prev = scannedFronts.get(key);
  if (prev) URL.revokeObjectURL(prev);
  scannedFronts.delete(key);
}
export function getScannedFront(key) {
  return scannedFronts.get(key) || null;
}

// ============================================================
// Visual selection
// ============================================================
// view: { id, svgId?, builtinUpgrade?, captureId? }
//   svgId        — slug to feed getSvg(); falls back to a generic placeholder
//   builtinUpgrade — if set, source/svg may be inherited from that slug
//   captureId    — uuid; scanned URL keyed by this
export function getMudraVisuals(view) {
  const slug = view.svgId || view.builtinUpgrade || view.id;
  const sourceSlug = view.builtinUpgrade || slug;
  const scanned = (view.captureId && getScannedFront(view.captureId))
               || (view.builtinUpgrade && getScannedFront(view.builtinUpgrade))
               || (PHOTO_IDS.has(view.id) ? null : null)   // built-ins look up by their own slug below
               || getScannedFront(view.id);

  const source = hasPhoto(sourceSlug)
    ? { url: `images/${sourceSlug}.png`, kind: photoSource(sourceSlug) }
    : null;

  return {
    svg: { markup: getSvg(slug) || genericMudraSvg(view.displayName || view.name || 'Captured') },
    source,
    scanned,
  };
}

export function pickBaseVisual(view) {
  const v = getMudraVisuals(view);
  if (v.scanned) return { type: 'scanned', url: v.scanned };
  if (v.source)  return { type: 'source',  url: v.source.url, kind: v.source.kind };
  return { type: 'svg', markup: v.svg.markup };
}

export function getAvailableTypes(view) {
  const v = getMudraVisuals(view);
  const types = ['svg'];
  if (v.source) types.push('source');
  if (v.scanned) types.push('scanned');
  return types;
}

// ============================================================
// Rendering helpers — returns HTML string
// ============================================================
export function renderVisual(view, type) {
  const v = getMudraVisuals(view);
  switch (type) {
    case 'scanned':
      return v.scanned
        ? `<img class="mudra-photo mudra-scanned" src="${v.scanned}" alt="" decoding="async">`
        : renderVisual(view, 'svg');
    case 'source':
      return v.source
        ? `<img class="mudra-photo" src="${v.source.url}" alt="" loading="lazy" decoding="async" data-source="${v.source.kind}">`
        : renderVisual(view, 'svg');
    case 'svg':
    default:
      return `<div class="mudra-svg">${v.svg.markup}</div>`;
  }
}

// Default base-priority art for cards.
export function mudraArt(view) {
  const base = pickBaseVisual(view);
  switch (base.type) {
    case 'scanned': return `<img class="mudra-photo mudra-scanned" src="${base.url}" alt="" decoding="async">`;
    case 'source':  return `<img class="mudra-photo" src="${base.url}" alt="" loading="lazy" decoding="async" data-source="${base.kind}">`;
    case 'svg':     return `<div class="mudra-svg">${base.markup}</div>`;
  }
}

// SVG fallback wiring for source <img> elements that fail to load.
export function wireImageFallbacks(root = document) {
  root.querySelectorAll('img.mudra-photo:not(.mudra-scanned)').forEach(img => {
    img.addEventListener('error', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mudra-svg';
      wrap.innerHTML = genericMudraSvg('—');
      img.replaceWith(wrap);
    }, { once: true });
  });
}

// Generic placeholder for captures with no inherited SVG.
function genericMudraSvg(name) {
  const text = (name || '').slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" fill="none">
    <circle cx="100" cy="140" r="64" stroke="currentColor" stroke-width="3" stroke-dasharray="4 6" opacity="0.55"/>
    <circle cx="100" cy="140" r="46" stroke="currentColor" stroke-width="2" stroke-dasharray="2 4" opacity="0.35"/>
    <text x="100" y="146" text-anchor="middle" font-family="Manrope, sans-serif"
          font-size="13" font-weight="600" fill="currentColor" opacity="0.85"
          letter-spacing="0.06em">${escapeSvg(text)}</text>
  </svg>`;
}
function escapeSvg(s) {
  return String(s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ============================================================
// Build a view object for a built-in or captured mudra
// ============================================================
export function viewFromBuiltin(mudra) {
  return {
    kind: 'builtin',
    id: mudra.id,
    svgId: mudra.svg || mudra.id,
    builtinUpgrade: null,
    captureId: null,
    displayName: mudra.names.iast,
    names: mudra.names,
    usage: mudra.usage,
    howto: mudra.howto,
    hands: mudra.hands,
    reliable: mudra.reliable,
    category: mudra.category,
    is3D: false,
  };
}
export function viewFromCapture(rec) {
  return {
    kind: 'capture',
    id: rec.id,
    svgId: rec.builtinUpgrade || null,
    builtinUpgrade: rec.builtinUpgrade,
    captureId: rec.id,
    displayName: rec.displayName,
    name: rec.name,
    names: rec.meta || { sa: '', iast: rec.displayName, en: rec.name },
    usage: rec.meta?.usage || 'User-captured mudra.',
    howto: rec.meta?.howto || `${rec.angles.length} angles captured.`,
    hands: 1,
    reliable: true,
    category: rec.builtinUpgrade ? 'asamyukta' : 'captured',
    is3D: true,
    record: rec,
  };
}
