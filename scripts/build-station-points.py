#!/usr/bin/env python3
"""
Merge all small station points (excluding major TRA/THSR stations) into a single GeoJSON.
Output: public/station_points.geojson
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SYSTEM_COLORS = {
    "tra": "#7B7B7B",
    "trtc": "#d90023",
    "krtc": "#f8961e",
    "klrt": "#43aa8b",
    "tmrt": "#577590",
}


def load_geojson(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_major_station_ids():
    """Get IDs of TRA class 0-1 + THSR stations (they have polygons)."""
    ids = set()

    tra = load_geojson(os.path.join(BASE, "public/rail/tra/stations/stations.geojson"))
    for f in tra["features"]:
        props = f["properties"]
        if props.get("class") in ("0", "1"):
            ids.add(("tra", props["station_id"]))

    thsr = load_geojson(os.path.join(BASE, "public/rail/thsr/stations/stations.geojson"))
    for f in thsr["features"]:
        ids.add(("thsr", f["properties"].get("station_id", "")))

    return ids


def main():
    major_ids = get_major_station_ids()
    print(f"Excluding {len(major_ids)} major stations")

    features = []
    seen = set()

    # TRA (exclude class 0-1)
    tra = load_geojson(os.path.join(BASE, "public/rail/tra/stations/stations.geojson"))
    for f in tra["features"]:
        props = f["properties"]
        sid = props["station_id"]
        if ("tra", sid) in major_ids:
            continue
        key = ("tra", sid)
        if key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "properties": {
                "station_id": sid,
                "name": props.get("name") or props.get("name_zh", ""),
                "system_id": "tra",
                "color": SYSTEM_COLORS["tra"],
            },
            "geometry": f["geometry"],
        })

    # TRTC (multiple line files)
    trtc_dir = os.path.join(BASE, "public/rail/trtc/stations")
    for path in sorted(glob.glob(os.path.join(trtc_dir, "*.geojson"))):
        data = load_geojson(path)
        for f in data["features"]:
            props = f["properties"]
            sid = props.get("station_id", "")
            key = ("trtc", sid)
            if key in seen:
                continue
            seen.add(key)
            features.append({
                "type": "Feature",
                "properties": {
                    "station_id": sid,
                    "name": props.get("name_zh") or props.get("name", ""),
                    "system_id": "trtc",
                    "color": SYSTEM_COLORS["trtc"],
                },
                "geometry": f["geometry"],
            })

    # KRTC
    krtc = load_geojson(os.path.join(BASE, "public/rail/krtc/stations/stations.geojson"))
    for f in krtc["features"]:
        props = f["properties"]
        sid = props.get("station_id", "")
        key = ("krtc", sid)
        if key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "properties": {
                "station_id": sid,
                "name": props.get("name_zh") or props.get("name", ""),
                "system_id": "krtc",
                "color": SYSTEM_COLORS["krtc"],
            },
            "geometry": f["geometry"],
        })

    # KLRT
    klrt = load_geojson(os.path.join(BASE, "public/rail/klrt/stations/stations.geojson"))
    for f in klrt["features"]:
        props = f["properties"]
        sid = props.get("station_id", "")
        key = ("klrt", sid)
        if key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "properties": {
                "station_id": sid,
                "name": props.get("name_zh") or props.get("name", ""),
                "system_id": "klrt",
                "color": SYSTEM_COLORS["klrt"],
            },
            "geometry": f["geometry"],
        })

    # TMRT
    tmrt = load_geojson(os.path.join(BASE, "public/rail/tmrt/stations/stations.geojson"))
    for f in tmrt["features"]:
        props = f["properties"]
        sid = props.get("station_id", "")
        key = ("tmrt", sid)
        if key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "properties": {
                "station_id": sid,
                "name": props.get("name_zh") or props.get("name", ""),
                "system_id": "tmrt",
                "color": SYSTEM_COLORS["tmrt"],
            },
            "geometry": f["geometry"],
        })

    output = {
        "type": "FeatureCollection",
        "features": features,
    }

    out_path = os.path.join(BASE, "public/station_points.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    by_system = {}
    for feat in features:
        sys_id = feat["properties"]["system_id"]
        by_system[sys_id] = by_system.get(sys_id, 0) + 1

    print(f"Total: {len(features)} station points")
    for sys_id, count in sorted(by_system.items()):
        print(f"  {sys_id}: {count}")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
