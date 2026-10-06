// 成癮與減害統計（HIV、毒品／酒駕／地檢署執法、吸菸與檳榔調查、服務據點；縣市＋鄉鎮，65 recipe、61 啟用）。
// 交付 JSON 由 scripts/statistics/build_addiction_statistics_recipes.py 從 analytics 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
import catalogJson from "./addictionStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface AddictionReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}

/** 非數值狀態：不適用（地檢署轄區跨縣市）、無資料（調查未涵蓋）、隱私遮蔽（1–2 例）；都不上數值色。 */
export type AddictionStatusKind = "not_applicable" | "missing" | "suppressed";

export interface AddictionRecipe {
  layer_key: string;
  enabled: boolean;
  label: string;
  /** Statistics 群組 key（同一概念一列；原始數／比例、縣市／鄉鎮在群組選單內切換）。 */
  group: string;
  group_label: string;
  /** 群組選單中本層的選項文字。 */
  option_label: string;
  /** 「成癮與減害」下的小群組（疾病／執法／行為調查／服務據點）。 */
  subgroup: string;
  visual_theme: "health" | "security";
  dataset_id: string;
  indicator_id: string;
  level: StatisticsLevel;
  boundary_version: string;
  unit: string;
  aggregation: string;
  default_release_id: string;
  release_options: AddictionReleaseOption[];
  legend: { method: "fixed_breaks"; breaks: number[]; zero_note: string | null };
  status_labels: Partial<Record<AddictionStatusKind, string>>;
  format: { locale: string; maximumFractionDigits: number };
  pair_raw_key: string | null;
  derived: boolean;
  location_semantics: string;
  disclosure: string;
  publisher: string;
  license: string;
  source_landing_url: string;
  source_download_url: string;
  source_title: string;
}

interface AddictionRecipeDocument {
  scope: string;
  recipes: AddictionRecipe[];
}

export const ADDICTION_ENABLED_STATISTICS_KEYS = [
  "statsHivNewCasesCounty", "statsHivPer100kCounty", "statsHivCasesTownship", "statsHivPer100kYearTownship",
  "statsDrugSuspectsCounty", "statsDrugSuspectsPer100kCounty", "statsDrugUseSuspectsCounty", "statsDrugUseSuspectsPer100kCounty",
  "statsDrugGrade1SuspectsCounty", "statsDrugGrade1SuspectsPer100kCounty",
  "statsDuiCasesCounty", "statsDuiRateCounty", "statsDuiEnforcementCounty", "statsDuiEnforcementPer100kCounty",
  "statsProsecutorDrugNewCasesCounty", "statsProsecutorDrugUseCounty", "statsProsecutorDrugGrade1County",
  "statsProsecutorDrugGrade2County", "statsProsecutorDeferredTreatmentCounty",
  "statsAdultSmokingRateCounty", "statsAdultBetelRateCounty",
  "statsNeedleEducationStationsCounty", "statsNeedleEducationStationsPer100kCounty", "statsNeedleEducationStationsTownship", "statsNeedleEducationStationsPer100kTownship",
  "statsNeedleVendingMachinesCounty", "statsNeedleVendingMachinesPer100kCounty", "statsNeedleVendingMachinesTownship", "statsNeedleVendingMachinesPer100kTownship",
  "statsNeedleReturnBinsCounty", "statsNeedleReturnBinsPer100kCounty", "statsNeedleReturnBinsTownship", "statsNeedleReturnBinsPer100kTownship",
  "statsDrugTreatmentFacilitiesCounty", "statsDrugTreatmentFacilitiesPer100kCounty", "statsDrugTreatmentFacilitiesTownship", "statsDrugTreatmentFacilitiesPer100kTownship",
  "statsAlcoholTreatmentFacilitiesCounty", "statsAlcoholTreatmentFacilitiesPer100kCounty", "statsAlcoholTreatmentFacilitiesTownship", "statsAlcoholTreatmentFacilitiesPer100kTownship",
  "statsHivTestingSitesCounty", "statsHivTestingSitesPer100kCounty", "statsHivTestingSitesTownship", "statsHivTestingSitesPer100kTownship",
  "statsHivSelftestOutletsCounty", "statsHivSelftestOutletsPer100kCounty", "statsHivSelftestOutletsTownship", "statsHivSelftestOutletsPer100kTownship",
  "statsPrepServiceSitesCounty", "statsPrepServiceSitesPer100kCounty", "statsPrepServiceSitesTownship", "statsPrepServiceSitesPer100kTownship",
  "statsSmokingCessationProvidersCounty", "statsSmokingCessationProvidersPer100kCounty", "statsSmokingCessationProvidersTownship", "statsSmokingCessationProvidersPer100kTownship",
  "statsInternetAddictionServicesCounty", "statsInternetAddictionServicesPer100kCounty", "statsInternetAddictionServicesTownship", "statsInternetAddictionServicesPer100kTownship",
] as const;
export type AddictionStatisticsLayerKey = typeof ADDICTION_ENABLED_STATISTICS_KEYS[number];

/** Layers 階層（完整目錄）的主題標題；manifest section 也用它。 */
export const ADDICTION_STATISTICS_THEME_TITLE = "成癮與減害統計 Addiction & Harm Reduction Statistics";
/** Statistics 分頁的主題標題（STATISTICS_MACRO_GROUPS「人口與社會」）。 */
export const ADDICTION_STATISTICS_TAB_THEME_TITLE = "成癮與減害 Addiction & Harm Reduction";
/** 小群組閱讀順序（疾病 → 執法 → 行為調查 → 服務據點）。 */
export const ADDICTION_STATISTICS_SUBGROUPS = ["疾病（HIV）", "執法（毒品、酒駕、地檢署）", "行為調查（吸菸、檳榔）", "服務據點"] as const;

const document = catalogJson as unknown as AddictionRecipeDocument;
export const ADDICTION_STATISTICS_SCOPE = document.scope;
export const ADDICTION_STATISTICS_RECIPES = document.recipes;
/** 交付順序以外，依 ADDICTION_ENABLED_STATISTICS_KEYS 排序（群組內原始數在前、縣市在前）。 */
export const ADDICTION_ENABLED_STATISTICS_RECIPES = ADDICTION_ENABLED_STATISTICS_KEYS.map((key) => {
  const recipe = ADDICTION_STATISTICS_RECIPES.find((candidate) => candidate.layer_key === key);
  if (!recipe?.enabled) throw new Error(`addiction recipe ${key} missing or disabled`);
  return recipe;
});
export const ADDICTION_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  ADDICTION_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<AddictionStatisticsLayerKey, AddictionRecipe>;

export function getAddictionRecipe(key: string): AddictionRecipe | undefined {
  return ADDICTION_STATISTICS_RECIPES_BY_KEY[key as AddictionStatisticsLayerKey];
}

/**
 * Intersects public releases with the delivered exact selectors (latest period first).
 * The family has no dimensions; any public release outside the whitelist is ignored.
 */
export function addictionReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getAddictionRecipe(key);
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
    .sort((a, b) => b.period_end.localeCompare(a.period_end) || b.period_start.localeCompare(a.period_start))
    .map((option) => ({ releaseId: option.release_id, dimensions: option.dimensions }));
}

/** Refuses opaque-id guesses and any dimensions (the family has none). */
export function resolveAddictionRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getAddictionRecipe(key);
  if (!recipe?.enabled || Object.keys(selectedDimensions).length > 0) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end);
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}

/** 圖例的非數值狀態列：依本層實際會出現的狀態分開列出（S7 不適用、S4 無資料、S6 隱私遮蔽）。 */
export function addictionStatusLegendRows(recipe: AddictionRecipe): Array<{ kind: AddictionStatusKind; hatch: "missing" | "suppressed"; label: string }> {
  return (["not_applicable", "missing", "suppressed"] as const)
    .filter((kind) => recipe.status_labels[kind])
    .map((kind) => ({ kind, hatch: kind === "suppressed" ? "suppressed" : "missing", label: recipe.status_labels[kind]! }));
}

/** 群組（同一概念一列）：原始數／比例、縣市／鄉鎮在同一列切換；單一指標（吸菸率、嚼檳榔率）不成群組。 */
export const ADDICTION_STATISTICS_TOGGLE_GROUPS = [...new Set(ADDICTION_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.group))]
  .map((group) => {
    const members = ADDICTION_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.group === group);
    const levels = new Set(members.map((recipe) => recipe.level));
    const sameDataset = members.every((recipe) => recipe.dataset_id === members[0]!.dataset_id && recipe.unit === members[0]!.unit);
    return {
      key: `addiction:${group}`,
      label: members[0]!.group_label,
      optionLabel: levels.size > 1 ? "地理層級／口徑" : sameDataset && !members.some((recipe) => recipe.derived) ? "指標" : "口徑",
      options: members.map((recipe) => ({ key: recipe.layer_key, label: recipe.option_label })),
    };
  })
  .filter((group) => group.options.length > 1);
