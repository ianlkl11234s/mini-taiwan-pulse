import type { LayerVisibility } from '../types';
import { getSocialRecipe, getSocialRecipeDetails } from '../data/socialStatisticsRecipes';
import { getAgriRecipe, getAgriRecipeDetails } from '../data/agriStatisticsRecipes';
import { ensureStatisticsRecipeDetails, statisticsRecipeDetailsLoaded, type StatisticsRecipeFamily } from '../data/statisticsRecipeDetails';
import { getComparisonRecipe } from '../data/comparisonStatisticsRecipes';
import { getEnvironmentRecipe } from '../data/environmentStatisticsRecipes';
import { getAddictionRecipe } from '../data/addictionStatisticsRecipes';
import { getLandslideRecipe } from '../data/landslideStatisticsRecipes';
import { atlasLazyFamily, atlasSelectionRecipe } from '../data/atlasStatisticsRecipes';
import { demographicsVillageOnlyPeriod, getDemographicsRecipe } from '../data/demographicsStatisticsRecipes';
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

/** 切換變體時期別被改動的提示（guidelines §3：不可靜默跳年份）。key = 切換後的圖層。 */
const periodNotices = new Map<string, string>();
const periodNoticeListeners = new Set<() => void>();
function setPeriodNotice(key: string, notice: string | undefined) {
  if ((periodNotices.get(key) ?? undefined) === notice) return;
  if (notice) periodNotices.set(key, notice); else periodNotices.delete(key);
  for (const listener of periodNoticeListeners) listener();
}
export function getStatisticsPeriodNotice(key: string): string | undefined {
  return periodNotices.get(key);
}
export function subscribeStatisticsPeriodNotice(listener: () => void): () => void {
  periodNoticeListeners.add(listener);
  return () => { periodNoticeListeners.delete(listener); };
}

/** Agri/social/taipeiAgency/mortality exact release_options live in that family's lazily loaded recipe details (PF-7/PF-10). */
function recipeDetailsFamilies(...keys: string[]): StatisticsRecipeFamily[] {
  const families = new Set<StatisticsRecipeFamily>();
  for (const key of keys) {
    if (getAgriRecipe(key)) families.add('agri');
    else if (getSocialRecipe(key)) families.add('social');
    else { const lazy = atlasLazyFamily(key); if (lazy) families.add(lazy); }
  }
  return [...families];
}

function recipe(key: string): Recipe {
  return getSocialRecipeDetails(key) ?? getAgriRecipeDetails(key) ?? getComparisonRecipe(key) ?? getEnvironmentRecipe(key) ?? getDemographicsRecipe(key) ?? getAddictionRecipe(key) ?? getLandslideRecipe(key) ?? atlasSelectionRecipe(key) ?? STATISTICS_RECIPES[key as keyof typeof STATISTICS_RECIPES];
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

/**
 * 兩個口徑的期別完全不重疊時（例：臺北市污水接管普及率「108 年 4 月以前舊公式」與「108 年 5 月起」），
 * 同期別永遠找不到，切換會一直失敗。只有這種情況才落到時間最接近的一期（並由呼叫端明示已切換期別）；
 * 只要兩邊有任何一期重疊，就維持「同期別才切」的規則（guidelines §3：不可靜默跳年份）。
 */
/** 只有臺北市污水接管普及率的新舊口徑適用「最近不重疊期別」退回；其他群組（例：癌症篩檢 2 年窗對 3 年窗、死因 5 年對逐年）不走。 */
const NEAREST_DISJOINT_KEYS: ReadonlySet<string> = new Set(['statsTaipeiSewerRatePublicTownship', 'statsTaipeiSewerRateLegacyTownship']);

function nearestDisjointPeriod(sourceOption: ReleaseOption, sourceOptions: readonly ReleaseOption[], targetOptions: readonly ReleaseOption[]) {
  if (!targetOptions.length) return undefined;
  const sourcePeriods = new Set(sourceOptions.map(option => `${option.period_start}|${option.period_end}`));
  if (targetOptions.some(option => sourcePeriods.has(`${option.period_start}|${option.period_end}`))) return undefined;
  const anchor = Date.parse(sourceOption.period_start);
  if (Number.isNaN(anchor)) return undefined;
  let best: ReleaseOption | undefined;
  let bestGap = Infinity;
  for (const option of targetOptions) {
    const gap = Math.abs(Date.parse(option.period_start) - anchor);
    if (gap < bestGap) { best = option; bestGap = gap; }
  }
  return best;
}

type VariantResolution = { option: ReleaseOption; samePeriod?: ReleaseOption; disjointPeriod?: ReleaseOption; onlyVillagePeriod?: ReleaseOption; demographicsTarget: ReturnType<typeof getDemographicsRecipe> };

function resolveVariantOption(from: keyof LayerVisibility, to: keyof LayerVisibility): VariantResolution | undefined {
  const source = recipe(from); const target = recipe(to);
  if (!source || !target) return undefined;
  const sourceOption = selectionOption(from, source);
  const targetOptions = releaseOptions(to, target);
  // 人口統計村里層只交付一期（11508，界線版本須與資料期別一致）：從縣市／鄉鎮的其他期別切入時落到這唯一一期
  // （主 agent 決策：只有一期可選不算「靜默跳年份」；期別寫在說明・來源）。其他群組仍要求同期別。
  // 落到這一期時在選單下方明示「已切換期別」（不靜默跳年份）。
  const demographicsTarget = getDemographicsRecipe(to);
  const onlyVillagePeriod = demographicsTarget?.level === 'village' && targetOptions.length === 1 ? targetOptions[0] : undefined;
  const samePeriod = targetOptions.find(candidate => candidate.period_start === sourceOption?.period_start && candidate.period_end === sourceOption?.period_end && sameIdentityDimensions(sourceOption, candidate));
  const nearestAllowed = NEAREST_DISJOINT_KEYS.has(from) && NEAREST_DISJOINT_KEYS.has(to);
  const disjointPeriod = samePeriod || onlyVillagePeriod || !sourceOption || !nearestAllowed ? undefined : nearestDisjointPeriod(sourceOption, releaseOptions(from, source), targetOptions);
  const option = samePeriod ?? onlyVillagePeriod ?? disjointPeriod;
  return option ? { option, samePeriod, disjointPeriod, onlyVillagePeriod, demographicsTarget } : undefined;
}

/**
 * 目前期別下，從 from 切到 to 是否做得到（供選單停用不相容選項）。
 * 只在兩邊配方明細與期別都已載入、而且確實找不到可切的期別時回 false；還沒載入就回 true（交給切換時預載）。
 */
export function canSelectMedicalStatisticsVariant(from: keyof LayerVisibility, to: keyof LayerVisibility): boolean {
  if (from === to) return true;
  if (!statisticsRecipeDetailsLoaded(recipeDetailsFamilies(from, to))) return true;
  const source = recipe(from); const target = recipe(to);
  if (!source || !target) return true;
  // 只處理「使用者已選了部分期間（非完整年度）」：其他找不到期別的情形維持原行為（切換時才報錯）。
  if (!regionalStatisticsStore.getSnapshot(from).selection) return true;
  const sourceOption = selectionOption(from, source);
  if (!sourceOption || !releaseOptions(to, target).length) return true;
  if (sourceOption.period_start.endsWith('-01-01') && sourceOption.period_end.endsWith('-12-31')) return true;
  return Boolean(resolveVariantOption(from, to));
}

/** Switch only among family members using the same period and shared identity dimensions. */
export function selectMedicalStatisticsVariant(from: keyof LayerVisibility, to: keyof LayerVisibility, members: readonly (keyof LayerVisibility)[]) {
  if (!members.includes(from) || !members.includes(to) || !isStatisticsChoropleth(to)) return false;
  // Not loaded yet: the caller falls back to prepareMedicalStatisticsVariant (shows switching state).
  if (!statisticsRecipeDetailsLoaded(recipeDetailsFamilies(from, to))) return false;
  const source = recipe(from); const target = recipe(to);
  if (!source || !target) return false;
  const resolved = resolveVariantOption(from, to);
  if (!resolved) return false;
  const { option, samePeriod, disjointPeriod, demographicsTarget } = resolved;
  const periodText = demographicsTarget ? demographicsVillageOnlyPeriod(demographicsTarget) : undefined;
  setPeriodNotice(to, samePeriod ? undefined
    : disjointPeriod ? `兩種口徑的資料期間不重疊，已切換到最接近的 ${disjointPeriod.period_start.slice(0, 7)}。`
    : `村里層僅有${periodText ? ` ${periodText}` : ''}一期，已切換期別。`);
  setPeriodNotice(from, undefined);
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
