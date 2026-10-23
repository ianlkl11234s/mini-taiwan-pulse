// atlas 批次統計（2026-10-12，22 dataset、66 recipe、2,278 exact selector）＋治安統計（G17，4 dataset、36 recipe、386 selector）＋臺北市局處統計（5 dataset、11 recipe、9,696 selector）的共用接點。
// 資料照主題拆成六個家族檔（health／fiscal／indigenousRural／sports／hazard／marine，各自 json＋catalog），
// 執行期的查詢、期別白名單、維度、圖例與目錄分組由本檔統一提供，共用檔（loader、selection、linkedSelect、
// manifest、圖例、Details）只接這一個入口，不再逐家族串接。
import type { StatisticsRelease } from "./regionalStatisticsLoader";
import type { AtlasRecipeCatalogDocument, AtlasRecipeCatalogEntry, AtlasRecipeDocument, AtlasReleaseOption, AtlasScale, AtlasStatusKind } from "./atlasStatisticsTypes";
import { HEALTH_ENABLED_STATISTICS_KEYS, HEALTH_STATISTICS_DOCUMENT } from "./healthStatisticsRecipes";
import { FISCAL_ENABLED_STATISTICS_KEYS, FISCAL_STATISTICS_DOCUMENT } from "./fiscalStatisticsRecipes";
import { INDIGENOUS_RURAL_ENABLED_STATISTICS_KEYS, INDIGENOUS_RURAL_STATISTICS_DOCUMENT } from "./indigenousRuralStatisticsRecipes";
import { SPORTS_ENABLED_STATISTICS_KEYS, SPORTS_STATISTICS_DOCUMENT } from "./sportsStatisticsRecipes";
import { HAZARD_ENABLED_STATISTICS_KEYS, HAZARD_STATISTICS_DOCUMENT } from "./hazardStatisticsRecipes";
import { MARINE_ENABLED_STATISTICS_KEYS, MARINE_STATISTICS_DOCUMENT } from "./marineStatisticsRecipes";
import { CRIME_ENABLED_STATISTICS_KEYS, CRIME_STATISTICS_DOCUMENT } from "./crimeStatisticsRecipes";
import { TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS, TAIPEI_AGENCY_STATISTICS_DOCUMENT } from "./taipeiAgencyStatisticsRecipes";
import { taipeiAgencyRecipeDetailsDocument } from "./statisticsRecipeDetails";

export type { AtlasRecipe, AtlasRecipeCatalogEntry, AtlasScale, AtlasStatusKind } from "./atlasStatisticsTypes";

const FAMILIES: ReadonlyArray<readonly [readonly string[], AtlasRecipeDocument | AtlasRecipeCatalogDocument]> = [
  [HEALTH_ENABLED_STATISTICS_KEYS, HEALTH_STATISTICS_DOCUMENT],
  [FISCAL_ENABLED_STATISTICS_KEYS, FISCAL_STATISTICS_DOCUMENT],
  [INDIGENOUS_RURAL_ENABLED_STATISTICS_KEYS, INDIGENOUS_RURAL_STATISTICS_DOCUMENT],
  [SPORTS_ENABLED_STATISTICS_KEYS, SPORTS_STATISTICS_DOCUMENT],
  [HAZARD_ENABLED_STATISTICS_KEYS, HAZARD_STATISTICS_DOCUMENT],
  [MARINE_ENABLED_STATISTICS_KEYS, MARINE_STATISTICS_DOCUMENT],
  [CRIME_ENABLED_STATISTICS_KEYS, CRIME_STATISTICS_DOCUMENT],
  [TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS, TAIPEI_AGENCY_STATISTICS_DOCUMENT],
];

export const ATLAS_ENABLED_STATISTICS_KEYS = [
  ...HEALTH_ENABLED_STATISTICS_KEYS, ...FISCAL_ENABLED_STATISTICS_KEYS, ...INDIGENOUS_RURAL_ENABLED_STATISTICS_KEYS,
  ...SPORTS_ENABLED_STATISTICS_KEYS, ...HAZARD_ENABLED_STATISTICS_KEYS, ...MARINE_ENABLED_STATISTICS_KEYS,
  ...CRIME_ENABLED_STATISTICS_KEYS, ...TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS,
] as const;
export type AtlasStatisticsLayerKey = typeof ATLAS_ENABLED_STATISTICS_KEYS[number];

/** Statistics 分頁新增的主題（其餘群組併入既有「醫療與長照」「人口與教育」「農林漁牧」）。 */
export const ATLAS_TAB_THEME_TITLES = {
  fiscal: "財稅與消費 Fiscal & Consumption",
  sports: "體育運動 Sports",
  hazard: "災害風險 Disaster Risk",
  marine: "海洋 Marine",
  crime: "犯罪與治安 Crime & Safety",
} as const;

/** 依各家族宣告的 key 順序（群組內原始數在前）；交付缺 key 或未啟用即報錯。 */
export const ATLAS_ENABLED_STATISTICS_RECIPES: AtlasRecipeCatalogEntry[] = FAMILIES.flatMap(([keys, document]) => keys.map((key) => {
  const recipe: AtlasRecipeCatalogEntry | undefined = document.recipes.find((candidate) => candidate.layer_key === key);
  if (!recipe?.enabled) throw new Error(`atlas recipe ${key} missing or disabled`);
  return recipe;
}));
const BY_KEY = new Map(ATLAS_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]));

/** 首屏目錄 recipe；按需載入的家族（臺北市局處統計）沒有 release_options，要讀期別用 atlasRecipeReleaseOptions。 */
export function getAtlasRecipe(key: string): AtlasRecipeCatalogEntry | undefined {
  return BY_KEY.get(key);
}

let lazyIndex: { document: AtlasRecipeDocument; byKey: Map<string, AtlasReleaseOption[]> } | undefined;

/**
 * Exact release selector 清單。目錄自帶的家族直接回傳；臺北市局處統計從按需載入的明細取，
 * 明細未載入時丟 STATISTICS_RECIPE_DETAILS_NOT_LOADED（呼叫端先 ensureStatisticsRecipeDetails("taipeiAgency")），
 * 不回空陣列冒充「沒有期別」。
 */
export function atlasRecipeReleaseOptions(recipe: AtlasRecipeCatalogEntry): AtlasReleaseOption[] {
  if (recipe.release_options) return recipe.release_options;
  const document = taipeiAgencyRecipeDetailsDocument();
  if (lazyIndex?.document !== document) lazyIndex = { document, byKey: new Map(document.recipes.map((candidate) => [candidate.layer_key, candidate.release_options])) };
  const options = lazyIndex.byKey.get(recipe.layer_key);
  if (!options) throw new Error(`atlas recipe ${recipe.layer_key} missing from recipe details`);
  return options;
}

/** 預設維度組合（layer-plan 指定，例如癌症 sex=all、site=all_sites）；無維度為空 tuple。 */
export function atlasDefaultDimensions(recipe: AtlasRecipeCatalogEntry): Record<string, string> {
  return Object.fromEntries(recipe.dimensions.map((dimension) => [dimension.key, dimension.default]));
}

function tupleKey(recipe: AtlasRecipeCatalogEntry, dimensions: Record<string, unknown> | undefined): string {
  return recipe.dimensions.map((dimension) => String(dimensions?.[dimension.key] ?? dimension.default)).join("|");
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

/** 期別內排序：預設組合在前，其餘依各維度選項順序。 */
function dimensionRank(recipe: AtlasRecipeCatalogEntry, dimensions: Record<string, string>): number[] {
  return recipe.dimensions.map((dimension) => dimension.options.findIndex((option) => option.value === dimensions[dimension.key]));
}

function compareRank(a: number[], b: number[]): number {
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index]! - b[index]!;
  return 0;
}

/**
 * Intersects public releases with the delivered exact tuples. Latest period first; within a period the
 * default dimensions come first, so the loader's first option is always the layer-plan default.
 */
export function atlasReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getAtlasRecipe(key);
  if (!recipe?.enabled) return [];
  const published = new Map(releases.map((release) => [release.release_id, release]));
  return atlasRecipeReleaseOptions(recipe)
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
      || compareRank(dimensionRank(recipe, a.dimensions), dimensionRank(recipe, b.dimensions)))
    .map((option) => ({ releaseId: option.release_id, dimensions: option.dimensions }));
}

/**
 * 預設期別：recipe 的 default_release_id 有公開就用它（治安：最新全年 2025，而不是排第一的 2026 年 1–6 月部分期別）；
 * 否則取最新期別。既有 atlas 家族 default 恰為最新期別，行為不變。
 */
export function atlasDefaultReleaseOption<T extends { releaseId: string }>(key: string, options: readonly T[]): T | undefined {
  const preferred = getAtlasRecipe(key)?.default_release_id;
  return (preferred ? options.find((option) => option.releaseId === preferred) : undefined) ?? options[0];
}

// 按需載入的家族（臺北市局處統計，全為整月期別）不帶 release_options，也沒有部分期別。
const PARTIAL_PERIODS = new Map(ATLAS_ENABLED_STATISTICS_RECIPES.flatMap((recipe) => recipe.release_options ?? [])
  .filter((option) => option.partial_period_label).map((option) => [option.release_id, option]));

/**
 * 部分期別（非全年，例如治安 2026 年 1–6 月、2018 年 10–12 月）：依 release_id（全站唯一）回年與起訖月，
 * 期間也須相符；全年或非 atlas 回 undefined。
 */
export function atlasPartialPeriod(release: { release_id?: unknown; period_start: string; period_end: string }): { year: string; from: string; to: string } | undefined {
  const option = typeof release.release_id === "string" ? PARTIAL_PERIODS.get(release.release_id) : undefined;
  if (!option || option.period_start !== release.period_start || option.period_end !== release.period_end) return undefined;
  return { year: option.period_start.slice(0, 4), from: String(Number(option.period_start.slice(5, 7))), to: String(Number(option.period_end.slice(5, 7))) };
}

/**
 * 群組切換（medicalStatisticsSelection）用的視圖：dimensions 為預設組合，release_options 依「新期別、預設組合在前」排序，
 * 讓從無維度指標（例如癌症新發生數）切到有維度指標時落在 layer-plan 預設組合，而不是交付順序的第一筆。
 */
export function atlasSelectionRecipe(key: string) {
  const recipe = getAtlasRecipe(key);
  if (!recipe) return undefined;
  const isDefault = (option: { release_id: string }) => (option.release_id === recipe.default_release_id ? 0 : 1);
  const release_options = [...atlasRecipeReleaseOptions(recipe)].sort((a, b) => isDefault(a) - isDefault(b)
    || b.period_end.localeCompare(a.period_end)
    || b.period_start.localeCompare(a.period_start)
    || compareRank(dimensionRank(recipe, a.dimensions), dimensionRank(recipe, b.dimensions)));
  return { dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, level: recipe.level, label: recipe.label, dimensions: atlasDefaultDimensions(recipe), release_options };
}

/** Refuses partial dimension selections and opaque-id guesses. */
export function resolveAtlasRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getAtlasRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = atlasRecipeReleaseOptions(recipe).filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}

/**
 * 目前維度組合的固定門檻與方向：預設組合用 recipe 門檻；癌別、疾病別、病床別、行業、疫苗等量級差很大的組合
 * 各有一組固定門檻（交付時依最新一年分布算一次，不隨期別重算）。
 */
export function atlasRenderScale(key: string, dimensions?: Record<string, unknown>): AtlasScale | undefined {
  const recipe = getAtlasRecipe(key);
  if (!recipe) return undefined;
  const scoped = recipe.dimensions.length ? recipe.legend.by_dimension?.[tupleKey(recipe, dimensions)] : undefined;
  return scoped ?? { breaks: recipe.legend.breaks, direction: recipe.legend.direction };
}

/** 目前維度組合的附註（社會脆弱度子指標的所屬構面與方向依據）。 */
export function atlasDimensionNote(key: string, dimensions?: Record<string, unknown>): string | undefined {
  const recipe = getAtlasRecipe(key);
  if (!recipe?.legend.dimension_notes) return undefined;
  return recipe.legend.dimension_notes[tupleKey(recipe, dimensions)];
}

/** 色階說明：社會脆弱度依方向改寫，子指標依目前選擇的方向；其餘回 undefined 用通用說明。 */
export function atlasScaleNote(key: string, dimensions?: Record<string, unknown>): string | undefined {
  const recipe = getAtlasRecipe(key);
  if (!recipe?.legend.scale_note) return undefined;
  if (!recipe.legend.dimension_notes) return recipe.legend.scale_note;
  const direction = atlasRenderScale(key, dimensions)?.direction;
  return direction === "descending"
    ? "色階反轉：深＝較脆弱（本子指標值越高越不脆弱）；Z 分數，0 為 22 縣市平均"
    : "淺 → 深：較不脆弱 → 較脆弱（本子指標值越高越脆弱）；Z 分數，0 為 22 縣市平均";
}

/** 圖例的非數值狀態列：依本層實際會出現的狀態分開列出；遮蔽用交叉斜線，其餘用細斜線。 */
export function atlasStatusLegendRows(recipe: AtlasRecipeCatalogEntry): Array<{ kind: AtlasStatusKind; hatch: "missing" | "suppressed"; label: string }> {
  return (["not_applicable", "missing", "suppressed"] as const)
    .filter((kind) => recipe.status_labels[kind])
    .map((kind) => ({ kind, hatch: kind === "suppressed" ? "suppressed" : "missing", label: recipe.status_labels[kind]! }));
}

const DIMENSION_LABELS = new Map<string, string>();
const DIMENSION_VALUE_LABELS = new Map<string, string>();
for (const recipe of ATLAS_ENABLED_STATISTICS_RECIPES) {
  for (const dimension of recipe.dimensions) {
    DIMENSION_LABELS.set(dimension.key, dimension.label);
    for (const option of dimension.options) DIMENSION_VALUE_LABELS.set(`${recipe.dataset_id}\u0000${dimension.key}\u0000${option.value}`, option.label);
  }
}

export function atlasDimensionLabel(key: string): string | undefined {
  return DIMENSION_LABELS.get(key);
}

/** 維度值標籤以 dataset 為範圍（同名鍵 sex 在不同 dataset 不共用標籤表）。 */
export function atlasDimensionValueLabel(datasetId: string, key: string, value: string): string | undefined {
  return DIMENSION_VALUE_LABELS.get(`${datasetId}\u0000${key}\u0000${value}`);
}

/** 群組（同一概念一列）：原始數／比例、縣市／鄉鎮、同表指標在同一列切換；單一指標不成群組。 */
export const ATLAS_STATISTICS_TOGGLE_GROUPS = [...new Set(ATLAS_ENABLED_STATISTICS_RECIPES.map((recipe) => `${recipe.family}:${recipe.group}`))]
  .map((key) => {
    const members = ATLAS_ENABLED_STATISTICS_RECIPES.filter((recipe) => `${recipe.family}:${recipe.group}` === key);
    const levels = new Set(members.map((recipe) => recipe.level));
    const sameDataset = members.every((recipe) => recipe.dataset_id === members[0]!.dataset_id);
    return {
      key: `atlas:${key}`,
      label: members[0]!.group_label,
      optionLabel: levels.size > 1 ? "地理層級／口徑" : sameDataset && !members.some((recipe) => recipe.derived) ? "指標" : "口徑",
      options: members.map((recipe) => ({ key: recipe.layer_key, label: recipe.option_label })),
    };
  })
  .filter((group) => group.options.length > 1);

function groupsBy(select: (recipe: AtlasRecipeCatalogEntry) => boolean, groupOf: (recipe: AtlasRecipeCatalogEntry) => string = (recipe) => recipe.subgroup): Array<{ title: string; keys: string[] }> {
  const recipes = ATLAS_ENABLED_STATISTICS_RECIPES.filter(select);
  return [...new Set(recipes.map(groupOf))]
    .map((title) => ({ title, keys: recipes.filter((recipe) => groupOf(recipe) === title).map((recipe) => recipe.layer_key) }));
}

/** Layers 完整目錄（STATISTICS_DATA_THEMES）的主題，依家族順序。 */
export const ATLAS_DATA_THEME_TITLES = [...new Set(ATLAS_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.data_theme))];

export function atlasDataThemeGroups(theme: string) {
  return groupsBy((recipe) => recipe.data_theme === theme);
}

/** Statistics 分頁主題下的群組（含併入既有主題的群組）。 */
export function atlasTabThemeGroups(theme: string) {
  return groupsBy((recipe) => recipe.tab_theme === theme, (recipe) => recipe.tab_group ?? recipe.subgroup);
}
