#!/usr/bin/env python3
"""Pin the verified K-12 school-district source for localhost owner-only queries."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parents[3] / "taipei-gis-analytics/data/processed/education/school_district_k12/school_district_k12_20260809.geojson"
OUTPUT = ROOT.parent / "runtime/owner-only/school-district-k12/school_district_k12_20260809.geojson"
EXPECTED_BYTES = 21_710_315
EXPECTED_SHA256 = "b461e2ec305880a579874068ef955e11734acb4567718916e20be09c969584b4"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if SOURCE.stat().st_size != EXPECTED_BYTES or sha(SOURCE) != EXPECTED_SHA256:
        raise RuntimeError("SCHOOL_DISTRICT_K12_SOURCE_MISMATCH")
    data = json.loads(SOURCE.read_text())
    features = data.get("features", [])
    levels = {"elementary": 0, "junior": 0}
    precision = {"village_full": 0, "village_partial": 0}
    geometry = {"Polygon": 0, "MultiPolygon": 0}
    if data.get("type") != "FeatureCollection" or len(features) != 860:
        raise RuntimeError("SCHOOL_DISTRICT_K12_COLLECTION_MISMATCH")
    for feature in features:
        props, shape = feature.get("properties"), feature.get("geometry")
        if not isinstance(props, dict) or not isinstance(shape, dict) or props.get("level") not in levels or props.get("precision") not in precision or shape.get("type") not in geometry:
            raise RuntimeError("SCHOOL_DISTRICT_K12_ROW_MISMATCH")
        levels[props["level"]] += 1
        precision[props["precision"]] += 1
        geometry[shape["type"]] += 1
    if levels != {"elementary": 621, "junior": 239} or precision != {"village_full": 206, "village_partial": 654} or geometry != {"Polygon": 779, "MultiPolygon": 81}:
        raise RuntimeError("SCHOOL_DISTRICT_K12_COVERAGE_MISMATCH")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, OUTPUT)
    if OUTPUT.stat().st_size != EXPECTED_BYTES or sha(OUTPUT) != EXPECTED_SHA256:
        raise RuntimeError("SCHOOL_DISTRICT_K12_COPY_MISMATCH")
    print(json.dumps({"output": str(OUTPUT), "bytes": EXPECTED_BYTES, "sha256": EXPECTED_SHA256, "levels": levels, "precision": precision, "geometry": geometry}, ensure_ascii=False))

if __name__ == "__main__":
    main()
