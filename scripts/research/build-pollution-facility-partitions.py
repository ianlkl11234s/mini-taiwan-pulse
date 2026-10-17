#!/usr/bin/env python3
"""Build public-field-only, source-SHA-bound bbox shards for regulated facilities."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any

FRONTEND_SHA256 = "7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9"
STAGED_SHA256 = "0121da253ad62da9796165967685fa5cbc022fb0f33fad24961edc4069e684a8"
EXPECTED_POINTS = 152_246
EXPECTED_STAGED_POINTS = 143_743
SOURCE_REFERENCE = "/research/pollution-facilities/source-identity/sha256-7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9"
CELL_DEGREES = 0.1
MAX_FEATURES_PER_SHARD = 8_000
MAX_SHARD_BYTES = 6 * 1024 * 1024
SEVERITY_FIELDS = ("sev_air", "sev_water", "sev_waste", "sev_toxic", "sev_soil")
PUBLIC_FIELDS = ("emsno", "name", "county", "industry_group", "industry_macro", "mediums", "max_sev", *SEVERITY_FIELDS, "source_kind")
MEDIUMS = frozenset(field.removeprefix("sev_") for field in SEVERITY_FIELDS)


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def point(feature: Any) -> tuple[float, float]:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise ValueError("SOURCE_FEATURE_REQUIRED")
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point" or not isinstance(geometry.get("coordinates"), list) or len(geometry["coordinates"]) != 2:
        raise ValueError("SOURCE_POINT_REQUIRED")
    lng, lat = geometry["coordinates"]
    if not isinstance(lng, (int, float)) or isinstance(lng, bool) or not isinstance(lat, (int, float)) or isinstance(lat, bool) or not math.isfinite(lng) or not 118 <= lng <= 123 or not 21 <= lat <= 27:
        raise ValueError("SOURCE_POINT_REQUIRED")
    return float(lng), float(lat)


def cell_for(lng: float, lat: float) -> tuple[int, int]:
    return math.floor(lng / CELL_DEGREES), math.floor(lat / CELL_DEGREES)


def cell_bbox(cell: tuple[int, int]) -> list[float]:
    west, south = cell[0] * CELL_DEGREES, cell[1] * CELL_DEGREES
    return [west, south, west + CELL_DEGREES, south + CELL_DEGREES]


def scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, bool)) or isinstance(value, float) and math.isfinite(value)


def staged_index(path: Path, expected_sha256: str) -> dict[str, dict[str, Any]]:
    source = path.read_bytes()
    if sha256_bytes(source) != expected_sha256:
        raise ValueError("POLLUTION_FACILITY_STAGED_SHA_MISMATCH")
    try:
        collection = json.loads(source)
    except json.JSONDecodeError as error:
        raise ValueError("POLLUTION_FACILITY_STAGED_JSON_INVALID") from error
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection" or not isinstance(collection.get("features"), list) or len(collection["features"]) != EXPECTED_STAGED_POINTS:
        raise ValueError("POLLUTION_FACILITY_STAGED_COUNT_MISMATCH")
    indexed: dict[str, dict[str, Any]] = {}
    for feature in collection["features"]:
        point(feature)
        properties = feature.get("properties")
        if not isinstance(properties, dict) or not isinstance(properties.get("emsno"), str) or not properties["emsno"] or properties["emsno"] in indexed:
            raise ValueError("POLLUTION_FACILITY_STAGED_ID_MISMATCH")
        indexed[properties["emsno"]] = feature
    return indexed


def normalized_public_feature(feature: Any, ordinal: int, staged: dict[str, dict[str, Any]]) -> tuple[tuple[int, int], dict[str, Any], bool]:
    lng, lat = point(feature)
    properties = feature.get("properties")
    if not isinstance(properties, dict) or not isinstance(properties.get("emsno"), str) or not properties["emsno"]:
        raise ValueError("POLLUTION_FACILITY_SOURCE_FEATURE_INVALID")
    original = staged.get(properties["emsno"])
    required_strings = ("emsno", "name", "county", "industry_group", "industry_macro", "mediums")
    if any(not isinstance(properties.get(field), str) for field in required_strings) or properties.get("source_kind") != "regulated_facility" or not isinstance(properties.get("max_sev"), int) or isinstance(properties.get("max_sev"), bool) or not 0 <= properties["max_sev"] <= 3:
        raise ValueError("POLLUTION_FACILITY_SOURCE_FEATURE_INVALID")
    medium_tokens = tuple(token for token in properties["mediums"].split(",") if token)
    if not medium_tokens or len(medium_tokens) != len(set(medium_tokens)) or not set(medium_tokens) <= MEDIUMS:
        raise ValueError("POLLUTION_FACILITY_MEDIUMS_INVALID")
    original_properties = original.get("properties") if isinstance(original, dict) else None
    if original is not None:
        if point(original) != (lng, lat) or not isinstance(original_properties, dict):
            raise ValueError("POLLUTION_FACILITY_STAGED_ALIGNMENT_MISMATCH")
        for field in ("emsno", "name", "county", "industry_group", "industry_macro", "max_sev"):
            if properties.get(field) != original_properties.get(field):
                raise ValueError("POLLUTION_FACILITY_STAGED_ALIGNMENT_MISMATCH")
    severity: dict[str, int | None] = {}
    for field in SEVERITY_FIELDS:
        value = properties.get(field)
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 3):
            raise ValueError("POLLUTION_FACILITY_SOURCE_FEATURE_INVALID")
        if original_properties is not None and value != original_properties.get(field):
            raise ValueError("POLLUTION_FACILITY_STAGED_ALIGNMENT_MISMATCH")
        severity[field] = value
    if {field.removeprefix("sev_") for field, value in severity.items() if value is not None} != set(medium_tokens):
        raise ValueError("POLLUTION_FACILITY_MEDIUMS_ALIGNMENT_MISMATCH")
    public = {field: properties[field] for field in ("emsno", "name", "county", "industry_group", "industry_macro", "mediums", "max_sev")}
    public.update(severity)
    public["source_kind"] = "regulated_facility"
    if set(public) != set(PUBLIC_FIELDS) or any(not scalar(value) for value in public.values()):
        raise ValueError("POLLUTION_FACILITY_PUBLIC_FIELD_CONTRACT_MISMATCH")
    return cell_for(lng, lat), {"type": "Feature", "sourceOrdinal": ordinal, "geometry": {"type": "Point", "coordinates": [lng, lat]}, "properties": public}, original is not None


def write_shard(output_dir: Path, features: list[dict[str, Any]], bbox: list[float]) -> dict[str, Any]:
    payload = canonical_bytes({"type": "FeatureCollection", "features": features})
    if len(features) > MAX_FEATURES_PER_SHARD or len(payload) > MAX_SHARD_BYTES:
        raise ValueError("POLLUTION_FACILITY_SHARD_LIMIT_EXCEEDED")
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    digest = sha256_bytes(compressed)
    name = f"{digest}.geojson.gz"
    (output_dir / name).write_bytes(compressed)
    return {"path": name, "sha256": digest, "bytes": len(compressed), "encoding": "gzip", "uncompressedSha256": sha256_bytes(payload), "uncompressedBytes": len(payload), "featureCount": len(features), "bbox": bbox}


def build(frontend: Path, staged: Path, output_dir: Path, frontend_sha256: str = FRONTEND_SHA256, staged_sha256: str = STAGED_SHA256) -> dict[str, Any]:
    if output_dir.exists():
        raise ValueError("OUTPUT_DIRECTORY_EXISTS")
    staged_by_id = staged_index(staged, staged_sha256)
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pollution-facility-partitions-", dir=output_dir.parent) as temporary:
        root = Path(temporary); buckets = root / "buckets"; buckets.mkdir()
        handles: dict[tuple[int, int], Any] = {}; digest = hashlib.sha256(); count = 0; staged_matches = 0; seen: set[str] = set()
        try:
            with frontend.open("rb") as stream:
                for ordinal, line in enumerate(stream):
                    digest.update(line)
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError as error:
                        raise ValueError("POLLUTION_FACILITY_SOURCE_NDJSON_INVALID") from error
                    cell, public, matches_staged = normalized_public_feature(item, ordinal, staged_by_id)
                    emsno = public["properties"]["emsno"]
                    if emsno in seen:
                        raise ValueError("POLLUTION_FACILITY_SOURCE_ID_MISMATCH")
                    seen.add(emsno)
                    handle = handles.get(cell)
                    if handle is None:
                        handle = (buckets / f"{cell[0]}_{cell[1]}.ndjson").open("ab")
                        handles[cell] = handle
                    handle.write(canonical_bytes(public)); count += 1; staged_matches += int(matches_staged)
        finally:
            for handle in handles.values(): handle.close()
        if digest.hexdigest() != frontend_sha256:
            raise ValueError("POLLUTION_FACILITY_FRONTEND_SHA_MISMATCH")
        if count != EXPECTED_POINTS or len(seen) != EXPECTED_POINTS:
            raise ValueError("POLLUTION_FACILITY_SOURCE_COUNT_MISMATCH")
        built = root / "built"; built.mkdir(); shards: list[dict[str, Any]] = []
        for bucket in sorted(buckets.iterdir(), key=lambda item: tuple(map(int, item.stem.split("_")))):
            cell = tuple(map(int, bucket.stem.split("_"))); chunk: list[dict[str, Any]] = []
            for line in bucket.read_bytes().splitlines():
                chunk.append(json.loads(line))
                if len(chunk) == MAX_FEATURES_PER_SHARD:
                    shards.append(write_shard(built, chunk, cell_bbox(cell))); chunk = []
            if chunk: shards.append(write_shard(built, chunk, cell_bbox(cell)))
        if not shards or len(shards) > 1024 or sum(item["featureCount"] for item in shards) != count:
            raise ValueError("POLLUTION_FACILITY_PARTITION_MANIFEST_MISMATCH")
        manifest = {"schemaVersion": "pulse-point-partitions/2", "source": {"sha256": frontend_sha256, "bytes": frontend.stat().st_size, "featureCount": count, "reference": SOURCE_REFERENCE}, "cellDegrees": CELL_DEGREES, "shards": shards}
        manifest_bytes = canonical_bytes(manifest); (built / "manifest.json").write_bytes(manifest_bytes)
        receipt = {"schemaVersion": "pulse-pollution-facility-partitions-receipt/1", "manifest": {"path": "manifest.json", "sha256": sha256_bytes(manifest_bytes), "bytes": len(manifest_bytes)}, "source": manifest["source"], "staged": {"sha256": staged_sha256, "bytes": staged.stat().st_size, "featureCount": EXPECTED_STAGED_POINTS, "matchedFrontendEmsno": staged_matches, "frontendOnlyEmsno": count - staged_matches}, "snapshot": "20260706", "publicFields": list(PUBLIC_FIELDS), "excludedFields": ["facility_address", "industry_name"], "geometry": "EMS regulated-facility coordinate preserved as WGS84 Point; source has no per-point geocode precision; Point is not a facility boundary, entrance, emissions measurement, or access route.", "coverage": "152,246 2026-07-06 fixed EMS_S_01 regulated-facility points. It means regulated potential, not confirmed pollution; record absence is not proof a facility is unregulated or clean."}
        (built / "manifest-receipt.json").write_bytes(canonical_bytes(receipt)); os.rename(built, output_dir)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frontend", type=Path, required=True); parser.add_argument("--staged", type=Path, required=True); parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(); build(args.frontend, args.staged, args.output_dir)


if __name__ == "__main__": main()
