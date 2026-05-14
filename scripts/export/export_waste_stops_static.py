"""
export_waste_stops_static.py
=============================
從 supabase spatial.waste_collection_stops 拉所有 stops 寫成 GeoJSON：
  public/geo/waste_stops_static.geojson

對應前端「wasteStopsStatic」靜態點位 layer（Mapbox circle）。

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


def _load_db_url() -> str:
    env_path = PROJECT_ROOT.parent / "gis-platform/.env"
    with open(env_path) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError(f"DATABASE_URL not found in {env_path}")


def main():
    conn = psycopg2.connect(_load_db_url())
    cur = conn.cursor()
    print("[1] 撈 stops...")
    cur.execute("""
        SELECT
            id, city, district, stop_name, route_id, route_name,
            vehicle_type,
            ST_X(geometry)::REAL AS lng,
            ST_Y(geometry)::REAL AS lat
        FROM spatial.waste_collection_stops
        WHERE geometry IS NOT NULL
        ORDER BY city, route_id, seq
    """)
    rows = cur.fetchall()
    print(f"    {len(rows):,} stops")

    features = []
    for sid, city, dist, name, rid, rname, vtype, lng, lat in rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lng), 6), round(float(lat), 6)]},
            "properties": {
                "id": sid,
                "city": city,
                "district": dist,
                "stop_name": name,
                "route_id": rid,
                "route_name": rname,
                "vehicle_type": vtype,
            },
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": features}
    # 緊湊 JSON 省空間
    OUT_PATH.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"[2] 寫入 {OUT_PATH.name} · {size_mb:.1f} MB")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
