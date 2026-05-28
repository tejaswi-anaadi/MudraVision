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
- MediaPipe Tasks Vision (Hand Landmarker + Selfie Segmenter) loaded from
  jsDelivr CDN
- Three.js for the rotatable 3D skeleton viewer
- IndexedDB for persisting captured mudras (photos as Blobs)

## Run locally
Any static file server over HTTPS or localhost — the browser needs a
secure context to access the camera. Examples:

```bash
python3 -m http.server 8088   # then open http://localhost:8088/
```

## Files
| File | Role |
|---|---|
| `index.html` `styles.css` | Shell + theme |
| `app.js` | View routing, Learn catalog, Practice loop, glue |
| `landmarks.js` | Geometry helpers + normalisation for k-NN |
| `classifier.js` | Rule-based mudra scoring + k-NN merger |
| `mudras.js` | The 69-entry mudra database |
| `svg.js` | Neon line-art per mudra |
| `art.js` | Three-type visual selector (svg ▸ source ▸ scanned) |
| `mediapipe.js` | Singleton loaders for HandLandmarker + ImageSegmenter |
| `capture.js` | Guided 2-angle capture flow + hand segmentation |
| `store.js` | IndexedDB CRUD + export/import |
| `knn.js` | In-memory k-NN classifier |
| `viewer3d.js` | Three.js rotatable skeleton + photo turntable |
| `images/` | Reference photographs (see `ATTRIBUTION.md`) |

## Credits
Mudra reference photographs from the **Bharatanatyam Mudra Dataset** by
Jisha Raj R (CC BY-SA 4.0) and additional images from Wikimedia Commons
(CC BY-SA 3.0). See `ATTRIBUTION.md` for the full attribution and licence
terms — derivatives must keep the ShareAlike licence on the images.

## License
Code: MIT. Images: CC BY-SA per `ATTRIBUTION.md`.
