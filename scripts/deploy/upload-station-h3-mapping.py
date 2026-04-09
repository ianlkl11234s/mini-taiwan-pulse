"""
上傳 YouBike station → H3 mapping 到 Supabase

從 reference.stations 讀取 YouBike 站點座標，
用 Python h3 library 計算各解析度的 H3 index，
寫入 reference.station_h3_mapping。
"""

import os

import h3
import psycopg2
from psycopg2.extras import execute_values

# ── 設定 ──

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
GIS_ROOT = os.path.dirname(PROJECT_ROOT)
ENV_PATH = os.path.join(GIS_ROOT, "gis-platform", ".env")

H3_RESOLUTIONS = [7, 8]


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

# ── 查詢站點座標 ──

print("[1/3] Querying YouBike station coordinates...")
conn = psycopg2.connect(DATABASE_URL)

with conn.cursor() as cur:
    cur.execute("""
        SELECT station_uid, ST_Y(geom) AS lat, ST_X(geom) AS lng
        FROM reference.stations
        WHERE system = 'youbike'
          AND geom IS NOT NULL
    """)
    stations = cur.fetchall()

print(f"  → {len(stations)} stations")

# ── 計算 H3 index ──

print("[2/3] Computing H3 indices...")

rows = []
for uid, lat, lng in stations:
    for res in H3_RESOLUTIONS:
        h3_idx = h3.latlng_to_cell(float(lat), float(lng), res)
        rows.append((uid, "youbike", res, h3_idx))

print(f"  → {len(rows)} mapping rows ({len(stations)} stations × {len(H3_RESOLUTIONS)} resolutions)")

# ── 上傳 ──

print("[3/3] Uploading to reference.station_h3_mapping...")

with conn.cursor() as cur:
    # 清除舊資料再寫入
    cur.execute("DELETE FROM reference.station_h3_mapping WHERE system = 'youbike'")
    deleted = cur.rowcount
    print(f"  → Deleted {deleted} old rows")

    execute_values(
        cur,
        """INSERT INTO reference.station_h3_mapping
           (station_uid, system, resolution, h3_index)
           VALUES %s
           ON CONFLICT (station_uid, resolution) DO UPDATE
           SET h3_index = EXCLUDED.h3_index, system = EXCLUDED.system""",
        rows,
        page_size=500,
    )
    print(f"  → Inserted {len(rows)} rows")

conn.commit()
conn.close()

# ── 驗證 ──

print("\nSummary:")
for res in H3_RESOLUTIONS:
    unique_cells = len({r[3] for r in rows if r[2] == res})
    print(f"  res{res}: {unique_cells} unique H3 cells from {len(stations)} stations")

print("\nDone!")
