import { expect, it } from 'vitest';
import { STATISTICS_KEYS, STATISTICS_RECIPES, statisticsRenderRecipe } from '../regionalStatisticsRecipes';

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
      if (recipe.breaks.some(v=>v<0)) {
        // Signed palettes become lighter towards zero, then darker away from zero.
        const zeroIndex = (recipe.breaks as readonly number[]).indexOf(0);
        expect(zeroIndex).toBeGreaterThanOrEqual(0);
        for (let i=1;i<=zeroIndex;i++) expect(values[i]! - values[i-1]!,key).toBeGreaterThan(5);
        for (let i=zeroIndex+2;i<values.length;i++) expect(values[i-1]! - values[i]!,key).toBeGreaterThan(5);
      } else {
        for (let i=1;i<values.length;i++) expect(values[i-1]! - values[i]!,key).toBeGreaterThan(5);
      }
    }
  });
}
