// 環境統計（環境部／國土管理署 18 dataset、37 layer）。交付 JSON 由
// scripts/statistics/build_environment_statistics_recipes.py 從 analytics 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
import catalogJson from "./environmentStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface EnvironmentReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}

export interface EnvironmentDimension {
  key: string;
  default: string;
  options: Array<{ value: string; label: string }>;
}

export interface EnvironmentRecipe {
  layer_key: string;
  enabled: boolean;
  label: string;
  /** 中分類（Layers 階層的 theme，例如「污染與公害統計」）。 */
  group: string;
  /** 小分組（例如「公害陳情」）。 */
  subgroup: string;
  /** Statistics 分頁「環境與資源」下的群組。 */
  tab_group: string;
  visual_theme: "environment" | "utilities";
  dataset_id: string;
  indicator_id: string;
  level: StatisticsLevel;
  boundary_version: string;
  unit: string;
  aggregation: string;
  default_release_id: string;
  release_options: EnvironmentReleaseOption[];
  dimension: EnvironmentDimension | null;
  legend: { method: "fixed_breaks" | "binary"; breaks: number[]; binary_labels: [string, string] | null };
  format: { locale: string; maximumFractionDigits: number };
  toggle: { group: string; label: string | null; option_label: string; members: string[] | null } | null;
  pair_raw_key: string | null;
  derived: boolean;
  location_semantics: string;
  disclosure: string;
  source_note: string;
  publisher: string;
  license: string;
  source_landing_url: string;
  source_download_url: string;
  source_title?: string;
}

interface EnvironmentRecipeDocument {
  scope: string;
  recipes: EnvironmentRecipe[];
}

export const ENVIRONMENT_ENABLED_STATISTICS_KEYS = [
  "statsComplaintsCounty", "statsComplaintTargetCounty", "statsComplaintCasesPndCounty", "statsComplaintPopulationCounty",
  "statsComplaintsPer10kCounty", "statsEnvInspectionsCounty", "statsEnvFineCasesCounty", "statsEnvFineAmountCounty",
  "statsEnvFineCollectedCounty", "statsAqiPoorRatioCounty", "statsSoilControlAreaCounty", "statsSoilRemediationAreaCounty",
  "statsWasteGeneratedCounty", "statsWastePerCapitaCounty", "statsGeneralGarbageCounty", "statsFoodWasteCounty",
  "statsRecyclingAmountCounty", "statsResponsibleEnterprisesCounty", "statsTapWaterTestsCounty", "statsTapWaterFailuresCounty",
  "statsTapWaterFailureRateCounty", "statsBodGeneratedCounty", "statsBodDischargedCounty", "statsSewerConnectionCounty",
  "statsSewageTreatmentCounty", "statsMotorArrivalRateCounty", "statsMotorNotifiedCounty", "statsMotorTestedCounty",
  "statsBurningComplaintsCounty", "statsComplaintsPer10kDerivedCounty", "statsBurningComplaintsPer10kCounty",
  "statsEnvInspectionsPerFacilityCounty", "statsEnvFineRateCounty", "statsWasteGeneratedPer10kCounty",
  "statsGeneralGarbagePer10kCounty", "statsRecyclingPer10kCounty", "statsBodDischargedPerKm2County",
] as const;
export type EnvironmentStatisticsLayerKey = typeof ENVIRONMENT_ENABLED_STATISTICS_KEYS[number];

/** Layers 階層的中分類標題（沿用既有雙語 theme 命名；廢棄物／資源回收沿用既有 theme）。 */
export const ENVIRONMENT_STATISTICS_THEME_TITLES: Record<string, string> = {
  廢棄物統計: "廢棄物統計 Waste Statistics",
  資源回收統計: "資源回收統計 Recycling Statistics",
  水質與污水統計: "水質與污水統計 Water Quality & Sewage Statistics",
  空氣品質統計: "空氣品質統計 Air Quality Statistics",
  污染與公害統計: "污染與公害統計 Pollution & Nuisance Statistics",
  環境治理統計: "環境治理統計 Environmental Enforcement Statistics",
};

const document = catalogJson as unknown as EnvironmentRecipeDocument;
export const ENVIRONMENT_STATISTICS_SCOPE = document.scope;
export const ENVIRONMENT_STATISTICS_RECIPES = document.recipes;
export const ENVIRONMENT_ENABLED_STATISTICS_RECIPES = ENVIRONMENT_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const ENVIRONMENT_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  ENVIRONMENT_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<EnvironmentStatisticsLayerKey, EnvironmentRecipe>;

export function getEnvironmentRecipe(key: string): EnvironmentRecipe | undefined {
  return ENVIRONMENT_STATISTICS_RECIPES_BY_KEY[key as EnvironmentStatisticsLayerKey];
}

/** 預設 dimensions：交付指定的 default（通常是「總計」）；無 dimension 的為空 tuple。 */
export function environmentDefaultDimensions(recipe: EnvironmentRecipe): Record<string, string> {
  return recipe.dimension ? { [recipe.dimension.key]: recipe.dimension.default } : {};
}

const DIMENSION_LABELS = new Map<string, string>([
  ["complaint_type", "陳情事由"], ["complaint_target", "陳情對象"], ["inspection_type", "稽查類別"],
  ["site_type", "場址類型"], ["material", "回收物種類"], ["wastewater_source", "污水來源"],
]);
const DIMENSION_VALUE_LABELS = new Map<string, Map<string, string>>();
for (const recipe of ENVIRONMENT_STATISTICS_RECIPES) {
  if (!recipe.dimension) continue;
  const labels = DIMENSION_VALUE_LABELS.get(recipe.dimension.key) ?? new Map<string, string>();
  for (const option of recipe.dimension.options) labels.set(option.value, option.label);
  DIMENSION_VALUE_LABELS.set(recipe.dimension.key, labels);
}

export function environmentDimensionLabel(key: string): string | undefined {
  return DIMENSION_LABELS.get(key);
}

export function environmentDimensionValueLabel(key: string, value: string): string | undefined {
  return DIMENSION_VALUE_LABELS.get(key)?.get(value);
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

function dimensionRank(recipe: EnvironmentRecipe, option: EnvironmentReleaseOption): number {
  if (!recipe.dimension) return 0;
  const value = option.dimensions[recipe.dimension.key];
  if (value === recipe.dimension.default) return -1;
  return recipe.dimension.options.findIndex((candidate) => candidate.value === value);
}

/**
 * Intersects public releases with the delivered exact tuples. Latest period first;
 * within a period the delivered default dimension (總計) comes first, then source order.
 */
export function environmentReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getEnvironmentRecipe(key);
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
    .sort((a, b) => b.period_end.localeCompare(a.period_end)
      || b.period_start.localeCompare(a.period_start)
      || dimensionRank(recipe, a) - dimensionRank(recipe, b))
    .map((option) => ({ releaseId: option.release_id, dimensions: option.dimensions }));
}

/** Refuses partial dimension selections and opaque-id guesses. */
export function resolveEnvironmentRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getEnvironmentRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}

/** Binary recipes (自來水不合格) read as 有／無, not as a numeric threshold. */
export function environmentLegendRows(recipe: EnvironmentRecipe, colors: readonly string[]) {
  if (recipe.legend.method !== "binary" || !recipe.legend.binary_labels) return null;
  return [
    { color: colors[0]!, label: recipe.legend.binary_labels[0] },
    { color: colors[colors.length - 1]!, label: recipe.legend.binary_labels[1] },
  ];
}

/** Raw/ratio toggles (原始數／每萬人／每列管設施／每平方公里) and the pnd source-table 指標 toggle. */
export const ENVIRONMENT_STATISTICS_TOGGLE_GROUPS = ENVIRONMENT_ENABLED_STATISTICS_RECIPES
  .filter((recipe) => recipe.toggle?.members)
  .map((recipe) => ({
    key: `environment:${recipe.toggle!.group}`,
    label: recipe.toggle!.label ?? recipe.label,
    optionLabel: recipe.toggle!.members!.every((member) => getEnvironmentRecipe(member)?.dataset_id === recipe.dataset_id) ? "指標" : "口徑",
    options: recipe.toggle!.members!.map((member) => ({ key: member, label: getEnvironmentRecipe(member)?.toggle?.option_label ?? member })),
  }));
