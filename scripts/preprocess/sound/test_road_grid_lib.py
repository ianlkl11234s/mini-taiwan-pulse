"""road_grid_lib 單元測試：python3 -m unittest scripts/preprocess/sound/test_road_grid_lib.py（repo 根目錄）"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from road_grid_lib import (  # noqa: E402
    REASON_DAY_ZERO, REASON_GLITCH, REASON_LANE, REASON_STATUS, RoadGraph, VdRow, assign_section_pieces, base_road_name,
    clean_vd_day, extend_vds, parse_vd_id,
)


def row(slot, total, status=0, lanes=3, speed=None, occ=None):
    sp = (80.0 if total else 0.0) if speed is None else speed
    oc = (5.0 if total else 0.0) if occ is None else occ
    return VdRow(slot=slot, total=total, speed=sp, occ=oc, lanes=lanes, status=status)


class CleanVdDayTest(unittest.TestCase):
    def test_status_nonzero_is_unknown_not_zero(self):
        vals, reasons, st = clean_vd_day([row(0, 20), row(1, 0, status=1), row(2, 22)])
        self.assertEqual(vals[:3], [20, None, 22])
        self.assertEqual(reasons[REASON_STATUS], 1)
        self.assertEqual(st, "ok")

    def test_day_all_zero_is_unknown_whole_day(self):
        vals, reasons, st = clean_vd_day([row(i, 0) for i in range(144)])
        self.assertEqual(st, REASON_DAY_ZERO)
        self.assertTrue(all(v is None for v in vals))

    def test_night_zero_kept_glitch_dropped(self):
        rows = [row(0, 1), row(1, 0), row(2, 2), row(10, 30), row(11, 0), row(12, 28)]
        vals, reasons, _ = clean_vd_day(rows)
        self.assertEqual(vals[1], 0)  # 夜間前後都很小 → 保留真 0
        self.assertIsNone(vals[11])  # 前後都 ≥10 → 瞬斷
        self.assertEqual(reasons[REASON_GLITCH], 1)

    def test_per_lane_cap_and_duplicate_slot_max(self):
        vals, reasons, _ = clean_vd_day([row(5, 200, lanes=2), row(6, 10), row(6, 14)])
        self.assertIsNone(vals[5])
        self.assertEqual(reasons[REASON_LANE], 1)
        self.assertEqual(vals[6], 14)

    def test_missing_slot_is_none(self):
        vals, _, _ = clean_vd_day([row(0, 5)])
        self.assertIsNone(vals[143])


class ParseTest(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(parse_vd_id("VD-N1H-S-32.700-M-LOOP-五股轉接道"), ("N1H", "S", 32.7, "M"))
        self.assertEqual(parse_vd_id("VD-N1-N-49-I-EN-31A-桃園-平面")[3], "I")
        self.assertIsNone(parse_vd_id("V0111C0"))

    def test_base_name(self):
        self.assertEqual(base_road_name("重慶北路一段"), "重慶北路")
        self.assertEqual(base_road_name("忠孝東路 四段"), "忠孝東路")
        self.assertIsNone(base_road_name(None))


class AssignSectionTest(unittest.TestCase):
    # 一條正東向 10 km 直線，里程 0→10
    LINE = [[121.0, 25.0], [121.0 + 10_000 / (111_195 * 0.9063), 25.0]]

    def test_nearest_by_km_midpoint_split(self):
        pieces = assign_section_pieces(self.LINE, 0.0, 10.0, [(2.0, "A"), (6.0, "B")], max_gap_km=3.0)
        spans = [(round(a, 3), round(b, 3), v) for _, v, a, b in pieces]
        self.assertEqual(spans, [(0.0, 4.0, "A"), (4.0, 9.0, "B"), (9.0, 10.0, None)])

    def test_reverse_direction_section(self):
        # 北向路段：幾何從 10K 畫到 0K
        line = list(reversed(self.LINE))
        pieces = assign_section_pieces(line, 10.0, 0.0, [(5.0, "A")], max_gap_km=1.0)
        spans = [(round(a, 3), round(b, 3), v) for _, v, a, b in pieces]
        self.assertEqual(spans, [(0.0, 4.0, None), (4.0, 6.0, "A"), (6.0, 10.0, None)])
        piece = next(c for c, v, _, _ in pieces if v == "A")
        self.assertGreater(piece[0][0], piece[-1][0])  # 沿原幾何方向（往西）

    def test_no_vd_all_unknown(self):
        pieces = assign_section_pieces(self.LINE, 0.0, 10.0, [], max_gap_km=2.0)
        self.assertEqual([(v) for _, v, _, _ in pieces], [None])


def chain(n: int, step: float = 25.0) -> RoadGraph:
    g = RoadGraph()
    for i in range(n - 1):
        g.add_edge(i, i + 1, step)
    return g


class ExtendVdsTest(unittest.TestCase):
    def test_stops_at_next_vd_midpoint(self):
        g = chain(21)  # 0..20，每段 25 m
        out = extend_vds(g, [("A", 2), ("B", 18)], max_extend_m=1000)
        self.assertEqual(out[(9, 10)], "A")
        self.assertEqual(out[(10, 11)], "B")
        self.assertEqual(out[(0, 1)], "A")

    def test_stops_at_intersection(self):
        g = chain(21)
        g.intersections.add(6)
        out = extend_vds(g, [("A", 2)], max_extend_m=1000)
        self.assertEqual(out.get((5, 6)), "A")  # 延伸到路口為止（含進路口那段）
        self.assertNotIn((6, 7), out)  # 不穿過路口

    def test_seed_on_intersection_still_extends(self):
        g = chain(11)
        g.intersections.add(5)
        out = extend_vds(g, [("A", 5)], max_extend_m=1000)
        self.assertIn((4, 5), out)
        self.assertIn((5, 6), out)

    def test_max_extend(self):
        g = chain(41)
        out = extend_vds(g, [("A", 0)], max_extend_m=200)
        self.assertIn((7, 8), out)  # 175→200 m
        self.assertNotIn((8, 9), out)

    def test_other_road_not_reached(self):
        g = chain(5)
        g.add_edge(100, 101, 25)  # 不相連的另一段同名路
        out = extend_vds(g, [("A", 0)], max_extend_m=1000)
        self.assertNotIn((100, 101), out)


if __name__ == "__main__":
    unittest.main()
