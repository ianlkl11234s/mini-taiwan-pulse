#!/usr/bin/env python3
"""Publish a validated historical-flight-trails static release to S3.

The command is a dry run unless ``--apply`` is given.  It never discovers
objects by globbing: manifest.json is the allowlist, and every local file must
be named by that allowlist before an S3 client is even created.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


PREFIX = "deploy-assets/flight-trails"
IMMUTABLE_CACHE = "public,max-age=31536000,immutable"
MANIFEST_CACHE = "public,max-age=60,s-maxage=60,stale-while-revalidate=300"
MAX_WORKERS = 4
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
RELEASE_ID = re.compile(r"^[A-Za-z0-9_-]+$")
ASSET_PATH = re.compile(r"^releases/([A-Za-z0-9_-]+)/([A-Za-z0-9_.-]+)\.geojson$")
NOT_FOUND = {"404", "NoSuchKey", "NotFound", "NoSuchBucket"}
PRECONDITION_FAILED = {"412", "PreconditionFailed", "ConditionalRequestConflict"}
PUBLICATION_LICENSE_STATUS = "verified_public_display"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_stream(stream: Any) -> tuple[str, int]:
    digest, size = hashlib.sha256(), 0
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
        size += len(chunk)
    return digest.hexdigest(), size


def sha256_path(path: Path) -> tuple[str, int]:
    with path.open("rb") as stream:
        return sha256_stream(stream)


def safe_relative(value: object) -> str:
    """Accept only canonical POSIX-relative keys, never platform-dependent paths."""
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("path must be a nonempty canonical relative POSIX path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts) or str(path) != value:
        raise ValueError(f"unsafe path: {value}")
    return value


def contained_file(root: Path, relative: str) -> Path:
    local = (root / relative).resolve()
    try:
        local.relative_to(root)
    except ValueError as error:
        raise ValueError(f"path escapes publication root: {relative}") from error
    requested = root / relative
    if requested.is_symlink() or not local.is_file():
        raise ValueError(f"missing regular allowlist file: {relative}")
    return local


def require_count(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{label} must be a positive integer")
    return value


def manifest_entries(root: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate the pointer and return its exact immutable asset allowlist."""
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"publication root is not a directory: {root}")
    manifest_path = contained_file(root, "manifest.json")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("manifest.json is not valid UTF-8 JSON") from error
    if not isinstance(manifest, dict) or manifest.get("schema") != "historical-flight-trails-v1":
        raise ValueError("manifest schema is not historical-flight-trails-v1")
    if manifest.get("license_status") != PUBLICATION_LICENSE_STATUS:
        raise ValueError("manifest license_status is not verified for public display")
    release_id = manifest.get("release_id")
    if not isinstance(release_id, str) or not RELEASE_ID.fullmatch(release_id):
        raise ValueError("manifest release_id is unsafe")
    samples = manifest.get("samples")
    if not isinstance(samples, list) or not samples:
        raise ValueError("manifest samples must be a nonempty array")

    entries: list[dict[str, Any]] = []
    seen_paths: set[str] = set()
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict):
            raise ValueError(f"manifest sample {index} is not an object")
        asset = sample.get("asset")
        if asset is None:
            continue
        if not isinstance(asset, dict):
            raise ValueError(f"manifest sample {index} asset is not an object")
        relative = safe_relative(asset.get("path"))
        path_match = ASSET_PATH.fullmatch(relative)
        if not path_match or path_match.group(1) != release_id:
            raise ValueError(f"asset is outside manifest release: {relative}")
        if relative in seen_paths:
            raise ValueError(f"duplicate manifest asset: {relative}")
        seen_paths.add(relative)
        expected_bytes = require_count(asset.get("bytes"), f"asset bytes for {relative}")
        expected_sha = asset.get("sha256")
        if not isinstance(expected_sha, str) or not HEX_SHA256.fullmatch(expected_sha):
            raise ValueError(f"asset SHA-256 is invalid: {relative}")
        local = contained_file(root, relative)
        actual_sha, actual_bytes = sha256_path(local)
        if (actual_bytes, actual_sha) != (expected_bytes, expected_sha):
            raise ValueError(f"local bytes/SHA-256 mismatch: {relative}")
        entries.append({
            "relative_path": relative,
            "destination_key": f"{PREFIX}/{relative}",
            "local_path": local,
            "sha256": expected_sha,
            "bytes": expected_bytes,
            "content_type": "application/geo+json",
            "cache_control": IMMUTABLE_CACHE,
            "kind": "immutable",
        })

    if not entries:
        raise ValueError("manifest contains no publishable flight-trail assets")
    expected_files = {"manifest.json", *seen_paths}
    actual_files: set[str] = set()
    for candidate in root.rglob("*"):
        if candidate.is_symlink():
            raise ValueError(f"symlink is not allowed in publication root: {candidate.relative_to(root)}")
        if candidate.is_file():
            actual_files.add(candidate.relative_to(root).as_posix())
    if actual_files != expected_files:
        extra = sorted(actual_files - expected_files)
        missing = sorted(expected_files - actual_files)
        raise ValueError(f"publication root has unreferenced or missing files: extra={extra}, missing={missing}")

    manifest_sha, manifest_bytes = sha256_path(manifest_path)
    entries.sort(key=lambda entry: entry["relative_path"])
    entries.append({
        "relative_path": "manifest.json",
        "destination_key": f"{PREFIX}/manifest.json",
        "local_path": manifest_path,
        "sha256": manifest_sha,
        "bytes": manifest_bytes,
        "content_type": "application/json",
        "cache_control": MANIFEST_CACHE,
        "kind": "manifest",
    })
    return manifest, entries


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, sort_keys=True)
        stream.write("\n")
        temporary = Path(stream.name)
    os.replace(temporary, path)


def load_client(env_file: Path):
    """Load named S3 configuration from .env without ever printing its values."""
    import boto3
    from dotenv import dotenv_values

    config = dotenv_values(env_file)
    required = ("S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY")
    missing = [name for name in required if not config.get(name)]
    if missing:
        raise ValueError(f"missing S3 configuration keys: {', '.join(missing)}")
    client = boto3.client(
        "s3",
        region_name=config.get("S3_REGION") or "ap-southeast-2",
        aws_access_key_id=config["S3_ACCESS_KEY"],
        aws_secret_access_key=config["S3_SECRET_KEY"],
    )
    return client, str(config["S3_BUCKET"])


def error_code(error: Exception) -> str | None:
    response = getattr(error, "response", None)
    if isinstance(response, dict):
        code = response.get("Error", {}).get("Code")
        return str(code) if code is not None else None
    return None


def object_readback(client: Any, bucket: str, entry: dict[str, Any]) -> dict[str, Any]:
    response = client.get_object(Bucket=bucket, Key=entry["destination_key"])
    body = response["Body"]
    try:
        digest, size = sha256_stream(body)
    finally:
        close = getattr(body, "close", None)
        if callable(close):
            close()
    if digest != entry["sha256"] or size != entry["bytes"]:
        raise ValueError(f"S3 bytes/SHA-256 readback mismatch: {entry['relative_path']}")
    if response.get("ContentType") != entry["content_type"] or response.get("CacheControl") != entry["cache_control"]:
        raise ValueError(f"S3 header readback mismatch: {entry['relative_path']}")
    return {
        "etag": response.get("ETag"),
        "readback_sha256": digest,
        "readback_bytes": size,
        "content_type": response.get("ContentType"),
        "cache_control": response.get("CacheControl"),
    }


def publish_immutable(client: Any, bucket: str, entry: dict[str, Any]) -> dict[str, Any]:
    """Create only; a collision is accepted solely after a full verified readback."""
    status = "uploaded_and_verified"
    try:
        with entry["local_path"].open("rb") as body:
            client.put_object(
                Bucket=bucket,
                Key=entry["destination_key"],
                Body=body,
                IfNoneMatch="*",
                ContentType=entry["content_type"],
                CacheControl=entry["cache_control"],
                Metadata={"sha256": entry["sha256"]},
            )
    except Exception as error:
        if error_code(error) not in PRECONDITION_FAILED:
            raise
        status = "verified_existing"
    return {
        "relative_path": entry["relative_path"],
        "key": entry["destination_key"],
        "status": status,
        **object_readback(client, bucket, entry),
    }


def fetch_remote_pointer(client: Any, bucket: str, entry: dict[str, Any]) -> tuple[bool, str | None, str | None, dict[str, Any] | None]:
    try:
        response = client.get_object(Bucket=bucket, Key=entry["destination_key"])
    except Exception as error:
        if error_code(error) in NOT_FOUND:
            return False, None, None, None
        raise
    body = response["Body"]
    try:
        digest, size = sha256_stream(body)
    finally:
        close = getattr(body, "close", None)
        if callable(close):
            close()
    return True, digest, response.get("ETag"), {
        "etag": response.get("ETag"),
        "readback_sha256": digest,
        "readback_bytes": size,
        "content_type": response.get("ContentType"),
        "cache_control": response.get("CacheControl"),
    }


def publish_manifest(client: Any, bucket: str, entry: dict[str, Any], expected_sha256: str | None, expected_etag: str | None) -> dict[str, Any]:
    """Publish the mutable pointer last, with a caller-approved compare-and-swap."""
    if expected_sha256 is not None and not HEX_SHA256.fullmatch(expected_sha256):
        raise ValueError("--expected-manifest-sha256 must be a lowercase SHA-256")
    if expected_etag is not None and (not isinstance(expected_etag, str) or not expected_etag):
        raise ValueError("--expected-manifest-etag must be nonempty")
    exists, remote_sha, remote_etag, remote = fetch_remote_pointer(client, bucket, entry)
    if exists and remote_sha == entry["sha256"]:
        # Same bytes still need the complete header/byte readback contract.
        if remote is None or remote["readback_bytes"] != entry["bytes"] or remote["content_type"] != entry["content_type"] or remote["cache_control"] != entry["cache_control"]:
            raise ValueError("existing manifest readback does not meet publication contract")
        return {"relative_path": entry["relative_path"], "key": entry["destination_key"], "status": "verified_existing", **remote}
    if exists:
        if expected_sha256 is None and expected_etag is None:
            raise ValueError("remote manifest differs; pass --expected-manifest-sha256 or --expected-manifest-etag")
        if expected_sha256 is not None and expected_sha256 != remote_sha:
            raise ValueError("remote manifest SHA-256 does not match --expected-manifest-sha256")
        if expected_etag is not None and expected_etag != remote_etag:
            raise ValueError("remote manifest ETag does not match --expected-manifest-etag")
        if not remote_etag:
            raise ValueError("remote manifest has no ETag for conditional overwrite")
        conditional = {"IfMatch": remote_etag}
        status = "updated_and_verified"
    else:
        conditional = {"IfNoneMatch": "*"}
        status = "created_and_verified"
    with entry["local_path"].open("rb") as body:
        client.put_object(
            Bucket=bucket,
            Key=entry["destination_key"],
            Body=body,
            ContentType=entry["content_type"],
            CacheControl=entry["cache_control"],
            Metadata={"sha256": entry["sha256"]},
            **conditional,
        )
    return {
        "relative_path": entry["relative_path"],
        "key": entry["destination_key"],
        "status": status,
        **object_readback(client, bucket, entry),
    }


def publish_in_order(client: Any, bucket: str, entries: list[dict[str, Any]], expected_sha256: str | None, expected_etag: str | None, record) -> None:
    immutable, manifest = entries[:-1], entries[-1]
    # No more than four requests run at once; the manifest pointer waits for all assets.
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(publish_immutable, client, bucket, entry) for entry in immutable]
        for future in concurrent.futures.as_completed(futures):
            record(future.result())
    record(publish_manifest(client, bucket, manifest, expected_sha256, expected_etag))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("public/flight-trails"), help="local flight-trails root")
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true", help="perform S3 writes; otherwise only validate and write a receipt")
    parser.add_argument("--expected-manifest-sha256")
    parser.add_argument("--expected-manifest-etag")
    args = parser.parse_args()

    manifest, entries = manifest_entries(args.root)
    root = args.root.resolve()
    try:
        args.receipt.resolve().relative_to(root)
    except ValueError:
        pass
    else:
        raise ValueError("receipt path must be outside the publication root")
    receipt: dict[str, Any] = {
        "schema": "historical-flight-trails-publication-receipt-v1",
        "release_id": manifest["release_id"],
        "root": str(args.root),
        "prefix": PREFIX,
        "apply": args.apply,
        "started_at": utc_now(),
        "objects": [{
            "relative_path": entry["relative_path"], "key": entry["destination_key"],
            "expected_sha256": entry["sha256"], "expected_bytes": entry["bytes"],
            "content_type": entry["content_type"], "cache_control": entry["cache_control"], "status": "planned",
        } for entry in entries],
    }
    atomic_json(args.receipt, receipt)
    if not args.apply:
        receipt["completed_at"] = utc_now()
        atomic_json(args.receipt, receipt)
        print(f"Validated {len(entries)} exact objects; receipt: {args.receipt}")
        return
    client, bucket = load_client(args.env_file)
    positions = {entry["relative_path"]: index for index, entry in enumerate(entries)}

    def record(result: dict[str, Any]) -> None:
        receipt["objects"][positions[result["relative_path"]]].update(result)
        atomic_json(args.receipt, receipt)

    publish_in_order(client, bucket, entries, args.expected_manifest_sha256, args.expected_manifest_etag, record)
    receipt["completed_at"] = utc_now()
    atomic_json(args.receipt, receipt)
    print(f"Published and read back {len(entries)} exact objects; receipt: {args.receipt}")


if __name__ == "__main__":
    main()
