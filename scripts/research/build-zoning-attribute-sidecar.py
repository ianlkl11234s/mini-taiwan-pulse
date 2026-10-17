#!/usr/bin/env python3
"""Build a bounded attribute index from the complete zoning GeoJSON, never from PMTiles."""

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--pmtiles", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-count", type=int, required=True)
    parser.add_argument("--data-date", required=True)
    args = parser.parse_args()

    source_hash = sha256(args.source)
    tile_hash = sha256(args.pmtiles)
    with args.source.open(encoding="utf-8") as source:
        collection = json.load(source)
    features = collection.get("features") if isinstance(collection, dict) else None
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection" or not isinstance(features, list) or len(features) != args.expected_count:
        raise ValueError("ZONING_SOURCE_COUNT_MISMATCH")
    rows = []
    ids = set()
    for feature in features:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        geometry = feature.get("geometry") if isinstance(feature, dict) else None
        if not isinstance(properties, dict) or not isinstance(geometry, dict) or geometry.get("type") != "MultiPolygon":
            raise ValueError("ZONING_SOURCE_GEOMETRY_MISMATCH")
        row = {name: properties.get(name) for name in ("feature_id", "city", "plan_level", "zone_code", "zone_category")}
        if any(not isinstance(value, str) or not value for value in row.values()) or row["feature_id"] in ids:
            raise ValueError("ZONING_SOURCE_ATTRIBUTE_MISMATCH")
        ids.add(row["feature_id"])
        rows.append(row)

    document = {
        "schemaVersion": "pulse-zoning-attributes/1",
        "datasetId": "urban_zoning_taipei",
        "featureCount": len(rows),
        "dataDate": args.data_date,
        "sourceGeojsonSha256": source_hash,
        "displayPmtilesSha256": tile_hash,
        "geometryIncluded": False,
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "features": len(rows), "bytes": args.output.stat().st_size,
                      "sha256": sha256(args.output), "sourceGeojsonSha256": source_hash,
                      "displayPmtilesSha256": tile_hash}, ensure_ascii=False))


if __name__ == "__main__":
    main()
