#!/usr/bin/env python3
"""屏東縣消防分隊地理編碼補齊。

上游 stations_7cities.csv 的屏東 39 隊只有地址、無經緯度（needs_geocoding），
被 export_fire_pois.py 整批跳過 → fire_stations.geojson 缺屏東。

本腳本用 Mapbox Geocoding API 將屏東地址轉座標，依 export 的相同 schema 附加到
public/geo/fire_stations.geojson（冪等：已存在的 station_id 跳過）。之後重跑
fetch-fire-isochrones.py 即可把屏東納入等時圈。

⚠️ Mapbox 對台灣門牌精度有限（proximity + country=TW 偏壓），落在屏東範圍外的結果會被丟棄。

用法：python3 scripts/fetch/geocode-pingtung-fire-stations.py
"""

from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env"
STATIONS_GEOJSON = ROOT / "public" / "geo" / "fire_stations.geojson"
SRC_CSV = ROOT.parent / "taipei-gis-analytics/data/processed/fire/fire_stations/stations_7cities.csv"
CACHE = Path(__file__).resolve().parent / ".pingtung_geocode_cache.json"

STATION_CATS = {"大隊", "分隊", "分駐所"}
PINGTUNG_BBOX = (120.0, 21.9, 121.05, 22.95)  # 屏東縣大致範圍（含離島墾丁）
PROXIMITY = "120.49,22.67"  # 屏東市中心偏壓
GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward"


def read_token() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("VITE_MAPBOX_TOKEN="):
            return line.split("=", 1)[1].strip()
    sys.exit("讀不到 VITE_MAPBOX_TOKEN")


def geocode(token: str, address: str, cache: dict) -> tuple[float, float] | None:
    if address in cache:
        c = cache[address]
        return tuple(c) if c else None
    params = {
        "q": address,
        "country": "tw",
        "proximity": PROXIMITY,
        "limit": 1,
        "language": "zh-Hant",
        "access_token": token,
    }
    try:
        r = requests.get(GEOCODE_URL, params=params, timeout=30)
        r.raise_for_status()
        feats = r.json().get("features", [])
        coord = None
        if feats:
            lng, lat = feats[0]["geometry"]["coordinates"][:2]
            x0, y0, x1, y1 = PINGTUNG_BBOX
            if x0 <= lng <= x1 and y0 <= lat <= y1:
                coord = (round(lng, 6), round(lat, 6))
        cache[address] = list(coord) if coord else None
        time.sleep(0.15)
        return coord
    except requests.RequestException as e:
        print(f"    ✗ {e}", file=sys.stderr)
        return None


def main() -> None:
    token = read_token()
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}

    fc = json.loads(STATIONS_GEOJSON.read_text(encoding="utf-8"))
    existing_ids = {f["properties"].get("id") for f in fc["features"]}

    rows = []
    with open(SRC_CSV, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if (row.get("county_id") or "").strip() == "T":
                rows.append(row)
    print(f"屏東來源 {len(rows)} 隊；geojson 既有 {len(fc['features'])} 點")

    added = 0
    failed = []
    for row in rows:
        sid = row.get("station_id")
        if sid in existing_ids:
            continue
        addr = (row.get("address") or "").strip()
        name = row.get("name") or ""
        coord = geocode(token, addr, cache) if addr else None
        if not coord:
            failed.append(f"{name}({addr})")
            print(f"  ✗ {name}  {addr}")
            continue
        raw_type = (row.get("type") or "").strip()
        fc["features"].append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [coord[0], coord[1]]},
            "properties": {
                "id": sid,
                "name": name,
                "type": raw_type or None,
                "cat": raw_type if raw_type in STATION_CATS else "其他",
                "address": addr or None,
                "phone": (row.get("phone") or "").strip() or None,
                "district": (row.get("district") or "").strip() or None,
                "county": "屏東縣",
                "geocoded": "mapbox",  # 標記人工補座標來源
            },
        })
        added += 1
        print(f"  ✓ {name}  → {coord}")

    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    STATIONS_GEOJSON.write_text(
        json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\n新增屏東 {added} 隊，失敗 {len(failed)}；總計 {len(fc['features'])} 點")
    if failed:
        print("失敗清單：\n  " + "\n  ".join(failed))


if __name__ == "__main__":
    main()
