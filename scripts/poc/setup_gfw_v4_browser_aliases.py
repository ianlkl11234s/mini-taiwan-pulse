#!/usr/bin/env python3
"""Create local browser aliases for an immutable GFW v4 manifest.

This helper only creates symlinks and a browser-wire manifest under the given
Mini Taiwan Pulse public directory. It never uploads or deploys assets.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True, help="canonical local v4 manifest")
    parser.add_argument("--public-root", type=Path, required=True, help="Mini Taiwan Pulse public directory")
    parser.add_argument("--alias-root", type=Path, help="defaults to <public-root>/gfw-v4-browser-assets")
    parser.add_argument("--browser-manifest", type=Path, help="defaults to <public-root>/gfw-v4-browser-manifest.json")
    args = parser.parse_args()

    manifest_path = args.manifest.expanduser().resolve()
    public_root = args.public_root.expanduser().resolve()
    alias_root = (args.alias_root or public_root / "gfw-v4-browser-assets").expanduser().resolve()
    browser_manifest_path = (args.browser_manifest or public_root / "gfw-v4-browser-manifest.json").expanduser().resolve()
    if not manifest_path.is_file():
        parser.error(f"manifest not found: {manifest_path}")
    if alias_root.exists() or browser_manifest_path.exists():
        raise FileExistsError("browser alias output already exists")
    source = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = []
    alias_root.mkdir(parents=True)
    try:
        for asset in source["days"][0]["assets"]:
            source_path = (manifest_path.parent / asset["path"]).resolve()
            if not source_path.is_file():
                raise FileNotFoundError(source_path)
            suffix = "json.daypack" if asset["format"] == "json.gz" else "binary.daypack"
            alias = alias_root / f"{asset['bucket']}.{suffix}"
            alias.symlink_to(os.path.relpath(source_path, alias.parent))
            assets.append({**asset, "path": f"{alias_root.name}/{alias.name}"})
    except Exception:
        # The caller can remove this newly-created, bounded alias directory if
        # a source asset is missing; do not touch any existing path.
        raise
    browser = {
        "schema_version": source["schema_version"],
        "release_id": source["release_id"],
        "bbox": source["bbox"],
        "days": [{"display_date": source["days"][0]["display_date"], "assets": assets}],
        "local_wire_adapter": {
            "reason": "Vite sets Content-Encoding gzip for .gz suffixes",
            "payload_bytes_and_sha256_unchanged": True,
            "canonical_manifest": "gfw-v4-poc/manifest.json",
        },
    }
    browser_manifest_path.write_text(
        json.dumps(browser, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    print(browser_manifest_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
