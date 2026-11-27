# Mudra Vision

A self-paced introduction to the **hastas** of Bharatanāṭyam — and a
live camera that recognises them as you form them. Runs entirely in the
browser; nothing is uploaded.

## Live site
<https://tejaswi-anaadi.github.io/MudraVision/>

## What's in it
- **Learn** — 69 mudras across four families (28 Asamyukta · 24 Samyukta ·
  7 Devatā · 10 Daśāvatāra), each card with Devanāgarī, IAST, English,
  the way the hand is formed, and its viniyoga.
- **Capture** — scan a mudra from two angles (front + sideways tilt) with
  a target ring, three live gates (Position, Orientation, Steady), a big
  green tick on each successful capture, and a clean alpha-masked PNG of
  your hand on a transparent background.
- **Practice** — point the camera at your hand and the app recognises
  the mudra live, with a neon skeleton overlay and a per-mudra card.
  Captured mudras become recognisable instantly; built-ins are matched by
  a rule-based engine + the captures are matched by k-NN over normalised
  3D landmark vectors.

## Tech
- Pure static HTML / CSS / vanilla ES-module JS — no build step
- MediaPipe Tasks Vision 1.2.3 (Hand Landmarker + Selfie Segmenter), pinned,
  loaded from jsDelivr CDN
- Three.js for the rotatable 3D skeleton viewer
- IndexedDB for persisting captured mudras (photos as Blobs)

## Run locally
Any static file server over HTTPS or localhost — the browser needs a
secure context to access the camera. Examples:

```bash
python3 -m http.server 8088   # then open http://localhost:8088/
```

## Recognition tests
```bash
npm test                              # single-hand fixtures + two-hand scenarios
node tools/diagnose.mjs trishula      # why a pose scores the way it does
node tools/features.mjs               # measured finger features for every fixture
node tools/test_recognition.mjs --space=world   # compare landmark spaces
```
The tests replay the landmarks extracted from the reference photos in
`poses/` through the **same pipeline the camera uses**: image landmarks
(corrected for the webcam aspect ratio) for position, MediaPipe
`worldLandmarks` for finger shape. They report top‑1, top‑3 and "would lock"
(the app's own candidate rule). `tools/baseline.json` is a ratchet — a pose
that passes there must keep passing. Fixtures whose extracted landmarks do not
fit the photo are listed in `tools/fixture_quality.json` and excluded from the
score. The fixtures are also the tuning set, so these numbers are an
optimistic ceiling, not field accuracy.

## Measuring real accuracy (record your own hands)
The reference photos can't prove accuracy: most mudras have no photo, several
photos are near-identical hands, and the photos are also what the rules were
tuned on. Record real hands instead:

1. Open **Practice** and press **R** (or the **● Record** button).
2. Pick a mudrā, hold it, press **Space**. After a 3‑second countdown it
   records one *take* (12 frames). Do **5+ takes per mudrā**, varying angle,
   distance, hand and lighting between takes. Two‑hand mudrās need both hands
   in view; takes with the wrong hand count are discarded.
3. **Export JSON**. Nothing leaves the browser until you do, and only
   landmarks are stored — no camera images.
4. Evaluate:
```bash
node tools/eval_dataset.mjs mudra-dataset-*.json          # DEV and TEST report
node tools/eval_dataset.mjs mudra-dataset-*.json --gate   # exit 1 if TEST < 95%
```
Each mudrā's most recent takes (30%) are held out as **TEST**, split *by take*
so near-identical frames can't leak. Tune rules on DEV only, then report TEST.
The headline is macro **lock-correct**: the share of takes where the app's own
6‑of‑8 consensus locks the *right* mudrā, averaged over mudrās.
`node tools/synth_dataset.mjs out.json` makes a synthetic set to smoke-test the
pipeline (it says nothing about accuracy; `npm test` runs that smoke test).

## Files
| File | Role |
|---|---|
| `index.html` `styles.css` | Shell + theme |
| `app.js` | View routing, Learn catalog, Practice loop, glue |
| `landmarks.js` | Geometry helpers + normalisation for k-NN |
| `classifier.js` | Rule-based mudra scoring (+ structural penalties) + k-NN merger |
| `mudras.js` | The 69-entry mudra database |
| `art.js` | Visual selector (scanned ▸ photo ▸ component-hand photos ▸ placeholder) |
| `mediapipe.js` | Singleton loaders for HandLandmarker + ImageSegmenter (pinned CDN version, GPU→CPU fallback) |
| `camera.js` | Opens the webcam and explains precisely why it failed (blocked / none / busy / timeout) |
| `capture.js` | Guided 2-angle capture flow + hand segmentation |
| `store.js` | IndexedDB CRUD + export/import |
| `recorder.js` | Labelled-landmark dataset recorder (Practice → R) |
| `knn.js` | In-memory k-NN classifier |
| `viewer3d.js` | Three.js rotatable skeleton + photo turntable |
| `images/` | Real hand photographs on parchment (see `ATTRIBUTION.md`); built by `tools/build_plates.py` from dataset frames |
| `poses/src/` | Original dataset photographs used to extract 3D poses (not displayed) |

## Credits
Mudra reference photographs from the **Bharatanatyam Mudra Dataset** by
Jisha Raj R (CC BY-SA 4.0) and additional images from Wikimedia Commons
(CC BY-SA 3.0). See `ATTRIBUTION.md` for the full attribution and licence
terms — derivatives must keep the ShareAlike licence on the images.

## License
Code: MIT. Images: CC BY-SA per `ATTRIBUTION.md`.
