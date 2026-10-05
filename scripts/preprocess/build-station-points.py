#!/usr/bin/env python3
"""
Merge all small station points (excluding major TRA/THSR stations) into a single GeoJSON.
Output: public/geo/station_points.geojson

Also merges Point features from public/rail/<sys>/extensions/*.geojson
(stations of newly opened extensions not yet in the upstream station files,
e.g. trtc R01 廣慈/奉天宮).

Modes:
  (default)       full rebuild from public/rail/*/stations + extensions.
                  ⚠️ The committed file also holds hand-added stations
                  (trtc LB01-LB12 三鶯線) and a TRA 蘇澳 coordinate that the
                  upstream station files do not reproduce, so a full rebuild
                  produces a larger diff than intended.
  --append-only   keep the existing output untouched and only append extension
                  stations that are not present yet (minimal diff).
  --enrich        keep the existing output untouched (coordinates, count, existing
                  props) and add to every non-tra point: line_id, line_name,
                  line_color (read FROM public/rail/routes_static.geojson so stations and
                  routes share one color source; run build-rail-routes.py first) and
                  transfer (true when another non-tra point of the same system has the
                  same normalized name within TRANSFER_M). The existing `color` prop is
                  left as is. Idempotent.
"""

import json
import glob
import os
import math
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


OUT_PATH = os.path.join(BASE, "public/geo/station_points.geojson")


def extension_station_features(seen):
    """Point features from public/rail/<sys>/extensions/*.geojson → station point features."""
    out = []
    for path in sorted(glob.glob(os.path.join(BASE, "public/rail/*/extensions/*.geojson"))):
        sys_id = os.path.normpath(path).split(os.sep)[-3]
        for f in load_geojson(path)["features"]:
            if f["geometry"]["type"] != "Point":
                continue
            props = f["properties"]
            sid = props.get("station_id", "")
            if not sid or (sys_id, sid) in seen:
                continue
            seen.add((sys_id, sid))
            p = {
                "station_id": sid,
                "name": props.get("name_zh") or props.get("name", ""),
            }
            if props.get("name_en"):
                p["name_en"] = props["name_en"]
            if props.get("line_id"):
                p["line_id"] = props["line_id"]
            p["system_id"] = sys_id
            p["color"] = SYSTEM_COLORS[sys_id]
            out.append({"type": "Feature", "properties": p, "geometry": f["geometry"]})
    return out


def append_only():
    data = load_geojson(OUT_PATH)
    seen = {(f["properties"]["system_id"], f["properties"]["station_id"]) for f in data["features"]}
    added = extension_station_features(seen)
    data["features"].extend(added)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Appended {len(added)} extension station(s): {[a['properties']['station_id'] for a in added]}")
    print(f"Total: {len(data['features'])} station points -> {OUT_PATH}")


# ── --enrich: line_id / line_color / transfer ──
ROUTES_PATH = os.path.join(BASE, "public/rail/routes_static.geojson")
# Same-name pairs in this data are at most ~445 m apart (機場線 A1 台北車站 sits ~410-445 m from
# R10/BL12; 動物園 MK01 400 m from BR01). 500 m keeps all of them while staying far below the
# distance between unrelated same-name stations (none exist within a system).
TRANSFER_M = 500.0
# station_id prefix -> route line_id, where it differs from the prefix
# (krtc KR/KO prefixes; KRK/KOT are the 岡山車站 / 大寮 extension stations of 紅線 / 橘線;
#  tmrt TG; klrt C has no line_id in routes_static, matched by system only)
PREFIX_LINE = {
    "krtc": {"KR": "R", "KRK": "R", "KO": "O", "KOT": "O"},
    "tmrt": {"TG": "G"},
    "klrt": {"C": None},
}


def norm_name(n):
    n = re.sub(r"[（(].*?[）)]", "", n.replace("臺", "台"))
    return re.sub(r"站$", "", re.sub(r"\s+", "", n))


def dist_m(a, b):
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(math.radians(23.7)), (a[1] - b[1]) * 110570)


def enrich():
    routes = {}
    for f in load_geojson(ROUTES_PATH)["features"]:
        p = f["properties"]
        routes[(p["system"], p.get("line_id"))] = (p["name"], p["color"])
    data = load_geojson(OUT_PATH)
    pts = [f for f in data["features"] if f["properties"]["system_id"] != "tra"]
    for f in pts:
        p = f["properties"]
        sys_id, sid = p["system_id"], p["station_id"]
        prefix = re.match(r"[A-Z]+", sid).group()
        lid = PREFIX_LINE.get(sys_id, {}).get(prefix, prefix) if sys_id in PREFIX_LINE else prefix
        route = routes.get((sys_id, lid))
        if route is None:
            raise SystemExit(f"no route for {sys_id} {sid} (line {lid})")
        p["line_id"] = lid if lid is not None else prefix
        p["line_name"], p["line_color"] = route
        p["transfer"] = False
    groups = {}
    for f in pts:
        groups.setdefault((f["properties"]["system_id"], norm_name(f["properties"]["name"])), []).append(f)
    n_groups = 0
    for g in groups.values():
        if len(g) < 2:
            continue
        for f in g:
            if any(o is not f and dist_m(f["geometry"]["coordinates"], o["geometry"]["coordinates"]) <= TRANSFER_M for o in g):
                f["properties"]["transfer"] = True
        if any(f["properties"]["transfer"] for f in g):
            n_groups += 1
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    summary = {}
    for f in pts:
        p = f["properties"]
        k = (p["system_id"], p["line_id"], p["line_name"], p["line_color"])
        c = summary.setdefault(k, [0, 0])
        c[0] += 1
        c[1] += p["transfer"]
    print(f"Enriched {len(pts)} non-tra points; {n_groups} transfer groups; {sum(c[1] for c in summary.values())} transfer points")
    for (sys_id, lid, name, color), (n, t) in sorted(summary.items()):
        print(f"  {sys_id:5} {lid:3} {name:10} {color}  stations={n:3} transfer={t}")


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
    if "--enrich" in sys.argv:
        enrich()
        return
    if "--append-only" in sys.argv:
        append_only()
        return
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

    features.extend(extension_station_features(seen))

    output = {
        "type": "FeatureCollection",
        "features": features,
    }

    out_path = OUT_PATH
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
