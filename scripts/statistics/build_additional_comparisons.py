#!/usr/bin/env python3
"""Other approved transport/environment comparisons, only verified year matches."""
import json
from pathlib import Path
from statistics_artifacts import Writer,read_verified,observed_map
from build_area_comparisons import areas,ROOT
from build_population_comparisons import population_maps,read_artifact,sha,ROOT as DEMOGRAPHICS

def main():
 manifest=json.load(open('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json'));cache=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-cache')
 pop,_,_,geo=population_maps();parents={f['properties']['TOWNCODE']:f['properties']['COUNTYCODE'] for f in geo['features']};county_pop={}
 for (month,code),value in pop.items():
  if month in ('2024-12','2025-12'):
   county_pop.setdefault(month,{})[parents[code]]=county_pop.setdefault(month,{}).get(parents[code],0)+value
 _,county_area,area_metadata=areas();w=Writer(ROOT/'additional')
 a2=json.load(open(ROOT/'a2/manifest-delta.json'))
 candidates=[(s,False) for s in manifest['selectors'] if (s['dataset_id']=='dgbas_county_transport_supply_10935' and s['dimensions'].get('roc_year')=='113') or s['dataset_id']=='npa_a1_accident_county_177136' or (s['dataset_id']=='waste_vehicles_county' and any(r['release_id']==s['release_id'] and r['period_start']=='2025-01-01' for i in manifest['indicators'] for r in i['releases']))]+[(s,True) for s in a2['selectors']]
 for s,is_a2 in candidates:
  b=read_verified(ROOT/'a2'/s['artifact']['path'],s['artifact']) if is_a2 else read_artifact(s,'https://data.itsmigu.com/statistics/v1/',cache)[0]
  release=b['values']['release'];year=release['period_start'][:4]
  if release['period_start']!=year+'-01-01' or release['period_end']!=year+'-12-31':raise ValueError('Not a matched calendar year')
  catalog=next(c for c in (a2 if is_a2 else manifest)['catalog']['indicators'] if c['dataset_id']==s['dataset_id'] and c['indicator_id']==s['indicator_id'])
  accident='accident' in s['dataset_id'] or is_a2
  warning='每萬居民事件／傷亡負擔，不是每趟行程、每輛車或車公里風險。' if accident else '供給存量相對居民，非使用率、適齡持照率或服務品質。'
  choices=[('per_10000_residents',county_pop[year+'-12'],10000,catalog['unit']+'／萬名居民','每萬名居民',{'source_sha256':sha(DEMOGRAPHICS/'population_by_township_monthly/population_by_township_20260530.parquet'),'period':year+'-12','measure':'戶籍人口'})]
  if year=='2025':choices.append(('per_km2',county_area,1,catalog['unit']+'／平方公里','每平方公里',area_metadata))
  for suffix,den,scale,unit,title,metadata in choices:
   rows=[]
   for code,r in observed_map(b['values']['observations']).items():
    if code not in den or den[code]<=0:raise ValueError('Missing denominator')
    rows.append({'area_code':code,'value':r['value']/den[code]*scale if r['status']=='observed' else None,'status':r['status'],'source_status':r.get('source_status','derived'),'source_token':r.get('source_token',''),'inputs':{'numerator':r,'denominator':den[code]}})
   key=('waste_' if s['dataset_id']=='waste_vehicles_county' else '')+s['indicator_id']+'_'+suffix
   w.emit(key,catalog['name']+'－'+title,unit,rows,b,b['geometry']['geometry'],{'formula':f'numerator / denominator × {scale}','numerator_sha256':s['artifact']['sha256'],'denominator':metadata,'interpretation':warning,'source_period':[release['period_start'],release['period_end']],'time_caveat':'分子年度流量或年底存量依原資料；分母同年年底。'},s['dimensions'])
 w.finish();print(len(w.catalog),'indicators',len(w.selectors),'selectors')
if __name__=='__main__':main()
