/** Real HTTP + production loader acceptance; no mocked fetch or database. */
import { writeFileSync } from 'node:fs';
import { COMPARISON_ENABLED_RECIPES } from '../../src/data/comparisonStatisticsRecipes';
import { loadRegionalStatistics } from '../../src/data/regionalStatisticsLoader';
import { EDUCATION_PRESENTATION_VIEWS } from '../../src/data/statisticsPresentationViews';
import { statisticsRenderRecipe } from '../../src/data/regionalStatisticsRecipes';
const rows: Record<string,unknown>[]=[];
for (const recipe of COMPARISON_ENABLED_RECIPES) {
  for (const option of recipe.release_options) {
    try {
      const r=await loadRegionalStatistics({datasetId:recipe.dataset_id,indicatorId:recipe.indicator_id,level:recipe.level,dimensions:option.dimensions,releaseId:option.release_id,layerKey:recipe.layer_key,includeHealth:true});
      if(r.features.length !== (recipe.level==='county'?22:368)) throw new Error('Reference geometry coverage');
      if(r.values.release.release_id!==option.release_id) throw new Error('Release drift');
      const observed=r.values.observations.filter(v=>v.status==='observed').length;
      if(r.features.filter(f=>f.properties?.status==='observed').length!==observed) throw new Error('Geometry join lost observations');
      rows.push({key:recipe.layer_key,release:option.release_id,dimensions:option.dimensions,status:'PASS',observed,features:r.features.length,health:r.health});
    } catch(e) { rows.push({key:recipe.layer_key,release:option.release_id,status:'FAIL',error:String(e)}); }
  }
}
for(const view of EDUCATION_PRESENTATION_VIEWS){
 const recipe=statisticsRenderRecipe(view.key);
 try {
  const r=await loadRegionalStatistics({datasetId:recipe.dataset_id,indicatorId:recipe.indicator_id,level:recipe.level,dimensions:recipe.dimensions,releaseId:recipe.releaseId,layerKey:view.key,includeHealth:true});
  if(r.effectiveRecipe.dimensions?.education_stage!==view.stage || r.features.length!==22) throw new Error('Education stage mismatch');
  rows.push({key:view.key,status:'PASS',features:r.features.length,dimensions:r.effectiveRecipe.dimensions});
 } catch(e){rows.push({key:view.key,status:'FAIL',error:String(e)});}
}
const failed=rows.filter(x=>x.status==='FAIL');
writeFileSync('docs/features/statistics-comparability/evidence/runtime-loader.json',JSON.stringify({transport:'real local HTTP, production loadRegionalStatistics',rows,total:rows.length,failed:failed.length},null,2)+'\n');
console.log(JSON.stringify({total:rows.length,failed:failed.length,errors:failed},null,2));
if(failed.length)process.exitCode=1;
