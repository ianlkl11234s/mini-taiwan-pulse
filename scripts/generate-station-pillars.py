#!/usr/bin/env python3
"""
Precompute station pillar data from rail schedules + station GeoJSON.
Output: public/station_pillars.json

Replaces the runtime computation in App.tsx (computeStationStopCounts + normalizeToHeight).
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIL = os.path.join(BASE, "public", "rail")

METRO_SYSTEMS = {"trtc", "krtc", "klrt", "tmrt"}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def count_stops_in_schedules(data):
    """Count station stops from a schedule dict {track_id: {departures: [{stations: [...]}]}}."""
    counts = {}
    for schedule in data.values():
        if not isinstance(schedule, dict):
            continue
        for dep in schedule.get("departures", []):
            for st in dep.get("stations", []):
                sid = st.get("station_id", "")
                if sid:
                    counts[sid] = counts.get(sid, 0) + 1
    return counts


def count_stops_tra(data):
    """Count stops from TRA master_schedule format {schedules: [{stations: [...]}]}."""
    counts = {}
    for train in data.get("schedules", []):
        for st in train.get("stations", []):
            sid = st.get("station_id", "")
            if sid:
                counts[sid] = counts.get(sid, 0) + 1
    return counts


def normalize(counts, lo=0.2, hi=1.0):
    """Min-max normalize stop counts to [lo, hi] height values."""
    if not counts:
        return {}
    vals = list(counts.values())
    mn, mx = min(vals), max(vals)
    rng = mx - mn
    result = {}
    for sid, c in counts.items():
        result[sid] = lo + (c - mn) / rng * (hi - lo) if rng > 0 else (lo + hi) / 2
    return result


def compute_stop_counts():
    """Read all schedule files and return per-system stop counts."""
    thsr_counts = {}
    tra_counts = {}
    metro_counts = {}

    # THSR
    path = os.path.join(RAIL, "thsr/schedules/thsr_schedules.json")
    if os.path.exists(path):
        thsr_counts = count_stops_in_schedules(load_json(path))

    # TRA (different format: {schedules: [{stations: [...]}]})
    path = os.path.join(RAIL, "tra/master_schedule.json")
    if os.path.exists(path):
        tra_counts = count_stops_tra(load_json(path))

    # Metro systems — TRTC has per-track files, others have single file
    for sys_id in sorted(METRO_SYSTEMS):
        sys_dir = os.path.join(RAIL, sys_id)
        if not os.path.isdir(sys_dir):
            continue

        # Try schedules/*.json first (TRTC style)
        sched_files = sorted(glob.glob(os.path.join(sys_dir, "schedules", "*.json")))
        if sched_files:
            for sf in sched_files:
                for sid, c in count_stops_in_schedules(load_json(sf)).items():
                    metro_counts[sid] = metro_counts.get(sid, 0) + c
        else:
            # Single file (krtc_schedules.json etc.)
            single = os.path.join(sys_dir, f"{sys_id}_schedules.json")
            if os.path.exists(single):
                for sid, c in count_stops_in_schedules(load_json(single)).items():
                    metro_counts[sid] = metro_counts.get(sid, 0) + c

    return thsr_counts, tra_counts, metro_counts


def centroid(coords):
    """Average of polygon ring coordinates."""
    lng = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return lng, lat


def build_pillar_entries(polygons, points, thsr_h, tra_h):
    """Build pillar entries from GeoJSON features + height maps."""
    thsr, tra, metro = [], [], []

    # Polygons → centroid (major THSR/TRA stations)
    for f in polygons.get("features", []):
        props = f.get("properties", {})
        sys_id = props.get("system_id", "")
        station_id = props.get("station_id", "")
        geom = f.get("geometry", {})

        if geom.get("type") == "Polygon":
            ring = geom["coordinates"][0]
        elif geom.get("type") == "MultiPolygon":
            ring = geom["coordinates"][0][0]
        else:
            continue

        lng, lat = centroid(ring)

        if sys_id == "thsr":
            thsr.append({"id": station_id, "lng": round(lng, 6), "lat": round(lat, 6),
                          "height": round(thsr_h.get(station_id, 0.5), 4)})
        elif sys_id == "tra":
            tra.append({"id": station_id, "lng": round(lng, 6), "lat": round(lat, 6),
                         "height": round(tra_h.get(station_id, 0.5), 4)})

    # Points → direct coordinates (small TRA stations + metro)
    for f in points.get("features", []):
        props = f.get("properties", {})
        sys_id = props.get("system_id", "")
        station_id = props.get("station_id", "")
        coords = f.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]

        if sys_id == "tra":
            tra.append({"id": station_id, "lng": round(lng, 6), "lat": round(lat, 6),
                         "height": round(tra_h.get(station_id, 0.3), 4)})
        elif sys_id in METRO_SYSTEMS:
            metro.append({"id": station_id, "lng": round(lng, 6), "lat": round(lat, 6),
                           "height": 0.4})

    return thsr, tra, metro


def main():
    print("Computing station stop counts...")
    thsr_counts, tra_counts, metro_counts = compute_stop_counts()
    print(f"  THSR: {len(thsr_counts)} stations, {sum(thsr_counts.values())} total stops")
    print(f"  TRA:  {len(tra_counts)} stations, {sum(tra_counts.values())} total stops")
    print(f"  Metro: {len(metro_counts)} stations, {sum(metro_counts.values())} total stops")

    thsr_h = normalize(thsr_counts, 0.2, 1.0)
    tra_h = normalize(tra_counts, 0.2, 1.0)

    print("Loading station GeoJSON...")
    polygons = load_json(os.path.join(BASE, "public", "station_polygons.geojson"))
    points = load_json(os.path.join(BASE, "public", "station_points.geojson"))

    thsr, tra, metro = build_pillar_entries(polygons, points, thsr_h, tra_h)

    output = {"thsr": thsr, "tra": tra, "metro": metro}

    out_path = os.path.join(BASE, "public", "station_pillars.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"\nOutput: {out_path}")
    print(f"  THSR:  {len(thsr)} pillars")
    print(f"  TRA:   {len(tra)} pillars")
    print(f"  Metro: {len(metro)} pillars")


if __name__ == "__main__":
    main()
