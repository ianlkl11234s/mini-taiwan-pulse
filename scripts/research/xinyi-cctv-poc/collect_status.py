"""Summarize collected training stills: per camera, per hour, per day.

Run: ../../../.venv-cctv/bin/python3 collect_status.py
"""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
rows = [json.loads(line) for line in (ROOT / "data/training-raw/manifest.jsonl").open()]
by_camera = Counter(r["cameraId"] for r in rows)
by_hour = Counter(datetime.fromisoformat(r["receivedAt"]).astimezone().strftime("%H") for r in rows)
by_day = Counter(datetime.fromisoformat(r["receivedAt"]).astimezone().strftime("%m-%d") for r in rows)
size = sum(p.stat().st_size for p in (ROOT / "data/training-raw").rglob("*.jpg"))
print(f"images {len(rows)}  cameras {len(by_camera)}  size {size / 1e6:.0f} MB")
print("by day ", dict(sorted(by_day.items())))
print("by hour", dict(sorted(by_hour.items())))
print("by camera", dict(sorted(by_camera.items())))
logs = sorted((ROOT / "evidence/collect-logs").glob("2*.jsonl"))
if logs:
    last = json.loads(logs[-1].read_text().strip().splitlines()[-1])
    bad = [c["cameraId"] for c in last["cameras"] if c.get("status") != "ok"]
    print("last run", last["runId"], "problem cameras:", bad or "none")
