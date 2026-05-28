// svg.js
// Stylized line-art SVGs for every mudra in the database. All SVGs share a
// common visual language: thick stroked fingers with rounded caps, a closed
// palm shape with a subtle fill, a thenar curve hinting the thumb's base
// muscle, and a faint wrist arc below. Stroke colour is `currentColor` so the
// CSS controls the neon hue. Two-hand mudras use a wider viewBox.
//
// Coordinate atlas (single-hand viewBox 200 × 280):
//   palm bottom y = 254, palm top y = 158
//   wrist arc    y = 268
//   MCPs:  index (78, 158)  middle (100, 156)  ring (122, 158)  pinky (144, 175)
//   thumb CMC (54, 198)
//   Extended-up tips: index (80, 44)  middle (100, 30)  ring (120, 44)  pinky (152, 82)
//   Thumb-up tip = (28, 100)

const PALM_BASE = `
  <path d="M84 274 Q100 280 116 274" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" opacity="0.22" fill="none"/>
  <path d="M70 268 Q100 274 130 268" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" opacity="0.5" fill="none"/>
  <path d="M58 178 Q54 220 76 254 L124 254 Q146 220 142 178 Q132 162 100 158 Q68 162 58 178 Z"
        stroke="currentColor" stroke-width="3" stroke-linejoin="round"
        fill="currentColor" fill-opacity="0.07"/>
  <path d="M58 200 Q48 222 70 248" stroke="currentColor" stroke-width="2.4"
        stroke-linecap="round" opacity="0.5" fill="none"/>
  <path d="M82 220 Q98 232 122 222" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" opacity="0.22" fill="none"/>
`;

// `hand(innerSvg)` wraps a single-hand mudra. `innerSvg` should contain finger
// strokes positioned within the same coordinate space. Fingertip dots can be
// drawn after the fingers via the same string.
function hand(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" fill="none">
    ${PALM_BASE}
    ${inner}
  </svg>`;
}

// Thick finger stroke template — used for nearly every finger path.
const STROKE = 'stroke="currentColor" stroke-width="8" stroke-linecap="round" fill="none"';
const STROKE_THIN = 'stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"';
const TIPDOT = (x, y, r = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" opacity="0.8"/>`;
const KNUCKLE = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="2.2" fill="currentColor" opacity="0.5"/>`;

// ============================================================
// Finger path library — common shapes used across multiple mudras.
// ============================================================
// Extended straight up.
const IDX_UP    = `<path d="M78 158 C75 122 79 80 80 44"  ${STROKE}/>${TIPDOT(80, 44)}`;
const MID_UP    = `<path d="M100 156 C98 118 101 72 100 30" ${STROKE}/>${TIPDOT(100, 30)}`;
const RNG_UP    = `<path d="M122 158 C124 122 121 80 120 44" ${STROKE}/>${TIPDOT(120, 44)}`;
const PKY_UP    = `<path d="M144 175 C148 144 150 112 152 82" ${STROKE}/>${TIPDOT(152, 82)}`;

// Half-bent forward (palm-out cup).
const IDX_HALF  = `<path d="M78 158 C70 130 80 110 96 96"  ${STROKE}/>${TIPDOT(96, 96)}`;
const MID_HALF  = `<path d="M100 156 C98 124 104 96 114 84" ${STROKE}/>${TIPDOT(114, 84)}`;
const RNG_HALF  = `<path d="M122 158 C126 128 124 102 128 90" ${STROKE}/>${TIPDOT(128, 90)}`;
const PKY_HALF  = `<path d="M144 175 C150 150 148 124 142 108" ${STROKE}/>${TIPDOT(142, 108)}`;

// Curled (folded into palm).
const IDX_CURL  = `<path d="M78 158 Q84 184 100 200" ${STROKE}/>${TIPDOT(100, 200, 3.5)}`;
const MID_CURL  = `<path d="M100 156 Q104 180 116 200" ${STROKE}/>${TIPDOT(116, 200, 3.5)}`;
const RNG_CURL  = `<path d="M122 158 Q118 184 108 204" ${STROKE}/>${TIPDOT(108, 204, 3.5)}`;
const PKY_CURL  = `<path d="M144 175 Q138 198 124 210" ${STROKE}/>${TIPDOT(124, 210, 3.5)}`;

// Thumb states.
const THM_ACROSS = `<path d="M54 198 C76 192 100 196 122 184" ${STROKE}/>${TIPDOT(122, 184)}`;
const THM_UP     = `<path d="M54 198 C42 162 32 130 28 96" ${STROKE}/>${TIPDOT(28, 96)}`;
const THM_WIDE   = `<path d="M54 198 C30 192 14 196 6 206" ${STROKE}/>${TIPDOT(6, 206)}`;
const THM_OVER   = `<path d="M54 198 C78 192 108 200 128 208" ${STROKE}/>${TIPDOT(128, 208)}`;
const THM_TUCK   = `<path d="M54 198 Q72 196 90 200" ${STROKE_THIN}/>${TIPDOT(90, 200, 3.5)}`;

// ============================================================
// Per-mudra SVGs
// ============================================================
const SVGS = {

  // ---------- Tier A (visually distinct, reliable) ----------
  pataka: hand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`),

  tripataka: hand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`),

  ardhapataka: hand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_CURL}${THM_ACROSS}`),

  kartarimukha: hand(`
    <path d="M78 158 C70 124 60 86 50 50" ${STROKE}/>${TIPDOT(50, 50)}
    <path d="M100 156 C110 122 122 84 132 48" ${STROKE}/>${TIPDOT(132, 48)}
    ${RNG_CURL}${PKY_CURL}${THM_TUCK}
  `),

  mayura: hand(`
    ${IDX_UP}${MID_UP}${PKY_UP}
    <path d="M122 158 C108 156 92 156 78 156" ${STROKE}/>
    <path d="M54 198 C60 184 66 168 78 156" ${STROKE}/>
    ${TIPDOT(78, 156, 5)}
  `),

  ardhachandra: hand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`),

  arala: hand(`
    <path d="M78 158 C66 124 64 88 86 70" ${STROKE}/>${TIPDOT(86, 70)}
    ${MID_UP}${RNG_UP}${PKY_UP}${THM_TUCK}
  `),

  shukatunda: hand(`
    <path d="M78 158 C70 132 80 110 96 96" ${STROKE}/>${TIPDOT(96, 96)}
    ${MID_UP}
    <path d="M122 158 C116 128 110 102 102 86" ${STROKE}/>${TIPDOT(102, 86)}
    ${PKY_UP}${THM_TUCK}
  `),

  mushti: hand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_OVER}`),

  shikhara: hand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_UP}`),

  kapittha: hand(`
    <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
    ${MID_CURL}${RNG_CURL}${PKY_CURL}
    <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
  `),

  katakamukha: hand(`
    <path d="M78 158 C68 156 64 152 66 150" ${STROKE}/>
    <path d="M100 156 C88 154 76 154 68 150" ${STROKE}/>
    ${RNG_CURL}${PKY_CURL}
    <path d="M54 198 C56 180 60 164 68 150" ${STROKE}/>
    ${TIPDOT(68, 150, 5)}
  `),

  suchi: hand(`${IDX_UP}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_TUCK}`),

  chandrakala: hand(`${IDX_UP}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_WIDE}`),

  padmakosha: hand(`
    <path d="M78 158 C66 130 56 100 56 80" ${STROKE}/>${TIPDOT(56, 80)}
    <path d="M100 156 C100 122 98 84 96 60" ${STROKE}/>${TIPDOT(96, 60)}
    <path d="M122 158 C132 130 142 100 144 80" ${STROKE}/>${TIPDOT(144, 80)}
    <path d="M144 175 C156 150 164 122 162 102" ${STROKE}/>${TIPDOT(162, 102)}
    <path d="M54 198 C42 174 32 154 30 134" ${STROKE}/>${TIPDOT(30, 134)}
  `),

  sarpasirsha: hand(`
    <path d="M78 158 C80 134 86 110 96 92" ${STROKE}/>${TIPDOT(96, 92)}
    <path d="M100 156 C100 128 104 102 108 84" ${STROKE}/>${TIPDOT(108, 84)}
    <path d="M122 158 C120 134 114 110 110 94" ${STROKE}/>${TIPDOT(110, 94)}
    <path d="M144 175 C140 150 130 124 118 106" ${STROKE}/>${TIPDOT(118, 106)}
    ${THM_TUCK}
  `),

  mrigashirsha: hand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`),

  simhamukha: hand(`
    ${IDX_UP}
    <path d="M100 156 C92 158 84 162 78 164" ${STROKE}/>
    <path d="M122 158 C110 162 96 164 80 164" ${STROKE}/>
    ${PKY_UP}
    <path d="M54 198 C60 186 70 174 80 164" ${STROKE}/>
    ${TIPDOT(80, 164, 5.5)}
  `),

  kangula: hand(`${IDX_HALF}${MID_HALF}${RNG_CURL}${PKY_UP}${THM_TUCK}`),

  alapadma: hand(`
    <path d="M78 158 C58 128 36 96 18 64" ${STROKE}/>${TIPDOT(18, 64)}
    <path d="M100 156 C90 116 80 70 76 32" ${STROKE}/>${TIPDOT(76, 32)}
    <path d="M122 158 C138 124 156 86 168 52" ${STROKE}/>${TIPDOT(168, 52)}
    <path d="M144 175 C166 148 184 118 192 92" ${STROKE}/>${TIPDOT(192, 92)}
    <path d="M54 198 C30 188 14 174 4 152" ${STROKE}/>${TIPDOT(4, 152)}
  `),

  chatura: hand(`
    <path d="M78 158 C70 134 64 116 56 100" ${STROKE}/>${TIPDOT(56, 100)}
    <path d="M100 156 C94 130 86 110 78 92" ${STROKE}/>${TIPDOT(78, 92)}
    <path d="M122 158 C118 130 112 108 106 90" ${STROKE}/>${TIPDOT(106, 90)}
    <path d="M144 175 C144 152 144 124 144 102" ${STROKE}/>${TIPDOT(144, 102)}
    <path d="M54 198 Q72 204 90 200" ${STROKE_THIN}/>${TIPDOT(90, 200, 3.5)}
  `),

  bhramara: hand(`
    <path d="M78 158 C68 174 56 188 50 200" ${STROKE}/>${TIPDOT(50, 200)}
    ${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}
  `),

  hamsasya: hand(`
    <path d="M78 158 C68 148 62 146 62 144" ${STROKE}/>
    ${MID_UP}${RNG_UP}${PKY_UP}
    <path d="M54 198 C50 178 54 160 62 144" ${STROKE}/>
    ${TIPDOT(62, 144, 5.5)}
  `),

  hamsapaksha: hand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_HALF}${THM_TUCK}`),

  samdamsha: hand(`
    <path d="M78 158 C76 130 76 100 80 80" ${STROKE}/>${TIPDOT(80, 80)}
    <path d="M100 156 C100 124 100 92 96 76" ${STROKE}/>${TIPDOT(96, 76)}
    <path d="M122 158 C124 130 122 100 114 82" ${STROKE}/>${TIPDOT(114, 82)}
    <path d="M144 175 C148 148 138 118 124 100" ${STROKE}/>${TIPDOT(124, 100)}
    <path d="M54 198 C58 172 70 144 86 116" ${STROKE}/>${TIPDOT(86, 116)}
  `),

  mukula: hand(`
    <path d="M78 158 C82 124 92 92 100 60" ${STROKE}/>
    <path d="M100 156 C100 122 100 90 100 60" ${STROKE}/>
    <path d="M122 158 C118 124 108 92 100 60" ${STROKE}/>
    <path d="M144 175 C130 138 112 96 100 60" ${STROKE}/>
    <path d="M54 198 C68 154 86 110 100 60" ${STROKE}/>
    <circle cx="100" cy="60" r="6.5" fill="currentColor" opacity="0.85"/>
  `),

  tamrachuda: hand(`
    <path d="M78 158 C72 124 78 90 90 60" ${STROKE}/>${TIPDOT(90, 58)}
    <path d="M100 156 C100 124 100 92 100 70" ${STROKE}/>
    <path d="M122 158 C118 124 108 94 100 70" ${STROKE}/>
    <path d="M144 175 C130 142 112 108 100 70" ${STROKE}/>
    <path d="M54 198 C68 156 86 114 100 70" ${STROKE}/>
    <circle cx="100" cy="70" r="5.5" fill="currentColor" opacity="0.8"/>
  `),

  trishula: hand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_CURL}${THM_TUCK}`),

  // ---------- Two-hand (Samyukta) ----------
  // Wider viewBox to fit both hands. We draw each hand inline using the
  // single-hand palm as a building block, then position with transforms.

  anjali: twoHand(`
    <g transform="translate(40 12) scale(0.8)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_TUCK}`)}</g>
    <g transform="translate(260 12) scale(-0.8 0.8)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_TUCK}`)}</g>
  `, 300),

  kapota: twoHand(`
    <g transform="translate(40 12) rotate(-10 100 200) scale(0.78)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_TUCK}`)}</g>
    <g transform="translate(260 12) rotate(10 100 200) scale(-0.78 0.78)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_TUCK}`)}</g>
    <path d="M150 240 L150 270" stroke="currentColor" stroke-width="2" opacity="0.4"/>
  `, 300),

  swastika: twoHand(`
    <g transform="translate(40 120) rotate(-32) scale(0.7)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(260 120) rotate(32) scale(-0.7 0.7)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 300),

  karkata: twoHand(`
    <!-- Two hands with fingers interlocking — abstract crossed-finger pattern -->
    <g transform="translate(40 50) scale(0.7)">
      ${innerPalmOnly()}
      <path d="M78 158 L160 80" ${STROKE}/>
      <path d="M100 156 L182 90" ${STROKE}/>
      <path d="M122 158 L200 102" ${STROKE}/>
      <path d="M144 175 L218 122" ${STROKE}/>
    </g>
    <g transform="translate(260 50) scale(-0.7 0.7)">
      ${innerPalmOnly()}
      <path d="M78 158 L160 80" ${STROKE}/>
      <path d="M100 156 L182 90" ${STROKE}/>
      <path d="M122 158 L200 102" ${STROKE}/>
      <path d="M144 175 L218 122" ${STROKE}/>
    </g>
  `, 300),

  garuda: twoHand(`
    <g transform="translate(20 60) rotate(-12) scale(0.7)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(280 60) rotate(12) scale(-0.7 0.7)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <path d="M148 160 Q150 178 152 196" stroke="currentColor" stroke-width="3" opacity="0.6" fill="none"/>
  `, 300),

  dola: twoHand(`
    <g transform="translate(10 30) scale(0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(300 30) scale(-0.72 0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 320),

  pushpaputa: twoHand(`
    <g transform="translate(36 24) rotate(-22 100 140) scale(0.78)">${innerHand(`
      <path d="M78 158 C82 130 92 110 104 96" ${STROKE}/>${TIPDOT(104, 96)}
      <path d="M100 156 C100 128 104 108 112 92" ${STROKE}/>${TIPDOT(112, 92)}
      <path d="M122 158 C124 130 122 108 120 96" ${STROKE}/>${TIPDOT(120, 96)}
      <path d="M144 175 C148 150 144 124 138 110" ${STROKE}/>${TIPDOT(138, 110)}
      ${THM_TUCK}
    `)}</g>
    <g transform="translate(264 24) rotate(22 100 140) scale(-0.78 0.78)">${innerHand(`
      <path d="M78 158 C82 130 92 110 104 96" ${STROKE}/>${TIPDOT(104, 96)}
      <path d="M100 156 C100 128 104 108 112 92" ${STROKE}/>${TIPDOT(112, 92)}
      <path d="M122 158 C124 130 122 108 120 96" ${STROKE}/>${TIPDOT(120, 96)}
      <path d="M144 175 C148 150 144 124 138 110" ${STROKE}/>${TIPDOT(138, 110)}
      ${THM_TUCK}
    `)}</g>
  `, 300),

  utsanga: twoHand(`
    <g transform="translate(30 30) rotate(-40 100 200) scale(0.72)">${innerHand(`
      <path d="M78 158 C66 128 64 92 86 70" ${STROKE}/>${TIPDOT(86, 70)}
      <path d="M100 156 C90 124 90 88 108 64" ${STROKE}/>${TIPDOT(108, 64)}
      <path d="M122 158 C116 124 116 90 132 70" ${STROKE}/>${TIPDOT(132, 70)}
      <path d="M144 175 C146 148 146 116 154 92" ${STROKE}/>${TIPDOT(154, 92)}
      ${THM_TUCK}
    `)}</g>
    <g transform="translate(270 30) rotate(40 100 200) scale(-0.72 0.72)">${innerHand(`
      <path d="M78 158 C66 128 64 92 86 70" ${STROKE}/>${TIPDOT(86, 70)}
      <path d="M100 156 C90 124 90 88 108 64" ${STROKE}/>${TIPDOT(108, 64)}
      <path d="M122 158 C116 124 116 90 132 70" ${STROKE}/>${TIPDOT(132, 70)}
      <path d="M144 175 C146 148 146 116 154 92" ${STROKE}/>${TIPDOT(154, 92)}
      ${THM_TUCK}
    `)}</g>
  `, 300),

  shivalinga: twoHand(`
    <!-- Left hand horizontal (Ardhachandra) cradling, right hand Shikhara on top -->
    <g transform="translate(20 120) rotate(20) scale(0.75)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(170 -30) scale(0.65)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_UP}`)}</g>
  `, 300),

  katakavardhana: twoHand(`
    <g transform="translate(40 30) rotate(-14) scale(0.74)">${innerHand(`
      <path d="M78 158 C68 156 64 152 66 150" ${STROKE}/>
      <path d="M100 156 C88 154 76 154 68 150" ${STROKE}/>
      ${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C56 180 60 164 68 150" ${STROKE}/>${TIPDOT(68, 150, 5)}
    `)}</g>
    <g transform="translate(260 30) rotate(14) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C68 156 64 152 66 150" ${STROKE}/>
      <path d="M100 156 C88 154 76 154 68 150" ${STROKE}/>
      ${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C56 180 60 164 68 150" ${STROKE}/>${TIPDOT(68, 150, 5)}
    `)}</g>
  `, 300),

  kartariswastika: twoHand(`
    <g transform="translate(40 90) rotate(-28) scale(0.7)">${innerHand(`
      <path d="M78 158 C70 124 60 86 50 50" ${STROKE}/>${TIPDOT(50, 50)}
      <path d="M100 156 C110 122 122 84 132 48" ${STROKE}/>${TIPDOT(132, 48)}
      ${RNG_CURL}${PKY_CURL}${THM_TUCK}
    `)}</g>
    <g transform="translate(260 90) rotate(28) scale(-0.7 0.7)">${innerHand(`
      <path d="M78 158 C70 124 60 86 50 50" ${STROKE}/>${TIPDOT(50, 50)}
      <path d="M100 156 C110 122 122 84 132 48" ${STROKE}/>${TIPDOT(132, 48)}
      ${RNG_CURL}${PKY_CURL}${THM_TUCK}
    `)}</g>
  `, 300),

  shakata: twoHand(`
    <g transform="translate(40 24) scale(0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_UP}`)}</g>
    <g transform="translate(258 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_UP}`)}</g>
  `, 300),

  shankha: twoHand(`
    <!-- Conch: left fist holding right thumb extended -->
    <g transform="translate(50 30) scale(0.78)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_OVER}`)}</g>
    <g transform="translate(150 0) scale(0.6)">
      <path d="M100 240 C100 200 100 160 100 90" ${STROKE}/>${TIPDOT(100, 88)}
    </g>
  `, 280),

  chakra: twoHand(`
    <!-- Disc: two hands palm-out, fingers spread radiating -->
    <circle cx="150" cy="140" r="58" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.5"/>
    <g transform="translate(20 40) rotate(-12) scale(0.65)">${innerHand(`
      ${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}
    `)}</g>
    <g transform="translate(280 40) rotate(12) scale(-0.65 0.65)">${innerHand(`
      ${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}
    `)}</g>
  `, 300),

  samputa: twoHand(`
    <!-- Casket: two Chatura hands cupped together -->
    <g transform="translate(30 30) rotate(-18 100 200) scale(0.72)">${innerHand(`
      ${IDX_HALF}${MID_HALF}${RNG_HALF}${PKY_HALF}${THM_TUCK}
    `)}</g>
    <g transform="translate(270 30) rotate(18 100 200) scale(-0.72 0.72)">${innerHand(`
      ${IDX_HALF}${MID_HALF}${RNG_HALF}${PKY_HALF}${THM_TUCK}
    `)}</g>
  `, 300),

  pasha: twoHand(`
    <!-- Noose: two index fingers linked -->
    <g transform="translate(30 30) scale(0.7)">${innerHand(`
      <path d="M78 158 C70 130 78 100 110 100" ${STROKE}/>
      ${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_TUCK}
    `)}</g>
    <g transform="translate(270 30) scale(-0.7 0.7)">${innerHand(`
      <path d="M78 158 C70 130 78 100 110 100" ${STROKE}/>
      ${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_TUCK}
    `)}</g>
    <circle cx="150" cy="125" r="8" stroke="currentColor" stroke-width="3" fill="none"/>
  `, 300),

  kilaka: twoHand(`
    <!-- Link: two Mrigashirsha pinkies interlocked -->
    <g transform="translate(30 30) scale(0.72)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}
      <path d="M144 175 C150 144 158 116 168 100" ${STROKE}/>
      ${THM_WIDE}
    `)}</g>
    <g transform="translate(270 30) scale(-0.72 0.72)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}
      <path d="M144 175 C150 144 158 116 168 100" ${STROKE}/>
      ${THM_WIDE}
    `)}</g>
    <circle cx="150" cy="100" r="6" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.7"/>
  `, 300),

  matsya: twoHand(`
    <!-- Fish: two Pataka palms together, thumbs out as fins -->
    <g transform="translate(30 70) rotate(-10) scale(0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(270 70) rotate(10) scale(-0.72 0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
  `, 300),

  kurma: twoHand(`
    <!-- Turtle: Mrigashirsha on top of inverted Mrigashirsha -->
    <g transform="translate(50 30) scale(0.7)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}
    `)}</g>
    <g transform="translate(150 220) scale(0.7 -0.7)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}
    `)}</g>
  `, 300),

  varaha: twoHand(`
    <!-- Boar: Mrigashirsha hands stacked, ring fingers interlocked -->
    <g transform="translate(40 24) scale(0.74)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}
    `)}</g>
    <g transform="translate(260 24) scale(-0.74 0.74)">${innerHand(`
      ${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}
    `)}</g>
  `, 300),

  nagabandha: twoHand(`
    <!-- Snake-bind: two Sarpasirsha hands crossed -->
    <g transform="translate(40 60) rotate(-26) scale(0.7)">${innerHand(`
      <path d="M78 158 C80 134 86 110 96 92" ${STROKE}/>${TIPDOT(96, 92)}
      <path d="M100 156 C100 128 104 102 108 84" ${STROKE}/>${TIPDOT(108, 84)}
      <path d="M122 158 C120 134 114 110 110 94" ${STROKE}/>${TIPDOT(110, 94)}
      <path d="M144 175 C140 150 130 124 118 106" ${STROKE}/>${TIPDOT(118, 106)}
      ${THM_TUCK}
    `)}</g>
    <g transform="translate(260 60) rotate(26) scale(-0.7 0.7)">${innerHand(`
      <path d="M78 158 C80 134 86 110 96 92" ${STROKE}/>${TIPDOT(96, 92)}
      <path d="M100 156 C100 128 104 102 108 84" ${STROKE}/>${TIPDOT(108, 84)}
      <path d="M122 158 C120 134 114 110 110 94" ${STROKE}/>${TIPDOT(110, 94)}
      <path d="M144 175 C140 150 130 124 118 106" ${STROKE}/>${TIPDOT(118, 106)}
      ${THM_TUCK}
    `)}</g>
  `, 300),

  khatva: twoHand(`
    <!-- Bed: two Chatura palms up parallel -->
    <g transform="translate(20 50) scale(0.7)">${innerHand(`
      <path d="M78 158 C72 134 64 116 56 100" ${STROKE}/>${TIPDOT(56, 100)}
      <path d="M100 156 C94 130 86 110 78 92" ${STROKE}/>${TIPDOT(78, 92)}
      <path d="M122 158 C118 130 112 108 106 90" ${STROKE}/>${TIPDOT(106, 90)}
      <path d="M144 175 C144 152 144 124 144 102" ${STROKE}/>${TIPDOT(144, 102)}
      ${THM_TUCK}
    `)}</g>
    <g transform="translate(280 50) scale(-0.7 0.7)">${innerHand(`
      <path d="M78 158 C72 134 64 116 56 100" ${STROKE}/>${TIPDOT(56, 100)}
      <path d="M100 156 C94 130 86 110 78 92" ${STROKE}/>${TIPDOT(78, 92)}
      <path d="M122 158 C118 130 112 108 106 90" ${STROKE}/>${TIPDOT(106, 90)}
      <path d="M144 175 C144 152 144 124 144 102" ${STROKE}/>${TIPDOT(144, 102)}
      ${THM_TUCK}
    `)}</g>
  `, 320),

  bherunda: twoHand(`
    <!-- Two-headed bird: two Kapittha hands joined back to back -->
    <g transform="translate(30 30) scale(0.72)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 4.5)}
    `)}</g>
    <g transform="translate(270 30) scale(-0.72 0.72)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 4.5)}
    `)}</g>
  `, 300),

  avahittha: twoHand(`
    <!-- Both Shukatunda hands turned downward to chest -->
    <g transform="translate(40 12) rotate(180 100 140) scale(0.74)">${innerHand(`
      <path d="M78 158 C70 132 80 110 96 96" ${STROKE}/>${TIPDOT(96, 96)}
      ${MID_UP}
      <path d="M122 158 C116 128 110 102 102 86" ${STROKE}/>${TIPDOT(102, 86)}
      ${PKY_UP}${THM_TUCK}
    `)}</g>
    <g transform="translate(260 12) rotate(180 100 140) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C70 132 80 110 96 96" ${STROKE}/>${TIPDOT(96, 96)}
      ${MID_UP}
      <path d="M122 158 C116 128 110 102 102 86" ${STROKE}/>${TIPDOT(102, 86)}
      ${PKY_UP}${THM_TUCK}
    `)}</g>
  `, 300),

  // ---------- Devata Hastas (deity gestures) ----------
  brahma: twoHand(`
    <!-- Left Chatura, right Hamsasya -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`
      <path d="M78 158 C72 134 64 116 56 100" ${STROKE}/>${TIPDOT(56, 100)}
      <path d="M100 156 C94 130 86 110 78 92" ${STROKE}/>${TIPDOT(78, 92)}
      <path d="M122 158 C118 130 112 108 106 90" ${STROKE}/>${TIPDOT(106, 90)}
      <path d="M144 175 C144 152 144 124 144 102" ${STROKE}/>${TIPDOT(144, 102)}
      ${THM_TUCK}
    `)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C68 148 62 146 62 144" ${STROKE}/>
      ${MID_UP}${RNG_UP}${PKY_UP}
      <path d="M54 198 C50 178 54 160 62 144" ${STROKE}/>${TIPDOT(62, 144, 5)}
    `)}</g>
  `, 300),

  vishnu: twoHand(`
    <!-- Both Tripataka -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 300),

  shiva: twoHand(`
    <!-- Left Mrigashirsha, right Tripataka -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 300),

  ganesha: twoHand(`
    <!-- Both Kapittha hands -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
    `)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
    `)}</g>
  `, 300),

  lakshmi: twoHand(`
    <!-- Both Kapittha (slight tilt up) -->
    <g transform="translate(30 24) rotate(-4) scale(0.74)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
    `)}</g>
    <g transform="translate(280 24) rotate(4) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
    `)}</g>
  `, 300),

  saraswati: twoHand(`
    <!-- Both Kataka-mukha -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`
      <path d="M78 158 C68 156 64 152 66 150" ${STROKE}/>
      <path d="M100 156 C88 154 76 154 68 150" ${STROKE}/>
      ${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C56 180 60 164 68 150" ${STROKE}/>${TIPDOT(68, 150, 5)}
    `)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`
      <path d="M78 158 C68 156 64 152 66 150" ${STROKE}/>
      <path d="M100 156 C88 154 76 154 68 150" ${STROKE}/>
      ${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C56 180 60 164 68 150" ${STROKE}/>${TIPDOT(68, 150, 5)}
    `)}</g>
  `, 300),

  durga: twoHand(`
    <!-- Tripataka left, Ardhachandra right -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
  `, 300),

  // ---------- Dasavatara Hastas (10 incarnations of Vishnu) ----------
  matsyavatara: twoHand(`
    <!-- Matsya: Pataka palms together, thumbs spread as fins -->
    <g transform="translate(30 70) rotate(-10) scale(0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(270 70) rotate(10) scale(-0.72 0.72)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
  `, 300),

  kurmavatara: twoHand(`
    <g transform="translate(50 30) scale(0.7)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(150 220) scale(0.7 -0.7)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
  `, 300),

  varahavatara: twoHand(`
    <g transform="translate(40 24) scale(0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(260 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
  `, 300),

  narasimha: twoHand(`
    <!-- Simhamukha left, Tripataka right -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`
      ${IDX_UP}
      <path d="M100 156 C92 158 84 162 78 164" ${STROKE}/>
      <path d="M122 158 C110 162 96 164 80 164" ${STROKE}/>
      ${PKY_UP}
      <path d="M54 198 C60 186 70 174 80 164" ${STROKE}/>${TIPDOT(80, 164, 5.5)}
    `)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 300),

  vamana: twoHand(`
    <!-- Mushti on chest -->
    <g transform="translate(70 24) scale(0.78)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_OVER}`)}</g>
    <g transform="translate(50 200) scale(0.6)">
      <rect x="40" y="0" width="120" height="60" stroke="currentColor" stroke-width="2.5" fill="none" rx="10" opacity="0.45"/>
    </g>
  `, 280),

  parashurama: twoHand(`
    <!-- Ardhachandra left, Mushti right (with axe suggestion) -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_OVER}`)}</g>
    <path d="M260 30 L260 90 L290 120" stroke="currentColor" stroke-width="3" fill="none" opacity="0.55"/>
  `, 320),

  rama: twoHand(`
    <!-- Right Shikhara, Left Kapittha -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`
      <path d="M78 158 C68 142 60 134 60 130" ${STROKE}/>${TIPDOT(60, 130)}
      ${MID_CURL}${RNG_CURL}${PKY_CURL}
      <path d="M54 198 C46 174 50 152 60 130" ${STROKE}/>${TIPDOT(60, 130, 5)}
    `)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_UP}`)}</g>
  `, 300),

  balarama: twoHand(`
    <!-- Pataka + Mushti -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_CURL}${THM_OVER}`)}</g>
  `, 300),

  krishna: twoHand(`
    <!-- Both Mrigashirsha (flute position) -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_CURL}${MID_CURL}${RNG_CURL}${PKY_UP}${THM_WIDE}`)}</g>
    <path d="M70 130 L240 130" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.55"/>
  `, 300),

  kalki: twoHand(`
    <!-- Tripataka + Pataka -->
    <g transform="translate(30 24) scale(0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_UP}${PKY_UP}${THM_ACROSS}`)}</g>
    <g transform="translate(280 24) scale(-0.74 0.74)">${innerHand(`${IDX_UP}${MID_UP}${RNG_CURL}${PKY_UP}${THM_ACROSS}`)}</g>
  `, 300),
};

// Helpers for two-hand SVGs.
function innerHand(inner) {
  return `${PALM_BASE}${inner}`;
}
function innerPalmOnly() {
  return PALM_BASE;
}
function twoHand(inner, width = 300) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 280" fill="none">${inner}</svg>`;
}

export function getSvg(id) {
  return SVGS[id] || hand('');
}
