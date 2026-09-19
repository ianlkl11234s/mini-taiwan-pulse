import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


MODULE_PATH = Path(__file__).with_name('install-jp-height-national.py')
SPEC = importlib.util.spec_from_file_location('install_jp_height_national', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def fixture(tmp_path, *, storage_class='DEEP_ARCHIVE', raw_pruned=True):
    source = tmp_path/'jp-heights'
    write_json(source/'national/building-mesh-plan.json', {'cities': [{'city_code': '23100', 'city': '名古屋市'}]})
    root = source/'national/mesh-buildings/23100/52366700'
    artifact = {'path': 'detail.pmtiles', 'bytes': 10, 'sha256': hashlib.sha256(b'detail').hexdigest()}
    grid = {'path': 'grid.pmtiles', 'bytes': 5, 'sha256': hashlib.sha256(b'grid').hexdigest()}
    write_json(root/'manifest.json', {
        'schema': MODULE.MESH_SCHEMA, 'status': 'complete', 'city_code': '23100', 'mesh_code': '52366700',
        'source_year': 2022, 'height_method': 'bldg:measuredHeight', 'license': 'Licensed under CC BY 4.0',
        'coverage': 'partial mesh; not city-wide or national coverage', 'artifact': artifact, 'grid': grid,
        'archive': {'storage_class': storage_class},
        'local_retention': {'raw_pruned': raw_pruned, 'rebuildable_geojson_pruned': True},
    })
    return source


def fake_asset(path, expected, *, layer=None, metadata=None, bbox=None):
    bounds = [136.87, 35.16, 136.89, 35.18] if layer == 'buildings' else [136.86, 35.13, 136.98, 35.23]
    return {'url': f'./jp-heights/{path.name}', 'bbox': bounds, 'coverage': 'partial',
            'sourceLayer': layer, **(metadata or {})}


def test_discovers_only_archive_verified_complete_meshes(tmp_path):
    regions = MODULE.discover_mesh_regions(fixture(tmp_path), fake_asset)
    assert [region['id'] for region in regions] == ['mesh-23100-52366700']
    region = regions[0]
    assert region['label'] == '名古屋市 ・ 52366700'
    assert region['bbox'] == [136.86, 35.13, 136.98, 35.23]
    assert region['buildings']['sourceYear'] == 2022
    assert region['buildings']['heightMethod'] == 'bldg:measuredHeight'
    assert region['buildings']['license'] == 'Licensed under CC BY 4.0'
    assert region['buildings']['coverage'] == 'partial'


@pytest.mark.parametrize('storage_class,raw_pruned', [('STANDARD', True), ('DEEP_ARCHIVE', False)])
def test_rejects_mesh_without_archive_and_prune_gate(tmp_path, storage_class, raw_pruned):
    with pytest.raises(ValueError):
        MODULE.discover_mesh_regions(fixture(tmp_path, storage_class=storage_class, raw_pruned=raw_pruned), fake_asset)
