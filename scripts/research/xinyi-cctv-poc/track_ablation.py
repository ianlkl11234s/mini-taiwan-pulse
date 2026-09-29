"""Replay stored post-NMS detector boxes through installed ByteTrack, without inference.

Run: /private/tmp/cctv-traffic-venv/bin/python3 track_ablation.py
Only the two threshold fields differ. This is tracker-behaviour evidence, not
accuracy or recall measurement: there are no human ground-truth identities.
"""

import argparse
import hashlib
import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import ultralytics
import yaml
from ultralytics.engine.results import Boxes
from ultralytics.trackers.byte_tracker import BYTETracker


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "data" / "validation-observations.json"
DEFAULT_OUTPUT = ROOT / "evidence" / "track-ablation.json"
CLASS_IDS = {"car": 2, "motorcycle": 3, "bus": 5, "truck": 7}
IOU_THRESHOLD = 0.5
MAX_FRAMES = 1500


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iou(a, b):
    left = max(a[0], b[0])
    top = max(a[1], b[1])
    right = min(a[2], b[2])
    bottom = min(a[3], b[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def matched_count(detections, tracks):
    """One-to-one geometric matches, highest IoU first, within one frame."""
    pairs = []
    for i, detection in enumerate(detections):
        for j, track in enumerate(tracks):
            overlap = iou(detection[:4], track[:4])
            if overlap >= IOU_THRESHOLD:
                pairs.append((overlap, i, j))
    used_detections, used_tracks = set(), set()
    for _overlap, i, j in sorted(pairs, reverse=True):
        if i not in used_detections and j not in used_tracks:
            used_detections.add(i)
            used_tracks.add(j)
    return len(used_detections)


def frame_boxes(frame, width, height):
    values = []
    for item in frame.get("detectorDetections", []):
        bbox = item.get("bbox")
        cls = CLASS_IDS.get(item.get("className"))
        confidence = item.get("confidence")
        if (cls is None or not isinstance(bbox, list) or len(bbox) != 4
                or not all(isinstance(v, (int, float)) and np.isfinite(v) for v in bbox)
                or not isinstance(confidence, (int, float)) or not np.isfinite(confidence)):
            continue
        x1, y1, x2, y2 = bbox
        if not (0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1 and 0 <= confidence <= 1):
            continue
        values.append([x1 * width, y1 * height, x2 * width, y2 * height,
                       float(confidence), float(cls)])
    return np.asarray(values, dtype=np.float32).reshape(-1, 6)


def fragment_summary(presence):
    lengths = []
    for indices in presence.values():
        start = previous = indices[0]
        for index in indices[1:]:
            if index > previous + 1:
                lengths.append(previous - start + 1)
                start = index
            previous = index
        lengths.append(previous - start + 1)
    bins = {"1": 0, "2-3": 0, "4-9": 0, "10-24": 0, "25+": 0}
    for length in lengths:
        name = "1" if length == 1 else "2-3" if length <= 3 else (
            "4-9" if length <= 9 else "10-24" if length <= 24 else "25+")
        bins[name] += 1
    ordered = sorted(lengths)
    return {
        "fragments": len(lengths),
        "shortFragmentsAtMost3Frames": sum(length <= 3 for length in lengths),
        "lengthBinsFrames": bins,
        "medianLengthFrames": statistics.median(ordered) if ordered else None,
        "p90LengthFrames": ordered[min(len(ordered) - 1, int(.9 * (len(ordered) - 1)))] if ordered else None,
        "maxLengthFrames": max(ordered) if ordered else None,
    }


def replay(frames, width, height, settings):
    tracker = BYTETracker(SimpleNamespace(**settings))
    totals = Counter()
    presence = defaultdict(list)
    unique_presence = defaultdict(list)
    unique_index = -1
    for frame_index, frame in enumerate(frames):
        duplicate = frame.get("duplicateOfPrevious") is True or frame.get("uniqueContent") is False
        partition = "duplicate" if duplicate else "unique"
        if not duplicate:
            unique_index += 1
        detections = frame_boxes(frame, width, height)
        tracked = tracker.update(Boxes(detections, (height, width)))
        tracked = np.asarray(tracked, dtype=np.float32).reshape(-1, 8)
        matches = matched_count(detections, tracked)
        totals["frames"] += 1
        totals[f"{partition}Frames"] += 1
        totals["detectorBoxes"] += len(detections)
        totals[f"{partition}DetectorBoxes"] += len(detections)
        totals["trackerBoxes"] += len(tracked)
        totals[f"{partition}TrackerBoxes"] += len(tracked)
        totals["matchedDetectorBoxesIoU0.5"] += matches
        totals[f"{partition}MatchedDetectorBoxesIoU0.5"] += matches
        if len(detections):
            totals["framesWithDetectorBoxes"] += 1
            if not len(tracked):
                totals["framesDetectorPresentTrackerMissing"] += 1
        else:
            totals["framesWithoutDetectorBoxes"] += 1
        if len(tracked):
            totals["framesWithTrackerBoxes"] += 1
            totals[f"{partition}FramesWithTrackerBoxes"] += 1
        else:
            totals["framesWithoutTrackerBoxes"] += 1
        for track_id in set(int(row[4]) for row in tracked):
            presence[track_id].append(frame_index)
            if not duplicate:
                unique_presence[track_id].append(unique_index)
    metrics = dict(totals)
    for key in ("framesWithoutDetectorBoxes", "framesWithoutTrackerBoxes",
                "framesDetectorPresentTrackerMissing", "uniqueFramesWithTrackerBoxes",
                "duplicateFramesWithTrackerBoxes", "uniqueMatchedDetectorBoxesIoU0.5",
                "duplicateMatchedDetectorBoxesIoU0.5"):
        metrics.setdefault(key, 0)
    metrics["totalLocalTrackIds"] = len(presence)
    metrics["idFragments"] = fragment_summary(presence)
    metrics["uniqueContentLocalTrackIds"] = len(unique_presence)
    metrics["uniqueContentIdFragments"] = fragment_summary(unique_presence)
    metrics["unmatchedDetectorBoxesIoU0.5"] = (
        metrics.get("detectorBoxes", 0) - metrics.get("matchedDetectorBoxesIoU0.5", 0))
    return metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source = json.loads(args.input.read_text())
    cameras = source.get("cameras", [])
    if len(cameras) != 1 or cameras[0].get("id") != "T000354":
        raise ValueError("Expected one T000354 camera in validation-observations.json")
    camera = cameras[0]
    frames = camera.get("frames", [])[:MAX_FRAMES]
    width, height = camera.get("width"), camera.get("height")
    if not frames or not all(isinstance(v, int) and v > 0 for v in (width, height)):
        raise ValueError("Missing frames or frame dimensions")
    tracker_yaml = Path(ultralytics.__file__).resolve().parent / "cfg" / "trackers" / "bytetrack.yaml"
    defaults = yaml.safe_load(tracker_yaml.read_text())
    changed = {**defaults, "track_high_thresh": 0.20, "new_track_thresh": 0.20}
    report = {
        "status": "offline-tracker-ablation",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input": {"path": str(args.input), "sha256": sha256(args.input),
                  "cameraId": camera["id"], "availableFrames": len(camera["frames"]),
                  "replayedFramesPerVariant": len(frames), "maxFrames": MAX_FRAMES,
                  "width": width, "height": height,
                  "savedStage": "detectorDetections post-NMS; normalized coordinates and rounded confidence"},
        "runtime": {"python": str(Path(__import__("sys").executable)),
                    "ultralyticsVersion": ultralytics.__version__,
                    "trackerYamlPath": str(tracker_yaml), "trackerYamlSha256": sha256(tracker_yaml),
                    "trackerApi": "BYTETracker(args).update(Boxes(Nx6 xyxy-conf-cls, orig_shape))",
                    "frameRateNote": "Installed 8.4.160 BYTETracker(args) has no frame_rate argument; unchanged track_buffer=30 frames matches installed YAML and current model.track use."},
        "settings": {"A_installedDefaults": defaults, "B_thresholds0.20": changed,
                     "onlyChangedFields": ["track_high_thresh", "new_track_thresh"]},
        "matchingMethod": "Greedy one-to-one same-frame IoU >= 0.5 between saved detector box and tracker output box; class and identity are not human-verified.",
        "variants": {},
        "limits": [
            "No human-labelled detections or identities: counts cannot establish accuracy, recall, ID stability truth, or production superiority.",
            "Saved detector.predict outputs were a separate inference call from original model.track; A is a replay baseline, not an exact reproduction of saved live track IDs.",
            "Duplicate-content frames are replayed as captured and reported separately; no buffer/frame-rate change is made.",
            "No production tracker config is changed by this script.",
        ],
    }
    report["variants"]["A_installedDefaults"] = replay(frames, width, height, defaults)
    report["variants"]["B_thresholds0.20"] = replay(frames, width, height, changed)
    baseline = report["variants"]["A_installedDefaults"]
    alternative = report["variants"]["B_thresholds0.20"]
    report["comparison"] = {
        "B_minus_A": {
            "matchedDetectorBoxesIoU0.5": alternative["matchedDetectorBoxesIoU0.5"] - baseline["matchedDetectorBoxesIoU0.5"],
            "uniqueMatchedDetectorBoxesIoU0.5": alternative["uniqueMatchedDetectorBoxesIoU0.5"] - baseline["uniqueMatchedDetectorBoxesIoU0.5"],
            "duplicateMatchedDetectorBoxesIoU0.5": alternative["duplicateMatchedDetectorBoxesIoU0.5"] - baseline["duplicateMatchedDetectorBoxesIoU0.5"],
            "totalLocalTrackIds": alternative["totalLocalTrackIds"] - baseline["totalLocalTrackIds"],
            "idFragments": alternative["idFragments"]["fragments"] - baseline["idFragments"]["fragments"],
            "shortFragmentsAtMost3Frames": (
                alternative["idFragments"]["shortFragmentsAtMost3Frames"]
                - baseline["idFragments"]["shortFragmentsAtMost3Frames"]),
            "uniqueContentShortFragmentsAtMost3Frames": (
                alternative["uniqueContentIdFragments"]["shortFragmentsAtMost3Frames"]
                - baseline["uniqueContentIdFragments"]["shortFragmentsAtMost3Frames"]),
        },
        "manualReviewPriority": "Inspect A/default as baseline first; B has fewer geometric detector matches and more short ID fragments in this replay. Inspect B-only low-confidence starts only if that specific tradeoff matters.",
        "interpretationBoundary": "These are detector-to-tracker agreement and ID-fragment proxies, not detection accuracy, recall, true identity continuity, or evidence to switch production settings.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output),
                      "variants": {name: {key: value for key, value in metrics.items()
                                           if key in ("framesWithTrackerBoxes", "matchedDetectorBoxesIoU0.5",
                                                      "totalLocalTrackIds", "framesDetectorPresentTrackerMissing")}
                                   for name, metrics in report["variants"].items()}},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
