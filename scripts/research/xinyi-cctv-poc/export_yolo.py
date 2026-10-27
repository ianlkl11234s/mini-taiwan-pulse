"""Turn reviewed box-truth JSONs (annotate.html downloads) into a YOLO dataset.

Run: ../../../.venv-cctv/bin/python3 export_yolo.py ~/Downloads/box-truth-batch-*.json
Writes data/yolo-dataset/{images,labels}/{train,val,test}/ and data.yaml.
Only frames marked done are exported. Emergency tags (ambulance/police/fire)
do not change the YOLO class; they are listed in emergency-boxes.json for a
later crop classifier. The split comes from training-split.json
(camera + time), not from the batch name, so batch-001's test-camera frames
land in test. Images are hard-linked (no extra disk) and stay UNBLURRED: local
only, delete after training.
"""

import argparse
import json
import os
import shutil
from collections import Counter
from pathlib import Path

from prelabel import SPLIT, pool_of

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "yolo-dataset"
CLASSES = ["car", "motorcycle", "bus", "truck"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("truth", nargs="+", type=Path)
    args = parser.parse_args()
    split = json.loads(SPLIT.read_text())
    if OUT.exists():
        shutil.rmtree(OUT)
    seen, stats, skipped, emergency = set(), Counter(), Counter(), []
    for path in args.truth:
        review = json.loads(path.read_text())
        for frame in review["frames"]:
            if not frame.get("reviewed"):
                skipped["notDone"] += 1
                continue
            if any(box.get("suggested") for box in frame["boxes"]):
                skipped["pendingSuggestions"] += 1  # 待確認的『機車?』不是真值
                continue
            if frame.get("cameraId") is None or frame.get("receivedAt") is None:
                skipped["notATrainingStill"] += 1  # e.g. 9/29 replay frames: separate night test set
                continue
            if frame["imageUrl"] in seen:
                skipped["duplicateAcrossFiles"] += 1
                continue
            seen.add(frame["imageUrl"])
            pool = pool_of(frame, split)
            src = ROOT / frame["imageUrl"]
            stem = src.stem
            image_dir, label_dir = OUT / "images" / pool, OUT / "labels" / pool
            image_dir.mkdir(parents=True, exist_ok=True)
            label_dir.mkdir(parents=True, exist_ok=True)
            os.link(src, image_dir / src.name)
            lines = []
            for box in frame["boxes"]:
                x1, y1, x2, y2 = box["bbox"]
                lines.append(f"{CLASSES.index(box['className'])} {(x1 + x2) / 2:.6f} {(y1 + y2) / 2:.6f} {x2 - x1:.6f} {y2 - y1:.6f}")
                stats[(pool, box["className"])] += 1
                if box.get("emergency"):
                    emergency.append({"pool": pool, "image": f"images/{pool}/{src.name}", "className": box["className"],
                                      "emergency": box["emergency"], "bbox": box["bbox"]})
            (label_dir / f"{stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
            stats[(pool, "images")] += 1
    (OUT / "data.yaml").write_text(
        f"path: {OUT}\ntrain: images/train\nval: images/val\ntest: images/test\n"
        f"names:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(CLASSES)))
    (OUT / "emergency-boxes.json").write_text(json.dumps(emergency, ensure_ascii=False, indent=1) + "\n")
    for pool in ("train", "val", "test"):
        print(pool, {k: stats[(pool, k)] for k in ["images", *CLASSES]})
    print("emergency", dict(Counter(e["emergency"] for e in emergency)))
    if skipped:
        print("skipped", dict(skipped))
    print("wrote", OUT / "data.yaml")


if __name__ == "__main__":
    main()
