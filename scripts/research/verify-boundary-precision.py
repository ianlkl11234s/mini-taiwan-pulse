#!/usr/bin/env python3
"""Read-only comparison of raw and published reference boundary snapshots."""
import argparse
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape


def load(path, expected, code):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('BOUNDARY_SHA_MISMATCH')
    result = {}
    for feature in json.loads(data)['features']:
        key = feature['properties'][code]
        if key in result:
            raise ValueError('DUPLICATE_BOUNDARY_CODE')
        result[key] = shape(feature['geometry'])
    return result, len(data)


def vertices(geometry):
    polygons = list(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else [geometry]
    return sum(len(p.exterior.coords) + sum(len(r.coords) for r in p.interiors) for p in polygons)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-gate', type=Path, default=Path('../runtime/population-source-gate-20260923.json'))
    parser.add_argument('--published', type=Path, default=Path('../runtime/oracle-assets/3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c.geojson'))
    parser.add_argument('--output', type=Path, default=Path('../runtime/boundary-precision-review.json'))
    args = parser.parse_args()
    receipt = json.loads(args.source_gate.read_text())['receipts']['county_boundary']
    raw, raw_bytes = load(Path(receipt['path']), receipt['sha256'], '行政區域代碼')
    published_sha = '3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c'
    reference, reference_bytes = load(args.published, published_sha, 'area_code')
    if set(raw) != set(reference) or len(raw) != 22:
        raise ValueError('BOUNDARY_CODE_SET_MISMATCH')
    rows = [{'areaCode': key, 'rawVertices': vertices(raw[key]), 'publishedVertices': vertices(reference[key]), 'bothValid': raw[key].is_valid and reference[key].is_valid, 'topologicallyEqual': raw[key].equals(reference[key]), 'hausdorffDegrees': raw[key].hausdorff_distance(reference[key])} for key in sorted(raw)]
    report = {'rawSha': receipt['sha256'], 'publishedSha': published_sha, 'rawBytes': raw_bytes, 'publishedBytes': reference_bytes, 'rawVertices': sum(r['rawVertices'] for r in rows), 'publishedVertices': sum(r['publishedVertices'] for r in rows), 'equalAreas': sum(r['topologicallyEqual'] for r in rows), 'maxHausdorffDegrees': max(r['hausdorffDegrees'] for r in rows), 'metric': 'planar EPSG:4326 degrees; not a surveyed positional accuracy or geodesic distance bound', 'rows': rows}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'}, ensure_ascii=False))
