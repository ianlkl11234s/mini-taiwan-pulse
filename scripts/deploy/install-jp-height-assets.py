#!/usr/bin/env python3
"""Fail-closed installer for the published Japan-height catalog and assets."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")
ASSET_PATH = re.compile(r"^assets/([0-9a-f]{64})\.pmtiles$")
MAX_ASSETS = 500
MAX_CATALOG_BYTES = 2 * 1024 * 1024
MAX_ASSET_BYTES = 25 * 1024 * 1024
MAX_BUILDING_GRID_BYTES = 5 * 1024 * 1024


def asset_byte_budget(value: dict) -> int:
    return MAX_BUILDING_GRID_BYTES if value.get("sourceLayer") == "building_grid" else MAX_ASSET_BYTES


def digest(path: Path) -> tuple[str, int]:
    value, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
            size += len(block)
    return value.hexdigest(), size


def asset_records(catalog: dict) -> list[dict]:
    values: list[object] = []
    regions = catalog.get("regions")
    if catalog.get("schema") != "jp-height-catalog-v1" or not isinstance(catalog.get("version"), str) or not isinstance(regions, list) or not regions:
        raise ValueError("catalog schema/version/regions is invalid")
    for region in regions:
        if not isinstance(region, dict):
            raise ValueError("catalog region must be an object")
        values.extend(region.get(key) for key in ("buildings", "grid", "canopy"))
    values.extend(catalog.get(key) for key in ("overview", "canopyOverview"))
    records: dict[str, dict] = {}
    for value in values:
        if value is None:
            continue
        if not isinstance(value, dict) or not isinstance(value.get("url"), str):
            raise ValueError("catalog asset is invalid")
        relative = value["url"].removeprefix("./jp-heights/") if value["url"].startswith("./jp-heights/") else ""
        match = ASSET_PATH.fullmatch(relative)
        sha, size = value.get("sha256"), value.get("bytes")
        if not match or not isinstance(sha, str) or not HEX.fullmatch(sha) or match.group(1) != sha or not isinstance(size, int) or size <= 0 or size > asset_byte_budget(value):
            raise ValueError(f"catalog asset contract invalid: {relative}")
        record = {"relative_path": relative, "sha256": sha, "bytes": size}
        if relative in records and records[relative] != record:
            raise ValueError(f"conflicting duplicate asset: {relative}")
        records[relative] = record
    if not records or len(records) > MAX_ASSETS:
        raise ValueError("catalog asset count is outside the install budget")
    return [records[key] for key in sorted(records)]


def fetch(aws: str, bucket: str, key: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([aws, "s3", "cp", f"s3://{bucket}/{key}", str(destination), "--no-progress"], check=True, stdout=subprocess.DEVNULL)


def install(args) -> None:
    target = args.target.resolve()
    target.mkdir(parents=True, exist_ok=True)
    staging = (args.staging_root or target / ".install-staging").resolve()
    staging.mkdir(parents=True, exist_ok=True)
    remote_catalog = staging / "catalog.json"
    fetch(args.aws, args.bucket, f"{args.prefix.strip('/')}/catalog.json", remote_catalog)
    if remote_catalog.stat().st_size > MAX_CATALOG_BYTES:
        raise ValueError("catalog exceeds 2 MiB")
    catalog = json.loads(remote_catalog.read_text(encoding="utf-8"))
    if not isinstance(catalog, dict):
        raise ValueError("catalog must be an object")
    records = asset_records(catalog)

    def stage(record: dict):
        destination = target / record["relative_path"]
        expected = (record["sha256"], record["bytes"])
        if destination.is_file() and digest(destination) == expected:
            return None
        if destination.exists():
            raise ValueError(f"existing immutable differs; refusing overwrite: {record['relative_path']}")
        downloaded = staging / "objects" / record["relative_path"]
        if not downloaded.is_file() or digest(downloaded) != expected:
            fetch(args.aws, args.bucket, f"{args.prefix.strip('/')}/{record['relative_path']}", downloaded)
        if digest(downloaded) != expected:
            raise ValueError(f"download bytes/SHA-256 mismatch: {record['relative_path']}")
        return downloaded, destination, expected

    staged = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(stage, records):
            if result is not None:
                staged.append(result)
    for downloaded, destination, expected in staged:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + ".tmp")
        shutil.copyfile(downloaded, temporary)
        if digest(temporary) != expected:
            raise ValueError(f"local staging mismatch: {destination.name}")
        os.replace(temporary, destination)
    catalog_tmp = target / "catalog.json.tmp"
    shutil.copyfile(remote_catalog, catalog_tmp)
    os.replace(catalog_tmp, target / "catalog.json")
    print(f"installed jp-heights {catalog['version']} with {len(records)} assets into {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--prefix", default="deploy-assets/jp-heights")
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--staging-root", type=Path)
    parser.add_argument("--aws", default="aws")
    install(parser.parse_args())


if __name__ == "__main__":
    main()
