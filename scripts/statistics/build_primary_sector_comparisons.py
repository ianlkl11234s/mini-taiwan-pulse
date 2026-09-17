#!/usr/bin/env python3
import argparse,hashlib,json,subprocess
from pathlib import Path
from statistics_artifacts import Writer,read_verified,observed_map
BASE='https://data.itsmigu.com/statistics/v1/'
def load(sel,cache):
 p=cache/sel['artifact']['path'];p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists(): subprocess.run(['curl','-fsSL','--retry','2','-o',str(p),BASE+sel['artifact']['path']],check=True)
 return read_verified(p,sel['artifact']),sel['artifact']['sha256']
def latest(xs): return sorted(xs,key=lambda x:(x['dimensions'].get('quarter',''),x['dimensions'].get('year',''),x['release_id']))[-1]
def main():
 a=argparse.ArgumentParser();a.add_argument('--manifest',required=True);a.add_argument('--cache',type=Path,required=True);a.add_argument('--out',type=Path,required=True);z=a.parse_args();m=json.load(open(z.manifest));w=Writer(z.out);blocked=[]
 sels=m['selectors']; geom={('township','TOWN_MOI_1140318'):{'level':'township','boundary_version':'TOWN_MOI_1140318','resource':'geometries/80749d605be86044650d6d73e0cf36fe48feb9f71ef4192702ced39a29432afd.geojson'},('county','COUNTY_MOI_1140318'):{'level':'county','boundary_version':'COUNTY_MOI_1140318','resource':'geometries/3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c.geojson'}}
 # Current published livestock quarter only; pair identical animal/quarter selectors.
 farms={(x['dimensions']['animal'],x['dimensions']['quarter']):x for x in sels if x['dataset_id']=='livestock_township_statistics' and x['indicator_id']=='livestock_farm_count'}
 heads={(x['dimensions']['animal'],x['dimensions']['quarter']):x for x in sels if x['dataset_id']=='livestock_township_statistics' and x['indicator_id']=='livestock_head_count'}
 for pair,fs in farms.items():
  hs=heads.get(pair)
  if not hs: continue
  fa,fsha=load(fs,z.cache);ha,hsha=load(hs,z.cache)
  if fs['dimensions'] != hs['dimensions'] or any(fa['values']['release'][k]!=ha['values']['release'][k] for k in ('period_start','period_end','boundary_version')): raise ValueError('Livestock scope mismatch')
  fm,hm=observed_map(fa['values']['observations']),observed_map(ha['values']['observations']);rows=[]
  for code,h in hm.items():
   f=fm.get(code); reason=None
   if not f:reason='farm_absent'
   elif h['status']!='observed':reason='head_'+h['status']
   elif f['status']!='observed':reason='farm_'+f['status']
   elif f['value']<=0:reason='non_positive_farm_count'
   if reason:rows.append({'area_code':code,'value':None,'status':'missing','source_status':'derived_not_computable','source_token':reason,'inputs':{'heads':h,'farms':f,'head_sha256':hsha,'farm_sha256':fsha}})
   else:rows.append({'area_code':code,'value':h['value']/f['value'],'status':'observed','inputs':{'heads':h['value'],'farms':f['value'],'head_sha256':hsha,'farm_sha256':fsha}})
  animal,quarter=pair;w.emit('livestock_heads_per_farm_township','畜禽每場在養數量','頭或隻／場',rows,ha,ha['geometry']['geometry'],{'formula':'livestock_head_count / livestock_farm_count','inputs':{'head_sha256':hsha,'farm_sha256':fsha},'animal':animal,'quarter':quarter,'interpretation':'同畜種同季在養數除以有報告場數；遮蔽、未報告與零場數不可計算，僅代表可配對鄉鎮。'},{'animal':animal,'quarter':quarter})
 # only latest release each fishery indicator, and only complete 22 observed counties.
 for ind in ('fishery_production_tonnes','fishery_value_thousand','aquaculture_area_ha'):
  xs=[x for x in sels if x['dataset_id']=='fishery_stats_by_county' and x['indicator_id']==ind]
  if not xs:continue
  sel=latest(xs);art,sha=load(sel,z.cache); rows0=observed_map(art['values']['observations'])
  if len(rows0)!=22 or any(r['status']!='observed' for r in rows0.values()):blocked.append({'indicator_id':ind,'reason':'requires_22_complete_observed_counties'});continue
  total=sum(r['value'] for r in rows0.values())
  if total<=0:blocked.append({'indicator_id':ind,'reason':'non_positive_national_total'});continue
  rows=[{'area_code':c,'value':r['value']/total*100,'status':'observed','inputs':{'numerator':r['value'],'official_complete_county_sum':total,'source_sha256':sha}} for c,r in rows0.items()]
  w.emit(f'{ind}_national_share_pct_county',{'fishery_production_tonnes':'漁業生產量－縣市占全臺比','fishery_value_thousand':'漁業生產值－縣市占全臺比','aquaculture_area_ha':'水產養殖面積－縣市占全臺比'}[ind],'%',rows,art,art['geometry']['geometry'],{'formula':'county value / sum of 22 complete observed county values * 100','input_sha256':sha,'interpretation':'分母由完整22縣市同類觀察值加總；不是獨立官方全國總計。不同魚種組成與產值價格仍需分別理解。','denominator_semantics':'全國由完整22縣市同類觀察值加總；不是獨立官方全國總計','dimensions':sel['dimensions']},sel['dimensions'])
 manifest=w.finish();(z.out/'registry.json').write_text(json.dumps({'metrics':len(w.selectors),'blocked':blocked},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
