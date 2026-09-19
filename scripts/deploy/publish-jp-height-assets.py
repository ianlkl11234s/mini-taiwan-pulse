#!/usr/bin/env python3
"""Publish the reviewed Japan-height catalog allowlist; dry-run is the default."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")
ASSET_PATH = re.compile(r"^assets/([0-9a-f]{64})\.pmtiles$")
PREFIX = "deploy-assets/jp-heights/"
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
CATALOG_CACHE = "public, max-age=60"
MAX_ASSETS = 500
MAX_CATALOG_BYTES = 2 * 1024 * 1024


def sha256_path(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def sha256_stream(stream) -> tuple[str, int]:
    value, size = hashlib.sha256(), 0
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        value.update(block)
        size += len(block)
    return value.hexdigest(), size


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        temporary = Path(stream.name)
    os.replace(temporary, path)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _asset_records(catalog: dict) -> list[dict]:
    values: list[object] = []
    regions = catalog.get("regions")
    if not isinstance(regions, list) or not regions:
        raise ValueError("catalog regions must be a nonempty list")
    for region in regions:
        if not isinstance(region, dict):
            raise ValueError("catalog region must be an object")
        values.extend(region.get(key) for key in ("buildings", "grid", "canopy"))
    values.extend(catalog.get(key) for key in ("overview", "canopyOverview"))
    records: dict[str, dict] = {}
    for value in values:
        if value is None:
            continue
        if not isinstance(value, dict):
            raise ValueError("catalog asset must be an object")
        url = value.get("url")
        if not isinstance(url, str) or not url.startswith("./jp-heights/"):
            raise ValueError("catalog asset URL is outside jp-heights")
        relative = url.removeprefix("./jp-heights/")
        match = ASSET_PATH.fullmatch(relative)
        digest, size = value.get("sha256"), value.get("bytes")
        if not match or not isinstance(digest, str) or not HEX.fullmatch(digest) or match.group(1) != digest:
            raise ValueError(f"asset path/SHA mismatch: {relative}")
        if not isinstance(size, int) or size <= 0 or size > 25 * 1024 * 1024:
            raise ValueError(f"asset byte budget invalid: {relative}")
        existing = records.get(relative)
        record = {"relative_path": relative, "sha256": digest, "bytes": size}
        if existing is not None and existing != record:
            raise ValueError(f"conflicting duplicate asset: {relative}")
        records[relative] = record
    if not records or len(records) > MAX_ASSETS:
        raise ValueError("catalog asset count is outside the publication budget")
    return [records[key] for key in sorted(records)]


def validate_catalog(root: Path) -> tuple[dict, list[dict]]:
    root = root.resolve()
    catalog_path = root / "catalog.json"
    if not catalog_path.is_file() or catalog_path.stat().st_size > MAX_CATALOG_BYTES:
        raise ValueError("catalog is missing or exceeds 2 MiB")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, dict) or catalog.get("schema") != "jp-height-catalog-v1" or not isinstance(catalog.get("version"), str):
        raise ValueError("catalog schema/version is invalid")
    entries = []
    for record in _asset_records(catalog):
        local = (root / record["relative_path"]).resolve()
        if root not in local.parents or not local.is_file():
            raise ValueError(f"missing catalog asset: {record['relative_path']}")
        if local.stat().st_size != record["bytes"] or sha256_path(local) != record["sha256"]:
            raise ValueError(f"local bytes/SHA-256 mismatch: {record['relative_path']}")
        entries.append({
            **record,
            "local_path": local,
            "destination_key": PREFIX + record["relative_path"],
            "content_type": "application/vnd.pmtiles",
            "cache_control": IMMUTABLE_CACHE,
        })
    entries.append({
        "relative_path": "catalog.json",
        "sha256": sha256_path(catalog_path),
        "bytes": catalog_path.stat().st_size,
        "local_path": catalog_path,
        "destination_key": PREFIX + "catalog.json",
        "content_type": "application/json",
        "cache_control": CATALOG_CACHE,
        "write_order": "last",
    })
    return catalog, entries


def load_client(env_file: Path):
    import boto3
    from dotenv import dotenv_values

    config = dotenv_values(env_file)
    for name in ("S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
        if not config.get(name):
            raise ValueError(f"missing configuration key: {name}")
    client = boto3.client(
        "s3",
        region_name=config.get("S3_REGION") or "ap-southeast-2",
        aws_access_key_id=config["S3_ACCESS_KEY"],
        aws_secret_access_key=config["S3_SECRET_KEY"],
    )
    return client, str(config["S3_BUCKET"])


def readback(client, bucket: str, entry: dict) -> dict:
    response = client.get_object(Bucket=bucket, Key=entry["destination_key"])
    body = response["Body"]
    try:
        digest, size = sha256_stream(body)
    finally:
        body.close()
    if (
        digest != entry["sha256"]
        or size != entry["bytes"]
        or response.get("ContentType") != entry["content_type"]
        or response.get("CacheControl") != entry["cache_control"]
    ):
        raise ValueError(f"S3 readback mismatch: {entry['relative_path']}")
    return {"etag": response.get("ETag"), "content_type": response.get("ContentType"), "cache_control": response.get("CacheControl")}


def publish_immutable(client, bucket: str, entry: dict) -> dict:
    from botocore.exceptions import ClientError

    existed = True
    try:
        client.head_object(Bucket=bucket, Key=entry["destination_key"])
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") not in {"404", "NoSuchKey", "NotFound"}:
            raise
        existed = False
    if not existed:
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
        except ClientError:
            existed = True
    metadata = readback(client, bucket, entry)
    return {"relative_path": entry["relative_path"], "status": "verified_existing" if existed else "uploaded_and_verified", **metadata}


def publish_catalog(client, bucket: str, entry: dict, expected_sha: str | None, expected_etag: str | None) -> dict:
    from botocore.exceptions import ClientError

    existed, remote_sha, remote_etag = True, None, None
    try:
        response = client.get_object(Bucket=bucket, Key=entry["destination_key"])
        body = response["Body"]
        try:
            remote_sha, _ = sha256_stream(body)
        finally:
            body.close()
        remote_etag = response.get("ETag")
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") not in {"404", "NoSuchKey", "NotFound"}:
            raise
        existed = False
    if existed and remote_sha == entry["sha256"]:
        return {"relative_path": entry["relative_path"], "status": "verified_existing", **readback(client, bucket, entry)}
    if existed and expected_sha != remote_sha and expected_etag != remote_etag:
        raise ValueError("remote catalog differs; pass its --expected-catalog-sha256 or --expected-catalog-etag")
    kwargs = {
        "Bucket": bucket,
        "Key": entry["destination_key"],
        "ContentType": entry["content_type"],
        "CacheControl": entry["cache_control"],
        "Metadata": {"sha256": entry["sha256"]},
        "IfMatch" if existed else "IfNoneMatch": remote_etag if existed else "*",
    }
    with entry["local_path"].open("rb") as body:
        client.put_object(Body=body, **kwargs)
    return {"relative_path": entry["relative_path"], "status": "updated_and_verified" if existed else "created_and_verified", **readback(client, bucket, entry)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("public/jp-heights"))
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-catalog-sha256")
    parser.add_argument("--expected-catalog-etag")
    args = parser.parse_args()
    catalog, entries = validate_catalog(args.root)
    receipt = {
        "catalog_version": catalog["version"],
        "apply": args.apply,
        "started_at": utc_now(),
        "objects": [
            {"relative_path": item["relative_path"], "key": item["destination_key"], "expected_sha256": item["sha256"], "expected_bytes": item["bytes"], "status": "planned"}
            for item in entries
        ],
    }
    atomic_json(args.receipt, receipt)
    if args.apply:
        client, bucket = load_client(args.env_file)
        positions = {item["relative_path"]: index for index, item in enumerate(entries)}

        def record(result: dict) -> None:
            receipt["objects"][positions[result["relative_path"]]].update(result)
            atomic_json(args.receipt, receipt)

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(publish_immutable, client, bucket, entry) for entry in entries[:-1]]
            for future in concurrent.futures.as_completed(futures):
                record(future.result())
        record(publish_catalog(client, bucket, entries[-1], args.expected_catalog_sha256, args.expected_catalog_etag))
    receipt["completed_at"] = utc_now()
    atomic_json(args.receipt, receipt)
    verb = "Published and read back" if args.apply else "Planned"
    print(f"{verb} {len(entries)} exact objects; receipt: {args.receipt}")


if __name__ == "__main__":
    main()
