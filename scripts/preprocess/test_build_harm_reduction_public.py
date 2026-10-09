#!/usr/bin/env python3
"""Offline provenance tests for build-harm-reduction-public.py (F313/F320)."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("hr", ROOT / "scripts/preprocess/build-harm-reduction-public.py")
HR = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(HR)


class ProvenanceTest(unittest.TestCase):
    def test_composite_source_not_labelled_ogdl(self):
        org, url, lic, _ = HR.TREATMENT_SOURCES["mohw_maintenance_monthly_115|datagov_133353"]
        self.assertEqual(lic, HR.UNSPECIFIED)
        self.assertEqual(url, HR.MAINTENANCE_SOURCE_URL)
        self.assertIn("133353", org)  # 兩個來源都保留
        self.assertIn("月報", org)

    def test_joined_record_carries_separate_monthly_provenance(self):
        prov = HR.maintenance_provenance({"maintenance_month": "2026-08"})
        self.assertEqual(prov["maintenance_license"], HR.UNSPECIFIED)
        self.assertEqual(prov["maintenance_source_url"], HR.MAINTENANCE_SOURCE_URL)
        self.assertTrue(prov["maintenance_source_org"])

    def test_unjoined_record_has_no_monthly_provenance(self):
        prov = HR.maintenance_provenance({})
        self.assertTrue(all(v is None for v in prov.values()))


if __name__ == "__main__":
    unittest.main()
