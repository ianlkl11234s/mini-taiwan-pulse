import { statisticsColorStops } from './statisticsColorScale';
import { CATEGORY_FALLBACK_COLOR } from './atlasStatisticsRecipes';

/**
 * 統計 choropleth 的填色 expression（只管有值的面；缺值由呼叫端 case 包成透明）。
 * - 類別型（recipe 帶 categories，例：最高黨 1=dpp 2=kmt…）：match 整數碼 → 類別色，清單外的碼為中性灰。
 * - 其餘：step 固定門檻（breaks＋colors）。
 */
export function statisticsFillColorExpression(recipe: {
  breaks: readonly number[];
  colors: readonly string[];
  categories?: ReadonlyArray<{ value: number; color: string }>;
}): unknown[] {
  if (recipe.categories?.length) {
    const match: unknown[] = ['match', ['to-number', ['get', 'value']]];
    for (const { value, color } of recipe.categories) match.push(value, color);
    match.push(CATEGORY_FALLBACK_COLOR);
    return match;
  }
  const step: unknown[] = ['step', ['get', 'value'], recipe.colors[0]];
  statisticsColorStops(recipe.breaks, recipe.colors).forEach(({ value, color }) => step.push(value, color));
  return step;
}
