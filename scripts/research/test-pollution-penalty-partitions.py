#!/usr/bin/env python3
from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("build-pollution-penalty-partitions.py")
SPEC = importlib.util.spec_from_file_location("penalty_partitions", MODULE)
assert SPEC and SPEC.loader
PARTITIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARTITIONS)


def feature() -> dict:
    properties = {field: "x" for field in PARTITIONS.PUBLIC_FIELDS}
    properties.update({"penalty_year": 2026, "penalty_money": 1000, "is_important": 0, "is_continuous": 0, "is_stop_order": 0, "illegal_money": 0})
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [120.01, 23.01]}, "properties": properties}


class PollutionPenaltyPartitionsTest(unittest.TestCase):
    def test_publishes_only_whitelisted_fields_and_receipt(self) -> None:
        temporary = Path(tempfile.mkdtemp()); source = temporary / "events.geojsonseq"
        source.write_bytes(PARTITIONS.canonical_bytes(feature()))
        original = PARTITIONS.EXPECTED_EVENT_COUNT; PARTITIONS.EXPECTED_EVENT_COUNT = 1
        try: receipt = PARTITIONS.build(source, temporary / "out", hashlib.sha256(source.read_bytes()).hexdigest())
        finally: PARTITIONS.EXPECTED_EVENT_COUNT = original
        manifest = json.loads((temporary / "out" / "manifest.json").read_bytes()); shard = manifest["shards"][0]
        payload = json.loads(gzip.decompress((temporary / "out" / shard["path"]).read_bytes()))
        self.assertEqual(set(payload["features"][0]["properties"]), set(PARTITIONS.PUBLIC_FIELDS))
        self.assertIn("violation_fact", receipt["excludedFields"])
        self.assertEqual(receipt["source"]["featureCount"], 1)

    def test_drops_identity_and_free_text_source_properties(self) -> None:
        temporary = Path(tempfile.mkdtemp()); source = temporary / "events.geojsonseq"; value = feature()
        value["properties"].update({"violation_fact": "sensitive narrative", "fac_name": "named party", "document_no": "DOC", "ems_no": "EMS"})
        source.write_bytes(PARTITIONS.canonical_bytes(value))
        original = PARTITIONS.EXPECTED_EVENT_COUNT; PARTITIONS.EXPECTED_EVENT_COUNT = 1
        try:
            PARTITIONS.build(source, temporary / "out", hashlib.sha256(source.read_bytes()).hexdigest())
        finally:
            PARTITIONS.EXPECTED_EVENT_COUNT = original
        manifest = json.loads((temporary / "out" / "manifest.json").read_bytes()); shard = manifest["shards"][0]
        properties = json.loads(gzip.decompress((temporary / "out" / shard["path"]).read_bytes()))["features"][0]["properties"]
        self.assertEqual(set(properties), set(PARTITIONS.PUBLIC_FIELDS))


if __name__ == "__main__": unittest.main()
