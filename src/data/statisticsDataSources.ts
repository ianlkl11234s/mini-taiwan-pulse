import { getAgriRecipe } from "./agriStatisticsRecipes";
import { getComparisonRecipe, STATISTICS_COMPARISONS_UI_ENABLED } from "./comparisonStatisticsRecipes";
import { isStatisticsLayer, STATISTICS_RECIPES, statisticsBaseKey } from "./regionalStatisticsRecipes";
import { getSocialRecipe } from "./socialStatisticsRecipes";
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
  if (options.length === 0) return "未標示期別";
  if (options.length === 1) return `${options[0]!.period_start} 至 ${options[0]!.period_end}`;
  return `${options.length} 個既有公開期別`;
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
    const releaseOptions = recipe.release_options.filter(
      (option) => option.dimensions.education_stage === view.stage,
    );
    return {
      kind: "presentation",
      datasetIds: [recipe.dataset_id],
      label: "固定學制統計入口",
      metricLabel: view.label,
      unit: recipe.unit,
      level: recipe.level,
      period: periodLabel(releaseOptions),
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
      period: periodLabel(social.release_options),
      contract: `來源家族：${social.source_family ?? "未標示"}；只接受 ${social.release_options.length} 個既有公開 exact release selector。`,
      disclosure: social.disclosure,
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
      period: periodLabel(agri.release_options),
      contract: `只接受 ${agri.release_options.length} 個既有公開 exact release selector。`,
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
