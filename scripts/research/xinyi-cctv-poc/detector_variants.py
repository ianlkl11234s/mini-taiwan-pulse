"""Compare detector settings on reviewer-corrected frames (needs the saved frame JPEGs).

Run: ../../../.venv-cctv/bin/python3 detector_variants.py <box-truth.json> --observations data/annotation-unblurred-observations.json
Each variant predicts once at a low confidence floor; thresholds are then applied
offline. Inputs are the saved JPEGs (quality 65), not the raw decoded frames the
live capture used, so the baseline is re-run here rather than taken from the batch.
Scores cover only the reviewed frames of this batch and this reviewer.
"""

import argparse
import json
import statistics
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import torch
import ultralytics
from torchvision.ops import nms
from ultralytics import YOLO

from score_annotations import ROOT, sha256
from score_boxes import score
from track_ablation import iou

FLOOR = 0.05
THRESHOLDS = (0.05, 0.1, 0.2, 0.3)
VEHICLES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
DIAGNOSTIC = {0: "person", 1: "bicycle"}
VARIANTS = [  # name, weights, imgsz, tiled
    ("n_960", "yolo26n.pt", 960, False),
    ("n_1280", "yolo26n.pt", 1280, False),
    ("n_1920", "yolo26n.pt", 1920, False),
    ("n_tiled2x2_640", "yolo26n.pt", 640, True),
    ("s_960", "yolo26s.pt", 960, False),
    ("s_1280", "yolo26s.pt", 1280, False),
    ("s_tiled2x2_640", "yolo26s.pt", 640, True),
    ("m_960", "yolo26m.pt", 960, False),
    ("m_1280", "yolo26m.pt", 1280, False),
]


def predict(model, image, imgsz):
    r = model.predict(image, conf=FLOOR, imgsz=imgsz, classes=[*VEHICLES, *DIAGNOSTIC], verbose=False, device="cpu")[0]
    return r.boxes.xyxy.cpu(), r.boxes.conf.cpu(), r.boxes.cls.cpu().int()


def tiled(model, image, imgsz, overlap=0.2):
    """Full frame plus 2x2 overlapping tiles, merged by per-class NMS."""
    h, w = image.shape[:2]
    tw, th = int(w / (2 - overlap)), int(h / (2 - overlap))
    parts = [predict(model, image, 960)]
    for x0 in (0, w - tw):
        for y0 in (0, h - th):
            xyxy, conf, cls = predict(model, image[y0:y0 + th, x0:x0 + tw], imgsz)
            parts.append((xyxy + torch.tensor([x0, y0, x0, y0]), conf, cls))
    xyxy, conf, cls = (torch.cat([p[i] for p in parts]) for i in range(3))
    keep = nms(xyxy + cls[:, None].float() * 10_000, conf, 0.5)
    return xyxy[keep], conf[keep], cls[keep]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("truth", type=Path)
    parser.add_argument("--observations", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "evidence" / "detector-variants.json")
    parser.add_argument("--only", nargs="*", help="variant names to run")
    args = parser.parse_args()
    torch.set_num_threads(4)
    import cv2
    review = json.loads(args.truth.read_text())
    source = json.loads(args.observations.read_text())
    if review["captureRunId"] != source["captureRunId"]:
        raise SystemExit("captureRunId mismatch")
    camera = next(c for c in source["cameras"] if c["id"] == review["cameraId"])
    frames = camera["frames"]
    reviewed = [f for f in review["frames"] if f.get("reviewed")]
    images = {f["frameIndex"]: cv2.imread(str(ROOT / frames[f["frameIndex"]]["imageUrl"])) for f in reviewed}
    if any(img is None for img in images.values()):
        raise SystemExit("frame JPEG missing; were the local frames deleted?")
    report = {
        "status": "detector-variants-on-reviewer-truth",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "truth": {"path": str(args.truth), "sha256": sha256(args.truth), "reviewedFrames": len(reviewed),
                  "truthByClass": dict(Counter(b["className"] for f in reviewed for b in f["boxes"]))},
        "observations": {"captureRunId": source["captureRunId"], "sha256": sha256(args.observations),
                         "framesBlurred": source.get("captureSettings", {}).get("framesBlurred")},
        "runtime": {"ultralyticsVersion": ultralytics.__version__, "device": "cpu", "torchThreads": 4},
        "method": "predict once at conf 0.05 incl. person/bicycle diagnostics; vehicle classes scored at each threshold with score_boxes (IoU>=0.5, class checked separately)",
        "limits": ["Saved JPEG q65 input, not raw frames.", "One 12s night clip, one reviewer.",
                   "Latency is this Mac's CPU with 4 threads; not a deployment benchmark."],
        "variants": {},
    }
    for name, weights, imgsz, is_tiled in VARIANTS:
        if args.only and name not in args.only:
            continue
        path = ROOT / "models" / weights
        if not path.is_file():
            report["variants"][name] = {"skipped": f"missing {weights}"}
            continue
        model = YOLO(str(path))
        model.predict(next(iter(images.values())), imgsz=imgsz, verbose=False, device="cpu")  # warmup
        raw, timings = {}, []
        for index, image in images.items():
            start = time.perf_counter()
            raw[index] = tiled(model, image, imgsz) if is_tiled else predict(model, image, imgsz)
            timings.append((time.perf_counter() - start) * 1000)
        h, w = next(iter(images.values())).shape[:2]
        result = {"weights": weights, "weightsSha256": sha256(path), "imgsz": imgsz, "tiled": is_tiled,
                  "latencyMedianMs": round(statistics.median(timings), 1), "thresholds": {}}
        for threshold in THRESHOLDS:
            per_frame = [[] for _ in frames]
            for index, (xyxy, conf, cls) in raw.items():
                per_frame[index] = [[b[0] / w, b[1] / h, b[2] / w, b[3] / h, None, VEHICLES[int(k)]]
                                    for b, c, k in zip(xyxy.tolist(), conf.tolist(), cls.tolist())
                                    if c >= threshold and int(k) in VEHICLES]
            s = score(review, per_frame)
            result["thresholds"][str(threshold)] = {k: s[k] for k in ("recall", "precision", "missed", "extra", "byClass", "classConfusion")}
        # Are missed motorcycles seen as person/bicycle at the floor?
        seen_as = Counter()
        for f in reviewed:
            xyxy, conf, cls = raw[f["frameIndex"]]
            boxes = [([b[0] / w, b[1] / h, b[2] / w, b[3] / h], DIAGNOSTIC.get(int(k), VEHICLES.get(int(k))))
                     for b, k in zip(xyxy.tolist(), cls.tolist())]
            for t in f["boxes"]:
                if t["className"] != "motorcycle":
                    continue
                best = max(((iou(t["bbox"], b), n) for b, n in boxes), default=(0, None))
                seen_as[best[1] if best[0] >= 0.3 else "nothing"] += 1
        result["truthMotorcycleBestMatchAtFloor"] = dict(seen_as)
        report["variants"][name] = result
        t2 = result["thresholds"]["0.2"]
        print(name, f"{result['latencyMedianMs']}ms", "@0.2", t2["recall"], t2["precision"],
              {c: v["recall"] for c, v in t2["byClass"].items()}, "moto@floor", dict(seen_as), flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("wrote", args.output)


if __name__ == "__main__":
    main()
