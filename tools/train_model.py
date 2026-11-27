#!/usr/bin/env python3
"""
Train the learned mudra classifiers from tools/build_features.mjs output and
export them as small JSON MLPs that features.js `predict()` runs in the browser.

    python3 tools/train_model.py features.json models/

Evaluation is 5-fold cross-validation over CONTIGUOUS frame blocks (frames of
one dancer are contiguous), i.e. mostly unseen dancers. Each test frame is
predicted from its original AND mirrored features, averaged — exactly what the
live app does. The final model is then fit on all data.
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

HIDDEN = (256,)
ALPHA = 1e-2


def fit(X, y, seed=0):
    sc = StandardScaler().fit(X)
    clf = MLPClassifier(hidden_layer_sizes=HIDDEN, alpha=ALPHA, max_iter=600,
                        early_stopping=False, random_state=seed)
    clf.fit(sc.transform(X), y)
    return sc, clf


def frame_probs(sc, clf, X, frames):
    """Average class probabilities over all rows (orig + mirror) of each frame."""
    P = clf.predict_proba(sc.transform(X))
    acc = defaultdict(list)
    for p, f in zip(P, frames):
        acc[f].append(p)
    return {f: np.mean(v, axis=0) for f, v in acc.items()}


def evaluate(d, name):
    X = np.array(d["X"], dtype=np.float64)
    y = np.array(d["y"]); g = np.array(d["g"]); aug = np.array(d["aug"]); fr = np.array(d["frame"])
    classes = sorted(set(y))
    per_true = defaultdict(lambda: [0, 0]); conf = Counter(); top3 = 0; n = 0
    for k in sorted(set(g)):
        tr, te = g != k, g == k
        sc, clf = fit(X[tr], y[tr])
        probs = frame_probs(sc, clf, X[te], fr[te])
        truth = {f: t for f, t in zip(fr[te], y[te])}
        for f, p in probs.items():
            order = np.argsort(-p); pred = clf.classes_[order[0]]
            t = truth[f]; n += 1
            per_true[t][1] += 1
            if pred == t: per_true[t][0] += 1
            else: conf[(t, pred)] += 1
            if t in clf.classes_[order[:3]]: top3 += 1
    correct = sum(c for c, _ in per_true.values())
    macro = np.mean([c / t for c, t in per_true.values()])
    print(f"\n== {name}: {len(classes)} classes, {n} test frames (5-fold, held-out blocks)")
    print(f"   top-1 {correct / n:.1%}   macro top-1 {macro:.1%}   top-3 {top3 / n:.1%}")
    worst = sorted(per_true.items(), key=lambda kv: kv[1][0] / kv[1][1])[:8]
    print("   weakest:", ", ".join(f"{k} {c / t:.0%}" for k, (c, t) in worst))
    print("   top confusions:", ", ".join(f"{a}→{b} ×{c}" for (a, b), c in conf.most_common(8)))
    return {"top1": correct / n, "macroTop1": macro, "top3": top3 / n, "frames": n,
            "perClass": {k: c / t for k, (c, t) in per_true.items()}}


def export(d, path):
    X = np.array(d["X"], dtype=np.float64); y = np.array(d["y"])
    sc, clf = fit(X, y)
    layers = [{"W": np.round(W, 5).tolist(), "b": np.round(b, 5).tolist()}
              for W, b in zip(clf.coefs_, clf.intercepts_)]
    model = {"classes": clf.classes_.tolist(), "mean": np.round(sc.mean_, 6).tolist(),
             "scale": np.round(np.where(sc.scale_ == 0, 1, sc.scale_), 6).tolist(),
             "layers": layers, "hidden": list(HIDDEN), "alpha": ALPHA}
    Path(path).write_text(json.dumps(model, separators=(",", ":")))
    print(f"   wrote {path} ({Path(path).stat().st_size // 1024} KB)")


def main():
    data = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    report = {}
    for key, name in (("single", "single-hand"), ("two", "two-hand")):
        report[key] = evaluate(data[key], name)
        export(data[key], out / f"{key}.json")
    (out / "eval.json").write_text(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
