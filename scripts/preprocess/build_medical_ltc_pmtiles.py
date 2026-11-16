#!/usr/bin/env python3
"""重切長照點位圖磚 public/geo/medical_ltc_v2.pmtiles（2026-11-14 移除身分證字號後重產）。

舊檔 medical_ltc.pmtiles 沒有留下建置腳本；本腳本照它 PMTiles metadata 記載的 tippecanoe 參數重現，
並已驗證：用原始輸入跑出的檔案與正式站舊檔逐位元相同。

輸入（兩份，依序串接，順序與舊檔相同）：
  1. --ltc   analytics 長照成品（衛福部 ABC 據點），預設
             ../taipei-gis-analytics/data/processed/poi/long_term_care/long_term_care_20260524.geojson
             （正式站舊檔用的就是 05-24 這期；analytics #386 起 Address／Phone 的身分證字號已移除）
  2. --extra 舊中繼檔 public/geo/medical_ltc.geojson，只取沒有 OrgCode 的列
             （國土測繪中心 POI 補點，properties.source = "nlsc"、med_cat = "ltc"；在任何 repo 都沒有產生腳本，
             只存在這份中繼檔）
中繼檔：public/geo/medical_ltc_v2.geojson（不入庫）
輸出：  public/geo/medical_ltc_v2.pmtiles
tippecanoe 參數（與舊檔 metadata generator_options 相同，只換輸出／輸入檔名）：
  -l medical_ltc -zg -r1 --drop-densest-as-needed -B 12 --force -q

用法（repo 根目錄）：
  python3 scripts/preprocess/build_medical_ltc_pmtiles.py [--ltc PATH] [--extra PATH] [--out-dir public/geo]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LTC = ROOT.parent / "taipei-gis-analytics/data/processed/poi/long_term_care/long_term_care_20260524.geojson"
DEFAULT_EXTRA = ROOT / "public/geo/medical_ltc.geojson"
LAYER = "medical_ltc"
TIPPECANOE_ARGS = ["-l", LAYER, "-zg", "-r1", "--drop-densest-as-needed", "-B", "12", "--force", "-q"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ltc", type=Path, default=DEFAULT_LTC)
    ap.add_argument("--extra", type=Path, default=DEFAULT_EXTRA)
    ap.add_argument("--out-dir", type=Path, default=ROOT / "public/geo")
    args = ap.parse_args()

    ltc = json.loads(args.ltc.read_text(encoding="utf-8"))["features"]
    if not all("OrgCode" in (f.get("properties") or {}) for f in ltc):
        raise SystemExit("--ltc 有列缺 OrgCode，不像長照成品，停止")
    extra = [f for f in json.loads(args.extra.read_text(encoding="utf-8"))["features"]
             if "OrgCode" not in (f.get("properties") or {})]
    if any((f["properties"].get("source"), f["properties"].get("med_cat")) != ("nlsc", "ltc") for f in extra):
        raise SystemExit("--extra 的補點不是 source=nlsc／med_cat=ltc，停止")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    geojson = args.out_dir / "medical_ltc_v2.geojson"
    pmtiles = args.out_dir / "medical_ltc_v2.pmtiles"
    geojson.write_text(json.dumps({"type": "FeatureCollection", "features": ltc + extra}, ensure_ascii=False),
                       encoding="utf-8")
    # 以 repo 根目錄為 cwd、傳相對路徑：metadata 的 generator_options 不會寫進本機絕對路徑（舊檔也是相對路徑）
    rel = lambda p: os.path.relpath(p.resolve(), ROOT)
    subprocess.run(["tippecanoe", "-o", rel(pmtiles), *TIPPECANOE_ARGS, rel(geojson)], check=True, cwd=ROOT)
    print(json.dumps({
        "ltc": str(args.ltc), "ltc_sha256": sha256(args.ltc), "ltc_rows": len(ltc),
        "extra": str(args.extra), "extra_rows": len(extra),
        "out": str(pmtiles), "bytes": pmtiles.stat().st_size, "sha256": sha256(pmtiles),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
