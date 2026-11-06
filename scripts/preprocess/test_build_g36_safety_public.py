#!/usr/bin/env python3
"""海巡射擊區角點封環（review F029）與職災自然人去識別（F031/F032）的離線測試。"""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


G36 = load("g36", "scripts/preprocess/build-g36-safety-public.py")
ATLAS = load("atlas", "scripts/preprocess/build-atlas-public.py")


class FiringRingTest(unittest.TestCase):
    def test_bow_tie_gets_reordered(self):
        bow = [[0, 0], [1, 1], [1, 0], [0, 1]]
        self.assertTrue(G36.ring_self_intersects(bow))
        self.assertFalse(G36.ring_self_intersects(G36.order_ring(bow)))

    def test_simple_concave_ring_untouched(self):
        concave = [[0, 0], [4, 0], [4, 4], [2, 1], [0, 4]]
        self.assertEqual(G36.order_ring(concave), concave)

    def test_committed_asset_has_no_bow_tie(self):
        data = json.loads((ROOT / "public/marine/firing_notice_areas.geojson").read_text(encoding="utf-8"))
        for f in data["features"]:
            if f["properties"]["agency"] == "coast_guard":
                self.assertFalse(G36.ring_self_intersects(f["geometry"]["coordinates"][0][:-1]), f["properties"]["title"])


class OccupationalPrivacyTest(unittest.TestCase):
    def test_lowercase_and_digit_masks_are_natural(self):
        for name in ["謝oo", "鄭00", "李００", "鄭00(即淦銀旺工程行)"]:
            self.assertTrue(ATLAS.employer_label(name)[1], name)

    def test_company_names_not_masked(self):
        for name in ["第100工程行", "大安生命禮儀企業社", "Foo Co"]:
            self.assertFalse(ATLAS.employer_label(name)[1], name)

    def test_place_address_stripped(self):
        self.assertEqual(ATLAS.scrub_place("嘉義縣民雄鄉成功街38號廠房屋頂"), "廠房屋頂")
        self.assertIsNone(ATLAS.scrub_place("桃園市大園區大海里建國11村129號之1"))
        self.assertEqual(ATLAS.scrub_place("施工架工作臺"), "施工架工作臺")


if __name__ == "__main__":
    unittest.main()
