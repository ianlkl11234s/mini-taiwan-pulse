#!/usr/bin/env python3
"""
Upload pre-computed H3 demographics yearly data to Supabase.

Usage:
    python3 scripts/upload_h3_demographics_yearly.py [--res 7] [--res 8] [--dry-run]

Files expected in public/:
    h3_demographics_yearly_res7.json  (~9 MB, ~8K cells × 10 years)
    h3_demographics_yearly_res8.json  (~60 MB, ~55K cells × 10 years)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import httpx
except ImportError:
    print("需要 httpx: pip3 install httpx")
    sys.exit(1)

# ── Config ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Try loading from .env if not in environment
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

BATCH_SIZE = 500  # rows per upsert


def load_json(resolution: int) -> dict:
    path = PROJECT_ROOT / "public" / f"h3_demographics_yearly_res{resolution}.json"
    if not path.exists():
        print(f"[ERROR] 找不到 {path}")
        sys.exit(1)
    print(f"[INFO] 讀取 {path.name} ({path.stat().st_size / 1024 / 1024:.1f} MB)")
    with open(path) as f:
        return json.load(f)


def flatten_to_rows(data: dict, resolution: int) -> list[dict]:
    """Convert yearly JSON → flat rows for Supabase insert."""
    rows = []
    for year_str, cells in data["years"].items():
        year = int(year_str)
        for cell in cells:
            rows.append({
                "h3_index": cell["h"],
                "resolution": resolution,
                "year": year,
                "population": int(cell["p"]) if cell.get("p") is not None else None,
                "household_count": int(cell["hh"]) if cell.get("hh") is not None else None,
                "male_count": int(cell["m"]) if cell.get("m") is not None else None,
                "female_count": int(cell["f"]) if cell.get("f") is not None else None,
                "sex_ratio": cell.get("sr"),
                "dependency_ratio": cell.get("dr"),
                "child_dependency": cell.get("cd"),
                "elderly_dependency": cell.get("ed"),
                "aging_index": cell.get("ai"),
            })
    return rows


def upload_rows(rows: list[dict], dry_run: bool = False):
    """Upsert rows to Supabase in batches."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未設定")
        sys.exit(1)

    url = f"{SUPABASE_URL}/rest/v1/h3_demographics_yearly"
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

    print(f"[INFO] 準備上傳 {total:,} 筆 (batch_size={BATCH_SIZE})")
    if dry_run:
        print("[DRY-RUN] 跳過實際上傳")
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

        # Progress
        pct = (i + len(batch)) / total * 100
        if (i // BATCH_SIZE) % 20 == 0 or i + len(batch) >= total:
            elapsed = time.time() - t0
            print(f"  [{pct:5.1f}%] {uploaded:,} uploaded / {errors:,} errors — {elapsed:.1f}s")

    elapsed = time.time() - t0
    print(f"[DONE] {uploaded:,} uploaded, {errors:,} errors in {elapsed:.1f}s")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Upload H3 demographics yearly to Supabase")
    parser.add_argument("--res", type=int, action="append", default=[], help="Resolution(s) to upload (7, 8)")
    parser.add_argument("--dry-run", action="store_true", help="Only read & count, skip upload")
    args = parser.parse_args()

    resolutions = args.res if args.res else [7]  # default res7 only (safer)
    print(f"=== H3 Demographics Yearly Upload ===")
    print(f"Resolutions: {resolutions}")
    print(f"Supabase: {SUPABASE_URL[:40]}...")
    print()

    for res in resolutions:
        data = load_json(res)
        meta = data.get("metadata", {})
        print(f"[res{res}] years={meta.get('years')}, columns={meta.get('value_columns')}")

        rows = flatten_to_rows(data, res)
        print(f"[res{res}] {len(rows):,} total rows")
        upload_rows(rows, dry_run=args.dry_run)
        print()


if __name__ == "__main__":
    main()
