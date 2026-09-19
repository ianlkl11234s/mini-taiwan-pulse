#!/usr/bin/env python3
"""Batch OSRM education accessibility. A bounded pilot, never population coverage.

Time is modeled profile cost, without traffic or school admission constraints.
All school destinations inside the supplied network extent are evaluated; the
minimum is restricted to this candidate set. Distance follows the fastest route.
"""
import argparse, concurrent.futures, hashlib, json, math
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode

STAGES = ('preschool', 'elementary', 'junior_high', 'senior_high')
NETWORK_BBOX = (121.3, 24.8, 121.8, 25.3)
ORIGIN_BBOX = (121.46, 25.0, 121.62, 25.16)

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def destinations(root):
    buckets = {stage: [] for stage in STAGES}
    receipt = {}
    for name in ('schools.geojson', 'kindergartens.geojson'):
        path = root/name
        raw = json.loads(path.read_text())
        receipt[name] = {'sha256': digest(path), 'input_features': len(raw['features'])}
        seen = set()
        for feature in raw['features']:
            props = feature['properties']; geom = feature.get('geometry')
            stage = 'preschool' if name == 'kindergartens.geojson' else {'國民小學': 'elementary', '附設國民小學': 'elementary', '國民中學': 'junior_high', '附設國民中學': 'junior_high', '高級中等學校': 'senior_high'}.get(props.get('school_level'))
            if stage not in buckets or not geom or geom['type'] != 'Point': continue
            lng, lat = geom['coordinates'][:2]
            if not (NETWORK_BBOX[0] <= lng <= NETWORK_BBOX[2] and NETWORK_BBOX[1] <= lat <= NETWORK_BBOX[3]): continue
            code = str(props.get('code') or props.get('代碼') or '')
            if not code: raise ValueError('school identifier missing')
            identity = (stage, code)
            if identity in seen: raise ValueError(f'duplicate institution {identity}')
            seen.add(identity)
            buckets[stage].append({'code': code, 'name': props.get('school_name') or props.get('學校名稱'), 'coordinate': [lng, lat], 'precision': props.get('precision', 'unspecified_school_point')})
    return buckets, receipt

def origins():
    # Explicit WGS84 angular sampling, not an equal-area population grid.
    return [[round(ORIGIN_BBOX[0]+x*0.02, 6), round(ORIGIN_BBOX[1]+y*0.02, 6)] for y in range(9) for x in range(9)]

def table(url, points, schools):
    coords = points + [school['coordinate'] for school in schools]
    query = urlencode({'sources': ';'.join(map(str, range(len(points)))), 'destinations': ';'.join(map(str, range(len(points), len(coords)))), 'annotations': 'duration,distance'})
    with urlopen(url+'/table/v1/driving/'+ ';'.join(f'{p[0]},{p[1]}' for p in coords)+'?'+query, timeout=60) as response:
        result = json.load(response)
    if result.get('code') != 'Ok': raise ValueError(f'OSRM: {result.get("code")}')
    return result

def summarize(rows, candidate_count, threshold=900):
    valid = [r for r in rows if r['duration_s'] is not None and r['destination_snap_m'] <= 250 and r['source_snap_m'] <= 250]
    if not valid:
        return {'status': 'unmatched_network' if rows and rows[0]['source_snap_m'] > 250 else 'no_usable_route', 'minimum_time_s': None, 'distance_on_fastest_route_m': None, 'reachable_in_15min': None, 'candidate_count': candidate_count}
    best = min(valid, key=lambda r: (r['duration_s'], r['code']))
    excluded = sum(r['destination_snap_m'] > 250 for r in rows)
    unreachable = sum(r['duration_s'] is None for r in rows)
    return {'status': 'partial' if excluded or unreachable else 'observed', 'minimum_time_s': best['duration_s'], 'distance_on_fastest_route_m': best['distance_m'], 'nearest_school_code': best['code'], 'nearest_school_name': best['name'], 'destination_precision': best['precision'], 'source_snap_m': best['source_snap_m'], 'destination_snap_m': best['destination_snap_m'], 'reachable_in_15min': sum(r['duration_s'] <= threshold for r in valid), 'candidate_count': candidate_count, 'excluded_destination_snap_count': excluded, 'unreachable_destination_count': unreachable, 'threshold_status': 'within_cutoff' if best['duration_s'] <= threshold else 'over_cutoff'}

def build(args):
    buckets, receipt = destinations(args.schools)
    points = origins(); features=[]
    for stage, schools in buckets.items():
        if not schools: raise ValueError(f'No {stage} candidates')
        batches = [(i, points[i:i+10], schools[j:j+80]) for i in range(0,len(points),10) for j in range(0,len(schools),80)]
        rows=[[] for _ in points]
        def run(batch):
            i, pts, targets = batch
            return i, pts, targets, table(args.router, pts, targets)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for i, pts, targets, response in pool.map(run, batches):
                for a in range(len(pts)):
                    for b, school in enumerate(targets):
                        duration=response['durations'][a][b]; distance=response['distances'][a][b]
                        if duration is not None and (not math.isfinite(duration) or duration < 0 or distance is None or distance < 0): raise ValueError('invalid routed cost')
                        rows[i+a].append({**school, 'duration_s': duration, 'distance_m': distance, 'source_snap_m': response['sources'][a]['distance'], 'destination_snap_m': response['destinations'][b]['distance']})
        for index, point in enumerate(points):
            assert len(rows[index]) == len(schools)
            features.append({'type':'Feature','geometry':{'type':'Point','coordinates':point},'properties':{'sample_id':f'pilot-{index}', 'stage':stage,'mode':args.mode, **summarize(rows[index],len(schools))}})
        print(stage, len(schools), 'destinations', len(points), 'samples', flush=True)
    args.output.mkdir(parents=True,exist_ok=True)
    data={'type':'FeatureCollection','features':features}
    target=args.output/f'education-{args.mode}-pilot.geojson'; target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    meta={'status':'LOCAL_ROUTED_PILOT_NOT_NATIONAL','mode':args.mode,'router_version':'OSRM 6.0.0','profile':args.mode+'.lua','network_extent':NETWORK_BBOX,'sample_extent':ORIGIN_BBOX,'geometry_role':'WGS84 angular-grid sample points; not population/campus geometry','sample_step_degrees':0.02,'threshold_seconds':900,'max_snap_m':250,'sources':receipt,'network_pbf_sha256':digest(args.network),'artifact':{'path':target.name,'sha256':digest(target)},'counts':{stage:len(v) for stage,v in buckets.items()},'limitations':['minimum time only among in-extent school points','distance follows fastest route, not shortest-distance optimization','school point not verified entrance; snap displacement excluded from route cost','no traffic, timetable, school district, enrollment or age-population model','finite network boundary may omit paths beyond extract','reachable count excludes unusable snaps and disconnected destinations; preserve partial status']}
    (args.output/f'education-{args.mode}-receipt.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('--schools',type=Path,required=True); p.add_argument('--router',required=True); p.add_argument('--mode',choices=('foot','car'),required=True); p.add_argument('--network',type=Path,required=True); p.add_argument('--output',type=Path,required=True); build(p.parse_args())
