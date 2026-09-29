import rawRecipes from "./laborStatisticsRecipes.json?raw";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface LaborReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
  bundle_path: string;
  coverage: Record<string, unknown>;
  health: string;
}

export interface LaborRecipe {
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
  release_options: LaborReleaseOption[];
  legend: {
    method: string; breaks: number[]; colors: string[]; missing_color: string;
    suppressed_pattern: string; not_reported_label: string; zero_uses_numeric_scale: boolean; comparison_rule: string;
  };
  format: { locale: string; maximumFractionDigits: number; null: string; zero: string };
  filters: Array<Record<string, unknown>>;
  related_layer_keys: string[];
  location_semantics: string;
  boundary_semantics: string;
  source_statistical_boundary_version?: string;
  disclosure: string;
  fragment_context?: Record<string, unknown>;
  source_family?: string;
  publisher?: string;
  license?: string;
}

export type LaborStatisticsScope = "local_frontend_wiring_ready_not_production";

interface LaborRecipeDocument {
  scope: LaborStatisticsScope;
  recipes: LaborRecipe[];
}

export const LABOR_ENABLED_STATISTICS_KEYS = [
  "statsLaborVillageIncomeMedian",
  "statsLaborCountyAnnualSalaryMedian",
  "statsLaborCountyLaborForce",
  "statsLaborCountyEmployment",
  "statsLaborCountyUnemployment",
  "statsLaborCountyNonLaborForce",
  "statsLaborCountyParticipationRate",
  "statsLaborCountyUnemploymentRate",
  "statsLaborCountyEmploymentByIndustry",
] as const;
export type LaborStatisticsLayerKey = typeof LABOR_ENABLED_STATISTICS_KEYS[number];

export type LaborStatisticsValueTransform = "complement_100";

export interface LaborStatisticsPresentationMetric {
  sourceLayerKey: LaborStatisticsLayerKey;
  optionLabel: string;
  presentationLabel?: string;
  breaks?: readonly number[];
  valueTransform?: LaborStatisticsValueTransform;
  formula?: string;
}

export interface LaborStatisticsPresentationView {
  key: LaborStatisticsLayerKey;
  label: string;
  metrics: readonly LaborStatisticsPresentationMetric[];
}

/**
 * The source already publishes participation rate for the same H1 manpower
 * survey. Non-labor-force share is its exact complement, so it can be offered
 * inside the existing toggle without inventing a tenth layer or CDN selector.
 */
export const LABOR_STATISTICS_PRESENTATION_VIEWS = [{
  key: "statsLaborCountyNonLaborForce",
  label: "非勞動力",
  metrics: [
    { sourceLayerKey: "statsLaborCountyNonLaborForce", optionLabel: "人數（千人）" },
    {
      sourceLayerKey: "statsLaborCountyParticipationRate",
      optionLabel: "非勞動力率（%）",
      presentationLabel: "非勞動力率",
      breaks: [39.6, 40.2, 40.8, 42],
      valueTransform: "complement_100",
      formula: "非勞動力率＝100%－勞動力參與率；分母為同一期人力資源調查的 15 歲以上民間人口。",
    },
  ],
}] as const satisfies readonly LaborStatisticsPresentationView[];

const LABOR_STATISTICS_PRESENTATION_VIEW_BY_KEY = Object.fromEntries(
  LABOR_STATISTICS_PRESENTATION_VIEWS.map((view) => [view.key, view]),
) as Partial<Record<LaborStatisticsLayerKey, LaborStatisticsPresentationView>>;

export function getLaborStatisticsPresentationView(key: string): LaborStatisticsPresentationView | undefined {
  return LABOR_STATISTICS_PRESENTATION_VIEW_BY_KEY[key as LaborStatisticsLayerKey];
}

export function getLaborStatisticsPresentationMetric(key: string, selectedIndicator?: string): LaborStatisticsPresentationMetric | undefined {
  const view = getLaborStatisticsPresentationView(key);
  if (!view) return undefined;
  return view.metrics.find((metric) => getLaborRecipe(metric.sourceLayerKey)?.indicator_id === selectedIndicator) ?? view.metrics[0];
}

export function isLaborStatisticsPresentationSelection(
  key: string,
  selection: { datasetId?: string; indicatorId?: string; sourceLayerKey?: string; valueTransform?: string } | null | undefined,
): boolean {
  if (!selection?.indicatorId) return false;
  const metric = getLaborStatisticsPresentationMetric(key, selection.indicatorId);
  const source = metric ? getLaborRecipe(metric.sourceLayerKey) : undefined;
  return Boolean(metric
    && source?.dataset_id === selection.datasetId
    && source?.indicator_id === selection.indicatorId
    && metric.sourceLayerKey === (selection.sourceLayerKey ?? key)
    && metric.valueTransform === selection.valueTransform);
}

// Vite/Vitest return a string for \`?raw\`; Node/tsx audit scripts can expose
// the already-parsed JSON object. Supporting both keeps manifest audits usable.
const document = (typeof rawRecipes === "string" ? JSON.parse(rawRecipes) : rawRecipes) as LaborRecipeDocument;
export const LABOR_STATISTICS_SCOPE = document.scope;
export const LABOR_STATISTICS_RECIPES = document.recipes;
export const LABOR_ENABLED_STATISTICS_RECIPES = LABOR_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const LABOR_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  LABOR_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<LaborStatisticsLayerKey, LaborRecipe>;

export function getLaborRecipe(key: string): LaborRecipe | undefined {
  return LABOR_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === key);
}

/** User-facing location grain; keeps the handoff JSON immutable while making the three statistical locations explicit. */
export function laborLocationSemantics(recipe: LaborRecipe): string {
  if (recipe.layer_key === "statsLaborVillageIncomeMedian") return `申報／戶籍村里：${recipe.location_semantics}`;
  if (recipe.layer_key === "statsLaborCountyAnnualSalaryMedian") return `實際工作場所縣市：${recipe.location_semantics}`;
  return `居住地：${recipe.location_semantics}`;
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

/** Intersects public releases with the SSOT's immutable exact tuples. */
export function laborReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getLaborRecipe(key);
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
      || JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions)))
    .map((option) => ({ releaseId: option.release_id, dimensions: option.dimensions }));
}

/** Refuses partial filter selections and opaque-id guesses. */
export function resolveLaborRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getLaborRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}
