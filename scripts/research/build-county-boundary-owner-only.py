#!/usr/bin/env python3
"""Pin the inspected MOI county GML and copy its full processed geometry for localhost queries."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANALYTICS = ROOT.parents[3] / "taipei-gis-analytics" / "data"
RAW = ANALYTICS / "raw/demographics/county_boundary/COUNTY_MOI_1140318.zip"
GML = ANALYTICS / "raw/demographics/county_boundary/COUNTY_MOI_1140318.gml"
PROCESSED = ANALYTICS / "processed/demographics/county_boundary/county_boundary_20260626.geojson"
OUTPUT = ROOT.parent / "runtime/owner-only/county-boundary/county_boundary_20260626.geojson"
EXPECTED = {
    RAW: (4014969, "f4589a7c65bbb905e40b1eaee332df71f4000a366f2a6f2221a64f64ef314d61"),
    GML: (12757400, "fd018d78160996977ef17558fa256260756870010a377d339b8cf54c5b3a6026"),
    PROCESSED: (14719725, "5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6"),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    for path, (size, digest) in EXPECTED.items():
        if path.stat().st_size != size or sha(path) != digest:
            raise RuntimeError(f"COUNTY_BOUNDARY_SOURCE_MISMATCH:{path.name}")
    features = json.loads(PROCESSED.read_text())["features"]
    if len(features) != 22 or len({f["properties"]["行政區域代碼"] for f in features}) != 22 or any(f["geometry"]["type"] != "MultiPolygon" for f in features):
        raise RuntimeError("COUNTY_BOUNDARY_GEOMETRY_CONTRACT_MISMATCH")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PROCESSED, OUTPUT)
    if sha(OUTPUT) != EXPECTED[PROCESSED][1]:
        raise RuntimeError("COUNTY_BOUNDARY_COPY_MISMATCH")
    print(json.dumps({"output": str(OUTPUT), "features": 22, "bytes": OUTPUT.stat().st_size, "sha256": sha(OUTPUT)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
