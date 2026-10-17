#!/usr/bin/env python3
"""Create content-addressed point shards without changing source GeoJSON semantics."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
from typing import Any

EXPECTED_SCHOOLS_SHA256 = "7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3"
CELL_DEGREES = 0.25
SCHEMA_VERSION = "pulse-point-partitions/1"
SOURCE_REFERENCE = "/education/schools.geojson"


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_feature_collection(path: Path) -> tuple[bytes, list[dict[str, Any]]]:
    source_bytes = path.read_bytes()
    try:
        source = json.loads(source_bytes)
    except json.JSONDecodeError as error:
        raise ValueError("SOURCE_JSON_INVALID") from error
    if not isinstance(source, dict) or source.get("type") != "FeatureCollection" or not isinstance(source.get("features"), list):
        raise ValueError("SOURCE_FEATURE_COLLECTION_REQUIRED")
    features = source["features"]
    if not all(isinstance(feature, dict) and feature.get("type") == "Feature" for feature in features):
        raise ValueError("SOURCE_FEATURE_REQUIRED")
    return source_bytes, features


def actual_point(feature: dict[str, Any]) -> tuple[float, float] | None:
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        return None
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None
    lng, lat = coordinates[0], coordinates[1]
    if not isinstance(lng, (int, float)) or isinstance(lng, bool) or not isinstance(lat, (int, float)) or isinstance(lat, bool):
        return None
    if not math.isfinite(lng) or not math.isfinite(lat) or not -180 <= lng <= 180 or not -90 <= lat <= 90:
        return None
    return float(lng), float(lat)


def cell_for(lng: float, lat: float) -> tuple[int, int]:
    return math.floor(lng / CELL_DEGREES), math.floor(lat / CELL_DEGREES)


def cell_bbox(cell: tuple[int, int]) -> list[float]:
    x, y = cell
    west, south = x * CELL_DEGREES, y * CELL_DEGREES
    return [west, south, west + CELL_DEGREES, south + CELL_DEGREES]


def shard_feature(feature: dict[str, Any], ordinal: int) -> dict[str, Any]:
    if "sourceOrdinal" in feature:
        raise ValueError("SOURCE_ORDINAL_ALREADY_PRESENT")
    output = copy.deepcopy(feature)
    output["sourceOrdinal"] = ordinal
    return output


def write_shard(output_dir: Path, features: list[dict[str, Any]], bbox: list[float] | None) -> dict[str, Any]:
    payload = {"type": "FeatureCollection", "features": features}
    payload_bytes = canonical_bytes(payload)
    digest = sha256_bytes(payload_bytes)
    path = f"{digest}.geojson"
    (output_dir / path).write_bytes(payload_bytes)
    return {"path": path, "sha256": digest, "bytes": len(payload_bytes), "featureCount": len(features), "bbox": bbox}


def overlaps(left: list[float], right: list[float]) -> bool:
    return left[0] <= right[2] and right[0] <= left[2] and left[1] <= right[3] and right[1] <= left[3]


def point_in_bbox(point: tuple[float, float], bbox: list[float]) -> bool:
    return bbox[0] <= point[0] <= bbox[2] and bbox[1] <= point[1] <= bbox[3]


def verify_round_trip(source_bytes: bytes, source_features: list[dict[str, Any]], output_dir: Path, manifest: dict[str, Any]) -> None:
    """Refuse a written artifact unless it reconstructs the exact source feature order."""
    if sha256_bytes(source_bytes) != manifest["source"]["sha256"]:
        raise ValueError("PARTITION_SOURCE_RECEIPT_MISMATCH")
    loaded: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    reconstructed: list[tuple[int, dict[str, Any]]] = []
    for shard in manifest["shards"]:
        payload_bytes = (output_dir / shard["path"]).read_bytes()
        if sha256_bytes(payload_bytes) != shard["sha256"] or len(payload_bytes) != shard["bytes"]:
            raise ValueError("PARTITION_SHARD_RECEIPT_MISMATCH")
        payload = json.loads(payload_bytes)
        if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list) or len(payload["features"]) != shard["featureCount"]:
            raise ValueError("PARTITION_SHARD_INVALID")
        shard_features = payload["features"]
        for item in shard_features:
            if not isinstance(item, dict) or not isinstance(item.get("sourceOrdinal"), int):
                raise ValueError("PARTITION_ORDINAL_INVALID")
            ordinal = item["sourceOrdinal"]
            restored = copy.deepcopy(item)
            del restored["sourceOrdinal"]
            reconstructed.append((ordinal, restored))
            point = actual_point(restored)
            if point is None and shard["bbox"] is not None:
                raise ValueError("PARTITION_UNLOCATED_BBOX_INVALID")
            if point is not None and shard["bbox"] != cell_bbox(cell_for(*point)):
                raise ValueError("PARTITION_CELL_BBOX_INVALID")
        loaded.append((shard, shard_features))
    reconstructed.sort(key=lambda item: item[0])
    if [ordinal for ordinal, _feature in reconstructed] != list(range(len(source_features))) or [feature for _ordinal, feature in reconstructed] != source_features:
        raise ValueError("PARTITION_RECONSTRUCTION_MISMATCH")
    # Candidate selection is inclusive at grid boundaries; exact filtering stays
    # on the original point coordinate.  Test each real point as a zero-area query.
    for ordinal, original in enumerate(source_features):
        point = actual_point(original)
        if point is None:
            continue
        query = [point[0], point[1], point[0], point[1]]
        expected = [index for index, feature in enumerate(source_features) if (candidate := actual_point(feature)) is not None and point_in_bbox(candidate, query)]
        actual = sorted(item["sourceOrdinal"] for shard, shard_features in loaded if shard["bbox"] is not None and overlaps(shard["bbox"], query) for item in shard_features if (candidate := actual_point(item)) is not None and point_in_bbox(candidate, query))
        if actual != expected:
            raise ValueError("PARTITION_BBOX_QUERY_MISMATCH")


def build(source_path: Path, output_dir: Path, expected_sha256: str = EXPECTED_SCHOOLS_SHA256) -> tuple[dict[str, Any], dict[str, Any]]:
    source_bytes, features = read_feature_collection(source_path)
    source_sha256 = sha256_bytes(source_bytes)
    if source_sha256 != expected_sha256:
        raise ValueError("SOURCE_SHA256_MISMATCH")
    output_dir.mkdir(parents=True, exist_ok=True)
    cells: dict[tuple[int, int], list[dict[str, Any]]] = {}
    unlocated: list[dict[str, Any]] = []
    for ordinal, feature in enumerate(features):
        output = shard_feature(feature, ordinal)
        point = actual_point(feature)
        if point is None:
            unlocated.append(output)
        else:
            cells.setdefault(cell_for(*point), []).append(output)
    shards = [write_shard(output_dir, cells[cell], cell_bbox(cell)) for cell in sorted(cells)]
    if unlocated:
        shards.append(write_shard(output_dir, unlocated, None))
    manifest = {"schemaVersion": SCHEMA_VERSION, "source": {"sha256": source_sha256, "bytes": len(source_bytes), "featureCount": len(features), "reference": SOURCE_REFERENCE}, "cellDegrees": CELL_DEGREES, "shards": shards}
    verify_round_trip(source_bytes, features, output_dir, manifest)
    manifest_bytes = canonical_bytes(manifest)
    manifest_sha256 = sha256_bytes(manifest_bytes)
    (output_dir / "manifest.json").write_bytes(manifest_bytes)
    receipt = {"schemaVersion": "pulse-point-partitions-receipt/1", "manifest": {"path": "manifest.json", "sha256": manifest_sha256, "bytes": len(manifest_bytes)}, "source": manifest["source"]}
    (output_dir / "manifest-receipt.json").write_bytes(canonical_bytes(receipt))
    return manifest, receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("../runtime/oracle-assets/schools.geojson"))
    parser.add_argument("--output-dir", type=Path, default=Path("../runtime/point-partitions/schools"))
    parser.add_argument("--expected-sha256", default=EXPECTED_SCHOOLS_SHA256)
    args = parser.parse_args()
    build(args.source, args.output_dir, args.expected_sha256)


if __name__ == "__main__":
    main()
