#!/usr/bin/env python3
"""Administrative-area comparisons. Cadastral valuation area is NOT a denominator."""
import argparse,csv,hashlib,json,math
from pathlib import Path
from statistics_artifacts import Writer,read_verified,observed_map
ROOT=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-data')
CROSS=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/demographics/township_boundary/township_boundary_20260626.geojson')

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def areas():
    geo=json.load(open(CROSS))['features'];cross={f['properties']['COUNTYNAME']+f['properties']['TOWNNAME']:f['properties'] for f in geo}
    path=ROOT/'denominators/township_density_114.csv';town={};county={};excluded=[]
    with path.open(encoding='utf-8-sig',newline='') as file:
        for r in csv.DictReader(file):
            if r['statistic_yyy']=='統計年':continue
            if r['statistic_yyy']!='114':raise ValueError('Area period mismatch')
            p=cross.get(r['site_id'])
            if not p:excluded.append(r['site_id']);continue
            code=p['TOWNCODE'];v=float(r['area'])
            if code in town or not math.isfinite(v) or v<=0:raise ValueError('Area duplicate or invalid')
            town[code]=v
            county[p['COUNTYCODE']]=county.get(p['COUNTYCODE'],0)+v
    if len(town)!=368 or len(county)!=22:raise ValueError('Incomplete administrative area scope')
    if not all(any(n in x for n in ('東沙','南沙')) for x in excluded):raise ValueError('Unexpected unmatched area rows')
    return town,county,{'source_url':'https://data.gov.tw/dataset/8410','source_sha256':sha(path),'crosswalk_sha256':sha(CROSS),'unit':'平方公里','period':'2025年底（民國114年）','aggregation':'county sums of 368 officially matched township areas','excluded_source_rows':excluded,'cadastral_25070':'REJECTED: valuation land area is not administrative land area'}

def compare(numerator,denominator,multiplier):
    if denominator<=0:return None
    return numerator/denominator*multiplier

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'area');a=p.parse_args();town,county,den=areas();w=Writer(a.output)
    manifest=json.load(open('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json'));cache=Path('/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-cache')
    countygeo=next(g for g in manifest['geometries'] if g['boundary_version']=='COUNTY_MOI_1140318')
    cross={f['properties']['TOWNCODE']:f['properties']['COUNTYCODE'] for f in json.load(open(CROSS))['features']}
    names={x['indicator_id']:x['name'] for x in manifest['catalog']['indicators']}
    for s in manifest['selectors']:
        if s['dataset_id']!='land_use_township_statistics':continue
        body=read_verified(cache/s['artifact']['path'],s['artifact']);values=observed_map(body['values']['observations'])
        if set(values)!=set(town) or any(r['status']!='observed' for r in values.values()):raise ValueError('Incomplete land category')
        totals={c:0 for c in county}
        for code,r in values.items():totals[cross[code]]+=r['value']
        national=sum(totals.values());national_area=sum(county.values())*100
        cat=s['indicator_id'].replace('_area_hectare','');label=names[s['indicator_id']]
        metadata={'input_sha256':s['artifact']['sha256'],'denominator':den,'source_period':[body['values']['release']['period_start'],body['values']['release']['period_end']],'time_caveat':'113–114年土地調查與114年底行政面積分別保留；不宣稱同一測量時點','conversion':'1 平方公里 = 100 公頃'}
        rows=[{'area_code':c,'value':compare(v,county[c]*100,100),'status':'observed','inputs':{'numerator_hectares':v,'denominator_hectares':county[c]*100}} for c,v in totals.items()]
        w.emit(cat+'_county_area_share_pct',label+'－占縣市行政面積','%',rows,body,countygeo,{**metadata,'formula':'category_hectares / county_administrative_hectares × 100'},s['dimensions'])
        rows=[{'area_code':c,'value':(v/(county[c]*100))/(national/national_area) if national>0 else None,'status':'observed' if national>0 else 'missing','source_status':'derived' if national>0 else 'derived_not_computable','source_token':'' if national>0 else 'zero_national_category','inputs':{'local_category_ha':v,'local_admin_ha':county[c]*100,'national_category_ha':national,'national_admin_ha':national_area}} for c,v in totals.items()]
        w.emit(cat+'_county_lq',label+'－縣市相對集中度 LQ','倍',rows,body,countygeo,{**metadata,'formula':'(county category ha / county administrative ha) / (national same-category ha / national administrative ha)','interpretation':'1 為同類面積密度等於全臺368鄉鎮範圍平均；高於1較集中'},s['dimensions'])
        rows=[{'area_code':c,'value':compare(r['value'],town[c]*100,100),'status':'observed','inputs':{'numerator_hectares':r['value'],'denominator_hectares':town[c]*100}} for c,r in values.items()]
        w.emit(cat+'_township_admin_area_share_pct',label+'－占鄉鎮行政面積','%',rows,body,body['geometry']['geometry'],{**metadata,'formula':'category_hectares / township_administrative_hectares × 100'},s['dimensions'])
    for s in manifest['selectors']:
        if s['dataset_id']!='medical_resource_statistics' or s['dimensions'].get('roc_year')!='114':continue
        body=read_verified(cache/s['artifact']['path'],s['artifact']);rows=[]
        for code,r in observed_map(body['values']['observations']).items():
            area=town.get(code)
            if not area:raise ValueError('Medical/area crosswalk mismatch')
            rows.append({'area_code':code,'value':r['value']/area if r['status']=='observed' else None,'status':r['status'],'source_status':r.get('source_status','derived'),'source_token':r.get('source_token',''),'inputs':{'numerator':r,'admin_area_km2':area}})
        unit=('家' if s['indicator_id']=='hospital_count' else '床' if 'bed' in s['indicator_id'] else '人員')+'／平方公里'
        w.emit(s['indicator_id']+'_per_km2_township',names[s['indicator_id']]+'－每平方公里',unit,rows,body,body['geometry']['geometry'],{'formula':'medical count / same-township 2025 administrative area km²','numerator_sha256':s['artifact']['sha256'],'denominator':den,'interpretation':'資源空間密度；不是旅行可達性、服務品質或即時空床'},s['dimensions'])
    w.finish();(a.output/'validation.json').write_text(json.dumps({'status':'PASS','artifacts':len(w.selectors),'denominator':den,'county_area_km2':county},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
