#!/usr/bin/env python3
"""Build reviewed bus and census ratios from exact immutable source selectors."""
import argparse, copy, json
from pathlib import Path
from statistics_artifacts import Writer, observed_map, read_verified

BUS = {'bus_accessible_share_pct': ('bus_accessible_vehicle_count','bus_operating_vehicle_count','無障礙公車占營業車比'), 'bus_electric_share_pct': ('bus_electric_vehicle_count','bus_operating_vehicle_count','電動公車占營業車比')}
HOUSING = {'housing_unoccupied':'無人經常居住住宅','housing_occasional':'偶爾自住住宅','housing_other_use':'其他使用住宅'}

def source(a): return a['sources']['source']
def compatible(a,b):
    x,y=a['values']['release'],b['values']['release']
    return all(x[k]==y[k] for k in ('period_start','period_end','boundary_version')) and a['values']['area_level']==b['values']['area_level']

def ratio(a,b):
    if not compatible(a,b): raise ValueError('incompatible period, boundary, or level')
    left=observed_map(a['values']['observations']); right=observed_map(b['values']['observations']); out=[]
    for code in sorted(set(left)|set(right)):
        n=left.get(code);d=right.get(code);reason=None
        if not n or n['status']!='observed': reason='numerator_'+(n or {}).get('status','absent')
        elif not d or d['status']!='observed': reason='denominator_'+(d or {}).get('status','absent')
        elif d['value']==0: reason='zero_denominator'
        out.append({'area_code':code,'value':n['value']/d['value']*100 if reason is None else None,'status':'observed' if reason is None else 'missing','source_status':'derived' if reason is None else 'derived_not_computable','source_token':reason or '', 'inputs':{'numerator':n,'denominator':d}})
    return out

def select(m,indicator,level):
    candidates=[s for s in m['selectors'] if s['indicator_id']==indicator and s['area_level']==level]
    if len(candidates)!=1: raise ValueError(f'Expected one reviewed selector: {indicator}/{level}')
    return candidates[0]

def main():
    p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--artifact-cache',type=Path,required=True);p.add_argument('--out',required=True);a=p.parse_args();m=json.load(open(a.manifest));w=Writer(a.out)
    def load(ind,level):
        s=select(m,ind,level);return s,read_verified(a.artifact_cache/s['artifact']['path'],s['artifact'])
    tasks=[(key,num,den,label,'county') for key,(num,den,label) in BUS.items()]
    tasks += [(f'{ind}_share_pct_{level}',ind,'housing_total',label+'占總住宅比',level) for ind,label in HOUSING.items() for level in ('county','township')]
    for key,num,den,label,level in tasks:
        ns,n=load(num,level);ds,d=load(den,level)
        nd=dict(ns['dimensions']);dd=dict(ds['dimensions'])
        if key in BUS:
            fields={'bus_accessible_share_pct':('COLUMN5','COLUMN4'),'bus_electric_share_pct':('COLUMN6','COLUMN4')}[key]
            if (nd.pop('source_field',None),dd.pop('source_field',None))!=fields: raise ValueError('Unreviewed source-field pair')
        if nd!=dd: raise ValueError('Incompatible selector dimensions')
        derivation={'formula':'numerator / denominator × 100','numerator_indicator':num,'denominator_indicator':den,'input_sha256':[ns['artifact']['sha256'],ds['artifact']['sha256']],'input_sources':[source(n),source(d)]}
        w.emit(key,label,'%',ratio(n,d),n,n['geometry']['geometry'],derivation,nd)
    ms,mixed=load('housing_mixed_use','county');rs,residence=load('housing_residence_only','county');os,occupied=load('housing_occupied','county')
    if not compatible(mixed,residence) or not compatible(mixed,occupied): raise ValueError('Mixed-use parent period mismatch')
    maps=[observed_map(x['values']['observations']) for x in (mixed,residence,occupied)]
    if not all(set(x)==set(maps[0]) for x in maps): raise ValueError('Parent code mismatch')
    summed=copy.deepcopy(occupied)
    for row in summed['values']['observations']:
        inputs=[m[row['area_code']] for m in maps]
        if all(x['status']=='observed' for x in inputs):
            total=inputs[0]['value']+inputs[1]['value']
            if total!=inputs[2]['value']: raise ValueError('Occupied reconciliation failed')
            row['value']=total
        else: row.update(value=None,status='missing')
    w.emit('housing_mixed_share_of_residential_or_mixed_pct_county','有人居住住宅中的混合用途占比','%',ratio(mixed,summed),mixed,mixed['geometry']['geometry'],{'formula':'mixed_use / (residence_only + mixed_use) × 100','reconciliation':'residence_only + mixed_use = occupied, each county','input_sha256':[s['artifact']['sha256'] for s in (ms,rs,os)],'input_sources':[source(x) for x in (mixed,residence,occupied)]},ms['dimensions'])
    w.finish()
if __name__=='__main__':main()
