#!/usr/bin/env python3
"""消防分隊「等時圈」生成腳本（路網 driving，黃金救援 5/10/15 分鐘三級）。

全台 22 縣市 677 分隊，逐隊呼叫 Mapbox Isochrone API（driving profile）拿 5/10/15
分鐘可達 polygon，**按縣市分組** dissolve，產出兩份靜態 GeoJSON：

  1. fire_isochrone_coverage.geojson  — 各縣市同門檻聯集（環差分級），每塊 tag county
  2. fire_isochrone_stations.geojson  — 每隊個別等時圈（點選分隊高亮用），tag county/station

前端用 county 欄位做下拉選單篩選：預設「全台」顯示全部，選某縣市只顯示該縣市分隊的圈。

⚠️ 一般 driving profile 不含消防車優先路權（鳴笛闖紅燈），實際到達範圍會略大，
   本資料定位為「保守估計」，需在圖例標註。

特性：
- 原始 API 回應快取於 scripts/fetch/.fire_isochrone_cache/（已 gitignore），
  重跑、調整簡化參數時免重打 API。
- 幾何 simplify + 座標精度裁切控制檔案大小（前端 GeoJSON source 會 eager load）。

用法：
  python3 scripts/fetch/fetch-fire-isochrones.py                 # 全台
  python3 scripts/fetch/fetch-fire-isochrones.py --county 臺北市  # 只跑單一縣市（測試用）
  python3 scripts/fetch/fetch-fire-isochrones.py --simplify 0.0004
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import requests
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env"
STATIONS_PATH = ROOT / "public" / "geo" / "fire_stations.geojson"
# 中介 GeoJSON 輸出到 gitignored build 目錄（不出貨）；出貨產物是 tippecanoe 切的 PMTiles。
# 切片：tippecanoe -o public/fire/fire_isochrone_coverage.pmtiles -l coverage -Z5 -z14 \
#        --simplification=8 --drop-densest-as-needed --extend-zooms-if-still-dropping --force \
#        build/fire_isochrone/fire_isochrone_coverage.geojson
OUT_DIR = ROOT / "build" / "fire_isochrone"
CACHE_DIR = Path(__file__).resolve().parent / ".fire_isochrone_cache"

CONTOURS = [5, 10, 15]  # 黃金救援三級（分鐘）
MAPBOX_ISOCHRONE = "https://api.mapbox.com/isochrone/v1/mapbox/driving/{lon},{lat}"
COORD_PRECISION = 5  # 小數位（~1.1m），裁切座標精度縮小檔案

# 縣市下拉選單顯示順序（北→南→離島）；無資料者自動略過。
COUNTY_ORDER = [
    "基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
    "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
    "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣",
    "澎湖縣", "金門縣", "連江縣",
]


def read_mapbox_token() -> str:
    if not ENV_PATH.exists():
        sys.exit(f"找不到 {ENV_PATH}")
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("VITE_MAPBOX_TOKEN="):
            return line.split("=", 1)[1].strip()
    sys.exit("讀不到 VITE_MAPBOX_TOKEN")


def km2(geom) -> float:
    """緯度修正的平面近似面積（km²），台灣緯度下夠用於 POC 統計。"""
    lat = geom.centroid.y
    m_per_deg_lat = 110_574.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    return geom.area * m_per_deg_lat * m_per_deg_lon / 1_000_000.0


def round_coords(obj):
    """遞迴裁切 GeoJSON geometry 座標精度。"""
    if isinstance(obj, (int, float)):
        return round(obj, COORD_PRECISION)
    if isinstance(obj, list):
        return [round_coords(x) for x in obj]
    return obj


def geom_to_geojson(geom, tol: float) -> dict:
    g = geom.simplify(tol, preserve_topology=True) if tol > 0 else geom
    if not g.is_valid:
        g = g.buffer(0)
    gj = mapping(g)
    gj["coordinates"] = round_coords(gj["coordinates"])
    return gj


def fetch_isochrone(token: str, sid: str, lon: float, lat: float) -> dict | None:
    """打 API（含磁碟快取）。回傳 raw FeatureCollection。"""
    cache_file = CACHE_DIR / f"{sid}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    url = MAPBOX_ISOCHRONE.format(lon=lon, lat=lat)
    params = {
        "contours_minutes": ",".join(str(c) for c in CONTOURS),
        "polygons": "true",
        "denoise": "1",
        "access_token": token,
    }
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            r.raise_for_status()
            data = r.json()
            cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            time.sleep(0.2)  # 友善 rate limit（命中快取則不會 sleep）
            return data
        except requests.RequestException as e:
            if attempt == 2:
                print(f"    ✗ 失敗：{e}", file=sys.stderr)
                return None
            time.sleep(1 + attempt)
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", default=None, help="只跑單一縣市（預設全台）")
    ap.add_argument("--simplify", type=float, default=0.0003, help="幾何簡化容差（度，~0.0003≈33m）")
    args = ap.parse_args()

    CACHE_DIR.mkdir(exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    token = read_mapbox_token()
    fc = json.loads(STATIONS_PATH.read_text(encoding="utf-8"))
    stations = fc["features"]
    if args.county:
        stations = [f for f in stations if f["properties"].get("county") == args.county]
    if not stations:
        sys.exit("找不到分隊")

    # 依縣市分組
    by_county: dict[str, list] = {}
    for st in stations:
        c = st["properties"].get("county") or "其他"
        by_county.setdefault(c, []).append(st)

    counties = [c for c in COUNTY_ORDER if c in by_county]
    counties += [c for c in by_county if c not in COUNTY_ORDER]  # 補漏
    print(f"目標：{len(counties)} 縣市 {len(stations)} 隊 → 等時圈 {CONTOURS} 分（simplify={args.simplify}）\n")

    station_features: list[dict] = []
    coverage_features: list[dict] = []
    summary: list[tuple[str, int, dict]] = []
    # 全國聚合：所有縣市分隊一起 union（切到「全台」時用，乾淨無縣界接縫）
    global_bands: dict[int, list] = {c: [] for c in CONTOURS}

    done = 0
    for county in counties:
        sts = by_county[county]
        bands: dict[int, list] = {c: [] for c in CONTOURS}
        for st in sts:
            done += 1
            p = st["properties"]
            lon, lat = st["geometry"]["coordinates"][:2]
            sid = p.get("id") or f"st_{done:04d}"
            data = fetch_isochrone(token, sid, lon, lat)
            cached = (CACHE_DIR / f"{sid}.json").exists()
            print(f"  [{done:>3}/{len(stations)}] {county} {p.get('name','')} ({sid})"
                  f"{' (cache)' if cached else ''}", flush=True)
            if not data:
                continue
            for feat in data.get("features", []):
                minutes = int(feat["properties"].get("contour", 0))
                if minutes not in bands:
                    continue
                geom = shape(feat["geometry"])
                if not geom.is_valid:
                    geom = geom.buffer(0)
                bands[minutes].append(geom)
                global_bands[minutes].append(geom)
                station_features.append({
                    "type": "Feature",
                    "geometry": geom_to_geojson(geom, args.simplify),
                    "properties": {
                        "station_id": sid,
                        "station_name": p.get("name", ""),
                        "county": county,
                        "minutes": minutes,
                    },
                })

        # 該縣市 per-minute 聯集 → 環差分級
        unions = {m: unary_union(bands[m]) for m in sorted(CONTOURS) if bands[m]}
        prev = None
        county_areas = {}
        for minutes in sorted(unions.keys()):
            full = unions[minutes]
            ring = full if prev is None else full.difference(prev)
            if not ring.is_valid:
                ring = ring.buffer(0)
            prev = full
            county_areas[minutes] = km2(full)
            coverage_features.append({
                "type": "Feature",
                "geometry": geom_to_geojson(ring, args.simplify),
                "properties": {
                    "county": county,
                    "minutes": minutes,
                    "ring_sqkm": round(km2(ring), 1),
                    "cumulative_sqkm": round(km2(full), 1),
                },
            })
        summary.append((county, len(sts), county_areas))

    # 全國聚合（tag county="全台"）：所有分隊一起 union → 環差分級。
    # 切到「全台」時只顯示這組，乾淨無縣界接縫。放在 coverage_features 最前面。
    if not args.county:
        print("\n全國聚合 dissolve（所有分隊一起）…")
        nat_unions = {m: unary_union(global_bands[m]) for m in sorted(CONTOURS) if global_bands[m]}
        national: list[dict] = []
        prev = None
        for minutes in sorted(nat_unions.keys()):
            full = nat_unions[minutes]
            ring = full if prev is None else full.difference(prev)
            if not ring.is_valid:
                ring = ring.buffer(0)
            prev = full
            national.append({
                "type": "Feature",
                "geometry": geom_to_geojson(ring, args.simplify),
                "properties": {
                    "county": "全台",
                    "minutes": minutes,
                    "ring_sqkm": round(km2(ring), 1),
                    "cumulative_sqkm": round(km2(full), 1),
                },
            })
            print(f"  全台 {minutes:>2} 分鐘：累積可達 {km2(full):,.0f} km²")
        coverage_features = national + coverage_features

    coverage_out = OUT_DIR / "fire_isochrone_coverage.geojson"
    stations_out = OUT_DIR / "fire_isochrone_stations.geojson"
    coverage_out.write_text(
        json.dumps({"type": "FeatureCollection", "features": coverage_features}, ensure_ascii=False),
        encoding="utf-8")
    stations_out.write_text(
        json.dumps({"type": "FeatureCollection", "features": station_features}, ensure_ascii=False),
        encoding="utf-8")

    print("\n各縣市覆蓋（累積可達 km²，5/10/15 分）：")
    for county, n, areas in summary:
        a = lambda m: f"{areas.get(m, 0):.0f}" if areas.get(m) else "-"
        print(f"  {county:<5} {n:>3}隊  5:{a(5):>5} 10:{a(10):>5} 15:{a(15):>5}")

    print(f"\n下拉選單縣市順序（{len(counties)} 個有資料）：")
    print("  " + " ".join(counties))
    print(f"\n輸出：")
    print(f"  {coverage_out.relative_to(ROOT)}  ({len(coverage_features)} features, "
          f"{coverage_out.stat().st_size/1024/1024:.2f} MB)")
    print(f"  {stations_out.relative_to(ROOT)}  ({len(station_features)} features, "
          f"{stations_out.stat().st_size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
