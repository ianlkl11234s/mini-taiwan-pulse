#!/usr/bin/env python3
"""
從 ship-gis 的 SQLite 匯出 2/18 移動船舶軌跡
輸出格式對齊 TrailPoint: [lat, lng, 0, unix_timestamp]
"""

import json
import sqlite3
import os
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../ship-gis/data/ship_data.db"
)
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../public/ship_data.json"
)

TARGET_DATE = "2026-02-18"
MIN_MOVING_POINTS = 5  # 至少 5 個 sog > 0.5 的位置點
SOG_THRESHOLD = 0.5
MAX_SHIPS = 2000

TW_TZ = timezone(timedelta(hours=8))


def iso_to_unix(ts_str: str) -> int:
    """將 '2026-02-18T00:06:00' 格式轉為 Unix timestamp"""
    # 假設是 UTC+8 台灣時間
    dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
    dt = dt.replace(tzinfo=TW_TZ)
    return int(dt.timestamp())


def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print(f"Querying ships for {TARGET_DATE}...")

    # Step 1: 找出有足夠移動資料點的船舶 MMSI
    cursor.execute("""
        SELECT mmsi, COUNT(*) as moving_count
        FROM ship_positions
        WHERE timestamp LIKE ? AND sog > ?
        GROUP BY mmsi
        HAVING moving_count >= ?
        ORDER BY moving_count DESC
        LIMIT ?
    """, (f"{TARGET_DATE}%", SOG_THRESHOLD, MIN_MOVING_POINTS, MAX_SHIPS))

    qualifying_mmsis = cursor.fetchall()
    print(f"Found {len(qualifying_mmsis)} qualifying ships")

    if not qualifying_mmsis:
        print("No ships found!")
        conn.close()
        return

    # Step 2: 取得這些船的所有軌跡資料
    mmsi_list = [row[0] for row in qualifying_mmsis]
    placeholders = ",".join(["?"] * len(mmsi_list))

    cursor.execute(f"""
        SELECT mmsi, vessel_type, timestamp, lat, lon, sog
        FROM ship_positions
        WHERE timestamp LIKE ? AND mmsi IN ({placeholders})
        ORDER BY mmsi, timestamp
    """, [f"{TARGET_DATE}%"] + mmsi_list)

    rows = cursor.fetchall()
    print(f"Total data points: {len(rows)}")

    # Step 3: 組裝成 ship 物件
    ships_dict: dict = {}
    min_ts = float("inf")
    max_ts = float("-inf")

    for mmsi, vessel_type, timestamp, lat, lon, sog in rows:
        unix_ts = iso_to_unix(timestamp)
        min_ts = min(min_ts, unix_ts)
        max_ts = max(max_ts, unix_ts)

        if mmsi not in ships_dict:
            ships_dict[mmsi] = {
                "mmsi": str(mmsi),
                "vessel_type": vessel_type or 0,
                "path": [],
            }
        # TrailPoint 格式: [lat, lng, 0, unix_timestamp]
        ships_dict[mmsi]["path"].append([
            round(lat, 6),
            round(lon, 6),
            0,
            unix_ts,
        ])

    ships = list(ships_dict.values())

    # 按資料點數排序
    ships.sort(key=lambda s: len(s["path"]), reverse=True)

    result = {
        "metadata": {
            "date": TARGET_DATE,
            "ship_count": len(ships),
            "time_range": [int(min_ts), int(max_ts)],
        },
        "ships": ships,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"Output: {OUTPUT_PATH}")
    print(f"Ships: {len(ships)}, Size: {file_size / 1024 / 1024:.1f} MB")
    print(f"Time range: {datetime.fromtimestamp(min_ts, TW_TZ)} ~ {datetime.fromtimestamp(max_ts, TW_TZ)}")

    conn.close()


if __name__ == "__main__":
    main()
