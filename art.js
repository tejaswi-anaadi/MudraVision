// art.js
// Returns mudra art, picked by priority:
//
//   source (a real photograph)  >  parts (the real photographs of the
//   component hastas)  >  placeholder
//
// Built-in mudras have a photograph ("source") or, for the deity/avatar
// gestures that are defined as a combination of hastas, "parts": the real
// photographs of each component hand, side by side.

import { MUDRA_BY_ID } from './mudras.js';

// ============================================================
// Photo source registry
// ============================================================
// Parchment plates: real photographs from the Jisha Raj R dataset, cut out of
// the green screen and set on parchment (tools/build_plates.py), stored as .jpg.
const PHOTOS_PLATES = new Set([
  'alapadma', 'anjali', 'arala', 'ardhachandra', 'ardhapataka', 'bhramara',
  'bherunda', 'chakra', 'chandrakala', 'chatura', 'garuda', 'hamsapaksha',
  'hamsasya', 'kangula', 'kapittha', 'kapota', 'karkata', 'kartariswastika',
  'kartarimukha', 'katakamukha', 'katakavardhana', 'khatva', 'kilaka', 'kurma',
  'matsya', 'mayura', 'mrigashirsha', 'mukula', 'mushti', 'nagabandha',
  'padmakosha', 'pasha', 'pataka', 'pushpaputa', 'samputa', 'sarpasirsha',
  'shakata', 'shankha', 'shikhara', 'shukatunda', 'simhamukha', 'suchi',
  'swastika', 'tamrachuda', 'tripataka', 'trishula',
]);
// Wikimedia Commons photographs (light backgrounds), shown as they are (.png).
const PHOTOS_WIKIMEDIA = new Set(['shivalinga', 'varaha']);
export const PHOTO_IDS = new Set([...PHOTOS_PLATES, ...PHOTOS_WIKIMEDIA]);

// Avatar gestures that the mudra database defines as identical to a
// two-hand hasta share that hasta's photograph.
const PHOTO_ALIAS = {
  matsyavatara: 'matsya',
  kurmavatara: 'kurma',
  varahavatara: 'varaha',
};
const resolvePhoto = (slug) => PHOTO_ALIAS[slug] || slug;

export function hasPhoto(slug) {
  return PHOTO_IDS.has(resolvePhoto(slug));
}

function photoSource(slug) {
  slug = resolvePhoto(slug);
  if (PHOTOS_PLATES.has(slug)) return 'paper';
  if (PHOTOS_WIKIMEDIA.has(slug)) return 'wikimedia';
  return null;
}

function photoUrl(slug) {
  slug = resolvePhoto(slug);
  return `images/${slug}.${PHOTOS_WIKIMEDIA.has(slug) ? 'png' : 'jpg'}`;
}

// ============================================================
// 3D-pose registry — slugs of mudras that ship with a poses/{slug}.json
// extracted from a real reference photo. app.js populates this on boot
// from the file's `poses_index.json` so the renderer can offer the 3D
// view as a toggle option without making a fetch for every mudra.
// ============================================================
const posesAvailable = new Set();
export function setAvailablePoses(slugs) {
  posesAvailable.clear();
  for (const s of slugs) posesAvailable.add(s);
}
export function hasPose(view) {
  // True if this mudra has a pose file.
  const slug = view.builtinUpgrade || view.id;
  return posesAvailable.has(slug);
}

// ============================================================
// Visual selection
// ============================================================
// view: { id, svgId?, builtinUpgrade? }
//   svgId        — slug of the built-in whose photo/parts to use
//   builtinUpgrade — if set, source/svg may be inherited from that slug
export function getMudraVisuals(view) {
  const slug = view.svgId || view.builtinUpgrade || view.id;
  const sourceSlug = view.builtinUpgrade || slug;

  const source = hasPhoto(sourceSlug)
    ? { url: photoUrl(sourceSlug), kind: photoSource(sourceSlug) }
    : null;

  // Deity/avatar gestures: the real photographs of the component hastas.
  const parts = (!source && Array.isArray(view.parts) && view.parts.length)
    ? view.parts.filter(p => hasPhoto(p.id)).map(p => ({
        hand: p.hand,
        id: p.id,
        url: photoUrl(p.id),
        kind: photoSource(p.id),
        label: MUDRA_BY_ID[p.id]?.names?.iast || p.id,
      }))
    : null;

  return {
    placeholder: { markup: genericMudraSvg(view.displayName || view.name || '') },
    source,
    parts: parts && parts.length ? parts : null,
  };
}

export function pickBaseVisual(view) {
  const v = getMudraVisuals(view);
  if (v.source)  return { type: 'source',  url: v.source.url, kind: v.source.kind };
  if (v.parts)   return { type: 'parts' };
  return { type: 'placeholder', markup: v.placeholder.markup };
}

export function getAvailableTypes(view) {
  const v = getMudraVisuals(view);
  const types = [];
  if (v.source) types.push('source');
  if (v.parts) types.push('parts');
  if (hasPose(view)) types.push('3d');
  if (!types.length) types.push('placeholder');
  return types;
}

// ============================================================
// Photo preloading — fill the browser cache after page boot so the
// Practice card can render instantly once a mudra is locked. Without
// this, lazy-loaded images fetched only when the <img> entered the DOM
// added a visible 200–500 ms hop over the network.
// ============================================================
let _preloadStarted = false;
export function preloadSourcePhotos() {
  if (_preloadStarted) return;
  _preloadStarted = true;
  for (const slug of PHOTO_IDS) {
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) img.fetchPriority = 'low';
    img.src = photoUrl(slug);
  }
}

// ============================================================
// Rendering helpers — returns HTML string.
// `opts.eager` forces immediate loading (no `loading="lazy"`) — used by
// the Practice card so the photo paints the instant the card appears.
// ============================================================
function partsHTML(parts, lazy) {
  // "Both hands" shows the same real photograph twice, the second mirrored.
  const items = [];
  for (const p of parts) {
    if (p.hand === 'Both') {
      items.push({ ...p, caption: `Both hands · ${p.label}`, mirror: false });
      items.push({ ...p, caption: '', mirror: true });
    } else {
      items.push({ ...p, caption: `${p.hand} · ${p.label}`, mirror: false });
    }
  }
  return `<div class="mudra-parts" data-count="${items.length}">` + items.map(it => `
    <figure>
      <img class="mudra-photo${it.mirror ? ' mirrored' : ''}" src="${it.url}" alt=""${lazy} decoding="async" data-source="${it.kind}">
      <figcaption>${it.caption || '&nbsp;'}</figcaption>
    </figure>`).join('') + `</div>`;
}

export function renderVisual(view, type, opts = {}) {
  const v = getMudraVisuals(view);
  const lazy = opts.eager ? '' : ' loading="lazy"';
  switch (type) {
    case 'source':
      return v.source
        ? `<img class="mudra-photo" src="${v.source.url}" alt=""${lazy} decoding="async" data-source="${v.source.kind}">`
        : renderVisual(view, 'placeholder', opts);
    case 'parts':
      return v.parts ? partsHTML(v.parts, lazy) : renderVisual(view, 'placeholder', opts);
    case 'placeholder':
    default:
      return `<div class="mudra-svg">${v.placeholder.markup}</div>`;
  }
}

// Default base-priority art for cards.
export function mudraArt(view, opts = {}) {
  return renderVisual(view, pickBaseVisual(view).type, opts);
}

// SVG fallback wiring for source <img> elements that fail to load.
export function wireImageFallbacks(root = document) {
  root.querySelectorAll('img.mudra-photo').forEach(img => {
    img.addEventListener('error', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mudra-svg';
      wrap.innerHTML = genericMudraSvg('—');
      img.replaceWith(wrap);
    }, { once: true });
  });
}

// Generic placeholder for a mudra with no photograph.
function genericMudraSvg(name) {
  const text = (name || '').slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" fill="none">
    <circle cx="100" cy="140" r="64" stroke="currentColor" stroke-width="3" stroke-dasharray="4 6" opacity="0.55"/>
    <circle cx="100" cy="140" r="46" stroke="currentColor" stroke-width="2" stroke-dasharray="2 4" opacity="0.35"/>
    <text x="100" y="146" text-anchor="middle" font-family="Mukta, sans-serif"
          font-size="13" font-weight="600" fill="currentColor" opacity="0.85"
          letter-spacing="0.06em">${escapeSvg(text)}</text>
  </svg>`;
}
function escapeSvg(s) {
  return String(s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ============================================================
// Build a view object for a built-in mudra
// ============================================================
export function viewFromBuiltin(mudra) {
  return {
    kind: 'builtin',
    id: mudra.id,
    svgId: mudra.svg || mudra.id,
    builtinUpgrade: null,
    displayName: mudra.names.iast,
    names: mudra.names,
    usage: mudra.usage,
    howto: mudra.howto,
    hands: mudra.hands,
    parts: mudra.parts || null,
    reliable: mudra.reliable,
    category: mudra.category,
    is3D: false,
  };
}
