"""radar_rain_lib 單元測試：python3 -m unittest scripts/preprocess/sound/test_radar_rain_lib.py（repo 根目錄）"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from radar_rain_lib import (  # noqa: E402
    CLUTTER_JUMP_DB, CLUTTER_MIN_DBZ, CLUTTER_NEIGHBOR_CELLS, RAIN_CLASS_EDGES_MM_H, UNKNOWN, clutter_mask, codes_to_class, dbz_to_rate,
)

ROWS, COLS = 30, 30


def code(dbz: float) -> int:
    return int(dbz) + 1


def frames(n: int, base: int = 0) -> np.ndarray:
    return np.full((n, ROWS * COLS), base, dtype=np.uint8)


def at(r: int, c: int) -> int:
    return r * COLS + c


class ClutterRuleTest(unittest.TestCase):
    def test_constants_are_the_documented_values(self) -> None:
        self.assertEqual((CLUTTER_MIN_DBZ, CLUTTER_JUMP_DB, CLUTTER_NEIGHBOR_CELLS), (45.0, 20.0, 8))

    def test_isolated_single_frame_strong_echo_is_flagged(self) -> None:
        f = frames(3, code(20))
        f[1, at(15, 15)] = code(60)
        m = clutter_mask(f, np.ones(3, bool), ROWS, COLS)
        self.assertTrue(m[1, at(15, 15)])
        self.assertEqual(int(m.sum()), 1)

    def test_echo_persisting_nearby_in_both_neighbour_frames_is_kept(self) -> None:
        # 真實雨胞 10 分鐘移動數格：前後幀在 ±8 格內仍有強回波 → 不標
        f = frames(3, code(20))
        f[0, at(15, 10)] = code(55)
        f[1, at(15, 15)] = code(60)
        f[2, at(15, 20)] = code(55)
        m = clutter_mask(f, np.ones(3, bool), ROWS, COLS)
        self.assertFalse(m.any())

    def test_requires_both_neighbours_low(self) -> None:
        f = frames(3, code(20))
        f[1, at(15, 15)] = code(60)
        f[2, at(15, 15)] = code(50)  # 後一幀還在 → 不是只出現一幀
        self.assertFalse(clutter_mask(f, np.ones(3, bool), ROWS, COLS).any())

    def test_neighbour_beyond_radius_does_not_save_it(self) -> None:
        f = frames(3, code(20))
        f[1, at(15, 15)] = code(60)
        f[0, at(15, 15 + CLUTTER_NEIGHBOR_CELLS + 1)] = code(58)
        f[2, at(15, 15 + CLUTTER_NEIGHBOR_CELLS + 1)] = code(58)
        self.assertTrue(clutter_mask(f, np.ones(3, bool), ROWS, COLS)[1, at(15, 15)])

    def test_below_min_dbz_is_never_flagged(self) -> None:
        f = frames(3, 0)
        f[1, at(5, 5)] = code(CLUTTER_MIN_DBZ - 1)
        self.assertFalse(clutter_mask(f, np.ones(3, bool), ROWS, COLS).any())

    def test_missing_neighbour_frame_or_day_edge_is_not_judged(self) -> None:
        f = frames(3, code(20))
        f[1, at(15, 15)] = code(60)
        f[0, at(3, 3)] = code(60)  # 第 0 幀（當日首幀）
        ok = np.array([True, True, False])  # 後一幀缺
        m = clutter_mask(f, ok, ROWS, COLS)
        self.assertFalse(m.any())


class ClassTest(unittest.TestCase):
    def test_unknown_passes_through_and_no_echo_is_class_zero(self) -> None:
        cls = codes_to_class(np.array([0, UNKNOWN, code(60)], dtype=np.uint8))
        self.assertEqual(cls[0], 0)
        self.assertEqual(cls[1], UNKNOWN)
        self.assertEqual(cls[2], 4)

    def test_class_edges_follow_shared_json(self) -> None:
        self.assertEqual(RAIN_CLASS_EDGES_MM_H, (0.5, 2.5, 10.0, 40.0))
        # 色塊中點換雨率後分級單調不減
        rates = dbz_to_rate(np.arange(66) + 0.5)
        self.assertTrue(np.all(np.diff(rates) > 0))
        classes = codes_to_class(np.arange(1, 67, dtype=np.uint8))
        self.assertTrue(np.all(np.diff(classes.astype(int)) >= 0))


if __name__ == "__main__":
    unittest.main()
