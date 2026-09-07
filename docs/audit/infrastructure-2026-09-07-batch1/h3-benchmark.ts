import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const baseline = process.env.MTP_BASELINE_DIR;
const fixtureRoot = process.env.MTP_H3_DIR;
if (!baseline || !fixtureRoot) throw new Error('Set MTP_BASELINE_DIR and MTP_H3_DIR');
const beforeH3 = await import(pathToFileURL(resolve(baseline, 'src/map/h3LayerFactory.ts')).href);
import * as afterH3 from '../../../src/map/h3LayerFactory.ts';
const beforeDemo = await import(pathToFileURL(resolve(baseline, 'src/map/demographicsLayerFactory.ts')).href);
import * as afterDemo from '../../../src/map/demographicsLayerFactory.ts';
function mapMock() {
 const sources = new Map(), layers = new Map(); let writes=0;
 return {getSource:(id:string)=>sources.get(id),getLayer:(id:string)=>layers.get(id),
 addLayer:(layer:any)=>layers.set(layer.id,layer),
 addSource:(id:string)=>sources.set(id,{type:'geojson',setData:(data:any)=>{writes++;sources.get(id).data=data}}),
 setLayoutProperty:()=>{},setPaintProperty:()=>{},
 hash:()=>createHash('sha256').update(JSON.stringify([...sources.values()].map(x=>x.data))).digest('hex'),
 get writes(){return writes}};
}
const root = fixtureRoot;
const specs=[
 ['population','h3_population_res8.json',beforeH3.updateH3Layer,afterH3.updateH3Layer,{metric:'day',contrast:1,opacity:.6,extruded:false,elevationScale:1}],
 ['demographics','h3_demographics_res8.json',beforeDemo.updateIndicatorsLayer,afterDemo.updateIndicatorsLayer,{category:'population',metric:'p',contrast:1,opacity:.6,extruded:false,elevationScale:1}],
 ['socioeconomic','h3_socioeconomic_res8.json',beforeDemo.updateSocioLayer,afterDemo.updateSocioLayer,{metric:'im',contrast:1,opacity:.6,extruded:false,elevationScale:1}],
 ['spatial','h3_spatial_economy_res8.json',beforeDemo.updateSpatialLayer,afterDemo.updateSpatialLayer,{metric:'hp',contrast:1,opacity:.6,extruded:false,elevationScale:1}],
] as const;
const results=[];
for(const [dataset,file,before,after,params] of specs){
 const bytes=readFileSync(resolve(root,file)); const cells=JSON.parse(bytes.toString()).cells;
 const versions=[];
 for(const [version,update] of [['before',before],['after',after]] as const){
  const map=mapMock(); const start=performance.now(); update(map as never,cells,params as never,true);
  const initialMs=performance.now()-start;const hash=map.hash(); const samples=[];
  for(let i=0;i<10;i++){const t=performance.now();update(map as never,cells,{...params,opacity:.1+i*.08} as never,true);samples.push(performance.now()-t)}
  versions.push({version,initialMs,hash,finalHash:map.hash(),writes:map.writes,paintMs:samples});
 }
 if(versions[0].hash!==versions[1].hash || versions.some(x=>x.hash!==x.finalHash))throw Error('geometry/value changed '+dataset);
 results.push({dataset,cells:cells.length,inputHash:createHash('sha256').update(bytes).digest('hex'),versions});
}
writeFileSync(process.env.MTP_BENCHMARK_OUTPUT ?? '/tmp/mtp-h3-benchmark.json',JSON.stringify({scope:'Node CPU mock-map; real full res8 datasets; not GPU/browser FPS',results},null,2));
console.log(results.map(x=>({dataset:x.dataset,cells:x.cells,equal:true,versions:x.versions.map(v=>({version:v.version,writes:v.writes,paintTotalMs:v.paintMs.reduce((a,b)=>a+b,0)}))})));
