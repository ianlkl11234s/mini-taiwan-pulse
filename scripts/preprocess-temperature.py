#!/usr/bin/env python3
"""
preprocess-temperature.py
從 weather_change 溫度時序資料產出 24 小時平均日循環供前端 3D 波浪渲染

輸入: ../weather_change/public/temperature_timelapse_data.json (28MB, 589 frames)
輸出: public/temperature_grid.json
格式: 24 幀（hour 0~23），每幀為該小時所有天的平均溫度
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(BASE, "..", "weather_change", "public", "temperature_timelapse_data.json")
OUTPUT = os.path.join(BASE, "public", "temperature_grid.json")

TZ_TAIPEI = timezone(timedelta(hours=8))


def main():
    if not os.path.exists(INPUT):
        print(f"Error: 找不到輸入檔: {INPUT}")
        sys.exit(1)

    print(f"Reading {INPUT}...")
    with open(INPUT, "r", encoding="utf-8") as f:
        raw = json.load(f)

    meta = raw["metadata"]
    geo = meta["geo_info"]
    all_frames = raw["frames"]

    rows = len(all_frames[0]["data"])
    cols = len(all_frames[0]["data"][0])
    total_cells = rows * cols

    print(f"Grid: {rows} rows × {cols} cols = {total_cells} cells")
    print(f"Total frames: {len(all_frames)}")

    # 建立 land mask: 任何 frame 有非 null 值即為陸地
    land_mask = [0] * total_cells
    for frame in all_frames:
        for r in range(rows):
            for c in range(cols):
                if frame["data"][r][c] is not None:
                    land_mask[r * cols + c] = 1

    land_count = sum(land_mask)
    land_indices = [i for i, m in enumerate(land_mask) if m == 1]
    print(f"Land cells: {land_count} / {total_cells} ({100*land_count/total_cells:.1f}%)")

    # ── 按小時分組，計算每小時平均溫度 ──
    # hourly_sums[hour][land_idx] = (total, count)
    hourly_sums = [[0.0] * land_count for _ in range(24)]
    hourly_counts = [[0] * land_count for _ in range(24)]

    for frame in all_frames:
        t = datetime.fromisoformat(frame["time"])
        hour = t.astimezone(TZ_TAIPEI).hour

        for li, idx in enumerate(land_indices):
            r = idx // cols
            c = idx % cols
            v = frame["data"][r][c]
            if v is not None:
                hourly_sums[hour][li] += v
                hourly_counts[hour][li] += 1

    # 統計每小時有多少 frame
    hour_frame_counts = {}
    for frame in all_frames:
        t = datetime.fromisoformat(frame["time"])
        hour = t.astimezone(TZ_TAIPEI).hour
        hour_frame_counts[hour] = hour_frame_counts.get(hour, 0) + 1

    print("\nFrames per hour:")
    for h in range(24):
        print(f"  {h:02d}:00  {hour_frame_counts.get(h, 0):3d} frames")

    # 計算平均值
    global_min = float("inf")
    global_max = float("-inf")
    out_frames = []

    for hour in range(24):
        values = []
        for li in range(land_count):
            cnt = hourly_counts[hour][li]
            if cnt > 0:
                avg = hourly_sums[hour][li] / cnt
                if avg < global_min:
                    global_min = avg
                if avg > global_max:
                    global_max = avg
                values.append(round(avg * 10))  # 整數 × 10
            else:
                values.append(0)

        out_frames.append({
            "hour": hour,
            "values": values,
        })

    # 填補缺失小時（用鄰近小時插值）
    for hour in range(24):
        if hour_frame_counts.get(hour, 0) == 0:
            # 找最近的前後有值小時
            prev_h = (hour - 1) % 24
            next_h = (hour + 1) % 24
            while hour_frame_counts.get(prev_h, 0) == 0 and prev_h != hour:
                prev_h = (prev_h - 1) % 24
            while hour_frame_counts.get(next_h, 0) == 0 and next_h != hour:
                next_h = (next_h + 1) % 24

            prev_vals = out_frames[prev_h]["values"]
            next_vals = out_frames[next_h]["values"]
            out_frames[hour]["values"] = [
                round((p + n) / 2) for p, n in zip(prev_vals, next_vals)
            ]
            print(f"  Interpolated hour {hour:02d} from hours {prev_h:02d} and {next_h:02d}")

    output = {
        "metadata": {
            "rows": rows,
            "cols": cols,
            "bottomLeftLon": geo["bottom_left_lon"],
            "bottomLeftLat": geo["bottom_left_lat"],
            "resolutionDeg": geo["resolution_deg"],
            "tempMin": round(global_min, 1),
            "tempMax": round(global_max, 1),
        },
        "landIndices": land_indices,
        "frames": out_frames,
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"\nOutput: {OUTPUT}")
    print(f"Size: {size_kb:.0f} KB")
    print(f"Temperature range: {global_min:.1f}°C ~ {global_max:.1f}°C")
    print(f"Land cells: {land_count}, Frames: 24 (hourly avg)")


if __name__ == "__main__":
    main()
