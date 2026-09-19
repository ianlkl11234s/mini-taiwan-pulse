#!/usr/bin/env python3
"""Export bounded, offline historical-flight-trails-v1 GeoJSON snapshots.

This reader never contacts FR24 or any cloud service.  It preserves each valid
source point, splitting rather than drawing through time gaps or the dateline.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

SCHEMA = "historical-flight-trails-v1"
GAP_SECONDS = 900
TW_AIRPORTS = [
    ("RCTP", "TPE", "桃園國際機場", [121.240396, 25.0714164]),
    ("RCSS", "TSA", "臺北松山機場", [121.5638071, 25.0631097]),
    ("RCKH", "KHH", "高雄國際機場", [120.3480347, 22.5707622]),
    ("RCNN", "TNN", "臺南機場", [120.2015138, 22.9578635]),
    ("RCBS", "KNH", "金門機場", [118.3745895, 24.4334812]),
    ("RCFG", "LZN", "馬祖南竿機場", [119.9572096, 26.1562878]),
    ("RCMT", "MFK", "馬祖北竿機場", [120.0042947, 26.2299502]),
    ("RCQC", "MZG", "澎湖機場", [119.6253791, 23.5647669]),
    ("RCWA", "WOT", "望安機場", [119.502778, 23.3675]),
    ("RCCM", "CMJ", "七美機場", [119.4182114, 23.2167233]),
    ("RCGI", "GNI", "綠島機場", [121.4644848, 22.6776574]),
    ("RCLY", "KYD", "蘭嶼機場", [121.5294307, 22.0325004]),
    ("RCMQ", "RMQ", "臺中國際機場", [120.5979796, 24.2509099]),
    ("RCYU", "HUN", "花蓮機場", [121.6102174, 24.0134205]),
    ("RCFN", "TTT", "臺東機場", [121.0902094, 22.7475502]),
    ("RCKU", "CYI", "嘉義機場", [120.3974937, 23.466721]),
    ("RCKW", "HCN", "恆春機場", [120.730003, 22.041944]),
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def local_date(timestamp: Any, timezone_name: str) -> str | None:
    if isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)) or timestamp <= 0:
        return None
    try:
        if not math.isfinite(timestamp):
            return None
    except OverflowError:
        return None
    try:
        return datetime.fromtimestamp(timestamp, timezone.utc).astimezone(ZoneInfo(timezone_name)).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def airport_country_index(airport_points: Path | None) -> dict[str, str]:
    if not airport_points or not airport_points.is_file():
        return {}
    payload = json.loads(airport_points.read_text(encoding="utf-8"))
    return {
        feature.get("properties", {}).get("icao"): feature.get("properties", {}).get("country")
        for feature in payload.get("features", [])
        if feature.get("properties", {}).get("icao") and feature.get("properties", {}).get("country")
    }


def airport_iata_index(airport_points: Path | None) -> dict[str, str]:
    if not airport_points or not airport_points.is_file():
        return {}
    payload = json.loads(airport_points.read_text(encoding="utf-8"))
    return {
        feature.get("properties", {}).get("icao"): feature.get("properties", {}).get("iata")
        for feature in payload.get("features", [])
        if feature.get("properties", {}).get("icao") and feature.get("properties", {}).get("iata")
    }


def japan_airports(airport_points: Path | None) -> list[tuple[str, str | None, str, list[float]]]:
    """Build the Japanese export scope from airport-points, or fail closed."""
    if not airport_points or not airport_points.is_file():
        raise ValueError("--airport-points is required to export the complete Japan airport scope")
    try:
        payload = json.loads(airport_points.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read airport-points: {airport_points}") from error
    features = payload.get("features")
    if not isinstance(features, list):
        raise ValueError("airport-points must be a GeoJSON FeatureCollection with features")

    airports: list[tuple[str, str | None, str, list[float]]] = []
    seen: set[str] = set()
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict) or properties.get("country") != "JP":
            continue
        geometry = feature.get("geometry")
        icao = properties.get("icao")
        if not isinstance(icao, str) or not icao.strip():
            raise ValueError("JP airport-points feature is missing properties.icao")
        icao = icao.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{4}", icao):
            raise ValueError(f"JP airport-points feature has invalid ICAO: {icao}")
        if icao in seen:
            raise ValueError(f"duplicate JP airport ICAO in airport-points: {icao}")
        if not isinstance(geometry, dict) or geometry.get("type") != "Point":
            raise ValueError(f"JP airport-points feature {icao} must have Point geometry")
        coordinates = geometry.get("coordinates")
        if (
            not isinstance(coordinates, list)
            or len(coordinates) < 2
            or any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in coordinates[:2])
            or not -180 <= coordinates[0] <= 180
            or not -90 <= coordinates[1] <= 90
        ):
            raise ValueError(f"JP airport-points feature {icao} has invalid Point coordinates")
        iata = properties.get("iata")
        if iata is not None and not isinstance(iata, str):
            raise ValueError(f"JP airport-points feature {icao} has invalid properties.iata")
        name = next((value.strip() for value in (properties.get("nameZh"), properties.get("nameEn"), properties.get("name")) if isinstance(value, str) and value.strip()), None)
        if name is None:
            raise ValueError(f"JP airport-points feature {icao} is missing nameZh, nameEn, and name")
        seen.add(icao)
        airports.append((icao, iata.strip().upper() if isinstance(iata, str) and iata.strip() else None, name, [float(coordinates[0]), float(coordinates[1])]))
    if not airports:
        raise ValueError("airport-points contains no valid JP airport features; refusing a partial Japan export")
    return sorted(airports, key=lambda airport: airport[0])


def route_scope(record: dict[str, Any], countries: dict[str, str]) -> str:
    origin = countries.get(record.get("origin_icao"))
    destination = countries.get(record.get("dest_icao_actual") or record.get("dest_icao"))
    if not origin or not destination:
        return "unknown"
    return "domestic" if origin == destination else "cross_border"


def valid_point(point: Any) -> tuple[float, float, float, int] | None:
    if not isinstance(point, list) or len(point) < 4:
        return None
    lat, lng, altitude, timestamp = point[:4]
    if not all(not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) for value in (lat, lng, altitude, timestamp)):
        return None
    if not -90 <= lat <= 90 or not -180 <= lng <= 180 or timestamp <= 0:
        return None
    return float(lat), float(lng), float(altitude), int(timestamp)


def split_path(points: Iterable[Any]) -> tuple[list[list[list[float]]], dict[str, int], int | None, int | None]:
    segments: list[list[list[float]]] = []
    current: list[list[float]] = []
    invalid = non_monotonic = singleton_count = gap_count = 0
    observed_start = observed_end = None
    previous: tuple[float, float, float, int] | None = None
    for raw in points:
        point = valid_point(raw)
        if point is None:
            invalid += 1
            if len(current) == 1:
                singleton_count += 1
            if current:
                current = []
            previous = None
            continue
        lat, lng, altitude, timestamp = point
        observed_start = timestamp if observed_start is None else min(observed_start, timestamp)
        observed_end = timestamp if observed_end is None else max(observed_end, timestamp)
        start_new = previous is None
        if previous is not None:
            _, previous_lng, _, previous_time = previous
            if timestamp <= previous_time:
                non_monotonic += 1
                start_new = True
            elif timestamp - previous_time > GAP_SECONDS:
                gap_count += 1
                start_new = True
            elif abs(lng - previous_lng) > 180:
                start_new = True
            if start_new and len(current) == 1:
                singleton_count += 1
        if start_new:
            current = []
            segments.append(current)
        current.append([lng, lat, altitude])
        previous = point
    if len(current) == 1:
        singleton_count += 1
    drawable = [segment for segment in segments if len(segment) >= 2]
    return drawable, {"invalid": invalid, "non_monotonic": non_monotonic, "singletons": singleton_count, "gaps": gap_count}, observed_start, observed_end


def event_roles(record: dict[str, Any], airport: str, date: str, timezone_name: str) -> list[str]:
    roles = []
    if record.get("origin_icao") == airport and local_date(record.get("dep_time"), timezone_name) == date:
        roles.append("departure")
    actual_destination = record.get("dest_icao_actual") or record.get("dest_icao")
    if actual_destination == airport and local_date(record.get("arr_time"), timezone_name) == date:
        roles.append("arrival")
    return roles


def feature_for_record(record: dict[str, Any], airport: str, date: str, timezone_name: str, countries: dict[str, str], iatas: dict[str, str] | None = None) -> dict[str, Any] | None:
    roles = event_roles(record, airport, date, timezone_name)
    if not roles:
        return None
    segments, quality, observed_start, observed_end = split_path(record.get("path") or [])
    if not segments:
        return None
    retained = sum(len(segment) for segment in segments)
    actual_destination = record.get("dest_icao_actual") or record.get("dest_icao")
    planned_destination = record.get("dest_icao")
    return {
        "type": "Feature",
        "geometry": {"type": "MultiLineString", "coordinates": segments},
        "properties": {
            "flight_id": record.get("fr24_id"), "callsign": record.get("callsign") or None,
            "flight_number": record.get("flight_number") or None, "operator": record.get("operating_as") or None,
            "aircraft_type": record.get("aircraft_type") or None, "origin_icao": record.get("origin_icao") or None,
            "origin_iata": record.get("origin_iata") or None,
            "planned_dest_icao": planned_destination or None, "dest_icao": actual_destination or None,
            "dest_iata": (iatas or {}).get(actual_destination) or (record.get("dest_iata") if actual_destination == planned_destination else None), "dep_time": record.get("dep_time") or None,
            "arr_time": record.get("arr_time") or None, "observed_start": observed_start, "observed_end": observed_end,
            "roles": roles, "route_scope": route_scope(record, countries), "gap_count": quality["gaps"],
            "invalid_point_count": quality["invalid"], "non_monotonic_count": quality["non_monotonic"],
            "source_point_count": len(record.get("path") or []), "retained_point_count": retained,
        },
    }


def load_deduplicated_records(source: Path) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        flight_id = record.get("fr24_id")
        if not flight_id:
            continue
        existing = by_id.get(flight_id)
        if existing is None or len(record.get("path") or []) > len(existing.get("path") or []):
            by_id[flight_id] = record
    return list(by_id.values())


def write_json(path: Path, payload: Any) -> tuple[int, str]:
    data = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return len(data), sha256_bytes(data)


def sample_specs(jp_airports: Iterable[tuple[str, str | None, str, list[float]]]) -> list[dict[str, str]]:
    rows = []
    for icao, _, _, _ in TW_AIRPORTS:
        rows.extend([
            {"country": "TW", "airport": icao, "date": "2026-02-20", "sample_kind": "special", "label": "春節特殊假期；非一般工作日或週末"},
            {"country": "TW", "airport": icao, "date": "2026-02-24", "sample_kind": "weekday", "label": "一般週二平日候選；僅呈現已觀測軌跡"},
            {"country": "TW", "airport": icao, "date": "2026-02-18", "sample_kind": "special", "label": "春節特殊假期；非一般工作日或週末"},
        ])
    for icao, _, _, _ in jp_airports:
        rows.append({"country": "JP", "airport": icao, "date": "2026-02-18", "sample_kind": "weekday", "label": "既有完整機場涵蓋日（週三）；僅呈現已觀測軌跡"})
    return rows


def export(source_root: Path, output_root: Path, release_id: str, airport_points: Path | None, generated_at: str | None = None) -> dict[str, Any]:
    countries = airport_country_index(airport_points)
    iatas = airport_iata_index(airport_points)
    jp_airport_specs = japan_airports(airport_points)
    airport_specs = [("TW", "Asia/Taipei", item) for item in TW_AIRPORTS] + [("JP", "Asia/Tokyo", item) for item in jp_airport_specs]
    timezone_by_airport = {item[2][0]: item[1] for item in airport_specs}
    source_inventory: dict[str, dict[str, Any]] = {}
    assets: list[dict[str, Any]] = []
    samples = []
    for spec in sample_specs(jp_airport_specs):
        airport, date = spec["airport"], spec["date"]
        source = source_root / airport / f"{date}.jsonl"
        base = {**spec, "asset": None, "flight_count": 0, "point_count": 0}
        if not source.is_file():
            base.update({"coverage": "unavailable", "note": "尚未收錄此機場／日期的軌跡；不代表當日沒有航班。"})
            samples.append(base)
            continue
        source_bytes = source.read_bytes()
        source_inventory[str(source)] = {"bytes": len(source_bytes), "sha256": sha256_bytes(source_bytes)}
        features = []
        eligible_source_points = retained_points = excluded_singletons = 0
        for record in load_deduplicated_records(source):
            if event_roles(record, airport, date, timezone_by_airport[airport]):
                _, quality, _, _ = split_path(record.get("path") or [])
                eligible_source_points += len(record.get("path") or [])
                excluded_singletons += quality["singletons"]
            feature = feature_for_record(record, airport, date, timezone_by_airport[airport], countries, iatas)
            if feature:
                features.append(feature)
                retained_points += feature["properties"]["retained_point_count"]
        point_count = retained_points
        if not features:
            base.update({"coverage": "unavailable", "note": "已收錄資料中沒有此機場當日可繪製的軌跡；不代表當日沒有航班。"})
            samples.append(base)
            continue
        relative = Path("releases") / release_id / f"{spec['country'].lower()}_{airport}_{date}.geojson"
        geojson = {"type": "FeatureCollection", "meta": {"country": spec["country"], "airport": airport, "date": date, "timezone": timezone_by_airport[airport], "coverage": "partial", "note": "僅含已觀測軌跡；來源查詢與逐航班完整度未驗證。"}, "features": features}
        bytes_count, digest = write_json(output_root / relative, geojson)
        base.update({"asset": {"path": str(relative).replace("\\", "/"), "bytes": bytes_count, "sha256": digest}, "flight_count": len(features), "point_count": point_count, "coverage": "partial", "note": geojson["meta"]["note"]})
        samples.append(base)
        assets.append({"path": str(relative).replace("\\", "/"), "bytes": bytes_count, "sha256": digest, "source": str(source), "source_bytes": len(source_bytes), "source_sha256": sha256_bytes(source_bytes), "flight_count": len(features), "source_point_count": eligible_source_points, "retained_point_count": retained_points, "excluded_singleton_count": excluded_singletons})
    manifest = {"schema": SCHEMA, "release_id": release_id, "generated_at": generated_at or iso_now(), "source": "Flightradar24 / plan-art", "license_status": "unverified", "airports": [{"icao": icao, "iata": iata, "name": name, "country": country, "timezone": timezone, "center": center} for country, timezone, (icao, iata, name, center) in airport_specs], "samples": samples}
    write_json(output_root / "manifest.json", manifest)
    totals = {"asset_count": len(assets), "asset_bytes": sum(item["bytes"] for item in assets), "source_point_count": sum(item["source_point_count"] for item in assets), "retained_point_count": sum(item["retained_point_count"] for item in assets), "excluded_singleton_count": sum(item["excluded_singleton_count"] for item in assets)}
    totals["retention_rate"] = totals["retained_point_count"] / totals["source_point_count"] if totals["source_point_count"] else None
    inventory = {"schema": SCHEMA, "release_id": release_id, "generated_at": manifest["generated_at"], "source_root": str(source_root), "summary": totals, "assets": assets, "source_files": source_inventory}
    inventory_path = output_root.parent.parent / "docs" / "features" / "historical-flight-trails" / "data-inventory.json"
    write_json(inventory_path, inventory)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True, help="plan-art dist/tracks/airports directory")
    parser.add_argument("--output-root", type=Path, required=True, help="public/flight-trails directory")
    parser.add_argument("--release-id", default="local-20260918")
    parser.add_argument("--airport-points", type=Path, default=None)
    parser.add_argument("--generated-at", default=None)
    args = parser.parse_args()
    manifest = export(args.source_root, args.output_root, args.release_id, args.airport_points, args.generated_at)
    print(json.dumps({"release_id": manifest["release_id"], "samples": len(manifest["samples"])}))


if __name__ == "__main__":
    main()
