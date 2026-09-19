from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("promote_density", ROOT / "scripts/preprocess/promote_jp_medical_density.py")
PROMOTE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(PROMOTE)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class PromoteMedicalDensityTest(unittest.TestCase):
    def make_base(self, base: Path) -> Path:
        root = base / "jp-medical"; version = "a" * 64; release = root / "releases" / version
        files = {}
        paths = {
            "aggregates/navii-z6.geojson", "aggregates/h17-z6.geojson",
            "points/navii_facilities.pmtiles", "points/h17_services.pmtiles",
            "areas/A38-20_1.pmtiles", "areas/A38-20_2.pmtiles", "areas/A38-20_3.pmtiles",
        }
        for index, relative in enumerate(sorted(paths)):
            data = f"asset-{index}".encode(); path = release / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            files[relative] = {"sha256": sha(data), "bytes": len(data)}
        catalog = {
            "version": version, "contract_version": 1, "status": "LOCAL_READY_NOT_DEPLOYED", "files": files,
            "datasets": {"navii": {}, "h17": {}}, "detail_buckets": {},
            "layers": [
                {"key": "navii_facilities", "aggregate_path": "aggregates/navii-z6.geojson", "detail_reference": None},
                {"key": "h17_services", "aggregate_path": "aggregates/h17-z6.geojson", "detail_reference": None},
            ],
        }
        (release / "catalog.json").write_text(json.dumps(catalog, separators=(",", ":")))
        raw = (release / "catalog.json").read_bytes()
        manifest = {"contract_version": 1, "version": version, "catalog": {"path": "catalog.json", "sha256": sha(raw), "bytes": len(raw)}, "files": files, "denylist": {"paths": ["private"]}}
        (release / "publication-manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
        (root / "current.json").write_text(json.dumps({"version": version, "catalog": f"releases/{version}/catalog.json", "publication_manifest": f"releases/{version}/publication-manifest.json"}))
        return root

    def grid(self, path: Path, spec: dict) -> None:
        properties = {
            "grid_id": "J10000_0_0", "grid_size_m": 10_000, "grid_crs": "EPSG:6933",
            "aggregate_schema": "category_columns_v1", **spec["category_counts"],
            spec["count_field"]: sum(spec["category_counts"].values()),
        }
        path.write_text(json.dumps({"type": "FeatureCollection", "features": [{
            "type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}, "properties": properties,
        }]}))

    def test_promotes_exact_density_assets_and_preserves_base_release(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self.make_base(Path(temp)); before = (root / "current.json").read_bytes()
            navii, h17 = Path(temp) / "navii.geojson", Path(temp) / "h17.geojson"
            self.grid(navii, PROMOTE.GRID_SPECS["navii_facilities"]); self.grid(h17, PROMOTE.GRID_SPECS["h17_services"])
            result = PROMOTE.promote(root, navii, h17, "a" * 64, True)
            self.assertEqual(result["files"], 7); self.assertNotEqual((root / "current.json").read_bytes(), before)
            pointer = json.loads((root / "current.json").read_text()); catalog = json.loads((root / pointer["catalog"]).read_text())
            self.assertIn("aggregates/navii-density-10km.geojson", catalog["files"])
            self.assertNotIn("aggregates/navii-z6.geojson", catalog["files"])
            self.assertTrue(all(layer["aggregate_schema"] == "category_columns_v1" for layer in catalog["layers"]))
            self.assertTrue((root / "releases" / ("a" * 64) / "aggregates/navii-z6.geojson").exists())
            manifest = json.loads((root / pointer["publication_manifest"]).read_text())
            self.assertEqual(set(manifest["files"]), {"aggregates/navii-density-10km.geojson", "aggregates/h17-density-10km.geojson"})
            self.assertEqual(len(manifest["inherited_files"]), 5)
            self.assertTrue(all(item["source_version"] == "a" * 64 for item in manifest["inherited_files"].values()))

    def test_rejects_nonconserving_category_counts_without_pointer_mutation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self.make_base(Path(temp)); before = (root / "current.json").read_bytes()
            navii, h17 = Path(temp) / "navii.geojson", Path(temp) / "h17.geojson"
            self.grid(navii, PROMOTE.GRID_SPECS["navii_facilities"]); self.grid(h17, PROMOTE.GRID_SPECS["h17_services"])
            payload = json.loads(navii.read_text()); payload["features"][0]["properties"]["hospital_count"] -= 1; navii.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ValueError, "cell total"):
                PROMOTE.promote(root, navii, h17, "a" * 64, True)
            self.assertEqual((root / "current.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
