import pytest
from build_comparison_statistics import ratio

def artifact(rows, boundary='COUNTY'):
 return {'values':{'release':{'period_start':'2025-01-01','period_end':'2025-12-31','boundary_version':boundary},'area_level':'county','observations':rows}}
def row(code,value,status='observed'):return {'area_code':code,'value':value,'status':status}
def test_zero_and_missing_preserved():
 result=ratio(artifact([row('A',0),row('B',None,'suppressed'),row('C',2)]),artifact([row('A',4),row('B',4),row('C',0),row('D',3)]))
 assert result[0]['value']==0
 assert result[1]['source_token']=='numerator_suppressed'
 assert result[1]['inputs']['numerator']['status']=='suppressed'
 assert result[2]['value'] is None and result[2]['source_token']=='zero_denominator'
 assert result[3]['value'] is None
@pytest.mark.parametrize('bad',[None,float('nan'),-1,True])
def test_invalid_observed_rejected(bad):
 with pytest.raises(ValueError):ratio(artifact([row('A',bad)]),artifact([row('A',1)]))
def test_duplicate_code_rejected():
 with pytest.raises(ValueError):ratio(artifact([row('A',2),row('A',3)]),artifact([row('A',1)]))
def test_boundary_mismatch_rejected():
 with pytest.raises(ValueError):ratio(artifact([row('A',2)]),artifact([row('A',1)],'OTHER'))
