// mediapipe.js
// Singleton HandLandmarker loader, so the model is downloaded and initialised once.

// Pinned: "@latest" silently moved to a new major version (1.x). Bump on purpose.
const VISION_VERSION = '1.2.3';
const VISION_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const VISION_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;

// GPU first; if the browser/GPU can't run it (no WebGL2, blocked, driver bug),
// fall back to CPU instead of failing the whole page.
async function createWithFallback(create) {
  try { return await create('GPU'); }
  catch (err) {
    console.warn('MediaPipe GPU delegate failed, falling back to CPU:', err);
    return create('CPU');
  }
}

let _landmarker = null;
let _loadingPromise = null;

export function getLoadedLandmarker() {
  return _landmarker;
}

export function loadLandmarker(options = {}) {
  if (_landmarker) return Promise.resolve(_landmarker);
  if (_loadingPromise) return _loadingPromise;
  const numHands = options.numHands ?? 2;
  _loadingPromise = (async () => {
    const { HandLandmarker, FilesetResolver } = await import(VISION_BUNDLE);
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM);
    _landmarker = await createWithFallback((delegate) => HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate,
      },
      runningMode: "VIDEO",
      numHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.60,
      minTrackingConfidence: 0.60,
    }));
    return _landmarker;
  })();
  // A failed load must not be cached, or "Try again" could never succeed.
  _loadingPromise.catch(() => { _loadingPromise = null; });
  return _loadingPromise;
}

export function disposeLandmarker() {
  if (_landmarker) {
    try { _landmarker.close && _landmarker.close(); } catch {}
    _landmarker = null;
  }
  _loadingPromise = null;
}
