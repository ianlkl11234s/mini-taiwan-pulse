import rawRecipes from "./agriStatisticsRecipes.json?raw";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

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

interface AgriRecipeDocument {
  recipes: AgriRecipe[];
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

// Vite/Vitest load `?raw` as a string, while the Node/tsx runtime used by
// weekly-audit scripts can expose the already-parsed JSON object.  Accept both
// so importing layerManifest stays deterministic in either environment.
const document = (typeof rawRecipes === "string" ? JSON.parse(rawRecipes) : rawRecipes) as AgriRecipeDocument;
export const AGRI_STATISTICS_RECIPES = document.recipes;
/** Existing recipes are index-only cross-topic links, never duplicate sidebar toggles or releases. */
export const AGRI_EXISTING_LAYER_REFERENCES: readonly AgriExistingLayerReference[] = document.existing_layer_references;
export const AGRI_ENABLED_STATISTICS_RECIPES = AGRI_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const AGRI_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  AGRI_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<AgriStatisticsLayerKey, AgriRecipe>;

export function getAgriRecipe(key: string): AgriRecipe | undefined {
  return AGRI_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === key);
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
  const recipe = getAgriRecipe(key);
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
  const recipe = getAgriRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}
