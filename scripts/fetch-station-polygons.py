#!/usr/bin/env python3
"""
Download OSM building polygons for major train stations (TRA class 0-1 + THSR).
Output: public/station_polygons.geojson
"""

import json
import time
import urllib.request
import urllib.parse
import math
import os
import ssl

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def load_geojson(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_major_stations():
    """Get TRA class 0-1 stations + all THSR stations."""
    stations = []

    # TRA class 0-1
    tra = load_geojson(os.path.join(BASE, "public/rail/tra/stations/stations.geojson"))
    for f in tra["features"]:
        props = f["properties"]
        if props.get("class") in ("0", "1"):
            lng, lat = f["geometry"]["coordinates"]
            stations.append({
                "station_id": props["station_id"],
                "name": props.get("name") or props.get("name_zh", ""),
                "name_en": props.get("name_en", ""),
                "system_id": "tra",
                "class": props["class"],
                "lng": lng,
                "lat": lat,
            })

    # THSR all 12
    thsr = load_geojson(os.path.join(BASE, "public/rail/thsr/stations/stations.geojson"))
    for f in thsr["features"]:
        props = f["properties"]
        lng, lat = f["geometry"]["coordinates"]
        stations.append({
            "station_id": props.get("station_id", ""),
            "name": props.get("name_zh", ""),
            "name_en": props.get("name_en", ""),
            "system_id": "thsr",
            "class": "0",
            "lng": lng,
            "lat": lat,
        })

    return stations


def query_overpass(lat, lng, radius=500):
    """Query Overpass API for station building polygon near coordinates."""
    query = f"""
[out:json][timeout:30];
(
  way["building"="train_station"](around:{radius},{lat},{lng});
  way["railway"="station"](around:{radius},{lat},{lng});
  way["public_transport"="station"]["building"](around:{radius},{lat},{lng});
  relation["building"="train_station"](around:{radius},{lat},{lng});
  relation["railway"="station"](around:{radius},{lat},{lng});
);
out geom;
"""
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=data)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  Overpass error: {e}")
        return None


def osm_element_to_polygon(element):
    """Convert OSM way/relation geometry to GeoJSON polygon coordinates."""
    if element["type"] == "way" and "geometry" in element:
        coords = [[p["lon"], p["lat"]] for p in element["geometry"]]
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        return [coords]

    if element["type"] == "relation" and "members" in element:
        for member in element["members"]:
            if member.get("role") == "outer" and "geometry" in member:
                coords = [[p["lon"], p["lat"]] for p in member["geometry"]]
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                return [coords]

    return None


def polygon_area(coords):
    """Approximate polygon area using shoelace formula (for ranking)."""
    ring = coords[0]
    n = len(ring)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += ring[i][0] * ring[j][1]
        area -= ring[j][0] * ring[i][1]
    return abs(area) / 2.0


def make_fallback_rect(lng, lat, width_m=80, height_m=30):
    """Create a small rectangle as fallback when no OSM polygon found."""
    dlng = width_m / 2 / (111320 * math.cos(math.radians(lat)))
    dlat = height_m / 2 / 110540
    return [[
        [lng - dlng, lat - dlat],
        [lng + dlng, lat - dlat],
        [lng + dlng, lat + dlat],
        [lng - dlng, lat + dlat],
        [lng - dlng, lat - dlat],
    ]]


def main():
    stations = get_major_stations()
    print(f"Found {len(stations)} major stations")

    features = []
    osm_found = 0

    for i, s in enumerate(stations):
        print(f"[{i+1}/{len(stations)}] {s['name']} ({s['system_id']})...", end=" ", flush=True)

        result = query_overpass(s["lat"], s["lng"])
        polygon = None

        if result and result.get("elements"):
            # Pick the largest polygon by area
            best = None
            best_area = 0
            for elem in result["elements"]:
                poly = osm_element_to_polygon(elem)
                if poly:
                    area = polygon_area(poly)
                    if area > best_area:
                        best = poly
                        best_area = area

            if best:
                polygon = best
                osm_found += 1
                print(f"OSM polygon ({len(best[0])} pts)")

        if polygon is None:
            polygon = make_fallback_rect(s["lng"], s["lat"])
            print("fallback rect")

        features.append({
            "type": "Feature",
            "properties": {
                "station_id": s["station_id"],
                "name": s["name"],
                "name_en": s["name_en"],
                "system_id": s["system_id"],
                "class": s["class"],
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon,
            },
        })

        # Rate limiting
        time.sleep(1.5)

    output = {
        "type": "FeatureCollection",
        "features": features,
    }

    out_path = os.path.join(BASE, "public/station_polygons.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDone! {osm_found}/{len(stations)} from OSM, {len(stations)-osm_found} fallback")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
