#!/usr/bin/env python3
"""Read-only exact payload + localhost transport acceptance; never publishes."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='public/jp-medical')
    parser.add_argument('--url', default='http://127.0.0.1:3737/jp-medical/')
    parser.add_argument('--output', default='docs/features/jp-medical-static/http-acceptance.json')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    pointer = json.loads((root / 'current.json').read_text())
    catalog_path = (root / pointer['catalog']).resolve()
    assert catalog_path.is_relative_to(root)
    release = catalog_path.parent
    catalog = json.loads(catalog_path.read_text())
    manifest = json.loads((root / pointer['publication_manifest']).read_text())
    assert set(catalog['datasets']) == {'navii', 'h17', 'a38'}
    assert catalog['version'] == pointer['version'] == manifest['version']
    assert catalog['files'] == manifest['files']
    point_contracts = {
        'navii_facilities': 189800,
        'h17_services': 222194,
    }
    for key, expected in point_contracts.items():
        layer = next(item for item in catalog['layers'] if item['key'] == key)
        assert layer['minimum_point_zoom'] == 0
        assert layer['point_sampling'] == 'none'
        assert layer['z0_feature_count'] == expected
        assert 'z14 display geometry' in layer['geometry_provenance']
    assert digest(catalog_path) == manifest['catalog']['sha256']
    assert catalog_path.stat().st_size == manifest['catalog']['bytes']
    total = 0
    for name, meta in catalog['files'].items():
        path = (release / name).resolve()
        assert path.is_relative_to(release) and not any(t in name.lower() for t in ('private', 'raw/', 'representative', 'idwr'))
        assert path.stat().st_size == meta['bytes'], name
        assert digest(path) == meta['sha256'], name
        total += meta['bytes']
    checks = []
    def get(relative, expected=None, ranged=False):
        request = Request(urljoin(args.url, relative), headers={'Range': 'bytes=0-126'} if ranged else {})
        with urlopen(request, timeout=40) as response:
            body = response.read()
            if ranged:
                assert response.status == 206 and len(body) == 127
                assert response.headers.get('Content-Range', '').startswith('bytes 0-126/')
                assert body[:7] == b'PMTiles'
            else:
                assert response.status == 200
                if expected:
                    assert len(body) == expected['bytes']
                    assert hashlib.sha256(body).hexdigest() == expected['sha256']
                json.loads(body)
            checks.append({'path': relative, 'status': response.status, 'bytes_read': len(body), 'range': response.headers.get('Content-Range')})
    get('current.json', {'bytes': (root / 'current.json').stat().st_size, 'sha256': digest(root / 'current.json')})
    get(pointer['catalog'], manifest['catalog'])
    prefix = str(catalog_path.relative_to(root).parent) + '/'
    for layer in catalog['layers']:
        get(prefix + layer['pmtiles_path'], ranged=True)
        if layer.get('aggregate_path'):
            get(prefix + layer['aggregate_path'], catalog['files'][layer['aggregate_path']])
    for kind in ('hospital', 'clinic', 'dental'):
        name = next(n for n in catalog['files'] if n.startswith(f'details/{kind}_hours/') and n.endswith('.json'))
        get(prefix + name, catalog['files'][name])
    result = {'status': 'PASS', 'version': catalog['version'], 'local_files_sha_bytes_verified': len(catalog['files']), 'payload_asset_bytes': total,
              'allzoom_point_contracts': point_contracts,
              'catalog_bytes': catalog_path.stat().st_size, 'http_checks': checks, 'production': 'not run', 'cdn_cache_headers': 'not run',
              'pmtiles_integrity': 'full local SHA-256; HTTP header Range reads only, not a browser visual assertion'}
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'http_checks'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
