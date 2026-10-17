#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("build-company-point-partitions.py")
SPEC = importlib.util.spec_from_file_location("company_partitions", MODULE)
assert SPEC and SPEC.loader
PARTITIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARTITIONS)


def feature(name: str, lng: float, lat: float) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]}, "properties": {
        "company_name": name, "capital_total": None, "capital_q": 0, "is_manufacturing": 0,
        "categories": "", "industry_mid": "01", "setup_year": None, "county": "測試縣",
        "addr_mismatch": -1, "is_listed": 0, "has_trademark": 0,
    }}


class CompanyPointPartitionsTest(unittest.TestCase):
    def test_source_receipt_public_whitelist_and_shard_counts(self) -> None:
        temporary = Path(tempfile.mkdtemp())
        source = temporary / "companies.geojsonseq"
        source.write_bytes(b"".join(PARTITIONS.canonical_bytes(item) for item in [feature("a", 120.01, 23.01), feature("b", 120.02, 23.02)]))
        original_count = PARTITIONS.EXPECTED_PUBLISHED_POINTS
        PARTITIONS.EXPECTED_PUBLISHED_POINTS = 2
        try:
            receipt = PARTITIONS.build(source, temporary / "out", hashlib.sha256(source.read_bytes()).hexdigest())
        finally:
            PARTITIONS.EXPECTED_PUBLISHED_POINTS = original_count
        manifest = json.loads((temporary / "out" / "manifest.json").read_bytes())
        self.assertEqual(receipt["source"]["featureCount"], 2)
        self.assertEqual(sum(shard["featureCount"] for shard in manifest["shards"]), 2)
        import gzip
        shard_meta = manifest["shards"][0]
        self.assertEqual(shard_meta["encoding"], "gzip")
        payload = gzip.decompress((temporary / "out" / shard_meta["path"]).read_bytes())
        self.assertEqual(hashlib.sha256(payload).hexdigest(), shard_meta["uncompressedSha256"])
        shard = json.loads(payload)
        self.assertEqual(set(shard["features"][0]["properties"]), set(PARTITIONS.PUBLIC_FIELDS))
        self.assertEqual([item["sourceOrdinal"] for item in shard["features"]], [0, 1])

    def test_rejects_nonpublic_source_property(self) -> None:
        temporary = Path(tempfile.mkdtemp())
        source = temporary / "companies.geojsonseq"
        value = feature("a", 120.01, 23.01)
        value["properties"]["tax_id"] = "must-not-publish"
        source.write_bytes(PARTITIONS.canonical_bytes(value))
        with self.assertRaisesRegex(ValueError, "PUBLIC_FIELD_CONTRACT_MISMATCH"):
            PARTITIONS.build(source, temporary / "out", hashlib.sha256(source.read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
