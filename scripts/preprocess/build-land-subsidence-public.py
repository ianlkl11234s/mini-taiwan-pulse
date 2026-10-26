#!/usr/bin/env python3
"""地層下陷＋海堤靜態圖層（G19）：taipei-gis-analytics water_resources 成品 → public/hazards/（nginx／S3 pull 已有 hazards 目錄，不另開新目錄）。

只做「瘦身 + 補來源欄」，不改資料語意（規格 SSOT：analytics docs/topic-research/land_subsidence/layer-plan.md）：
  - 地層下陷測站（113 → 112 點）→ land_subsidence_stations.geojson
    濾掉 geometry=null／mappable=false（金湖國小 GNSS：上游座標錯，UDI-0039）；不帶 metadata、address。
  - 地層下陷等值線（729 → 696 條）→ land_subsidence_contours.pmtiles
    濾掉 exclude_from_map=true（TW_109 33 條）；32MB GeoJSON 超過 dataClass A，tippecanoe 切 z5–13，
    不用 --drop-densest、--no-tile-size-limit --no-feature-limit，逐 zoom 稽核唯一 id 條數（結果印出、寫進 feature 文件）。
  - 一般性海堤區域（239 面）→ seawall_zones.geojson
    org 原值保留，另加 org_label 正規化「第N河川局」→「第N河川分署」；seawall_type 全為 '1'、note 全空，不帶。

用法：
  python3 scripts/preprocess/build-land-subsidence-public.py \
      --src ../taipei-gis-analytics/data/processed/water_resources --date 20261017
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "hazards"
OGDL = "政府資料開放授權條款第1版"
WRA = "經濟部水利署"

STATION_KEEP = ["id", "name", "station_type", "station_type_label", "county", "township", "coord_status", "coord_status_label",
                "well_depth_m", "establish_date", "disuse_date", "is_active", "obs_count", "obs_first", "obs_last", "ring_count",
                "trend_per_year", "trend_unit", "trend_window"]
STATION_NID = {"gnss": "36693", "magnetic_ring": "41571", "deep_pile": "58335"}
STATION_COVERAGE = {"gnss": "2011-01～2025-12", "magnetic_ring": "1995-07～2026-03", "deep_pile": "2016-05～2025-04"}

CONTOUR_KEEP = ["fname", "contour_type", "county", "period_label", "year_from", "year_to", "level_value", "level_unit",
                "sign_corrected", "is_latest"]
CONTOUR_NID = {"cumulative": "58361", "rate": "58362"}
CONTOUR_LAYER = "contours"
CONTOUR_ZOOM = (5, 13)

SEAWALL_NID = "129277"
CN_DIGITS = "一二三四五六七八九十"


def fetched_at_of(date: str) -> str:
    """由 --date（YYYYMMDD）推導 provenance 的 fetched_at。"""
    return f"{date[:4]}-{date[4:6]}-{date[6:8]}"


def round_coords(coords, nd=6):
    if isinstance(coords, (int, float)):
        return round(float(coords), nd)
    return [round_coords(c, nd) for c in coords]


def write_collection(path: Path, features: list[dict]) -> None:
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")


def latest(src: Path, dataset: str, date: str) -> Path:
    path = src / dataset / f"{dataset}_{date}.geojson"
    if not path.exists():
        raise SystemExit(f"缺 {path}")
    return path


def build_stations(src: Path, date: str) -> None:
    fetched_at = fetched_at_of(date)
    data = json.loads(latest(src, "land_subsidence_stations", date).read_text(encoding="utf-8"))
    features, skipped = [], []
    for feat in data["features"]:
        p = feat["properties"]
        if feat["geometry"] is None or p.get("mappable") is False:
            skipped.append(p["name"])
            continue
        props = {key: p.get(key) for key in STATION_KEEP}
        nid = STATION_NID[p["station_type"]]
        props.update({"source_org": f"{WRA}（地層下陷監測，data.gov.tw {nid}）", "source_url": f"https://data.gov.tw/dataset/{nid}",
                      "license": OGDL, "fetched_at": fetched_at, "vintage": f"監測 {STATION_COVERAGE[p['station_type']]}"})
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": round_coords(feat["geometry"]["coordinates"])},
                         "properties": props})
    out = OUT_DIR / "land_subsidence_stations.geojson"
    write_collection(out, features)
    print(f"stations: {len(features)} 點（略過 {skipped}）→ {out.relative_to(ROOT)} {out.stat().st_size:,} B")


def build_contours(src: Path, date: str) -> None:
    fetched_at = fetched_at_of(date)
    data = json.loads(latest(src, "land_subsidence_contours", date).read_text(encoding="utf-8"))
    features, excluded = [], 0
    counters: dict[str, int] = {}
    for feat in data["features"]:
        p = feat["properties"]
        if p.get("exclude_from_map"):
            excluded += 1
            continue
        if feat["geometry"] is None:
            raise SystemExit(f"{p['fname']} 有空幾何（qa 應為 0）")
        idx = counters[p["fname"]] = counters.get(p["fname"], 0) + 1
        props = {"id": f"{p['fname']}:{idx}", **{key: p.get(key) for key in CONTOUR_KEEP}}
        nid = CONTOUR_NID[p["contour_type"]]
        props.update({"source_org": f"{WRA}（地層下陷等值線，data.gov.tw {nid}）", "source_url": f"https://data.gov.tw/dataset/{nid}",
                      "license": OGDL, "fetched_at": fetched_at, "vintage": p["period_label"]})
        features.append({"type": "Feature", "geometry": {"type": feat["geometry"]["type"], "coordinates": round_coords(feat["geometry"]["coordinates"])},
                         "properties": props})
    out = OUT_DIR / "land_subsidence_contours.pmtiles"
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / "contours.geojson"
        write_collection(mid, features)
        zmin, zmax = CONTOUR_ZOOM
        subprocess.run(["tippecanoe", "-o", str(out), "--force", "-l", CONTOUR_LAYER, "-Z", str(zmin), "-z", str(zmax),
                        "--no-tile-size-limit", "--no-feature-limit", "--quiet", str(mid)], check=True)
    print(f"contours: {len(features)} 條（濾 exclude_from_map {excluded}；is_latest {sum(1 for f in features if f['properties']['is_latest'])}）"
          f" → {out.relative_to(ROOT)} {out.stat().st_size:,} B")
    audit_zoom_counts(out, {f["properties"]["id"] for f in features}, zmin, zmax)
    periods = sorted({(f["properties"]["contour_type"], f["properties"]["county"], f["properties"]["year_from"], f["properties"]["year_to"],
                       f["properties"]["fname"], f["properties"]["period_label"]) for f in features})
    print("期別清單（landSubsidenceTypes.ts CONTOUR_PERIODS 同步用）：")
    for ctype, county, _yf, _yt, fname, label in periods:
        print(f'  {{ type: "{ctype}", fname: "{fname}", county: "{county}", period: "{label}" }},')


def audit_zoom_counts(pmtiles: Path, expected: set[str], zmin: int, zmax: int) -> None:
    """逐 zoom 解碼數唯一 id；線在低 zoom 若被簡化掉照實印出（不調參數湊齊）。"""
    if not shutil.which("tippecanoe-decode"):
        raise SystemExit("缺 tippecanoe-decode，無法逐 zoom 稽核")
    for z in range(zmin, zmax + 1):
        res = subprocess.run(["tippecanoe-decode", "-Z", str(z), "-z", str(z), str(pmtiles)], check=True, capture_output=True, text=True)
        ids = {feat["properties"]["id"] for tile in json.loads(res.stdout)["features"] for layer in tile["features"] for feat in layer["features"]}
        missing = sorted(expected - ids)
        print(f"  z{z}: {len(ids)}/{len(expected)} 條" + (f" ✗ 缺 {missing[:10]}{'…' if len(missing) > 10 else ''}" if missing else " ✓"))


def org_label(org: str) -> str:
    m = re.fullmatch(r"第([一二三四五六七八九十]+)河川(局|分署)", org or "")
    return f"第{m.group(1)}河川分署" if m else org


def build_seawalls(src: Path, date: str) -> None:
    fetched_at = fetched_at_of(date)
    data = json.loads((src / "seawall_zones_wra" / "seawall_zones_wra.geojson").read_text(encoding="utf-8"))
    features = []
    for i, feat in enumerate(data["features"], start=1):
        p = feat["properties"]
        if feat["geometry"] is None:
            raise SystemExit(f"海堤第 {i} 筆空幾何（qa 應為 0）")
        props = {"id": f"seawall:{i}", "name": p.get("name"), "shore_name": p.get("shore_name"), "shore_no": p.get("shore_no"),
                 "org": p.get("org"), "org_label": org_label(p.get("org", "")),
                 "source_org": f"{WRA} 一般性海堤區域（data.gov.tw {SEAWALL_NID}）", "source_url": f"https://data.gov.tw/dataset/{SEAWALL_NID}",
                 "license": OGDL, "fetched_at": fetched_at, "vintage": "上游建置 2024-06-12"}
        features.append({"type": "Feature", "geometry": {"type": feat["geometry"]["type"], "coordinates": round_coords(feat["geometry"]["coordinates"])},
                         "properties": props})
    out = OUT_DIR / "seawall_zones.geojson"
    write_collection(out, features)
    labels = sorted({f["properties"]["org_label"] for f in features})
    print(f"seawalls: {len(features)} 面 → {out.relative_to(ROOT)} {out.stat().st_size:,} B；org_label {labels}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="taipei-gis-analytics data/processed/water_resources")
    ap.add_argument("--date", default="20261017")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_stations(args.src, args.date)
    build_seawalls(args.src, args.date)
    build_contours(args.src, args.date)
