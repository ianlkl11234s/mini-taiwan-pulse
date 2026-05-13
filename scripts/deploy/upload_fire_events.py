#!/usr/bin/env python3
"""
Upload pre-processed fire events GeoJSON to Supabase realtime.fire_events.

Source: taipei-gis-analytics/output/fire/fire_111_113_kepler.geojson
        (民國 111~113 年 ~48k 筆，已 geocoding)

Usage:
    python3 scripts/deploy/upload_fire_events.py [--src PATH] [--dry-run]

Pre-requisite:
    Run gis-platform/migrations/064_fire_events.sql first.
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path


def _clean(v):
    """NaN / inf → None；保留其他值。"""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _to_int(v):
    v = _clean(v)
    return int(v) if v is not None else None


def _to_float(v):
    v = _clean(v)
    return float(v) if v is not None else None

try:
    import httpx
except ImportError:
    print("需要 httpx: pip3 install httpx")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_SRC = (
    PROJECT_ROOT.parent
    / "taipei-gis-analytics"
    / "output"
    / "fire"
    / "fire_111_113_kepler.geojson"
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# 從 .env 補齊（與 upload_h3_demographics_yearly.py 一致）
if not SUPABASE_URL or not SUPABASE_KEY:
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if k == "SUPABASE_URL" and not SUPABASE_URL:
                    SUPABASE_URL = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY" and not SUPABASE_KEY:
                    SUPABASE_KEY = v

BATCH_SIZE = 500


def feature_to_row(feature: dict) -> dict | None:
    """GeoJSON Point feature → fire_events row。略過缺座標的紀錄。"""
    geom = feature.get("geometry") or {}
    props = feature.get("properties") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    lng, lat = float(coords[0]), float(coords[1])
    case_id = props.get("case_id")
    if not case_id:
        return None
    return {
        "case_id": case_id,
        "occurred_at": props.get("report_time"),
        "arrived_at": props.get("arrive_time"),
        "response_minutes": _to_float(props.get("response_minutes")),
        "year": _to_int(props.get("year")),
        "month": _to_int(props.get("month")),
        "hour": _to_int(props.get("hour")),
        "weekday": props.get("weekday"),
        "county": props.get("county"),
        "township": props.get("township"),
        "street": props.get("street"),
        "formatted_address": props.get("formatted_address"),
        "cause": props.get("cause"),
        "deaths": _to_int(props.get("deaths")) or 0,
        "injuries": _to_int(props.get("injuries")) or 0,
        "has_casualty": bool(props.get("has_casualty") or False),
        "precision_level": props.get("precision_level"),
        "geocoding_status": props.get("geocoding_status"),
        "longitude": lng,
        "latitude": lat,
    }


def load_features(src: Path) -> list[dict]:
    print(f"[INFO] 讀取 {src} ({src.stat().st_size / 1024 / 1024:.1f} MB)")
    with open(src) as f:
        gj = json.load(f)
    features = gj.get("features") or []
    print(f"[INFO] 共 {len(features):,} features")
    return features


def upload(rows: list[dict], dry_run: bool):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未設定")
        sys.exit(1)

    url = f"{SUPABASE_URL}/rest/v1/fire_events?on_conflict=case_id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Content-Profile": "spatial",
        "Prefer": "resolution=merge-duplicates",
    }

    total = len(rows)
    uploaded = 0
    errors = 0
    print(f"[INFO] 上傳 {total:,} 筆 (batch={BATCH_SIZE})")
    if dry_run:
        print("[DRY-RUN] 略過實際上傳")
        return

    client = httpx.Client(timeout=60)
    t0 = time.time()
    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        resp = client.post(url, json=batch, headers=headers)
        if resp.status_code in (200, 201):
            uploaded += len(batch)
        else:
            errors += len(batch)
            print(f"  [WARN] batch {i//BATCH_SIZE}: {resp.status_code} — {resp.text[:200]}")
        if (i // BATCH_SIZE) % 20 == 0 or i + len(batch) >= total:
            pct = (i + len(batch)) / total * 100
            elapsed = time.time() - t0
            print(f"  [{pct:5.1f}%] {uploaded:,} ok / {errors:,} err — {elapsed:.1f}s")
    print(f"[DONE] {uploaded:,} uploaded, {errors:,} errors in {time.time()-t0:.1f}s")
    client.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--src", type=Path, default=DEFAULT_SRC)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    print("=== Fire Events Upload ===")
    print(f"Src: {args.src}")
    print(f"Supabase: {SUPABASE_URL[:40]}...")

    if not args.src.exists():
        print(f"[ERROR] 找不到 {args.src}")
        sys.exit(1)

    features = load_features(args.src)
    rows: list[dict] = []
    skipped = 0
    seen: dict[str, int] = {}  # case_id → index in rows
    duplicates = 0
    for feat in features:
        row = feature_to_row(feat)
        if row is None:
            skipped += 1
            continue
        cid = row["case_id"]
        if cid in seen:
            # 後出現的覆蓋（保留 last，跟 ON CONFLICT 行為一致）
            rows[seen[cid]] = row
            duplicates += 1
        else:
            seen[cid] = len(rows)
            rows.append(row)
    print(
        f"[INFO] 有效 rows: {len(rows):,}（跳過 {skipped:,} 無座標 / 合併 {duplicates:,} case_id 重複）"
    )

    by_year: dict[int, int] = {}
    for r in rows:
        by_year[r["year"]] = by_year.get(r["year"], 0) + 1
    print(f"[INFO] 年份分布: {sorted(by_year.items())}")

    upload(rows, args.dry_run)


if __name__ == "__main__":
    main()
