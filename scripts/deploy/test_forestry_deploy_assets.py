#!/usr/bin/env python3
"""Regression checks for the PMTiles-only forest reserve deployment."""
from __future__ import annotations

import hashlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESERVE_GEOJSON = ROOT / "public/forestry/forest_reserve.geojson"
RESERVE_PMTILES = ROOT / "public/forestry/forest_reserve.pmtiles"


class ForestryDeployAssetsTest(unittest.TestCase):
    def test_reserve_geojson_removed_but_pmtiles_are_unchanged(self):
        self.assertFalse(RESERVE_GEOJSON.exists())
        self.assertEqual(RESERVE_PMTILES.stat().st_size, 2_030_870)
        self.assertEqual(
            hashlib.sha256(RESERVE_PMTILES.read_bytes()).hexdigest(),
            "1f22e80b5e5e4dea9eef36f3e251d287f49d28966424d817729fbc2f251c77dc",
        )

    def test_deploy_scripts_do_not_upload_or_pull_retired_geojson(self):
        upload = (ROOT / "scripts/deploy/upload-deploy-assets.sh").read_text()
        pull = (ROOT / "scripts/deploy/pull-deploy-assets.sh").read_text()
        self.assertNotIn("public/forestry/forest_reserve.geojson", upload)
        self.assertIn('"public/forestry/forest_reserve.pmtiles"', upload)
        self.assertIn('aws s3 sync "$S3/forestry/" "$DATA_DIR/forestry/" --no-progress --exclude "forest_reserve.geojson"', pull)


if __name__ == "__main__":
    unittest.main()
