#!/usr/bin/env python3
"""Create the first local-only Japan medical static payload from reviewed artifacts.

It deliberately accepts only Navii five facility kinds, H17 care registrations, and
the three reviewed A38 display PMTiles.  It never reads raw/private source trees or
downloads data.  Counts in aggregate GeoJSON are calculated before tiling, so they
remain the denominator even when a map view renders a subset of point tiles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path


DEFAULT_SOURCE = Path("/private/tmp/jp-medical-ready-20260913/analytics/data/processed/world/jp_medical_frontend")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "public" / "jp-medical"
DEFAULT_PUBLICATION_PLAN = Path(__file__).resolve().parents[2] / "docs" / "features" / "jp-medical-static" / "payload-publication-plan.json"
NAVII_KINDS = ("hospital", "clinic", "dental", "maternity", "pharmacy")
DETAIL_KINDS = ("hospital", "clinic", "dental")
PRIVATE_PATH_TOKENS = ("_private", "raw", "private_rows", "representative")
POINT_LAYER_NAMES = {"navii": "navii_facilities", "h17": "h17_services"}
NAVII_QA_KEYS = {"hospital": "hospital_facility", "clinic": "clinic_facility", "dental": "dental_facility", "maternity": "maternity", "pharmacy": "pharmacy"}


def read(path: Path):
    return json.loads(path.read_text())


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mercator_cell(lon: float, lat: float, zoom: int = 6):
    n = 1 << zoom
    x = min(n - 1, max(0, int((lon + 180.0) / 360.0 * n)))
    lat = min(85.05112878, max(-85.05112878, lat))
    y = min(n - 1, max(0, int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)))
    return zoom, x, y


def cell_geometry(cell):
    zoom, x, y = cell
    n = 1 << zoom
    west, east = x / n * 360.0 - 180.0, (x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return {"type": "Polygon", "coordinates": [[[west, south], [east, south], [east, north], [west, north], [west, south]]]}


def feature(geometry, properties):
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def as_feature_collection(features):
    return {"type": "FeatureCollection", "features": features}


def run(command):
    subprocess.run(command, check=True)


def make_pmtiles(ndjson: Path, output: Path, source_layer: str, temp: Path):
    mbtiles = temp / f"{source_layer}.mbtiles"
    run([
        "tippecanoe", "--force", "--read-parallel", "--quiet", "--layer", source_layer,
        "--minimum-zoom", "0", "--maximum-zoom", "14", "--no-feature-limit",
        "--no-tile-size-limit", "--output", str(mbtiles), str(ndjson),
    ])
    run(["pmtiles", "--quiet", "convert", str(mbtiles), str(output)])
    run(["pmtiles", "--quiet", "verify", str(output)])


def copy_details(source_release: Path, nav_index: dict, staging: Path, files: dict):
    detail_index = {}
    for kind in DETAIL_KINDS:
        schema = read(source_release / "public-schemas" / f"{kind}_hours.json")
        allowed_row_fields = set(schema["source_columns"])
        schema_rel = Path("details") / "schemas" / f"{kind}_hours.json"
        schema_destination = staging / schema_rel
        schema_destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_release / "public-schemas" / f"{kind}_hours.json", schema_destination)
        files[str(schema_rel)] = {"sha256": sha256(schema_destination), "bytes": schema_destination.stat().st_size}
        entries = nav_index["service_details"][f"{kind}_hours"]
        bucket_entries = {}
        for bucket, entry in sorted(entries.items()):
            source = source_release / entry["path"]
            destination_rel = Path("details") / f"{kind}_hours" / f"{bucket}.json"
            destination = staging / destination_rel
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            actual_sha = sha256(destination)
            if actual_sha != entry["sha256"] or destination.stat().st_size != entry["bytes"]:
                raise ValueError(f"detail copy mismatch: {kind}/{bucket}")
            detail = read(destination)
            if set(detail) != {"bucket", "bucket_algorithm", "record_kind", "rows"} or detail["record_kind"] != f"{kind}_hours":
                raise ValueError(f"detail envelope allowlist mismatch: {kind}/{bucket}")
            if any(set(row) - allowed_row_fields for row in detail["rows"]):
                raise ValueError(f"detail row field allowlist mismatch: {kind}/{bucket}")
            files[str(destination_rel)] = {"sha256": actual_sha, "bytes": destination.stat().st_size}
            bucket_entries[bucket] = {"path": str(destination_rel), "sha256": actual_sha, "bytes": destination.stat().st_size, "rows": entry["rows"]}
        detail_index[f"{kind}_hours"] = bucket_entries
    return detail_index


def build(source_root: Path, output_root: Path):
    current = read(source_root / "current.json")
    source_release = source_root / current["catalog"]
    source_release = source_release.parent
    source_catalog = read(source_release / "catalog.json")
    nav_index = read(source_release / "navii" / "public-index.json")
    world_root = source_root.parent
    nav_current = read(world_root / "jp_medical_navii" / "current.json")
    nav_release = world_root / "jp_medical_navii" / nav_current["release_path"]
    nav_manifest = read(nav_release / "_manifest.json")
    h17_current = read(source_release / "care" / "current.json")
    h17_release = source_release / "care" / h17_current["release_path"]
    areas_catalog = read(source_release / "areas" / "catalog.json")

    output_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jp-medical-static-", dir=output_root) as temp_dir:
        temp = Path(temp_dir)
        staging = temp / "payload"
        staging.mkdir()
        files = {}
        nav_grid = Counter()
        h17_grid = Counter()
        nav_mapped = Counter()
        h17_mapped = Counter()
        seen_navii = {kind: set() for kind in NAVII_KINDS}
        h17_seen = set()
        nav_ndjson = temp / "navii.ndjson"
        h17_ndjson = temp / "h17.ndjson"

        with nav_ndjson.open("w") as nav_out:
            for kind in NAVII_KINDS:
                for prefecture, entry in sorted(nav_index["shards"][kind].items()):
                    data = read(source_release / "navii" / entry["path"])
                    for item in data["features"]:
                        props = item["properties"]
                        source_id = props["source_id"]
                        if source_id in seen_navii[kind]:
                            raise ValueError(f"Navii duplicate source_id: {kind}/{source_id}")
                        seen_navii[kind].add(source_id)
                        lon, lat = item["geometry"]["coordinates"]
                        cell = mercator_cell(lon, lat)
                        nav_grid[(cell, kind)] += 1
                        nav_mapped[kind] += 1
                        allow = {key: props[key] for key in ("source_id", "name", "address", "prefecture_code", "municipality_code", "record_kind", "detail_bucket", "snapshot_date", "source", "website") if key in props}
                        nav_out.write(json.dumps(feature(item["geometry"], allow), ensure_ascii=False, separators=(",", ":")) + "\n")

        with h17_ndjson.open("w") as h17_out:
            for entry in h17_current["shards"]:
                for line in (h17_release / entry["path"]).open():
                    row = json.loads(line)
                    key = (row["establishment_id"], row["service_type"], row["prefecture_code"], row["source_row"])
                    if key in h17_seen:
                        raise ValueError(f"H17 duplicate service registration: {key}")
                    h17_seen.add(key)
                    lon, lat = row["longitude"], row["latitude"]
                    cell = mercator_cell(lon, lat)
                    h17_grid[(cell, row["service_type"])] += 1
                    h17_mapped[row["service_type"]] += 1
                    allow = {key: row[key] for key in ("establishment_id", "name", "address", "prefecture_code", "prefecture_name", "municipality_name", "service_type", "source_id", "source_snapshot_day", "geometry_status")}
                    h17_out.write(json.dumps(feature({"type": "Point", "coordinates": [lon, lat]}, allow), ensure_ascii=False, separators=(",", ":")) + "\n")

        (staging / "points").mkdir()
        make_pmtiles(nav_ndjson, staging / "points/navii_facilities.pmtiles", POINT_LAYER_NAMES["navii"], temp)
        make_pmtiles(h17_ndjson, staging / "points/h17_services.pmtiles", POINT_LAYER_NAMES["h17"], temp)
        for rel in ("points/navii_facilities.pmtiles", "points/h17_services.pmtiles"):
            path = staging / rel
            files[rel] = {"sha256": sha256(path), "bytes": path.stat().st_size}

        invalid_navii = nav_manifest["qa"]["invalid_coordinate_rows"]
        nav_features = []
        for (cell, kind), count in sorted(nav_grid.items()):
            nav_features.append(feature(cell_geometry(cell), {
                "grid_id": f"z{cell[0]}-{cell[1]}-{cell[2]}", "grid_zoom": cell[0], "record_kind": kind,
                "mapped_point_count": count, "source_record_count": nav_mapped[kind] + invalid_navii[NAVII_QA_KEYS[kind]],
                "excluded_no_coordinate_count": invalid_navii[NAVII_QA_KEYS[kind]],
            }))
        h17_features = []
        for (cell, service_type), count in sorted(h17_grid.items()):
            h17_features.append(feature(cell_geometry(cell), {
                "grid_id": f"z{cell[0]}-{cell[1]}-{cell[2]}", "grid_zoom": cell[0], "service_type": service_type,
                "mapped_service_registration_count": count, "source_record_count": h17_current["source_row_count"],
                "excluded_no_coordinate_count": h17_current["nonspatial_record_count"], "duplicate_quarantine_count": h17_current["duplicate_quarantine_count"],
            }))
        write(staging / "aggregates/navii-z6.geojson", as_feature_collection(nav_features))
        write(staging / "aggregates/h17-z6.geojson", as_feature_collection(h17_features))
        for rel in ("aggregates/navii-z6.geojson", "aggregates/h17-z6.geojson"):
            path = staging / rel
            files[rel] = {"sha256": sha256(path), "bytes": path.stat().st_size}

        details = copy_details(source_release / "navii", nav_index, staging, files)
        for area in areas_catalog["layers"]:
            source = source_release / "areas" / area["display_path"]
            rel = Path("areas") / area["display_path"]
            destination = staging / rel
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            files[str(rel)] = {"sha256": sha256(destination), "bytes": destination.stat().st_size}

        for rel in files:
            if any(token in Path(rel).parts or token in rel.lower() for token in PRIVATE_PATH_TOKENS):
                raise ValueError(f"private denylist path: {rel}")
        nav_totals = {kind: {"mapped_point_count": nav_mapped[kind], "source_record_count": nav_mapped[kind] + invalid_navii[NAVII_QA_KEYS[kind]], "excluded_no_coordinate_count": invalid_navii[NAVII_QA_KEYS[kind]], "unique_source_id_count": len(seen_navii[kind])} for kind in NAVII_KINDS}
        catalog_without_version = {
            "contract_version": 1,
            "status": "LOCAL_READY_NOT_DEPLOYED",
            "datasets": {
                "navii": {"source_date": nav_current["snapshot_date"], "source": "MHLW Navii open data", "license": source_catalog["datasets"]["jp_medical_navii"]["license"], "grain": "source facility row", "coverage": {"maternity_missing_prefecture_codes": ["36", "47"]}, "national_totals": nav_totals},
                "h17": {"source_date": h17_current["source_file_day"], "source": "H17", "source_url": source_catalog["datasets"]["jp_long_term_care_establishments"]["source_url"], "license_url": source_catalog["datasets"]["jp_long_term_care_establishments"]["license_url"], "status": "SOURCE_SNAPSHOT", "grain": "service registration; multiple services at one establishment remain separate", "service_types": sorted(h17_mapped), "national_totals": {"source_record_count": h17_current["source_row_count"], "mapped_service_registration_count": len(h17_seen), "excluded_no_coordinate_count": h17_current["nonspatial_record_count"], "duplicate_quarantine_count": h17_current["duplicate_quarantine_count"], "service_type_count": len(h17_mapped)}},
                "a38": {"source_date": "2020", "status": "STALE", "source": areas_catalog["attribution"], "license_url": areas_catalog["license_url"], "grain": "source geometry part; do not use PMTiles feature count as medical-area count"},
            },
            "layers": [
                {"key": "navii_facilities", "kind_codes": list(NAVII_KINDS), "pmtiles_path": "points/navii_facilities.pmtiles", "source_layer": POINT_LAYER_NAMES["navii"], "minimum_point_zoom": 10, "aggregate_path": "aggregates/navii-z6.geojson", "detail_reference": {"algorithm": "sha256(source_id UTF-8)[:2]", "path_template": "details/{record_kind}_hours/{bucket}.json", "filter_field": "ID", "cardinality": "one_to_many", "unavailable_kinds": ["maternity", "pharmacy"]}},
                {"key": "h17_services", "pmtiles_path": "points/h17_services.pmtiles", "source_layer": POINT_LAYER_NAMES["h17"], "minimum_point_zoom": 10, "aggregate_path": "aggregates/h17-z6.geojson", "detail_reference": None},
            ] + [{"key": f"a38_{area['name'].rsplit('_', 1)[-1]}", "pmtiles_path": f"areas/{area['display_path']}", "source_layer": area["source_layer"], "status": "STALE", "source_date": "2020", "grain": "source geometry part"} for area in areas_catalog["layers"]],
            "detail_buckets": details,
            "files": dict(sorted(files.items())),
            "publication": {"scope": "local-only; no upload or deployment", "cache_policy": {"immutable_assets": "public, max-age=31536000, immutable", "current_pointer": "public, max-age=60"}},
        }
        version = hashlib.sha256(json.dumps(catalog_without_version, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        catalog = {"version": version, **catalog_without_version}
        write(staging / "catalog.json", catalog)
        catalog_meta = {"sha256": sha256(staging / "catalog.json"), "bytes": (staging / "catalog.json").stat().st_size}
        manifest = {"contract_version": 1, "version": version, "catalog": {"path": "catalog.json", **catalog_meta}, "files": dict(sorted(files.items())), "denylist": {"paths": list(PRIVATE_PATH_TOKENS), "result": "PASS"}, "total_payload_bytes": sum(meta["bytes"] for meta in files.values()) + catalog_meta["bytes"], "status": "LOCAL_READY_NOT_DEPLOYED"}
        write(staging / "publication-manifest.json", manifest)
        destination = output_root / "releases" / version
        if destination.exists():
            raise FileExistsError(f"immutable release already exists: {destination}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging, destination)
        pointer = {"contract_version": 1, "status": "LOCAL_READY_NOT_DEPLOYED", "version": version, "catalog": f"releases/{version}/catalog.json", "publication_manifest": f"releases/{version}/publication-manifest.json"}
        write(output_root / "current.json", pointer)
        print(json.dumps({"version": version, "path": str(destination), "files": len(files), "payload_bytes": manifest["total_payload_bytes"], "navii_points": sum(nav_mapped.values()), "h17_points": len(h17_seen)}, ensure_ascii=False))


def content_type(path: str) -> str:
    if path.endswith(".pmtiles"):
        return "application/vnd.pmtiles"
    if path.endswith(".geojson"):
        return "application/geo+json"
    return "application/json"


def write_publication_plan(output_root: Path, plan_path: Path):
    """Materialize the exact local-only upload order without modifying a release."""
    current_path = output_root / "current.json"
    current = read(current_path)
    release = output_root / Path(current["catalog"]).parent
    manifest_path = release / "publication-manifest.json"
    manifest = read(manifest_path)
    if current["version"] != manifest["version"]:
        raise ValueError("current pointer/version mismatch")
    entries = []
    for relative_path, metadata in sorted(manifest["files"].items()):
        entries.append({
            "relative_path": f"releases/{current['version']}/{relative_path}",
            "sha256": metadata["sha256"],
            "bytes": metadata["bytes"],
            "destination_key": f"deploy-assets/jp-medical/releases/{current['version']}/{relative_path}",
            "content_type": content_type(relative_path),
            "cache_control": "public, max-age=31536000, immutable",
        })
    for filename in ("catalog.json", "publication-manifest.json"):
        path = release / filename
        entries.append({
            "relative_path": f"releases/{current['version']}/{filename}",
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
            "destination_key": f"deploy-assets/jp-medical/releases/{current['version']}/{filename}",
            "content_type": "application/json",
            "cache_control": "public, max-age=31536000, immutable",
        })
    entries.append({
        "relative_path": "current.json",
        "sha256": sha256(current_path),
        "bytes": current_path.stat().st_size,
        "destination_key": "deploy-assets/jp-medical/current.json",
        "content_type": "application/json",
        "cache_control": "public, max-age=60",
        "write_order": "last",
    })
    if len(entries) != len(manifest["files"]) + 3:
        raise ValueError("publication plan count mismatch")
    plan = {
        "contract_version": 1,
        "status": "LOCAL_READY_NOT_DEPLOYED",
        "version": current["version"],
        "destination_prefix": "deploy-assets/jp-medical/",
        "write_order": "entries are ordered; current.json must be written last after immutable readback",
        "entries": entries,
        "total_all_publication_bytes": sum(entry["bytes"] for entry in entries),
        "source_manifest": {"relative_path": current["publication_manifest"], "sha256": sha256(manifest_path), "bytes": manifest_path.stat().st_size},
    }
    write(plan_path, plan)
    print(json.dumps({"publication_plan": str(plan_path), "entries": len(entries), "total_all_publication_bytes": plan["total_all_publication_bytes"]}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--write-publication-plan", action="store_true")
    parser.add_argument("--plan-path", type=Path, default=DEFAULT_PUBLICATION_PLAN)
    args = parser.parse_args()
    if args.write_publication_plan:
        write_publication_plan(args.output_root, args.plan_path)
    else:
        build(args.source_root, args.output_root)


if __name__ == "__main__":
    main()
