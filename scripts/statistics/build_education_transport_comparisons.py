#!/usr/bin/env python3
"""Scale comparisons using resident population and official administrative area.

Education uses whole resident population, NOT a fabricated school-age population.
"""
import argparse,csv,json,subprocess
from pathlib import Path
from statistics_artifacts import Writer,read_verified,observed_map
from build_area_comparisons import areas,ROOT

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'education-transport');a=p.parse_args()
 manifest=json.load(open('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json'));cache=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-cache');_,county_area,metadata=areas()
 cross=json.load(open('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/demographics/township_boundary/township_boundary_20260626.geojson'))['features']
 codes={f['properties']['COUNTYNAME']+f['properties']['TOWNNAME']:f['properties']['COUNTYCODE'] for f in cross};population={}
 with (ROOT/'denominators/township_density_114.csv').open(encoding='utf-8-sig',newline='') as file:
  for r in csv.DictReader(file):
   if r['site_id'] in codes:
    c=codes[r['site_id']];population[c]=population.get(c,0)+int(r['people_total'])
 if set(population)!=set(county_area):raise ValueError('Denominator scope mismatch')
 w=Writer(a.output)
 for s in manifest['selectors']:
  education=s['dataset_id']=='education_county_statistics' and s['dimensions'].get('academic_year_roc')=='114' and s['indicator_id'] in ('institution_count','teacher_count','staff_count','student_count','class_count')
  bus=s['dataset_id']=='segis_bus_operation_county_315fh_1d3' and s['dimensions'].get('roc_year')=='114'
  if not education and not bus:continue
  path=cache/s['artifact']['path'];path.parent.mkdir(parents=True,exist_ok=True)
  if not path.exists():subprocess.run(['curl','-fsSL','--retry','2','https://data.itsmigu.com/statistics/v1/'+s['artifact']['path'],'-o',str(path)],check=True)
  artifact=read_verified(path,s['artifact']);catalog=next(c for c in manifest['catalog']['indicators'] if c['indicator_id']==s['indicator_id'] and c['dataset_id']==s['dataset_id'])
  for suffix,den,scale,unit,title in [('per_10000_residents',population,10000,catalog['unit']+'／萬名居民','每萬名居民'),('per_km2',county_area,1,catalog['unit']+'／平方公里','每平方公里')]:
   rows=[]
   for code,r in observed_map(artifact['values']['observations']).items():
    if code not in den:raise ValueError('Unknown denominator county')
    rows.append({'area_code':code,'value':r['value']/den[code]*scale if r['status']=='observed' else None,'status':r['status'],'source_status':r.get('source_status','derived'),'source_token':r.get('source_token',''),'inputs':{'numerator':r,'denominator':den[code]}})
   key=('education_' if education else '')+s['indicator_id']+'_'+suffix
   w.emit(key,catalog['name']+'－'+title,unit,rows,artifact,artifact['geometry']['geometry'],{'formula':f'numerator / denominator × {scale}','numerator_sha256':s['artifact']['sha256'],'denominator':metadata,'denominator_measure':'2025年底戶籍人口' if suffix=='per_10000_residents' else '2025行政面積（平方公里）','interpretation':'全體居民口徑的規模比較；不是學齡涵蓋率、就學率或教育品質' if education else '營運／建置量相對居民或面積；不是個人實際使用率','source_period':[artifact['values']['release']['period_start'],artifact['values']['release']['period_end']],'time_caveat':'教育114學年度與2025年底人口/面積時點不同，分別保留' if education else '分子年度流量或年末存量依原資料，分母2025年底'},s['dimensions'])
 w.finish();print(len(w.catalog),'indicators',len(w.selectors),'selectors')
if __name__=='__main__':main()
