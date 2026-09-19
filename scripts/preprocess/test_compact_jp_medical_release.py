#!/usr/bin/env python3
"""Offline contract tests for compact_jp_medical_release."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("compact", ROOT / "scripts/preprocess/compact_jp_medical_release.py")
COMPACT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(COMPACT)
BUILDER_SPEC = importlib.util.spec_from_file_location("builder", ROOT / "scripts/preprocess/build_jp_medical_static_payload.py")
BUILDER = importlib.util.module_from_spec(BUILDER_SPEC)
assert BUILDER_SPEC and BUILDER_SPEC.loader
BUILDER_SPEC.loader.exec_module(BUILDER)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class CompactReleaseTest(unittest.TestCase):
    def make_source(self, base: Path) -> Path:
        root = base / "source"; version = "a" * 64; release = root / "releases" / version
        files = {}
        for number, relative in enumerate(sorted(COMPACT.COMPACT_ASSET_PATHS | {"details/hours/00.json"})):
            data = f"asset-{number}".encode(); path = release / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            files[relative] = {"sha256": sha(data), "bytes": len(data)}
        catalog = {"version": version, "contract_version": 1, "status": "LOCAL_READY_NOT_DEPLOYED", "datasets": {"h17": {"grain": "service registration"}},
                   "geometry": {"role": "display"}, "allzoomcounts": {"h17": 2}, "files": files, "detail_buckets": {"old": 1},
                   "layers": [{"key": "h17_services", "detail_reference": {"path_template": "details/hours/{bucket}.json"}}, {"key": "a38", "pmtiles_path": "areas/A38-20_1.pmtiles"}]}
        (release / "catalog.json").write_text(json.dumps(catalog, separators=(",", ":")))
        raw = (release / "catalog.json").read_bytes()
        manifest = {"contract_version": 1, "version": version, "catalog": {"path": "catalog.json", "sha256": sha(raw), "bytes": len(raw)}, "files": files, "denylist": {"paths": ["private"]}}
        (release / "publication-manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
        (root / "current.json").write_text(json.dumps({"version": version, "catalog": f"releases/{version}/catalog.json", "publication_manifest": f"releases/{version}/publication-manifest.json"}, separators=(",", ":")))
        return root

    def test_compacts_exact_assets_preserving_source_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            source = self.make_source(Path(temp)); before = (source / "current.json").read_bytes(); output = Path(temp) / "output"
            result = COMPACT.compact(source, output)
            self.assertEqual(result["files"], 7); self.assertEqual((source / "current.json").read_bytes(), before)
            pointer = json.loads((output / "current.json").read_text()); catalog = json.loads((output / pointer["catalog"]).read_text()); manifest = json.loads((output / pointer["publication_manifest"]).read_text())
            self.assertEqual(set(catalog["files"]), COMPACT.COMPACT_ASSET_PATHS); self.assertEqual(catalog["files"], manifest["files"])
            self.assertEqual(catalog["datasets"]["h17"]["grain"], "service registration"); self.assertEqual(catalog["geometry"], {"role": "display"}); self.assertEqual(catalog["allzoomcounts"], {"h17": 2})
            self.assertEqual(catalog["detail_buckets"], {}); self.assertTrue(all(item.get("detail_reference") is None for item in catalog["layers"]))
            plan = Path(temp) / "publication-plan.json"; BUILDER.write_publication_plan(output, plan)
            self.assertEqual(len(json.loads(plan.read_text())["entries"]), 10)

    def test_rejects_bad_source_asset_sha_without_pointer_mutation(self):
        with tempfile.TemporaryDirectory() as temp:
            source = self.make_source(Path(temp)); output = Path(temp) / "output"; version = "a" * 64
            (source / "releases" / version / "points/navii_facilities.pmtiles").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "source asset digest mismatch"):
                COMPACT.compact(source, output)
            self.assertFalse((output / "current.json").exists())

    def test_rejects_unsafe_source_current_path(self):
        with tempfile.TemporaryDirectory() as temp:
            source = self.make_source(Path(temp)); current = json.loads((source / "current.json").read_text()); current["catalog"] = "releases/../catalog.json"; (source / "current.json").write_text(json.dumps(current))
            with self.assertRaisesRegex(ValueError, "path traversal"):
                COMPACT.compact(source, Path(temp) / "output")

    def test_refuses_existing_output_pointer(self):
        with tempfile.TemporaryDirectory() as temp:
            source = self.make_source(Path(temp)); output = Path(temp) / "output"; output.mkdir(); (output / "current.json").write_text("existing")
            with self.assertRaises(FileExistsError):
                COMPACT.compact(source, output)


if __name__ == "__main__":
    unittest.main()
