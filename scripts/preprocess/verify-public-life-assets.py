#!/usr/bin/env python3
"""Verify local Public Life payloads against the tracked release contract."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public" / "public_life"
MANIFEST = ASSET_DIR / "manifest.json"


def main() -> None:
    contract = json.loads(MANIFEST.read_text(encoding="utf-8"))
    pmtiles = shutil.which("pmtiles")
    decoder = shutil.which("tippecanoe-decode")
    failures: list[str] = []
    for asset in contract["assets"]:
        path = ASSET_DIR / asset["path"]
        if not path.is_file():
            failures.append(f"missing: {path}")
            continue
        payload = path.read_bytes()
        if len(payload) != asset["bytes"]:
            failures.append(f"bytes: {asset['path']}")
        if hashlib.sha256(payload).hexdigest() != asset["sha256"]:
            failures.append(f"sha256: {asset['path']}")
        if asset["format"] == "geojson":
            document = json.loads(payload)
            if document.get("type") != "FeatureCollection":
                failures.append(f"geojson type: {asset['path']}")
            if len(document.get("features", [])) != asset["source_feature_count"]:
                failures.append(f"feature count: {asset['path']}")
            if asset.get("point_sampling") == "none":
                features = document.get("features", [])
                if any((feature.get("geometry") or {}).get("type") != "Point" for feature in features):
                    failures.append(f"point-display geometry: {asset['path']}")
                ids = {
                    str(feature.get("properties", {}).get("entity_id"))
                    for feature in features
                    if feature.get("properties", {}).get("entity_id")
                }
                if len(ids) != asset["source_feature_count"]:
                    failures.append(f"point-display entity count: {asset['path']} ({len(ids)})")
        elif not payload.startswith(b"PMTiles"):
            failures.append(f"pmtiles magic: {asset['path']}")
        if asset["format"] == "pmtiles" and pmtiles:
            result = subprocess.run(
                [pmtiles, "show", "--metadata", str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
            metadata = json.loads(result.stdout)
            layers = metadata.get("vector_layers", [])
            if not any(layer.get("id") == asset["source_layer"] for layer in layers):
                failures.append(f"source layer: {asset['path']}")
            if asset.get("point_sampling") == "none":
                options = str(metadata.get("generator_options") or "")
                if any(token in options for token in ("drop-densest", "drop-fraction", "cluster-distance")):
                    failures.append(f"point sampling: {asset['path']}")
                header = subprocess.run(
                    [pmtiles, "show", str(path)],
                    check=True,
                    capture_output=True,
                    text=True,
                ).stdout
                min_match = re.search(r"^min zoom: (\d+)$", header, re.MULTILINE)
                max_match = re.search(r"^max zoom: (\d+)$", header, re.MULTILINE)
                if not min_match or int(min_match.group(1)) != asset["minzoom"]:
                    failures.append(f"minzoom: {asset['path']}")
                if not max_match or int(max_match.group(1)) != asset["maxzoom"]:
                    failures.append(f"maxzoom: {asset['path']}")
                if decoder:
                    decoded = json.loads(subprocess.run(
                        [decoder, str(path), "0", "0", "0"],
                        check=True,
                        capture_output=True,
                        text=True,
                    ).stdout)
                    tile_layer = next(
                        (item for item in decoded.get("features", [])
                         if item.get("properties", {}).get("layer") == asset["source_layer"]),
                        None,
                    )
                    ids = {
                        str(feature.get("properties", {}).get("entity_id"))
                        for feature in (tile_layer or {}).get("features", [])
                        if feature.get("properties", {}).get("entity_id")
                    }
                    if len(ids) != asset["z0_entity_count"]:
                        failures.append(f"z0 entity count: {asset['path']} ({len(ids)})")
    if failures:
        raise SystemExit("public-life asset verification failed:\n- " + "\n- ".join(failures))
    print(f"verified {len(contract['assets'])} public-life assets ({contract['release_id']})")


if __name__ == "__main__":
    main()
