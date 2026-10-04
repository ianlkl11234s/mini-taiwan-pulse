import type { LayerVisibility } from '../types';
import { getSocialRecipe, getSocialRecipeDetails } from '../data/socialStatisticsRecipes';
import { getAgriRecipe, getAgriRecipeDetails } from '../data/agriStatisticsRecipes';
import { ensureStatisticsRecipeDetails, statisticsRecipeDetailsLoaded, type StatisticsRecipeFamily } from '../data/statisticsRecipeDetails';
import { getComparisonRecipe } from '../data/comparisonStatisticsRecipes';
import { getEnvironmentRecipe } from '../data/environmentStatisticsRecipes';
import { getDemographicsRecipe } from '../data/demographicsStatisticsRecipes';
import { STATISTICS_RECIPES } from '../data/regionalStatisticsRecipes';
import { regionalStatisticsStore } from './regionalStatisticsStore';
import type { StatisticsRecipe, StatisticsRelease } from '../data/regionalStatisticsLoader';
import { layerParamsStore } from './layerParamsStore';
import { layerVisibilityStore } from './layerVisibilityStore';
import { statisticsDisplayModeStore } from './statisticsDisplayModeStore';
import { isStatisticsChoropleth } from '../data/statisticsLayerRegistry';

type ReleaseOption = { release_id: string; period_start: string; period_end: string; dimensions: Record<string, string> };
type ReleaseResolver = { resolve(release: StatisticsRelease): { releaseId: string; dimensions: Record<string, string> } | null };
type Recipe = { dataset_id: string; indicator_id: string; level: string; label: string; dimensions?: Record<string, string>; releaseId?: string; release_options?: readonly ReleaseOption[]; releaseSelector?: ReleaseResolver } | undefined;

const METRIC_DIMENSIONS = new Set(['source_field', 'denominator_period', 'bed_measure']);

/** Agri/social exact release_options live in that family's lazily loaded recipe details (PF-7/PF-10). */
function recipeDetailsFamilies(...keys: string[]): StatisticsRecipeFamily[] {
  const families = new Set<StatisticsRecipeFamily>();
  for (const key of keys) {
    if (getAgriRecipe(key)) families.add('agri');
    else if (getSocialRecipe(key)) families.add('social');
  }
  return [...families];
}

function recipe(key: string): Recipe {
  return getSocialRecipeDetails(key) ?? getAgriRecipeDetails(key) ?? getComparisonRecipe(key) ?? getEnvironmentRecipe(key) ?? getDemographicsRecipe(key) ?? STATISTICS_RECIPES[key as keyof typeof STATISTICS_RECIPES];
}

function releaseOptions(key: string, source: NonNullable<Recipe>): ReleaseOption[] {
  if (source.release_options) return [...source.release_options];
  return regionalStatisticsStore.getSnapshot(key).releases.flatMap(release => {
    if (source.releaseSelector) {
      const selected = source.releaseSelector.resolve(release);
      return selected ? [{ release_id: selected.releaseId, period_start: release.period_start, period_end: release.period_end, dimensions: selected.dimensions }] : [];
    }
    return [{ release_id: release.release_id, period_start: release.period_start, period_end: release.period_end, dimensions: source.dimensions ?? {} }];
  });
}

function selectionOption(key: string, source: NonNullable<Recipe>): ReleaseOption | undefined {
  const snapshot = regionalStatisticsStore.getSnapshot(key);
  const options = releaseOptions(key, source);
  const dimensions = snapshot.selection?.dimensions ?? {};
  const matchesDimensions = (option: ReleaseOption) => Object.keys(dimensions).length > 0 && Object.entries(dimensions).every(([dimension, value]) => option.dimensions[dimension] === value);
  if (Object.keys(dimensions).length > 0) {
    return options.find(option => option.release_id === snapshot.selection?.releaseId && matchesDimensions(option))
      ?? options.find(matchesDimensions);
  }
  return options.find(option => option.release_id === snapshot.selection?.releaseId)
    ?? options.find(option => option.release_id === snapshot.release?.release_id)
    ?? options[0];
}

function sameIdentityDimensions(source: ReleaseOption | undefined, candidate: ReleaseOption) {
  if (!source) return false;
  for (const [key, value] of Object.entries(source.dimensions)) {
    if (METRIC_DIMENSIONS.has(key) || !(key in candidate.dimensions)) continue;
    if (candidate.dimensions[key] !== value) return false;
  }
  for (const key of ['animal', 'quarter']) {
    if (key in source.dimensions && candidate.dimensions[key] !== source.dimensions[key]) return false;
  }
  return true;
}

function storeRecipe(key: keyof LayerVisibility, source: NonNullable<Recipe>): StatisticsRecipe {
  return {
    layerKey: key, datasetId: source.dataset_id, indicatorId: source.indicator_id,
    level: source.level as StatisticsRecipe['level'], label: source.label,
    dimensions: source.dimensions ?? {}, releaseId: source.releaseId,
    allowReleaseFallback: false, includeHealth: true,
    releaseFallback: source.releaseSelector ? release => source.releaseSelector!.resolve(release)?.dimensions ?? null : undefined,
  };
}

async function ensureReleaseMetadata(key: keyof LayerVisibility, source: NonNullable<Recipe>) {
  if (source.release_options?.length || regionalStatisticsStore.getSnapshot(key).releases.length) return;
  if (!regionalStatisticsStore.getSnapshot(key).selection) regionalStatisticsStore.setSelection(key, storeRecipe(key, source));
  await regionalStatisticsStore.load(key);
  const snapshot = regionalStatisticsStore.getSnapshot(key);
  if (snapshot.error || !snapshot.releases.length) throw new Error(snapshot.error || '找不到可用期別');
}

/** Switch only among family members using the same period and shared identity dimensions. */
export function selectMedicalStatisticsVariant(from: keyof LayerVisibility, to: keyof LayerVisibility, members: readonly (keyof LayerVisibility)[]) {
  if (!members.includes(from) || !members.includes(to) || !isStatisticsChoropleth(to)) return false;
  // Not loaded yet: the caller falls back to prepareMedicalStatisticsVariant (shows switching state).
  if (!statisticsRecipeDetailsLoaded(recipeDetailsFamilies(from, to))) return false;
  const source = recipe(from); const target = recipe(to);
  if (!source || !target) return false;
  const sourceOption = selectionOption(from, source);
  const targetOptions = releaseOptions(to, target);
  // 人口統計村里層只交付一期（11508，界線版本須與資料期別一致）：從縣市／鄉鎮的其他期別切入時落到這唯一一期
  // （主 agent 決策：只有一期可選不算「靜默跳年份」；期別寫在說明・來源）。其他群組仍要求同期別。
  const onlyVillagePeriod = getDemographicsRecipe(to)?.level === 'village' && targetOptions.length === 1 ? targetOptions[0] : undefined;
  const option = targetOptions.find(candidate => candidate.period_start === sourceOption?.period_start && candidate.period_end === sourceOption?.period_end && sameIdentityDimensions(sourceOption, candidate))
    ?? onlyVillagePeriod;
  if (!option) return false;
  regionalStatisticsStore.setSelection(to, { layerKey: to, datasetId: target.dataset_id, indicatorId: target.indicator_id, level: target.level as StatisticsRecipe['level'], label: target.label, releaseId: option.release_id, dimensions: option.dimensions, allowReleaseFallback: false, includeHealth: true });
  const opacity = layerParamsStore.getParam(from, `${from}Opacity`);
  if (typeof opacity === 'number') layerParamsStore.setParam(to, `${to}Opacity`, opacity);
  let next = layerVisibilityStore.getAll();
  for (const key of members) if (isStatisticsChoropleth(key)) next = statisticsDisplayModeStore.setVisible(key, false, next);
  layerVisibilityStore.setAll(statisticsDisplayModeStore.enable(to, next));
  return true;
}

/** Preload a target before switching; cancellation leaves both selection and visibility unchanged. */
export async function prepareMedicalStatisticsVariant(from: keyof LayerVisibility, to: keyof LayerVisibility, members: readonly (keyof LayerVisibility)[], isCurrent: () => boolean = () => true) {
  if (!members.includes(from) || !members.includes(to) || !isStatisticsChoropleth(to)) return false;
  try {
    await ensureStatisticsRecipeDetails(recipeDetailsFamilies(from, to));
  } catch {
    return false;
  }
  if (!isCurrent()) return false;
  const source = recipe(from); const target = recipe(to);
  if (!source || !target) return false;
  try {
    await ensureReleaseMetadata(from, source);
    await ensureReleaseMetadata(to, target);
  } catch {
    return false;
  }
  if (!isCurrent()) return false;
  return selectMedicalStatisticsVariant(from, to, members);
}
