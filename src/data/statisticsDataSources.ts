import { getAgriRecipe } from "./agriStatisticsRecipes";
import { getComparisonRecipe, STATISTICS_COMPARISONS_UI_ENABLED } from "./comparisonStatisticsRecipes";
import { isStatisticsLayer, STATISTICS_RECIPES, statisticsBaseKey } from "./regionalStatisticsRecipes";
import { getSocialRecipe } from "./socialStatisticsRecipes";
import { getLaborRecipe, getLaborStatisticsPresentationView, laborLocationSemantics } from "./laborStatisticsRecipes";
import { getEnvironmentRecipe } from "./environmentStatisticsRecipes";
import { getAddictionRecipe } from "./addictionStatisticsRecipes";
import { DEMOGRAPHICS_VILLAGE_BOUNDARY_SOURCE, demographicsDisclosure, demographicsDisplayLabel, demographicsIndicatorNote, demographicsSource, demographicsYtdLabel, getDemographicsRecipe } from "./demographicsStatisticsRecipes";
import { getEducationPresentationView } from "./statisticsPresentationViews";

export type StatisticsSourceKind = "source" | "derived" | "presentation";

export interface StatisticsDataSourceDefinition {
  kind: StatisticsSourceKind;
  datasetIds: readonly string[];
  label: string;
  metricLabel: string;
  unit: string;
  level: string;
  period: string;
  contract: string;
  disclosure?: string;
  sourceUrl?: string;
  provider?: string;
  license?: string;
}

function periodLabel(options: readonly { period_start: string; period_end: string }[]): string {
  return summaryPeriodLabel(options.length, options[0]);
}

/** Catalog summaries (agri/social) carry the count and the only option when count is 1. */
function summaryPeriodLabel(count: number, only: { period_start: string; period_end: string } | null | undefined): string {
  if (count === 0) return "未標示期別";
  if (count === 1 && only) return `${only.period_start} 至 ${only.period_end}`;
  return `${count} 個既有公開期別`;
}

/**
 * Local statistics recipes remain the source of truth when the catalog RPC has
 * not been published. This is deliberately a compact source contract, not a
 * replacement catalog record.
 */
export function getStatisticsDataSourceDefinition(key: string): StatisticsDataSourceDefinition | undefined {
  const view = getEducationPresentationView(key);
  if (view) {
    const baseKey = statisticsBaseKey(view.key);
    const recipe = getSocialRecipe(baseKey);
    if (!recipe) return undefined;
    const stage = recipe.release_summary.education_stages?.[view.stage];
    return {
      kind: "presentation",
      datasetIds: [recipe.dataset_id],
      label: "固定學制統計入口",
      metricLabel: view.label,
      unit: recipe.unit,
      level: recipe.level,
      period: summaryPeriodLabel(stage?.count ?? 0, stage?.latest),
      contract: `固定 ${view.stage} 學制；此卡顯示入口預設指標來源，其他可選指標可各自查閱；不新增來源資料集。`,
      disclosure: recipe.disclosure,
    };
  }

  const comparison = getComparisonRecipe(key);
  if (comparison) {
    return {
      kind: "derived",
      datasetIds: [comparison.dataset_id],
      label: "派生比較統計",
      metricLabel: comparison.label,
      unit: comparison.unit,
      level: comparison.level,
      period: periodLabel(comparison.release_options),
      contract: `版本化統計快照；只接受 ${comparison.release_options.length} 個已登錄選項。`,
      disclosure: comparison.disclosure,
    };
  }

  const social = getSocialRecipe(key);
  if (social) {
    return {
      kind: "source",
      datasetIds: [social.dataset_id],
      label: "原始統計快照",
      metricLabel: social.label,
      unit: social.unit,
      level: social.level,
      period: summaryPeriodLabel(social.release_summary.count, social.release_summary.first),
      contract: `來源家族：${social.source_family ?? "未標示"}；只接受 ${social.release_summary.count} 個既有公開 exact release selector。`,
      disclosure: social.disclosure,
    };
  }

  const labor = getLaborRecipe(key);
  if (labor) {
    const presentation = getLaborStatisticsPresentationView(key);
    const derivedDisclosure = presentation
      ? "可切換原始非勞動力人數與衍生非勞動力率；非勞動力率＝100%－同一期勞動力參與率，分母為 15 歲以上民間人口。"
      : "";
    return {
      kind: presentation ? "presentation" : "source",
      datasetIds: [labor.dataset_id],
      label: "原始勞動與所得統計快照",
      metricLabel: labor.label,
      unit: labor.unit,
      level: labor.level,
      period: periodLabel(labor.release_options),
      contract: `只接受已驗證 exact release selector；資料期與顯示邊界版本分開揭露。${presentation ? " 衍生比例沿用已登錄的 participation_rate selector，不新增來源 release。" : ""}`,
      disclosure: `${laborLocationSemantics(labor)} ${derivedDisclosure} ${labor.disclosure}`.trim(),
    };
  }

  const environment = getEnvironmentRecipe(key);
  if (environment) {
    const periods = [...new Map(environment.release_options.map(option => [option.release_id, option])).values()];
    const raw = environment.pair_raw_key ? getEnvironmentRecipe(environment.pair_raw_key) : undefined;
    return {
      kind: environment.derived ? "derived" : "source",
      datasetIds: [environment.dataset_id],
      label: environment.derived ? "衍生環境統計比例" : "原始環境統計快照",
      metricLabel: environment.label,
      unit: environment.unit,
      level: environment.level,
      period: periodLabel(periods),
      contract: `只接受 ${periods.length} 個已公開期別、${environment.release_options.length} 個 exact release selector${environment.dimension ? `（含 ${environment.dimension.options.length} 個細項）` : ""}；${raw ? `分子為「${raw.label}」同期同細項。` : "數值保留來源值，缺值不補 0。"}`,
      disclosure: `位置口徑：${environment.location_semantics} ${environment.disclosure}`,
      sourceUrl: environment.source_landing_url,
      provider: environment.publisher,
      license: environment.license,
    };
  }

  const addiction = getAddictionRecipe(key);
  if (addiction) {
    const raw = addiction.pair_raw_key ? getAddictionRecipe(addiction.pair_raw_key) : undefined;
    const points = addiction.dataset_id === "addiction_service_points";
    return {
      kind: addiction.derived ? "derived" : "source",
      datasetIds: [addiction.dataset_id],
      label: points ? "衍生據點計數（本專案減害點位圖層）" : addiction.derived ? "衍生成癮與減害統計比例" : "原始成癮與減害統計快照",
      metricLabel: addiction.label,
      unit: addiction.unit,
      level: addiction.level,
      period: periodLabel(addiction.release_options),
      contract: `只接受 ${addiction.release_options.length} 個已交付 exact release selector；${raw ? `分子為「${raw.label}」同期。` : points ? "點在參考行政區面內計數。" : "數值保留來源值，不重算。"}不適用、無資料、隱私遮蔽皆不補 0。`,
      disclosure: `位置口徑：${addiction.location_semantics} ${addiction.disclosure}`,
      sourceUrl: addiction.source_landing_url,
      provider: addiction.publisher,
      license: addiction.license,
    };
  }

  const demographics = getDemographicsRecipe(key);
  if (demographics) {
    // 人數／戶數是 RIS 村里計數的精確加總；其餘（占比、指數、戶量、密度、中位數）在本層級加總後計算。
    const derived = demographics.unit !== "人" && demographics.unit !== "戶";
    const note = demographicsIndicatorNote(demographics);
    const source = demographicsSource(demographics);
    const ytd = demographicsYtdLabel(demographics);
    return {
      kind: derived ? "derived" : "source",
      datasetIds: [demographics.dataset_id],
      label: derived ? "衍生人口統計（本層級加總後計算）" : "原始戶籍人口統計快照",
      metricLabel: demographicsDisplayLabel(demographics),
      unit: demographics.unit,
      level: demographics.level,
      period: ytd ?? periodLabel(demographics.release_options),
      contract: `只接受 ${demographics.release_options.length} 個已交付 exact release selector；缺值以斜線表示、不補 0；PARTIAL 期別保留覆蓋狀態。`,
      disclosure: [`位置口徑：${demographics.location_semantics}`, demographicsDisclosure(demographics), note, demographics.level === "village" ? DEMOGRAPHICS_VILLAGE_BOUNDARY_SOURCE : undefined].filter(Boolean).join(" "),
      ...source,
    };
  }

  const agri = getAgriRecipe(key);
  if (agri) {
    const source = agri.source as {
      source_landing_url?: string;
      source_download_url?: string;
      publisher?: string;
      license?: string;
    };
    return {
      kind: "source",
      datasetIds: [agri.dataset_id],
      label: "原始統計快照",
      metricLabel: agri.label,
      unit: agri.unit,
      level: agri.level,
      period: summaryPeriodLabel(agri.release_summary.count, agri.release_summary.first),
      contract: `只接受 ${agri.release_summary.count} 個既有公開 exact release selector。`,
      disclosure: agri.disclosure,
      sourceUrl: source.source_landing_url ?? source.source_download_url,
      provider: source.publisher,
      license: source.license,
    };
  }

  if (isStatisticsLayer(key)) {
    const recipe = STATISTICS_RECIPES[key];
    return {
      kind: "source",
      datasetIds: [recipe.dataset_id],
      label: "已註冊統計資料集",
      metricLabel: recipe.label,
      unit: recipe.unit,
      level: recipe.level,
      period: recipe.frequency,
      contract: "regionalStatisticsRecipes 的既有載入契約；release selector 只解析既有公開期別。",
      disclosure: "interpretationNote" in recipe ? recipe.interpretationNote : undefined,
    };
  }

  return undefined;
}

/** The source browser must not make local-only comparison recipes discoverable in production. */
export function isDataSourceBrowserVisible(key: string): boolean {
  return !getComparisonRecipe(key) || STATISTICS_COMPARISONS_UI_ENABLED;
}

export function statisticsSourceLevelLabel(level: string): string {
  return ({ county: "縣市", township: "鄉鎮市區", village: "村里", statistical_min: "最小統計區", statistical_l1: "一級統計區", statistical_l2: "二級統計區" } as Record<string, string>)[level] ?? level;
}

export function statisticsIndicatorLabel(value: unknown, level: string): string {
  if (typeof value !== "string") return "未標示";
  return Object.values(STATISTICS_RECIPES).find(recipe => recipe.indicator_id === value && recipe.level === level)?.label ?? value;
}
