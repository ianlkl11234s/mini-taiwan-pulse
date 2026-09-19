#!/usr/bin/env python3
"""Publish the reviewed Japan medical payload; dry-run is the default."""
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
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
CURRENT_CACHE = "public, max-age=60"
PREFIX = "deploy-assets/jp-medical/"
LEGACY_ASSET_COUNT = 778
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
DENSITY_ASSET_PATHS = frozenset({
    "aggregates/h17-density-10km.geojson",
    "aggregates/navii-density-10km.geojson",
})


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_stream(stream) -> tuple[str, int]:
    digest, size = hashlib.sha256(), 0
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
        size += len(chunk)
    return digest.hexdigest(), size


def safe_relative(value: object) -> str:
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise ValueError("path must be a nonempty relative string")
    path = Path(value)
    if any(part in ("", ".", "..") for part in path.parts):
        raise ValueError(f"unsafe path: {value}")
    return value


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        temporary = Path(stream.name)
    os.replace(temporary, path)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_asset_paths(paths: set[str]) -> None:
    if len(paths) == LEGACY_ASSET_COUNT:
        if not all(path.startswith(("points/", "areas/", "aggregates/", "details/")) for path in paths):
            raise ValueError("legacy asset outside payload allowlist")
        return
    if paths not in (PREVIOUS_COMPACT_ASSET_PATHS, COMPACT_ASSET_PATHS):
        raise ValueError("assets must be the legacy payload or the exact compact payload")


def validate_catalog_contract(catalog: object, version: str, asset_files: dict) -> None:
    if (not isinstance(catalog, dict) or catalog.get("version") != version
            or catalog.get("status") != "LOCAL_READY_NOT_DEPLOYED"
            or catalog.get("files") != asset_files):
        raise ValueError("catalog does not exactly bind plan assets")
    if set(asset_files) in (PREVIOUS_COMPACT_ASSET_PATHS, COMPACT_ASSET_PATHS):
        if catalog.get("detail_buckets") != {} or not isinstance(catalog.get("layers"), list):
            raise ValueError("compact catalog must declare no detail buckets")
        if any(not isinstance(layer, dict) or layer.get("detail_reference") is not None for layer in catalog["layers"]):
            raise ValueError("compact catalog must not reference retired detail hours")


def validate_manifest_catalog(meta: object, catalog_entry: dict) -> None:
    if (not isinstance(meta, dict) or meta.get("sha256") != catalog_entry["sha256"]
            or meta.get("bytes") != catalog_entry["bytes"]
            or ("path" in meta and meta["path"] != "catalog.json")):
        raise ValueError("publication manifest does not bind catalog digest")


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
        output[relative] = {"sha256": value["sha256"], "bytes": value["bytes"]}
    return output


def validate_plan(root: Path, plan_path: Path) -> tuple[dict, list[dict]]:
    plan = json.loads(plan_path.read_text())
    version = plan.get("version")
    if not isinstance(version, str) or not HEX.fullmatch(version):
        raise ValueError("plan version must be SHA-256")
    entries = plan.get("entries")
    if not isinstance(entries, list) or len(entries) not in {5, 10, 781}:
        raise ValueError("plan must contain exactly 781 legacy, 10 compact, or 5 inherited-release entries")
    expected_prefix = PREFIX + "releases/" + version + "/"
    seen_paths, seen_keys, validated = set(), set(), []
    for position, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError("plan entry must be an object")
        relative = safe_relative(entry.get("relative_path"))
        key = entry.get("destination_key")
        if not isinstance(key, str) or (key != PREFIX + "current.json" if relative == "current.json" else key != expected_prefix + relative.removeprefix("releases/" + version + "/")):
            raise ValueError(f"destination key mismatch: {relative}")
        if relative in seen_paths or key in seen_keys:
            raise ValueError(f"duplicate allowlist entry: {relative}")
        seen_paths.add(relative); seen_keys.add(key)
        if not isinstance(entry.get("bytes"), int) or entry["bytes"] < 0 or not isinstance(entry.get("sha256"), str) or not HEX.fullmatch(entry["sha256"]):
            raise ValueError(f"invalid digest metadata: {relative}")
        is_current = relative == "current.json"
        if is_current != (position == len(entries) - 1):
            raise ValueError("current.json must be the final entry")
        if entry.get("cache_control") != (CURRENT_CACHE if is_current else IMMUTABLE_CACHE):
            raise ValueError(f"cache contract mismatch: {relative}")
        if is_current and entry.get("write_order") != "last":
            raise ValueError("current.json must declare write_order=last")
        if not is_current and not relative.startswith("releases/" + version + "/"):
            raise ValueError(f"immutable path outside release: {relative}")
        local = (root / relative).resolve()
        if root.resolve() not in local.parents or not local.is_file():
            raise ValueError(f"missing local allowlist file: {relative}")
        if local.stat().st_size != entry["bytes"] or sha256_path(local) != entry["sha256"]:
            raise ValueError(f"local bytes/SHA-256 mismatch: {relative}")
        validated.append({**entry, "local_path": local})
    if plan.get("total_all_publication_bytes") != sum(item["bytes"] for item in validated):
        raise ValueError("publication total mismatch")
    catalog_rel = f"releases/{version}/catalog.json"
    publication_rel = f"releases/{version}/publication-manifest.json"
    if [item["relative_path"] for item in validated[-3:]] != [catalog_rel, publication_rel, "current.json"]:
        raise ValueError("assets must precede catalog, publication manifest, and current")
    asset_entries = validated[:-3]
    asset_files = {
        item["relative_path"].removeprefix(f"releases/{version}/"): {
            "sha256": item["sha256"], "bytes": item["bytes"],
        }
        for item in asset_entries
    }
    catalog = json.loads((root / catalog_rel).read_text())
    manifest = json.loads((root / publication_rel).read_text())
    inherited = inherited_files(manifest) if isinstance(manifest, dict) else {}
    if set(asset_files) & set(inherited):
        raise ValueError("published and inherited assets overlap")
    effective_files = {**inherited, **asset_files}
    validate_asset_paths(set(effective_files))
    if inherited and set(asset_files) != DENSITY_ASSET_PATHS:
        raise ValueError("inherited density release must publish exactly two grid assets")
    validate_catalog_contract(catalog, version, effective_files)
    catalog_entry, manifest_entry = validated[-3], validated[-2]
    if (not isinstance(manifest, dict) or manifest.get("version") != version
            or manifest.get("files") != asset_files
            or manifest_entry["sha256"] != sha256_path(root / publication_rel)
            or manifest_entry["bytes"] != (root / publication_rel).stat().st_size):
        raise ValueError("publication manifest does not exactly bind catalog and plan assets")
    validate_manifest_catalog(manifest.get("catalog"), catalog_entry)
    current = json.loads((root / "current.json").read_text())
    if current.get("version") != version or current.get("catalog") != f"releases/{version}/catalog.json" or current.get("publication_manifest") != f"releases/{version}/publication-manifest.json":
        raise ValueError("current pointer does not bind this plan version")
    return plan, validated


def load_client(env_file: Path):
    import boto3
    from dotenv import dotenv_values
    config = dotenv_values(env_file)
    for name in ("S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
        if not config.get(name):
            raise ValueError(f"missing configuration key: {name}")
    return boto3.client("s3", region_name=config.get("S3_REGION") or "ap-southeast-2", aws_access_key_id=config["S3_ACCESS_KEY"], aws_secret_access_key=config["S3_SECRET_KEY"]), config["S3_BUCKET"]


def readback(client, bucket: str, entry: dict) -> dict:
    response = client.get_object(Bucket=bucket, Key=entry["destination_key"])
    body = response["Body"]
    try:
        digest, size = sha256_stream(body)
    finally:
        body.close()
    if digest != entry["sha256"] or size != entry["bytes"] or response.get("ContentType") != entry["content_type"] or response.get("CacheControl") != entry["cache_control"]:
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
                client.put_object(Bucket=bucket, Key=entry["destination_key"], Body=body, IfNoneMatch="*", ContentType=entry["content_type"], CacheControl=entry["cache_control"], Metadata={"sha256": entry["sha256"]})
        except ClientError:
            existed = True  # Conditional race: only succeeding readback can accept it.
    readback_meta = readback(client, bucket, entry)
    return {"relative_path": entry["relative_path"], "key": entry["destination_key"], "status": "verified_existing" if existed else "uploaded_and_verified", **readback_meta}


def publish_current(client, bucket: str, entry: dict, expected_sha: str | None, expected_etag: str | None) -> dict:
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
        metadata = readback(client, bucket, entry)
        return {"relative_path": entry["relative_path"], "key": entry["destination_key"], "status": "verified_existing", **metadata}
    if existed and expected_sha != remote_sha and expected_etag != remote_etag:
        raise ValueError("remote current differs; pass its --expected-current-sha256 or --expected-current-etag")
    kwargs = {"Bucket": bucket, "Key": entry["destination_key"], "ContentType": entry["content_type"], "CacheControl": entry["cache_control"], "Metadata": {"sha256": entry["sha256"]}}
    kwargs["IfMatch" if existed else "IfNoneMatch"] = remote_etag if existed else "*"
    with entry["local_path"].open("rb") as body:
        client.put_object(Body=body, **kwargs)
    metadata = readback(client, bucket, entry)
    return {"relative_path": entry["relative_path"], "key": entry["destination_key"], "status": "updated_and_verified" if existed else "created_and_verified", **metadata}


def publish_in_order(client, bucket: str, entries: list[dict], expected_sha: str | None, expected_etag: str | None, record) -> None:
    """Assets may overlap network I/O; release metadata and pointer never do."""
    assets, catalog, publication_manifest, current = entries[:-3], entries[-3], entries[-2], entries[-1]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(publish_immutable, client, bucket, entry) for entry in assets]
        for future in concurrent.futures.as_completed(futures):
            record(future.result())
    record(publish_immutable(client, bucket, catalog))
    record(publish_immutable(client, bucket, publication_manifest))
    record(publish_current(client, bucket, current, expected_sha, expected_etag))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-current-sha256")
    parser.add_argument("--expected-current-etag")
    args = parser.parse_args()
    plan, entries = validate_plan(args.root, args.plan)
    receipt = {"version": plan["version"], "plan": str(args.plan), "apply": args.apply, "started_at": utc_now(), "objects": [{"relative_path": item["relative_path"], "key": item["destination_key"], "expected_sha256": item["sha256"], "expected_bytes": item["bytes"], "status": "planned"} for item in entries]}
    atomic_json(args.receipt, receipt)
    if not args.apply:
        receipt["completed_at"] = utc_now()
        atomic_json(args.receipt, receipt)
        print(f"Planned {len(entries)} exact objects; receipt: {args.receipt}")
        return
    client, bucket = load_client(args.env_file)
    by_relative = {item["relative_path"]: index for index, item in enumerate(entries)}
    def record(result: dict) -> None:
        receipt["objects"][by_relative[result["relative_path"]]].update(result)
        atomic_json(args.receipt, receipt)
    publish_in_order(client, bucket, entries, args.expected_current_sha256, args.expected_current_etag, record)
    receipt["completed_at"] = utc_now()
    atomic_json(args.receipt, receipt)
    print(f"Published and read back {len(entries)} exact objects; receipt: {args.receipt}")


if __name__ == "__main__":
    main()
