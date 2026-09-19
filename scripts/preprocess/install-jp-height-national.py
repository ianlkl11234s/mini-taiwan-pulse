#!/usr/bin/env python3
"""Install checksum-verified, bounded Japan shards; publish local catalog last.
Requires the pmtiles CLI. No network, upload, or source-data deletion.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

LABELS = {'tokyo-shinjuku': '東京・新宿', 'osaka': '大阪', 'sapporo': '札幌', 'fukuoka': '福岡', 'naha': '那霸'}
MESH_SCHEMA = 'jp-plateau-mesh-building-height/v3'


def read(path):
    return json.loads(path.read_text())


def discover_mesh_regions(source, asset):
    """Return only complete, archived, locally-pruned standard mesh shards."""
    national = source/'national'
    plan_path = national/'building-mesh-plan.json'
    mesh_root = national/'mesh-buildings'
    if not plan_path.exists() or not mesh_root.exists():
        return []
    plan = read(plan_path)
    city_names = {city['city_code']: city['city'] for city in plan.get('cities', [])
                  if isinstance(city, dict) and city.get('city_code') and city.get('city')}
    regions = []
    for manifest_path in sorted(mesh_root.glob('*/*/manifest.json')):
        manifest = read(manifest_path)
        if manifest.get('status') != 'complete':
            continue
        city_code, mesh_code = manifest_path.parent.parent.name, manifest_path.parent.name
        if manifest.get('schema') != MESH_SCHEMA:
            raise ValueError(f'Unsupported mesh manifest schema: {manifest_path}')
        if manifest.get('city_code') != city_code or manifest.get('mesh_code') != mesh_code:
            raise ValueError(f'Mesh path/manifest identity mismatch: {manifest_path}')
        if manifest.get('coverage') != 'partial mesh; not city-wide or national coverage':
            raise ValueError(f'Mesh coverage contract mismatch: {manifest_path}')
        if manifest.get('archive', {}).get('storage_class') != 'DEEP_ARCHIVE':
            raise ValueError(f'Mesh archive is not verified Deep Archive: {manifest_path}')
        retention = manifest.get('local_retention', {})
        if retention.get('raw_pruned') is not True or retention.get('rebuildable_geojson_pruned') is not True:
            raise ValueError(f'Mesh local-retention checkpoint incomplete: {manifest_path}')
        if city_code not in city_names:
            raise ValueError(f'Mesh city is missing from building plan: {city_code}')
        shared = dict(sourceYear=manifest['source_year'], heightMethod=manifest['height_method'],
                      attribution=f"PLATEAU／{city_names[city_code]}", license=manifest['license'])
        region = dict(id=f'mesh-{city_code}-{mesh_code}', label=f'{city_names[city_code]} ・ {mesh_code}', status='ready')
        region['buildings'] = asset(manifest_path.parent/manifest['artifact']['path'], manifest['artifact'],
                                    layer='buildings', metadata=shared)
        region['grid'] = asset(manifest_path.parent/manifest['grid']['path'], manifest['grid'],
                               layer='building_grid', metadata=shared)
        bounds = [region['buildings']['bbox'], region['grid']['bbox']]
        region['bbox'] = [min(b[0] for b in bounds), min(b[1] for b in bounds),
                          max(b[2] for b in bounds), max(b[3] for b in bounds)]
        regions.append(region)
    return regions


def install(source, target):
    target.mkdir(parents=True, exist_ok=True)
    files = []

    def asset(path, expected, *, layer=None, metadata=None, bbox=None):
        limit = 5_000_000 if layer == 'building_grid' else 25_000_000
        size = path.stat().st_size
        if not 0 < size <= limit or size != expected['bytes']:
            raise ValueError(f'Asset byte budget/integrity failure: {path}')
        with path.open('rb') as stream:
            sha = hashlib.file_digest(stream, 'sha256').hexdigest()
        if sha != expected['sha256']:
            raise ValueError(f'Asset checksum failure: {path}')
        header = json.loads(subprocess.check_output(['pmtiles', 'show', str(path), '--header-json']))
        # Content-addressed files let the old catalog remain valid throughout installation.
        relative = Path('assets') / f'{sha}.pmtiles'
        files.append((path, target / relative))
        return dict(url=f'./jp-heights/{relative}', bbox=bbox or header['bounds'],
                    minzoom=header['minzoom'], maxzoom=header['maxzoom'], bytes=size,
                    sha256=sha, coverage='partial', **({'sourceLayer': layer} if layer else {}), **(metadata or {}))

    regions = []
    for region_id, label in LABELS.items():
        region = dict(id=region_id, label=label, status='ready')
        if region_id == 'tokyo-shinjuku':
            building_dir, canopy_dir, grid_dir = source/'buildings', source/'canopy', source/'buildings-grid'
            bm, gm = read(building_dir/'receipt.json'), read(grid_dir/'manifest.json')
            shared = dict(sourceYear=2025, heightMethod='bldg:measuredHeight', geometryMethod='bldg:lod0RoofEdge', attribution='PLATEAU／東京都3Dデジタルマップ', license='CC BY 4.0')
            region['buildings'] = asset(building_dir/'buildings.pmtiles', bm['artifacts']['pmtiles'], layer='buildings', metadata=shared)
            region['grid'] = asset(grid_dir/'building_grid.pmtiles', gm['artifacts']['pmtiles'], layer='building_grid', metadata=shared)
        else:
            building_dir = source/'national/buildings'/region_id
            canopy_dir = source/'national/canopy'/region_id
            if (building_dir/'manifest.json').exists():
                bm = read(building_dir/'manifest.json')
                if bm['status'] != 'LOCAL_READY' or bm['coverage'] != 'partial':
                    raise ValueError(f'Building not ready: {region_id}')
                shared = dict(sourceYear=bm['city']['source_year'], heightMethod=bm['height_method'], geometryMethod=';'.join(bm['geometry_methods']), attribution=f"PLATEAU／{bm['city']['name']}", license=bm['license'])
                for key, field, layer in [('buildings','detail','buildings'), ('grid','grid','building_grid')]:
                    region[key] = asset(building_dir/bm[field]['name'], bm[field], layer=layer, metadata=shared)
        if (canopy_dir/'manifest.json').exists():
            cm = read(canopy_dir/'manifest.json')
            region['canopy'] = asset(canopy_dir/cm['artifact']['path'], cm['artifact'], bbox=cm['bbox'], metadata=dict(sourceYear=cm['release_year'], heightMethod=cm['height_method'], attribution=cm['attribution'], license=cm['license'], pixelSizeProjectedM=cm['pixel_size_projected_m']))
        bounds = [region[k]['bbox'] for k in ('buildings','grid','canopy') if k in region]
        if not bounds:
            continue
        region['bbox'] = [min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds)]
        regions.append(region)
    regions.extend(discover_mesh_regions(source, asset))
    catalog = dict(schema='jp-height-catalog-v1', version='national-local-2026-09-19-metro-mesh-v1', regions=regions)
    overview = source/'national/overview/manifest.json'
    if overview.exists():
        om = read(overview)
        artifact = om.get('artifact', om.get('artifacts', {}).get('pmtiles'))
        if artifact and 'pmtiles' in artifact: artifact = artifact['pmtiles']
        if not artifact:
            raise ValueError('Overview manifest missing artifact')
        overview_regions = om.get('frontend_contract', {}).get('regions')
        known_regions = {region['id'] for region in regions}
        if not isinstance(overview_regions, list) or not overview_regions or not set(overview_regions) <= known_regions:
            raise ValueError('Overview manifest region coverage is invalid')
        catalog['overview'] = asset(overview.parent/'overview.pmtiles', artifact, layer='building_grid',
                                    metadata={'regionIds': overview_regions})
    canopy_overview = source/'national/canopy-overview/manifest.json'
    if canopy_overview.exists():
        cm = read(canopy_overview)
        if cm.get('status') != 'LOCAL_READY':
            raise ValueError('National canopy overview is not ready')
        catalog['canopyOverview'] = asset(canopy_overview.parent/cm['artifact']['path'], cm['artifact'], metadata=dict(sourceYear=cm['release_year'], heightMethod=cm['height_method'], attribution=cm['attribution'], license=cm['license'], pixelSizeProjectedM=cm['pixel_size_projected_m']))
        catalog['canopyOverview']['coverage'] = cm['coverage']
    if sum(p.stat().st_size for p, _ in files) > 150_000_000:
        raise ValueError('Installation exceeds 150MB campaign budget; review before expanding')
    # All inputs pass before any public payload is modified.
    for src, dest in files:
        dest.parent.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=dest.parent, prefix='.install-')
        os.close(fd)
        try:
            shutil.copyfile(src, temp)
            os.replace(temp, dest)
        finally:
            if os.path.exists(temp): os.unlink(temp)
    payload = json.dumps(catalog, ensure_ascii=False, indent=2)+'\n'
    if len(payload.encode()) > 2*1024*1024:
        raise ValueError('Catalog exceeds 2MB')
    fd, temp = tempfile.mkstemp(dir=target, prefix='.catalog-')
    with os.fdopen(fd, 'w') as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, target/'catalog.json')
    print(json.dumps({'regions': [r['id'] for r in regions], 'artifacts': len(files), 'bytes': sum(p.stat().st_size for p, _ in files), 'overview': 'overview' in catalog}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--analytics-root', type=Path, required=True)
    parser.add_argument('--pulse-root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    install(args.analytics_root/'data/jp-heights', args.pulse_root/'public/jp-heights')
