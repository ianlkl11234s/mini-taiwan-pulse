import importlib.util
import hashlib
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

MODULE = Path(__file__).with_name("export_historical_flight_trails.py")
SPEC = importlib.util.spec_from_file_location("flight_export", MODULE)
flight_export = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(flight_export)


class HistoricalFlightTrailExportTests(unittest.TestCase):
    def record(self, **changes):
        base = {
            "fr24_id": "a",
            "origin_icao": "RCTP",
            "dest_icao": "RJTT",
            "dest_icao_actual": "RJTT",
            "dep_time": int(datetime(2026, 2, 24, 8, tzinfo=ZoneInfo("Asia/Taipei")).timestamp()),
            "arr_time": int(datetime(2026, 2, 24, 12, tzinfo=ZoneInfo("Asia/Tokyo")).timestamp()),
            "path": [[25, 121, 10, 100], [26, 122, 20, 200]],
        }
        base.update(changes)
        return base

    def airport_points_payload(self, jp_airports=None):
        jp_airports = jp_airports or [("RJTT", "HND", "羽田機場", [139.8097, 35.5331])]
        return {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"icao": "RCTP", "country": "TW", "iata": "TPE"}, "geometry": {"type": "Point", "coordinates": [121.24, 25.07]}},
                *[
                    {"type": "Feature", "properties": {"icao": icao, "iata": iata, "country": "JP", "nameZh": name}, "geometry": {"type": "Point", "coordinates": center}}
                    for icao, iata, name, center in jp_airports
                ],
            ],
        }

    def test_taiwan_sample_dates_order_and_semantics(self):
        taiwan_samples = [sample for sample in flight_export.sample_specs([]) if sample["country"] == "TW" and sample["airport"] == "RCTP"]
        self.assertEqual({sample["date"] for sample in taiwan_samples}, {"2026-02-20", "2026-02-24", "2026-02-18"})
        self.assertEqual([sample["date"] for sample in taiwan_samples], ["2026-02-20", "2026-02-24", "2026-02-18"])
        self.assertEqual(
            [(sample["sample_kind"], sample["label"]) for sample in taiwan_samples],
            [
                ("special", "春節特殊假期；非一般工作日或週末"),
                ("weekday", "一般週二平日候選；僅呈現已觀測軌跡"),
                ("special", "春節特殊假期；非一般工作日或週末"),
            ],
        )

    def test_tw_and_jst_event_days_and_actual_destination(self):
        record = self.record(
            dep_time=int(datetime(2026, 2, 24, 0, 30, tzinfo=ZoneInfo("Asia/Taipei")).timestamp()),
            arr_time=int(datetime(2026, 2, 24, 1, 30, tzinfo=ZoneInfo("Asia/Tokyo")).timestamp()),
            dest_icao="ZZZZ", dest_icao_actual="RJTT",
        )
        self.assertEqual(flight_export.event_roles(record, "RCTP", "2026-02-24", "Asia/Taipei"), ["departure"])
        self.assertEqual(flight_export.event_roles(record, "RJTT", "2026-02-24", "Asia/Tokyo"), ["arrival"])

    def test_missing_times_do_not_claim_roles(self):
        record = self.record(dep_time=0, arr_time=0)
        self.assertEqual(flight_export.event_roles(record, "RCTP", "2026-02-24", "Asia/Taipei"), [])

    def test_local_date_rejects_non_finite_boolean_and_out_of_range_values(self):
        for value in (True, float("nan"), float("inf"), 10**100):
            self.assertIsNone(flight_export.local_date(value, "Asia/Taipei"))

    def test_dateline_gap_invalid_and_non_monotonic_split_without_smoothing(self):
        points = [[1, 179, 0, 10], [1, -179, 0, 20], ["bad"], [2, 10, 0, 30], [2, 11, 0, 1000], [2, 12, 0, 900], [2, 13, 0, 1100], [2, 14, 0, 1200]]
        segments, quality, start, end = flight_export.split_path(points)
        self.assertEqual(quality["invalid"], 1)
        self.assertEqual(quality["non_monotonic"], 1)
        self.assertEqual(start, 10)
        self.assertEqual(end, 1200)
        self.assertEqual(segments, [[[12.0, 2.0, 0.0], [13.0, 2.0, 0.0], [14.0, 2.0, 0.0]]])

    def test_valid_point_rejects_boolean_coordinates_and_timestamp(self):
        self.assertIsNone(flight_export.valid_point([True, 121, 0, 1]))
        self.assertIsNone(flight_export.valid_point([25, 121, 0, False]))

    def test_deduplicates_by_fr24_id_using_longer_source_path(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "input.jsonl"
            source.write_text("\n".join(json.dumps(item) for item in [self.record(path=[[1, 1, 0, 1], [2, 2, 0, 2]]), self.record(path=[[1, 1, 0, 1], [2, 2, 0, 2], [3, 3, 0, 3]])]), encoding="utf-8")
            records = flight_export.load_deduplicated_records(source)
        self.assertEqual(len(records), 1)
        self.assertEqual(len(records[0]["path"]), 3)

    def test_feature_preserves_valid_points_and_unknown_route_scope(self):
        feature = flight_export.feature_for_record(self.record(dest_icao="ZZZZ", dest_icao_actual="RJTT", path=[[1, 1, 4, 1], [2, 2, 5, 2]]), "RCTP", "2026-02-24", "Asia/Taipei", {}, {"RJTT": "HND"})
        self.assertEqual(feature["geometry"]["coordinates"], [[[1.0, 1.0, 4.0], [2.0, 2.0, 5.0]]])
        self.assertEqual(feature["properties"]["route_scope"], "unknown")
        self.assertEqual(feature["properties"]["dest_icao"], "RJTT")
        self.assertEqual(feature["properties"]["planned_dest_icao"], "ZZZZ")
        self.assertEqual(feature["properties"]["dest_iata"], "HND")
        self.assertEqual(feature["properties"]["retained_point_count"], 2)

    def test_export_writes_utf8_hashed_immutable_asset_and_unavailable_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source_root = root / "source"
            (source_root / "RCTP").mkdir(parents=True)
            departure = int(datetime(2026, 2, 24, 8, tzinfo=ZoneInfo("Asia/Taipei")).timestamp())
            (source_root / "RCTP" / "2026-02-24.jsonl").write_text(json.dumps(self.record(dep_time=departure)), encoding="utf-8")
            airport_points = root / "airports.json"
            airport_points.write_text(json.dumps(self.airport_points_payload()), encoding="utf-8")
            output = root / "public" / "flight-trails"
            manifest = flight_export.export(source_root, output, "r1", airport_points, "2026-09-18T00:00:00Z")
            sample = next(item for item in manifest["samples"] if item["airport"] == "RCTP" and item["date"] == "2026-02-24")
            asset = output / sample["asset"]["path"]
            self.assertEqual(sample["asset"]["sha256"], hashlib.sha256(asset.read_bytes()).hexdigest())
            self.assertEqual(json.loads(asset.read_text(encoding="utf-8"))["type"], "FeatureCollection")
            self.assertEqual(next(item for item in manifest["samples"] if item["airport"] == "RCKW" and item["date"] == "2026-02-24")["coverage"], "unavailable")

    def test_existing_source_without_drawable_feature_is_unavailable_without_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source_root = root / "source"
            (source_root / "RCTP").mkdir(parents=True)
            departure = int(datetime(2026, 2, 24, 8, tzinfo=ZoneInfo("Asia/Taipei")).timestamp())
            (source_root / "RCTP" / "2026-02-24.jsonl").write_text(json.dumps(self.record(dep_time=departure, path=[[25, 121, 0, 1]])), encoding="utf-8")
            airport_points = root / "airports.json"
            airport_points.write_text(json.dumps(self.airport_points_payload()), encoding="utf-8")
            output = root / "public" / "flight-trails"
            manifest = flight_export.export(source_root, output, "r1", airport_points, "2026-09-18T00:00:00Z")
            sample = next(item for item in manifest["samples"] if item["airport"] == "RCTP" and item["date"] == "2026-02-24")
            self.assertEqual(sample["coverage"], "unavailable")
            self.assertIsNone(sample["asset"])
            self.assertEqual(sample["flight_count"], 0)
            self.assertEqual(sample["point_count"], 0)

    def test_japan_scope_uses_all_airport_points_in_icao_order_with_only_february_18(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            jp_airports = [(f"R{index:03d}", f"J{index:02d}", f"機場 {index}", [130 + index / 100, 30 + index / 100]) for index in range(78, 0, -1)]
            airport_points = root / "airports.json"
            airport_points.write_text(json.dumps(self.airport_points_payload(jp_airports)), encoding="utf-8")
            manifest = flight_export.export(root / "source", root / "public" / "flight-trails", "r1", airport_points, "2026-09-18T00:00:00Z")
        japan_airports = [airport for airport in manifest["airports"] if airport["country"] == "JP"]
        japan_samples = [sample for sample in manifest["samples"] if sample["country"] == "JP"]
        self.assertEqual(len(japan_airports), 78)
        self.assertEqual([airport["icao"] for airport in japan_airports], sorted(airport["icao"] for airport in japan_airports))
        self.assertEqual({sample["date"] for sample in japan_samples}, {"2026-02-18"})
        self.assertEqual([sample["airport"] for sample in japan_samples], [airport["icao"] for airport in japan_airports])
        self.assertTrue(all(sample["coverage"] == "unavailable" for sample in japan_samples))

    def test_japan_scope_fails_closed_without_airport_points_or_jp_features(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaisesRegex(ValueError, "airport-points"):
                flight_export.export(root / "source", root / "public" / "flight-trails", "r1", None)
            airport_points = root / "airports.json"
            airport_points.write_text(json.dumps({"type": "FeatureCollection", "features": []}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "no valid JP"):
                flight_export.export(root / "source", root / "public" / "flight-trails", "r1", airport_points)


if __name__ == "__main__":
    unittest.main()
