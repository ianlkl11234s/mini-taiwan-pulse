#!/usr/bin/env python3
"""崩塌主題靜態圖層：taipei-gis-analytics hazards 成品 → public/hazards/。

只做「瘦身 + 補來源欄」，不改資料語意：
  - 大規模崩塌潛勢區（111–115 年版，322 面）→ landslide_dod_areas.geojson
  - 大規模崩塌影響範圍（111–115 年版，322 面）→ landslide_dod_impact.geojson
    只留 popup／篩選欄位；不帶 TWD97 形心、全空欄（national_park／note_2）；座標 6 位小數。
    來源欄依各列 year_roc 對到該年度 data.gov.tw nid（抄自上游 _manifest.json per-year nid）。
  - 省道歷史災情（16,163 點）→ highway_disaster_history.pmtiles
    精簡後 GeoJSON 仍約 7.5MB，超過 dataClass A 約 5MB → 比照酒駕事故用 tippecanoe（點 -r1 -pf -pk，
    不抽稀不丟點）切 z5–12 並逐 zoom 稽核點數。不帶 control_action（2,000+ 種管制長文）、control_start。
    依 category_sub 加 category_group（8 族，SSOT＝src/data/landslideTypes.ts HIGHWAY_CATEGORY_GROUPS）。
  - 年度全島崩塌地（107MB PMTiles）不經本腳本：直接複製上游檔到 public/hazards/（gitignored），
    以 scripts/deploy/upload-deploy-assets.sh 上 S3 deploy-assets/hazards/。

用法：
  python3 scripts/preprocess/build-landslide-public.py \
      --src ../taipei-gis-analytics/data/processed/hazards --date 20261006
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "hazards"
OGDL = "政府資料開放授權條款第1版"
SWCB = "農業部農村發展及水土保持署"

AREA_KEEP = ["year_roc", "lslno", "lslno_old", "county", "town", "village", "settlement_name", "landmark",
             "landslide_type", "dwelling_count", "road_name", "res_class", "risk", "basin", "sub_basin",
             "reservoir", "scenic_area", "land_owner_type", "survey_date_year", "data_year", "geom_area_ha", "authority"]
IMPACT_KEEP = ["year_roc", "lslno", "lslno_old", "county", "town", "village", "total_res", "res_class", "risk",
               "geom_area_ha", "authority"]

HIGHWAY_KEEP = ["year", "reported_at", "released_at", "route", "location_text", "category_main", "category_sub",
                "report_category", "event_name", "cause", "agency_section"]
HIGHWAY_LAYER = "highway_disaster_history"
HIGHWAY_ZOOM = (5, 12)
# category_sub → 8 族（與 src/data/landslideTypes.ts HIGHWAY_CATEGORY_GROUPS 同步；classificationCoverage 守 PMTiles 外的 GeoJSON 不適用，
# 故本腳本遇到未知 category_sub 直接中止，不默默落「其他」）。
HIGHWAY_GROUPS = {
    "道路落石": "rockfall",
    "邊坡坍方": "slope_failure", "路基流失": "slope_failure",
    "土石流阻斷": "debris_flow",
    "預警性封閉": "precautionary_closure",
    "淹水": "flooding",
    "便橋沖毀": "structure_damage", "橋墩或橋面變位": "structure_damage", "便道沖毀": "structure_damage",
    "設施損毀": "structure_damage", "橋梁沖毀": "structure_damage", "路側設施損毀": "structure_damage",
    "工區及周邊區域損害": "structure_damage",
    "交通事故(含危險品洩漏疑慮、火災)": "traffic_incident",
    "其他": "other",
}


def round_coords(coords):
    if isinstance(coords, (int, float)):
        return round(float(coords), 6)
    return [round_coords(c) for c in coords]


def write_collection(path: Path, features: list[dict]) -> None:
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")


def build_dod(src_root: Path, dataset_id: str, keep: list[str], date: str) -> None:
    manifest = json.loads((src_root / dataset_id / "_manifest.json").read_text(encoding="utf-8"))
    nids = manifest["provenance"]["datagov_nids"]
    fetched = manifest["provenance"]["fetched_at"]
    data = json.loads((src_root / dataset_id / f"{dataset_id}_{date}.geojson").read_text(encoding="utf-8"))
    features = []
    for feat in data["features"]:
        p = feat["properties"]
        props = {"id": p["feature_id"], **{key: p.get(key) for key in keep}}
        nid = nids[str(p["year_roc"])]
        props.update({"source_org": f"{SWCB}（data.gov.tw {nid}）", "source_url": f"https://data.gov.tw/dataset/{nid}",
                      "license": OGDL, "fetched_at": fetched, "vintage": f"{p['year_roc']} 年版"})
        features.append({"type": "Feature", "geometry": {"type": feat["geometry"]["type"], "coordinates": round_coords(feat["geometry"]["coordinates"])},
                         "properties": props})
    out = OUT_DIR / f"{dataset_id}.geojson"
    write_collection(out, features)
    print(f"{dataset_id}: {len(features)} features → {out.relative_to(ROOT)} {out.stat().st_size:,} B")


def build_highway(src_root: Path, date: str) -> None:
    manifest = json.loads((src_root / HIGHWAY_LAYER / "_manifest.json").read_text(encoding="utf-8"))
    data = json.loads((src_root / HIGHWAY_LAYER / f"{HIGHWAY_LAYER}_{date}.geojson").read_text(encoding="utf-8"))
    unknown = sorted({f["properties"]["category_sub"] for f in data["features"]} - set(HIGHWAY_GROUPS))
    if unknown:
        raise SystemExit(f"未分族的 category_sub：{unknown}（先補 HIGHWAY_GROUPS 與 landslideTypes.ts）")
    features = []
    for feat in data["features"]:
        p = feat["properties"]
        props = {"id": p["feature_id"], **{key: p.get(key) for key in HIGHWAY_KEEP}}
        props["category_group"] = HIGHWAY_GROUPS[p["category_sub"]]
        props.update({"source_org": "交通部公路局（道路（橋梁）歷史災情，data.gov.tw 31020）", "source_url": "https://data.gov.tw/dataset/31020",
                      "license": OGDL, "fetched_at": manifest["provenance"]["fetched_at"], "vintage": "通報時間 2014-01-13～2026-10-04"})
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": round_coords(feat["geometry"]["coordinates"])},
                         "properties": props})
    out = OUT_DIR / f"{HIGHWAY_LAYER}.pmtiles"
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / f"{HIGHWAY_LAYER}.geojson"
        write_collection(mid, features)
        zmin, zmax = HIGHWAY_ZOOM
        subprocess.run(["tippecanoe", "-o", str(out), "--force", "-l", HIGHWAY_LAYER, "-Z", str(zmin), "-z", str(zmax),
                        "-r1", "-pf", "-pk", "--quiet", str(mid)], check=True)
        audit_zoom_counts(out, len(features), zmin, zmax)
    print(f"{HIGHWAY_LAYER}: {len(features)} features → {out.relative_to(ROOT)} {out.stat().st_size:,} B")


def audit_zoom_counts(pmtiles: Path, expected: int, zmin: int, zmax: int) -> None:
    """逐 zoom 解碼數點：每一層都要等於輸入點數（-r1 -pf -pk 不應丟點）。"""
    if not shutil.which("tippecanoe-decode"):
        raise SystemExit("缺 tippecanoe-decode，無法逐 zoom 稽核")
    for z in range(zmin, zmax + 1):
        res = subprocess.run(["tippecanoe-decode", "-Z", str(z), "-z", str(z), str(pmtiles)], check=True, capture_output=True, text=True)
        ids = {feat["properties"]["id"] for tile in json.loads(res.stdout)["features"] for layer in tile["features"] for feat in layer["features"]}
        if len(ids) != expected:
            raise SystemExit(f"z{z}: 解碼 {len(ids)} 點 ≠ 輸入 {expected}（丟點）")
        print(f"  z{z}: {len(ids)} 點 ✓")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="taipei-gis-analytics data/processed/hazards")
    ap.add_argument("--date", default="20261006")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_dod(args.src, "landslide_dod_areas", AREA_KEEP, args.date)
    build_dod(args.src, "landslide_dod_impact", IMPACT_KEEP, args.date)
    build_highway(args.src, args.date)
