#!/usr/bin/env python3
"""Validate OSM raw-to-processed semantics, then copy immutable local sidecars."""
import hashlib, json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = ROOT.parents[3] / "taipei-gis-analytics" / "data"
SPECS = {
    "osm_power_lines": ("c6cc21e8607cac1cf02a69a5b6ba764703d43aad174e01ab671eb78950f49217", "538411022f39cb51d3e928c36a33fafde82aec9a8d8cdb8554ee75e9d0678267", 2305, "way", "LineString", ("line_type", "voltage", "circuits", "cables", "operator", "frequency", "location")),
    "osm_power_towers": ("4dc1f3f22f63f1d1d9030b66a941d3e72a0037e28d1592ac1d75853fa4bbd545", "1e7813105955e53f8cdc98dde900b0b7e8f537d3121645bb1bfef1c6af70ff49", 26589, "node", "Point", ("voltage", "operator", "material", "design", "ref")),
}
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def fail(code): raise RuntimeError(code)
def coordinates(raw, kind):
    if kind == "way": return [[p["lon"], p["lat"]] for p in raw["geometry"]]
    return [raw["lon"], raw["lat"]]
def main(output=ROOT.parent / "runtime" / "owner-only" / "osm-power-network"):
    output = Path(output)
    receipts = []
    for name, (raw_sha, processed_sha, count, raw_type, geometry_type, fields) in SPECS.items():
        raw_path = ANALYTICS / "raw" / "energy" / name / f"{name}_20260615.json"; processed_path = ANALYTICS / "processed" / "energy" / name / f"{name}_20260615.geojson"
        if sha(raw_path) != raw_sha: fail(f"{name}_RAW_SHA_MISMATCH")
        if sha(processed_path) != processed_sha: fail(f"{name}_PROCESSED_SHA_MISMATCH")
        raw = json.loads(raw_path.read_text()); processed = json.loads(processed_path.read_text())
        elements = raw.get("elements"); features = processed.get("features")
        if not isinstance(elements, list) or processed.get("type") != "FeatureCollection" or len(elements) != count or len(features) != count: fail(f"{name}_COUNT_MISMATCH")
        source = {x["id"]: x for x in elements if x.get("type") == raw_type and isinstance(x.get("id"), int)}
        if len(source) != count: fail(f"{name}_RAW_ID_MISMATCH")
        ids = set()
        for feature in features:
            p, g = feature.get("properties"), feature.get("geometry")
            if feature.get("type") != "Feature" or not isinstance(p, dict) or not isinstance(g, dict) or g.get("type") != geometry_type or not isinstance(p.get("osm_id"), int) or p["osm_id"] in ids or p["osm_id"] not in source: fail(f"{name}_FEATURE_ID_OR_GEOMETRY_MISMATCH")
            raw_row = source[p["osm_id"]]
            if g.get("coordinates") != coordinates(raw_row, raw_type) or p.get("tags") != raw_row.get("tags") or any(p.get(field) != raw_row.get("tags", {}).get(field) for field in fields if field != "line_type"): fail(f"{name}_RAW_PROCESSED_SEMANTICS_MISMATCH")
            if name == "osm_power_lines" and p.get("line_type") != raw_row.get("tags", {}).get("power"): fail(f"{name}_LINE_TYPE_MISMATCH")
            ids.add(p["osm_id"])
        if ids != set(source): fail(f"{name}_PROCESSED_ID_MISMATCH")
        output.mkdir(parents=True, exist_ok=True); target = output / processed_path.name; shutil.copyfile(processed_path, target)
        if sha(target) != processed_sha: fail(f"{name}_COPY_SHA_MISMATCH")
        receipts.append({"dataset": name, "raw": {"path": str(raw_path), "sha256": raw_sha, "bytes": raw_path.stat().st_size, "count": count}, "processed": {"path": str(processed_path), "sha256": processed_sha, "bytes": processed_path.stat().st_size, "count": count}, "owner_only_asset": {"path": str(target), "sha256": processed_sha, "bytes": target.stat().st_size}})
    print(json.dumps(receipts, ensure_ascii=False, indent=2))
if __name__ == "__main__": main(*(sys.argv[1:]))
