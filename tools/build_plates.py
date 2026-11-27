#!/usr/bin/env python3
"""
Build every parchment plate in images/ from the dataset frames named in
tools/paper_plates.json.

    python3 tools/build_plates.py --frames DIR [slug ...]

DIR holds the dataset frames at their dataset paths, e.g.
DIR/Matsya(1)/Matsya  _446.jpg  (download them from
https://github.com/jisharajr/Bharatanatyam-Mudra-Dataset, CC BY-SA 4.0).
Plates marked "dark" are cut from the representative photo kept in poses/src.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paper_art import make  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--frames", required=True)
ap.add_argument("--out", default=str(ROOT / "images"))
ap.add_argument("slugs", nargs="*")
a = ap.parse_args()
cfg = json.loads((ROOT / "tools" / "paper_plates.json").read_text())
for slug, spec in cfg["plates"].items():
    if a.slugs and slug not in a.slugs:
        continue
    if spec.get("dark"):
        make(str(ROOT / spec["path"]), str(Path(a.out) / f"{slug}.jpg"), dark=True)
    else:
        make(str(Path(a.frames) / spec["frame"]), str(Path(a.out) / f"{slug}.jpg"))
    print("wrote", slug)
