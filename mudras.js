// mudras.js
// The mudra database. Every entry has names (Devanagari, IAST, English),
// usage (viniyoga), category (used by the Learn view to group cards), and an
// SVG id. Single-hand entries with `recognize:true` carry a constraint spec
// for the classifier. All others are card-only — they appear in the Learn
// view but are not detected from the camera.
//
// Categories:
//   asamyukta   — 28 single-hand hastas (Abhinaya Darpana)
//   samyukta    — 24 two-hand hastas
//   devata      — deity-naming gestures (typically combinations)
//   dasavatara  — the ten incarnations of Vishnu
//
// Constraint vocabulary lives at the top of classifier.js.

export const CATEGORIES = [
  { id: 'asamyukta',  title: 'Asamyukta Hastas',  subtitle: 'Single-hand gestures' },
  { id: 'samyukta',   title: 'Samyukta Hastas',   subtitle: 'Two-hand gestures' },
  { id: 'devata',     title: 'Devata Hastas',     subtitle: 'Gestures naming the deities' },
  { id: 'dasavatara', title: 'Daśāvatāra Hastas', subtitle: 'The ten incarnations of Viṣṇu' },
];

export const MUDRAS = [
  // ============================================================
  // ASAMYUKTA HASTAS — 28 single-hand gestures
  // ============================================================
  {
    id: 'pataka', category: 'asamyukta', svg: 'pataka',
    names: { sa: 'पताक', iast: 'Patāka', en: 'Flag' },
    howto: 'All four fingers straight and held together; thumb folded across the palm.',
    usage: 'Clouds, forest, denial, beginning of dance, river, night, sea, blessing.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['curled','half'], weight:0.7 },
      { type:'thumbIndexAngle', max:50, weight:0.5 },
      // Fingers reasonably together — allows natural finger gap. Tightened
      // separation is captured by Haṃsapakṣa's notTouch instead.
      { type:'spread', max:0.22, weight:0.4 },
    ],
  },
  {
    id: 'tripataka', category: 'asamyukta', svg: 'tripataka',
    names: { sa: 'त्रिपताक', iast: 'Tripatāka', en: 'Three parts of a flag' },
    howto: 'Like Patāka, but the ring finger is bent down.',
    usage: 'Crown, tree, vajra, arrow, the deity Indra, vermillion mark, lamp.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'curled',   weight:1.2 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['curled','half'], weight:0.5 },
    ],
  },
  {
    id: 'ardhapataka', category: 'asamyukta', svg: 'ardhapataka',
    names: { sa: 'अर्धपताक', iast: 'Ardhapatāka', en: 'Half flag' },
    howto: 'Tripatāka with the little finger also folded down.',
    usage: 'Tender leaves, a knife, banner, tower, riverbank, "two".',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'curled',   weight:1 },
      { type:'curl', finger:'pinky',  state:'curled',   weight:1 },
      { type:'curl', finger:'thumb',  state:['curled','half'], weight:0.5 },
    ],
  },
  {
    id: 'kartarimukha', category: 'asamyukta', svg: 'kartarimukha',
    names: { sa: 'कर्तरीमुख', iast: 'Kartarīmukha', en: 'Scissors-face' },
    howto: 'Index and middle fingers stretched up and spread apart in a "V"; ring and little folded with the thumb resting on them.',
    usage: 'Separation, opposition, lightning, the corner of the eye, a creeper, stealing.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'curled',   weight:1 },
      { type:'curl', finger:'pinky',  state:'curled',   weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.5 },
      { type:'notTouch', fingers:['index','middle'], threshold:0.32, weight:1 },
    ],
  },
  {
    id: 'mayura', category: 'asamyukta', svg: 'mayura',
    names: { sa: 'मयूर', iast: 'Mayūra', en: 'Peacock' },
    howto: 'Ring finger curves to meet the thumb tip; index, middle, and little are stretched.',
    usage: "Peacock's beak, wiping a tear, applying a tilak, a creeper, a forehead, a bird.",
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'touch',    fingers:['thumb','ring'],   threshold:0.30, weight:1.4 },
      { type:'notTouch', fingers:['thumb','middle'], threshold:0.28, weight:0.6 },
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1.2 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:['half','curled'], weight:0.6 },
    ],
  },
  {
    id: 'ardhachandra', category: 'asamyukta', svg: 'ardhachandra',
    names: { sa: 'अर्धचन्द्र', iast: 'Ardhacandra', en: 'Half-moon' },
    howto: 'All four fingers extended and held together; the thumb is stretched out wide, forming a crescent.',
    usage: 'Moon on the eighth day, contemplation, prayer, anxiety, the throat, a spear.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1.2 },
      { type:'thumbIndexAngle', min:55, weight:1.2 },
      { type:'spread', max:0.16, weight:0.5 },
    ],
  },
  {
    id: 'arala', category: 'asamyukta', svg: 'arala',
    names: { sa: 'अराल', iast: 'Arāla', en: 'Bent' },
    howto: 'Patāka with the index finger gently curved.',
    usage: 'Drinking poison or nectar, the wind.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'half', weight:1.2 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.5 },
    ],
  },
  {
    id: 'shukatunda', category: 'asamyukta', svg: 'shukatunda',
    names: { sa: 'शुकतुण्ड', iast: 'Śukatuṇḍa', en: "Parrot's beak" },
    howto: 'Arāla with the ring finger also bent.',
    usage: 'Shooting an arrow, hurling a spear, mystery, fierce remembrance.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'half', weight:1.2 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'half', weight:1.2 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.5 },
      // Distinguishes from Arāla (which has ring extended) and Kaṅgula
      // (which has ring fully curled, not half).
    ],
  },
  {
    id: 'mushti', category: 'asamyukta', svg: 'mushti',
    names: { sa: 'मुष्टि', iast: 'Muṣṭi', en: 'Fist' },
    howto: 'All four fingers folded into the palm; the thumb is placed over them.',
    usage: 'Wrestling, holding a mace, grasping hair, steadiness, fighting.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'curled', weight:1 },
      { type:'curl', finger:'middle', state:'curled', weight:1 },
      { type:'curl', finger:'ring',   state:'curled', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1 },
      // Thumb wrapped over the fist — not pulled away from the palm.
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:1 },
    ],
  },
  {
    id: 'shikhara', category: 'asamyukta', svg: 'shikhara',
    names: { sa: 'शिखर', iast: 'Śikhara', en: 'Peak / spire' },
    howto: 'A fist with the thumb raised straight up.',
    usage: 'Bow, pillar, silence, husband, the god Cupid, tooth, embrace.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'curled', weight:1 },
      { type:'curl', finger:'middle', state:'curled', weight:1 },
      { type:'curl', finger:'ring',   state:'curled', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1.2 },
      // Thumb stands clear of the index — distinguishes from Kapittha
      // (where the index curls over the thumb tip).
      { type:'notTouch', fingers:['thumb','index'], threshold:0.40, weight:1.0 },
    ],
  },
  {
    id: 'kapittha', category: 'asamyukta', svg: 'kapittha',
    names: { sa: 'कपित्थ', iast: 'Kapittha', en: 'Wood-apple' },
    howto: 'Śikhara with the index finger bent over the thumb tip.',
    usage: 'Lakṣmī, Sarasvatī, holding cymbals, milking the cow, holding the veil.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      // The thumb-index meeting is the defining feature. We do NOT pin the
      // index curl state — whether the index is half-bent or fully curled,
      // what matters is that its tip arrives at the thumb tip.
      { type:'touch', fingers:['thumb','index'], threshold:0.45, weight:2.2 },
      { type:'curl', finger:'middle', state:'curled', weight:1 },
      { type:'curl', finger:'ring',   state:'curled', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1 },
      // Thumb is held out (still effectively a Śikhara base).
      { type:'curl', finger:'thumb',  state:['extended','half'], weight:0.8 },
    ],
  },
  {
    id: 'katakamukha', category: 'asamyukta', svg: 'katakamukha',
    names: { sa: 'कटकामुख', iast: 'Kaṭakāmukha', en: 'Bracelet / link-opening' },
    howto: 'Index and middle finger tips meet the thumb tip; ring and little are curled.',
    usage: 'Plucking flowers, holding a necklace, holding an arrow, drawing a bow.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'touch', fingers:['thumb','index'],  threshold:0.28, weight:1.1 },
      { type:'touch', fingers:['thumb','middle'], threshold:0.30, weight:1.1 },
      { type:'curl', finger:'ring',  state:['half','curled'], weight:0.7 },
      { type:'curl', finger:'pinky', state:['half','curled'], weight:0.7 },
    ],
  },
  {
    id: 'suchi', category: 'asamyukta', svg: 'suchi',
    names: { sa: 'सूचि', iast: 'Sūci', en: 'Needle' },
    howto: 'Only the index finger is stretched out; all other fingers are curled.',
    usage: 'One, the Supreme being, the sun, a city, "I", threatening, awakening.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      // Pure intrinsic geometry — recognised regardless of which way the
      // hand points.
      { type:'curl', finger:'index',  state:'extended', weight:1.4 },
      { type:'curl', finger:'middle', state:'curled', weight:1 },
      { type:'curl', finger:'ring',   state:'curled', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.7 },
      // The index DOES NOT touch the thumb — distinguishes from Kapittha
      // (where the index curls back to the thumb).
      { type:'notTouch', fingers:['thumb','index'], threshold:0.40, weight:0.7 },
    ],
  },
  {
    id: 'chandrakala', category: 'asamyukta', svg: 'chandrakala',
    names: { sa: 'चन्द्रकला', iast: 'Candrakalā', en: 'Digit of the moon' },
    howto: 'Sūci with the thumb also extended (the index and thumb form an "L").',
    usage: "Crescent moon, face, Gaṅgā, Śiva's matted lock, the digit on Śiva's brow.",
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'curled', weight:1 },
      { type:'curl', finger:'ring',   state:'curled', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1.2 },
      { type:'thumbIndexAngle', min:55, weight:0.8 },
    ],
  },
  {
    id: 'padmakosha', category: 'asamyukta', svg: 'padmakosha',
    names: { sa: 'पद्मकोश', iast: 'Padmakośa', en: 'Lotus bud' },
    howto: 'All five fingers spread and slightly bent like a cup; tips do not meet.',
    usage: 'Lotus bud, fruit, breast, ball, anthill, offering, a flower offered to a deity.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'half', weight:1 },
      { type:'curl', finger:'middle', state:'half', weight:1 },
      { type:'curl', finger:'ring',   state:'half', weight:1 },
      { type:'curl', finger:'pinky',  state:'half', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','extended'], weight:0.5 },
      { type:'spread', min:0.16, weight:0.7 },
      { type:'notTouch', fingers:['index','middle'], threshold:0.18, weight:0.4 },
    ],
  },
  {
    id: 'sarpasirsha', category: 'asamyukta', svg: 'sarpasirsha',
    names: { sa: 'सर्पशीर्ष', iast: 'Sarpaśīrṣa', en: 'Snake hood' },
    howto: 'All fingers held together and bent like a hollow bowl.',
    usage: "Serpent, sandal-paste, sprinkling water, elephant's ear, slow-moving.",
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'half', weight:1 },
      { type:'curl', finger:'middle', state:'half', weight:1 },
      { type:'curl', finger:'ring',   state:'half', weight:1 },
      { type:'curl', finger:'pinky',  state:'half', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.6 },
      { type:'spread', max:0.13, weight:1 },
    ],
  },
  {
    id: 'mrigashirsha', category: 'asamyukta', svg: 'mrigashirsha',
    names: { sa: 'मृगशीर्ष', iast: 'Mṛgaśīrṣa', en: 'Deer head' },
    howto: 'Like Sarpaśīrṣa, but thumb and little finger are raised, the three middle fingers bent.',
    usage: "Deer face, woman's cheek, summoning, calling, the wheel, three together.",
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:['curled','half'], weight:1 },
      { type:'curl', finger:'middle', state:['curled','half'], weight:1 },
      { type:'curl', finger:'ring',   state:['curled','half'], weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1.2 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1.2 },
    ],
  },
  {
    id: 'simhamukha', category: 'asamyukta', svg: 'simhamukha',
    names: { sa: 'सिंहमुख', iast: 'Siṃhamukha', en: 'Lion face' },
    howto: 'Middle and ring finger tips meet the thumb tip; index and little are extended.',
    usage: 'Lion, elephant, hare, garland, medicine, the lotus pollen, the pearl.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'touch', fingers:['thumb','middle'], threshold:0.30, weight:1.1 },
      { type:'touch', fingers:['thumb','ring'],   threshold:0.30, weight:1.1 },
      { type:'curl', finger:'middle', state:['half','curled'], weight:0.9 },
      { type:'curl', finger:'ring',   state:['half','curled'], weight:0.9 },
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
    ],
  },
  {
    id: 'kangula', category: 'asamyukta', svg: 'kangula',
    names: { sa: 'कङ्गुल', iast: 'Kaṅgula', en: 'Bell' },
    howto: 'Little finger raised straight, ring finger curled; index and middle gently bent.',
    usage: 'Small fruit, areca nut, a small bell, breast of a young girl.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:['half','curled'], weight:0.8 },
      { type:'curl', finger:'middle', state:['half','curled'], weight:0.8 },
      { type:'curl', finger:'ring',   state:'curled', weight:1.2 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1.2 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.8 },
    ],
  },
  {
    id: 'alapadma', category: 'asamyukta', svg: 'alapadma',
    names: { sa: 'अलपद्म', iast: 'Alapadma', en: 'Full-bloomed lotus' },
    howto: 'All five fingers spread wide and fanned out in a circle, slightly curved.',
    usage: 'Full-bloomed lotus, fruit-laden tree, mirror, the full moon, beauty, longing, village.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:['extended','half'], weight:1 },
      { type:'curl', finger:'middle', state:['extended','half'], weight:1 },
      { type:'curl', finger:'ring',   state:['extended','half'], weight:1 },
      { type:'curl', finger:'pinky',  state:['extended','half'], weight:1 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1 },
      { type:'spread', min:0.24, weight:1.3 },
      { type:'thumbIndexAngle', min:45, weight:0.6 },
    ],
  },
  {
    id: 'chatura', category: 'asamyukta', svg: 'chatura',
    names: { sa: 'चतुर', iast: 'Catura', en: 'Clever / four' },
    howto: 'Four fingers extended horizontally and together; thumb tucked at the base of the index, palm facing down.',
    usage: 'Small quantity, gold, eye, musk, difference, cunning, intellect, refinement.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      // Distinguishing feature: thumb is TUCKED at the index base (not
      // crossed all the way over the palm as in Pataka).
      { type:'curl', finger:'thumb',  state:'half', weight:1.1 },
      // Four fingers held together (small spread).
      { type:'spread', max:0.13, weight:0.6 },
      // Thumb is close to the index MCP — distinguishes Catura's
      // "tucked" thumb from Pataka's "across the palm" thumb.
      { type:'thumbIndexAngle', max:35, weight:0.7 },
    ],
  },
  {
    id: 'bhramara', category: 'asamyukta', svg: 'bhramara',
    names: { sa: 'भ्रमर', iast: 'Bhramara', en: 'Bee' },
    howto: 'Index finger bent to touch the thumb base; middle extended outward; ring, little, and thumb extended.',
    usage: 'Bee, parrot, crane, union of lovers, plucking a flower with stem.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:['half','curled'], weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:'extended', weight:1 },
      { type:'thumbIndexAngle', min:45, weight:0.5 },
    ],
  },
  {
    id: 'hamsasya', category: 'asamyukta', svg: 'hamsasya',
    names: { sa: 'हंसास्य', iast: 'Haṃsāsya', en: 'Swan beak' },
    howto: 'Thumb and index finger tips touch (the "OK" pinch); other three fingers extended.',
    usage: 'Blessing, holding a pearl, jasmine, certainty, the subtle, instruction.',
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'touch', fingers:['thumb','index'], threshold:0.22, weight:1.4 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:['extended','half'], weight:0.8 },
    ],
  },
  {
    id: 'hamsapaksha', category: 'asamyukta', svg: 'hamsapaksha',
    names: { sa: 'हंसपक्ष', iast: 'Haṃsapakṣa', en: 'Swan feather' },
    howto: 'Three fingers (index, middle, ring) extended together; little finger raised separately; thumb gently bent.',
    usage: 'The number six, building a bridge, marking, completing, a heap.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','curled'], weight:0.5 },
      // Distinguishing feature: pinky is held DEFINITELY apart from ring
      // (the "feather" — the little finger held separately, NOT just the
      // natural finger gap). The threshold is well above the natural
      // gap of fingers-held-together (~0.20) so this only fires for a
      // clearly raised little finger.
      { type:'notTouch', fingers:['ring','pinky'], threshold:0.38, weight:1.2 },
    ],
  },
  {
    id: 'samdamsha', category: 'asamyukta', svg: 'samdamsha',
    names: { sa: 'संदंश', iast: 'Saṃdaṃśa', en: 'Pincers' },
    howto: 'Padmakośa held with the thumb close to the other four fingertips (pinching pose). Classically the fingers open and close — we recognise the closed pinch shape.',
    usage: 'Sacrifice, a worm, fear, generosity, plucking thorns, doubt.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      // Same cup shape as Padmakośa but the thumb has come in close to
      // the index/middle tips (pinching position).
      { type:'curl', finger:'index',  state:'half', weight:1 },
      { type:'curl', finger:'middle', state:'half', weight:1 },
      { type:'curl', finger:'ring',   state:'half', weight:1 },
      { type:'curl', finger:'pinky',  state:'half', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','extended'], weight:0.7 },
      // Pinch markers: thumb tip close to index/middle tips.
      { type:'touch', fingers:['thumb','index'],  threshold:0.32, weight:1 },
      { type:'touch', fingers:['thumb','middle'], threshold:0.36, weight:0.6 },
    ],
  },
  {
    id: 'mukula', category: 'asamyukta', svg: 'mukula',
    names: { sa: 'मुकुल', iast: 'Mukula', en: 'Flower bud' },
    howto: 'All five fingertips drawn together to a single point.',
    usage: "Water lily, eating, the seal, navel, plantain flower, Cupid's arrow, offering.",
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'clustered', weight:1.6 },
      { type:'curl', finger:'index',  state:['half','curled'], weight:0.7 },
      { type:'curl', finger:'middle', state:['half','curled'], weight:0.7 },
      { type:'curl', finger:'ring',   state:['half','curled'], weight:0.7 },
      { type:'curl', finger:'pinky',  state:['half','curled'], weight:0.7 },
    ],
  },
  {
    id: 'tamrachuda', category: 'asamyukta', svg: 'tamrachuda',
    names: { sa: 'ताम्रचूड', iast: 'Tāmracūḍa', en: 'Rooster' },
    howto: 'Like Mukula but the index finger is slightly extended away from the cluster — a four-finger meeting with the index pointing.',
    usage: 'Cock, crane, camel, calf, sparrow, indicating speed.',
    hands: 1, recognize: true, reliable: false,
    constraints: [
      // Thumb, middle, ring, pinky cluster at a point — index stays free.
      { type:'touch', fingers:['thumb','middle'], threshold:0.28, weight:1 },
      { type:'touch', fingers:['thumb','ring'],   threshold:0.30, weight:1 },
      { type:'touch', fingers:['thumb','pinky'],  threshold:0.34, weight:0.7 },
      // Index is held away — half-bent or extended, but NOT at the cluster.
      { type:'curl', finger:'index', state:['half','extended'], weight:0.9 },
      { type:'notTouch', fingers:['thumb','index'], threshold:0.30, weight:0.9 },
      // Other three fingers are bent (in the cluster).
      { type:'curl', finger:'middle', state:['half','curled'], weight:0.6 },
      { type:'curl', finger:'ring',   state:['half','curled'], weight:0.6 },
      { type:'curl', finger:'pinky',  state:['half','curled'], weight:0.6 },
    ],
  },
  {
    id: 'trishula', category: 'asamyukta', svg: 'trishula',
    names: { sa: 'त्रिशूल', iast: 'Triśūla', en: 'Trident' },
    howto: 'Index, middle and ring fingers extended; little finger curled; thumb tucked.',
    usage: "The trident, the number three, the three worlds, Śiva's weapon.",
    hands: 1, recognize: true, reliable: true,
    constraints: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'curled', weight:1.2 },
      { type:'curl', finger:'thumb',  state:['curled','half'], weight:0.7 },
    ],
  },

  // ============================================================
  // SAMYUKTA HASTAS — 24 two-hand gestures
  // ============================================================
  {
    id: 'anjali', category: 'samyukta', svg: 'anjali',
    names: { sa: 'अञ्जलि', iast: 'Añjali', en: 'Salutation' },
    howto: 'Both hands joined palm-to-palm in front of the chest, fingers pointing upward (Patāka × 2).',
    usage: 'Greeting a deity, a teacher, or an elder; reverence.',
    hands: 2, recognize: true, reliable: true,
    perHand: [
      { type:'curl', finger:'index',  state:'extended', weight:1 },
      { type:'curl', finger:'middle', state:'extended', weight:1 },
      { type:'curl', finger:'ring',   state:'extended', weight:1 },
      { type:'curl', finger:'pinky',  state:'extended', weight:1 },
      { type:'curl', finger:'thumb',  state:['half','extended','curled'], weight:0.5 },
      { type:'direction', finger:'middle', dir:'up', weight:0.7 },
    ],
    twoHand: [
      { type:'wristsClose', threshold:0.9, weight:1.2 },
      { type:'bothPointUp', weight:1 },
    ],
  },
  {
    id: 'kapota', category: 'samyukta', svg: 'kapota',
    names: { sa: 'कपोत', iast: 'Kapota', en: 'Dove' },
    howto: 'Two Patāka hands joined at the base of the palms, opening at the fingertips.',
    usage: 'Reverent address, fear, conversing with an elder, the dove.',
    hands: 2, recognize: true, reliable: false,
    components: ['pataka', 'pataka'],
    twoHand: [
      { type:'wristsClose', threshold:0.7, weight:1 },
      { type:'bothPointUp', weight:0.7 },
    ],
  },
  {
    id: 'karkata', category: 'samyukta', svg: 'karkata',
    names: { sa: 'कर्कट', iast: 'Karkaṭa', en: 'Crab' },
    howto: 'Fingers of both hands interlocked.',
    usage: 'A group, bending a branch, the crab, blowing the conch.',
    hands: 2, recognize: true, reliable: false,
    twoHand: [
      { type:'fingertipsInterspersed', weight:1.8 },
      { type:'wristsClose', threshold:0.8, weight:0.5 },
    ],
  },
  {
    id: 'swastika', category: 'samyukta', svg: 'swastika',
    names: { sa: 'स्वस्तिक', iast: 'Svastika', en: 'Crossed' },
    howto: 'Two Patāka hands crossed at the wrists.',
    usage: 'Directions, cloud, sky, seasons, contradiction.',
    hands: 2, recognize: true, reliable: false,
    components: ['pataka', 'pataka'],
    twoHand: [
      { type:'handsCrossed', weight:1.6 },
    ],
  },
  {
    id: 'dola', category: 'samyukta', svg: 'dola',
    names: { sa: 'दोल', iast: 'Dola', en: 'Swing' },
    howto: 'Both Patāka hands hanging down loosely at the sides.',
    usage: 'Beginning a dance, indecision, sorrow, swinging, casualness.',
    hands: 2, recognize: true, reliable: false,
    components: ['pataka', 'pataka'],
    twoHand: [
      { type:'handsSideBySide', weight:1.2 },
    ],
  },
  {
    id: 'pushpaputa', category: 'samyukta', svg: 'pushpaputa',
    names: { sa: 'पुष्पपुट', iast: 'Puṣpapuṭa', en: 'Casket of flowers' },
    howto: 'Both Sarpaśīrṣa hands joined along the little-finger sides, palms cupped upward.',
    usage: 'Receiving or offering flowers, water, offerings to a deity.',
    hands: 2, recognize: true, reliable: false,
    components: ['sarpasirsha', 'sarpasirsha'],
    twoHand: [
      { type:'pinkySidesTouching', weight:1.6 },
      { type:'palmsUpward', weight:1 },
    ],
  },
  {
    id: 'utsanga', category: 'samyukta', svg: 'utsanga',
    names: { sa: 'उत्सङ्ग', iast: 'Utsaṅga', en: 'Embrace' },
    howto: 'Both Arāla hands crossed at the wrists in front of the chest, palms inward.',
    usage: 'Embrace, modesty, hugging a child, feeling of love.',
    hands: 2, recognize: true, reliable: false,
    components: ['arala', 'arala'],
    twoHand: [
      { type:'handsCrossed', weight:1.5 },
    ],
  },
  {
    id: 'shivalinga', category: 'samyukta', svg: 'shivalinga',
    names: { sa: 'शिवलिङ्ग', iast: 'Śivaliṅga', en: "Śiva's emblem" },
    howto: 'Left hand in Ardhacandra held horizontally; right hand in Śikhara placed upright on the left palm.',
    usage: "Śiva's emblem, sanctuary, the divine consciousness.",
    hands: 2, recognize: true, reliable: true,
    components: ['ardhachandra', 'shikhara'],
    twoHand: [
      { type:'handsStacked', weight:1.5 },
    ],
  },
  {
    id: 'katakavardhana', category: 'samyukta', svg: 'katakavardhana',
    names: { sa: 'कटकवर्धन', iast: 'Kaṭakavardhana', en: 'Extension of a link' },
    howto: 'Both Kaṭakāmukha hands with wrists crossed.',
    usage: 'Coronation, marriage, romantic union, embrace.',
    hands: 2, recognize: true, reliable: false,
    components: ['katakamukha', 'katakamukha'],
    twoHand: [
      { type:'handsCrossed', weight:1.4 },
    ],
  },
  {
    id: 'kartariswastika', category: 'samyukta', svg: 'kartariswastika',
    names: { sa: 'कर्तरीस्वस्तिक', iast: 'Kartarīsvastika', en: 'Crossed scissors' },
    howto: 'Both Kartarīmukha hands crossed at the wrists.',
    usage: 'Tree-tops, hills, mountain peaks.',
    hands: 2, recognize: true, reliable: false,
    components: ['kartarimukha', 'kartarimukha'],
    twoHand: [
      { type:'handsCrossed', weight:1.4 },
    ],
  },
  {
    id: 'shakata', category: 'samyukta', svg: 'shakata',
    names: { sa: 'शकट', iast: 'Śakaṭa', en: 'Cart' },
    howto: 'Both Bhramara hands joined with thumbs touching; palms forward.',
    usage: 'A cart, a chariot, the demon Śakaṭāsura.',
    hands: 2, recognize: true, reliable: false,
    components: ['bhramara', 'bhramara'],
    twoHand: [
      { type:'thumbsHooked', weight:1.5 },
      { type:'palmsTowardCamera', weight:0.6 },
    ],
  },
  {
    id: 'shankha', category: 'samyukta', svg: 'shankha',
    names: { sa: 'शङ्ख', iast: 'Śaṅkha', en: 'Conch' },
    howto: 'Left thumb erect inside the right fist; right thumb touches the left index.',
    usage: "The conch shell, especially Viṣṇu's pāñcajanya.",
    hands: 2, recognize: true, reliable: false,
    components: ['mushti', 'shikhara'],
    twoHand: [
      { type:'wristsClose', threshold:0.6, weight:1.2 },
    ],
  },
  {
    id: 'chakra', category: 'samyukta', svg: 'chakra',
    names: { sa: 'चक्र', iast: 'Cakra', en: 'Discus' },
    howto: 'Both Ardhacandra hands crossed at the wrists with palms facing outward — a disc shape.',
    usage: "Viṣṇu's discus, a wheel, the cycle of time.",
    hands: 2, recognize: true, reliable: false,
    components: ['ardhachandra', 'ardhachandra'],
    twoHand: [
      { type:'handsCrossed', weight:1.2 },
      { type:'palmsTowardCamera', weight:0.6 },
    ],
  },
  {
    id: 'samputa', category: 'samyukta', svg: 'samputa',
    names: { sa: 'सम्पुट', iast: 'Sampuṭa', en: 'Casket' },
    howto: 'Both Catura hands cupped together as if closing a small box.',
    usage: 'A casket, a treasure box, hiding something within.',
    hands: 2, recognize: true, reliable: false,
    components: ['chatura', 'chatura'],
    twoHand: [
      { type:'wristsClose', threshold:0.6, weight:1.2 },
      { type:'palmsTowardEachOther', weight:0.8 },
    ],
  },
  {
    id: 'pasha', category: 'samyukta', svg: 'pasha',
    names: { sa: 'पाश', iast: 'Pāśa', en: 'Noose' },
    howto: 'Both index fingers linked at the second joint.',
    usage: 'A noose, opposition, fight, a chain, mutual attachment.',
    hands: 2, recognize: true, reliable: false,
    components: ['suchi', 'suchi'],
    twoHand: [
      { type:'indexFingersLinked', weight:1.8 },
    ],
  },
  {
    id: 'kilaka', category: 'samyukta', svg: 'kilaka',
    names: { sa: 'कीलक', iast: 'Kīlaka', en: 'Link' },
    howto: 'Two Mṛgaśīrṣa hands with the little fingers linked together.',
    usage: 'Loving conversation, affection, ease, intimate friendship.',
    hands: 2, recognize: true, reliable: false,
    components: ['mrigashirsha', 'mrigashirsha'],
    twoHand: [
      { type:'pinkySidesTouching', weight:1.6 },
    ],
  },
  {
    id: 'matsya', category: 'samyukta', svg: 'matsya',
    names: { sa: 'मत्स्य', iast: 'Matsya', en: 'Fish' },
    howto: 'Two Patāka palms placed back-to-back with thumbs spread out as fins.',
    usage: 'Fish, swimming, the avatāra Matsya.',
    hands: 2, recognize: true, reliable: false,
    components: ['ardhachandra', 'ardhachandra'],
    twoHand: [
      { type:'palmsBackToBack', weight:1.4 },
      { type:'wristsClose', threshold:0.5, weight:0.8 },
    ],
  },
  {
    id: 'kurma', category: 'samyukta', svg: 'kurma',
    names: { sa: 'कूर्म', iast: 'Kūrma', en: 'Tortoise' },
    howto: 'Mṛgaśīrṣa on top of an inverted Mṛgaśīrṣa.',
    usage: 'Tortoise, the avatāra Kūrma supporting Mount Mandara.',
    hands: 2, recognize: true, reliable: false,
    components: ['mrigashirsha', 'mrigashirsha'],
    twoHand: [
      { type:'handsStacked', weight:1.4 },
    ],
  },
  {
    id: 'varaha', category: 'samyukta', svg: 'varaha',
    names: { sa: 'वराह', iast: 'Varāha', en: 'Boar' },
    howto: 'Two Mṛgaśīrṣa hands, one stacked on the other with ring fingers interlocked.',
    usage: 'The boar, the avatāra Varāha lifting the earth.',
    hands: 2, recognize: true, reliable: false,
    components: ['mrigashirsha', 'mrigashirsha'],
    twoHand: [
      { type:'handsStacked', weight:1.1 },
      { type:'wristsClose', threshold:0.7, weight:0.8 },
    ],
  },
  {
    id: 'garuda', category: 'samyukta', svg: 'garuda',
    names: { sa: 'गरुड', iast: 'Garuḍa', en: 'Eagle' },
    howto: 'Both Ardhacandra hands with thumbs hooked, palms spread like wings.',
    usage: 'Garuḍa — the divine eagle, mount of Viṣṇu.',
    hands: 2, recognize: true, reliable: true,
    components: ['ardhachandra', 'ardhachandra'],
    twoHand: [
      { type:'thumbsHooked', weight:1.6 },
    ],
  },
  {
    id: 'nagabandha', category: 'samyukta', svg: 'nagabandha',
    names: { sa: 'नागबन्ध', iast: 'Nāgabandha', en: 'Serpent-bind' },
    howto: 'Two Sarpaśīrṣa hands crossed at the wrists.',
    usage: 'Serpent intertwined, bondage, a knot, indissoluble union.',
    hands: 2, recognize: true, reliable: false,
    components: ['sarpasirsha', 'sarpasirsha'],
    twoHand: [
      { type:'handsCrossed', weight:1.4 },
    ],
  },
  {
    id: 'khatva', category: 'samyukta', svg: 'khatva',
    names: { sa: 'खट्वा', iast: 'Khaṭvā', en: 'Bed' },
    howto: 'Two Catura hands held palm-up parallel to each other.',
    usage: 'A bed, a cot, a litter, a palanquin.',
    hands: 2, recognize: true, reliable: false,
    components: ['chatura', 'chatura'],
    twoHand: [
      { type:'palmsUpward', weight:1.4 },
      { type:'handsParallel', weight:0.6 },
    ],
  },
  {
    id: 'bherunda', category: 'samyukta', svg: 'bherunda',
    names: { sa: 'भेरुण्ड', iast: 'Bheruṇḍa', en: 'Two-headed bird' },
    howto: 'Two Kapittha hands joined back-to-back at the wrists.',
    usage: 'A pair of birds, the mythical two-headed bird, lovers united.',
    hands: 2, recognize: true, reliable: false,
    components: ['kapittha', 'kapittha'],
    twoHand: [
      { type:'palmsBackToBack', weight:1.4 },
    ],
  },
  {
    id: 'avahittha', category: 'samyukta', svg: 'avahittha',
    names: { sa: 'अवहित्थ', iast: 'Avahittha', en: 'Dissimulation' },
    howto: 'Two Śukatuṇḍa hands gently turned downward toward the chest.',
    usage: 'Pretence, concealing a feeling, slenderness, weakness, a sigh.',
    hands: 2, recognize: true, reliable: false,
    components: ['shukatunda', 'shukatunda'],
    twoHand: [
      { type:'palmsDownward', weight:1.4 },
    ],
  },

  // ============================================================
  // DEVATA HASTAS — gestures naming the deities
  // ============================================================
  {
    id: 'brahma', category: 'devata', svg: 'brahma',
    names: { sa: 'ब्रह्मा', iast: 'Brahmā', en: 'The Creator' },
    howto: 'Left hand in Catura, right hand in Haṃsāsya.',
    usage: 'Lord Brahmā, the creator god; the four Vedas.',
    hands: 2, recognize: true, reliable: false,
    components: ['chatura', 'hamsasya'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'vishnu', category: 'devata', svg: 'vishnu',
    names: { sa: 'विष्णु', iast: 'Viṣṇu', en: 'The Preserver' },
    howto: 'Both hands in Tripatāka.',
    usage: 'Lord Viṣṇu, the preserver, holding the conch, discus, mace, and lotus.',
    hands: 2, recognize: true, reliable: false,
    components: ['tripataka', 'tripataka'],
    twoHand: [
      { type:'bothPointUp', weight:0.8 },
      { type:'handsSideBySide', weight:0.4 },
    ],
  },
  {
    id: 'shiva', category: 'devata', svg: 'shiva',
    names: { sa: 'शिव', iast: 'Śiva', en: 'The Auspicious' },
    howto: 'Left hand in Mṛgaśīrṣa, right hand in Tripatāka.',
    usage: 'Lord Śiva — the auspicious one, lord of yoga and destruction.',
    hands: 2, recognize: true, reliable: false,
    components: ['mrigashirsha', 'tripataka'],
    twoHand: [
      { type:'handsSideBySide', weight:0.5 },
    ],
  },
  {
    id: 'ganesha', category: 'devata', svg: 'ganesha',
    names: { sa: 'गणेश', iast: 'Gaṇeśa', en: 'The Elephant-faced' },
    howto: 'Both hands in Kapittha, held at the temples to suggest tusks.',
    usage: 'Lord Gaṇeśa, the remover of obstacles, son of Śiva and Pārvatī.',
    hands: 2, recognize: true, reliable: false,
    components: ['kapittha', 'kapittha'],
    twoHand: [
      { type:'handsSideBySide', weight:0.8 },
    ],
  },
  {
    id: 'lakshmi', category: 'devata', svg: 'lakshmi',
    names: { sa: 'लक्ष्मी', iast: 'Lakṣmī', en: 'The Goddess of Fortune' },
    howto: 'Both hands in Kapittha, tilted slightly upward by the shoulders.',
    usage: 'Goddess Lakṣmī, consort of Viṣṇu, bestower of prosperity.',
    // Visually identical to Gaṇeśa — disabled in classifier to avoid lock-in
    // ambiguity. Still shown in the catalog.
    hands: 2, recognize: false, reliable: false,
  },
  {
    id: 'saraswati', category: 'devata', svg: 'saraswati',
    names: { sa: 'सरस्वती', iast: 'Sarasvatī', en: 'The Goddess of Learning' },
    howto: 'Both hands in Kaṭakāmukha — suggesting the vīṇā.',
    usage: 'Goddess Sarasvatī, presiding deity of speech, music, and the arts.',
    hands: 2, recognize: true, reliable: false,
    components: ['katakamukha', 'katakamukha'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'durga', category: 'devata', svg: 'durga',
    names: { sa: 'दुर्गा', iast: 'Durgā', en: 'The Invincible Goddess' },
    howto: 'Left hand in Tripatāka, right hand in Ardhacandra.',
    usage: 'Goddess Durgā, slayer of the buffalo demon, bearer of weapons.',
    hands: 2, recognize: true, reliable: false,
    components: ['tripataka', 'ardhachandra'],
    twoHand: [
      { type:'handsSideBySide', weight:0.5 },
    ],
  },

  // ============================================================
  // DAŚĀVATĀRA HASTAS — the ten incarnations of Viṣṇu
  // ============================================================
  {
    id: 'matsyavatara', category: 'dasavatara', svg: 'matsyavatara',
    names: { sa: 'मत्स्य', iast: 'Matsya', en: 'The Fish' },
    howto: 'Both Patāka hands back-to-back, thumbs spread as fins (the same as Matsya samyukta).',
    usage: "Viṣṇu's first avatāra — Matsya, the fish that rescues the Vedas.",
    // Geometrically identical to Matsya samyukta — same gesture, different
    // narrative label. Detection delegated to the Samyukta entry.
    hands: 2, recognize: false, reliable: false,
  },
  {
    id: 'kurmavatara', category: 'dasavatara', svg: 'kurmavatara',
    names: { sa: 'कूर्म', iast: 'Kūrma', en: 'The Tortoise' },
    howto: 'Mṛgaśīrṣa on top of an inverted Mṛgaśīrṣa (same as Kūrma samyukta).',
    usage: "Viṣṇu's second avatāra — the tortoise supporting Mount Mandara during the churning of the ocean.",
    hands: 2, recognize: false, reliable: false,
  },
  {
    id: 'varahavatara', category: 'dasavatara', svg: 'varahavatara',
    names: { sa: 'वराह', iast: 'Varāha', en: 'The Boar' },
    howto: 'Two Mṛgaśīrṣa hands joined (same as Varāha samyukta).',
    usage: "Viṣṇu's third avatāra — the boar who lifted the earth from the cosmic ocean.",
    hands: 2, recognize: false, reliable: false,
  },
  {
    id: 'narasimha', category: 'dasavatara', svg: 'narasimha',
    names: { sa: 'नरसिंह', iast: 'Narasiṃha', en: 'The Man-Lion' },
    howto: 'Left hand in Siṃhamukha, right hand in Tripatāka.',
    usage: "Viṣṇu's fourth avatāra — the lion-man who slew the demon Hiraṇyakaśipu.",
    hands: 2, recognize: true, reliable: false,
    components: ['simhamukha', 'tripataka'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'vamana', category: 'dasavatara', svg: 'vamana',
    names: { sa: 'वामन', iast: 'Vāmana', en: 'The Dwarf' },
    howto: 'Both Muṣṭi hands held close to the body, low.',
    usage: "Viṣṇu's fifth avatāra — the dwarf who reclaimed the three worlds from King Bali in three strides.",
    hands: 2, recognize: true, reliable: false,
    components: ['mushti', 'mushti'],
    twoHand: [
      { type:'handsSideBySide', weight:1 },
    ],
  },
  {
    id: 'parashurama', category: 'dasavatara', svg: 'parashurama',
    names: { sa: 'परशुराम', iast: 'Paraśurāma', en: 'Rāma with the axe' },
    howto: 'Left hand in Ardhacandra, right hand in Muṣṭi as if gripping an axe.',
    usage: "Viṣṇu's sixth avatāra — the brahmin warrior wielding the axe.",
    hands: 2, recognize: true, reliable: false,
    components: ['ardhachandra', 'mushti'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'rama', category: 'dasavatara', svg: 'rama',
    names: { sa: 'राम', iast: 'Rāma', en: 'Lord Rāma' },
    howto: 'Left hand in Kapittha, right hand in Śikhara — drawing the bow.',
    usage: "Viṣṇu's seventh avatāra — Rāma of Ayodhya, the ideal king.",
    hands: 2, recognize: true, reliable: false,
    components: ['kapittha', 'shikhara'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'balarama', category: 'dasavatara', svg: 'balarama',
    names: { sa: 'बलराम', iast: 'Balarāma', en: "Krishna's brother" },
    howto: 'Left hand in Patāka, right hand in Muṣṭi — gripping the plough.',
    usage: "Viṣṇu's eighth avatāra (in some lists) — elder brother of Kṛṣṇa, wielder of the plough.",
    hands: 2, recognize: true, reliable: false,
    components: ['pataka', 'mushti'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
  {
    id: 'krishna', category: 'dasavatara', svg: 'krishna',
    names: { sa: 'कृष्ण', iast: 'Kṛṣṇa', en: 'Lord Krishna' },
    howto: 'Both hands in Mṛgaśīrṣa held in front of the lips — the flute pose.',
    usage: "Viṣṇu's ninth avatāra — Kṛṣṇa playing the flute, the divine cowherd.",
    hands: 2, recognize: true, reliable: false,
    components: ['mrigashirsha', 'mrigashirsha'],
    twoHand: [
      { type:'handsParallel', weight:0.8 },
      { type:'handsSideBySide', weight:1 },
    ],
  },
  {
    id: 'kalki', category: 'dasavatara', svg: 'kalki',
    names: { sa: 'कल्कि', iast: 'Kalki', en: 'The Future Avatāra' },
    howto: 'Right hand in Tripatāka, left hand in Patāka — pointing toward the future.',
    usage: "Viṣṇu's tenth and prophesied avatāra — the rider on the white horse, restorer of dharma.",
    hands: 2, recognize: true, reliable: false,
    components: ['tripataka', 'pataka'],
    twoHand: [
      { type:'handsSideBySide', weight:0.6 },
    ],
  },
];

// ============================================================
// Indexes / lookups
// ============================================================
export const MUDRA_BY_ID = Object.fromEntries(MUDRAS.map(m => [m.id, m]));
export const MUDRAS_BY_CATEGORY = Object.fromEntries(
  CATEGORIES.map(c => [c.id, MUDRAS.filter(m => m.category === c.id)])
);
export const RECOGNIZABLE_ONE_HAND = MUDRAS.filter(m => m.recognize && m.hands === 1);
export const RECOGNIZABLE_TWO_HAND = MUDRAS.filter(m => m.recognize && m.hands === 2);
