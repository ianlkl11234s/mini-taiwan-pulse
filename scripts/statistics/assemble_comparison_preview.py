#!/usr/bin/env python3
"""Build a local full-manifest preview plus an exact frontend recipe allowlist.

Never writes remote current.json. Source manifest and artifacts are immutable.
"""
import argparse, copy, hashlib, json, re, shutil
from pathlib import Path
from statistics_artifacts import canonical, read_verified, observed_map, SCHEMA

def main():
 p=argparse.ArgumentParser();p.add_argument('--source-manifest',required=True);p.add_argument('--inputs',nargs='+',required=True);p.add_argument('--output',required=True);p.add_argument('--frontend',required=True);a=p.parse_args()
 original=json.load(open(a.source_manifest));full=copy.deepcopy(original);out=Path(a.output);out.mkdir(parents=True,exist_ok=True);front=Path(a.frontend)
 social=json.load(open(front/'src/data/socialStatisticsRecipes.json'))['recipes'];agri=json.load(open(front/'src/data/agriStatisticsRecipes.json'))['recipes'];byind={r['indicator_id']:r for r in social+agri};recipes={};seen=set()
 for folder in map(Path,a.inputs):
  delta=json.load(open(folder/'manifest-delta.json'))
  for sel in delta['selectors']:
   artifact=read_verified(folder/sel['artifact']['path'],sel['artifact']); values=artifact['values'];release=values['release'];ind=sel['indicator_id'];level=sel['area_level']
   if release['release_id']!=sel['release_id'] or release['indicator_id']!=ind or values['area_level']!=level: raise ValueError('Selector mismatch')
   observed_map(values['observations'])
   if values['total']!=values['returned'] or values['returned']!=len(values['observations']) or values['truncated']: raise ValueError('Incomplete values')
   geometry=next((g for g in full['geometries'] if g['boundary_version']==release['boundary_version'] and g['level']==level),None)
   if not geometry: raise ValueError('No verified reference geometry')
   identity=(sel['dataset_id'],ind,sel['release_id'],level,json.dumps(sel['dimensions'],sort_keys=True))
   if identity in seen: raise ValueError('Duplicate selector')
   seen.add(identity)
   target=out/sel['artifact']['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(folder/sel['artifact']['path'],target)
   full['selectors'].append(sel)
   c=next(c for c in delta['catalog']['indicators'] if c['indicator_id']==ind and c['dataset_id']==sel['dataset_id'])
   existing=next((x for x in full['indicators'] if x['dataset_id']==sel['dataset_id'] and x['indicator_id']==ind),None)
   if existing is None:
    existing={'dataset_id':sel['dataset_id'],'indicator_id':ind,'releases':[]};full['indicators'].append(existing);full['catalog']['indicators'].append(c)
   existing['releases'].append(release)
   key='statsComparison'+''.join(part[:1].upper()+part[1:] for part in ind.split('_'))
   base=next((r for name,r in sorted(byind.items(),key=lambda x:-len(x[0])) if ind.startswith(name+'_per_')),None)
   name=c['name']
   if ind.startswith('education_'): base=next((r for name,r in byind.items() if ind.startswith('education_'+name+'_per_')),None)
   if base: name=base['label']+('（每萬人口）' if '_per_10000_population_' in ind else '（每萬名居民）' if '_per_10000_residents' in ind else '（每平方公里）' if '_per_km2' in ind else '（人口比較）')
   name={'a2_accident_count':'A2 事故件數','a2_injury_count':'A2 事故受傷人數','a1_a2_accident_count':'A1＋A2 事故件數'}.get(ind,name)
   group='教育與少子化' if ind.startswith('education_') else '醫療與長照' if folder.name=='population' or (base and base.get('group')=='醫療與長照統計') else '住宅存量與使用' if ind.startswith('housing_') else '交通與運輸' if ind.startswith(('bus_','urban_bus_','a1_','a2_','automobile_','motorcycle_','offstreet_','onstreet_')) else '廢棄物與回收' if ind.startswith('waste_') else '畜牧飼養' if ind.startswith('livestock_heads_') else '漁業生產' if ind.startswith('fishery_') else '土地使用比較'
   nums=sorted(r['value'] for r in values['observations'] if r['status']=='observed')
   breaks=[0.5,1,2,4] if ind.endswith('_lq') else [1,5,10,25] if c['unit']=='%' else sorted(set(round(nums[int((len(nums)-1)*q)],3) for q in (.2,.4,.6,.8))) if nums else [1]
   source=artifact['sources']['source']; processing=source.get('processing_summary',{}); derivation=source.get('derivation',processing.get('derivation',processing))
   disclosure=' '.join(str(derivation.get(k,'')) for k in ('interpretation','description','time_caveat')).strip() or '依來源口徑推算；缺值不補零。'
   source=artifact['sources']['source']; processing=source.get('processing_summary',{}); derivation=source.get('derivation',processing.get('derivation',processing))
   disclosure=' '.join(str(derivation.get(k,'')) for k in ('interpretation','description','time_caveat')).strip() or '依來源口徑推算；缺值不補零。'
   recipe=recipes.setdefault(key,{'layer_key':key,'dataset_id':sel['dataset_id'],'indicator_id':ind,'label':name,'unit':c['unit'],'level':level,'boundary_version':release['boundary_version'],'groupKey':group,'groupLabel':group,'optionLabel':name,'release_options':[],'legend':{'breaks':breaks,'colors':['#eff6ff','#bfdbfe','#60a5fa','#2563eb','#1e3a8a']},'disclosure':disclosure})
   recipe['release_options'].append({'release_id':sel['release_id'],'period_start':release['period_start'],'period_end':release['period_end'],'dimensions':sel['dimensions']})
 for r in recipes.values(): r['release_options'].sort(key=lambda x:(x['period_end'],x['release_id']),reverse=True)
 raw=canonical(full);sha=hashlib.sha256(raw).hexdigest();(out/'manifests').mkdir(exist_ok=True);(out/f'manifests/{sha}.json').write_bytes(raw)
 (out/'current.json').write_bytes(canonical({'schema_version':SCHEMA,'manifest':{'path':f'manifests/{sha}.json','sha256':sha,'bytes':len(raw)}}))
 (front/'src/data/comparisonStatisticsRecipes.json').write_text(json.dumps(list(recipes.values()),ensure_ascii=False,indent=2)+'\n')
 keys=sorted(recipes)
 (front/'src/data/comparisonStatisticsKeys.ts').write_text('// Generated by assemble_comparison_preview.py; exact local acceptance allowlist.\nexport const COMPARISON_STATISTICS_KEYS = '+json.dumps(keys,ensure_ascii=False,indent=2)+' as const;\nexport type ComparisonStatisticsLayerKey = typeof COMPARISON_STATISTICS_KEYS[number];\n')
 (out/'assembly-receipt.json').write_text(json.dumps({'status':'LOCAL_ONLY','original_selectors':len(original['selectors']),'added_selectors':len(seen),'total_selectors':len(full['selectors']),'recipe_count':len(recipes),'manifest_sha256':sha},indent=2)+'\n')
 print(len(recipes),'recipes',len(seen),'selectors')
if __name__=='__main__':main()
