#!/usr/bin/env python3
"""Build population-denominator comparison artifacts; never coerce missing to zero."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from urllib.request import urlopen
import pyarrow.parquet as pq
from statistics_artifacts import observed_map

BASE='https://data.itsmigu.com/statistics/v1/'
MEDICAL='medical_resource_statistics'
ROOT=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/demographics')

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read_artifact(sel, base, cache):
 p=cache/sel['artifact']['path']; p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists(): p.write_bytes(urlopen(base+sel['artifact']['path']).read())
 raw=p.read_bytes(); got=hashlib.sha256(raw).hexdigest()
 if got!=sel['artifact']['sha256'] or len(raw)!=sel['artifact']['bytes']: raise ValueError('immutable artifact SHA mismatch')
 return json.loads(raw),got

def write(out, body):
 raw=json.dumps(body,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode(); h=hashlib.sha256(raw).hexdigest(); (out/f'{h}.json').write_bytes(raw); return h,len(raw)
def observed(v): return v.get('status')=='observed' and v.get('value') is not None

def preserved_not_computable(row, denominator, token=None):
 status=row.get('status', 'missing') if row else 'missing'
 return {
  'area_code': row['area_code'] if row else None,
  'value': None,
  'status': status,
  'source_status': row.get('source_status') if row else 'derived_not_computable',
  'source_token': row.get('source_token') if row else token,
  'inputs': {'numerator': row, 'denominator': denominator},
 }

def native_county_map(raw):
 if raw['values'].get('area_level') != 'county':
  raise ValueError('County proxy requires native county observations')
 rows=raw['values']['observations']
 if any(r.get('area_level') not in (None, 'county') for r in rows):
  raise ValueError('County proxy contains non-county observation')
 return observed_map(rows)

def population_maps():
 monthly=pq.read_table(ROOT/'population_by_township_monthly/population_by_township_20260530.parquet').to_pylist()
 geo=json.load(open(ROOT/'township_boundary/township_boundary_20260626.geojson'))
 name_code={(f['properties']['COUNTYNAME'],f['properties']['TOWNNAME']):f['properties']['TOWNCODE'] for f in geo['features']}
 pop={}
 for r in monthly:
  code=name_code.get((r['county_name'],r['town_name']))
  if not code: raise ValueError('Unmatched population township')
  if (r['year_month'],code) in pop: raise ValueError('Duplicate population row')
  if r['population'] is None or r['population']<=0: raise ValueError('Invalid population')
  pop[(r['year_month'],code)]=r['population']
 age=pq.read_table(ROOT/'population_by_age_sex/population_by_age_sex_20260530.parquet').to_pylist()
 # age data contains total + sex rows in some years: choose total, otherwise sum male/female once.
 aged={}
 for year in (2024,2025):
  rows=[r for r in age if r['stat_year']==year and r['age_band'] not in ('0-14','15以上')]
  by={}
  for r in rows:
   lo=int(str(r['age_band']).split('-')[0].replace('+',''))
   if lo<65: continue
   by.setdefault(r['county_name'],[]).append(r)
  for county,rs in by.items():
   bands={}
   for r in rs:
    identity=(r['age_band'],r['sex'])
    if identity in bands: raise ValueError('Duplicate age/sex row')
    bands[identity]=r['population']
   value=0
   expected=['65-69','70-74','75-79','80-84','85-89','90-94','95-99','100+']
   for band in expected:
    if (band,'總計') in bands: value+=bands[(band,'總計')]
    elif (band,'男') in bands and (band,'女') in bands: value+=bands[(band,'男')]+bands[(band,'女')]
    else: raise ValueError('Incomplete 65+ population')
   aged[(year,county)]=value
  if len([k for k in aged if k[0]==year])!=22: raise ValueError('65+ county count mismatch')
 basics=pq.read_table(ROOT/'national_basics/county_basics_yearly_20260604.parquet').to_pylist()
 births={(r['year'],r['county_name']):r['births'] for r in basics}
 return pop,aged,births,geo

def area_count(raw): return raw['values']['area_level']
def source(raw): return raw['sources']['source']
def emit(out,key,name,level,geometry,base_source,upstream_health,rows,formula,inputs,dimensions,unit,description):
 release={'release_id':f'derived-{key}-{hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest()[:16]}','dataset_id':'comparison_statistics','indicator_id':key,'boundary_version':base_source['boundary_version'],'period_start':base_source['period_start'],'period_end':base_source['period_end'],'levels':[level]}
 observed_map(rows)
 obs=sum(r['status']=='observed' for r in rows)
 expected=368 if level=='township' else 22
 geometry=geometry if 'geometry' in geometry else {'status':'OK','geometry':geometry}
 upstream_health=upstream_health or {}
 health={**upstream_health,'status':'OK','publication_status':'LOCAL_ONLY','upstream_health':upstream_health,'coverage_status':'COMPLETE' if obs==expected and upstream_health.get('coverage_status')!='PARTIAL' else 'PARTIAL','coverage_numerator':obs,'coverage_denominator':expected,'currency':unit}
 body={'schema_version':'regional-statistics-cdn-v1','values':{'status':'OK','release':release,'area_level':level,'total':len(rows),'returned':len(rows),'truncated':False,'next_offset':None,'observations':rows},'sources':{'status':'OK','source':{**base_source,'dataset_id':'comparison_statistics','indicator_id':key,'publisher':base_source.get('publisher','來源機關未提供'),'license':base_source.get('license'),'boundary_version':base_source['boundary_version'],'period_start':base_source['period_start'],'period_end':base_source['period_end'],'unit':unit,'processing_summary':{'formula':formula,'description':description,'input_sha256':inputs},'upstream_source':base_source}},'health':health,'geometry':geometry,'derivation':{'formula':formula,'inputs':inputs,'dimensions':dimensions}}
 h,n=write(out,body); return {'key':key,'name':name,'artifact':{'path':f'{h}.json','sha256':h,'bytes':n},'release':release,'level':level,'unit':unit,'dimensions':dimensions,'geometry':geometry}
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True,type=Path);ap.add_argument('--artifact-cache',required=True,type=Path);ap.add_argument('--base-url',default=BASE);args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
 m=json.load(open(args.manifest)); catalog={(x['dataset_id'],x['indicator_id']):x for x in m.get('catalog',{}).get('indicators',[])}; names={k:x.get('name',k[1]) for k,x in catalog.items()}; pop,aged,births,geo=population_maps(); popsha=sha(ROOT/'population_by_township_monthly/population_by_township_20260530.parquet'); agesha=sha(ROOT/'population_by_age_sex/population_by_age_sex_20260530.parquet'); birthsha=sha(ROOT/'national_basics/county_basics_yearly_20260604.parquet')
 geometry_town={'status':'OK','resource':'geometries/80749d605be86044650d6d73e0cf36fe48feb9f71ef4192702ced39a29432afd.geojson','boundary_version':'TOWN_MOI_1140318'}
 geometry_county={'status':'OK','resource':'geometries/3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c.geojson','boundary_version':'COUNTY_MOI_1140318'}
 records=[];blocked=[]
 # Medical source counts per 10,000 residents at matching calendar-year end population.
 for sel in [x for x in m['selectors'] if x['dataset_id']==MEDICAL]:
  year=int(sel['dimensions']['roc_year'])+1911; raw,h=read_artifact(sel,args.base_url,args.artifact_cache); rows=[]
  for r in raw['values']['observations']:
   den=pop.get((f'{year}-12',r['area_code']))
   if not observed(r):
    row=preserved_not_computable(r, {'type':'resident_population','population':den,'period':f'{year}-12','year':year,'source_sha256':popsha}); row['area_code']=r['area_code']; rows.append(row);continue
   if not den or den<=0:
    rows.append({'area_code':r['area_code'],'value':None,'status':'missing','source_status':'derived_not_computable','source_token':'population_denominator_absent','inputs':{'numerator':r,'denominator':{'type':'resident_population','population':den,'period':f'{year}-12','year':year,'source_sha256':popsha,'status':'absent'}}});continue
   rows.append({'area_code':r['area_code'],'value':float(r['value'])*10000/den,'status':'observed','inputs':{'numerator':r,'denominator':{'type':'resident_population','population':den,'period':f'{year}-12','year':year,'source_sha256':popsha,'status':'observed'}}})
  key=f"{sel['indicator_id']}_per_10000_population_township"
  native_unit=catalog[(MEDICAL,sel['indicator_id'])]['unit']
  records.append(emit(args.out,key,f"{names.get((MEDICAL,sel['indicator_id']),sel['indicator_id'])}（每萬人口）",'township',raw['geometry'],source(raw),raw.get('health'),rows,'醫療原始數 / 同曆年12月底鄉鎮人口 * 10000',{'numerator':h,'population':popsha},{'roc_year':str(year-1911),'denominator_period':f'{year}-12'},f'{native_unit}／每萬人口',f'分子為 {year} 年原始醫療統計；分母為 {year} 年12月底戶籍人口，兩者觀察時點分別保留。'))
 # County service capacity proxies from raw county/town observations, only when denominator evidence exists.
 proxy=[('general_nursing_home_open_beds','nursing_facility_capacity','65plus_per_1000'),('care_worker_registration_count','care_worker_registration_statistics','65plus_per_1000'),('postpartum_nursing_home_open_beds','nursing_facility_capacity','births_per_1000'),('postpartum_nursing_home_open_infant_beds','nursing_facility_capacity','births_per_1000')]
 county_id={f['properties']['COUNTYCODE']:f['properties']['COUNTYNAME'] for f in geo['features']}
 for ind,ds,kind in proxy:
  for sel in [x for x in m['selectors'] if x['dataset_id']==ds and x['indicator_id']==ind and (x['dimensions'].get('sex') in (None,'total'))]:
   year=int(sel['dimensions']['roc_year'])+1911; raw,h=read_artifact(sel,args.base_url,args.artifact_cache); native_rows=native_county_map(raw)
   rows=[]
   for code,name in county_id.items():
    den=aged.get((year,name)) if kind=='65plus_per_1000' else births.get((year,name)); denominator_type='population_age_65plus' if kind=='65plus_per_1000' else 'annual_births'; denominator_sha=agesha if kind=='65plus_per_1000' else birthsha
    r=native_rows.get(code)
    if r is None:
     rows.append({'area_code':code,'value':None,'status':'missing','source_status':'derived_not_computable','source_token':'numerator_absent','inputs':{'numerator':None,'denominator':{'type':denominator_type,'value':den,'year':year,'source_sha256':denominator_sha}}});continue
    if not observed(r):
     row=preserved_not_computable(r, {'type':denominator_type,'value':den,'year':year,'source_sha256':denominator_sha}); row['area_code']=code; rows.append(row);continue
    if not den or den<=0:
     rows.append({'area_code':code,'value':None,'status':'missing','source_status':'derived_not_computable','source_token':'denominator_absent','inputs':{'numerator':r,'denominator':{'type':denominator_type,'value':den,'year':year,'source_sha256':denominator_sha,'status':'absent'}}});continue
    rows.append({'area_code':code,'value':float(r['value'])*1000/den,'status':'observed','inputs':{'numerator':r,'denominator':{'type':denominator_type,'value':den,'year':year,'source_sha256':denominator_sha,'status':'observed'}}})
   suffix='per_65plus_1000_county' if kind=='65plus_per_1000' else 'per_births_1000_county'; formula='capacity / county population aged 65+ * 1000' if kind=='65plus_per_1000' else 'service capacity / same-year county births * 1000 (capacity/flow proxy)'
   key=f'{ind}_{suffix}'
   source_name=names.get((ds,ind),ind)
   label=(f'每千名65歲以上人口{source_name}' if kind=='65plus_per_1000' else f'每千名年度出生數{source_name}（床位供給比）')
   unit=('登錄數／千名65歲以上人口' if ind=='care_worker_registration_count' else '床／千名65歲以上人口') if kind=='65plus_per_1000' else '床／千名年度出生數'
   description='65歲以上人口依年齡組加總，僅取總計或男女各一次。' if kind=='65plus_per_1000' else '床位供給相對同年出生流量的 proxy；不是使用率或涵蓋率。'
   records.append(emit(args.out,key,label,'county',raw['geometry'],source(raw),raw.get('health'),rows,formula,{'numerator':h,'age_population' if kind=='65plus_per_1000' else 'births':agesha if kind=='65plus_per_1000' else birthsha},{'roc_year':str(year-1911),'denominator_period':f'{year} annual'},unit,description))
 grouped={}
 for r in records: grouped.setdefault(r['key'],[]).append(r)
 delta={'schema_version':'regional-statistics-cdn-v1','catalog':{'status':'OK','indicators':[{'dataset_id':'comparison_statistics','indicator_id':key,'name':items[0]['name'],'unit':items[0]['unit'],'levels':[items[0]['level']]} for key,items in grouped.items()]},'indicators':[{'dataset_id':'comparison_statistics','indicator_id':key,'releases':[x['release'] for x in items]} for key,items in grouped.items()],'selectors':[{'dataset_id':'comparison_statistics','indicator_id':r['key'],'release_id':r['release']['release_id'],'area_level':r['level'],'dimensions':r['dimensions'],'artifact':r['artifact']} for r in records],'geometries':m['geometries']}
 (args.out/'manifest-delta.json').write_text(json.dumps(delta,ensure_ascii=False,indent=2)+'\n');(args.out/'registry.json').write_text(json.dumps({'metrics':records,'blocked':blocked,'input_sha256':{'town_population':popsha,'age_population':agesha,'county_basics':birthsha}},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
