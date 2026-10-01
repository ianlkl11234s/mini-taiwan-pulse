import catalogJson from "./agriStatisticsRecipes.catalog.json";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";
import type { StatisticsReleaseSummary } from "./statisticsRecipeCatalog";
import { agriRecipeDetailsDocument } from "./statisticsRecipeDetails";

export interface AgriReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
  bundle_path: string;
  semantics_sidecar_path?: string;
  coverage: Record<string, unknown>;
  health: string;
}

export interface AgriRecipe {
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
  release_options: AgriReleaseOption[];
  source: Record<string, unknown>;
  legend: {
    method: string; breaks: number[]; colors: string[]; missing_color: string;
    suppressed_pattern: string; not_reported_label: string; zero_uses_numeric_scale: boolean; comparison_rule: string;
  };
  format: { locale: string; maximumFractionDigits: number; null: string; zero: string };
  filters: Array<Record<string, unknown>>;
  related_layer_keys: string[];
  source_statistical_boundary_version?: string;
  statistical_reference_label?: string;
  boundary_semantics?: string;
  disclosure?: string;
}

export interface AgriExistingLayerReference {
  layer_key: "statsRiceHarvest" | "statsPigWaterCounty";
  group: string;
  subgroup: string;
  dataset_id: string;
  indicator_id: string;
  dimensions?: Record<string, string>;
  mode: "index_reference_only";
  compatibility?: string;
}

export interface AgriRecipeDocument {
  recipes: AgriRecipe[];
  existing_layer_references: AgriExistingLayerReference[];
}

/** 首屏同步目錄：不含 release_options，改帶由同一份 SSOT 派生的 release_summary（見 statisticsRecipeCatalog.ts）。 */
export type AgriRecipeCatalogEntry = Omit<AgriRecipe, "release_options"> & { release_summary: StatisticsReleaseSummary };
interface AgriRecipeCatalogDocument {
  recipes: AgriRecipeCatalogEntry[];
  existing_layer_references: AgriExistingLayerReference[];
}

export const AGRI_ENABLED_STATISTICS_KEYS = [
  "statsPaddyLandAreaTownship", "statsDryFieldAreaTownship", "statsOrchardAreaTownship", "statsAgriculturalFacilityAreaTownship",
  "statsLivestockBuildingAreaTownship", "statsPastureAreaTownship", "statsAquacultureLandAreaTownship",
  "statsConiferForestAreaTownship", "statsBroadleafForestAreaTownship", "statsBambooForestAreaTownship", "statsMixedForestAreaTownship",
  "statsRoadLandAreaTownship", "statsRailLandAreaTownship", "statsAirportLandAreaTownship", "statsPortLandAreaTownship",
  "statsCropPlantedAreaTownship", "statsCropHarvestedAreaTownship", "statsCropProductionTownship", "statsCropYieldTownship",
  "statsFisheryProductionCounty", "statsFisheryProductionValueCounty", "statsAquacultureAreaCounty",
  "statsLivestockFarmCountTownship", "statsLivestockHeadCountTownship",
] as const;
export type AgriStatisticsLayerKey = typeof AGRI_ENABLED_STATISTICS_KEYS[number];

const catalog = catalogJson as unknown as AgriRecipeCatalogDocument;
export const AGRI_STATISTICS_RECIPES: readonly AgriRecipeCatalogEntry[] = catalog.recipes;
/** Existing recipes are index-only cross-topic links, never duplicate sidebar toggles or releases. */
export const AGRI_EXISTING_LAYER_REFERENCES: readonly AgriExistingLayerReference[] = catalog.existing_layer_references;
export const AGRI_ENABLED_STATISTICS_RECIPES = AGRI_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const AGRI_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  AGRI_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<AgriStatisticsLayerKey, AgriRecipeCatalogEntry>;

export function getAgriRecipe(key: string): AgriRecipeCatalogEntry | undefined {
  return AGRI_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === key);
}

/** 完整配方（含 release_options）；明細未載入時丟 STATISTICS_RECIPE_DETAILS_NOT_LOADED。 */
export function getAgriRecipeDetails(key: string): AgriRecipe | undefined {
  if (!getAgriRecipe(key)) return undefined;
  return agriRecipeDetailsDocument().recipes.find((recipe) => recipe.layer_key === key);
}

/** 已啟用配方的完整明細；明細未載入時丟錯。 */
export function agriEnabledRecipeDetails(): AgriRecipe[] {
  return agriRecipeDetailsDocument().recipes.filter((recipe) => recipe.enabled);
}

export function isAgriStatisticsLayer(key: string): boolean {
  return getAgriRecipe(key)?.enabled === true;
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

/** Intersects the upstream public releases with the handoff's immutable exact tuples. */
export function agriReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getAgriRecipeDetails(key);
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
export function resolveAgriRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getAgriRecipeDetails(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}
