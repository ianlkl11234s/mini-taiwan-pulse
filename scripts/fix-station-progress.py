#!/usr/bin/env python3
"""
Recalculate station_progress.json for ALL TRA tracks using the actual
track GeoJSON geometries and station coordinates.

This fixes the systematic offset (~0.1%) in OD track progress values
that caused trains to appear 200-800m away from station markers.
"""

import json
import math
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(BASE, "public")


def haversine_m(lng1, lat1, lng2, lat2):
    """Great-circle distance in meters."""
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def euclidean_deg(a, b):
    """Euclidean distance in degree space (same metric as TypeScript code)."""
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    return math.sqrt(dx * dx + dy * dy)


def calc_total_length(coords):
    """Total length using Euclidean degree distance (matches TS interpolateOnLineString)."""
    total = 0
    for i in range(len(coords) - 1):
        total += euclidean_deg(coords[i], coords[i + 1])
    return total


def find_nearest_progress(coords, station_lng, station_lat):
    """
    Find the progress (0-1) of the nearest point on the LineString to the station.
    Uses Euclidean degree distance to match TypeScript interpolateOnLineString.
    Returns (progress, distance_in_meters).
    """
    total_length = calc_total_length(coords)
    if total_length == 0:
        return 0.0, float("inf")

    best_progress = 0.0
    best_dist_m = float("inf")
    accumulated = 0.0

    for i in range(len(coords) - 1):
        a = coords[i]
        b = coords[i + 1]
        seg_len = euclidean_deg(a, b)

        if seg_len == 0:
            continue

        # Project station point onto segment
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        t = ((station_lng - a[0]) * dx + (station_lat - a[1]) * dy) / (
            dx * dx + dy * dy
        )
        t = max(0, min(1, t))

        proj_lng = a[0] + t * dx
        proj_lat = a[1] + t * dy
        dist_m = haversine_m(proj_lng, proj_lat, station_lng, station_lat)

        if dist_m < best_dist_m:
            best_dist_m = dist_m
            best_progress = (accumulated + t * seg_len) / total_length

        accumulated += seg_len

    return best_progress, best_dist_m


def extract_coords(data):
    """Extract coordinates from GeoJSON Feature or FeatureCollection."""
    if data.get("type") == "FeatureCollection":
        feat = data["features"][0]
    elif data.get("type") == "Feature":
        feat = data
    else:
        return None
    geom = feat.get("geometry", {})
    if geom.get("type") == "LineString":
        return geom["coordinates"]
    return None


def main():
    # Load station coordinates
    stations_path = os.path.join(PUBLIC, "rail/tra/stations/stations.geojson")
    with open(stations_path) as f:
        stations_data = json.load(f)

    station_coords = {}
    for feat in stations_data["features"]:
        props = feat["properties"]
        sid = props.get("station_id", "")
        if sid:
            lng, lat = feat["geometry"]["coordinates"][:2]
            station_coords[sid] = (lng, lat)

    print(f"Loaded {len(station_coords)} TRA station coordinates")

    # Load existing station_progress.json to preserve structure
    sp_path = os.path.join(PUBLIC, "rail/tra/station_progress.json")
    with open(sp_path) as f:
        old_sp = json.load(f)

    print(f"Existing station_progress has {len(old_sp)} tracks")

    # Recalculate progress for each track
    new_sp = {}
    tracks_dir = os.path.join(PUBLIC, "rail/tra/tracks")
    updated = 0
    skipped = 0
    errors = []

    for track_id, old_progress_map in old_sp.items():
        track_path = os.path.join(tracks_dir, f"{track_id}.geojson")
        if not os.path.exists(track_path):
            # Keep old values if track file doesn't exist
            new_sp[track_id] = old_progress_map
            skipped += 1
            continue

        with open(track_path) as f:
            track_data = json.load(f)

        coords = extract_coords(track_data)
        if not coords or len(coords) < 2:
            new_sp[track_id] = old_progress_map
            skipped += 1
            continue

        new_progress_map = {}
        max_dist = 0

        for station_id in old_progress_map:
            if station_id not in station_coords:
                # Keep old value for unknown stations
                new_progress_map[station_id] = old_progress_map[station_id]
                continue

            lng, lat = station_coords[station_id]
            progress, dist_m = find_nearest_progress(coords, lng, lat)
            new_progress_map[station_id] = round(progress, 6)
            max_dist = max(max_dist, dist_m)

            if dist_m > 500:
                errors.append(
                    f"  WARNING: {track_id}/{station_id} nearest={dist_m:.0f}m"
                )

        new_sp[track_id] = new_progress_map
        updated += 1

    print(f"\nRecalculated {updated} tracks, skipped {skipped}")

    # Measure improvement
    print("\n=== Improvement check (OD-HL-CZ) ===")
    test_track = "OD-HL-CZ"
    if test_track in new_sp and test_track in old_sp:
        track_path = os.path.join(tracks_dir, f"{test_track}.geojson")
        with open(track_path) as f:
            td = json.load(f)
        coords = extract_coords(td)

        total_len = calc_total_length(coords)

        def interpolate(coords, progress):
            target = total_len * progress
            acc = 0
            for i in range(len(coords) - 1):
                seg = euclidean_deg(coords[i], coords[i + 1])
                if acc + seg >= target:
                    t = (target - acc) / seg if seg > 0 else 0
                    return [
                        coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
                        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
                    ]
                acc += seg
            return coords[-1]

        test_stations = [
            "0930",
            "1000",
            "1020",
            "1040",
            "1100",
            "1210",
            "3360",
            "4080",
            "4220",
        ]
        print(f"{'Stn':>4} {'Name':>6} | {'Old(m)':>8} | {'New(m)':>8} | {'Improve':>8}")
        print("-" * 50)

        for sid in test_stations:
            if sid not in station_coords or sid not in new_sp.get(test_track, {}):
                continue
            sc = station_coords[sid]
            name = ""
            for feat in stations_data["features"]:
                if feat["properties"].get("station_id") == sid:
                    name = feat["properties"].get("name", "?")[:6]
                    break

            old_pos = interpolate(coords, old_sp[test_track][sid])
            new_pos = interpolate(coords, new_sp[test_track][sid])
            old_dist = haversine_m(old_pos[0], old_pos[1], sc[0], sc[1])
            new_dist = haversine_m(new_pos[0], new_pos[1], sc[0], sc[1])
            print(
                f"{sid:>4} {name:>6} | {old_dist:>8.1f} | {new_dist:>8.1f} | {old_dist - new_dist:>+8.1f}"
            )

    # Save
    with open(sp_path, "w", encoding="utf-8") as f:
        json.dump(new_sp, f, ensure_ascii=False, indent=2)
    print(f"\nSaved updated station_progress.json")

    if errors:
        print(f"\nWarnings ({len(errors)}):")
        for e in errors[:20]:
            print(e)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")


if __name__ == "__main__":
    main()
