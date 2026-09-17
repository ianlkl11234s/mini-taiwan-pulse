#!/usr/bin/env python3
"""Fail-closed S3 installer for the Japan medical immutable release."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
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


def fetch(aws: str, bucket: str, key: str, destination: Path) -> None:
    subprocess.run([aws, "s3", "cp", f"s3://{bucket}/{key}", str(destination), "--no-progress"], check=True, stdout=subprocess.DEVNULL)


def checked_json(path: Path, label: str) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def same_file(target: Path, expected_sha: str, expected_bytes: int) -> bool:
    return target.is_file() and digest(target) == (expected_sha, expected_bytes)


def install(args) -> None:
    prefix = args.prefix.strip("/")
    if not prefix:
        raise ValueError("prefix is required")
    target = args.target.resolve()
    target.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jp-medical-install-", dir=target.parent) as directory:
        temporary = Path(directory)
        remote_current = temporary / "current.json"
        fetch(args.aws, args.bucket, f"{prefix}/current.json", remote_current)
        current = checked_json(remote_current, "current")
        version = current.get("version")
        if not isinstance(version, str) or not HEX.fullmatch(version):
            raise ValueError("current version is invalid")
        catalog_relative = safe_relative(current.get("catalog"))
        manifest_relative = safe_relative(current.get("publication_manifest"))
        if catalog_relative != f"releases/{version}/catalog.json" or manifest_relative != f"releases/{version}/publication-manifest.json":
            raise ValueError("current must point to its immutable release")
        remote_manifest, remote_catalog = temporary / "publication-manifest.json", temporary / "catalog.json"
        fetch(args.aws, args.bucket, f"{prefix}/{manifest_relative}", remote_manifest)
        manifest = checked_json(remote_manifest, "publication manifest")
        if manifest.get("version") != version or not isinstance(manifest.get("files"), dict):
            raise ValueError("publication manifest version/files mismatch")
        catalog_meta = manifest.get("catalog")
        if not isinstance(catalog_meta, dict) or not isinstance(catalog_meta.get("bytes"), int) or not isinstance(catalog_meta.get("sha256"), str):
            raise ValueError("publication manifest lacks catalog digest")
        fetch(args.aws, args.bucket, f"{prefix}/{catalog_relative}", remote_catalog)
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
        for relative, metadata in assets[:778]:
            local = target / relative
            if same_file(local, metadata["sha256"], metadata["bytes"]):
                continue
            downloaded = temporary / "objects" / relative
            downloaded.parent.mkdir(parents=True, exist_ok=True)
            fetch(args.aws, args.bucket, f"{prefix}/{relative}", downloaded)
            if digest(downloaded) != (metadata["sha256"], metadata["bytes"]):
                raise ValueError(f"download bytes/SHA-256 mismatch: {relative}")
            staged.append((downloaded, relative, metadata))
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
    print(f"installed jp-medical {version} into {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--aws", default="aws")
    args = parser.parse_args()
    install(args)


if __name__ == "__main__":
    main()
