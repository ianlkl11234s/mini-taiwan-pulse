#!/usr/bin/env python3
"""Build bounded, public-field-only shards for the fixed pollution-penalty event snapshot."""
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

EXPECTED_SOURCE_SHA256 = "247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937"
EXPECTED_EVENT_COUNT = 414_904
SOURCE_REFERENCE = "/research/pollution-penalties/source-identity/sha256-247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937"
# Start coarse to keep the manifest small. Dense cells are deterministically
# split to 0.025 degrees, which keeps ordinary urban bbox reads under 8 MiB.
CELL_DEGREES = 0.1
MIN_CELL_DEGREES = 0.025
TARGET_UNCOMPRESSED_SHARD_BYTES = 1_500_000
MAX_FEATURES_PER_SHARD = 8_000
MAX_SHARD_BYTES = 6 * 1024 * 1024
# Do not materialize free-text violation facts, addresses, facility/document IDs,
# source row numbers, or named regulated parties in browser-readable sidecars.
PUBLIC_FIELDS = (
    "county", "event_medium", "transgress_type", "penalty_date", "penalty_year",
    "penalty_money", "severity_event", "is_continuous", "geocode_precision",
)


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def cell_for(lng: float, lat: float, degrees: float = CELL_DEGREES) -> tuple[int, int]:
    return math.floor(lng / degrees), math.floor(lat / degrees)


def cell_bbox(cell: tuple[int, int], degrees: float = CELL_DEGREES) -> list[float]:
    west, south = cell[0] * degrees, cell[1] * degrees
    return [west, south, west + degrees, south + degrees]


def scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, bool)) or isinstance(value, float) and math.isfinite(value)


def public_feature(value: Any, ordinal: int) -> tuple[tuple[int, int], dict[str, Any]]:
    if not isinstance(value, dict) or value.get("type") != "Feature":
        raise ValueError("SOURCE_FEATURE_REQUIRED")
    geometry = value.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        raise ValueError("SOURCE_POINT_REQUIRED")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) != 2:
        raise ValueError("SOURCE_POINT_REQUIRED")
    lng, lat = coordinates
    if not isinstance(lng, (int, float)) or isinstance(lng, bool) or not isinstance(lat, (int, float)) or isinstance(lat, bool) or not math.isfinite(lng) or not math.isfinite(lat) or not -180 <= lng <= 180 or not -90 <= lat <= 90:
        raise ValueError("SOURCE_POINT_REQUIRED")
    properties = value.get("properties")
    if not isinstance(properties, dict) or any(not scalar(properties.get(field)) for field in PUBLIC_FIELDS):
        raise ValueError("PUBLIC_FIELD_CONTRACT_MISMATCH")
    return cell_for(lng, lat), {
        "type": "Feature", "sourceOrdinal": ordinal,
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        # The frontend contract removes empty strings.  Retain that absence as
        # null so query results never silently turn a missing law/reason into a
        # categorical value.
        "properties": {field: properties.get(field) for field in PUBLIC_FIELDS},
    }


def write_shard(output_dir: Path, features: list[dict[str, Any]], bbox: list[float]) -> dict[str, Any]:
    payload = canonical_bytes({"type": "FeatureCollection", "features": features})
    if len(features) > MAX_FEATURES_PER_SHARD or len(payload) > MAX_SHARD_BYTES:
        raise ValueError("SHARD_LIMIT_EXCEEDED")
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    digest = sha256_bytes(compressed)
    path = f"{digest}.geojson.gz"
    (output_dir / path).write_bytes(compressed)
    return {"path": path, "sha256": digest, "bytes": len(compressed), "encoding": "gzip", "uncompressedSha256": sha256_bytes(payload), "uncompressedBytes": len(payload), "featureCount": len(features), "bbox": bbox}


def write_adaptive_shards(output_dir: Path, features: list[dict[str, Any]], bbox: list[float], degrees: float) -> list[dict[str, Any]]:
    payload_bytes = len(canonical_bytes({"type": "FeatureCollection", "features": features}))
    if len(features) <= MAX_FEATURES_PER_SHARD and payload_bytes <= TARGET_UNCOMPRESSED_SHARD_BYTES:
        return [write_shard(output_dir, features, bbox)]
    if degrees <= MIN_CELL_DEGREES:
        # An exceptionally dense identical 0.025-degree cell remains bounded
        # by the loader's 8 MiB hard limit and is split only by source order.
        return [write_shard(output_dir, features[index:index + MAX_FEATURES_PER_SHARD], bbox) for index in range(0, len(features), MAX_FEATURES_PER_SHARD)]
    child_degrees = degrees / 2
    children: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for feature in features:
        lng, lat = feature["geometry"]["coordinates"]
        children.setdefault(cell_for(lng, lat, child_degrees), []).append(feature)
    return [shard for cell in sorted(children) for shard in write_adaptive_shards(output_dir, children[cell], cell_bbox(cell, child_degrees), child_degrees)]


def build(source: Path, output_dir: Path, expected_sha256: str = EXPECTED_SOURCE_SHA256) -> dict[str, Any]:
    if output_dir.exists():
        raise ValueError("OUTPUT_DIRECTORY_EXISTS")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pollution-penalty-partitions-", dir=output_dir.parent) as temporary:
        root = Path(temporary)
        buckets = root / "buckets"; buckets.mkdir()
        handles: dict[tuple[int, int], Any] = {}
        digest = hashlib.sha256(); count = 0
        try:
            with source.open("rb") as stream:
                for ordinal, raw_line in enumerate(stream):
                    digest.update(raw_line)
                    try:
                        value = json.loads(raw_line)
                    except json.JSONDecodeError as error:
                        raise ValueError("SOURCE_NDJSON_INVALID") from error
                    cell, feature = public_feature(value, ordinal)
                    handle = handles.get(cell)
                    if handle is None:
                        handle = (buckets / f"{cell[0]}_{cell[1]}.ndjson").open("wb")
                        handles[cell] = handle
                    handle.write(canonical_bytes(feature)); count += 1
        finally:
            for handle in handles.values(): handle.close()
        if digest.hexdigest() != expected_sha256: raise ValueError("SOURCE_SHA256_MISMATCH")
        if count != EXPECTED_EVENT_COUNT: raise ValueError("EVENT_COUNT_MISMATCH")

        built = root / "built"; built.mkdir(); shards: list[dict[str, Any]] = []
        for bucket in sorted(buckets.iterdir(), key=lambda item: tuple(map(int, item.stem.split("_")))):
            x, y = map(int, bucket.stem.split("_")); chunk: list[dict[str, Any]] = []
            with bucket.open("rb") as stream:
                for raw_line in stream:
                    chunk.append(json.loads(raw_line))
            if chunk: shards.extend(write_adaptive_shards(built, chunk, cell_bbox((x, y)), CELL_DEGREES))
        if not shards or len(shards) > 1024 or sum(shard["featureCount"] for shard in shards) != count:
            raise ValueError("PARTITION_MANIFEST_LIMIT_MISMATCH")
        manifest = {"schemaVersion": "pulse-point-partitions/2", "source": {"sha256": expected_sha256, "bytes": source.stat().st_size, "featureCount": count, "reference": SOURCE_REFERENCE}, "cellDegrees": CELL_DEGREES, "shards": shards}
        manifest_bytes = canonical_bytes(manifest); (built / "manifest.json").write_bytes(manifest_bytes)
        receipt = {"schemaVersion": "pulse-pollution-penalty-partitions-receipt/1", "manifest": {"path": "manifest.json", "sha256": sha256_bytes(manifest_bytes), "bytes": len(manifest_bytes)}, "source": manifest["source"], "snapshot": "20260706", "publicFeatureCount": count, "rightsReview": "address_osm 108,276 geometry records are retained for local processing only. This artifact establishes no public redistribution permission; a release/access decision is required before serving it outside the authorized local workspace.", "publicFields": list(PUBLIC_FIELDS), "excludedFields": ["event_id", "source_row_no", "document_no", "ems_no", "fac_name", "violation_fact", "full_address"], "geometry": "Mixed facility/address/parcel geocodes; Point is a reference location and does not establish an actual violation location.", "coverage": "Historical EMS_P_46 event snapshot dated 2010-01-08 through 2026-06-23; no current enforcement status claim."}
        (built / "manifest-receipt.json").write_bytes(canonical_bytes(receipt))
        os.rename(built, output_dir)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--expected-sha256", default=EXPECTED_SOURCE_SHA256)
    args = parser.parse_args()
    build(args.source, args.output_dir, args.expected_sha256)


if __name__ == "__main__": main()
