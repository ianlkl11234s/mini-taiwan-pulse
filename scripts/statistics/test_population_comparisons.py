import importlib.util
from pathlib import Path
import json
import pytest
p=Path(__file__).with_name('build_population_comparisons.py'); s=importlib.util.spec_from_file_location('b',p); b=importlib.util.module_from_spec(s); s.loader.exec_module(b)
def test_observed_never_interprets_missing_as_zero():
 assert b.observed({'status':'observed','value':0})
 assert not b.observed({'status':'missing','value':0})
 assert not b.observed({'status':'observed','value':None})
def test_population_input_paths_are_immutable_processed_sources():
 assert str(b.ROOT).endswith('data/processed/demographics')

def test_nonobserved_numerator_preserves_status_token_and_row():
 source={'area_code':'A','value':None,'status':'suppressed','source_status':'source_suppressed','source_token':'confidential'}
 result=b.preserved_not_computable(source, {'type':'resident_population','population':100,'year':2025})
 assert result['value'] is None
 assert result['status']=='suppressed'
 assert result['source_token']=='confidential'
 assert result['inputs']['numerator']==source
 assert result['inputs']['denominator']['population']==100

def test_emit_keeps_stale_availability_and_marks_local_publication(tmp_path):
 geometry={'status':'OK','geometry':{'boundary_version':'TEST','level':'county'}}
 source={'boundary_version':'TEST','period_start':'2025-01-01','period_end':'2025-12-31'}
 metric=b.emit(tmp_path,'x','X','county',geometry,source,{'availability':'STALE','coverage_status':'COMPLETE'},[{'area_code':str(i),'value':1,'status':'observed'} for i in range(22)],'n/d',{'population':'sha'},{},'床／每萬人口','test')
 body=json.loads((tmp_path/f"{metric['artifact']['sha256']}.json").read_text())
 assert body['health']['availability']=='STALE'
 assert body['health']['publication_status']=='LOCAL_ONLY'
 assert body['sources']['source']['unit']=='床／每萬人口'

def test_county_proxy_requires_native_county_and_rejects_duplicate_rows():
 with pytest.raises(ValueError,match='native county'):
  b.native_county_map({'values':{'area_level':'township','observations':[]}})
 with pytest.raises(ValueError,match='Duplicate area code'):
  b.native_county_map({'values':{'area_level':'county','observations':[{'area_code':'A','value':1,'status':'observed'},{'area_code':'A','value':2,'status':'observed'}]}})
