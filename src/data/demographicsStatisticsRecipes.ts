// 人口統計（內政部戶政司 RIS：P0–P6；縣市＋鄉鎮，P0/P2/P5 另有村里 115 年 8 月一期）。
// 交付 JSON 由 scripts/statistics/build_demographics_statistics_recipes.py 從 analytics handoff
// 只收 enabled recipes（各 dataset 的村里 HOLD 不收；村里層來自 village-statistics handoff）；首屏只帶去掉交付收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 加入 P3–P6：builder 加 handoff → 重產 catalog → 下方 KEYS 補 key → 群組規格補一列（未列的指標自動一指標一群組）。
import catalogJson from "./demographicsStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";
import { humanizeStatisticsText } from "./statisticsLabels";

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
  // P3 人口動態（年度＋年初累計 YTD）
  "statsDemographicsCountyBirths", "statsDemographicsCountyDeaths", "statsDemographicsCountyNaturalIncrease",
  "statsDemographicsCountyMarriages", "statsDemographicsCountyDivorces", "statsDemographicsCountyCrudeBirthRate",
  "statsDemographicsCountyCrudeDeathRate", "statsDemographicsCountyNaturalIncreaseRate", "statsDemographicsCountyCrudeMarriageRate",
  "statsDemographicsCountyCrudeDivorceRate", "statsDemographicsCountyBirthsYtd", "statsDemographicsCountyDeathsYtd",
  "statsDemographicsCountyNaturalIncreaseYtd", "statsDemographicsCountyMarriagesYtd", "statsDemographicsCountyDivorcesYtd",
  "statsDemographicsTownshipBirths", "statsDemographicsTownshipDeaths", "statsDemographicsTownshipNaturalIncrease",
  "statsDemographicsTownshipMarriages", "statsDemographicsTownshipDivorces", "statsDemographicsTownshipCrudeBirthRate",
  "statsDemographicsTownshipCrudeDeathRate", "statsDemographicsTownshipNaturalIncreaseRate", "statsDemographicsTownshipCrudeMarriageRate",
  "statsDemographicsTownshipCrudeDivorceRate", "statsDemographicsTownshipBirthsYtd", "statsDemographicsTownshipDeathsYtd",
  "statsDemographicsTownshipNaturalIncreaseYtd", "statsDemographicsTownshipMarriagesYtd", "statsDemographicsTownshipDivorcesYtd",
  // P4 遷徙
  "statsDemographicsCountyInMigration", "statsDemographicsCountyOutMigration", "statsDemographicsCountyNetMigration",
  "statsDemographicsCountyNetMigrationRate", "statsDemographicsCountyInMigrationYtd", "statsDemographicsCountyOutMigrationYtd",
  "statsDemographicsCountyNetMigrationYtd", "statsDemographicsTownshipInMigration", "statsDemographicsTownshipOutMigration",
  "statsDemographicsTownshipNetMigration", "statsDemographicsTownshipNetMigrationRate", "statsDemographicsTownshipInMigrationYtd",
  "statsDemographicsTownshipOutMigrationYtd", "statsDemographicsTownshipNetMigrationYtd",
  // P5 原住民
  "statsDemographicsCountyIndigenousPopulation", "statsDemographicsCountyIndigenousPlainPopulation", "statsDemographicsCountyIndigenousMountainPopulation",
  "statsDemographicsCountyIndigenousShare", "statsDemographicsTownshipIndigenousPopulation", "statsDemographicsTownshipIndigenousPlainPopulation",
  "statsDemographicsTownshipIndigenousMountainPopulation", "statsDemographicsTownshipIndigenousShare",
  // P6 已設戶籍外來人口＋歸化
  "statsDemographicsCountyForeignOriginPopulation", "statsDemographicsCountyForeignOriginMainlandPopulation", "statsDemographicsCountyForeignOriginForeignNationalPopulation",
  "statsDemographicsCountyForeignOriginHkMacauPopulation", "statsDemographicsCountyForeignOriginNoHouseholdNationalPopulation", "statsDemographicsCountyForeignOriginShare",
  "statsDemographicsTownshipForeignOriginPopulation", "statsDemographicsTownshipForeignOriginMainlandPopulation", "statsDemographicsTownshipForeignOriginForeignNationalPopulation",
  "statsDemographicsTownshipForeignOriginHkMacauPopulation", "statsDemographicsTownshipForeignOriginNoHouseholdNationalPopulation", "statsDemographicsTownshipForeignOriginShare",
  "statsDemographicsCountyNaturalizationCount",
  // 村里（只有 11508 一期 × VILLAGE_NLSC_1150817）：戶籍人口 4、年齡結構 12、原住民 4
  "statsDemographicsVillagePopulationTotal", "statsDemographicsVillageHouseholdCount", "statsDemographicsVillageHouseholdSize", "statsDemographicsVillagePopulationDensity",
  "statsDemographicsVillagePopAge0To14", "statsDemographicsVillagePopAge15To64", "statsDemographicsVillagePopAge65Plus",
  "statsDemographicsVillageShareAge0To14", "statsDemographicsVillageShareAge15To64", "statsDemographicsVillageShareAge65Plus",
  "statsDemographicsVillageAgingIndex", "statsDemographicsVillageDependencyRatio", "statsDemographicsVillageChildDependencyRatio",
  "statsDemographicsVillageOldDependencyRatio", "statsDemographicsVillageSexRatio", "statsDemographicsVillageMedianAge",
  "statsDemographicsVillageIndigenousPopulation", "statsDemographicsVillageIndigenousPlainPopulation", "statsDemographicsVillageIndigenousMountainPopulation",
  "statsDemographicsVillageIndigenousShare",
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

const DIVERGING_NOTE = "可正可負：棕色為負、紫色為正，以 0 為分界；顏色不代表好壞。";
const MIGRATION_GROSS_NOTE = "毛遷入／遷出隨層級定義不同：縣市層只計跨越本縣市界線的遷入／遷出（不含縣市內跨鄉鎮移動），鄉鎮層只計跨越本鄉鎮界線者，所以縣市遷入 ≠ 所屬鄉鎮遷入加總；淨遷徙兩層一致。";

/** 依 indicator_id 的使用者說明（不綁 layer key，新指標不會誤繼承）。年初累計（*_ytd）沿用年度指標的說明。 */
const INDICATOR_NOTES: Record<string, string> = {
  population_density: "人口密度的面積為參考邊界在 EPSG:3826 的平面面積，不是內政部公告土地面積；縣市合計比公告面積約多 1.8%，密度因此略低於公告值。",
  household_size: "戶量＝戶籍人口數 ÷ 戶數（平均每戶人口），於本層級加總後計算，不平均子區比率。",
  median_age: "年齡中位數為本專案依單一年齡人口內插自算，非內政部公告值。",
  natural_increase: `自然增加＝出生−死亡，${DIVERGING_NOTE}`,
  natural_increase_rate: `自然增加率＝（出生−死亡）÷ 年中人口 × 1000，${DIVERGING_NOTE}`,
  in_migration: MIGRATION_GROSS_NOTE,
  out_migration: MIGRATION_GROSS_NOTE,
  net_migration: `淨遷徙（社會增加）＝遷入−遷出，${DIVERGING_NOTE}2025 年「遷往國外」登記大增，部分縣市負值含遷出國外，不宜解讀為單純國內移出。`,
  net_migration_rate: `社會增加率＝淨遷徙 ÷ 年中人口 × 1000（2019 年起；2018 缺前一年底人口不發率），${DIVERGING_NOTE}`,
  naturalization_count: "歸化國籍人數是年度流量（不是存量），只有縣市層；110、111、113 年來源「其他」列未分配縣市，標 PARTIAL。",
};

/** 依 dataset 的共同說明。 */
const DATASET_NOTES: Record<string, string> = {
  population_vital_events: "按戶政「登記日期」統計（非發生日期）。2022 年含 1 個月（3 月）來自 data.gov.tw 131138 靜態 CSV 出口（與 API 同源報表）。",
  population_migration: "戶籍登記遷徙（非實際居住移動），不含行政區域調整。",
  indigenous_population: "原住民＝平地＋山地（平埔族群另計、不含）；「山地／平地」是身分別，不是居住地；113、114 年底年增明顯偏高，跨年比較請留意。",
  foreign_origin_population: "只含已在臺灣設立戶籍者；不是移工、不是外僑居留人數，也不等於新住民人數。",
};

/** 村里層只發布界線代碼與資料期別完全一致的一期（RIS 11508 × VILLAGE_NLSC_1150817）。 */
export const DEMOGRAPHICS_VILLAGE_NOTE = "村里層僅提供 115 年 8 月一期（界線版本須與資料期別一致）；其他期別的村里代碼與任何可取得的村里界都對不齊，不發布。";

/** 村里界線來源（資料來源總覽／說明・來源）。 */
export const DEMOGRAPHICS_VILLAGE_BOUNDARY_SOURCE = "村里界線：內政部國土測繪中心村里界 115 年 8 月 17 日版（data.gov.tw 7438，政府資料開放授權條款第 1 版），排除 206 個未編定村里並補入瑪家鄉三和村，共 7,781 村里，代碼與 RIS 11508 完全一致；多邊形未另以獨立來源驗證。";

type NoteSource = Pick<DemographicsRecipe, "indicator_id"> & Partial<Pick<DemographicsRecipe, "dataset_id" | "release_options" | "level">>;

/** 年初累計期別（dimensions 帶 month_range），例如「115 年 1–8 月累計」。 */
export function demographicsYtdLabel(recipe: Partial<Pick<DemographicsRecipe, "release_options">>): string | undefined {
  const dims = recipe.release_options?.find((option) => option.dimensions.month_range)?.dimensions;
  const range = dims?.month_range?.match(/^(\d{2})-(\d{2})$/);
  if (!dims || !range) return undefined;
  return `${dims.roc_year} 年 ${Number(range[1])}–${Number(range[2])} 月累計`;
}

export function demographicsIndicatorNote(recipe: NoteSource): string | undefined {
  const ytd = demographicsYtdLabel(recipe);
  const notes = [
    INDICATOR_NOTES[recipe.indicator_id.replace(/_ytd$/, "")],
    recipe.dataset_id ? DATASET_NOTES[recipe.dataset_id] : undefined,
    ytd ? `年初累計（${ytd}），不是全年，不可與年度值比較或加總。` : undefined,
    recipe.level === "village" ? DEMOGRAPHICS_VILLAGE_NOTE : undefined,
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : undefined;
}

/** 顯示名稱：年初累計改標「…（115 年 1–8 月累計）」，不用「YTD」縮寫。 */
export function demographicsDisplayLabel(recipe: Pick<DemographicsRecipe, "label"> & Partial<Pick<DemographicsRecipe, "release_options">>): string {
  const ytd = demographicsYtdLabel(recipe);
  return ytd ? `${recipe.label.replace(/（年初累計 YTD）$/, "")}（${ytd}）` : recipe.label;
}

/** 期別文字：年初累計標「115 年 1–8 月累計」，其餘交給共用 statisticsPeriodLabel。 */
export function demographicsPeriodLabel(key: string, release: Pick<StatisticsRelease, "release_id">): string | undefined {
  const recipe = getDemographicsRecipe(key);
  const option = recipe?.release_options.find((item) => item.release_id === release.release_id);
  return option?.dimensions.month_range ? demographicsYtdLabel({ release_options: [option] }) : undefined;
}

/**
 * 交付 disclosure 以 Markdown 粗體強調（例：**不是移工**）；UI 是純文字，去掉標記、保留字句。
 * 村里 disclosure 夾帶邊界代碼（VILLAGE_NLSC_1150817），一律換成中文描述（spec §6.3 不印內部識別碼）。
 */
export function demographicsDisclosure(recipe: Pick<DemographicsRecipe, "disclosure">): string {
  return humanizeStatisticsText(recipe.disclosure.replace(/\*\*/g, ""));
}

/** 來源卡授權措辭：RIS API 授權欄位尚未以 data.gov.tw 資料集頁確認，不得寫成 OGDL。 */
export const DEMOGRAPHICS_SOURCE_LABEL = "內政部戶政司 RIS（授權條款待確認）";

/** 各 dataset 的來源卡（P6 已以 data.gov.tw 資料集頁確認 OGDL v1；其餘 RIS 待確認）。 */
export function demographicsSource(recipe: Pick<DemographicsRecipe, "dataset_id" | "indicator_id">): { provider: string; license: string; sourceUrl: string } {
  if (recipe.dataset_id === "foreign_origin_population") {
    const id = recipe.indicator_id === "naturalization_count" ? "62563" : "127528";
    return { provider: `內政部戶政司（data.gov.tw ${id}）`, license: `政府資料開放授權條款第 1 版（依 data.gov.tw ${id} 資料集頁標示）`, sourceUrl: `https://data.gov.tw/dataset/${id}` };
  }
  return { provider: DEMOGRAPHICS_SOURCE_LABEL, license: "授權條款待確認（RIS API 授權欄位尚未以 data.gov.tw 資料集頁確認；不標示為政府資料開放授權條款）", sourceUrl: "https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1" };
}

const LEVEL_LABELS: Partial<Record<StatisticsLevel, string>> = { county: "縣市", township: "鄉鎮市區", village: "村里" };

/** 村里層只有一期時的期別文字（例：「115 年 8 月」）；多期或非村里回 undefined。 */
export function demographicsVillageOnlyPeriod(recipe: Pick<DemographicsRecipe, "level" | "release_options">): string | undefined {
  if (recipe.level !== "village" || recipe.release_options.length !== 1) return undefined;
  const { roc_year: year, month } = recipe.release_options[0]!.dimensions as Record<string, string | undefined>;
  return year && month ? `${year} 年 ${Number(month)} 月` : year ? `${year} 年` : undefined;
}

/** 選單中的地理層級文字；村里只有一期時直接標出期別（guidelines §3：不靜默跳年份）。 */
export function demographicsLevelOptionLabel(recipe: Pick<DemographicsRecipe, "level" | "release_options">): string {
  const base = LEVEL_LABELS[recipe.level] ?? recipe.level;
  const only = demographicsVillageOnlyPeriod(recipe);
  return only ? `${base}（僅 ${only}）` : base;
}

/**
 * Statistics 群組：一列＝一個概念；選單在同一群組內切換指標與縣市／鄉鎮／村里（同期別保留；村里只有 11508，
 * 從其他期別切入村里時落到 11508，見 medicalStatisticsSelection.ts）。
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
  // P3 人口動態：年度與年初累計分開成列（不同期別不可在同一列互換、不可比較）
  { key: "birthsDeaths", label: "出生與死亡", indicators: ["births", "deaths", "crude_birth_rate", "crude_death_rate"] },
  { key: "naturalIncrease", label: "自然增加", indicators: ["natural_increase", "natural_increase_rate"] },
  { key: "marriagesDivorces", label: "結婚與離婚", indicators: ["marriages", "divorces", "crude_marriage_rate", "crude_divorce_rate"] },
  { key: "vitalEventsYtd", label: "人口動態年初累計", indicators: ["births_ytd", "deaths_ytd", "natural_increase_ytd", "marriages_ytd", "divorces_ytd"] },
  // P4 遷徙
  { key: "grossMigration", label: "遷入與遷出", indicators: ["in_migration", "out_migration"] },
  { key: "netMigration", label: "淨遷徙（社會增加）", indicators: ["net_migration", "net_migration_rate"] },
  { key: "migrationYtd", label: "遷徙年初累計", indicators: ["in_migration_ytd", "out_migration_ytd", "net_migration_ytd"] },
  // P5 原住民
  { key: "indigenousPopulation", label: "原住民人口數", indicators: ["indigenous_population", "indigenous_plain_population", "indigenous_mountain_population"] },
  { key: "indigenousShare", label: "原住民人口占比", indicators: ["indigenous_share"] },
  // P6 已設戶籍外來人口／歸化
  { key: "foreignOriginPopulation", label: "已設戶籍外來人口數", indicators: ["foreign_origin_population", "foreign_origin_mainland_population", "foreign_origin_foreign_national_population", "foreign_origin_hk_macau_population", "foreign_origin_no_household_national_population"] },
  { key: "foreignOriginShare", label: "已設戶籍外來人口占比", indicators: ["foreign_origin_share"] },
  { key: "naturalization", label: "歸化國籍人數", indicators: ["naturalization_count"] },
];

const LEVEL_ORDER: StatisticsLevel[] = ["county", "township", "village"];

function groupSpecs() {
  const covered = new Set(GROUP_SPECS.flatMap((spec) => spec.indicators));
  const extra: Array<{ key: string; label: string; indicators: readonly string[] }> = [];
  for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
    if (covered.has(recipe.indicator_id)) continue;
    covered.add(recipe.indicator_id);
    extra.push({ key: recipe.indicator_id, label: demographicsDisplayLabel(recipe), indicators: [recipe.indicator_id] });
  }
  return [...GROUP_SPECS, ...extra];
}

/** Toggle groups consumed by medicalStatisticsGroups.ts（縣市→鄉鎮→村里；群組內同期別切換）。 */
export const DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS = groupSpecs()
  .map((spec) => {
    const members = DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES
      .filter((recipe) => spec.indicators.includes(recipe.indicator_id))
      .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
        || spec.indicators.indexOf(a.indicator_id) - spec.indicators.indexOf(b.indicator_id));
    const single = spec.indicators.length === 1;
    const levels = new Set(members.map((recipe) => recipe.level));
    return {
      key: `demographics:${spec.key}`,
      label: spec.label,
      optionLabel: single ? "地理層級" : levels.size > 1 ? "指標／地理層級" : "指標",
      options: members.map((recipe) => ({
        key: recipe.layer_key,
        label: single ? demographicsLevelOptionLabel(recipe)
          : levels.size > 1 ? `${demographicsLevelOptionLabel(recipe)}：${demographicsDisplayLabel(recipe)}` : demographicsDisplayLabel(recipe),
      })),
    };
  })
  .filter((group) => group.options.length > 0);

const TAB_GROUP_TITLES: Record<string, string> = {
  戶籍人口: "戶籍人口", 年齡結構: "年齡結構", 人口動態: "人口動態", 人口遷徙: "遷徙",
  原住民人口: "原住民", 已設戶籍外來人口: "外來人口", 歸化國籍: "外來人口",
};
/** Statistics 分頁的小群組標題：recipe subgroup 去掉層級括號與「・年初累計」後對照（戶籍人口→…→外來人口）。 */
export function demographicsTabGroupTitle(recipe: Pick<DemographicsRecipe, "subgroup">): string {
  const base = recipe.subgroup.replace(/・年初累計$/, "").replace(/（[^）]*）/g, "");
  return TAB_GROUP_TITLES[base] ?? base;
}
