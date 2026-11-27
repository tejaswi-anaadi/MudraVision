#!/usr/bin/env python3
"""
Run MediaPipe Hand Landmarker over Bharatanatyam Mudra Dataset frames and write
one JSON line per frame with the detected hands.

    python3 tools/extract_dataset.py FRAMES_DIR OUT.jsonl

FRAMES_DIR holds <DatasetFolder>/<frame-index>.jpg (frames from
https://github.com/jisharajr/Bharatanatyam-Mudra-Dataset, CC BY-SA 4.0).
The model file is the same hand_landmarker.task the web app loads, so the
landmarks match what the browser sees.
"""
import json
import re
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision as mpv

ROOT = Path(__file__).resolve().parent.parent

# Dataset folder name -> app mudra id.
FOLDER_TO_ID = {
    "Alapadmam": "alapadma", "Anjali": "anjali", "Aralam": "arala",
    "Ardhachandran": "ardhachandra", "Ardhapathaka": "ardhapataka",
    "Berunda": "bherunda", "Bramaram": "bhramara", "Chakra": "chakra",
    "Chandrakala": "chandrakala", "Chaturam": "chatura", "Garuda": "garuda",
    "Hamsapaksha": "hamsapaksha", "Hamsapaksham": "hamsapaksha",
    "Hamsasyam": "hamsasya", "Kangulam": "kangula", "Kapith": "kapittha",
    "Kapotham": "kapota", "Karkatta": "karkata",
    "Kartariswastika": "kartariswastika", "Katakamukha_1": "katakamukha",
    "Katakamukha_2": "katakamukha", "Katakamukha_3": "katakamukha",
    "Katakavardhana": "katakavardhana", "Katrimukha": "kartarimukha",
    "Khatva": "khatva", "Kilaka": "kilaka", "Kurma": "kurma",
    "Matsya": "matsya", "Mayura": "mayura", "Mrigasirsha": "mrigashirsha",
    "Mukulam": "mukula", "Mushti": "mushti", "Nagabandha": "nagabandha",
    "Padmakosha": "padmakosha", "Pasha": "pasha", "Pathaka": "pataka",
    "Pushpaputa": "pushpaputa", "Sakata": "shakata", "Samputa": "samputa",
    "Sarpasirsha": "sarpasirsha", "Shanka": "shankha",
    "Shivalinga": "shivalinga", "Shukatundam": "shukatunda",
    "Sikharam": "shikhara", "Simhamukham": "simhamukha", "Suchi": "suchi",
    "Swastikam": "swastika", "Tamarachudam": "tamrachuda",
    "Tripathaka": "tripataka", "Trishulam": "trishula", "Varaha": "varaha",
}


def folder_id(name):
    base = re.sub(r"\(\d+\)$", "", name).strip()
    return FOLDER_TO_ID.get(base)


def main():
    frames, out = Path(sys.argv[1]), Path(sys.argv[2])
    opt = mpv.HandLandmarkerOptions(
        base_options=mpp.BaseOptions(model_asset_path=str(ROOT / "tools" / "hand_landmarker.task")),
        running_mode=mpv.RunningMode.IMAGE, num_hands=2,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3)
    n = found = 0
    with mpv.HandLandmarker.create_from_options(opt) as lm, open(out, "w") as f:
        for folder in sorted(p for p in frames.iterdir() if p.is_dir()):
            mid = folder_id(folder.name)
            if not mid:
                print("skip folder", folder.name, file=sys.stderr)
                continue
            for img_path in sorted(folder.glob("*.jpg"), key=lambda p: int(p.stem)):
                bgr = cv2.imread(str(img_path))
                if bgr is None:
                    continue
                n += 1
                h, w = bgr.shape[:2]
                rgb = np.ascontiguousarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                hands = []
                for i, pts in enumerate(r.hand_landmarks):
                    cat = r.handedness[i][0]
                    hands.append({
                        "handedness": cat.category_name,
                        "score": round(cat.score, 4),
                        "landmarks": [[round(p.x, 5), round(p.y, 5), round(p.z, 5)] for p in pts],
                        "world": [[round(p.x, 6), round(p.y, 6), round(p.z, 6)] for p in r.hand_world_landmarks[i]],
                    })
                found += bool(hands)
                f.write(json.dumps({"id": mid, "folder": folder.name, "frame": int(img_path.stem),
                                    "w": w, "h": h, "hands": hands}) + "\n")
    print(f"{n} frames, hands found in {found}", file=sys.stderr)


if __name__ == "__main__":
    main()
