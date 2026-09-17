#!/usr/bin/env python3
"""Offline contract checks for Japan medical publisher/installer helpers."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts/deploy" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


PUBLISH = load("publish-jp-medical-assets")
INSTALL = load("install-jp-medical-assets")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class PublicationContractTest(unittest.TestCase):
    def make_payload(self, directory: Path) -> tuple[Path, Path]:
        root = directory / "public/jp-medical"; root.mkdir(parents=True)
        version = "a" * 64
        release = root / "releases" / version
        files, entries = {}, []
        for index in range(778):
            rel = f"details/t/{index:03d}.json"
            data = f"{index}".encode(); path = release / rel; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            files[rel] = {"sha256": sha(data), "bytes": len(data)}
        catalog = {"version": version, "status": "LOCAL_READY_NOT_DEPLOYED", "files": files}
        (release / "catalog.json").write_text(json.dumps(catalog))
        catalog_bytes = (release / "catalog.json").read_bytes()
        manifest = {"version": version, "files": files, "catalog": {"sha256": sha(catalog_bytes), "bytes": len(catalog_bytes)}}
        (release / "publication-manifest.json").write_text(json.dumps(manifest))
        current = {"version": version, "catalog": f"releases/{version}/catalog.json", "publication_manifest": f"releases/{version}/publication-manifest.json"}
        (root / "current.json").write_text(json.dumps(current))
        for rel, meta in files.items():
            entries.append({"relative_path": f"releases/{version}/{rel}", "sha256": meta["sha256"], "bytes": meta["bytes"], "destination_key": f"deploy-assets/jp-medical/releases/{version}/{rel}", "content_type": "application/json", "cache_control": PUBLISH.IMMUTABLE_CACHE})
        for name in ("catalog.json", "publication-manifest.json"):
            data = (release / name).read_bytes(); entries.append({"relative_path": f"releases/{version}/{name}", "sha256": sha(data), "bytes": len(data), "destination_key": f"deploy-assets/jp-medical/releases/{version}/{name}", "content_type": "application/json", "cache_control": PUBLISH.IMMUTABLE_CACHE})
        data = (root / "current.json").read_bytes(); entries.append({"relative_path": "current.json", "sha256": sha(data), "bytes": len(data), "destination_key": "deploy-assets/jp-medical/current.json", "content_type": "application/json", "cache_control": PUBLISH.CURRENT_CACHE, "write_order": "last"})
        plan = directory / "plan.json"; plan.write_text(json.dumps({"version": version, "entries": entries, "total_all_publication_bytes": sum(item["bytes"] for item in entries)}))
        return root, plan

    def test_plan_requires_current_last_and_local_hashes(self):
        with tempfile.TemporaryDirectory() as temp:
            root, plan = self.make_payload(Path(temp))
            _, entries = PUBLISH.validate_plan(root, plan)
            self.assertEqual(len(entries), 781)
            broken = json.loads(plan.read_text()); broken["entries"][0], broken["entries"][-1] = broken["entries"][-1], broken["entries"][0]; plan.write_text(json.dumps(broken))
            with self.assertRaises(ValueError): PUBLISH.validate_plan(root, plan)

    def test_installer_rejects_traversal(self):
        with self.assertRaises(ValueError):
            INSTALL.safe_relative("releases/../current.json")

    def test_immutable_conflict_never_calls_put(self):
        with tempfile.TemporaryDirectory() as temp:
            root, plan = self.make_payload(Path(temp))
            _, entries = PUBLISH.validate_plan(root, plan)
            entry = entries[0]
            class Client:
                put_calls = 0
                def head_object(self, **_): return {}
                def get_object(self, **_):
                    return {"Body": BytesIO(b"different"), "ContentType": entry["content_type"], "CacheControl": entry["cache_control"]}
                def put_object(self, **_): self.put_calls += 1
            client = Client()
            with self.assertRaises(ValueError): PUBLISH.publish_immutable(client, "bucket", entry)
            self.assertEqual(client.put_calls, 0)

    def test_catalog_manifest_current_follow_all_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root, plan = self.make_payload(Path(temp))
            _, entries = PUBLISH.validate_plan(root, plan)
            payload = {entry["destination_key"]: entry["local_path"].read_bytes() for entry in entries}
            class Client:
                def head_object(self, **_): return {}
                def get_object(self, **kwargs):
                    entry = next(item for item in entries if item["destination_key"] == kwargs["Key"])
                    return {"Body": BytesIO(payload[kwargs["Key"]]), "ContentType": entry["content_type"], "CacheControl": entry["cache_control"], "ETag": '"same"'}
            recorded = []
            PUBLISH.publish_in_order(Client(), "bucket", entries, None, None, recorded.append)
            self.assertEqual([item["relative_path"] for item in recorded[-3:]], [entries[-3]["relative_path"], entries[-2]["relative_path"], "current.json"])

    def test_asset_failure_never_reaches_catalog_or_current(self):
        with tempfile.TemporaryDirectory() as temp:
            root, plan = self.make_payload(Path(temp))
            _, entries = PUBLISH.validate_plan(root, plan)
            class Client:
                def head_object(self, **_): return {}
                def get_object(self, **kwargs):
                    entry = next(item for item in entries if item["destination_key"] == kwargs["Key"])
                    bad = b"bad" if entry is entries[0] else entry["local_path"].read_bytes()
                    return {"Body": BytesIO(bad), "ContentType": entry["content_type"], "CacheControl": entry["cache_control"]}
            recorded = []
            with self.assertRaises(ValueError): PUBLISH.publish_in_order(Client(), "bucket", entries, None, None, recorded.append)
            self.assertNotIn(entries[-3]["relative_path"], [item["relative_path"] for item in recorded])
            self.assertNotIn("current.json", [item["relative_path"] for item in recorded])

    def test_installer_bad_current_preserves_old_pointer(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); target = base / "target"; target.mkdir()
            (target / "current.json").write_text("old-pointer")
            remote = base / "remote-current.json"; remote.write_text('{"version":"not-a-sha"}')
            aws = base / "fake-aws.sh"
            aws.write_text(f"#!/bin/sh\ncp {remote} \"$4\"\n")
            aws.chmod(0o755)
            args = SimpleNamespace(bucket="bucket", prefix="deploy-assets/jp-medical", target=target, aws=str(aws))
            with self.assertRaises(ValueError): INSTALL.install(args)
            self.assertEqual((target / "current.json").read_text(), "old-pointer")

    def test_installer_existing_immutable_conflict_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); root, _ = self.make_payload(base)
            version = "a" * 64
            remote = base / "remote/deploy-assets/jp-medical"; remote.parent.mkdir(parents=True)
            shutil.copytree(root, remote)
            target = base / "target"; (target / f"releases/{version}/details/t").mkdir(parents=True)
            (target / f"releases/{version}/details/t/000.json").write_bytes(b"different")
            (target / "current.json").write_text("old-pointer")
            aws = base / "fake-aws.sh"; aws.write_text('#!/bin/sh\ncp "$FAKE_REMOTE/${3#s3://bucket/}" "$4"\n'); aws.chmod(0o755)
            previous = os.environ.get("FAKE_REMOTE"); os.environ["FAKE_REMOTE"] = str(base / "remote")
            try:
                with self.assertRaises(ValueError): INSTALL.install(SimpleNamespace(bucket="bucket", prefix="deploy-assets/jp-medical", target=target, aws=str(aws)))
            finally:
                if previous is None: os.environ.pop("FAKE_REMOTE", None)
                else: os.environ["FAKE_REMOTE"] = previous
            self.assertEqual((target / "current.json").read_text(), "old-pointer")

    def test_installer_success_installs_verified_release_then_current(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); root, _ = self.make_payload(base); target = base / "target"
            prefix = "deploy-assets/jp-medical/"
            def fake_fetch(_aws, _bucket, key, destination):
                relative = key.removeprefix(prefix)
                self.assertNotEqual(relative, key)
                source = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
            with patch.object(INSTALL, "fetch", fake_fetch):
                INSTALL.install(SimpleNamespace(bucket="bucket", prefix=prefix, target=target, aws="unused"))
            version = "a" * 64
            self.assertEqual(json.loads((target / "current.json").read_text())["version"], version)
            self.assertEqual(INSTALL.digest(target / f"releases/{version}/details/t/000.json"), INSTALL.digest(root / f"releases/{version}/details/t/000.json"))
            self.assertEqual(INSTALL.digest(target / f"releases/{version}/catalog.json"), INSTALL.digest(root / f"releases/{version}/catalog.json"))

    def test_installer_bad_download_sha_keeps_old_current_and_release_absent(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); root, _ = self.make_payload(base); target = base / "target"; target.mkdir()
            (target / "current.json").write_text("old-pointer")
            prefix, bad_relative = "deploy-assets/jp-medical/", "releases/" + "a" * 64 + "/details/t/400.json"
            def fake_fetch(_aws, _bucket, key, destination):
                destination.parent.mkdir(parents=True, exist_ok=True)
                if key == prefix + bad_relative:
                    destination.write_bytes(b"bad")
                else:
                    shutil.copyfile(root / key.removeprefix(prefix), destination)
            with patch.object(INSTALL, "fetch", fake_fetch):
                with self.assertRaises(ValueError): INSTALL.install(SimpleNamespace(bucket="bucket", prefix=prefix, target=target, aws="unused"))
            self.assertEqual((target / "current.json").read_text(), "old-pointer")
            self.assertFalse((target / ("releases/" + "a" * 64)).exists())


if __name__ == "__main__":
    unittest.main()
