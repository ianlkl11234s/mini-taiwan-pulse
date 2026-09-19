#!/usr/bin/env python3
"""Fail-closed S3 installer for the Japan medical immutable release."""
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
LEGACY_ASSET_COUNT = 778
STAGING_SAFETY_BYTES = 16 * 1024 * 1024
PREVIOUS_COMPACT_ASSET_PATHS = frozenset({
    "aggregates/h17-z6.geojson",
    "aggregates/navii-z6.geojson",
    "areas/A38-20_1.pmtiles",
    "areas/A38-20_2.pmtiles",
    "areas/A38-20_3.pmtiles",
    "points/h17_services.pmtiles",
    "points/navii_facilities.pmtiles",
})
COMPACT_ASSET_PATHS = frozenset({
    "aggregates/h17-density-10km.geojson",
    "aggregates/navii-density-10km.geojson",
    "areas/A38-20_1.pmtiles",
    "areas/A38-20_2.pmtiles",
    "areas/A38-20_3.pmtiles",
    "points/h17_services.pmtiles",
    "points/navii_facilities.pmtiles",
})


def digest(path: Path) -> tuple[str, int]:
    value, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block); size += len(block)
    return value.hexdigest(), size


def safe_relative(value: object) -> str:
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise ValueError("invalid relative path")
    path = Path(value)
    if any(part in ("", ".", "..") for part in path.parts):
        raise ValueError("path traversal rejected")
    return value


def fetch(aws: str, bucket: str, key: str, destination: Path, env: dict[str, str] | None = None) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([aws, "s3", "cp", f"s3://{bucket}/{key}", str(destination), "--no-progress"], check=True, stdout=subprocess.DEVNULL, env=env)


def checked_json(path: Path, label: str) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def same_file(target: Path, expected_sha: str, expected_bytes: int) -> bool:
    return target.is_file() and digest(target) == (expected_sha, expected_bytes)


def move_verified(staged: Path, destination: Path, expected_sha: str, expected_bytes: int) -> None:
    """Install one verified staged file without creating a second full copy."""
    if destination.exists():
        if same_file(destination, expected_sha, expected_bytes):
            return
        raise ValueError(f"existing immutable differs; refusing overwrite: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    os.replace(staged, destination)
    if not same_file(destination, expected_sha, expected_bytes):
        raise ValueError(f"installed immutable bytes/SHA-256 mismatch: {destination}")


def remove_empty(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.rmdir()
        except OSError:
            pass


def required_staging_bytes(target: Path, temporary: Path, assets: list[tuple[str, dict, str]]) -> int:
    """Count only payload bytes that cannot resume from a verified destination."""
    required = 0
    for relative, metadata, remote_relative in assets:
        if same_file(target / relative, metadata["sha256"], metadata["bytes"]):
            continue
        if same_file(temporary / "objects" / relative, metadata["sha256"], metadata["bytes"]):
            continue
        if same_file(target / remote_relative, metadata["sha256"], metadata["bytes"]):
            continue
        required += metadata["bytes"]
    return required


def validate_asset_paths(paths: set[str]) -> None:
    if len(paths) == LEGACY_ASSET_COUNT:
        if not all(path.startswith(("points/", "areas/", "aggregates/", "details/")) for path in paths):
            raise ValueError("legacy asset outside payload allowlist")
        return
    if paths not in (PREVIOUS_COMPACT_ASSET_PATHS, COMPACT_ASSET_PATHS):
        raise ValueError("assets must be the legacy payload or the exact compact payload")


def validate_catalog_contract(catalog: object, version: str, files: dict) -> None:
    if (not isinstance(catalog, dict) or catalog.get("version") != version
            or catalog.get("status") != "LOCAL_READY_NOT_DEPLOYED"
            or catalog.get("files") != files):
        raise ValueError("catalog does not bind publication manifest")
    if set(files) in (PREVIOUS_COMPACT_ASSET_PATHS, COMPACT_ASSET_PATHS):
        if catalog.get("detail_buckets") != {} or not isinstance(catalog.get("layers"), list):
            raise ValueError("compact catalog must declare no detail buckets")
        if any(not isinstance(layer, dict) or layer.get("detail_reference") is not None for layer in catalog["layers"]):
            raise ValueError("compact catalog must not reference retired detail hours")


def validate_manifest_catalog(meta: object) -> None:
    if (not isinstance(meta, dict) or not isinstance(meta.get("bytes"), int)
            or meta["bytes"] < 0 or not isinstance(meta.get("sha256"), str)
            or not HEX.fullmatch(meta["sha256"])
            or ("path" in meta and meta["path"] != "catalog.json")):
        raise ValueError("publication manifest lacks catalog digest")


def inherited_files(manifest: dict) -> dict[str, dict]:
    inherited = manifest.get("inherited_files", {})
    if not isinstance(inherited, dict):
        raise ValueError("inherited_files must be an object")
    output = {}
    for relative, value in inherited.items():
        relative = safe_relative(relative)
        if (not isinstance(value, dict) or not isinstance(value.get("bytes"), int) or value["bytes"] < 0
                or not isinstance(value.get("sha256"), str) or not HEX.fullmatch(value["sha256"])
                or not isinstance(value.get("source_version"), str) or not HEX.fullmatch(value["source_version"])
                or safe_relative(value.get("source_path")) != relative):
            raise ValueError(f"invalid inherited asset metadata: {relative}")
        output[relative] = value
    return output


def install(args) -> None:
    command_env = None
    bucket = getattr(args, "bucket", None)
    env_file = getattr(args, "env_file", None)
    if env_file:
        from dotenv import dotenv_values
        config = dotenv_values(env_file)
        bucket = bucket or config.get("S3_BUCKET")
        for name in ("S3_ACCESS_KEY", "S3_SECRET_KEY"):
            if not config.get(name):
                raise ValueError(f"missing configuration key: {name}")
        command_env = {
            **os.environ,
            "AWS_ACCESS_KEY_ID": str(config["S3_ACCESS_KEY"]),
            "AWS_SECRET_ACCESS_KEY": str(config["S3_SECRET_KEY"]),
            "AWS_DEFAULT_REGION": str(config.get("S3_REGION") or "ap-southeast-2"),
        }
    if not bucket:
        raise ValueError("bucket or --env-file with S3_BUCKET is required")
    prefix = args.prefix.strip("/")
    if not prefix:
        raise ValueError("prefix is required")
    target = args.target.resolve()
    target.mkdir(parents=True, exist_ok=True)
    def download(key: str, destination: Path) -> None:
        if command_env is None:
            fetch(args.aws, bucket, key, destination)
        else:
            fetch(args.aws, bucket, key, destination, command_env)
    staging_root = Path(getattr(args, "staging_root", None) or target / ".install-staging").resolve()
    staging_root.mkdir(parents=True, exist_ok=True)
    if staging_root.stat().st_dev != target.stat().st_dev:
        raise ValueError("staging root must be on the target filesystem for safe move")
    current_probe = staging_root / "current.json"
    download(f"{prefix}/current.json", current_probe)
    current = checked_json(current_probe, "current")
    version = current.get("version")
    if not isinstance(version, str) or not HEX.fullmatch(version):
        raise ValueError("current version is invalid")
    temporary = staging_root / version
    temporary.mkdir(parents=True, exist_ok=True)
    remote_current = temporary / "current.json"
    shutil.copyfile(current_probe, remote_current)
    try:
        current = checked_json(remote_current, "current")
        catalog_relative = safe_relative(current.get("catalog"))
        manifest_relative = safe_relative(current.get("publication_manifest"))
        if catalog_relative != f"releases/{version}/catalog.json" or manifest_relative != f"releases/{version}/publication-manifest.json":
            raise ValueError("current must point to its immutable release")
        remote_manifest, remote_catalog = temporary / "publication-manifest.json", temporary / "catalog.json"
        download(f"{prefix}/{manifest_relative}", remote_manifest)
        manifest = checked_json(remote_manifest, "publication manifest")
        if manifest.get("version") != version or not isinstance(manifest.get("files"), dict):
            raise ValueError("publication manifest version/files mismatch")
        catalog_meta = manifest.get("catalog")
        validate_manifest_catalog(catalog_meta)
        download(f"{prefix}/{catalog_relative}", remote_catalog)
        if digest(remote_catalog) != (catalog_meta["sha256"], catalog_meta["bytes"]):
            raise ValueError("catalog bytes/SHA-256 mismatch")
        catalog = checked_json(remote_catalog, "catalog")
        inherited = inherited_files(manifest)
        if set(manifest["files"]) & set(inherited):
            raise ValueError("published and inherited assets overlap")
        effective_files = {
            **{relative: {"sha256": value["sha256"], "bytes": value["bytes"]} for relative, value in inherited.items()},
            **manifest["files"],
        }
        validate_catalog_contract(catalog, version, effective_files)
        assets = []
        for relative, metadata in sorted(manifest["files"].items()):
            relative = safe_relative(relative)
            if not isinstance(metadata, dict) or not isinstance(metadata.get("bytes"), int) or metadata["bytes"] < 0 or not isinstance(metadata.get("sha256"), str) or not HEX.fullmatch(metadata["sha256"]):
                raise ValueError("manifest digest metadata invalid")
            target_relative = f"releases/{version}/{relative}"
            assets.append((target_relative, metadata, target_relative))
        for relative, metadata in sorted(inherited.items()):
            assets.append((
                f"releases/{version}/{relative}",
                {"sha256": metadata["sha256"], "bytes": metadata["bytes"]},
                f"releases/{metadata['source_version']}/{metadata['source_path']}",
            ))
        validate_asset_paths({relative.removeprefix(f"releases/{version}/") for relative, _, _ in assets})
        metadata_entries = [
            (catalog_relative, catalog_meta),
            (manifest_relative, {"sha256": digest(remote_manifest)[0], "bytes": remote_manifest.stat().st_size}),
        ]
        # Immutable names are never repairable in place. A divergent local file
        # signals a bad volume or release collision; preserve it and stop.
        for relative, metadata, _ in assets:
            local = target / relative
            if local.exists() and not same_file(local, metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"existing immutable differs; refusing overwrite: {relative}")
        for relative, metadata in metadata_entries:
            local = target / relative
            if local.exists() and not same_file(local, metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"existing immutable differs; refusing overwrite: {relative}")
        required = required_staging_bytes(target, temporary, assets)
        available = shutil.disk_usage(staging_root).free
        if available < required + STAGING_SAFETY_BYTES:
            raise ValueError(
                f"insufficient staging space: need {required + STAGING_SAFETY_BYTES} bytes "
                f"({required} payload + {STAGING_SAFETY_BYTES} safety), have {available}"
            )
        staged = [(remote_catalog, catalog_relative, catalog_meta), (remote_manifest, manifest_relative, metadata_entries[-1][1])]
        def stage_asset(item):
            relative, metadata, remote_relative = item
            local = target / relative
            if same_file(local, metadata["sha256"], metadata["bytes"]):
                return None
            downloaded = temporary / "objects" / relative
            downloaded.parent.mkdir(parents=True, exist_ok=True)
            if not same_file(downloaded, metadata["sha256"], metadata["bytes"]):
                inherited_local = target / remote_relative
                if same_file(inherited_local, metadata["sha256"], metadata["bytes"]):
                    try:
                        os.link(inherited_local, downloaded)
                    except OSError:
                        download(f"{prefix}/{remote_relative}", downloaded)
                else:
                    download(f"{prefix}/{remote_relative}", downloaded)
            if digest(downloaded) != (metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"download bytes/SHA-256 mismatch: {relative}")
            return downloaded, relative, metadata
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(stage_asset, assets):
                if result is not None:
                    staged.append(result)
        # All remote content has passed before any local pointer changes. Immutable
        # files may be installed now; old release files are retained.
        for downloaded, relative, metadata in staged:
            destination = target / relative
            move_verified(downloaded, destination, metadata["sha256"], metadata["bytes"])
        # The already-downloaded remote pointer is the only mutable write and occurs last.
        current_tmp = target / "current.json.tmp"
        shutil.copyfile(remote_current, current_tmp)
        os.replace(current_tmp, target / "current.json")
    except Exception:
        print(f"install interrupted; verified downloads remain resumable at {temporary}")
        raise
    # Remove only this run's known staging files after the pointer is atomically live.
    # Unknown files stop rmdir and remain available for inspection.
    known_staging_files = [staged_file for staged_file, _, _ in staged] + [remote_current, current_probe]
    # Each installed asset was verified by stage_asset or move_verified above.
    # Include prior-run duplicates without re-hashing the whole release again.
    known_staging_files.extend(temporary / "objects" / relative for relative, _, _ in assets)
    for staged_file in known_staging_files:
        staged_file.unlink(missing_ok=True)
    empty_candidates: set[Path] = set()
    for staged_file in known_staging_files:
        parent = staged_file.parent
        while parent != staging_root.parent:
            empty_candidates.add(parent)
            if parent == staging_root:
                break
            parent = parent.parent
    remove_empty(sorted(empty_candidates, key=lambda path: len(path.parts), reverse=True))
    print(f"installed jp-medical {version} into {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--staging-root", type=Path)
    parser.add_argument("--aws", default="aws")
    args = parser.parse_args()
    install(args)


if __name__ == "__main__":
    main()
