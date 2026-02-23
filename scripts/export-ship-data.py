#!/usr/bin/env python3
"""
從 ship-gis 的 SQLite 匯出移動船舶軌跡
支援單日或多日匯出，輸出格式對齊 TrailPoint: [lat, lng, 0, unix_timestamp]

用法:
  python3 scripts/export-ship-data.py                       # 預設 2026-02-18
  python3 scripts/export-ship-data.py 2026-02-18            # 單日
  python3 scripts/export-ship-data.py 2026-02-18 2026-02-19 # 日期範圍（含頭尾）
"""

import json
import sqlite3
import os
import sys
from datetime import datetime, timezone, timedelta, date

DB_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../ship-gis/data/ship_data.db"
)
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../public/ship_data.json"
)

MIN_MOVING_POINTS = 5  # 至少 5 個 sog > 0.5 的位置點
SOG_THRESHOLD = 0.5

TW_TZ = timezone(timedelta(hours=8))


def iso_to_unix(ts_str: str) -> int:
    """將 '2026-02-18T00:06:00' 格式轉為 Unix timestamp"""
    dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
    dt = dt.replace(tzinfo=TW_TZ)
    return int(dt.timestamp())


def parse_dates(args: list[str]) -> list[str]:
    """解析 CLI 日期參數，回傳日期字串清單"""
    if len(args) == 0:
        return ["2026-02-18"]
    elif len(args) == 1:
        return [args[0]]
    else:
        start = date.fromisoformat(args[0])
        end = date.fromisoformat(args[1])
        dates = []
        current = start
        while current <= end:
            dates.append(current.isoformat())
            current += timedelta(days=1)
        return dates


def build_date_filter(dates: list[str]) -> tuple[str, list]:
    """建立 SQL WHERE 條件（多日 OR）"""
    if len(dates) == 1:
        return "timestamp LIKE ?", [f"{dates[0]}%"]
    conditions = " OR ".join(["timestamp LIKE ?"] * len(dates))
    params = [f"{d}%" for d in dates]
    return f"({conditions})", params


def main():
    dates = parse_dates(sys.argv[1:])
    date_label = dates[0] if len(dates) == 1 else f"{dates[0]} ~ {dates[-1]}"

    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print(f"Querying ships for {date_label} ({len(dates)} day(s))...")

    date_filter, date_params = build_date_filter(dates)

    # Step 1: 找出有足夠移動資料點的船舶 MMSI
    cursor.execute(f"""
        SELECT mmsi, COUNT(*) as moving_count
        FROM ship_positions
        WHERE {date_filter} AND sog > ?
        GROUP BY mmsi
        HAVING moving_count >= ?
        ORDER BY moving_count DESC
    """, date_params + [SOG_THRESHOLD, MIN_MOVING_POINTS])

    qualifying_mmsis = cursor.fetchall()
    print(f"Found {len(qualifying_mmsis)} qualifying ships")

    if not qualifying_mmsis:
        print("No ships found!")
        conn.close()
        return

    # Step 2: 取得這些船的所有軌跡資料（含靜止點，保持軌跡完整）
    mmsi_list = [row[0] for row in qualifying_mmsis]
    placeholders = ",".join(["?"] * len(mmsi_list))

    cursor.execute(f"""
        SELECT mmsi, vessel_type, timestamp, lat, lon, sog
        FROM ship_positions
        WHERE {date_filter} AND mmsi IN ({placeholders})
        ORDER BY mmsi, timestamp
    """, date_params + mmsi_list)

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
            "date": date_label,
            "ship_count": len(ships),
            "time_range": [int(min_ts), int(max_ts)],
        },
        "ships": ships,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"\nOutput: {OUTPUT_PATH}")
    print(f"Ships: {len(ships)}, Size: {file_size / 1024 / 1024:.1f} MB")
    print(f"Time range: {datetime.fromtimestamp(min_ts, TW_TZ)} ~ {datetime.fromtimestamp(max_ts, TW_TZ)}")
    print(f"Avg points/ship: {sum(len(s['path']) for s in ships) / len(ships):.0f}")

    conn.close()


if __name__ == "__main__":
    main()
