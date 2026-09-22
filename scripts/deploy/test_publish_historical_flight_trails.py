#!/usr/bin/env python3
"""Offline contract tests for the historical flight-trails publisher."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module():
    path = ROOT / "scripts/deploy/publish_historical_flight_trails.py"
    spec = importlib.util.spec_from_file_location("publish_historical_flight_trails", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


PUBLISH = load_module()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class ClientError(Exception):
    def __init__(self, code: str):
        self.response = {"Error": {"Code": code}}
        super().__init__(code)


class FakeS3:
    def __init__(self):
        self.objects: dict[str, dict] = {}
        self.puts: list[dict] = []
        self.sequence: list[str] = []

    def get_object(self, *, Bucket, Key):
        self.sequence.append(f"get:{Key}")
        if Key not in self.objects:
            raise ClientError("NoSuchKey")
        value = self.objects[Key]
        return {"Body": BytesIO(value["body"]), "ETag": value["etag"], "ContentType": value["content_type"], "CacheControl": value["cache_control"]}

    def put_object(self, *, Bucket, Key, Body, ContentType, CacheControl, Metadata, IfNoneMatch=None, IfMatch=None):
        self.sequence.append(f"put:{Key}")
        self.puts.append({"Key": Key, "IfNoneMatch": IfNoneMatch, "IfMatch": IfMatch, "ContentType": ContentType, "CacheControl": CacheControl, "Metadata": Metadata})
        if IfNoneMatch == "*" and Key in self.objects:
            raise ClientError("PreconditionFailed")
        if IfMatch is not None and (Key not in self.objects or self.objects[Key]["etag"] != IfMatch):
            raise ClientError("PreconditionFailed")
        data = Body.read()
        self.objects[Key] = {"body": data, "etag": f'"etag-{len(self.puts)}"', "content_type": ContentType, "cache_control": CacheControl}


class HistoricalFlightPublicationTest(unittest.TestCase):
    def make_root(self, base: Path, asset_count: int = 2) -> Path:
        root = base / "flight-trails"
        release = root / "releases/r1"
        samples = []
        for number in range(asset_count):
            relative = f"releases/r1/tw_RC{number:02d}_2026-03-10.geojson"
            payload = (f'{{"asset":{number}}}\n').encode()
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
            samples.append({"asset": {"path": relative, "bytes": len(payload), "sha256": sha(payload)}})
        manifest = {"schema": "historical-flight-trails-v1", "license_status": "verified_public_display", "release_id": "r1", "samples": samples}
        root.mkdir(parents=True, exist_ok=True)
        (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return root

    def test_rejects_unverified_public_display_license(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.make_root(Path(temporary), 1)
            manifest_path = root / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["license_status"] = "unverified"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "license_status"):
                PUBLISH.manifest_entries(root)

    def test_validation_rejects_unreferenced_and_hash_mismatch_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.make_root(Path(temporary), 1)
            (root / "releases/r1/orphan.geojson").write_text("{}")
            with self.assertRaisesRegex(ValueError, "unreferenced"):
                PUBLISH.manifest_entries(root)
        with tempfile.TemporaryDirectory() as temporary:
            root = self.make_root(Path(temporary), 1)
            asset = next((root / "releases/r1").iterdir())
            asset.write_text("changed")
            with self.assertRaisesRegex(ValueError, "bytes/SHA-256 mismatch"):
                PUBLISH.manifest_entries(root)

    def test_uploads_immutable_assets_before_manifest_with_required_headers(self):
        with tempfile.TemporaryDirectory() as temporary:
            _, entries = PUBLISH.manifest_entries(self.make_root(Path(temporary), 2))
            client, recorded = FakeS3(), []
            PUBLISH.publish_in_order(client, "bucket", entries, None, None, recorded.append)
            self.assertEqual([item["relative_path"] for item in recorded][-1], "manifest.json")
            self.assertEqual(len(client.puts), 3)
            for put in client.puts[:-1]:
                self.assertEqual(put["IfNoneMatch"], "*")
                self.assertIsNone(put["IfMatch"])
                self.assertEqual(put["ContentType"], "application/geo+json")
                self.assertEqual(put["CacheControl"], PUBLISH.IMMUTABLE_CACHE)
            pointer = client.puts[-1]
            self.assertEqual(pointer["IfNoneMatch"], "*")
            self.assertEqual(pointer["ContentType"], "application/json")
            self.assertEqual(pointer["CacheControl"], PUBLISH.MANIFEST_CACHE)
            self.assertTrue(all(item["status"].endswith("verified") for item in recorded))

    def test_differing_manifest_requires_and_uses_matching_conditional_expectation(self):
        with tempfile.TemporaryDirectory() as temporary:
            _, entries = PUBLISH.manifest_entries(self.make_root(Path(temporary), 1))
            client, manifest = FakeS3(), entries[-1]
            client.objects[manifest["destination_key"]] = {"body": b"old", "etag": '"old-etag"', "content_type": "application/json", "cache_control": PUBLISH.MANIFEST_CACHE}
            with self.assertRaisesRegex(ValueError, "expected-manifest"):
                PUBLISH.publish_manifest(client, "bucket", manifest, None, None)
            result = PUBLISH.publish_manifest(client, "bucket", manifest, sha(b"old"), None)
            self.assertEqual(result["status"], "updated_and_verified")
            self.assertEqual(client.puts[-1]["IfMatch"], '"old-etag"')
            self.assertIsNone(client.puts[-1]["IfNoneMatch"])

    def test_rejects_mismatched_expected_pointer_and_existing_immutable_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            _, entries = PUBLISH.manifest_entries(self.make_root(Path(temporary), 1))
            client, immutable, manifest = FakeS3(), entries[0], entries[-1]
            client.objects[manifest["destination_key"]] = {"body": b"old", "etag": '"old-etag"', "content_type": "application/json", "cache_control": PUBLISH.MANIFEST_CACHE}
            with self.assertRaisesRegex(ValueError, "does not match"):
                PUBLISH.publish_manifest(client, "bucket", manifest, "f" * 64, None)
            client.objects[immutable["destination_key"]] = {"body": b"different", "etag": '"immutable"', "content_type": immutable["content_type"], "cache_control": immutable["cache_control"]}
            with self.assertRaisesRegex(ValueError, "bytes/SHA-256"):
                PUBLISH.publish_immutable(client, "bucket", immutable)
            self.assertEqual(len(client.puts), 1, "the immutable conflict must not overwrite the object")


if __name__ == "__main__":
    unittest.main()
