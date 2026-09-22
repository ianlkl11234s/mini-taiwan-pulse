import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).parent


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


PUBLISH = load("publish_jp_height_assets", "publish-jp-height-assets.py")
INSTALL = load("install_jp_height_assets", "install-jp-height-assets.py")


class JpHeightPublicationTest(unittest.TestCase):
    def make_root(self, root: Path):
        payload = b"pmtiles-test"
        sha = hashlib.sha256(payload).hexdigest()
        asset = root / "assets" / f"{sha}.pmtiles"
        asset.parent.mkdir(parents=True)
        asset.write_bytes(payload)
        catalog = {
            "schema": "jp-height-catalog-v1",
            "version": "test-v1",
            "regions": [{
                "id": "mesh-test",
                "status": "ready",
                "buildings": {"url": f"./jp-heights/assets/{sha}.pmtiles", "sha256": sha, "bytes": len(payload)},
            }],
        }
        (root / "catalog.json").write_text(json.dumps(catalog))
        return catalog, sha

    def test_publisher_uses_assets_then_catalog_last(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, sha = self.make_root(root)
            _, entries = PUBLISH.validate_catalog(root)
            self.assertEqual([item["relative_path"] for item in entries], [f"assets/{sha}.pmtiles", "catalog.json"])
            self.assertEqual(entries[0]["cache_control"], PUBLISH.IMMUTABLE_CACHE)
            self.assertEqual(entries[-1]["write_order"], "last")

    def test_publisher_rejects_filename_digest_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog, _ = self.make_root(root)
            catalog["regions"][0]["buildings"]["url"] = "./jp-heights/assets/" + "0" * 64 + ".pmtiles"
            (root / "catalog.json").write_text(json.dumps(catalog))
            with self.assertRaisesRegex(ValueError, "path/SHA mismatch"):
                PUBLISH.validate_catalog(root)

    def test_installer_rejects_non_allowlisted_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog, _ = self.make_root(root)
            catalog["regions"][0]["buildings"]["url"] = "./jp-heights/../secret.pmtiles"
            with self.assertRaisesRegex(ValueError, "asset contract invalid"):
                INSTALL.asset_records(catalog)

    def test_building_grid_budget_matches_browser_loader(self):
        catalog = {
            "schema": "jp-height-catalog-v1",
            "version": "test-v1",
            "regions": [{
                "id": "mesh-test",
                "grid": {
                    "url": f"./jp-heights/assets/{'0' * 64}.pmtiles",
                    "sha256": "0" * 64,
                    "bytes": 5 * 1024 * 1024 + 1,
                    "sourceLayer": "building_grid",
                },
            }],
        }
        with self.assertRaisesRegex(ValueError, "byte budget invalid"):
            PUBLISH._asset_records(catalog)
        with self.assertRaisesRegex(ValueError, "asset contract invalid"):
            INSTALL.asset_records(catalog)


if __name__ == "__main__":
    unittest.main()
