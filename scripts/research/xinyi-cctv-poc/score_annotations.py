"""Score tracker outputs against manual per-vehicle keyframe annotation.

Run: ../../../.venv-cctv/bin/python3 score_annotations.py annotation-T000354-<run>-first.json
Variants: the saved live model.track output plus offline ByteTrack replays of the
saved detector boxes (A baseline, D fuse_score off, E match_thresh 0.9).

A keyframe is matched when the reviewer's bottom-centre point lies inside a
tracker box expanded by MARGIN; each box can serve one vehicle per frame.
Only visible keyframes on distinct-content frames are scored. Metrics hold only
for the reviewed window and the reviewer's judgement; they are not city-wide.
"""

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_OBSERVATIONS = ROOT / "data" / "validation-observations.json"
MARGIN = 0.15
MIN_FALSE_TRACK_FRAMES = 3
SAME_TIME = 1e-3


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duplicate(frame):
    return frame.get("duplicateOfPrevious") is True or frame.get("uniqueContent") is False


def position_at(vehicle, t):
    frames = vehicle["keyframes"]
    if not frames or t < frames[0]["t"] - SAME_TIME or t > frames[-1]["t"] + SAME_TIME:
        return None
    for i, k in enumerate(frames):
        if abs(k["t"] - t) < SAME_TIME:
            return k["x"], k["y"]
        if i + 1 < len(frames) and k["t"] < t < frames[i + 1]["t"]:
            n = frames[i + 1]
            a = (t - k["t"]) / (n["t"] - k["t"])
            return k["x"] + (n["x"] - k["x"]) * a, k["y"] + (n["y"] - k["y"]) * a
    return None


def contains(box, point):
    x1, y1, x2, y2 = box[:4]
    mx, my = (x2 - x1) * MARGIN, (y2 - y1) * MARGIN
    return x1 - mx <= point[0] <= x2 + mx and y1 - my <= point[1] <= y2 + my


def assign(points, boxes):
    """Greedy one box per vehicle: nearest bottom-centre (in box heights) first."""
    pairs = []
    for vid, point in points.items():
        for j, box in enumerate(boxes):
            if contains(box, point):
                cx, bottom, h = (box[0] + box[2]) / 2, box[3], max(box[3] - box[1], 1e-6)
                pairs.append((((point[0] - cx) ** 2 + (point[1] - bottom) ** 2) ** .5 / h, vid, j))
    used_v, used_b, out = set(), set(), {}
    for _d, vid, j in sorted(pairs):
        if vid not in used_v and j not in used_b:
            used_v.add(vid)
            used_b.add(j)
            out[vid] = boxes[j]
    return out


def live_boxes(frames):
    """Saved model.track output: [x1,y1,x2,y2,id,className] normalized."""
    return [[[*d["bbox"], d["id"], d.get("className")] for d in f.get("detections", [])
             if isinstance(d.get("bbox"), list) and len(d["bbox"]) == 4] for f in frames]


def replay_boxes(frames, width, height, overrides):
    import numpy as np
    import ultralytics
    import yaml
    from types import SimpleNamespace
    from ultralytics.engine.results import Boxes
    from ultralytics.trackers.byte_tracker import BYTETracker
    from track_ablation import frame_boxes

    names = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
    tracker_yaml = Path(ultralytics.__file__).resolve().parent / "cfg" / "trackers" / "bytetrack.yaml"
    tracker = BYTETracker(SimpleNamespace(**{**yaml.safe_load(tracker_yaml.read_text()), **overrides}))
    out = []
    for frame in frames:
        rows = np.asarray(tracker.update(Boxes(frame_boxes(frame, width, height), (height, width))),
                          dtype=np.float32).reshape(-1, 8)
        out.append([[float(r[0]) / width, float(r[1]) / height, float(r[2]) / width, float(r[3]) / height,
                     f"track-{int(r[4])}", names.get(int(r[6]))] for r in rows])
    return out


def score(annotation, frames, boxes_per_frame):
    start, end = annotation["window"]["start"], annotation["window"]["end"]
    index = {round(f["t"], 3): i for i, f in enumerate(frames)}
    vehicles = annotation["vehicles"]
    totals, by_class, skipped = Counter(), defaultdict(Counter), Counter()
    ids_by_vehicle, vehicles_by_id = defaultdict(list), defaultdict(set)
    for vehicle in vehicles:
        for k in vehicle["keyframes"]:
            i = index.get(round(k["t"], 3))
            if i is None or not start - SAME_TIME <= k["t"] <= end + SAME_TIME:
                skipped["outsideWindowOrNoFrame"] += 1
                continue
            if k.get("visibility") != "visible":
                skipped[f"visibility:{k.get('visibility')}"] += 1
                continue
            if duplicate(frames[i]) or k.get("duplicateFrame"):
                skipped["duplicateFrame"] += 1
                continue
            totals["visibleKeyframes"] += 1
            by_class[vehicle["className"]]["keyframes"] += 1
            points = {v["id"]: position_at(v, k["t"]) for v in vehicles}
            points = {vid: p for vid, p in points.items() if p is not None}
            hit = assign(points, boxes_per_frame[i]).get(vehicle["id"])
            if hit:
                totals["matchedKeyframes"] += 1
                by_class[vehicle["className"]]["matched"] += 1
                ids_by_vehicle[vehicle["id"]].append((k["t"], hit[4]))
                vehicles_by_id[hit[4]].add(vehicle["id"])
                if hit[5] and vehicle["className"] != "unknown" and hit[5] != vehicle["className"]:
                    totals["classDisagreements"] += 1
    switches, distinct_ids = 0, []
    for seq in ids_by_vehicle.values():
        seq.sort()
        switches += sum(a[1] != b[1] for a, b in zip(seq, seq[1:]))
        distinct_ids.append(len({tid for _t, tid in seq}))
    result = {
        "visibleKeyframes": totals["visibleKeyframes"],
        "keyframeHitRate": round(totals["matchedKeyframes"] / totals["visibleKeyframes"], 4) if totals["visibleKeyframes"] else None,
        "keyframeHitRateByClass": {c: round(v["matched"] / v["keyframes"], 4) for c, v in sorted(by_class.items()) if v["keyframes"]},
        "vehicles": len(vehicles),
        "vehiclesEverTracked": len(ids_by_vehicle),
        "idSwitches": switches,
        "meanTrackerIdsPerTrackedVehicle": round(sum(distinct_ids) / len(distinct_ids), 3) if distinct_ids else None,
        "trackerIdsSharedByVehicles": sum(len(v) > 1 for v in vehicles_by_id.values()),
        "classDisagreements": totals["classDisagreements"],
        "skippedKeyframes": dict(skipped),
    }
    if annotation.get("allVisibleVehiclesAnnotated") is True:
        frames_by_id, explained_by_id = Counter(), Counter()
        for i, frame in enumerate(frames):
            if duplicate(frame) or not start <= frame["t"] <= end:
                continue
            points = [p for p in (position_at(v, frame["t"]) for v in vehicles) if p is not None]
            for box in boxes_per_frame[i]:
                frames_by_id[box[4]] += 1
                explained_by_id[box[4]] += any(contains(box, p) for p in points)
        result["unexplainedTrackerIds"] = sum(
            n >= MIN_FALSE_TRACK_FRAMES and explained_by_id[tid] == 0 for tid, n in frames_by_id.items())
    else:
        result["unexplainedTrackerIds"] = None
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("annotation", type=Path)
    parser.add_argument("--observations", type=Path, default=DEFAULT_OBSERVATIONS)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--live-only", action="store_true", help="skip offline replays (no ultralytics needed)")
    args = parser.parse_args()
    annotation = json.loads(args.annotation.read_text())
    source = json.loads(args.observations.read_text())
    if annotation.get("captureRunId") != source.get("captureRunId"):
        raise SystemExit(f"captureRunId mismatch: annotation {annotation.get('captureRunId')} vs data {source.get('captureRunId')}")
    camera = next(c for c in source["cameras"] if c["id"] == annotation.get("cameraId"))
    frames = sorted(camera["frames"], key=lambda f: f["t"])
    variants = {"live_savedModelTrack": live_boxes(frames)}
    if not args.live_only:
        w, h = camera["width"], camera["height"]
        variants["A_replayDefaults"] = replay_boxes(frames, w, h, {})
        variants["D_fuseScoreOff"] = replay_boxes(frames, w, h, {"fuse_score": False})
        variants["E_matchThresh0.9"] = replay_boxes(frames, w, h, {"match_thresh": 0.9})
    report = {
        "status": "manual-annotation-score",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "annotation": {"path": str(args.annotation), "sha256": sha256(args.annotation),
                       "pass": annotation.get("pass"), "annotator": annotation.get("annotator"),
                       "window": annotation.get("window"), "vehicles": len(annotation["vehicles"]),
                       "allVisibleVehiclesAnnotated": annotation.get("allVisibleVehiclesAnnotated") is True,
                       "validationErrors": annotation.get("validationErrors", [])},
        "observations": {"path": str(args.observations), "sha256": sha256(args.observations),
                         "captureRunId": source.get("captureRunId"), "cameraId": camera["id"]},
        "method": {"match": f"bottom-centre point inside tracker box expanded {MARGIN:.0%}; one box per vehicle per frame",
                   "scored": "visible keyframes on distinct-content frames inside the window",
                   "unexplainedTrackerIds": f"tracker IDs on >= {MIN_FALSE_TRACK_FRAMES} distinct frames never containing an annotated (or interpolated) vehicle point; only when reviewer declared the window complete"},
        "limits": ["Single reviewer pass unless a second pass is scored separately.",
                   "Interpolated positions between keyframes are assumptions used only for the unexplained-ID check.",
                   "Results cover this window of this batch only."],
        "variants": {name: score(annotation, frames, boxes) for name, boxes in variants.items()},
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    output = args.output or ROOT / "evidence" / f"annotation-score-{annotation.get('pass', 'pass')}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text)
    for name, v in report["variants"].items():
        print(name, {k: v[k] for k in ("keyframeHitRate", "vehiclesEverTracked", "idSwitches", "trackerIdsSharedByVehicles", "unexplainedTrackerIds")})
    print("wrote", output)


if __name__ == "__main__":
    main()
