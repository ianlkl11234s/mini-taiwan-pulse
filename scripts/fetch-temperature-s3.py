#!/usr/bin/env python3
"""
fetch-temperature-s3.py
從 S3 下載溫度格點快照，整合成 temperature_grid.json（含真實 timestamp）

用法:
  python3 scripts/fetch-temperature-s3.py                    # 自動偵測航班時間範圍
  python3 scripts/fetch-temperature-s3.py 2026-02-17 2026-02-20  # 指定日期範圍

輸出: public/temperature_grid.json
格式: frames[].time = unix timestamp（秒），每幀為一個小時的溫度快照
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta, date

import boto3

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(BASE, "public", "temperature_grid.json")
ENV_FILE = os.path.join(BASE, ".env")

TZ_TAIPEI = timezone(timedelta(hours=8))


def load_env():
    """從 .env 讀取 S3 設定"""
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env


def detect_flight_time_range():
    """從 aviation_data.json 偵測航班時間範圍，回傳 (start_date, end_date)"""
    aviation_path = os.path.join(BASE, "public", "aviation_data.json")
    if not os.path.exists(aviation_path):
        return None, None

    print("Detecting flight time range from aviation_data.json...")
    with open(aviation_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    flights = data if isinstance(data, list) else data.get("flights", data.get("data", []))
    if not flights:
        return None, None

    min_t = float("inf")
    max_t = float("-inf")
    for flight in flights:
        path = flight.get("path", [])
        for pt in path:
            t = pt[3] if len(pt) > 3 else None
            if t is not None:
                min_t = min(min_t, t)
                max_t = max(max_t, t)

    if min_t == float("inf"):
        return None, None

    start_dt = datetime.fromtimestamp(min_t, tz=TZ_TAIPEI)
    end_dt = datetime.fromtimestamp(max_t, tz=TZ_TAIPEI)
    print(f"  Flight range: {start_dt.isoformat()} ~ {end_dt.isoformat()}")
    return start_dt.date(), end_dt.date()


def list_s3_temperature_files(s3, bucket, target_date):
    """列出 S3 上某天的溫度檔案"""
    prefix = f"temperature/{target_date.year}/{target_date.month:02d}/{target_date.day:02d}/"
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=100)
    files = []
    if "Contents" in resp:
        for obj in resp["Contents"]:
            files.append(obj["Key"])
    return sorted(files)


def download_temperature_frame(s3, bucket, key):
    """從 S3 下載單筆溫度資料"""
    resp = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(resp["Body"].read().decode("utf-8"))


def main():
    env = load_env()
    bucket = env.get("S3_BUCKET", "migu-gis-data-collector")

    s3 = boto3.client(
        "s3",
        aws_access_key_id=env.get("S3_ACCESS_KEY"),
        aws_secret_access_key=env.get("S3_SECRET_KEY"),
        region_name=env.get("S3_REGION", "ap-southeast-2"),
    )

    # 決定日期範圍
    if len(sys.argv) >= 3:
        start_date = date.fromisoformat(sys.argv[1])
        end_date = date.fromisoformat(sys.argv[2])
    else:
        start_date, end_date = detect_flight_time_range()
        if start_date is None:
            print("Error: 無法偵測航班時間範圍，請手動指定日期")
            print("Usage: python3 scripts/fetch-temperature-s3.py 2026-02-17 2026-02-20")
            sys.exit(1)

    print(f"\nDate range: {start_date} ~ {end_date}")

    # 收集所有日期
    all_dates = []
    d = start_date
    while d <= end_date:
        all_dates.append(d)
        d += timedelta(days=1)

    # 下載所有 frames
    raw_frames = []
    for target_date in all_dates:
        keys = list_s3_temperature_files(s3, bucket, target_date)
        print(f"  {target_date}: {len(keys)} files")
        for key in keys:
            try:
                data = download_temperature_frame(s3, bucket, key)
                raw_frames.append(data)
            except Exception as e:
                print(f"    Warning: failed to download {key}: {e}")

    if not raw_frames:
        print("Error: 沒有下載到任何溫度資料")
        sys.exit(1)

    print(f"\nTotal frames downloaded: {len(raw_frames)}")

    # 取得 grid 資訊（從第一筆）
    first = raw_frames[0]
    rows = len(first["data"])
    cols = len(first["data"][0])
    total_cells = rows * cols
    print(f"Grid: {rows} rows x {cols} cols = {total_cells} cells")

    # geo_info 可能在頂層或 metadata 中
    geo = first.get("geo_info", {})
    if not geo:
        geo = first.get("metadata", {}).get("geo_info", {})

    # 建立 land mask（任何 frame 有非 null 值即為陸地）
    land_mask = [0] * total_cells
    for frame in raw_frames:
        grid = frame["data"]
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] is not None:
                    land_mask[r * cols + c] = 1

    land_count = sum(land_mask)
    land_indices = [i for i, m in enumerate(land_mask) if m == 1]
    print(f"Land cells: {land_count} / {total_cells} ({100 * land_count / total_cells:.1f}%)")

    # 按 observation_time 排序
    def get_obs_time(frame):
        obs_str = frame.get("observation_time", frame.get("fetch_time", ""))
        try:
            return datetime.fromisoformat(obs_str)
        except (ValueError, TypeError):
            return datetime.min.replace(tzinfo=TZ_TAIPEI)

    raw_frames.sort(key=get_obs_time)

    # 去重（同一小時可能有多筆，取最後一筆）
    seen_hours = {}
    for frame in raw_frames:
        obs = get_obs_time(frame)
        hour_key = obs.strftime("%Y-%m-%d-%H")
        seen_hours[hour_key] = frame  # 後來的覆蓋

    deduped = sorted(seen_hours.values(), key=get_obs_time)
    print(f"Unique hourly frames: {len(deduped)}")

    # 轉換為輸出格式
    global_min = float("inf")
    global_max = float("-inf")
    out_frames = []

    for frame in deduped:
        obs = get_obs_time(frame)
        unix_sec = int(obs.timestamp())
        grid = frame["data"]

        values = []
        for idx in land_indices:
            r = idx // cols
            c = idx % cols
            v = grid[r][c]
            if v is not None:
                if v < global_min:
                    global_min = v
                if v > global_max:
                    global_max = v
                values.append(round(v * 10))  # 整數 × 10
            else:
                values.append(0)

        out_frames.append({
            "time": unix_sec,
            "values": values,
        })

    print(f"\nTime range: {datetime.fromtimestamp(out_frames[0]['time'], tz=TZ_TAIPEI).isoformat()}")
    print(f"         ~ {datetime.fromtimestamp(out_frames[-1]['time'], tz=TZ_TAIPEI).isoformat()}")

    output = {
        "metadata": {
            "rows": rows,
            "cols": cols,
            "bottomLeftLon": geo.get("bottom_left_lon", 120.0),
            "bottomLeftLat": geo.get("bottom_left_lat", 21.88),
            "resolutionDeg": geo.get("resolution_deg", 0.03),
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
    print(f"Land cells: {land_count}, Frames: {len(out_frames)}")


if __name__ == "__main__":
    main()
