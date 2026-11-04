import { statisticsColorStops } from './statisticsColorScale';
import { CATEGORY_FALLBACK_COLOR } from './atlasStatisticsRecipes';

/**
 * 統計 choropleth 的填色 expression（只管有值的面；缺值由呼叫端 case 包成透明）。
 * - 類別型（recipe 帶 categories，例：最高黨 1=dpp 2=kmt…）：match 整數碼 → 類別色，清單外的碼為中性灰。
 * - 其餘：step 固定門檻（breaks＋colors）。
 */
/**
 * 類別型圖層的「不適用」（例：最高黨得票並列，無單一最高黨）：實心淺灰，
 * 和缺值斜線、各政黨色都分得開。只用在類別型，其他圖層的 not_applicable 仍畫斜線。
 */
export const STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR = '#f5f5f4';

/** 填色 case：有值走 fill expression；類別型的 not_applicable 填實心灰；其餘透明。 */
export function statisticsFillCase(recipe: Parameters<typeof statisticsFillColorExpression>[0], hasValue: unknown[], noFill: string): unknown[] {
  return recipe.categories?.length
    ? ['case', hasValue, statisticsFillColorExpression(recipe), ['==', ['get', 'status'], 'not_applicable'], STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR, noFill]
    : ['case', hasValue, statisticsFillColorExpression(recipe), noFill];
}

/** 斜線（缺值）圖層 filter：類別型的 not_applicable 已實心填色，不再疊斜線。 */
export function statisticsMissingFilter(recipe: Parameters<typeof statisticsFillColorExpression>[0], isMissing: unknown[]): unknown[] {
  return recipe.categories?.length ? ['all', isMissing, ['!=', ['get', 'status'], 'not_applicable']] : isMissing;
}

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
