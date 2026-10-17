"""Pick a diverse batch of collected stills and pre-label it for annotate.html.

Run: ../../../.venv-cctv/bin/python3 prelabel.py --batch batch-001 --count 40
Open: http://127.0.0.1:3747/annotate.html?batch=batch-001
One still per (camera, collection run), round-robin across cameras so each batch
spreads over cameras and hours; stills already in an earlier batch are skipped.
Vehicles come from the COCO model. Optional --rider-suggestions turns persons/
bicycles outside vehicle boxes into dashed "motorcycle?" boxes; off by default
because on the 62-frame night truth only 3 of 262 such m-model person boxes were
riders and aspect ratio could not separate them (mostly pedestrians).
"""

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2
import torch
from ultralytics import YOLO

from score_annotations import sha256
from track_ablation import iou

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "data" / "training-raw" / "manifest.jsonl"
BATCH_DIR = ROOT / "data" / "training-batches"
SPLIT = ROOT / "training-split.json"
VEHICLES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
VEHICLE_CONF = 0.25
RIDER_CONF = 0.10
RIDER_EXTEND = 0.15  # grow person box downward to cover the scooter body


def covered(box, other):
    """Fraction of `box` area lying inside `other`."""
    w = max(0.0, min(box[2], other[2]) - max(box[0], other[0]))
    h = max(0.0, min(box[3], other[3]) - max(box[1], other[1]))
    area = max(1e-9, (box[2] - box[0]) * (box[3] - box[1]))
    return w * h / area


def spread(n):
    """Indices 0..n-1 ordered so any prefix is spread evenly: ends, middle, quarters..."""
    order, step = [], [0, n - 1] if n > 1 else [0]
    seen = set()
    for i in step:
        if i not in seen:
            seen.add(i); order.append(i)
    parts = 2
    while len(order) < n:
        for k in range(1, parts, 2):
            i = round(k * (n - 1) / parts)
            if i not in seen:
                seen.add(i); order.append(i)
        parts *= 2
        if parts > 4 * n:
            order += [i for i in range(n) if i not in seen]
    return order


def pool_of(row, split):
    """train / val / test for one collected still, from training-split.json."""
    if row["cameraId"] in split["testCameras"]:
        return "test"
    local = datetime.fromisoformat(row["receivedAt"]).astimezone(ZoneInfo("Asia/Taipei"))
    v = split["validation"]
    if local.strftime("%Y-%m-%d") == v["validationDate"] and local.hour in v["validationHours"]:
        return "val"
    return "train"


def pick(rows, already, count):
    groups = defaultdict(list)
    for row in rows:
        if row["file"] not in already:
            groups[(row["cameraId"], row["runId"])].append(row)
    per_camera = defaultdict(list)
    for (camera, _run), items in sorted(groups.items()):
        items.sort(key=lambda r: r["receivedAt"])
        per_camera[camera].append(items[len(items) // 2])
    for items in per_camera.values():  # visit each camera's runs spread over the day, not earliest-first
        items.sort(key=lambda r: r["receivedAt"])
        items[:] = [items[i] for i in spread(len(items))]
    chosen, cameras = [], sorted(per_camera)
    while len(chosen) < count and any(per_camera.values()):
        for camera in cameras:
            if per_camera[camera] and len(chosen) < count:
                chosen.append(per_camera[camera].pop(0))
    return chosen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True)
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--model", type=Path, default=ROOT / "models" / "yolo26m.pt")
    parser.add_argument("--rider-suggestions", action="store_true")
    parser.add_argument("--pool", choices=["train", "val", "test", "any"], default="any")
    args = parser.parse_args()
    out = BATCH_DIR / f"{args.batch}.json"
    if out.exists():
        raise SystemExit(f"{out} exists; choose a new --batch name")
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    already = {f["imageUrl"] for p in BATCH_DIR.glob("*.json") for f in json.loads(p.read_text())["frames"]}
    rows = [json.loads(line) for line in MANIFEST.open()]
    split = json.loads(SPLIT.read_text())
    if args.pool != "any":
        rows = [r for r in rows if pool_of(r, split) == args.pool]
    chosen = pick(rows, already, args.count)
    torch.set_num_threads(4)
    model = YOLO(str(args.model))
    frames = []
    for row in chosen:
        image = cv2.imread(str(ROOT / row["file"]))
        h, w = image.shape[:2]
        r = model.predict(image, conf=RIDER_CONF, imgsz=960, classes=[0, 1, *VEHICLES], verbose=False, device="cpu")[0]
        boxes = [([b[0] / w, b[1] / h, b[2] / w, b[3] / h], c, int(k))
                 for b, c, k in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist())]
        detections = [{"className": VEHICLES[k], "confidence": round(c, 4), "bbox": b}
                      for b, c, k in boxes if k in VEHICLES and c >= VEHICLE_CONF]
        for b, c, k in boxes if args.rider_suggestions else []:
            if k not in (0, 1):
                continue
            grown = [b[0], b[1], b[2], min(1.0, b[3] + RIDER_EXTEND * (b[3] - b[1]))]
            # Riders on an already-detected motorcycle (or people inside a car/bus) are not new vehicles.
            if any(covered(b, d["bbox"]) > 0.3 for d in detections):
                continue
            detections.append({"className": "motorcycle", "confidence": round(c, 4), "bbox": grown,
                               "suggested": True, "fromClass": "person" if k == 0 else "bicycle"})
        frames.append({"pool": pool_of(row, split), "imageUrl": row["file"], "sha256": row["sha256"], "cameraId": row["cameraId"],
                       "receivedAt": row["receivedAt"], "detectorDetections": detections})
    batch = {"batchId": args.batch, "createdAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "width": chosen[0]["width"], "height": chosen[0]["height"],
             "prelabel": {"model": args.model.name, "modelSha256": sha256(args.model), "imgsz": 960,
                          "vehicleConf": VEHICLE_CONF, "riderSuggestions": args.rider_suggestions,
                          "riderConf": RIDER_CONF, "riderExtend": RIDER_EXTEND},
             "selection": "one still per camera-run, round-robin across cameras; skips stills in earlier batches",
             "pool": args.pool,
             "frames": frames}
    out.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n")
    hours = sorted({datetime.fromisoformat(f["receivedAt"]).astimezone().strftime("%H") for f in frames})
    print("local hours:", hours)
    cams = defaultdict(int)
    for f in frames:
        cams[f["cameraId"]] += 1
    n_v = sum(1 for f in frames for d in f["detectorDetections"] if not d.get("suggested"))
    n_s = sum(1 for f in frames for d in f["detectorDetections"] if d.get("suggested"))
    print(f"wrote {out}: {len(frames)} stills, {len(cams)} cameras, {n_v} vehicle boxes, {n_s} motorcycle? suggestions")


if __name__ == "__main__":
    main()
