import pytest
from build_land_comparisons import calculate

def fixture():
 codes=[f't{i}' for i in range(368)]
 return [{'area_code':c,'value':i+1,'status':'observed'} for i,c in enumerate(codes)],{c:f'c{i%22}' for i,c in enumerate(codes)}
def test_complete_land_conservation():
 rows,cross=fixture();r=calculate(rows,cross)
 assert sum(x['value'] for x in r['county_total_hectare'])==sum(x['value'] for x in rows)
 assert sum(x['value'] for x in r['national_share_pct'])==pytest.approx(100)
 assert sum(x['value'] for x in r['county_national_share_pct'])==pytest.approx(100)
 for county in set(cross.values()):assert sum(x['value'] for x in r['township_of_county_share_pct'] if cross[x['area_code']]==county)==pytest.approx(100)
def test_missing_land_cannot_fake_national_denominator():
 rows,cross=fixture();rows[0].update(value=None,status='suppressed')
 with pytest.raises(ValueError):calculate(rows,cross)
def test_zero_county_denominator_is_missing():
 rows,cross=fixture()
 for r in rows:
  if cross[r['area_code']]=='c0':r['value']=0
 result=calculate(rows,cross)
 assert all(r['status']=='missing' and r['source_token']=='zero_denominator' for r in result['township_of_county_share_pct'] if cross[r['area_code']]=='c0')
