// camera.js
// One place for opening the webcam and explaining, accurately, why it failed.
//
// Before this, every failure was reported as "Camera access denied", and a
// camera that was granted but whose hand model was still downloading kept the
// text "Requesting camera…" on screen — so a user who had clicked Allow saw
// nothing change.

export class CameraError extends Error {
  constructor(kind, message, cause) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;         // 'blocked' | 'none' | 'busy' | 'timeout' | 'unsupported' | 'other'
    this.cause = cause;
  }
}

// Plain-language message + what to do, from a getUserMedia / video failure.
export function describeCameraError(err) {
  const kind = err instanceof CameraError ? err.kind : classify(err);
  switch (kind) {
    case 'blocked':
      return 'The camera is blocked. Click the camera icon in the address bar and choose Allow. ' +
             'If it still fails, allow this browser under System Settings ▸ Privacy & Security ▸ Camera.';
    case 'none':
      return 'No camera was found. Connect one, or check it is not disabled.';
    case 'busy':
      return 'The camera is in use by another app or browser tab. Close it, then try again.';
    case 'timeout':
      return 'Still waiting for the camera. Look for a permission prompt in your browser and click Allow.';
    case 'unsupported':
      return 'This page needs a secure address (https:// or localhost) to use the camera.';
    default:
      return `The camera could not be started${err?.message ? ` (${err.message})` : ''}.`;
  }
}

function classify(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError': return 'blocked';
    case 'NotFoundError':
    case 'DevicesNotFoundError':  return 'none';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':            return 'busy';
    default:                      return 'other';
  }
}

function withTimeout(promise, ms, kind) {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new CameraError(kind, 'timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Open the webcam and attach it to `video`. Resolves when frames are playing.
// Throws CameraError with a precise kind.
export async function openCamera(video, { waitMs = 20000 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'getUserMedia unavailable');
  }
  const ideal = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
  let stream;
  try {
    stream = await withTimeout(navigator.mediaDevices.getUserMedia({ video: ideal, audio: false }), waitMs, 'timeout');
  } catch (err) {
    if (err instanceof CameraError) throw err;
    if (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError') {
      // Some cameras reject the ideal constraints; retry with anything.
      try {
        stream = await withTimeout(navigator.mediaDevices.getUserMedia({ video: true, audio: false }), waitMs, 'timeout');
      } catch (err2) {
        throw err2 instanceof CameraError ? err2 : new CameraError(classify(err2), err2?.message, err2);
      }
    } else {
      throw new CameraError(classify(err), err?.message, err);
    }
  }
  video.srcObject = stream;
  // loadedmetadata may already have fired by the time we listen.
  if (video.readyState < 1) {
    await withTimeout(new Promise(res => video.addEventListener('loadedmetadata', res, { once: true })), 8000, 'busy');
  }
  try { await video.play(); }
  catch (err) { throw new CameraError('other', err?.message, err); }
  return stream;
}

// Calls `onGranted` once if the camera permission flips to "granted" (the user
// clicked Allow in the address-bar menu after an earlier block). No-op where
// the Permissions API cannot query the camera.
export async function watchCameraPermission(onGranted) {
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    status.onchange = () => { if (status.state === 'granted') onGranted(); };
    return status;
  } catch { return null; }
}
