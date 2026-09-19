#!/usr/bin/env python3
"""Install verified, size-bounded JP pilot assets; no network or publication."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

FILES = [
    ('buildings-grid/building_grid.pmtiles', 'building_grid.pmtiles', 5_000_000),
    ('buildings-grid/manifest.json', 'building-grid-manifest.json', 1_000_000),
    ('canopy/canopy.pmtiles', 'canopy.pmtiles', 25_000_000),
    ('canopy/manifest.json', 'canopy-manifest.json', 1_000_000),
    ('buildings/buildings.pmtiles', 'buildings.pmtiles', 25_000_000),
    ('buildings/receipt.json', 'buildings-manifest.json', 2_000_000),
]

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def install(source, target):
    # Check all limits before reading or copying any payload. National expansion
    # must shard and review limits instead of replacing the pilot with a huge file.
    for relative, _, limit in FILES:
        if (source / relative).stat().st_size > limit:
            raise ValueError(f'Pilot asset budget exceeded: {relative} > {limit} bytes')
    canopy = json.loads((source / 'canopy/manifest.json').read_text())
    buildings = json.loads((source / 'buildings/receipt.json').read_text())
    grid = json.loads((source / 'buildings-grid/manifest.json').read_text())
    for relative, expected in [
        ('canopy/canopy.pmtiles', canopy['artifact']['sha256']),
        ('buildings/buildings.pmtiles', buildings['artifacts']['pmtiles']['sha256']),
        ('buildings-grid/building_grid.pmtiles', grid['artifacts']['pmtiles']['sha256']),
    ]:
        if digest(source / relative) != expected:
            raise ValueError(f'Checksum mismatch: {relative}')
    if not 0 <= buildings['height_non_null_count'] <= buildings['feature_count'] or buildings['feature_count'] <= 0:
        raise ValueError('Invalid building counts')
    if grid['artifacts']['pmtiles']['max_compressed_tile_bytes'] > 512_000:
        raise ValueError('Grid tile budget exceeded: 512000 bytes')
    target.mkdir(parents=True, exist_ok=True)
    for relative, destination, _ in FILES:
        shutil.copy2(source / relative, target / destination)
        print(destination, digest(target / destination))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='analytics worktree data/jp-heights directory')
    args = parser.parse_args()
    install(args.source, Path(__file__).resolve().parents[2] / 'public/jp-heights')
