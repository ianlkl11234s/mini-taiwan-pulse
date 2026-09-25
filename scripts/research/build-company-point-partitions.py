#!/usr/bin/env python3
"""Build source-SHA-bound, public-field-only spatial shards for company points."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

EXPECTED_SOURCE_SHA256 = "d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b"
EXPECTED_PUBLISHED_POINTS = 654_165
SOURCE_REFERENCE = "/research/company-points/source-identity/sha256-d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b"
CELL_DEGREES = 0.1
MAX_FEATURES_PER_SHARD = 8_000
MAX_SHARD_BYTES = 6 * 1024 * 1024
PUBLIC_FIELDS = (
    "company_name", "capital_total", "capital_q", "is_manufacturing", "categories",
    "industry_mid", "setup_year", "county", "addr_mismatch", "is_listed", "has_trademark",
)


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def cell_for(lng: float, lat: float) -> tuple[int, int]:
    return math.floor(lng / CELL_DEGREES), math.floor(lat / CELL_DEGREES)


def cell_bbox(cell: tuple[int, int]) -> list[float]:
    west, south = cell[0] * CELL_DEGREES, cell[1] * CELL_DEGREES
    return [west, south, west + CELL_DEGREES, south + CELL_DEGREES]


def scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool)) and not isinstance(value, float) or isinstance(value, float) and math.isfinite(value)


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
    if not isinstance(properties, dict) or set(properties) != set(PUBLIC_FIELDS) or any(not scalar(properties[field]) for field in PUBLIC_FIELDS):
        raise ValueError("PUBLIC_FIELD_CONTRACT_MISMATCH")
    return cell_for(lng, lat), {
        "type": "Feature", "sourceOrdinal": ordinal,
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {field: properties[field] for field in PUBLIC_FIELDS},
    }


def write_shard(output_dir: Path, features: list[dict[str, Any]], bbox: list[float]) -> dict[str, Any]:
    payload = canonical_bytes({"type": "FeatureCollection", "features": features})
    if len(features) > MAX_FEATURES_PER_SHARD or len(payload) > MAX_SHARD_BYTES:
        raise ValueError("SHARD_LIMIT_EXCEEDED")
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    digest = sha256_bytes(compressed)
    name = f"{digest}.geojson.gz"
    (output_dir / name).write_bytes(compressed)
    return {"path": name, "sha256": digest, "bytes": len(compressed), "encoding": "gzip", "uncompressedSha256": sha256_bytes(payload), "uncompressedBytes": len(payload), "featureCount": len(features), "bbox": bbox}


def build(source: Path, output_dir: Path, expected_sha256: str = EXPECTED_SOURCE_SHA256) -> dict[str, Any]:
    if output_dir.exists():
        raise ValueError("OUTPUT_DIRECTORY_EXISTS")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="company-point-partitions-", dir=output_dir.parent) as temporary:
        root = Path(temporary)
        buckets = root / "buckets"
        buckets.mkdir()
        handles: dict[tuple[int, int], Any] = {}
        digest = hashlib.sha256()
        count = 0
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
                    handle.write(canonical_bytes(feature))
                    count += 1
        finally:
            for handle in handles.values():
                handle.close()
        if digest.hexdigest() != expected_sha256:
            raise ValueError("SOURCE_SHA256_MISMATCH")
        if count != EXPECTED_PUBLISHED_POINTS:
            raise ValueError("PUBLISHED_POINT_COUNT_MISMATCH")

        built = root / "built"
        built.mkdir()
        shards: list[dict[str, Any]] = []
        for bucket in sorted(buckets.iterdir(), key=lambda path: tuple(map(int, path.stem.split("_")))):
            x, y = map(int, bucket.stem.split("_"))
            with bucket.open("rb") as stream:
                chunk: list[dict[str, Any]] = []
                for raw_line in stream:
                    chunk.append(json.loads(raw_line))
                    if len(chunk) == MAX_FEATURES_PER_SHARD:
                        shards.append(write_shard(built, chunk, cell_bbox((x, y))))
                        chunk = []
                if chunk:
                    shards.append(write_shard(built, chunk, cell_bbox((x, y))))
        if not shards or len(shards) > 1024 or sum(shard["featureCount"] for shard in shards) != count:
            raise ValueError("PARTITION_MANIFEST_LIMIT_MISMATCH")
        manifest = {
            "schemaVersion": "pulse-point-partitions/2",
            "source": {"sha256": expected_sha256, "bytes": source.stat().st_size, "featureCount": count, "reference": SOURCE_REFERENCE},
            "cellDegrees": CELL_DEGREES,
            "shards": shards,
        }
        manifest_bytes = canonical_bytes(manifest)
        (built / "manifest.json").write_bytes(manifest_bytes)
        receipt = {
            "schemaVersion": "pulse-company-point-partitions-receipt/1",
            "manifest": {"path": "manifest.json", "sha256": sha256_bytes(manifest_bytes), "bytes": len(manifest_bytes)},
            "source": manifest["source"],
            "snapshot": "202608",
            "upstreamRows": 657_882,
            "exclusions": {"dead_or_abnormal": 1_152, "invalid_coordinate_after_status_exclusion": 2_565},
            "publicFields": list(PUBLIC_FIELDS),
            "geometry": "business-address WGS84 geocode Point; not a factory, entrance, or access route",
            "coverageHold": "118-source family excludes an estimated 1,868 Kinmen/Matsu companies; per-dataset source license receipts are not revalidated by this builder",
        }
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


if __name__ == "__main__":
    main()
