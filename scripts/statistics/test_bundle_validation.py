import hashlib,json,math
from pathlib import Path
import pytest
ROOT=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-data')
def load(path):return json.loads(path.read_text())
def test_full_manifest_is_incremental_and_all_derived_assets_valid():
 root=ROOT/'cdn'
 if not root.exists():pytest.skip('local CDN bundle unavailable')
 pointer=load(root/'current.json');ref=pointer['manifest'];raw=(root/ref['path']).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==ref['sha256'] and len(raw)==ref['bytes']
 full=json.loads(raw);old=load(Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json'))
 assert len(old['selectors'])==3590
 canonical=lambda s:json.dumps(s,sort_keys=True)
 assert set(map(canonical,old['selectors'])).issubset(set(map(canonical,full['selectors'])))
 new=[s for s in full['selectors'] if s['dataset_id']=='comparison_statistics']
 assert len(new)==244
 for s in new:
  ref=s['artifact'];raw=(root/ref['path']).read_bytes()
  assert hashlib.sha256(raw).hexdigest()==ref['sha256'] and len(raw)==ref['bytes']
  b=json.loads(raw);v=b['values'];g=b['geometry']['geometry'];rows=v['observations']
  assert v['release']['indicator_id']==s['indicator_id'] and v['release']['release_id']==s['release_id']
  assert v['area_level']==g['level']==s['area_level']
  assert len(rows)==v['total']==v['returned']==len({r['area_code'] for r in rows})
  assert not v['truncated']
  for r in rows:
   if r['status']=='observed':assert isinstance(r['value'],(int,float)) and math.isfinite(r['value']) and r['value']>=0
   else:assert r['value'] is None
  h=b['health']
  assert h['coverage_numerator']==sum(r['status']=='observed' for r in rows)
  if h['coverage_numerator']<h['coverage_denominator']:assert h['coverage_status']=='PARTIAL'

def test_education_transport_denominator_math_and_period_disclosure():
 root=ROOT/'education-transport'
 if not root.exists():pytest.skip('local generated bundle unavailable')
 for s in load(root/'manifest-delta.json')['selectors']:
  b=load(root/s['artifact']['path']);d=b['sources']['source']['derivation']
  multiplier=10000 if '10000' in s['indicator_id'] else 1
  assert d['source_period']==[b['values']['release']['period_start'],b['values']['release']['period_end']]
  assert d['time_caveat']
  for r in b['values']['observations']:
   if r['status']=='observed':assert r['value']==pytest.approx(r['inputs']['numerator']['value']/r['inputs']['denominator']*multiplier)
  if s['indicator_id'].startswith('education_'):assert '不是學齡' in d['interpretation']
