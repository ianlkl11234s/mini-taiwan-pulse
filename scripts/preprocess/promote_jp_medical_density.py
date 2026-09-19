#!/usr/bin/env python3
"""Promote reviewed 10 km density grids into a new immutable medical release.

The installed compact release supplies unchanged point and A38 assets.  This
utility replaces only the two legacy z6 aggregate files, validates count
conservation and schema, and writes a content-addressed candidate release.  It
does not upload anything; the mutable local pointer changes only with
``--activate-local``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path

GRID_SPECS = {
    "navii_facilities": {
        "relative": "aggregates/navii-density-10km.geojson",
        "count_field": "mapped_point_count",
        "category_counts": {
            "hospital_count": 7_447,
            "clinic_count": 75_190,
            "dental_count": 51_384,
            "maternity_count": 1_684,
            "pharmacy_count": 54_095,
        },
    },
    "h17_services": {
        "relative": "aggregates/h17-density-10km.geojson",
        "count_field": "mapped_service_registration_count",
        "category_counts": {
            "planning_count": 36_156,
            "home_visit_count": 61_801,
            "day_services_count": 53_207,
            "residential_count": 51_593,
            "combined_count": 6_513,
            "equipment_count": 12_924,
        },
    },
}
HEX = re.compile(r"^[0-9a-f]{64}$")


def read(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def write_atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(temporary, path)


def digest(path: Path) -> tuple[str, int]:
    value, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
            size += len(block)
    return value.hexdigest(), size


def count(value: object, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"density grid has invalid {label}")
    return value


def validate_grid(path: Path, spec: dict) -> dict:
    payload = read(path)
    features = payload.get("features")
    if payload.get("type") != "FeatureCollection" or not isinstance(features, list) or not features:
        raise ValueError("density grid must be a nonempty FeatureCollection")
    category_totals = {field: 0 for field in spec["category_counts"]}
    total, seen = 0, set()
    for feature in features:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        geometry = feature.get("geometry") if isinstance(feature, dict) else None
        if (feature.get("type") != "Feature" or not isinstance(properties, dict)
                or not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}):
            raise ValueError("density grid feature schema mismatch")
        grid_id = properties.get("grid_id")
        if not isinstance(grid_id, str) or grid_id in seen:
            raise ValueError("density grid_id is missing or duplicated")
        seen.add(grid_id)
        if (properties.get("grid_size_m") != 10_000 or properties.get("grid_crs") != "EPSG:6933"
                or properties.get("aggregate_schema") != "category_columns_v1"):
            raise ValueError("density grid CRS/size/schema mismatch")
        cell_total = 0
        for field in category_totals:
            value = count(properties.get(field), field)
            category_totals[field] += value
            cell_total += value
        if count(properties.get(spec["count_field"]), spec["count_field"]) != cell_total:
            raise ValueError("density grid cell total does not equal category sum")
        total += cell_total
    if category_totals != spec["category_counts"]:
        raise ValueError(f"density grid category totals mismatch: {category_totals}")
    if total != sum(spec["category_counts"].values()):
        raise ValueError("density grid national total mismatch")
    sha256, size = digest(path)
    return {"sha256": sha256, "bytes": size, "grid_cells": len(features), "record_count": total}


def link_verified(source: Path, destination: Path, expected: dict) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if digest(destination) != (expected["sha256"], expected["bytes"]):
            raise ValueError(f"existing staged file differs: {destination}")
        return
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination)
    if digest(destination) != (expected["sha256"], expected["bytes"]):
        raise ValueError(f"staged file differs: {destination}")


def promote(root: Path, navii: Path, h17: Path, inherited_source_version: str, activate_local: bool) -> dict:
    if not HEX.fullmatch(inherited_source_version):
        raise ValueError("inherited source version must be a SHA-256 release id")
    current = read(root / "current.json")
    base_version = current.get("version")
    if current.get("catalog") != f"releases/{base_version}/catalog.json":
        raise ValueError("base current/catalog mismatch")
    base_release = root / "releases" / str(base_version)
    base_catalog = read(base_release / "catalog.json")
    base_manifest = read(base_release / "publication-manifest.json")
    if base_catalog.get("version") != base_version or base_manifest.get("files") != base_catalog.get("files"):
        raise ValueError("base release contract mismatch")

    replacements = {
        "navii_facilities": (navii, validate_grid(navii, GRID_SPECS["navii_facilities"])),
        "h17_services": (h17, validate_grid(h17, GRID_SPECS["h17_services"])),
    }
    catalog_body = {key: value for key, value in base_catalog.items() if key != "version"}
    catalog_body["status"] = "LOCAL_READY_NOT_DEPLOYED"
    catalog_body["files"] = dict(base_catalog["files"])
    source_by_relative: dict[str, Path] = {}
    updated = set()
    for layer in catalog_body.get("layers", []):
        key = layer.get("key") if isinstance(layer, dict) else None
        if key not in replacements:
            continue
        source, result = replacements[key]
        previous = layer.get("aggregate_path")
        if not isinstance(previous, str) or previous not in catalog_body["files"]:
            raise ValueError(f"base release lacks aggregate_path for {key}")
        del catalog_body["files"][previous]
        spec = GRID_SPECS[key]
        relative = spec["relative"]
        catalog_body["files"][relative] = {"sha256": result["sha256"], "bytes": result["bytes"]}
        source_by_relative[relative] = source
        layer.update({
            "aggregate_path": relative,
            "aggregate_grid_size_m": 10_000,
            "aggregate_crs": "EPSG:6933",
            "aggregate_schema": "category_columns_v1",
        })
        updated.add(key)
    if updated != set(replacements):
        raise ValueError("base release is missing a medical aggregate layer")

    version = hashlib.sha256(json.dumps(
        catalog_body, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode()).hexdigest()
    catalog = {"version": version, **catalog_body}
    staging = root / ".density-promotion-staging" / version
    staging.mkdir(parents=True, exist_ok=True)
    for relative, metadata in sorted(catalog["files"].items()):
        source = source_by_relative.get(relative, base_release / relative)
        if not source.is_file():
            raise FileNotFoundError(f"release source is incomplete: {relative}")
        link_verified(source, staging / relative, metadata)
    write_atomic(staging / "catalog.json", catalog)
    catalog_sha, catalog_bytes = digest(staging / "catalog.json")
    uploaded_files = {relative: catalog["files"][relative] for relative in sorted(source_by_relative)}
    inherited_files = {
        relative: {
            **metadata,
            "source_version": inherited_source_version,
            "source_path": relative,
        }
        for relative, metadata in sorted(catalog["files"].items())
        if relative not in source_by_relative
    }
    manifest = {
        "contract_version": 1,
        "version": version,
        "catalog": {"path": "catalog.json", "sha256": catalog_sha, "bytes": catalog_bytes},
        "files": uploaded_files,
        "inherited_files": inherited_files,
        "denylist": base_manifest.get("denylist"),
        "total_published_payload_bytes": sum(item["bytes"] for item in uploaded_files.values()) + catalog_bytes,
        "total_effective_payload_bytes": sum(item["bytes"] for item in catalog["files"].values()) + catalog_bytes,
        "status": "LOCAL_READY_NOT_DEPLOYED",
        "promoted_from": base_version,
    }
    write_atomic(staging / "publication-manifest.json", manifest)
    release = root / "releases" / version
    if not release.exists():
        release.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging, release)
    pointer = {
        "contract_version": 1,
        "status": "LOCAL_READY_NOT_DEPLOYED",
        "version": version,
        "catalog": f"releases/{version}/catalog.json",
        "publication_manifest": f"releases/{version}/publication-manifest.json",
    }
    write_atomic(root / "candidate-current.json", pointer)
    if activate_local:
        write_atomic(root / "current.json", pointer)
    return {
        "base_version": base_version,
        "version": version,
        "files": len(catalog["files"]),
        "published_asset_bytes": sum(item["bytes"] for item in uploaded_files.values()),
        "effective_payload_bytes": manifest["total_effective_payload_bytes"],
        "inherited_source_version": inherited_source_version,
        "navii": replacements["navii_facilities"][1],
        "h17": replacements["h17_services"][1],
        "activated_local": activate_local,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--navii", type=Path, required=True)
    parser.add_argument("--h17", type=Path, required=True)
    parser.add_argument("--inherited-source-version", required=True)
    parser.add_argument("--activate-local", action="store_true")
    args = parser.parse_args()
    print(json.dumps(promote(args.root, args.navii, args.h17, args.inherited_source_version, args.activate_local), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
