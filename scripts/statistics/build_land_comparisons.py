#!/usr/bin/env python3
"""Single-category land shares. Complete source membership is required."""
import argparse, hashlib, json
from decimal import Decimal
from pathlib import Path
from statistics_artifacts import Writer, observed_map, read_verified

def calculate(rows, cross):
    lookup=observed_map(rows)
    if set(lookup)!=set(cross) or len(lookup)!=368 or any(r['status']!='observed' for r in rows):
        raise ValueError('Complete matching 368-township observations required')
    totals={}
    for code,r in lookup.items(): totals[cross[code]]=totals.get(cross[code],Decimal(0))+Decimal(str(r['value']))
    if len(totals)!=22: raise ValueError('Expected 22 parent counties')
    total=sum(totals.values())
    def obs(code,num,den):
        return {'area_code':code,'value':float(num/den*100) if den else None,'status':'observed' if den else 'missing','source_status':'derived' if den else 'derived_not_computable','source_token':'' if den else 'zero_denominator','inputs':{'numerator':float(num),'denominator':float(den)}}
    return {
        'national_share_pct':[obs(c,Decimal(str(r['value'])),total) for c,r in lookup.items()],
        'county_total_hectare':[{'area_code':c,'value':float(v),'status':'observed','inputs':{'townships':sum(parent==c for parent in cross.values())}} for c,v in totals.items()],
        'county_national_share_pct':[obs(c,v,total) for c,v in totals.items()],
        'township_of_county_share_pct':[obs(c,Decimal(str(r['value'])),totals[cross[c]]) for c,r in lookup.items()],
    }

def main():
    p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--cache',required=True);p.add_argument('--out',required=True);p.add_argument('--crosswalk',required=True);a=p.parse_args()
    manifest=json.load(open(a.manifest)); raw=Path(a.crosswalk).read_bytes(); cross={}
    for f in json.loads(raw)['features']:
        props=f['properties'];code=props['TOWNCODE']
        if code in cross: raise ValueError('Duplicate crosswalk code')
        cross[code]=props['COUNTYCODE']
    cross_sha=hashlib.sha256(raw).hexdigest()
    county=next(g for g in manifest['geometries'] if g['boundary_version']=='COUNTY_MOI_1140318')
    writer=Writer(a.out); evidence=[]
    for sel in [s for s in manifest['selectors'] if s['dataset_id']=='land_use_township_statistics']:
        x=read_verified(Path(a.cache)/sel['artifact']['path'],sel['artifact'])
        if sel['dimensions']!={'area_unit':'公頃','survey_years_roc':'113-114'} or x['values']['release']['boundary_version']!='TOWN_MOI_1140318': raise ValueError('Unreviewed source scope')
        catalog=next(c for c in manifest['catalog']['indicators'] if c['dataset_id']==sel['dataset_id'] and c['indicator_id']==sel['indicator_id'])
        if catalog['unit']!='公頃': raise ValueError('Unexpected area unit')
        results=calculate(x['values']['observations'],cross)
        for suffix,rows in results.items():
            unit='公頃' if suffix=='county_total_hectare' else '%'
            geom=county if suffix.startswith('county') else x['geometry']['geometry']
            formulas={'national_share_pct':'township same-category area / national complete same-category sum × 100','county_total_hectare':'sum of same-category township areas by official parent county','county_national_share_pct':'county same-category sum / national complete same-category sum × 100','township_of_county_share_pct':'township same-category area / parent county complete same-category sum × 100'}
            labels={'national_share_pct':'鄉鎮占全臺同類比','county_total_hectare':'縣市面積','county_national_share_pct':'縣市占全臺同類比','township_of_county_share_pct':'鄉鎮占所屬縣市同類比'}
            key=sel['indicator_id'].replace('_area_hectare','')+'_'+suffix
            writer.emit(key,catalog['name']+'－'+labels[suffix],unit,rows,x,geom,{'formula':formulas[suffix],'input_sha256':sel['artifact']['sha256'],'crosswalk_sha256':cross_sha,'crosswalk_role':'identity only; source statistical boundary unchanged','denominator_scope':'complete observed membership, same category and survey period'},sel['dimensions'])
            evidence.append({'key':key,'level':geom['level'],'observed':sum(r['status']=='observed' for r in rows),'rows':len(rows),'sum':sum(r['value'] or 0 for r in rows)})
    if len(writer.selectors)!=60: raise ValueError('Expected 15 categories × 4 derivations')
    writer.finish(); (Path(a.out)/'validation.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
