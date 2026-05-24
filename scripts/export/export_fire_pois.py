"""
export_fire_pois.py
===================
消防分隊 + 消防栓靜態 GeoJSON，給前端「fireStations」「fireHydrants」layer 用。

來源（taipei-gis-analytics/data/processed/fire/）：
  分隊：fire_stations/stations_7cities.csv (343) + stations_15counties_geocoded.csv (374) = 717 筆，全台 22 縣市
        ⚠️ 兩檔欄位順序不同，用 DictReader 對齊
  消防栓：hydrants/hydrants.csv (69,839) ⚠️ 僅臺北市(A) + 高雄市(E) 兩都
        （hydrants_taipei_xml.csv 為另一套臺北來源，不併入以免重複計數）

型式正規化（給圖例分類用）：
  分隊  cat ∈ {大隊, 分隊, 分駐所, 其他(中隊/小隊/空白)}
  消防栓 cat ∈ {地上式, 地下式, 其他}

執行：
  python3 scripts/export/export_fire_pois.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SRC_DIR = PROJECT_ROOT.parent / "taipei-gis-analytics/data/processed/fire"

STATIONS_CSVS = [
    SRC_DIR / "fire_stations/stations_7cities.csv",
    SRC_DIR / "fire_stations/stations_15counties_geocoded.csv",
]
HYDRANTS_CSV = SRC_DIR / "hydrants/hydrants.csv"

OUT_STATIONS = PROJECT_ROOT / "public/geo/fire_stations.geojson"
OUT_HYDRANTS = PROJECT_ROOT / "public/geo/fire_hydrants.geojson"

# 縣市代碼 → 名稱（popup / 統計用）
COUNTY_NAMES = {
    "A": "臺北市", "B": "臺中市", "C": "基隆市", "D": "臺南市", "E": "高雄市",
    "F": "新北市", "G": "宜蘭縣", "H": "桃園市", "I": "嘉義市", "J": "新竹縣",
    "K": "苗栗縣", "M": "南投縣", "N": "彰化縣", "O": "新竹市", "P": "雲林縣",
    "Q": "嘉義縣", "T": "屏東縣", "U": "花蓮縣", "V": "臺東縣", "W": "金門縣",
    "X": "澎湖縣", "Z": "連江縣",
}

STATION_CATS = {"大隊", "分隊", "分駐所"}
HYDRANT_CATS = {"地上式", "地下式"}


def _valid_coord(lng_s: str | None, lat_s: str | None) -> tuple[float, float] | None:
    try:
        lng, lat = float(lng_s), float(lat_s)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    # 台灣經緯度合理範圍
    if not (118.0 <= lng <= 122.5 and 21.5 <= lat <= 26.5):
        return None
    return lng, lat


def _write(out_path: Path, features: list[dict], label: str) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": features}
    out_path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"  → {out_path.name}: {len(features):,} features, {size_mb:.2f} MB")
    # 分類統計
    cats: dict[str, int] = {}
    for f in features:
        c = f["properties"].get("cat", "?")
        cats[c] = cats.get(c, 0) + 1
    print(f"    cats: {cats}")


def build_stations() -> None:
    print(f"[分隊] 讀 {len(STATIONS_CSVS)} 檔...")
    features: list[dict] = []
    skipped = 0
    for csv_path in STATIONS_CSVS:
        if not csv_path.exists():
            print(f"  [!] {csv_path} 不存在，跳過")
            continue
        with open(csv_path, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                coord = _valid_coord(row.get("lng"), row.get("lat"))
                if coord is None:
                    skipped += 1
                    continue
                raw_type = (row.get("type") or "").strip()
                cat = raw_type if raw_type in STATION_CATS else "其他"
                cid = (row.get("county_id") or "").strip()
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(coord[0], 6), round(coord[1], 6)]},
                    "properties": {
                        "id": row.get("station_id"),
                        "name": row.get("name"),
                        "type": raw_type or None,
                        "cat": cat,
                        "address": (row.get("address") or "").strip() or None,
                        "phone": (row.get("phone") or "").strip() or None,
                        "district": (row.get("district") or "").strip() or None,
                        "county": COUNTY_NAMES.get(cid, cid or None),
                    },
                })
    print(f"  skipped (無效座標): {skipped}")
    _write(OUT_STATIONS, features, "分隊")


def build_hydrants() -> None:
    print(f"\n[消防栓] 讀 {HYDRANTS_CSV.name}...")
    if not HYDRANTS_CSV.exists():
        print(f"  [!] {HYDRANTS_CSV} 不存在，跳過")
        return
    features: list[dict] = []
    skipped = 0
    with open(HYDRANTS_CSV, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            coord = _valid_coord(row.get("lng"), row.get("lat"))
            if coord is None:
                skipped += 1
                continue
            raw_type = (row.get("type") or "").strip()
            cat = raw_type if raw_type in HYDRANT_CATS else "其他"
            cid = (row.get("county_id") or "").strip()
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(coord[0], 6), round(coord[1], 6)]},
                "properties": {
                    "id": row.get("hydrant_id"),
                    "type": raw_type or None,
                    "cat": cat,
                    "district": (row.get("district") or "").strip() or None,
                    "county": COUNTY_NAMES.get(cid, cid or None),
                },
            })
    print(f"  skipped (無效座標): {skipped}")
    _write(OUT_HYDRANTS, features, "消防栓")


def main() -> None:
    build_stations()
    build_hydrants()
    print("\n完成。記得跑 upload-deploy-assets.sh 上 S3。")


if __name__ == "__main__":
    main()
