"""Score detector/tracker outputs against reviewer-corrected boxes (annotate.html).

Run: ../../../.venv-cctv/bin/python3 score_boxes.py box-truth-T000354-<run>.json [--live-only]
Only frames the reviewer marked done are scored. Greedy one-to-one IoU>=0.5.
Truth started from detector boxes, so it can lean toward what the detector saw;
missed vehicles count only if the reviewer added them. Covers these frames only.
"""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from score_annotations import DEFAULT_OBSERVATIONS, ROOT, live_boxes, replay_boxes, sha256
from track_ablation import iou

IOU = 0.5


def match(truth, output):
    pairs = sorted(((iou(t["bbox"], o[:4]), i, j) for i, t in enumerate(truth) for j, o in enumerate(output)), reverse=True)
    used_t, used_o, out = set(), set(), []
    for overlap, i, j in pairs:
        if overlap >= IOU and i not in used_t and j not in used_o:
            used_t.add(i)
            used_o.add(j)
            out.append((i, j))
    return out


def score(review, per_frame):
    totals, by_class, confusion = Counter(), defaultdict(Counter), Counter()
    for frame in review["frames"]:
        if not frame.get("reviewed"):
            continue
        truth, output = frame["boxes"], per_frame[frame["frameIndex"]]
        pairs = match(truth, output)
        totals["frames"] += 1
        totals["truth"] += len(truth)
        totals["output"] += len(output)
        totals["matched"] += len(pairs)
        for t in truth:
            by_class[t["className"]]["truth"] += 1
        for i, j in pairs:
            t_cls, o_cls = truth[i]["className"], output[j][5]
            by_class[t_cls]["matched"] += 1
            by_class[t_cls]["classCorrect"] += o_cls == t_cls
            if o_cls != t_cls:
                confusion[f"{t_cls}->{o_cls}"] += 1
    rate = lambda a, b: round(a / b, 4) if b else None
    return {
        "scoredFrames": totals["frames"], "truthBoxes": totals["truth"], "outputBoxes": totals["output"],
        "recall": rate(totals["matched"], totals["truth"]), "precision": rate(totals["matched"], totals["output"]),
        "missed": totals["truth"] - totals["matched"], "extra": totals["output"] - totals["matched"],
        "byClass": {c: {"truth": v["truth"], "recall": rate(v["matched"], v["truth"]),
                        "classCorrectWhenMatched": rate(v["classCorrect"], v["matched"])} for c, v in sorted(by_class.items())},
        "classConfusion": dict(confusion.most_common()),
    }


def detector_boxes(frames):
    return [[[*d["bbox"], None, d.get("className")] for d in f.get("detectorDetections", [])] for f in frames]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("truth", type=Path)
    parser.add_argument("--observations", type=Path, default=DEFAULT_OBSERVATIONS)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--live-only", action="store_true")
    args = parser.parse_args()
    review = json.loads(args.truth.read_text())
    source = json.loads(args.observations.read_text())
    if review.get("captureRunId") != source.get("captureRunId"):
        raise SystemExit(f"captureRunId mismatch: {review.get('captureRunId')} vs {source.get('captureRunId')}")
    camera = next(c for c in source["cameras"] if c["id"] == review["cameraId"])
    frames = camera["frames"]  # frameIndex refers to capture order, not re-sorted
    variants = {"detector_predictNMS": detector_boxes(frames), "live_savedModelTrack": live_boxes(frames)}
    if not args.live_only:
        w, h = camera["width"], camera["height"]
        variants["A_replayDefaults"] = replay_boxes(frames, w, h, {})
        variants["D_fuseScoreOff"] = replay_boxes(frames, w, h, {"fuse_score": False})
        variants["E_matchThresh0.9"] = replay_boxes(frames, w, h, {"match_thresh": 0.9})
    report = {
        "status": "reviewer-box-truth-score",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "truth": {"path": str(args.truth), "sha256": sha256(args.truth), "summary": review.get("summary"),
                  "startedFrom": review.get("startedFrom")},
        "observations": {"path": str(args.observations), "sha256": sha256(args.observations), "captureRunId": source.get("captureRunId")},
        "method": f"reviewed frames only; greedy one-to-one IoU>={IOU}; class checked separately",
        "limits": ["Truth was edited from detector boxes (anchoring bias toward detector).",
                   "Single reviewer unless a second file is scored.", "Only the reviewed frames of this batch."],
        "variants": {name: score(review, boxes) for name, boxes in variants.items()},
    }
    output = args.output or ROOT / "evidence" / "box-truth-score.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for name, v in report["variants"].items():
        print(name, {k: v[k] for k in ("recall", "precision", "missed", "extra")}, {c: x["recall"] for c, x in v["byClass"].items()})
    print("wrote", output)


if __name__ == "__main__":
    main()
