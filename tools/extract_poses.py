#!/usr/bin/env python3
"""
Extract MediaPipe hand worldLandmarks for every reference photo in
`images/` and write the 21 (x, y, z) points to `poses/{slug}.json`.

These pose files give the runtime 3D viewer a real, pose-accurate
skeleton for built-in mudras that the user hasn't captured. The
geometry always traces back to a real photograph — NOT to any
generated image.

Run once after adding new photos:

    python3 tools/extract_poses.py
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision


ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
POSES_DIR = ROOT / "poses"
POSES_DIR.mkdir(exist_ok=True)
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_PATH = ROOT / "tools" / "hand_landmarker.task"


def ensure_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH
    print(f"Downloading hand model → {MODEL_PATH} …")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def main():
    model_path = ensure_model()

    base = mp_python.BaseOptions(model_asset_path=str(model_path))
    options = mp_vision.HandLandmarkerOptions(
        base_options=base,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.30,    # stylised photos can be tricky
        min_hand_presence_confidence=0.30,
        min_tracking_confidence=0.30,
    )

    def composite_on_white(bgr):
        """Photos with a near-black chroma-keyed background sometimes trip
        the detector. Composite onto white for a more natural backdrop."""
        h, w = bgr.shape[:2]
        white = (255 * (1 - 1)) * 0 + 255  # noqa  (just keeping intent clear)
        out = bgr.copy()
        # Treat very dark pixels as background and replace with white.
        mask = (bgr.sum(axis=2) < 60)
        out[mask] = [255, 255, 255]
        return out

    def try_variants(rgb_orig):
        """Yield several pre-processed versions of the image to give the
        landmarker more chances on tricky chroma-keyed photos."""
        yield rgb_orig
        # On white background
        bgr = cv2.cvtColor(rgb_orig, cv2.COLOR_RGB2BGR)
        yield cv2.cvtColor(composite_on_white(bgr), cv2.COLOR_BGR2RGB)
        # On grey background + boost contrast
        boosted = cv2.convertScaleAbs(rgb_orig, alpha=1.4, beta=20)
        yield boosted
        # Inverted (helps if model expects light skin on dark)
        # yield 255 - rgb_orig

    wrote, skipped = 0, []
    with mp_vision.HandLandmarker.create_from_options(options) as landmarker:
        for image_path in sorted(IMAGES_DIR.glob("*.png")):
            slug = image_path.stem
            bgr = cv2.imread(str(image_path))
            if bgr is None:
                skipped.append((slug, "image read failed"))
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            result = None
            for variant in try_variants(rgb):
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=variant)
                r = landmarker.detect(mp_image)
                if r.hand_world_landmarks and r.hand_landmarks:
                    result = r
                    break
            if result is None:
                skipped.append((slug, "no hand detected"))
                continue

            world = [
                {"x": p.x, "y": p.y, "z": p.z}
                for p in result.hand_world_landmarks[0]
            ]
            image_lm = [
                {"x": p.x, "y": p.y, "z": p.z}
                for p in result.hand_landmarks[0]
            ]
            hand_label = (
                result.handedness[0][0].category_name
                if result.handedness else "Unknown"
            )
            payload = {
                "slug": slug,
                "source_image": f"images/{image_path.name}",
                "handedness": hand_label,
                "worldLandmarks": world,
                "landmarks": image_lm,
            }
            with open(POSES_DIR / f"{slug}.json", "w") as f:
                json.dump(payload, f)
            print(f"  ✓ {slug:18s} ({hand_label})")
            wrote += 1

    print(f"\nExtracted {wrote} poses to {POSES_DIR}.")
    if skipped:
        print(f"Skipped {len(skipped)}:")
        for slug, reason in skipped:
            print(f"  · {slug:18s} — {reason}")


if __name__ == "__main__":
    sys.exit(main())
