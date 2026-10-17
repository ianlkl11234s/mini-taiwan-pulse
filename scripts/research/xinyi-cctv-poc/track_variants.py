"""Offline ByteTrack variants on saved post-NMS detector boxes (no inference).

Run: ../../../.venv-cctv/bin/python3 track_variants.py
Varies one axis at a time: duplicate-frame handling, fuse_score, match_thresh,
start thresholds. Metrics are proxies on distinct-content frames only; there is
no human ground truth, so higher coverage is not accuracy. Over-merge guards
(step jump / box width, class changes per ID) must be read alongside coverage.
"""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import ultralytics
import yaml
from ultralytics.engine.results import Boxes
from ultralytics.trackers.byte_tracker import BYTETracker

from track_ablation import fragment_summary, frame_boxes, iou, sha256

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "data" / "validation-observations.json"
DEFAULT_OUTPUT = ROOT / "evidence" / "track-variants.json"
CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
PERSIST_IOU = 0.3
MATCH_IOU = 0.5
JUMP_LIMIT = 1.0  # step displacement above one box width flags a suspicious link


def duplicate(frame):
    return frame.get("duplicateOfPrevious") is True or frame.get("uniqueContent") is False


def best_iou(box, rows):
    return max((iou(box, row[:4]) for row in rows), default=0.0)


def persisting_flags(unique_boxes):
    """Detector box also seen (IoU>=0.3) in the previous or next distinct frame."""
    flags = []
    for j, boxes in enumerate(unique_boxes):
        neighbours = []
        if j:
            neighbours.extend(unique_boxes[j - 1])
        if j + 1 < len(unique_boxes):
            neighbours.extend(unique_boxes[j + 1])
        flags.append([best_iou(box[:4], neighbours) >= PERSIST_IOU for box in boxes])
    return flags


def run(frames, width, height, settings, dup_mode):
    tracker = BYTETracker(SimpleNamespace(**settings))
    empty = np.zeros((0, 6), dtype=np.float32)
    outputs = []  # tracker rows on distinct frames only
    for frame in frames:
        dup = duplicate(frame)
        if dup and dup_mode == "skip":
            continue
        boxes = empty if dup and dup_mode == "empty" else frame_boxes(frame, width, height)
        rows = np.asarray(tracker.update(Boxes(boxes, (height, width))), dtype=np.float32).reshape(-1, 8)
        if not dup:
            outputs.append(rows)
    return outputs


def score(unique_boxes, flags, outputs, width, height):
    totals = Counter()
    by_class = defaultdict(Counter)
    for boxes, flag, rows in zip(unique_boxes, flags, outputs):
        for box, persists in zip(boxes, flag):
            key = "persisting" if persists else "isolated"
            hit = int(best_iou(box[:4], rows) >= MATCH_IOU)
            totals[f"{key}Boxes"] += 1
            totals[f"{key}Tracked"] += hit
            if persists:
                name = CLASS_NAMES.get(int(box[5]), "other")
                by_class[name]["boxes"] += 1
                by_class[name]["tracked"] += hit
        totals["trackerBoxes"] += len(rows)
    presence, last, classes = defaultdict(list), {}, defaultdict(set)
    jumps = []
    for j, rows in enumerate(outputs):
        for row in rows:
            tid = int(row[4])
            presence[tid].append(j)
            classes[tid].add(int(row[6]))
            if tid in last and last[tid][0] == j - 1:
                p = last[tid][1]
                w = max(row[2] - row[0], 1.0)
                cx = (row[0] + row[2]) / 2 - (p[0] + p[2]) / 2
                cy = (row[1] + row[3]) / 2 - (p[1] + p[3]) / 2
                jumps.append(float(np.hypot(cx, cy) / w))
            last[tid] = (j, row[:4])
    jumps.sort()
    rate = lambda a, b: round(totals[a] / totals[b], 4) if totals[b] else None
    return {
        "persistingCoverage": rate("persistingTracked", "persistingBoxes"),
        "isolatedCoverage": rate("isolatedTracked", "isolatedBoxes"),
        "counts": dict(totals),
        "persistingCoverageByClass": {k: round(v["tracked"] / v["boxes"], 4) for k, v in sorted(by_class.items())},
        "localTrackIds": len(presence),
        "idFragmentsOnDistinctFrames": fragment_summary(presence),
        "overMergeGuard": {
            "steps": len(jumps),
            "stepJumpOverBoxWidthP95": round(float(jumps[int(.95 * (len(jumps) - 1))]), 3) if jumps else None,
            "stepsOverOneBoxWidth": int(sum(v > JUMP_LIMIT for v in jumps)),
            "idsWithClassChange": sum(len(v) > 1 for v in classes.values()),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    camera = json.loads(args.input.read_text())["cameras"][0]
    frames, width, height = camera["frames"], camera["width"], camera["height"]
    unique_boxes = [frame_boxes(f, width, height) for f in frames if not duplicate(f)]
    flags = persisting_flags(unique_boxes)
    tracker_yaml = Path(ultralytics.__file__).resolve().parent / "cfg" / "trackers" / "bytetrack.yaml"
    base = yaml.safe_load(tracker_yaml.read_text())
    variants = {
        "A_baseline_feedDuplicates": (base, "feed"),
        "B_skipDuplicates": (base, "skip"),
        "C_emptyOnDuplicates": (base, "empty"),
        "D_fuseScoreOff": ({**base, "fuse_score": False}, "feed"),
        "E_matchThresh0.9": ({**base, "match_thresh": 0.9}, "feed"),
        "F_thresholds0.20": ({**base, "track_high_thresh": 0.2, "new_track_thresh": 0.2}, "feed"),
    }
    report = {
        "status": "offline-tracker-variants",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input": {"path": str(args.input), "sha256": sha256(args.input), "cameraId": camera["id"],
                  "frames": len(frames), "distinctFrames": len(unique_boxes), "width": width, "height": height},
        "runtime": {"ultralyticsVersion": ultralytics.__version__, "trackerYamlSha256": sha256(tracker_yaml)},
        "baseSettings": base,
        "method": {
            "evaluatedFrames": "distinct-content frames only",
            "persisting": f"detector box with IoU>={PERSIST_IOU} to a detector box in the previous or next distinct frame (proxy for real object; not ground truth)",
            "tracked": f"tracker output box on the same frame with IoU>={MATCH_IOU}",
            "duplicateModes": {"feed": "duplicate frames fed as captured", "skip": "no tracker update on duplicate frames",
                               "empty": "tracker updated with zero detections on duplicate frames (coast)"},
            "overMergeGuard": f"per-ID step displacement / box width between consecutive distinct frames; >{JUMP_LIMIT} flagged",
        },
        "limits": [
            "No human ground truth: coverage is not recall, fragments are not ID switches.",
            "Saved detector boxes are already cut at confidence 0.2; lower detector confidence cannot be tested offline.",
            "ByteTrack in this version outputs a new track only after its second matched frame, so first sightings are structurally missed.",
            "No production setting is changed by this script.",
        ],
        "variants": {},
    }
    for name, (settings, mode) in variants.items():
        result = score(unique_boxes, flags, run(frames, width, height, settings, mode), width, height)
        result["settings"] = {"duplicateMode": mode, **{k: v for k, v in settings.items() if base.get(k) != v}}
        report["variants"][name] = result
        print(name, result["persistingCoverage"], result["localTrackIds"], result["overMergeGuard"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("wrote", args.output)


if __name__ == "__main__":
    main()
