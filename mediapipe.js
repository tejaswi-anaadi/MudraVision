// mediapipe.js
// Singleton HandLandmarker loader shared between the Practice loop and the
// Capture flow so we only download/initialise the model once.

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
    const { HandLandmarker, FilesetResolver } = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
    );
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    _landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.60,
      minTrackingConfidence: 0.60,
    });
    return _landmarker;
  })();
  return _loadingPromise;
}

export function disposeLandmarker() {
  if (_landmarker) {
    try { _landmarker.close && _landmarker.close(); } catch {}
    _landmarker = null;
  }
  _loadingPromise = null;
}

// ============================================================
// Selfie segmenter — separates the person from the background.
// Used by capture.js to cut the hand cleanly from the camera frame.
// ============================================================
let _segmenter = null;
let _segLoadingPromise = null;

export function getLoadedSegmenter() { return _segmenter; }

export function loadSegmenter() {
  if (_segmenter) return Promise.resolve(_segmenter);
  if (_segLoadingPromise) return _segLoadingPromise;
  _segLoadingPromise = (async () => {
    const { ImageSegmenter, FilesetResolver } = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
    );
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    _segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
        delegate: "GPU",
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: "IMAGE",
    });
    return _segmenter;
  })();
  return _segLoadingPromise;
}
