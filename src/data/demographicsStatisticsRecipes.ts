// 人口統計（內政部戶政司 RIS：P0/P1 戶籍人口與戶數、P2 年齡結構；縣市＋鄉鎮）。
// 交付 JSON 由 scripts/statistics/build_demographics_statistics_recipes.py 從 analytics handoff
// 只收 enabled recipes（村里 HOLD 不收）；首屏只帶去掉交付收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 加入 P3–P6：builder 加 handoff → 重產 catalog → 下方 KEYS 補 key → 群組規格補一列（未列的指標自動一指標一群組）。
import catalogJson from "./demographicsStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface DemographicsReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
  coverage: Record<string, unknown>;
  health: string;
}

export interface DemographicsRecipe {
  layer_key: string;
  enabled: boolean;
  label: string;
  group: string;
  subgroup: string;
  dataset_id: string;
  indicator_id: string;
  level: StatisticsLevel;
  boundary_version: string;
  unit: string;
  health: string;
  license_status: string;
  release_options: DemographicsReleaseOption[];
  legend: { method: "fixed_breaks"; breaks: number[]; colors: string[]; scale?: string; breaks_rationale?: string; comparison_rule: string };
  format: { locale: string; maximumFractionDigits: number; null: string; zero: string };
  coverage: Record<string, unknown>;
  related_layer_keys: string[];
  location_semantics: string;
  boundary_semantics: string;
  disclosure: string;
}

interface DemographicsRecipeDocument {
  scope: string;
  recipes: DemographicsRecipe[];
}

export const DEMOGRAPHICS_ENABLED_STATISTICS_KEYS = [
  // P0/P1 戶籍人口與戶數
  "statsDemographicsCountyPopulationTotal", "statsDemographicsCountyHouseholdCount", "statsDemographicsCountyHouseholdSize", "statsDemographicsCountyPopulationDensity",
  "statsDemographicsTownshipPopulationTotal", "statsDemographicsTownshipHouseholdCount", "statsDemographicsTownshipHouseholdSize", "statsDemographicsTownshipPopulationDensity",
  // P2 年齡結構
  "statsDemographicsCountyPopAge0To14", "statsDemographicsCountyPopAge15To64", "statsDemographicsCountyPopAge65Plus",
  "statsDemographicsCountyShareAge0To14", "statsDemographicsCountyShareAge15To64", "statsDemographicsCountyShareAge65Plus",
  "statsDemographicsCountyAgingIndex", "statsDemographicsCountyDependencyRatio", "statsDemographicsCountyChildDependencyRatio",
  "statsDemographicsCountyOldDependencyRatio", "statsDemographicsCountySexRatio", "statsDemographicsCountyMedianAge",
  "statsDemographicsTownshipPopAge0To14", "statsDemographicsTownshipPopAge15To64", "statsDemographicsTownshipPopAge65Plus",
  "statsDemographicsTownshipShareAge0To14", "statsDemographicsTownshipShareAge15To64", "statsDemographicsTownshipShareAge65Plus",
  "statsDemographicsTownshipAgingIndex", "statsDemographicsTownshipDependencyRatio", "statsDemographicsTownshipChildDependencyRatio",
  "statsDemographicsTownshipOldDependencyRatio", "statsDemographicsTownshipSexRatio", "statsDemographicsTownshipMedianAge",
] as const;
export type DemographicsStatisticsLayerKey = typeof DEMOGRAPHICS_ENABLED_STATISTICS_KEYS[number];

/** Layers／Statistics 的主題標題（沿用既有「人口統計」主題，city 分頁）。 */
export const DEMOGRAPHICS_STATISTICS_THEME_TITLE = "人口統計 Population Statistics";

const document = catalogJson as unknown as DemographicsRecipeDocument;
export const DEMOGRAPHICS_STATISTICS_SCOPE = document.scope;
export const DEMOGRAPHICS_STATISTICS_RECIPES = document.recipes;
export const DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES = DEMOGRAPHICS_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<DemographicsStatisticsLayerKey, DemographicsRecipe>;

export function getDemographicsRecipe(key: string): DemographicsRecipe | undefined {
  return DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY[key as DemographicsStatisticsLayerKey];
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

function latestFirst(a: DemographicsReleaseOption, b: DemographicsReleaseOption): number {
  return b.period_end.localeCompare(a.period_end) || b.period_start.localeCompare(a.period_start) || b.release_id.localeCompare(a.release_id);
}

/** 最新已交付期別（STATISTICS_RECIPES 首屏預設 dimensions；loader 仍以公開 manifest 交集為準）。 */
export function demographicsLatestOption(recipe: DemographicsRecipe): DemographicsReleaseOption | undefined {
  return [...recipe.release_options].sort(latestFirst)[0];
}

/** Intersects public releases with the delivered exact tuples, latest period first. */
export function demographicsReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getDemographicsRecipe(key);
  if (!recipe?.enabled) return [];
  const published = new Map(releases.map((release) => [release.release_id, release]));
  return recipe.release_options
    .filter((option) => {
      const release = published.get(option.release_id);
      return release?.dataset_id === recipe.dataset_id
        && release.indicator_id === recipe.indicator_id
        && release.period_start === option.period_start
        && release.period_end === option.period_end
        && release.boundary_version === recipe.boundary_version
        && (!release.levels || release.levels.includes(recipe.level));
    })
    .sort(latestFirst)
    .map((option) => ({ releaseId: option.release_id, dimensions: option.dimensions }));
}

/** Refuses partial dimension selections and opaque-id guesses. */
export function resolveDemographicsRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getDemographicsRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}

/** 依 indicator_id 的使用者說明（不綁 layer key，P3–P6 新指標不會誤繼承）。 */
const INDICATOR_NOTES: Record<string, string> = {
  population_density: "人口密度的面積為參考邊界在 EPSG:3826 的平面面積，不是內政部公告土地面積；縣市合計比公告面積約多 1.8%，密度因此略低於公告值。",
  household_size: "戶量＝戶籍人口數 ÷ 戶數（平均每戶人口），於本層級加總後計算，不平均子區比率。",
  median_age: "年齡中位數為本專案依單一年齡人口內插自算，非內政部公告值。",
};

export function demographicsIndicatorNote(recipe: Pick<DemographicsRecipe, "indicator_id">): string | undefined {
  return INDICATOR_NOTES[recipe.indicator_id];
}

/** 來源卡授權措辭：RIS API 授權欄位尚未以 data.gov.tw 資料集頁確認，不得寫成 OGDL。 */
export const DEMOGRAPHICS_SOURCE_LABEL = "內政部戶政司 RIS（授權條款待確認）";

const LEVEL_LABELS: Partial<Record<StatisticsLevel, string>> = { county: "縣市", township: "鄉鎮市區" };

/**
 * Statistics 群組：一列＝一個概念；選單在同一群組內切換指標與縣市／鄉鎮（同期別保留）。
 * 未列在這裡的已啟用指標會自動成為「一指標一群組」，P3–P6 不會漏接。
 */
const GROUP_SPECS: ReadonlyArray<{ key: string; label: string; indicators: readonly string[] }> = [
  { key: "populationTotal", label: "戶籍人口數", indicators: ["population_total"] },
  { key: "householdCount", label: "戶數", indicators: ["household_count"] },
  { key: "householdSize", label: "戶量（平均每戶人口）", indicators: ["household_size"] },
  { key: "populationDensity", label: "人口密度", indicators: ["population_density"] },
  { key: "ageGroupPopulation", label: "年齡組人口數", indicators: ["pop_age_0_14", "pop_age_15_64", "pop_age_65_plus"] },
  { key: "ageGroupShare", label: "年齡組人口占比", indicators: ["share_age_0_14", "share_age_15_64", "share_age_65_plus"] },
  { key: "agingDependency", label: "老化指數與扶養比", indicators: ["aging_index", "dependency_ratio", "child_dependency_ratio", "old_dependency_ratio"] },
  { key: "sexRatio", label: "性比例", indicators: ["sex_ratio"] },
  { key: "medianAge", label: "年齡中位數", indicators: ["median_age"] },
];

const LEVEL_ORDER: StatisticsLevel[] = ["county", "township", "village"];

function groupSpecs() {
  const covered = new Set(GROUP_SPECS.flatMap((spec) => spec.indicators));
  const extra: Array<{ key: string; label: string; indicators: readonly string[] }> = [];
  for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
    if (covered.has(recipe.indicator_id)) continue;
    covered.add(recipe.indicator_id);
    extra.push({ key: recipe.indicator_id, label: recipe.label, indicators: [recipe.indicator_id] });
  }
  return [...GROUP_SPECS, ...extra];
}

/** Toggle groups consumed by medicalStatisticsGroups.ts（縣市在前、鄉鎮在後；群組內同期別切換）。 */
export const DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS = groupSpecs()
  .map((spec) => {
    const members = DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES
      .filter((recipe) => spec.indicators.includes(recipe.indicator_id))
      .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
        || spec.indicators.indexOf(a.indicator_id) - spec.indicators.indexOf(b.indicator_id));
    const single = spec.indicators.length === 1;
    return {
      key: `demographics:${spec.key}`,
      label: spec.label,
      optionLabel: single ? "地理層級" : "指標／地理層級",
      options: members.map((recipe) => ({
        key: recipe.layer_key,
        label: single ? LEVEL_LABELS[recipe.level] ?? recipe.level : `${LEVEL_LABELS[recipe.level] ?? recipe.level}：${recipe.label}`,
      })),
    };
  })
  .filter((group) => group.options.length > 0);

/** Statistics 分頁的小群組標題：依 recipe subgroup 去掉層級括號（戶籍人口／年齡結構…）。 */
export function demographicsTabGroupTitle(recipe: Pick<DemographicsRecipe, "subgroup">): string {
  return recipe.subgroup.replace(/（[^）]*）$/, "");
}
