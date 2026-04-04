"""
YouBike H3 滿車率預處理腳本 v2

從 Supabase 即時資料庫查詢 YouBike 時序資料，
聚合到 H3 res8 六角格，輸出帶實際時間戳的滿車率。

資料來源：
  - realtime.youbike_snapshots（時序資料，按日分區）
  - reference.stations（站點座標，system='youbike'）

輸出：public/h3_youbike_fullness_res8.json
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import h3
import psycopg2

# ── 設定 ──

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
GIS_ROOT = os.path.dirname(PROJECT_ROOT)
ENV_PATH = os.path.join(GIS_ROOT, "gis-platform", ".env")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "public", "h3_youbike_fullness_res8.json")

H3_RESOLUTION = 8
CITIES = ("Taipei", "NewTaipei")

# ── 讀取 .env ──

def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip()
    return env

env = load_env(ENV_PATH)
DATABASE_URL = env.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(f"DATABASE_URL not found in {ENV_PATH}")

# ── Step 1: 從 Supabase 查詢站點座標 ──

print("[1/4] Querying station coordinates...")
conn = psycopg2.connect(DATABASE_URL)

with conn.cursor() as cur:
    cur.execute("""
        SELECT station_uid, ST_Y(geom) AS lat, ST_X(geom) AS lng
        FROM reference.stations
        WHERE system = 'youbike'
          AND geom IS NOT NULL
    """)
    station_coords = {}
    for uid, lat, lng in cur.fetchall():
        station_coords[uid] = (float(lat), float(lng))

print(f"  → {len(station_coords)} stations with coordinates")

# ── Step 2: 查詢時序資料（按小時聚合，在 DB 端完成） ──

print("[2/4] Querying hourly aggregated snapshots from Supabase...")

with conn.cursor() as cur:
    # 先確認資料範圍
    cur.execute("""
        SELECT MIN(collected_at), MAX(collected_at), COUNT(*)
        FROM realtime.youbike_snapshots
        WHERE city IN %s
    """, (CITIES,))
    min_time, max_time, total_rows = cur.fetchone()
    print(f"  → Data range: {min_time} ~ {max_time}")
    print(f"  → Total rows: {total_rows:,}")

    # 按站點 + 15 分鐘聚合（對齊收集頻率）
    cur.execute("""
        SELECT
            y.station_uid,
            y.city,
            date_trunc('hour', y.collected_at AT TIME ZONE 'Asia/Taipei')
              + INTERVAL '15 min' * FLOOR(EXTRACT(MINUTE FROM y.collected_at AT TIME ZONE 'Asia/Taipei') / 15)
              AS quarter_tw,
            AVG(y.available_rent) AS avg_rent,
            AVG(y.total) AS avg_total,
            COUNT(*) AS sample_count
        FROM realtime.youbike_snapshots y
        WHERE y.city IN %s
        GROUP BY y.station_uid, y.city, quarter_tw
        ORDER BY quarter_tw
    """, (CITIES,))

    rows = cur.fetchall()
    print(f"  → {len(rows):,} station-quarter aggregates")

conn.close()

# ── Step 3: 轉換為 H3 聚合 ──

print("[3/4] Aggregating to H3 cells...")

# station → h3 index mapping
station_h3 = {}
for uid, (lat, lng) in station_coords.items():
    station_h3[uid] = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)

# 按時間戳 → h3_cell 聚合
# hour_key → { h3_index → { rent_sum, total_sum, count } }
hourly_h3 = defaultdict(lambda: defaultdict(lambda: {"rent": 0.0, "total": 0.0, "count": 0}))

skipped = 0
for uid, city, hour_tw, avg_rent, avg_total, sample_count in rows:
    if uid not in station_h3:
        skipped += 1
        continue
    h3_idx = station_h3[uid]
    # 轉成 ISO 格式 key（台灣時間，含分鐘）
    hour_key = hour_tw.strftime("%Y-%m-%dT%H:%M")

    cell = hourly_h3[hour_key][h3_idx]
    cell["rent"] += float(avg_rent)
    cell["total"] += float(avg_total)
    cell["count"] += 1

if skipped > 0:
    print(f"  → Skipped {skipped} rows (no coordinates)")

# 計算每個時間點的 H3 cells
snapshots = {}
all_cells_set = set()

for hour_key in sorted(hourly_h3.keys()):
    cells_data = hourly_h3[hour_key]
    hour_cells = []

    for h3_idx, agg in cells_data.items():
        if agg["total"] == 0:
            continue
        fullness = agg["rent"] / agg["total"]  # 有車率
        hour_cells.append({
            "h": h3_idx,
            "fr": round(fullness, 4),
            "sc": round(agg["total"], 1),
        })
        all_cells_set.add(h3_idx)

    snapshots[hour_key] = hour_cells

print(f"  → {len(all_cells_set)} unique H3 cells")
print(f"  → {len(snapshots)} hourly snapshots")

# ── Step 4: 輸出 ──

print("[4/4] Writing output...")

time_keys = sorted(snapshots.keys())
output = {
    "metadata": {
        "resolution": H3_RESOLUTION,
        "cell_count": len(all_cells_set),
        "source": "supabase:realtime.youbike_snapshots",
        "generated_at": datetime.now().isoformat(),
        "time_range": [time_keys[0], time_keys[-1]] if time_keys else [],
        "snapshot_count": len(snapshots),
        "cities": list(CITIES),
        "total_db_rows": total_rows,
        "value_columns": ["fr", "sc"],
    },
    "snapshots": snapshots,
}

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, "w") as f:
    json.dump(output, f, separators=(",", ":"))

file_size = os.path.getsize(OUTPUT_PATH) / 1024
print(f"\nDone! Output: {OUTPUT_PATH}")
print(f"  → {len(all_cells_set)} unique H3 cells")
print(f"  → {len(snapshots)} snapshots ({time_keys[0]} ~ {time_keys[-1]})")
print(f"  → {file_size:.1f} KB")
