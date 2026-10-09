/**
 * 統計 selection 的純函式（圖層面板統一 C 段從 `StatisticsDetails.tsx` 搬出）：預設 recipe、
 * 可選的 exact tuple（只列已公開且能完整解析的期別）、無法解析的期別數。
 * 連動選單 provider 與說明・來源共用。
 */
import { getAgriRecipe, agriReleaseOptions } from './agriStatisticsRecipes';
import { getSocialRecipe, getSocialRecipeDetails, socialReleaseOptions } from './socialStatisticsRecipes';
import { getLaborRecipe, laborReleaseOptions } from './laborStatisticsRecipes';
import { environmentReleaseOptions, getEnvironmentRecipe } from './environmentStatisticsRecipes';
import { addictionReleaseOptions, getAddictionRecipe } from './addictionStatisticsRecipes';
import { landslideReleaseOptions, getLandslideRecipe } from './landslideStatisticsRecipes';
import { demographicsReleaseOptions, getDemographicsRecipe } from './demographicsStatisticsRecipes';
import { getComparisonRecipe, comparisonReleaseOptions } from './comparisonStatisticsRecipes';
import { getEducationPresentationView } from './statisticsPresentationViews';
import { STATISTICS_RECIPES, statisticsBaseKey, statisticsRenderRecipe, statisticsReleaseFallback, type StatisticsRenderKey, type StatisticsReleaseOption } from './regionalStatisticsRecipes';
import type { StatisticsRecipe, StatisticsRelease } from './regionalStatisticsLoader';

export function statisticsRecipe(key: StatisticsRenderKey, selectedIndicator?: string): StatisticsRecipe {
  const recipe = statisticsRenderRecipe(key, selectedIndicator);
  const fallback = statisticsReleaseFallback(key);
  return {
    layerKey: key,
    datasetId: recipe.dataset_id,
    indicatorId: recipe.indicator_id,
    level: recipe.level,
    dimensions: recipe.dimensions,
    ...('releaseId' in recipe ? { releaseId: recipe.releaseId, allowReleaseFallback: true } : {}),
    ...(fallback ? { releaseFallback: fallback } : {}),
    ...('includeHealth' in recipe ? { includeHealth: recipe.includeHealth } : {}),
    ...('sourceLayerKey' in recipe ? { sourceLayerKey: recipe.sourceLayerKey } : {}),
    ...('valueTransform' in recipe ? { valueTransform: recipe.valueTransform } : {}),
    label: recipe.label,
  };
}

/** A selector is allowed to expose only public releases that resolve to an exact dimensions tuple. */
export function statisticsReleaseOptions(key: StatisticsRenderKey, releases: StatisticsRelease[], selectedIndicator?: string): StatisticsReleaseOption[] {
  const baseKey = statisticsBaseKey(key, selectedIndicator);
  const view = getEducationPresentationView(key);
  const restrictToViewStage = (options: StatisticsReleaseOption[]) => view ? options.filter(option => option.dimensions.education_stage === view.stage) : options;
  if (getComparisonRecipe(baseKey)) return restrictToViewStage(comparisonReleaseOptions(baseKey, releases));
  if (getAgriRecipe(baseKey)) return restrictToViewStage(agriReleaseOptions(baseKey, releases));
  if (getSocialRecipe(baseKey)) return restrictToViewStage(socialReleaseOptions(baseKey, releases));
  if (getLaborRecipe(baseKey)) return restrictToViewStage(laborReleaseOptions(baseKey, releases));
  if (getEnvironmentRecipe(baseKey)) return environmentReleaseOptions(baseKey, releases);
  if (getDemographicsRecipe(baseKey)) return demographicsReleaseOptions(baseKey, releases);
  if (getAddictionRecipe(baseKey)) return addictionReleaseOptions(baseKey, releases);
  if (getLandslideRecipe(baseKey)) return landslideReleaseOptions(baseKey, releases);
  const recipe = STATISTICS_RECIPES[baseKey];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return [];
  return restrictToViewStage(releases.flatMap(release => {
    const option = recipe.releaseSelector.resolve(release);
    return option ? [option] : [];
  }));
}
export function unparseableStatisticsReleaseCount(key: StatisticsRenderKey, releases: StatisticsRelease[], selectedIndicator?: string): number {
  const baseKey = statisticsBaseKey(key, selectedIndicator);
  const view = getEducationPresentationView(key);
  const source = getSocialRecipeDetails(baseKey) ?? getComparisonRecipe(baseKey);
  const scopedReleaseIds = view && source
    ? new Set(source.release_options.filter(option => option.dimensions.education_stage === view.stage).map(option => option.release_id))
    : null;
  const compatible = releases.filter(release => (!release.levels || release.levels.includes(STATISTICS_RECIPES[baseKey].level))
    && (!scopedReleaseIds || scopedReleaseIds.has(release.release_id)));
  if (getComparisonRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  if (getAgriRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  if (getSocialRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  if (getLaborRecipe(baseKey) || getEnvironmentRecipe(baseKey) || getDemographicsRecipe(baseKey) || getAddictionRecipe(baseKey) || getLandslideRecipe(baseKey)) {
    const allowed = new Set(statisticsReleaseOptions(key, compatible, selectedIndicator).map(option => option.releaseId));
    return compatible.filter(release => !allowed.has(release.release_id)).length;
  }
  const recipe = STATISTICS_RECIPES[baseKey];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return 0;
  return compatible.filter(release => !recipe.releaseSelector.resolve(release)).length;
}
