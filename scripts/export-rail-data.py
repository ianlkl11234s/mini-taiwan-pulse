#!/usr/bin/env python3
"""
從 mini-taipei-v3 複製軌道資料到 public/rail/
包含 TRTC、THSR、TRA、KRTC、KLRT、TMRT 六個系統
"""

import json
import os
import shutil
import glob as globmod

SOURCE_BASE = os.path.join(
    os.path.dirname(__file__),
    "../../mini-taipei-v3/public/data"
)
OUTPUT_BASE = os.path.join(
    os.path.dirname(__file__),
    "../public/rail"
)

# 定義要複製的系統及其資料結構
SYSTEMS = {
    "trtc": {
        "tracks": "trtc/tracks/*.geojson",
        "schedules": "trtc/schedules/*.json",
        "station_progress": "trtc/station_progress.json",
    },
    "thsr": {
        "tracks": "thsr/tracks/*.geojson",
        "schedules_main": "thsr/schedules/thsr_schedules.json",
        "schedules_daily": "thsr/schedules/daily/2026-02-18.json",
        "station_progress": "thsr/station_progress.json",
    },
    "tra": {
        "tracks": "tra/tracks_od/*.geojson",
        "master_schedule": "tra/schedules_real/master_schedule.json",
        "station_progress": "tra/tracks_od/od_station_progress.json",
    },
    "krtc": {
        "tracks": "krtc/tracks/*.geojson",
        "schedules": "krtc/schedules/krtc_schedules.json",
        "station_progress": "krtc/station_progress.json",
    },
    "klrt": {
        "tracks": "klrt/tracks/*.geojson",
        "schedules": "klrt/schedules/klrt_schedules.json",
        "station_progress": "klrt/station_progress.json",
    },
    "tmrt": {
        "tracks": "tmrt/tracks/*.geojson",
        "schedules": "tmrt/schedules/tmrt_schedules.json",
        "station_progress": "tmrt/station_progress.json",
    },
}


def copy_file(src: str, dst: str):
    """複製單一檔案"""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def copy_glob(pattern: str, dst_dir: str) -> int:
    """複製 glob pattern 匹配的檔案"""
    src_path = os.path.join(SOURCE_BASE, pattern)
    files = globmod.glob(src_path)
    os.makedirs(dst_dir, exist_ok=True)
    count = 0
    for f in files:
        dst = os.path.join(dst_dir, os.path.basename(f))
        shutil.copy2(f, dst)
        count += 1
    return count


def main():
    if not os.path.exists(SOURCE_BASE):
        print(f"Error: Source not found at {SOURCE_BASE}")
        return

    # 清理舊資料
    if os.path.exists(OUTPUT_BASE):
        shutil.rmtree(OUTPUT_BASE)
    os.makedirs(OUTPUT_BASE, exist_ok=True)

    total_files = 0

    for system_id, config in SYSTEMS.items():
        print(f"\n=== {system_id.upper()} ===")
        system_dir = os.path.join(OUTPUT_BASE, system_id)

        for key, pattern in config.items():
            if "*" in pattern:
                # Glob pattern → 複製多個檔案
                subdir = key  # e.g., "tracks", "schedules"
                dst_dir = os.path.join(system_dir, subdir)
                count = copy_glob(pattern, dst_dir)
                print(f"  {key}: {count} files")
                total_files += count
            else:
                # 單一檔案
                src = os.path.join(SOURCE_BASE, pattern)
                if os.path.exists(src):
                    # 決定目標路徑
                    if key == "station_progress":
                        dst = os.path.join(system_dir, "station_progress.json")
                    elif key == "schedules_main":
                        dst = os.path.join(system_dir, "schedules", os.path.basename(pattern))
                    elif key == "schedules_daily":
                        dst = os.path.join(system_dir, "schedules", "daily", os.path.basename(pattern))
                    elif key == "master_schedule":
                        dst = os.path.join(system_dir, "master_schedule.json")
                    else:
                        dst = os.path.join(system_dir, os.path.basename(pattern))
                    copy_file(src, dst)
                    # 顯示檔案大小
                    size_kb = os.path.getsize(dst) / 1024
                    print(f"  {key}: {os.path.basename(dst)} ({size_kb:.0f} KB)")
                    total_files += 1
                else:
                    print(f"  {key}: NOT FOUND ({src})")

    # 計算總大小
    total_size = 0
    for root, dirs, files in os.walk(OUTPUT_BASE):
        for f in files:
            total_size += os.path.getsize(os.path.join(root, f))

    print(f"\n=== Summary ===")
    print(f"Total files: {total_files}")
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")
    print(f"Output: {OUTPUT_BASE}")


if __name__ == "__main__":
    main()
