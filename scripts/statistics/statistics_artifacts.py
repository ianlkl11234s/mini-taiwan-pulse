"""Immutable local CDN artifact writer, shared by offline comparison builders."""
import copy, hashlib, json, math
from pathlib import Path

SCHEMA = 'regional-statistics-cdn-v1'
DATASET = 'comparison_statistics'

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def read_verified(path, expected):
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected['sha256'] or len(raw) != expected['bytes']:
        raise ValueError(f'Artifact integrity mismatch: {path}')
    return json.loads(raw)

def observed_map(rows):
    result = {}
    for row in rows:
        code = row['area_code']
        if code in result: raise ValueError(f'Duplicate area code: {code}')
        val = row['value']
        if row['status'] == 'observed':
            if isinstance(val, bool) or not isinstance(val, (int,float)) or not math.isfinite(val) or val < 0:
                raise ValueError(f'Invalid observed count/area: {code}')
        elif val is not None: raise ValueError(f'Nonobserved numeric value: {code}')
        result[code] = row
    return result

class Writer:
    def __init__(self, output):
        self.output = Path(output); self.output.mkdir(parents=True,exist_ok=True)
        self.catalog={}; self.indicators={}; self.selectors=[]; self.geometries={}

    def emit(self, key, label, unit, rows, source_artifact, geometry, derivation, dimensions=None):
        observed_map(rows)
        dims = dimensions or {}
        old_source = source_artifact['sources']['source']
        old_release = source_artifact['values']['release']
        identity = {'indicator':key,'dimensions':dims,'derivation':derivation,'period':[old_release['period_start'],old_release['period_end']]}
        rid = 'comparison-'+hashlib.sha256(canonical(identity)).hexdigest()[:24]
        release={**old_release,'release_id':rid,'dataset_id':DATASET,'indicator_id':key,'boundary_version':geometry['boundary_version'],'levels':[geometry['level']]}
        source={**copy.deepcopy(old_source),'dataset_id':DATASET,'indicator_id':key,'release_id':rid,'unit':unit,'source_statistical_boundary_version':old_release['boundary_version'],'boundary_version':geometry['boundary_version'],'method_version':'statistics-comparison-v1','derivation':derivation}
        source['processing_summary']={**source.get('processing_summary',{}),'derivation':derivation}
        count=sum(r['status']=='observed' for r in rows)
        expected=22 if geometry['level']=='county' else 368 if geometry['level']=='township' else len(rows)
        health={**copy.deepcopy(source_artifact.get('health',{})),'status':'OK','coverage_status':'COMPLETE' if count==expected and source_artifact.get('health',{}).get('coverage_status')!='PARTIAL' else 'PARTIAL','coverage_numerator':count,'coverage_denominator':expected,'currency':unit,'publication_status':'LOCAL_ONLY'}
        # Totals from input counts do not describe a derived ratio.
        for name in ('mapped_total','unallocated_total'): health.pop(name,None)
        body={'schema_version':SCHEMA,'values':{'status':'OK','release':release,'area_level':geometry['level'],'total':len(rows),'returned':len(rows),'truncated':False,'next_offset':None,'observations':rows},'sources':{'status':'OK','source':source},'health':health,'geometry':{'status':'OK','geometry':geometry}}
        raw=canonical(body); sha=hashlib.sha256(raw).hexdigest(); path=f'artifacts/{sha}.json'
        (self.output/'artifacts').mkdir(exist_ok=True); (self.output/path).write_bytes(raw)
        self.catalog[key]={'dataset_id':DATASET,'indicator_id':key,'name':label,'unit':unit,'levels':sorted(set(self.catalog.get(key,{}).get('levels',[])+[geometry['level']]))}
        self.indicators.setdefault(key,{'dataset_id':DATASET,'indicator_id':key,'releases':[]})['releases'].append(release)
        self.selectors.append({'dataset_id':DATASET,'indicator_id':key,'release_id':rid,'area_level':geometry['level'],'dimensions':dims,'artifact':{'path':path,'sha256':sha,'bytes':len(raw)}})
        self.geometries[(geometry['boundary_version'],geometry['level'])]=geometry
        return body

    def finish(self):
        manifest={'schema_version':SCHEMA,'catalog':{'status':'OK','indicators':list(self.catalog.values())},'indicators':list(self.indicators.values()),'selectors':self.selectors,'geometries':list(self.geometries.values())}
        (self.output/'manifest-delta.json').write_bytes(canonical(manifest))
        return manifest
