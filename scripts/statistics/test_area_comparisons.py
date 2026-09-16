import hashlib,json,math
from pathlib import Path
import pytest
from build_area_comparisons import areas,compare
OUT=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-data/area')
def test_administrative_area_units_and_scope():
 town,county,meta=areas()
 assert len(town)==368 and len(county)==22
 assert county['63000']==pytest.approx(271.7997)
 assert sum(town.values())==pytest.approx(sum(county.values()))
 assert meta['source_url'].endswith('/8410')
 assert meta['cadastral_25070'].startswith('REJECTED')
 assert compare(100,2*100,100)==50 # 100 hectares / 2 km²
 assert compare(0,200,100)==0 and compare(2,0,100) is None

def test_published_area_math_and_integrity():
 if not OUT.exists():pytest.skip('local generated bundle unavailable')
 delta=json.loads((OUT/'manifest-delta.json').read_text())
 assert len(delta['selectors'])==53
 for selector in delta['selectors']:
  ref=selector['artifact'];raw=(OUT/ref['path']).read_bytes()
  assert len(raw)==ref['bytes'] and hashlib.sha256(raw).hexdigest()==ref['sha256']
  body=json.loads(raw)
  for row in body['values']['observations']:
   if row['status']!='observed':assert row['value'] is None;continue
   x=row['inputs']
   if 'local_category_ha' in x:
    expected=(x['local_category_ha']/x['local_admin_ha'])/(x['national_category_ha']/x['national_admin_ha'])
   elif 'numerator_hectares' in x:expected=x['numerator_hectares']/x['denominator_hectares']*100
   else:expected=x['numerator']['value']/x['admin_area_km2']
   assert row['value']==pytest.approx(expected)
   assert math.isfinite(row['value'])
