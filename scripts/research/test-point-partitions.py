#!/usr/bin/env python3
"""Regression tests for the bounded point partition artifact builder."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("build-point-partitions.py")
SPEC = importlib.util.spec_from_file_location("point_partitions", MODULE)
assert SPEC and SPEC.loader
PARTITIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARTITIONS)


def feature(identifier: str, geometry: object, properties: object = None) -> dict:
    return {"type": "Feature", "id": identifier, "properties": {"label": identifier} if properties is None else properties, "geometry": geometry}


def read_json(path: Path) -> object:
    return json.loads(path.read_bytes())


def exact_in_bbox(feature_value: dict, bbox: list[float]) -> bool:
    geometry = feature_value.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        return False
    coordinates = geometry.get("coordinates")
    return isinstance(coordinates, list) and len(coordinates) >= 2 and all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in coordinates[:2]) and bbox[0] <= coordinates[0] <= bbox[2] and bbox[1] <= coordinates[1] <= bbox[3]


def overlaps(left: list[float], right: list[float]) -> bool:
    return left[0] <= right[2] and right[0] <= left[2] and left[1] <= right[3] and right[1] <= left[3]


class PointPartitionsTest(unittest.TestCase):
    def build_fixture(self) -> tuple[Path, Path, dict]:
        temporary = Path(tempfile.mkdtemp())
        source = temporary / "schools.geojson"
        original = {"type": "FeatureCollection", "features": [
            feature("west", {"type": "Point", "coordinates": [120.24999, 23.25]}),
            feature("boundary", {"type": "Point", "coordinates": [120.25, 23.25]}),
            feature("east", {"type": "Point", "coordinates": [120.25001, 23.25]}),
            feature("null", None, {"kept": None}),
            feature("line", {"type": "LineString", "coordinates": [[120, 23], [121, 24]]}),
            feature("bad", {"type": "Point", "coordinates": ["bad", 23]}),
        ]}
        source.write_bytes(PARTITIONS.canonical_bytes(original))
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        output = temporary / "out"
        manifest, _receipt = PARTITIONS.build(source, output, digest)
        return source, output, manifest

    def test_reconstructs_original_features_in_order_and_preserves_source_fingerprint(self) -> None:
        source, output, manifest = self.build_fixture()
        original = read_json(source)
        self.assertEqual(manifest["source"]["sha256"], hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertEqual(manifest["source"]["reference"], "/education/schools.geojson")
        reconstructed = []
        for shard in manifest["shards"]:
            payload = read_json(output / shard["path"])
            self.assertEqual(hashlib.sha256((output / shard["path"]).read_bytes()).hexdigest(), shard["sha256"])
            for item in payload["features"]:
                ordinal = item.pop("sourceOrdinal")
                reconstructed.append((ordinal, item))
        self.assertEqual([item for _, item in sorted(reconstructed)], original["features"])
        self.assertEqual([ordinal for ordinal, _ in sorted(reconstructed)], list(range(len(original["features"]))))
        self.assertEqual(sum(shard["featureCount"] for shard in manifest["shards"]), len(original["features"]))
        self.assertEqual(len([shard for shard in manifest["shards"] if shard["bbox"] is None]), 1)
        receipt = read_json(output / "manifest-receipt.json")
        self.assertEqual(receipt["manifest"]["sha256"], hashlib.sha256((output / "manifest.json").read_bytes()).hexdigest())

    def test_inclusive_shard_selection_then_exact_filter_matches_original_at_grid_boundaries(self) -> None:
        source, output, manifest = self.build_fixture()
        original = read_json(source)["features"]
        for query in ([120.25, 23.25, 120.25, 23.25], [120.24999, 23.25, 120.25001, 23.25], [120.0, 23.0, 121.0, 24.0]):
            candidates = []
            for shard in manifest["shards"]:
                if shard["bbox"] is not None and overlaps(shard["bbox"], query):
                    candidates.extend(read_json(output / shard["path"])["features"])
            actual = sorted((item["sourceOrdinal"] for item in candidates if exact_in_bbox(item, query)))
            expected = [index for index, item in enumerate(original) if exact_in_bbox(item, query)]
            self.assertEqual(actual, expected)

    def test_rejects_wrong_source_hash(self) -> None:
        source, _output, _manifest = self.build_fixture()
        with self.assertRaisesRegex(ValueError, "SOURCE_SHA256_MISMATCH"):
            PARTITIONS.build(source, source.parent / "wrong", "0" * 64)


if __name__ == "__main__":
    unittest.main()
