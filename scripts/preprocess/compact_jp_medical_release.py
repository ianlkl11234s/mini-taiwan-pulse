#!/usr/bin/env python3
"""Build a compact local Japan-medical release from an existing verified release.

The input is never changed.  This utility only relinks (or copies) the seven
public map assets; it does not recreate PMTiles or consult raw source data.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path


HEX = re.compile(r"^[0-9a-f]{64}$")
COMPACT_ASSET_PATHS = frozenset({
    "aggregates/h17-z6.geojson", "aggregates/navii-z6.geojson",
    "areas/A38-20_1.pmtiles", "areas/A38-20_2.pmtiles",
    "areas/A38-20_3.pmtiles", "points/h17_services.pmtiles",
    "points/navii_facilities.pmtiles",
})


def digest(path: Path) -> tuple[str, int]:
    value, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
            size += len(block)
    return value.hexdigest(), size


def read_object(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid {label}: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def safe_relative(value: object) -> str:
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise ValueError("invalid relative path")
    path = Path(value)
    if any(part in ("", ".", "..") for part in path.parts):
        raise ValueError("path traversal rejected")
    return value


def metadata(value: object, label: str) -> dict:
    if (not isinstance(value, dict) or not isinstance(value.get("bytes"), int)
            or value["bytes"] < 0 or not isinstance(value.get("sha256"), str)
            or not HEX.fullmatch(value["sha256"])):
        raise ValueError(f"invalid {label} metadata")
    return {"sha256": value["sha256"], "bytes": value["bytes"]}


def atomic_json(path: Path, value: dict) -> None:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(encoded)
    os.replace(temporary, path)


def source_release(source_root: Path) -> tuple[dict, Path, dict, dict]:
    current = read_object(source_root / "current.json", "source current")
    version = current.get("version")
    if not isinstance(version, str) or not HEX.fullmatch(version):
        raise ValueError("source current version is invalid")
    catalog_rel = safe_relative(current.get("catalog"))
    manifest_rel = safe_relative(current.get("publication_manifest"))
    if catalog_rel != f"releases/{version}/catalog.json" or manifest_rel != f"releases/{version}/publication-manifest.json":
        raise ValueError("source current must bind one immutable release")
    release = source_root / Path(catalog_rel).parent
    catalog_path, manifest_path = source_root / catalog_rel, source_root / manifest_rel
    catalog = read_object(catalog_path, "source catalog")
    manifest = read_object(manifest_path, "source publication manifest")
    catalog_meta = metadata(manifest.get("catalog"), "source catalog")
    if manifest["catalog"].get("path") != "catalog.json" or digest(catalog_path) != (catalog_meta["sha256"], catalog_meta["bytes"]):
        raise ValueError("source catalog digest mismatch")
    if catalog.get("version") != version or manifest.get("version") != version or catalog.get("files") != manifest.get("files"):
        raise ValueError("source release bindings mismatch")
    if not isinstance(manifest.get("files"), dict):
        raise ValueError("source manifest files must be an object")
    return current, release, catalog, manifest


def link_or_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination)


def compact(source_root: Path, output_root: Path) -> dict:
    source_root, output_root = source_root.resolve(), output_root.resolve()
    if source_root == output_root:
        raise ValueError("--output-root must differ from --source-root")
    if (output_root / "current.json").exists():
        raise FileExistsError("output root already has current.json; refusing to replace it")
    current, release, source_catalog, source_manifest = source_release(source_root)
    files: dict[str, dict] = {}
    for relative in sorted(COMPACT_ASSET_PATHS):
        expected = metadata(source_manifest["files"].get(relative), relative)
        path = release / safe_relative(relative)
        if not path.is_file() or digest(path) != (expected["sha256"], expected["bytes"]):
            raise ValueError(f"source asset digest mismatch: {relative}")
        files[relative] = expected
    output_root.mkdir(parents=True, exist_ok=True)
    catalog_without_version = dict(source_catalog)
    catalog_without_version.pop("version", None)
    catalog_without_version["files"] = files
    catalog_without_version["detail_buckets"] = {}
    layers = catalog_without_version.get("layers")
    if not isinstance(layers, list):
        raise ValueError("source catalog layers must be a list")
    catalog_without_version["layers"] = [{**layer, "detail_reference": None} if isinstance(layer, dict) else _invalid_layer() for layer in layers]
    version = hashlib.sha256(json.dumps(catalog_without_version, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    destination = output_root / "releases" / version
    if destination.exists():
        raise FileExistsError(f"immutable release already exists: {destination}")
    catalog = {"version": version, **catalog_without_version}
    with tempfile.TemporaryDirectory(prefix="jp-medical-compact-", dir=output_root) as temporary:
        staging = Path(temporary) / "release"
        staging.mkdir()
        for relative, expected in files.items():
            target = staging / relative
            link_or_copy(release / relative, target)
            if digest(target) != (expected["sha256"], expected["bytes"]):
                raise ValueError(f"staged asset digest mismatch: {relative}")
        atomic_json(staging / "catalog.json", catalog)
        catalog_meta = {"sha256": digest(staging / "catalog.json")[0], "bytes": (staging / "catalog.json").stat().st_size}
        manifest = {"contract_version": source_manifest.get("contract_version", 1), "version": version,
                    "catalog": {"path": "catalog.json", **catalog_meta}, "files": files,
                    "denylist": {"paths": source_manifest.get("denylist", {}).get("paths", []), "result": "PASS"},
                    "total_payload_bytes": sum(item["bytes"] for item in files.values()) + catalog_meta["bytes"],
                    "status": catalog.get("status")}
        atomic_json(staging / "publication-manifest.json", manifest)
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging, destination)
    pointer = {"contract_version": source_manifest.get("contract_version", 1), "status": catalog.get("status"), "version": version,
               "catalog": f"releases/{version}/catalog.json", "publication_manifest": f"releases/{version}/publication-manifest.json"}
    atomic_json(output_root / "current.json", pointer)  # mutable pointer is last
    return {"version": version, "files": len(files), "payload_bytes": sum(item["bytes"] for item in files.values()), "source_version": current["version"]}


def _invalid_layer():
    raise ValueError("source catalog layer must be an object")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(compact(args.source_root, args.output_root), ensure_ascii=False))


if __name__ == "__main__":
    main()
