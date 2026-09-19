import raw from './comparisonStatisticsRecipes.json';
import { COMPARISON_STATISTICS_KEYS, type ComparisonStatisticsLayerKey } from './comparisonStatisticsKeys';
import type { StatisticsLevel, StatisticsRelease } from './regionalStatisticsLoader';
export { COMPARISON_STATISTICS_KEYS, type ComparisonStatisticsLayerKey };
export interface ComparisonRecipe {
  layer_key: ComparisonStatisticsLayerKey; dataset_id: string; indicator_id: string;
  label: string; unit: string; level: StatisticsLevel; boundary_version: string;
  groupKey: string; groupLabel: string; optionLabel: string; disclosure: string;
  release_options: { release_id: string; period_start: string; period_end: string; dimensions: Record<string,string> }[];
  legend: { breaks: number[]; colors: string[] };
}
export const COMPARISON_ENABLED_RECIPES = raw as ComparisonRecipe[];
/**
 * Comparison recipes are kept locally for contract and manifest validation.
 * They become selectable only in development or when a release explicitly opts in.
 */
// `layerManifest` is also imported by Node/tsx audit scripts, where Vite does
// not inject import.meta.env.  Keep the production default disabled there.
const runtimeEnv = import.meta.env ?? {};
export const STATISTICS_COMPARISONS_UI_ENABLED = runtimeEnv.DEV
  || runtimeEnv.VITE_STATISTICS_COMPARISONS_ENABLED === 'true';
export const COMPARISON_UI_RECIPES = STATISTICS_COMPARISONS_UI_ENABLED
  ? COMPARISON_ENABLED_RECIPES
  : [];
const byKey = Object.fromEntries(COMPARISON_ENABLED_RECIPES.map(r => [r.layer_key,r])) as Record<ComparisonStatisticsLayerKey,ComparisonRecipe>;
export function getComparisonRecipe(key: string): ComparisonRecipe | undefined { return byKey[key as ComparisonStatisticsLayerKey]; }
export function comparisonReleaseOptions(key: string, releases: StatisticsRelease[]) {
  const recipe=getComparisonRecipe(key);
  return recipe?.release_options.filter(o => releases.some(r => r.release_id===o.release_id && r.period_start===o.period_start && r.period_end===o.period_end && r.boundary_version===recipe.boundary_version)).map(o => ({releaseId:o.release_id,dimensions:o.dimensions})) ?? [];
}
