import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root=process.argv[2] ?? process.cwd();
const rel=(p)=>path.join(root,p);
const read=(p)=>fs.readFileSync(rel(p),"utf8");
function manifestEntries() {
  const file="src/data/layerManifest.ts", text=read(file), sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  let obj;
  function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==="LAYER_MANIFEST")obj=n.initializer;ts.forEachChild(n,walk)}
  walk(sf);
  while(obj&&(ts.isSatisfiesExpression(obj)||ts.isAsExpression(obj)||ts.isParenthesizedExpression(obj)))obj=obj.expression;
  function val(n){
    if(!n)return;
    if(ts.isStringLiteral(n)||ts.isNumericLiteral(n))return n.text;
    if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
    if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
    if(n.kind===ts.SyntaxKind.NullKeyword)return null;
    if(ts.isArrayLiteralExpression(n))return n.elements.map(val);
    if(ts.isObjectLiteralExpression(n)){const o={};for(const p of n.properties)if(ts.isPropertyAssignment(p))o[p.name.getText(sf).replace(/^[\"']|[\"']$/g,"")]=val(p.initializer);return o}
    return n.getText(sf).replace(/\s+/g," ").slice(0,220);
  }
  const cat=read("src/components/sidebar/layerCatalog.ts").split("\n"), reg={};
  cat.forEach((l,i)=>{for(const m of l.matchAll(/fromManifest\(\"([^\"]+)\"\)/g))(reg[m[1]]??=[]).push(i+1)});
  const out=[];
  for(const p of obj.properties){
    if(!ts.isPropertyAssignment(p))continue;
    const key=p.name.getText(sf).replace(/^[\"']|[\"']$/g,""),o=val(p.initializer)||{};
    const source=Array.isArray(o.source)?o.source:[o.source];
    out.push({key,label:o.label??null,source_file:file,source_line:sf.getLineAndCharacterOfPosition(p.getStart(sf)).line+1,section:o.section??null,dataClass:o.dataClass??null,source:source.map(x=>x&&typeof x==="object"?{kind:x.kind,sourceId:x.sourceId,url:x.url,fallbackUrl:x.fallbackUrl,note:x.note?.slice(0,220)}:x),upstream:o.upstream&&{status:o.upstream.status,datasetIds:o.upstream.datasets?.map(x=>x.datasetId),derivedFromLayers:o.upstream.derivedFromLayers,derivationType:o.upstream.derivationType},renderer:{legend:o.legend??null,popup:o.popup??null,params:o.params??null},description:o.description?.slice(0,220)??null,sidebar_lines:reg[key]??[]});
  }
  return out;
}
const entries=manifestEntries();
const visibility=(read("src/types/index.ts").match(/export interface LayerVisibility \{([\s\S]*?)\n\}/)?.[1].match(/^  ([A-Za-z0-9_]+):/gm)??[]).map(x=>x.trim().slice(0,-1));
const stats=(read("src/data/statisticsLayerRegistry.ts").match(/^\s{2}([A-Za-z0-9_]+): "(?:choropleth|boundary)"/gm)??[]).map(x=>x.trim().split(":")[0]);
const counts={explicit_manifest:entries.length,visibility_keys:visibility.length,stats_registry:stats.length,dataClass:Object.fromEntries(Object.entries(Object.groupBy(entries,e=>e.dataClass)).map(([k,v])=>[k,v.length]))};
console.log(JSON.stringify({generated_at:"2026-09-11",root,method:"TypeScript compiler AST; catalog line scan",generated_from:{manifest:"src/data/layerManifest.ts",catalog:"src/components/sidebar/layerCatalog.ts",visibility:"src/types/index.ts",stats:"src/data/statisticsLayerRegistry.ts"},counts,stats_registry_keys:stats,entries},null,2));
