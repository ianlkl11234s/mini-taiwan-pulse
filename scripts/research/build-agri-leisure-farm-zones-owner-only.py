#!/usr/bin/env python3
"""Build a SHA-bound owner-only surface sidecar for MOA dataset 9809."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

import geopandas as gpd
from shapely import is_valid_reason, make_valid
from shapely.geometry import mapping

ANALYTICS_ROOT = Path("/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics")
RAW_ZIP = Path("data/raw/agriculture/leisure_farm_zones_2025/leisure_farm_zones_2025_20260522.zip")
RAW_SHP = Path("data/raw/agriculture/leisure_farm_zones_2025/extracted/休閒農業區範圍圖_109處2025版_TWD97.shp")
PROCESSED = Path("data/processed/agriculture/leisure_farm_zones_2025/leisure_farm_zones_2025.parquet")
RAW_SHA = "9b4d1f00952a0ba1b8f794203fdbb7e469eab30deb8dfb0ce1251f5627916172"
PROCESSED_SHA = "e80031b5bc50644f9da5e41d388f1a67c2acb7d85b95370cf471ae96a57eb0d0"
ROWS = 109
REPAIRED = ("A83", "E74", "G72", "K29", "K78", "M42", "U14")
FIELDS = ("source_dataset_id", "source_slug", "row_id", "LANAME", "KeyCode", "休區名", "AREA", "AA45", "AA46", "AA4546", "area_ha")


def fail(code: str) -> None:
    raise RuntimeError(code)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def multipolygon(geometry: object) -> dict[str, object]:
    value = mapping(geometry)
    if value["type"] == "Polygon":
        return {"type": "MultiPolygon", "coordinates": [value["coordinates"]]}
    if value["type"] == "MultiPolygon":
        return value
    fail("AGRI_LEISURE_FARM_ZONES_PROCESSED_GEOMETRY_TYPE")
    raise AssertionError("unreachable")


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else ANALYTICS_ROOT
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("../runtime/owner-only/agri-leisure-farm-zones")
    raw_zip, raw_shp, processed_path = root / RAW_ZIP, root / RAW_SHP, root / PROCESSED
    if sha(raw_zip) != RAW_SHA:
        fail("AGRI_LEISURE_FARM_ZONES_RAW_SHA_MISMATCH")
    if sha(processed_path) != PROCESSED_SHA:
        fail("AGRI_LEISURE_FARM_ZONES_PROCESSED_SHA_MISMATCH")

    raw = gpd.read_file(raw_shp).to_crs("EPSG:4326")
    processed = gpd.read_parquet(processed_path)
    if len(raw) != ROWS or len(processed) != ROWS or processed.crs is None or processed.crs.to_epsg() != 4326:
        fail("AGRI_LEISURE_FARM_ZONES_SOURCE_SCOPE_MISMATCH")
    if list(processed.drop(columns="geometry").columns) != list(FIELDS):
        fail("AGRI_LEISURE_FARM_ZONES_FIELD_SCHEMA_MISMATCH")
    if processed.drop(columns="geometry").isna().any().any() or processed.geometry.isna().any() or not processed.geometry.is_valid.all():
        fail("AGRI_LEISURE_FARM_ZONES_PROCESSED_SEMANTICS_MISMATCH")

    raw_by_code = {str(row.KeyCode): row.geometry for _, row in raw.iterrows()}
    if len(raw_by_code) != ROWS or tuple(sorted(code for code, geometry in raw_by_code.items() if not geometry.is_valid)) != REPAIRED:
        fail("AGRI_LEISURE_FARM_ZONES_RAW_INVALID_SET_MISMATCH")
    records: list[dict[str, object]] = []
    for _, row in processed.iterrows():
        code = str(row.KeyCode)
        raw_geometry = raw_by_code.get(code)
        if raw_geometry is None or row.geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            fail("AGRI_LEISURE_FARM_ZONES_ROW_MISMATCH")
        repaired = code in REPAIRED
        if repaired:
            repaired_raw = make_valid(raw_geometry)
            # Coordinate transform serialisation can differ by sub-nanometres. Bound the
            # topological change relative to the repaired source surface, rather than use
            # byte equality or silently accepting a different legal boundary.
            denominator = max(repaired_raw.area, row.geometry.area, 1e-30)
            if repaired_raw.symmetric_difference(row.geometry).area / denominator > 1e-9:
                fail("AGRI_LEISURE_FARM_ZONES_REPAIR_TOPOLOGY_MISMATCH")
        elif not raw_geometry.is_valid or not raw_geometry.equals_exact(row.geometry, 1e-8):
            fail("AGRI_LEISURE_FARM_ZONES_UNEXPECTED_GEOMETRY_CHANGE")
        properties = {field: (int(row[field]) if field == "row_id" else float(row[field]) if field in {"AREA", "area_ha"} else str(row[field])) for field in FIELDS}
        properties.update({"record_id": code, "geometry_status": "repaired_from_invalid_raw" if repaired else "source_valid", "raw_geometry_valid": not repaired})
        records.append({"type": "Feature", "sourceOrdinal": int(row.row_id), "properties": properties, "geometry": multipolygon(row.geometry)})
    if len(records) != ROWS or {feature["properties"]["record_id"] for feature in records} != set(raw_by_code):
        fail("AGRI_LEISURE_FARM_ZONES_RECORD_ID_MISMATCH")

    payload = json_bytes({"type": "FeatureCollection", "features": records})
    temporary = output.with_name(f"{output.name}.building")
    if output.exists() or temporary.exists():
        fail("AGRI_LEISURE_FARM_ZONES_OUTPUT_EXISTS")
    temporary.mkdir(parents=True)
    try:
        asset = temporary / "agri-leisure-farm-zones.geojson"
        asset.write_bytes(payload)
        receipt = {
            "schemaVersion": "pulse-agri-leisure-farm-zones-owner-only/1",
            "source": {"raw": {"sha256": RAW_SHA, "rows": ROWS}, "processed": {"sha256": PROCESSED_SHA, "bytes": processed_path.stat().st_size, "featureCount": ROWS, "crs": "EPSG:4326"}},
            "publisher": "農業部農村發展及水土保持署", "datasetId": "9809", "license": "OGDL-Taiwan-1.0", "sourceVersion": "FY114 / 2025", "geometry": {"type": "MultiPolygon", "semantics": "processed WGS84 statutory leisure-agriculture zone surface; Polygon rows are wrapped as one-part MultiPolygon without changing coordinates.", "repairedFromInvalidRaw": list(REPAIRED), "repairMethod": "upstream 03_clean_all.py geopandas GeoSeries.make_valid(); independently bounded against raw make_valid topology (relative symmetric difference <= 1e-9).", "legalBoundaryNote": "法定界線以農業部官方原始檔為準。"},
            "nullCounts": {field: 0 for field in FIELDS}, "geometryStatusCounts": {"source_valid": ROWS - len(REPAIRED), "repaired_from_invalid_raw": len(REPAIRED)},
            "output": {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload), "featureCount": ROWS},
        }
        (temporary / "manifest-receipt.json").write_bytes(json_bytes(receipt))
        os.replace(temporary, output)
        print(json.dumps(receipt, ensure_ascii=False))
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


if __name__ == "__main__":
    main()
