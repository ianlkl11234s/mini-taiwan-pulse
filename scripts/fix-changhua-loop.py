#!/usr/bin/env python3
"""
Fix Changhua triangle loop in TRA OD tracks.

Problem: 131 trains (13.2%) use OD tracks with a 1.8km loop near Changhua
station, caused by the mountain/coast/south line triangle junction geometry.

Fix: Replace the loop section with the correct hand-drawn golden track
geometry that smoothly passes through the Changhua junction.

Three loop patterns:
  1. N→S (mountain → Changhua → south): OD-HL-CH, OD-HC-CH, OD-TT-CH
     → Use WL-M-ZN-CH-0 tail + WL-S-CH-ZY-0 head
  2. S→N (Changhua → mountain north): OD-CH-HL, OD-CH-HC
     → Use WL-M-CH-ZN-1 head
  3. Mountain→Coast (via Changhua): OD-FY-通霄, OD-FY-沙鹿, etc.
     → Use WL-M-ZN-CH-0 tail + WL-C-CH-ZN-0 head
"""

import json
import math
import os

BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "rail", "tra",
)

# Changhua station coordinate (golden tracks join here)
CH_LNG, CH_LAT = 120.53840, 24.08186

# Affected tracks grouped by fix pattern
PATTERN_NS_TO_SOUTH = [
    # Mountain approach → Changhua → continues south
    "OD-HL-CH", "OD-HC-CH", "OD-TT-CH",
]

PATTERN_CH_TO_NORTH = [
    # Starts at Changhua → mountain line northbound
    "OD-CH-HL", "OD-CH-HC",
]

PATTERN_MOUNTAIN_TO_COAST = [
    # Mountain → Changhua triangle → Coast line
    "OD-FY-通霄", "OD-FY-沙鹿", "OD-ML-通霄", "OD-TC-通霄",
]


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
    """Save coordinates back to GeoJSON file, preserving structure."""
    with open(path) as f:
        data = json.load(f)
    if data.get("type") == "FeatureCollection":
        data["features"][0]["geometry"]["coordinates"] = coords
    else:
        data["geometry"]["coordinates"] = coords
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def find_nearest_idx(coords, lng, lat):
    """Find the index of the nearest point to (lng, lat)."""
    best_i = 0
    best_d = float("inf")
    for i, c in enumerate(coords):
        d = (c[0] - lng) ** 2 + (c[1] - lat) ** 2
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def find_snaps(coords, threshold_m=150):
    """Find indices where consecutive points jump > threshold_m."""
    snaps = []
    for i in range(len(coords) - 1):
        d = haversine_m(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
        if d > threshold_m:
            snaps.append((i, i + 1, d))
    return snaps


def find_loop_region(coords, ch_lng=CH_LNG, ch_lat=CH_LAT, radius=2500):
    """
    Find the loop region near Changhua.
    Returns (loop_start, loop_end) indices, or None.
    """
    # Find points near Changhua
    ch_indices = []
    for i, c in enumerate(coords):
        d = haversine_m(c[0], c[1], ch_lng, ch_lat)
        if d < radius:
            ch_indices.append(i)

    if len(ch_indices) < 5:
        return None

    # Find snaps (big jumps) within the Changhua area
    first_ch = ch_indices[0]
    last_ch = ch_indices[-1]

    snaps = []
    for i in range(max(0, first_ch - 5), min(len(coords) - 1, last_ch + 5)):
        d = haversine_m(
            coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]
        )
        if d > 150:
            snaps.append((i, i + 1, d))

    if not snaps:
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
    for name in [
        "WL-M-ZN-CH-0",
        "WL-M-CH-ZN-1",
        "WL-S-CH-ZY-0",
        "WL-S-CH-ZY-1",
        "WL-C-CH-ZN-0",
        "WL-C-ZN-CH-1",
    ]:
        path = os.path.join(golden_dir, f"{name}.geojson")
        if os.path.exists(path):
            golden[name] = extract_coords(path)
            print(f"  {name}: {len(golden[name])} pts")

    fixed_count = 0
    skipped = []

    # === Pattern 1: N→S (mountain approach → Changhua → south) ===
    print("\n=== Pattern 1: Mountain → Changhua → South ===")
    # Golden: WL-M-ZN-CH-0 (ends at CH) + WL-S-CH-ZY-0 (starts at CH)
    g_mountain_south = golden["WL-M-ZN-CH-0"]  # 竹南→彰化
    g_south = golden["WL-S-CH-ZY-0"]  # 彰化→新左營

    for tid in PATTERN_NS_TO_SOUTH:
        fpath = os.path.join(tracks_dir, f"{tid}.geojson")
        if not os.path.exists(fpath):
            skipped.append(tid)
            continue

        coords = extract_coords(fpath)
        loop = find_loop_region(coords)
        if not loop:
            print(f"  {tid}: no loop found, skip")
            skipped.append(tid)
            continue

        loop_start, loop_end = loop
        entry = coords[loop_start]  # Last clean point before loop
        exit_pt = coords[loop_end]  # First clean point after loop

        # Find nearest point on golden mountain track to entry
        g_entry_idx = find_nearest_idx(g_mountain_south, entry[0], entry[1])
        # Find nearest point on golden south track to exit
        g_exit_idx = find_nearest_idx(g_south, exit_pt[0], exit_pt[1])

        # Build replacement: golden mountain tail → CH station → golden south head
        replacement = []
        # Mountain golden: from entry match to end (Changhua)
        replacement.extend(g_mountain_south[g_entry_idx:])
        # South golden: from start (Changhua) to exit match
        replacement.extend(g_south[1 : g_exit_idx + 1])

        # Stitch: OD before loop + replacement + OD after loop
        new_coords = coords[: loop_start + 1] + replacement + coords[loop_end:]

        # Verify
        old_len = len(coords)
        new_len = len(new_coords)
        entry_d = haversine_m(
            entry[0], entry[1],
            g_mountain_south[g_entry_idx][0], g_mountain_south[g_entry_idx][1],
        )
        exit_d = haversine_m(
            exit_pt[0], exit_pt[1],
            g_south[g_exit_idx][0], g_south[g_exit_idx][1],
        )

        save_coords(fpath, new_coords)
        fixed_count += 1
        print(
            f"  {tid}: {old_len}→{new_len} pts, "
            f"loop idx {loop_start}-{loop_end} replaced, "
            f"entry match={entry_d:.0f}m, exit match={exit_d:.0f}m"
        )

    # === Pattern 2: Changhua → mountain north ===
    print("\n=== Pattern 2: Changhua → Mountain North ===")
    # Golden: WL-M-CH-ZN-1 (starts at CH, goes north)
    g_ch_north = golden["WL-M-CH-ZN-1"]  # 彰化→竹南

    for tid in PATTERN_CH_TO_NORTH:
        fpath = os.path.join(tracks_dir, f"{tid}.geojson")
        if not os.path.exists(fpath):
            skipped.append(tid)
            continue

        coords = extract_coords(fpath)
        loop = find_loop_region(coords)
        if not loop:
            print(f"  {tid}: no loop found, skip")
            skipped.append(tid)
            continue

        loop_start, loop_end = loop
        exit_pt = coords[loop_end]  # First clean point after loop

        # For CH→north pattern, the loop is at the beginning
        # Find nearest point on golden track to exit
        g_exit_idx = find_nearest_idx(g_ch_north, exit_pt[0], exit_pt[1])

        # Build replacement: golden from CH to exit match
        replacement = g_ch_north[: g_exit_idx + 1]

        # Stitch: replacement + OD after loop
        new_coords = replacement + coords[loop_end:]

        old_len = len(coords)
        new_len = len(new_coords)
        exit_d = haversine_m(
            exit_pt[0], exit_pt[1],
            g_ch_north[g_exit_idx][0], g_ch_north[g_exit_idx][1],
        )

        save_coords(fpath, new_coords)
        fixed_count += 1
        print(
            f"  {tid}: {old_len}→{new_len} pts, "
            f"loop idx {loop_start}-{loop_end} replaced, "
            f"exit match={exit_d:.0f}m"
        )

    # === Pattern 3: Mountain → Changhua → Coast ===
    print("\n=== Pattern 3: Mountain → Changhua → Coast ===")
    # Golden: WL-M-ZN-CH-0 tail + WL-C-CH-ZN-0 head
    g_coast = golden["WL-C-CH-ZN-0"]  # 彰化→竹南(海線)

    for tid in PATTERN_MOUNTAIN_TO_COAST:
        fpath = os.path.join(tracks_dir, f"{tid}.geojson")
        if not os.path.exists(fpath):
            skipped.append(tid)
            continue

        coords = extract_coords(fpath)
        loop = find_loop_region(coords)
        if not loop:
            print(f"  {tid}: no loop found, skip")
            skipped.append(tid)
            continue

        loop_start, loop_end = loop
        entry = coords[loop_start]
        exit_pt = coords[loop_end]

        # Find nearest on golden mountain track for entry
        g_entry_idx = find_nearest_idx(g_mountain_south, entry[0], entry[1])
        # Find nearest on golden coast track for exit
        g_exit_idx = find_nearest_idx(g_coast, exit_pt[0], exit_pt[1])

        # Build replacement: mountain tail → CH → coast head
        replacement = []
        replacement.extend(g_mountain_south[g_entry_idx:])
        replacement.extend(g_coast[1 : g_exit_idx + 1])

        new_coords = coords[: loop_start + 1] + replacement + coords[loop_end:]

        old_len = len(coords)
        new_len = len(new_coords)
        entry_d = haversine_m(
            entry[0], entry[1],
            g_mountain_south[g_entry_idx][0], g_mountain_south[g_entry_idx][1],
        )
        exit_d = haversine_m(
            exit_pt[0], exit_pt[1],
            g_coast[g_exit_idx][0], g_coast[g_exit_idx][1],
        )

        save_coords(fpath, new_coords)
        fixed_count += 1
        print(
            f"  {tid}: {old_len}→{new_len} pts, "
            f"loop idx {loop_start}-{loop_end} replaced, "
            f"entry match={entry_d:.0f}m, exit match={exit_d:.0f}m"
        )

    print(f"\n=== Summary ===")
    print(f"Fixed: {fixed_count} tracks")
    if skipped:
        print(f"Skipped: {skipped}")

    # Now recalculate station_progress for the fixed tracks
    print("\n=== Recalculating station_progress for fixed tracks ===")
    os.system(f"python3 {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix-station-progress.py')}")


if __name__ == "__main__":
    main()
