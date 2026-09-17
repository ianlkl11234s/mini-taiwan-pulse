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
        if not isinstance(catalog_meta, dict) or not isinstance(catalog_meta.get("bytes"), int) or not isinstance(catalog_meta.get("sha256"), str):
            raise ValueError("publication manifest lacks catalog digest")
        download(f"{prefix}/{catalog_relative}", remote_catalog)
        if digest(remote_catalog) != (catalog_meta["sha256"], catalog_meta["bytes"]):
            raise ValueError("catalog bytes/SHA-256 mismatch")
        catalog = checked_json(remote_catalog, "catalog")
        if catalog.get("version") != version or catalog.get("status") != "LOCAL_READY_NOT_DEPLOYED" or catalog.get("files") != manifest["files"]:
            raise ValueError("catalog does not bind publication manifest")
        assets = []
        for relative, metadata in sorted(manifest["files"].items()):
            relative = safe_relative(relative)
            if not relative.startswith(("points/", "areas/", "aggregates/", "details/")):
                raise ValueError("manifest asset outside payload allowlist")
            if not isinstance(metadata, dict) or not isinstance(metadata.get("bytes"), int) or metadata["bytes"] < 0 or not isinstance(metadata.get("sha256"), str) or not HEX.fullmatch(metadata["sha256"]):
                raise ValueError("manifest digest metadata invalid")
            assets.append((f"releases/{version}/{relative}", metadata))
        if len(assets) != 778:
            raise ValueError("expected exactly 778 immutable payload assets")
        assets += [(catalog_relative, catalog_meta), (manifest_relative, {"sha256": digest(remote_manifest)[0], "bytes": remote_manifest.stat().st_size})]
        # Immutable names are never repairable in place. A divergent local file
        # signals a bad volume or release collision; preserve it and stop.
        for relative, metadata in assets:
            local = target / relative
            if local.exists() and not same_file(local, metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"existing immutable differs; refusing overwrite: {relative}")
        staged = [(remote_catalog, catalog_relative, catalog_meta), (remote_manifest, manifest_relative, assets[-1][1])]
        def stage_asset(item):
            relative, metadata = item
            local = target / relative
            if same_file(local, metadata["sha256"], metadata["bytes"]):
                return None
            downloaded = temporary / "objects" / relative
            downloaded.parent.mkdir(parents=True, exist_ok=True)
            if not same_file(downloaded, metadata["sha256"], metadata["bytes"]):
                download(f"{prefix}/{relative}", downloaded)
            if digest(downloaded) != (metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"download bytes/SHA-256 mismatch: {relative}")
            return downloaded, relative, metadata
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(stage_asset, assets[:778]):
                if result is not None:
                    staged.append(result)
        # All remote content has passed before any local pointer changes. Immutable
        # files may be installed now; old release files are retained.
        for downloaded, relative, metadata in staged:
            destination = target / relative
            if same_file(destination, metadata["sha256"], metadata["bytes"]):
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            replacement = destination.with_name(destination.name + ".tmp")
            shutil.copyfile(downloaded, replacement)
            if digest(replacement) != (metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"local staging mismatch: {relative}")
            os.replace(replacement, destination)
        # The already-downloaded remote pointer is the only mutable write and occurs last.
        current_tmp = target / "current.json.tmp"
        shutil.copyfile(remote_current, current_tmp)
        os.replace(current_tmp, target / "current.json")
    except Exception:
        print(f"install interrupted; verified downloads remain resumable at {temporary}")
        raise
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
