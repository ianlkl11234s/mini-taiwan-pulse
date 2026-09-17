#!/usr/bin/env python3
"""Create a complete local Japan medical release by replacing two point archives.

The installed immutable base release supplies every unchanged allowlisted file.
Unchanged files are hard-linked into the new content-addressed release; the two
reviewed all-zoom PMTiles replace their sampled predecessors. Nothing is
uploaded, and the local current pointer changes only with --activate-local.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

POINTS = {
    "navii_facilities": {
        "relative": "points/navii_facilities.pmtiles",
        "expected": 189_800,
        "source_sha256": "a959bb6b56c17db0bd1bc245b39e8526f73dce5e2e9b73fdb27f6b51dce63091",
    },
    "h17_services": {
        "relative": "points/h17_services.pmtiles",
        "expected": 222_194,
        "source_sha256": "96235be72c842317cec4148e8ea8443babca4f10ffbcfb184b4759e1c9c23a08",
    },
}


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


def decoded_z0_count(path: Path, source_layer: str) -> int:
    decoded = json.loads(subprocess.check_output(
        ["tippecanoe-decode", str(path), "0", "0", "0"], text=True,
    ))
    layers = [
        item for item in decoded.get("features", [])
        if item.get("properties", {}).get("layer") == source_layer
    ]
    if len(layers) != 1:
        raise ValueError(f"{source_layer} missing from decoded z0")
    return len(layers[0].get("features", []))


def validate_point(path: Path, source_layer: str, expected: int) -> dict:
    subprocess.run(["pmtiles", "verify", str(path)], check=True)
    metadata = json.loads(subprocess.check_output(
        ["pmtiles", "show", "--metadata", str(path)], text=True,
    ))
    vector = metadata.get("vector_layers") or []
    if len(vector) != 1 or vector[0].get("id") != source_layer:
        raise ValueError(f"{source_layer} source-layer mismatch")
    if vector[0].get("minzoom") != 0 or vector[0].get("maxzoom") != 14:
        raise ValueError(f"{source_layer} zoom contract mismatch")
    if any("dropped_by_rate" in item for item in metadata.get("strategies", [])):
        raise ValueError(f"{source_layer} is rate-sampled")
    count = decoded_z0_count(path, source_layer)
    if count != expected:
        raise ValueError(f"{source_layer} z0={count:,}, expected={expected:,}")
    sha256, size = digest(path)
    return {"sha256": sha256, "bytes": size, "z0_feature_count": count}


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
            raise ValueError(f"copied file differs: {destination}")


def promote(root: Path, navii: Path, h17: Path, activate_local: bool) -> dict:
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
        "navii_facilities": (navii, validate_point(navii, "navii_facilities", 189_800)),
        "h17_services": (h17, validate_point(h17, "h17_services", 222_194)),
    }
    catalog_body = {key: value for key, value in base_catalog.items() if key != "version"}
    catalog_body["status"] = "LOCAL_READY_NOT_DEPLOYED"
    catalog_body["files"] = dict(base_catalog["files"])
    for layer in catalog_body["layers"]:
        key = layer.get("key")
        if key not in replacements:
            continue
        _, result = replacements[key]
        contract = POINTS[key]
        catalog_body["files"][contract["relative"]] = {
            "sha256": result["sha256"], "bytes": result["bytes"],
        }
        layer.update({
            "minimum_point_zoom": 0,
            "point_sampling": "none",
            "z0_feature_count": result["z0_feature_count"],
            "geometry_provenance": "recovered from reviewed immutable PMTiles z14 display geometry; not fresh source coordinates",
            "source_pmtiles_sha256": contract["source_sha256"],
        })
    version = hashlib.sha256(json.dumps(
        catalog_body, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode()).hexdigest()
    catalog = {"version": version, **catalog_body}
    staging = root / ".promotion-staging" / version
    staging.mkdir(parents=True, exist_ok=True)
    point_by_relative = {
        POINTS[key]["relative"]: replacement for key, replacement in replacements.items()
    }
    for relative, metadata in sorted(catalog["files"].items()):
        if relative in point_by_relative:
            source = point_by_relative[relative][0]
        else:
            source = base_release / relative
        if not source.is_file():
            raise FileNotFoundError(f"base release is incomplete: {relative}")
        link_verified(source, staging / relative, metadata)
    write_atomic(staging / "catalog.json", catalog)
    catalog_sha, catalog_bytes = digest(staging / "catalog.json")
    manifest = {
        "contract_version": 1,
        "version": version,
        "catalog": {"path": "catalog.json", "sha256": catalog_sha, "bytes": catalog_bytes},
        "files": dict(sorted(catalog["files"].items())),
        "denylist": base_manifest.get("denylist"),
        "total_payload_bytes": sum(item["bytes"] for item in catalog["files"].values()) + catalog_bytes,
        "status": "LOCAL_READY_NOT_DEPLOYED",
        "promoted_from": base_version,
    }
    write_atomic(staging / "publication-manifest.json", manifest)
    release = root / "releases" / version
    if not release.exists():
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
        "payload_bytes": manifest["total_payload_bytes"],
        "navii": replacements["navii_facilities"][1],
        "h17": replacements["h17_services"][1],
        "activated_local": activate_local,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--navii", type=Path, required=True)
    parser.add_argument("--h17", type=Path, required=True)
    parser.add_argument("--activate-local", action="store_true")
    args = parser.parse_args()
    print(json.dumps(promote(args.root, args.navii, args.h17, args.activate_local), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
