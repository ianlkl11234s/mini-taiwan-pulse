import { expect, it } from 'vitest';
import { STATISTICS_KEYS, STATISTICS_RECIPES, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { ATLAS_ENABLED_STATISTICS_RECIPES, getAtlasRecipe } from '../atlasStatisticsRecipes';

// Machado et al. 2009, severity 100, linear RGB. Numeric supplementary data:
// https://github.com/njsmith/colorspacious/blob/master/colorspacious/cvd.py
const matrices = {
  normal: [[1,0,0],[0,1,0],[0,0,1]],
  protan: [[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]],
  deutan: [[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.011820,.042940,.968881]],
  tritan: [[1.255528,-.076749,-.178779],[-.078411,.930809,.147602],[.004733,.691367,.303900]],
};
function lightness(hex: string, matrix: number[][]) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  const simulated = matrix.map(row => Math.max(0,Math.min(1,row.reduce((v,c,i)=>v+c*rgb[i]!,0))));
  const y = simulated.reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i]!,0);
  return y > 216/24389 ? 116*Math.cbrt(y)-16 : y*(24389/27);
}
for (const [vision,matrix] of Object.entries(matrices)) {
  it(`${vision}: numeric ordering survives color-vision simulation without changing thresholds`, () => {
    for (const key of STATISTICS_KEYS) {
      const source = STATISTICS_RECIPES[key];
      const recipe = statisticsRenderRecipe(key);
      expect(recipe.breaks).toEqual(source.breaks);
      expect(recipe.colors.length).toBe(recipe.breaks.length+1);
      const values = recipe.colors.map(color=>lightness(color,matrix));
      const declared = getAtlasRecipe(key)?.legend.direction;
      if (declared && declared !== 'diverging') {
        // atlas 宣告方向（社會脆弱度 Z 分數）：不論正負都是序列色；descending 為反轉（值越低越深）。
        for (let i=1;i<values.length;i++) expect(declared === 'descending' ? values[i]! - values[i-1]! : values[i-1]! - values[i]!, key).toBeGreaterThan(5);
      } else if (declared === 'diverging' || recipe.breaks.some(v=>v<0)) {
        // Signed palettes（含 atlas 明確宣告 diverging 的英國年變動率） become lighter towards zero, then darker away from zero.
        const zeroIndex = (recipe.breaks as readonly number[]).indexOf(0);
        expect(zeroIndex).toBeGreaterThanOrEqual(0);
        for (let i=1;i<=zeroIndex;i++) expect(values[i]! - values[i-1]!,key).toBeGreaterThan(5);
        for (let i=zeroIndex+2;i<values.length;i++) expect(values[i-1]! - values[i]!,key).toBeGreaterThan(5);
      } else {
        for (let i=1;i<values.length;i++) expect(values[i-1]! - values[i]!,key).toBeGreaterThan(5);
      }
    }
    const derived = statisticsRenderRecipe('statsLaborCountyNonLaborForce', 'participation_rate');
    const derivedValues = derived.colors.map(color => lightness(color, matrix));
    for (let i = 1; i < derivedValues.length; i++) {
      expect(derivedValues[i - 1]! - derivedValues[i]!, 'statsLaborCountyNonLaborForce:participation_rate').toBeGreaterThan(5);
    }
  });
}

it('atlas per-dimension scales keep a monotonic lightness order in every vision simulation', () => {
  for (const atlas of ATLAS_ENABLED_STATISTICS_RECIPES) {
    for (const [tuple, scale] of Object.entries(atlas.legend.by_dimension ?? {})) {
      const dimensions = Object.fromEntries(atlas.dimensions.map((dimension, index) => [dimension.key, tuple.split('|')[index]!]));
      const recipe = statisticsRenderRecipe(atlas.layer_key as typeof STATISTICS_KEYS[number], undefined, dimensions);
      expect(recipe.breaks, `${atlas.layer_key}:${tuple}`).toEqual(scale.breaks);
      expect(recipe.colors.length).toBe(recipe.breaks.length + 1);
      for (const matrix of Object.values(matrices)) {
        const values = recipe.colors.map(color => lightness(color, matrix));
        for (let i = 1; i < values.length; i++) expect(scale.direction === 'descending' ? values[i]! - values[i - 1]! : values[i - 1]! - values[i]!, `${atlas.layer_key}:${tuple}`).toBeGreaterThan(5);
      }
    }
  }
});

it('covers the signed demographics PuOr scales (natural increase / net migration) in every vision simulation', () => {
  for (const key of ['statsDemographicsCountyNaturalIncrease', 'statsDemographicsTownshipNaturalIncreaseRate', 'statsDemographicsCountyNetMigration', 'statsDemographicsTownshipNetMigrationYtd'] as const) {
    const recipe = statisticsRenderRecipe(key);
    const zeroIndex = (recipe.breaks as readonly number[]).indexOf(0);
    expect(zeroIndex, key).toBeGreaterThan(0);
    for (const matrix of Object.values(matrices)) {
      const values = recipe.colors.map(color => lightness(color, matrix));
      for (let i = 1; i <= zeroIndex; i++) expect(values[i]! - values[i - 1]!, key).toBeGreaterThan(5);
      for (let i = zeroIndex + 2; i < values.length; i++) expect(values[i - 1]! - values[i]!, key).toBeGreaterThan(5);
    }
  }
});
