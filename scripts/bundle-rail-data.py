#!/usr/bin/env python3
"""
將 public/rail/ 下的所有散檔打包成單一 rail_bundle.json

用法：
  python3 scripts/bundle-rail-data.py

輸出：
  public/rail_bundle.json
"""

import json
import os
import glob
from pathlib import Path

RAIL_DIR = Path(__file__).parent.parent / "public" / "rail"
OUTPUT = Path(__file__).parent.parent / "public" / "rail_bundle.json"

SYSTEMS = ["trtc", "thsr", "tra", "krtc", "klrt", "tmrt"]


def load_json(path: str):
    """讀取 JSON 檔案，失敗回傳 None"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  ⚠ Skip {path}: {e}")
        return None


def load_tracks_from_dir(tracks_dir: Path) -> dict:
    """載入指定目錄下所有 .geojson"""
    tracks = {}
    if not tracks_dir.exists():
        return tracks

    for geojson_path in sorted(tracks_dir.glob("*.geojson")):
        track_id = geojson_path.stem
        data = load_json(str(geojson_path))
        if data:
            tracks[track_id] = data
    return tracks


def load_tracks(system_dir: Path) -> dict:
    """載入 tracks/ 目錄下所有 .geojson"""
    return load_tracks_from_dir(system_dir / "tracks")


def load_trtc_schedules(system_dir: Path) -> dict:
    """TRTC：每個 track 一個 JSON"""
    schedules = {}
    sched_dir = system_dir / "schedules"
    if not sched_dir.exists():
        return schedules

    for json_path in sorted(sched_dir.glob("*.json")):
        track_id = json_path.stem
        data = load_json(str(json_path))
        if data:
            schedules[track_id] = data
    return schedules


def load_thsr_schedules(system_dir: Path) -> dict:
    """THSR：優先 daily/2026-02-18.json，fallback 到 thsr_schedules.json"""
    sched_dir = system_dir / "schedules"

    # 優先用 daily
    daily_dir = sched_dir / "daily"
    if daily_dir.exists():
        daily_files = sorted(daily_dir.glob("*.json"))
        if daily_files:
            data = load_json(str(daily_files[0]))
            if data:
                return data

    # fallback
    fallback = sched_dir / "thsr_schedules.json"
    if fallback.exists():
        data = load_json(str(fallback))
        if data:
            return data

    return {}


def load_tra_schedules(system_dir: Path) -> dict:
    """TRA：master_schedule.json"""
    path = system_dir / "master_schedule.json"
    data = load_json(str(path))
    return {"master_schedule": data} if data else {}


def load_generic_schedules(system_dir: Path, system_id: str) -> dict:
    """通用格式：直接放在系統根目錄的 {id}_schedules.json"""
    schedule_names = {
        "krtc": "krtc_schedules",
        "klrt": "klrt_schedules",
        "tmrt": "tmrt_schedules",
    }
    name = schedule_names.get(system_id)
    if not name:
        return {}

    # 優先根目錄
    path = system_dir / f"{name}.json"
    if not path.exists():
        path = system_dir / "schedules" / f"{name}.json"
    if not path.exists():
        return {}

    data = load_json(str(path))
    return data if data else {}


def bundle_system(system_id: str) -> dict | None:
    """打包單一系統的所有資料"""
    system_dir = RAIL_DIR / system_id
    if not system_dir.exists():
        print(f"  ⚠ Directory not found: {system_dir}")
        return None

    print(f"  Processing {system_id}...")

    # station_progress
    station_progress = load_json(str(system_dir / "station_progress.json")) or {}

    # tracks
    tracks = load_tracks(system_dir)

    # schedules（各系統邏輯不同）
    if system_id == "trtc":
        schedules = load_trtc_schedules(system_dir)
    elif system_id == "thsr":
        schedules = load_thsr_schedules(system_dir)
    elif system_id == "tra":
        schedules = load_tra_schedules(system_dir)
    else:
        schedules = load_generic_schedules(system_dir, system_id)

    track_count = len(tracks)
    schedule_count = len(schedules)
    print(f"    tracks: {track_count}, schedules: {schedule_count}, stations: {len(station_progress)}")

    result = {
        "station_progress": station_progress,
        "tracks": tracks,
        "schedules": schedules,
    }

    # TRA: 額外載入 golden tracks（顯示用）
    if system_id == "tra":
        golden_tracks = load_tracks_from_dir(system_dir / "tracks_golden")
        if golden_tracks:
            result["tracks_golden"] = golden_tracks
            print(f"    tracks_golden: {len(golden_tracks)}")

    return result


def main():
    print(f"Rail directory: {RAIL_DIR}")
    if not RAIL_DIR.exists():
        print("ERROR: public/rail/ directory not found!")
        return

    found_systems = []
    bundle = {
        "metadata": {
            "date": "2026-02-18",
            "systems": [],
        },
        "systems": {},
    }

    for sys_id in SYSTEMS:
        result = bundle_system(sys_id)
        if result:
            bundle["systems"][sys_id] = result
            found_systems.append(sys_id)

    bundle["metadata"]["systems"] = found_systems

    print(f"\nWriting {OUTPUT}...")
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"Done! {OUTPUT.name}: {size_mb:.1f} MB ({len(found_systems)} systems)")


if __name__ == "__main__":
    main()
