#!/usr/bin/env python3
"""Publish the four 20260906 bridge archives without overwriting existing objects.

Default is an offline plan. --apply loads S3 credentials, conditionally creates
objects and reads each object back to verify SHA-256. Raw inputs are archived
outside deploy-assets so the web container does not download or serve them.
Requires boto3 and python-dotenv (analytics venv already supplies both).
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

BUILD = "20260906"
TILES = (
    f"osm_bridge_carriers_{BUILD}.pmtiles",
    f"osm_bridge_footprints_{BUILD}.pmtiles",
    f"official_bridges_new_taipei_{BUILD}.pmtiles",
    f"bridge_comparison_new_taipei_{BUILD}.pmtiles",
)
RAW_INPUTS = (
    "taiwan-260905.osm.pbf", "taiwan-260905.osm.pbf.md5",
    f"official_bridges_new_taipei_{BUILD}.csv", "official_bridges_metadata.json",
    "official_bridges.headers", "county_boundary_20260626.geojson",
)


def digest(stream) -> str:
    h = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    files = [(args.artifacts / name, f"deploy-assets/network_structures/{name}") for name in TILES]
    for name in (f"metadata_{BUILD}.json", f"qc_{BUILD}.json", "_manifest.json"):
        files.append((args.artifacts / name, f"source-archives/network_structures/{BUILD}/{name}"))
    files.extend((args.raw_dir / name, f"source-archives/network_structures/{BUILD}/raw/{name}") for name in RAW_INPUTS)
    plan = []
    for path, key in files:
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"Missing or empty input: {path.name}")
        with path.open("rb") as stream:
            if path.suffix == ".pmtiles" and stream.read(8) != b"PMTiles\x03":
                raise SystemExit(f"Invalid PMTiles v3 archive: {path.name}")
            stream.seek(0)
            sha = digest(stream)
        plan.append({"key": key, "size_bytes": path.stat().st_size, "sha256": sha, "status": "planned"})
    metadata = json.loads((args.artifacts / f"metadata_{BUILD}.json").read_text())
    qc = json.loads((args.artifacts / f"qc_{BUILD}.json").read_text())
    if metadata.get("build_id") != BUILD or qc.get("build_id") != BUILD:
        raise SystemExit("Build receipt does not identify this release")
    expected = {asset["filename"]: asset["sha256"] for asset in metadata["assets"].values()}
    if set(expected) != set(TILES):
        raise SystemExit("Build receipt does not contain exactly the four bridge archives")
    expected.update({Path(entry["path"]).name: entry["sha256"] for entry in qc["inputs"].values()})
    for (path, _), item in zip(files, plan):
        if path.name in expected and expected[path.name] != item["sha256"]:
            raise SystemExit(f"Input changed after build verification: {path.name}")
    if args.apply:
        import boto3
        from botocore.exceptions import ClientError
        from dotenv import dotenv_values

        config = dotenv_values(args.env_file)
        for key in ("S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
            if not config.get(key):
                raise SystemExit(f"Missing configuration key: {key}")
        client = boto3.client("s3", region_name=config.get("S3_REGION") or "ap-southeast-2",
                              aws_access_key_id=config["S3_ACCESS_KEY"], aws_secret_access_key=config["S3_SECRET_KEY"])
        bucket = config["S3_BUCKET"]
        for (path, key), item in zip(files, plan):
            exists = True
            try:
                client.head_object(Bucket=bucket, Key=key)
            except ClientError as error:
                if error.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
                    raise SystemExit(f"S3 lookup failed for {path.name}") from None
                exists = False
            if not exists:
                with path.open("rb") as stream:
                    try:
                        client.put_object(Bucket=bucket, Key=key, Body=stream, IfNoneMatch="*",
                                          Metadata={"sha256": item["sha256"]},
                                          ContentType="application/vnd.pmtiles" if path.suffix == ".pmtiles" else "application/octet-stream")
                    except ClientError:
                        raise SystemExit(f"Conditional upload failed for {path.name}; no existing object replaced") from None
            response = client.get_object(Bucket=bucket, Key=key)
            body = response["Body"]
            try:
                actual = digest(body)
            finally:
                body.close()
            if actual != item["sha256"]:
                raise SystemExit(f"Existing object differs: {path.name}; refusing replacement")
            item["status"] = "verified_existing" if exists else "uploaded_and_verified"
            args.receipt.parent.mkdir(parents=True, exist_ok=True)
            args.receipt.write_text(json.dumps({"build": BUILD, "objects": plan}, indent=2) + "\n")
            print(f"{item['status']}: {path.name}", flush=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps({"build": BUILD, "objects": plan}, indent=2) + "\n")
    print(f"{'Verified' if args.apply else 'Planned'} {len(plan)} objects; receipt: {args.receipt}")


if __name__ == "__main__":
    main()
