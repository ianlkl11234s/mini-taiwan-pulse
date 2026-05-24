"""
export_waste_stops_static.py
=============================
全台清運點位靜態 GeoJSON，給前端「wasteStopsStatic」layer 用。

**只包含真實 geocoded 點**（排除 Stage 6 內插 / Stage 6b 外推 / nearest fallback），
避免散點圖出現「人為等距直線串」。

兩種資料源合併：
  1. supabase 5 城既有 (waste 路徑來源，真實縣市政府 open data 座標)
  2. taipei-gis-analytics stops_pending.json hwms 17 城，filter geocoded_via 為：
       - tgos_batch_v2 / tgos_batch_v2_round4
       - pre_geocoded_normalize
       - poi_school / poi_foursquare / poi_nominatim
       - None (early callback legacy)
     排除：interpolated_route / extrapolated_route / nearest_known_route

執行：
  python3 scripts/export/export_waste_stops_static.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import psycopg2

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_PATH = PROJECT_ROOT / "public/geo/waste_stops_static.geojson"

# 5 城既有 (waste 路徑，supabase 有 hwms 沒)
EXISTING_5_CITIES = {"高雄市", "新北市", "宜蘭縣", "臺北市", "基隆市"}

# 17 城 hwms 路徑 — 接受的 geocoded_via（真實 geocoded，非內插）
ACCEPTED_VIA = {
    "tgos_batch_v2",
    "tgos_batch_v2_round4",
    "pre_geocoded_normalize",
    "poi_school",
    "poi_foursquare",
    "poi_nominatim",
}
EXCLUDED_VIA = {
    "interpolated_route",
    "extrapolated_route",
    "nearest_known_route",
}

STOPS_PENDING = PROJECT_ROOT.parent / "taipei-gis-analytics/data/processed/waste_management/hwms_pending/stops_pending_geocode.json"


def _load_db_url() -> str:
    env_path = PROJECT_ROOT.parent / "gis-platform/.env"
    with open(env_path) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError(f"DATABASE_URL not found in {env_path}")


def main():
    features = []

    # ── 1. supabase 5 城 (waste 路徑，全包) ──
    conn = psycopg2.connect(_load_db_url())
    cur = conn.cursor()
    print("[1] 撈 supabase 5 城既有 stops (waste 路徑)...")
    # 注意：用 DOUBLE PRECISION (FLOAT8) 而非 REAL，後者只有 6-7 位有效數字
    # 對 121.506905 這類經緯度會被砍成 121.507，導致前端看到「3 位小數整齊網格」
    cur.execute(f"""
        SELECT
            id, city, district, stop_name, route_id, route_name,
            vehicle_type,
            ST_X(geometry)::FLOAT8 AS lng,
            ST_Y(geometry)::FLOAT8 AS lat
        FROM spatial.waste_collection_stops
        WHERE geometry IS NOT NULL
          AND city = ANY(%s)
        ORDER BY city, route_id, seq
    """, (list(EXISTING_5_CITIES),))
    rows = cur.fetchall()
    print(f"    {len(rows):,} stops")
    for sid, city, dist, name, rid, rname, vtype, lng, lat in rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lng), 6), round(float(lat), 6)]},
            "properties": {
                "id": sid, "city": city, "district": dist,
                "stop_name": name, "route_id": rid, "route_name": rname,
                "vehicle_type": vtype, "via": "waste_open_data",
            },
        })
    cur.close()
    conn.close()

    # ── 2. stops_pending.json 17 城 hwms (filter 真實 geocoded) ──
    print(f"\n[2] 讀 stops_pending.json 17 城 hwms...")
    if not STOPS_PENDING.exists():
        print(f"    [!] {STOPS_PENDING} 不存在，跳過 17 城")
    else:
        stops = json.loads(STOPS_PENDING.read_text(encoding="utf-8"))
        n_total = 0
        n_kept = 0
        skipped_via = {}
        for s in stops:
            if s.get("lng") is None or s.get("lat") is None:
                continue
            city = s.get("city") or ""
            if city in EXISTING_5_CITIES:
                continue  # 5 城已從 supabase 拉
            n_total += 1
            via = s.get("geocoded_via")
            if via in EXCLUDED_VIA:
                skipped_via[via] = skipped_via.get(via, 0) + 1
                continue
            # ACCEPTED_VIA 或 None (legacy) 都包
            n_kept += 1
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(float(s["lng"]), 6), round(float(s["lat"]), 6)]},
                "properties": {
                    "city": city, "district": s.get("district"),
                    "stop_name": s.get("stop_name"), "route_id": s.get("route_id"),
                    "route_name": s.get("route_name"),
                    "vehicle_type": s.get("vehicle_type"),
                    "via": via or "legacy",
                },
            })
        print(f"    total 17 城 stops: {n_total:,}")
        print(f"    kept (真實 geocoded): {n_kept:,}")
        print(f"    skipped (內插/外推): {skipped_via}")

    # ── 3. dedup by rounded coord（消除同位置多 route_id 的重影）──
    # 5 dp ≈ 1.1m 解析度；同位置不同 route_id 合併為一點，routes_count 紀錄重數
    print(f"\n[3] dedup by (round 5dp coord)...")
    buckets: dict[tuple, dict] = {}
    for feat in features:
        lng, lat = feat["geometry"]["coordinates"]
        key = (round(lng, 5), round(lat, 5))
        if key not in buckets:
            feat["properties"]["routes_count"] = 1
            buckets[key] = feat
        else:
            buckets[key]["properties"]["routes_count"] += 1
    deduped = list(buckets.values())
    print(f"    {len(features):,} → {len(deduped):,} ({len(features) - len(deduped):,} removed)")
    features = deduped

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": features}
    OUT_PATH.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"\n[4] 寫入 {OUT_PATH.name}")
    print(f"    features: {len(features):,}")
    print(f"    size: {size_mb:.1f} MB raw")


if __name__ == "__main__":
    main()
