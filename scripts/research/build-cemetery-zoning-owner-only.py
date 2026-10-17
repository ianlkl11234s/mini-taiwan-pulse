#!/usr/bin/env python3
"""Copy the independently reconciled two-city zoning extract into localhost owner storage."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parents[3] / "taipei-gis-analytics/data/processed/funeral/cemetery_zoning_urban/cemetery_zoning_urban_20260805.geojson"
TARGET = ROOT.parent / "runtime/owner-only/cemetery-zoning/cemetery-zoning.geojson"
EXPECTED = "f469e494a476194614b91d9abe71ed55a5f296699361d834b57f9eb2e4404df3"
data = SOURCE.read_bytes()
if len(data) != 1_113_258 or sha256(data).hexdigest() != EXPECTED:
    raise SystemExit("CEMETERY_ZONING_SOURCE_MISMATCH")
TARGET.parent.mkdir(parents=True, exist_ok=True)
temporary = TARGET.with_suffix(".tmp")
temporary.write_bytes(data)
temporary.replace(TARGET)
print(f"{TARGET} {len(data)} {EXPECTED}")
