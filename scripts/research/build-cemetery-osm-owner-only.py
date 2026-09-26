#!/usr/bin/env python3
"""Pin the full local OSM cemetery snapshot for localhost owner-only research."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parents[3] / "taipei-gis-analytics/data/processed/funeral/cemetery_osm/cemetery_osm_20260805.geojson"
TARGET = ROOT.parent / "runtime/owner-only/cemetery-osm/cemetery-osm.geojson"
EXPECTED = "615a9adc23ac112aa56e0cc84bf106556f8acea13fadbe2436218ea530a58b23"
data = SOURCE.read_bytes()
if len(data) != 3_602_036 or sha256(data).hexdigest() != EXPECTED:
    raise SystemExit("CEMETERY_OSM_SOURCE_MISMATCH")
TARGET.parent.mkdir(parents=True, exist_ok=True)
temporary = TARGET.with_suffix(".tmp")
temporary.write_bytes(data)
temporary.replace(TARGET)
print(f"{TARGET} {len(data)} {EXPECTED}")
