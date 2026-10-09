// 崩塌與水土保持統計（縣市崩塌筆數／面積、治山防災工程總經費、水土保持災害總損失；5 recipe、4 啟用）。
// 交付 JSON 由 scripts/statistics/build_landslide_statistics_recipes.py 從 analytics 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 崩塌地處理面積（statsSlopeWorksCollapsedLandCounty）疑混入平方公尺離群值，enabled=false 不上地圖。
import catalogJson from "./landslideStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface LandslideReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}

export interface LandslideRecipe {
  layer_key: string;
  enabled: boolean;
  label: string;
  /** Statistics 群組 key（同一資料集的指標同一列切換）。 */
  group: string;
  group_label: string;
  option_label: string;
  /** 「崩塌與水土保持」下的小群組（崩塌／治山防災工程／水土保持災害）。 */
  subgroup: string;
  visual_theme: "environment";
  dataset_id: string;
  indicator_id: string;
  level: StatisticsLevel;
  boundary_version: string;
  unit: string;
  aggregation: string;
  default_release_id: string;
  release_options: LandslideReleaseOption[];
  /** display_note：金額門檻換算成億元的文字（地圖與數值仍用來源單位，不另做單位轉換）。 */
  legend: { method: "fixed_breaks"; breaks: number[]; zero_note: string | null; display_note: string | null };
  /** 只有 missing（來源當年未列該縣市）一種非數值狀態；不上數值色。 */
  status_labels: { missing?: string };
  format: { locale: string; maximumFractionDigits: number };
  pair_raw_key: null;
  derived: false;
  location_semantics: string;
  disclosure: string;
  publisher: string;
  license: string;
  source_landing_url: string;
  source_download_url: string;
  source_title: string;
}

interface LandslideRecipeDocument {
  scope: string;
  recipes: LandslideRecipe[];
}

export const LANDSLIDE_ENABLED_STATISTICS_KEYS = [
  "statsLandslideCountCounty", "statsLandslideAreaCounty",
  "statsSlopeWorksCostCounty",
  "statsSwcDisasterLossCounty",
] as const;
export type LandslideStatisticsLayerKey = typeof LANDSLIDE_ENABLED_STATISTICS_KEYS[number];

/** Layers 階層（完整目錄）的主題標題；manifest section 也用它。 */
export const LANDSLIDE_STATISTICS_THEME_TITLE = "崩塌與水土保持統計 Landslide & Soil Conservation Statistics";
/** Statistics 分頁的主題標題（STATISTICS_MACRO_GROUPS「土地與環境」）。 */
export const LANDSLIDE_STATISTICS_TAB_THEME_TITLE = "崩塌與水土保持 Landslides & Soil Conservation";
/** 小群組閱讀順序（崩塌 → 治山防災工程 → 水土保持災害）。 */
export const LANDSLIDE_STATISTICS_SUBGROUPS = ["崩塌", "治山防災工程", "水土保持災害"] as const;

const document = catalogJson as unknown as LandslideRecipeDocument;
export const LANDSLIDE_STATISTICS_SCOPE = document.scope;
export const LANDSLIDE_STATISTICS_RECIPES = document.recipes;
export const LANDSLIDE_ENABLED_STATISTICS_RECIPES = LANDSLIDE_ENABLED_STATISTICS_KEYS.map((key) => {
  const recipe = LANDSLIDE_STATISTICS_RECIPES.find((candidate) => candidate.layer_key === key);
  if (!recipe?.enabled) throw new Error(`landslide recipe ${key} missing or disabled`);
  return recipe;
});
export const LANDSLIDE_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  LANDSLIDE_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<LandslideStatisticsLayerKey, LandslideRecipe>;

export function getLandslideRecipe(key: string): LandslideRecipe | undefined {
  return LANDSLIDE_STATISTICS_RECIPES_BY_KEY[key as LandslideStatisticsLayerKey];
}

/** Intersects public releases with the delivered exact selectors (latest period first); no dimensions. */
export function landslideReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getLandslideRecipe(key);
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
export function resolveLandslideRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getLandslideRecipe(key);
  if (!recipe?.enabled || Object.keys(selectedDimensions).length > 0) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end);
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}

/** 群組：崩塌筆數／面積同一列切換；單一指標（治山工程經費、災害損失）不成群組。 */
export const LANDSLIDE_STATISTICS_TOGGLE_GROUPS = [...new Set(LANDSLIDE_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.group))]
  .map((group) => {
    const members = LANDSLIDE_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.group === group);
    return {
      key: `landslide:${group}`,
      label: members[0]!.group_label,
      optionLabel: "指標",
      options: members.map((recipe) => ({ key: recipe.layer_key, label: recipe.option_label })),
    };
  })
  .filter((group) => group.options.length > 1);
