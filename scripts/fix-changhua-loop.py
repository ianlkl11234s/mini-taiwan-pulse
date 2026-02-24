#!/usr/bin/env python3
"""
Fix Changhua triangle loop in ALL TRA tracks (OD, BB, SP, WL-C, etc.).

Problem: 72 tracks / 347 trains (35%) have a loop near Changhua station,
caused by the mountain/coast/south line triangle junction geometry.

Fix: Auto-detect loops in the Changhua area, determine the approach/departure
direction, and replace with the correct hand-drawn golden track geometry.

Direction detection:
  - NORTH (mountain line): lat > 24.09, lng < 120.56
  - COAST (追分/海線):     lat > 24.09, lng >= 120.56
  - SOUTH (南段):          lat < 24.07
"""

import json
import math
import os
import subprocess
import sys

BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "rail", "tra",
)

# Changhua station coordinate (golden tracks join here)
CH_LNG, CH_LAT = 120.53840, 24.08186


def haversine_m(lng1, lat1, lng2, lat2):
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


def extract_coords(path):
    with open(path) as f:
        data = json.load(f)
    if data.get("type") == "FeatureCollection":
        return data["features"][0]["geometry"]["coordinates"]
    return data["geometry"]["coordinates"]


def save_coords(path, coords):
    with open(path) as f:
        data = json.load(f)
    if data.get("type") == "FeatureCollection":
        data["features"][0]["geometry"]["coordinates"] = coords
    else:
        data["geometry"]["coordinates"] = coords
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def find_nearest_idx(coords, lng, lat):
    best_i = 0
    best_d = float("inf")
    for i, c in enumerate(coords):
        d = (c[0] - lng) ** 2 + (c[1] - lat) ** 2
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def classify_direction(lng, lat):
    """Classify a point near Changhua as NORTH, SOUTH, or COAST."""
    if lat < 24.07:
        return "SOUTH"
    if lat > 24.088:
        if lng >= 120.555:
            return "COAST"
        return "NORTH"
    # Ambiguous zone near CH station itself
    return "CH"


def find_loop_region(coords):
    """
    Find the loop region near Changhua by detecting big jumps (>200m).
    Returns (loop_start, loop_end) or None.
    """
    # Find points near Changhua (3km)
    ch_indices = []
    for i, c in enumerate(coords):
        d = haversine_m(c[0], c[1], CH_LNG, CH_LAT)
        if d < 3000:
            ch_indices.append(i)

    if len(ch_indices) < 5:
        return None

    first_ch = ch_indices[0]
    last_ch = ch_indices[-1]

    # Find snaps (jumps > 200m) in Changhua area
    snaps = []
    for i in range(max(0, first_ch - 5), min(len(coords) - 1, last_ch + 5)):
        d = haversine_m(
            coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]
        )
        if d > 200:
            snaps.append((i, i + 1, d))

    if not snaps:
        return None

    # Check for direction reversals (the real indicator of a loop)
    reversals = 0
    prev_dlng = 0
    for j in range(1, len(ch_indices)):
        i1, i2 = ch_indices[j - 1], ch_indices[j]
        if i2 != i1 + 1:
            continue
        dlng = coords[i2][0] - coords[i1][0]
        if prev_dlng != 0 and abs(dlng) > 0.0001:
            if (dlng > 0) != (prev_dlng > 0):
                reversals += 1
        if abs(dlng) > 0.0001:
            prev_dlng = dlng

    # Only fix if there are actual reversals or many snaps
    if reversals < 2 and len(snaps) < 5:
        return None

    loop_start = snaps[0][0]
    loop_end = snaps[-1][1]
    return (loop_start, loop_end)


def main():
    tracks_dir = os.path.join(BASE, "tracks")
    golden_dir = os.path.join(BASE, "tracks_golden")

    # Load golden tracks
    print("Loading golden tracks...")
    golden = {}
    golden_names = [
        "WL-M-ZN-CH-0",  # mountain → CH (southbound)
        "WL-M-CH-ZN-1",  # CH → mountain (northbound)
        "WL-S-CH-ZY-0",  # CH → south
        "WL-S-CH-ZY-1",  # south → CH
        "WL-C-CH-ZN-0",  # CH → coast
        "WL-C-ZN-CH-1",  # coast → CH
    ]
    for name in golden_names:
        path = os.path.join(golden_dir, f"{name}.geojson")
        if os.path.exists(path):
            golden[name] = extract_coords(path)
            print(f"  {name}: {len(golden[name])} pts")

    # Approach golden track map: direction → golden track (ends at CH)
    approach_golden = {
        "NORTH": golden["WL-M-ZN-CH-0"],    # from north, ends at CH
        "SOUTH": golden["WL-S-CH-ZY-1"],    # from south, ends at CH
        "COAST": golden["WL-C-ZN-CH-1"],    # from coast, ends at CH
    }
    # Departure golden track map: direction → golden track (starts at CH)
    depart_golden = {
        "NORTH": golden["WL-M-CH-ZN-1"],    # from CH going north
        "SOUTH": golden["WL-S-CH-ZY-0"],    # from CH going south
        "COAST": golden["WL-C-CH-ZN-0"],    # from CH going coast
    }

    # Load schedule to know which tracks have trains
    with open(os.path.join(BASE, "master_schedule.json")) as f:
        ms = json.load(f)
    track_counts = {}
    for train in ms["schedules"]:
        tid = train["od_track_id"]
        track_counts[tid] = track_counts.get(tid, 0) + 1

    # Scan ALL track files
    fixed_count = 0
    fixed_trains = 0
    skipped = []
    errors = []

    all_tracks = sorted(os.listdir(tracks_dir))
    print(f"\nScanning {len(all_tracks)} track files...")

    for fname in all_tracks:
        if not fname.endswith(".geojson"):
            continue
        tid = fname.replace(".geojson", "")
        fpath = os.path.join(tracks_dir, fname)

        coords = extract_coords(fpath)
        loop = find_loop_region(coords)
        if not loop:
            continue

        loop_start, loop_end = loop
        entry = coords[loop_start]
        exit_pt = coords[loop_end]

        # Determine approach and departure directions
        # Look a bit before/after the loop for cleaner direction
        pre_loop_idx = max(0, loop_start - 10)
        post_loop_idx = min(len(coords) - 1, loop_end + 10)
        pre_pt = coords[pre_loop_idx]
        post_pt = coords[post_loop_idx]

        approach_dir = classify_direction(pre_pt[0], pre_pt[1])
        depart_dir = classify_direction(post_pt[0], post_pt[1])

        # Handle edge case: loop at start of track
        if loop_start <= 5:
            approach_dir = "CH"
        # Handle edge case: loop at end of track
        if loop_end >= len(coords) - 5:
            depart_dir = "CH"

        # Build replacement from golden tracks
        replacement = []

        if approach_dir == "CH":
            # Track starts at Changhua, only need departure golden
            if depart_dir not in depart_golden:
                errors.append(f"  {tid}: unknown depart dir {depart_dir}")
                continue
            g_depart = depart_golden[depart_dir]
            g_exit_idx = find_nearest_idx(g_depart, exit_pt[0], exit_pt[1])
            replacement = g_depart[: g_exit_idx + 1]
            new_coords = replacement + coords[loop_end:]

        elif depart_dir == "CH":
            # Track ends at Changhua, only need approach golden
            if approach_dir not in approach_golden:
                errors.append(f"  {tid}: unknown approach dir {approach_dir}")
                continue
            g_approach = approach_golden[approach_dir]
            g_entry_idx = find_nearest_idx(g_approach, entry[0], entry[1])
            replacement = g_approach[g_entry_idx:]
            new_coords = coords[: loop_start + 1] + replacement

        else:
            # Track passes through Changhua
            if approach_dir not in approach_golden:
                errors.append(f"  {tid}: unknown approach dir {approach_dir}")
                continue
            if depart_dir not in depart_golden:
                errors.append(f"  {tid}: unknown depart dir {depart_dir}")
                continue

            g_approach = approach_golden[approach_dir]
            g_depart = depart_golden[depart_dir]

            g_entry_idx = find_nearest_idx(g_approach, entry[0], entry[1])
            g_exit_idx = find_nearest_idx(g_depart, exit_pt[0], exit_pt[1])

            # Approach tail → CH → Depart head
            replacement.extend(g_approach[g_entry_idx:])
            replacement.extend(g_depart[1: g_exit_idx + 1])
            new_coords = coords[: loop_start + 1] + replacement + coords[loop_end:]

        old_len = len(coords)
        new_len = len(new_coords)
        trains = track_counts.get(tid, 0)
        fixed_trains += trains

        save_coords(fpath, new_coords)
        fixed_count += 1

        dir_str = f"{approach_dir}→{depart_dir}"
        print(
            f"  {tid:>25}: {old_len:>5}→{new_len:>5} pts, "
            f"loop {loop_start}-{loop_end}, "
            f"{dir_str:>12}, "
            f"{trains} trains"
        )

    print(f"\n=== Summary ===")
    print(f"Fixed: {fixed_count} tracks, {fixed_trains} trains")
    if errors:
        print(f"Errors: {len(errors)}")
        for e in errors:
            print(e)

    # Recalculate station_progress
    print("\n=== Recalculating station_progress ===")
    sp_script = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "fix-station-progress.py"
    )
    subprocess.run([sys.executable, sp_script])


if __name__ == "__main__":
    main()
