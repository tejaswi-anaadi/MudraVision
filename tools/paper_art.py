#!/usr/bin/env python3
"""
Turn a green-screen hand photograph into a "paper" mudra picture: the real hands,
cut out cleanly, on warm parchment with a soft shadow and a fine border.

No generated imagery is involved — every pixel of hand is the original photograph.

    python3 tools/paper_art.py FRAME.jpg OUT.jpg [--width 800]

Used for frames from the Bharatanatyam Mudra Dataset (Jisha Raj R, CC BY-SA 4.0).
See ATTRIBUTION.md.
"""
import argparse
import sys

import cv2
import numpy as np

PAPER = (236, 244, 250)        # BGR of warm ivory (#faf4ec)
PAPER_EDGE = (205, 224, 238)   # BGR slightly darker toward the corners
INK = (45, 60, 120)            # BGR deep maroon for the border (#783c2d)
GOLD = (80, 150, 200)          # BGR muted gold (#c89650)


def warm_grade(bgr_f):
    """Undo the cool/green cast of screen lighting on skin. Adaptive: washed-out
    pixels (low saturation, typically lighter skin under green light) get a
    stronger correction than already-saturated ones, so dark skin is not
    over-orange."""
    out = bgr_f.copy()
    mx, mn = out.max(axis=2), out.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    w = np.clip(1.0 - sat / 0.38, 0, 1)[..., None]            # 1 = washed out
    out[..., 2:3] *= 1 + 0.08 * w                              # R
    out[..., 1:2] *= 1 - 0.10 * w                              # G (screen light)
    out[..., 0:1] *= 1 - 0.13 * w                              # B
    grey = out.mean(axis=2, keepdims=True)
    return grey + (out - grey) * (1 + 0.30 * w)


def key_out_green(bgr):
    """Soft alpha for a green-screen photo, plus the despilled colour image."""
    img = bgr.astype(np.float32)
    b, g, r = img[..., 0], img[..., 1], img[..., 2]
    # Greenness: how far green exceeds the larger of red/blue. Skin has red > green.
    green = g - np.maximum(r, b)
    lo, hi = 14.0, 46.0
    alpha = 1.0 - np.clip((green - lo) / (hi - lo), 0, 1)
    # Shadowed screen is darker and less "green than red/blue", so also key on hue:
    # OpenCV hue 35-95 with real saturation is screen; skin sits at hue 0-25.
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hh, ss = hsv[..., 0], hsv[..., 1]
    # A shadowed hand also picks up an olive tint from the screen, so require the
    # pixel to be measurably greener than red/blue too (else the shadow side of a
    # hand gets chopped away).
    hue_bg = ((hh >= 35) & (hh <= 95) & (ss >= 80) & (green >= 12)).astype(np.float32)
    alpha = np.minimum(alpha, 1.0 - cv2.GaussianBlur(hue_bg, (0, 0), 0.8))
    # Remove isolated specks/holes, keep the big connected shapes (hands + forearms).
    a8 = (alpha * 255).astype(np.uint8)
    solid = (a8 > 128).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    keep = np.zeros_like(solid)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        thresh = max(400, 0.04 * areas.max())
        for i, a in enumerate(areas, start=1):
            if a >= thresh:
                keep[lab == i] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    keep = cv2.medianBlur(keep * 255, 5) // 255      # smooth stair-stepped edges
    # Fill small interior holes (gaps between fingers that are skin-coloured).
    inv = (1 - keep).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    for i in range(1, n2):
        x, y, w, h, area = st2[i]
        touches = x == 0 or y == 0 or x + w >= keep.shape[1] or y + h >= keep.shape[0]
        if not touches and area < 120:
            keep[lab2 == i] = 1
    # Shrink 1px (kills the green fringe), then feather.
    keep = cv2.erode(keep, np.ones((3, 3), np.uint8))
    soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.1)
    alpha = soft

    # Despill: clamp green to the larger of red/blue so no green tint survives.
    # Skin is red-dominant (r > g > b); screen light adds green. Cap green at a
    # mostly-red blend so the hand keeps its natural warmth instead of going grey.
    g2 = np.minimum(g, 0.80 * r + 0.20 * b)
    out = img.copy()
    out[..., 1] = g2
    out = warm_grade(out)
    return np.clip(out, 0, 255).astype(np.uint8), alpha


def key_out_dark(bgr):
    """Cut a hand out of the app's old dark-glow photos (hue keying). Used only
    where no clean green-screen frame matches the dataset's representative pose."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    bg = ((h >= 55) & (h <= 140) & (s >= 40)) | (v < 28)
    a = (~bg).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    a = cv2.erode(a, np.ones((3, 3), np.uint8))
    return bgr, cv2.GaussianBlur(a.astype(np.float32), (0, 0), 1.0)


def fade_borders(alpha, frac=0.10):
    """Fade the hand out where forearms run off the photo edge (no hard crop line)."""
    h, w = alpha.shape
    fy, fx = max(2, int(h * frac)), max(2, int(w * frac))
    ramp_x = np.minimum(np.arange(w), np.arange(w)[::-1]).astype(np.float32)
    ramp_y = np.minimum(np.arange(h), np.arange(h)[::-1]).astype(np.float32)
    mx = np.clip(ramp_x / fx, 0, 1)[None, :]
    my = np.clip(ramp_y / fy, 0, 1)[:, None]
    fade = mx * my
    fade = fade * fade * (3 - 2 * fade)          # smoothstep
    return alpha * fade


def paper_background(w, h, seed=7):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w * 0.72)) ** 2 + ((yy - h / 2) / (h * 0.72)) ** 2)
    d = np.clip(d, 0, 1)[..., None]
    bg = np.array(PAPER, np.float32) * (1 - d) + np.array(PAPER_EDGE, np.float32) * d
    rng = np.random.default_rng(seed)
    fibre = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.4) * 3.2
    blotch = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 40) * 9
    return np.clip(bg + (fibre + blotch)[..., None], 0, 255)


def draw_border(canvas):
    h, w = canvas.shape[:2]
    m = int(min(w, h) * 0.035)
    cv2.rectangle(canvas, (m, m), (w - m, h - m), INK, 2, cv2.LINE_AA)
    m2 = m + 7
    cv2.rectangle(canvas, (m2, m2), (w - m2, h - m2), GOLD, 1, cv2.LINE_AA)
    for (cx, cy) in [(m, m), (w - m, m), (m, h - m), (w - m, h - m)]:
        cv2.circle(canvas, (cx, cy), 5, INK, -1, cv2.LINE_AA)
        cv2.circle(canvas, (cx, cy), 9, GOLD, 1, cv2.LINE_AA)
    return canvas


def make(frame_path, out_path, width=800, dark=False):
    bgr = cv2.imread(frame_path)
    if bgr is None:
        sys.exit(f"cannot read {frame_path}")
    h0, w0 = bgr.shape[:2]
    scale = width / w0
    h = int(round(h0 * scale))
    bgr = cv2.resize(bgr, (width, h), interpolation=cv2.INTER_LANCZOS4)
    colour, alpha = (key_out_dark if dark else key_out_green)(bgr)
    alpha = fade_borders(alpha)

    bg = paper_background(width, h)
    # Soft contact shadow, offset down-right.
    sh = cv2.GaussianBlur(alpha, (0, 0), 9)
    M = np.float32([[1, 0, 7], [0, 1, 11]])
    sh = cv2.warpAffine(sh, M, (width, h))
    canvas = bg * (1 - 0.30 * sh[..., None])
    a = alpha[..., None]
    canvas = colour.astype(np.float32) * a + canvas * (1 - a)
    canvas = draw_border(np.clip(canvas, 0, 255).astype(np.uint8))
    params = [cv2.IMWRITE_JPEG_QUALITY, 90] if out_path.lower().endswith((".jpg", ".jpeg")) else []
    cv2.imwrite(out_path, canvas, params)
    return canvas


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("frame")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=800)
    a = ap.parse_args()
    make(a.frame, a.out, a.width)
    print(f"wrote {a.out}")
