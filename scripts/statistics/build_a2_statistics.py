#!/usr/bin/env python3
"""Conservative 2025 NPA A1/A2 county aggregation.

The source is party-grain and has no incident id. A valid incident requires
exactly one party-sequence-1 anchor within class/date/time/place/coordinates.
Ambiguous groups are excluded and reported (fail closed).
"""
from __future__ import annotations
import argparse,csv,hashlib,io,json,re,zipfile
from collections import Counter,defaultdict
from datetime import date
from pathlib import Path

DEFAULT_ZIP=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-a1-a2-2025-official.zip')
DEFAULT_OUT=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-data/a2')
BOUNDARY=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/demographics/township_boundary/township_boundary_20260626.geojson')
COUNTIES={'臺北市':'63000','新北市':'65000','桃園市':'68000','臺中市':'66000','臺南市':'67000','高雄市':'64000','基隆市':'10017','新竹市':'10018','嘉義市':'10020','新竹縣':'10004','苗栗縣':'10005','彰化縣':'10007','南投縣':'10008','雲林縣':'10009','嘉義縣':'10010','屏東縣':'10013','宜蘭縣':'10002','花蓮縣':'10015','臺東縣':'10014','澎湖縣':'10016','金門縣':'09020','連江縣':'09007'}
COARSE=['發生日期','發生時間','發生地點','經度','緯度']
CHECK_FIELDS=['事故類別名稱','處理單位名稱警局層','死亡受傷人數','天候名稱','光線名稱','道路類別-第1當事者-名稱','事故類型及型態大類別名稱','事故類型及型態子類別名稱','肇因研判大類別名稱-主要','肇因研判子類別名稱-主要']
def norm(v): return (v or '').strip()
def sha256(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1<<20),b''): h.update(b)
 return h.hexdigest()
def parse_injury(v):
 m=re.search(r'受傷\s*(\d+)',norm(v)); return int(m.group(1)) if m else None
def location_county(v):
 for n,c in COUNTIES.items():
  if n in norm(v): return n,c
 return None,None
def boundary_receipt():
 d=json.loads(BOUNDARY.read_text()); pairs={(f.get('properties',{}).get('COUNTYNAME'),f.get('properties',{}).get('COUNTYCODE')) for f in d.get('features',[])}
 expected=set(COUNTIES.items()); return {'uri':str(BOUNDARY),'sha256':sha256(BOUNDARY),'feature_count':len(d.get('features',[])),'crosswalk_match':expected.issubset(pairs),'county_count':len({x[0] for x in pairs})}
def build(src,out):
 out.mkdir(parents=True,exist_ok=True); groups=defaultdict(list); rows=Counter(); bad=Counter(); variation=Counter(); header_rows=0
 with zipfile.ZipFile(src) as z:
  names=[n for n in z.namelist() if n.lower().endswith('.csv') and ('A1' in n or 'A2' in n)]
  for name in sorted(names):
   cls='A1' if 'A1' in name else 'A2'
   with z.open(name) as raw:
    for r in csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig',newline='')):
     rows[cls]+=1
     if norm(r.get('當事者順位')) in ('當事者順位','party_sequence'):
      header_rows+=1; continue
     groups[(cls,)+tuple(norm(r.get(x)) for x in COARSE)].append(r)
 stats=defaultdict(lambda:{'a2_accident_count':0,'a2_injury_count':0,'a1_a2_accident_count':0}); accepted=Counter(); ambiguous=[]
 for k,rs in groups.items():
  cls=k[0]; anchors=[r for r in rs if norm(r.get('當事者順位'))=='1']; missing=sum(not norm(r.get('當事者順位')) for r in rs)
  if missing: bad['missing_rank_rows']+=missing
  if len(anchors)!=1:
   bad['ambiguous_groups']+=1; bad['ambiguous_rows']+=len(rs); ambiguous.append({'class':cls,'coarse':k[1:],'party_rows':len(rs),'rank1_rows':len(anchors)}); continue
  a=anchors[0]; c,code=location_county(a.get('發生地點'))
  if not c: bad['unassigned_county_incidents']+=1; continue
  inj=parse_injury(a.get('死亡受傷人數'))
  if inj is None: bad['unparseable_anchor_injury']+=1; continue
  for f in CHECK_FIELDS:
   if len({norm(r.get(f)) for r in rs})>1: variation[f]+=1
  s=stats[(c,code)]; s['a1_a2_accident_count']+=1; accepted[cls]+=1
  if cls=='A2': s['a2_accident_count']+=1; s['a2_injury_count']+=inj
 obs=[]
 for (c,code),s in sorted(stats.items(),key=lambda x:x[0][1]):
  for ind,field,unit,ac in [('a2_accident_count','a2_accident_count','件','A2'),('a2_injury_count','a2_injury_count','人','A2'),('a1_a2_accident_count','a1_a2_accident_count','件','A1+A2')]:
   obs.append({'indicator_id':ind,'area_code':code,'area_name':c,'value':s[field],'unit':unit,'status':'observed','source_status':'official','period_start':'2025-01-01','period_end':'2025-12-31','dimensions':{'accident_class':ac,'geographic_coverage':'county_location'}})
 values={'schema_version':'statistics_values.v1','dataset_id':'npa_a1_a2_accident_county_177136','level':'county','boundary_version':'COUNTY_MOI_1140318','observations':obs}
 source={'uri':str(src),'url':'https://data.gov.tw/dataset/177136','sha256':sha256(src),'publisher':'警政署','license':'政府資料開放授權條款-第1版'}
 manifest={'schema_version':'statistics_release_manifest.v1','dataset_id':values['dataset_id'],'source':source,'period_start':'2025-01-01','period_end':'2025-12-31','geometry_version':'COUNTY_MOI_1140318','coverage':{'input_rows':dict(rows),'groups':len(groups),'accepted_incidents':dict(accepted),'assigned_counties':len(stats),'observation_count':len(obs)},'unassigned':dict(bad),'validation':{'repeated_header_rows':header_rows,'varying_event_fields_within_coarse_group':dict(variation),'ambiguous_groups':len(ambiguous),'ambiguous_rows':sum(x['party_rows'] for x in ambiguous)},'deduplication':{'anchor':'當事者順位 == 1','coarse_key':COARSE,'party_rows_count_once':True,'collision_policy':'if rank1 count != 1, exclude group (fail closed); no invented incident ids'},'boundary':boundary_receipt(),'generated_at':date.today().isoformat()}
 (out/'a2-statistics-values.json').write_text(json.dumps(values,ensure_ascii=False,indent=2)+'\n'); (out/'a2-statistics-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'); (out/'a2-ambiguous-groups.json').write_text(json.dumps({'schema_version':'a2_partial_exclusions.v1','groups':ambiguous,'counts':{'groups':len(ambiguous),'rows':sum(x['party_rows'] for x in ambiguous)}},ensure_ascii=False,indent=2)+'\n')
 export_cdn(out, obs, manifest)
 return manifest

def export_cdn(out, obs, manifest):
 from statistics_artifacts import Writer
 public=json.load(open('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json'))
 geometry=next(g for g in public['geometries'] if g['boundary_version']=='COUNTY_MOI_1140318')
 if not manifest['boundary']['crosswalk_match']: raise ValueError('County crosswalk mismatch')
 source={**manifest['source'],'period_start':'2025-01-01','period_end':'2025-12-31','boundary_version':'COUNTY_MOI_1140318','source_landing_url':manifest['source']['url'],'raw_sha256':manifest['source']['sha256'],'freshness':{'status':'UNKNOWN'}}
 writer=Writer(out)
 for ind,label,unit in [('a2_accident_count','A2 事故件數','件'),('a2_injury_count','A2 事故受傷人數','人'),('a1_a2_accident_count','A1＋A2 事故件數','件')]:
  rows=[{k:o[k] for k in ('area_code','value','status','source_status')} for o in obs if o['indicator_id']==ind]
  original={'values':{'release':{'period_start':'2025-01-01','period_end':'2025-12-31','boundary_version':'COUNTY_MOI_1140318'}},'sources':{'source':source},'health':{'status':'OK','availability':'CURRENT','coverage_status':'PARTIAL','exclusions':manifest['unassigned'],'reason':'依順位1事故錨點去重；多重或缺少錨點排除，數值僅含可確認事故。'}}
  writer.emit(ind,label,unit,rows,original,geometry,{'formula':'count verified rank-1 incident anchors' if unit=='件' else 'sum accident-level injuries once per verified anchor','deduplication':manifest['deduplication'],'input_sha256':manifest['source']['sha256'],'exclusions':manifest['unassigned'],'coverage':'PARTIAL; excluded ambiguous events are not imputed'}, {'roc_year':'114','geographic_coverage':'county_location'})
 writer.finish()

def main():
 p=argparse.ArgumentParser(); p.add_argument('--input',type=Path,default=DEFAULT_ZIP); p.add_argument('--output',type=Path,default=DEFAULT_OUT); a=p.parse_args(); print(json.dumps(build(a.input,a.output),ensure_ascii=False,indent=2))
if __name__=='__main__': main()
