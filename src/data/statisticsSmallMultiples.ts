/**
 * 統計圖層「多年份並排」（small multiples，設計提案 Q-F 方案 1，2026-11-11 使用者拍板）的純函式。
 *
 * - 年份清單：與「資料期別」連動選單同一個來源（`statisticsReleaseOptions`／公開期別），只留**非時間維度**
 *   （性別、作物、癌別…）與目前選擇相同的組合，依期別結束年分組，每年挑一期。
 * - 每年挑哪一期：優先挑與目前期別**同跨度**（起訖月日相同，例：都是 9 月底、都是 1–8 月累計、都是全年）；
 *   該年沒有同跨度的期別才退回該年最後一期，並標「期別不同」。這樣流量型指標不會把今年的部分期間和往年全年並排
 *   （統計規則 §1「同口徑、相容年份才可比較」）。
 * - 填色語意與主地圖（`map/regionalStatisticsMap.ts`）逐條相同：有值＝色階；缺值、未發布＝單向斜線；
 *   遮蔽＝交叉斜線；類別型的 not_applicable＝實心淺灰。缺值不畫成 0 或最低級色。
 * - 色階：所有年份共用目前選擇的 `statisticsRenderRecipe`（固定分級門檻，不依各年資料重算）。
 */
import { STATISTICS_RECIPES, statisticsBaseKey, type StatisticsRenderKey, type StatisticsReleaseOption } from './regionalStatisticsRecipes';
import type { StatisticsLevel, StatisticsRecipe, StatisticsRelease } from './regionalStatisticsLoader';
import { statisticsRecipe, statisticsReleaseOptions } from './statisticsSelection';
import { statisticsLinkedSelects, STATISTICS_LINKED_PROVIDER } from './statisticsParamsSpec';
import { getEnvironmentRecipe } from './environmentStatisticsRecipes';
import { getDemographicsRecipe } from './demographicsStatisticsRecipes';
import { getAddictionRecipe } from './addictionStatisticsRecipes';
import { getLandslideRecipe } from './landslideStatisticsRecipes';
import { getAtlasRecipe } from './atlasStatisticsRecipes';
import { statisticsColorStops } from './statisticsColorScale';
import { CATEGORY_FALLBACK_COLOR } from './atlasStatisticsRecipes';
import { STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR } from './statisticsFillColor';

/** 小圖一次最多先排幾年（再多就捲動、進入視野才載入）。 */
export const SMALL_MULTIPLES_PAGE = 12;

/**
 * 支援的地理層級。村里（7,700+ 區、參考邊界 80MB）先不開：小圖畫不出可辨識的村里，邊界也太重。
 * 統計區（statistical_*）沒有可用的參考邊界。
 */
export const SMALL_MULTIPLES_LEVELS: ReadonlySet<StatisticsLevel> = new Set<StatisticsLevel>([
  'county', 'township', 'prosecutor_district', 'gb_lad', 'kr_sido', 'kr_sigungu', 'ca_pr', 'ca_cd', 'ie_la', 'ie_ed',
]);

/**
 * 時間性維度：值隨期別變（年、月、學年、調查年、來源版本），比對「同一系列」時忽略。
 * 其餘維度鍵都是「系列」維度（性別、作物、癌別、口徑…），必須與目前選擇相同。
 * 新的維度鍵要歸到兩組之一（`statisticsSmallMultiples.test.ts` 掃 recipe 守門）。
 */
export const TIME_DIMENSION_KEYS: ReadonlySet<string> = new Set([
  'roc_year', 'year', 'month', 'month_range', 'quarter', 'period',
  'academic_year_roc', 'previous_academic_year_roc', 'survey_years_roc',
  'denominator_period', 'denominator_roc_year',
  // 教育統計的來源表版本（legacy_104_110／current_111_114）隨學年換，不是口徑差異
  'source_schema',
]);
export const SERIES_DIMENSION_KEYS: ReadonlySet<string> = new Set([
  'animal', 'animal_kind', 'area_basis', 'area_unit', 'crop', 'crop_code', 'fishery_type', 'season',
  'accident_class', 'bed_measure', 'education_stage', 'geographic_coverage', 'source_field',
  'case', 'party', 'complaint_target', 'complaint_type', 'inspection_type', 'material', 'site_type', 'wastewater_source',
  '機構類別', '交易類型', '行業別', 'industry', 'sub_indicator', 'bed_type', 'disease', 'sex', 'site', 'vaccine',
  'denominator', 'employee_scope', 'income_measure', 'survey', 'cause',
  'capacity_field', 'institution_classification', 'institution_type', 'registration_scope',
  '分類', '拍賣類別', '管理區分', '計畫區別', 'build_type', 'industry_code', 'industry_name',
]);

export interface SmallMultipleCandidate {
  releaseId: string;
  dimensions: Record<string, unknown>;
  release: Pick<StatisticsRelease, 'release_id' | 'period_start' | 'period_end' | 'boundary_version'>;
}

export interface PickedPeriod<C extends SmallMultipleCandidate = SmallMultipleCandidate> {
  /** 期別結束年（分組鍵） */
  year: string;
  candidate: C;
  /** 與目前期別同跨度（起訖月日相同） */
  sameSpan: boolean;
  /** 就是主地圖目前的期別 */
  current: boolean;
}

function seriesKey(dimensions: Record<string, unknown>): string {
  return JSON.stringify(Object.entries(dimensions)
    .filter(([key]) => !TIME_DIMENSION_KEYS.has(key))
    .map(([key, value]) => [key, String(value)])
    .sort(([a], [b]) => a!.localeCompare(b!)));
}

const monthDay = (date: string) => date.slice(5, 10);
const spanKey = (release: SmallMultipleCandidate['release']) => `${monthDay(release.period_start)}|${monthDay(release.period_end)}`;
const spanDays = (release: SmallMultipleCandidate['release']) => (Date.parse(release.period_end) - Date.parse(release.period_start)) / 86_400_000;

/**
 * 從候選期別挑出「每年一期」：同系列（非時間維度相同）→ 依期別結束年分組 → 目前那年用目前期別；
 * 其他年優先同跨度、沒有就取該年最後一期（`sameSpan=false`）。回傳依年份由舊到新。
 */
export function pickYearlyPeriods<C extends SmallMultipleCandidate>(candidates: readonly C[], current: C): PickedPeriod<C>[] {
  const series = seriesKey(current.dimensions);
  const anchor = spanKey(current.release);
  const anchorDays = spanDays(current.release);
  const currentYear = current.release.period_end.slice(0, 4);
  const byYear = new Map<string, C[]>();
  for (const candidate of candidates) {
    if (seriesKey(candidate.dimensions) !== series) continue;
    const year = candidate.release.period_end.slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    const list = byYear.get(year) ?? [];
    list.push(candidate);
    byYear.set(year, list);
  }
  const out: PickedPeriod<C>[] = [];
  for (const [year, list] of byYear) {
    if (year === currentYear) {
      out.push({ year, candidate: current, sameSpan: true, current: true });
      continue;
    }
    const latestFirst = [...list].sort((a, b) => b.release.period_end.localeCompare(a.release.period_end)
      || b.release.period_start.localeCompare(a.release.period_start) || b.releaseId.localeCompare(a.releaseId));
    const exact = latestFirst.find(candidate => spanKey(candidate.release) === anchor);
    if (exact) { out.push({ year, candidate: exact, sameSpan: true, current: false }); continue; }
    const lastEnd = latestFirst[0]!.release.period_end;
    const fallback = latestFirst.filter(candidate => candidate.release.period_end === lastEnd)
      .sort((a, b) => Math.abs(spanDays(a.release) - anchorDays) - Math.abs(spanDays(b.release) - anchorDays))[0]!;
    out.push({ year, candidate: fallback, sameSpan: false, current: false });
  }
  if (!byYear.has(currentYear)) out.push({ year: currentYear, candidate: current, sameSpan: true, current: true });
  return out.sort((a, b) => a.year.localeCompare(b.year));
}

/** 年份很多時先顯示最近 `limit` 年（其餘捲動後再載）；回傳要先載入的索引集合。 */
export function initialLoadIndexes(count: number, limit = SMALL_MULTIPLES_PAGE): Set<number> {
  const out = new Set<number>();
  for (let index = Math.max(0, count - limit); index < count; index += 1) out.add(index);
  return out;
}

export interface StatisticsSnapshotLike {
  selection: StatisticsRecipe | null;
  releases: StatisticsRelease[];
  release: StatisticsRelease | null;
}

export interface SmallMultiplesPlan {
  level: StatisticsLevel;
  periods: PickedPeriod<SmallMultipleCandidate & { recipe: StatisticsRecipe }>[];
}

/**
 * 依 store 快照列出可並排的年份（與 `state/statisticsLinkedSelect.ts` `buildModel` 同兩個分支：
 * 沒有 exact tuple 維度的 recipe 直接列公開期別；其他走 `statisticsReleaseOptions` 白名單）。
 * 少於 2 年、層級不支援、還沒載入 → null（不顯示按鈕）。
 */
export function smallMultiplesPlan(layerKey: StatisticsRenderKey, snapshot: StatisticsSnapshotLike): SmallMultiplesPlan | null {
  const selection = snapshot.selection;
  if (!selection || !snapshot.release || !snapshot.releases.length) return null;
  if (!SMALL_MULTIPLES_LEVELS.has(selection.level)) return null;
  const indicator = selection.indicatorId;
  const baseKey = statisticsBaseKey(layerKey, indicator);
  const specs = statisticsLinkedSelects(layerKey).filter(spec => spec.provider === STATISTICS_LINKED_PROVIDER);
  const hasRelease = specs.some(spec => spec.field === 'release');
  const hasDims = specs.some(spec => spec.field.startsWith('dim:'));
  const whitelisted = Boolean(getEnvironmentRecipe(baseKey) || getDemographicsRecipe(baseKey) || getAddictionRecipe(baseKey) || getLandslideRecipe(baseKey) || getAtlasRecipe(baseKey));
  const byId = new Map(snapshot.releases.map(release => [release.release_id, release]));
  const level = STATISTICS_RECIPES[baseKey].level as StatisticsLevel;
  type Candidate = SmallMultipleCandidate & { recipe: StatisticsRecipe };
  let candidates: Candidate[];
  if (!hasDims && hasRelease && !whitelisted) {
    const base = selection;
    candidates = snapshot.releases
      .filter(release => !release.levels || release.levels.includes(level))
      .map(release => ({ releaseId: release.release_id, dimensions: base.dimensions ?? {}, release, recipe: { ...base, releaseId: release.release_id, allowReleaseFallback: false } }));
  } else {
    const base = statisticsRecipe(layerKey, indicator);
    candidates = statisticsReleaseOptions(layerKey, snapshot.releases, indicator).flatMap((option: StatisticsReleaseOption) => {
      const release = byId.get(option.releaseId);
      return release ? [{ releaseId: option.releaseId, dimensions: option.dimensions, release, recipe: { ...base, releaseId: option.releaseId, dimensions: option.dimensions, allowReleaseFallback: false } }] : [];
    });
  }
  const currentId = snapshot.release.release_id;
  const currentDims = selection.dimensions ?? {};
  const current = candidates.find(candidate => candidate.releaseId === currentId && seriesKey(candidate.dimensions) === seriesKey(currentDims))
    ?? { releaseId: currentId, dimensions: currentDims, release: snapshot.release, recipe: { ...selection, releaseId: currentId, allowReleaseFallback: false } };
  const periods = pickYearlyPeriods(candidates, current);
  return periods.length >= 2 ? { level, periods } : null;
}

export type SmallMultipleFill =
  | { kind: 'value'; color: string }
  | { kind: 'notApplicable'; color: string }
  | { kind: 'missing' }
  | { kind: 'suppressed' };

/**
 * 一個面在小圖上的畫法，逐條對照主地圖：
 * `HAS_VALUE`（status＝observed 且 value 非 null）→ 色階；類別型 not_applicable → 實心淺灰；
 * `suppressed` → 交叉斜線；其餘（missing、未發布、not_reported、非類別的 not_applicable…）→ 單向斜線。
 */
export function smallMultipleFill(
  properties: { status?: unknown; value?: unknown } | null | undefined,
  recipe: { breaks: readonly number[]; colors: readonly string[]; categories?: ReadonlyArray<{ value: number; color: string }> },
): SmallMultipleFill {
  const status = properties?.status;
  const value = properties?.value;
  if (status === 'observed' && value !== null && value !== undefined) {
    const number = Number(value);
    if (recipe.categories?.length) return { kind: 'value', color: recipe.categories.find(category => category.value === number)?.color ?? CATEGORY_FALLBACK_COLOR };
    return { kind: 'value', color: stepColor(number, recipe.breaks, recipe.colors) };
  }
  if (status === 'suppressed') return { kind: 'suppressed' };
  if (recipe.categories?.length && status === 'not_applicable') return { kind: 'notApplicable', color: STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR };
  return { kind: 'missing' };
}

/** 與 Mapbox `step` 相同：值 ≥ 門檻就換下一色（`statisticsColorStops` 已處理重複門檻）。 */
export function stepColor(value: number, breaks: readonly number[], colors: readonly string[]): string {
  let color = colors[0]!;
  for (const stop of statisticsColorStops(breaks, colors)) if (value >= stop.value) color = stop.color;
  return color;
}
