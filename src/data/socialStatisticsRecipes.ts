import rawRecipes from "./socialStatisticsRecipes.json?raw";
import type { StatisticsLevel, StatisticsRelease } from "./regionalStatisticsLoader";

export interface SocialReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
  bundle_path: string;
  semantics_sidecar_path?: string;
  coverage: Record<string, unknown>;
  health: string;
}

export interface SocialRecipe {
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
  release_options: SocialReleaseOption[];
  legend: {
    method: string; breaks: number[]; colors: string[]; missing_color: string;
    suppressed_pattern: string; not_reported_label: string; zero_uses_numeric_scale: boolean; comparison_rule: string;
  };
  format: { locale: string; maximumFractionDigits: number; null: string; zero: string };
  filters: Array<Record<string, unknown>>;
  related_layer_keys: string[];
  boundary_semantics?: string;
  source_statistical_boundary_version?: string;
  disclosure?: string;
  fragment_context?: Record<string, unknown>;
  source_family?: string;
}

interface SocialRecipeDocument {
  recipes: SocialRecipe[];
}

export const SOCIAL_ENABLED_STATISTICS_KEYS = [
  "statsEducationCountyInstitutionCount", "statsEducationCountyTeacherCount", "statsEducationCountyStaffCount", "statsEducationCountyStudentCount", "statsEducationCountyClassCount", "statsEducationCountySmallSchoolCount", "statsEducationCountySmallSchoolSharePct", "statsEducationCountyStudentTeacherRatio", "statsEducationCountyStudentsPerClass", "statsEducationCountyStudentYearChange", "statsEducationCountyStudentYearChangePct",
  "statsHealthHospitalCount", "statsHealthHospitalBedTotal", "statsHealthAcuteBedTotal", "statsHealthIcuBedTotal", "statsHealthHospiceBedTotal", "statsHealthHealthProfessionalTotal", "statsHealthWesternPhysicianCount", "statsHealthRegisteredNurseCount", "statsHealthNursingStaffListedAgeSexSum", "statsHealthCareWorkerListedSexSum", "statsHealthGeneralNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenInfantBeds", "statsHealthCareWorkerRegistration", "statsHealthMedicalInstitutionBedsPer10000Population", "statsHealthPracticingMedicalPersonnelPer10000Population",
  "statsHousingTotalCounty", "statsHousingOccupiedCounty", "statsHousingUnoccupiedCounty", "statsHousingOccasionalCounty", "statsHousingOtherUseCounty", "statsHousingUnusedCounty", "statsHousingResidenceOnlyCounty", "statsHousingMixedUseCounty", "statsHousingOccupiedPctCounty", "statsHousingUnusedPctCounty", "statsHousingTotalTownship", "statsHousingOccupiedTownship", "statsHousingUnoccupiedTownship", "statsHousingOccasionalTownship", "statsHousingOtherUseTownship", "statsHousingUnusedTownship", "statsHousingOccupiedPctTownship", "statsHousingUnusedPctTownship",
] as const;
export type SocialStatisticsLayerKey = typeof SOCIAL_ENABLED_STATISTICS_KEYS[number];

const document = JSON.parse(rawRecipes) as SocialRecipeDocument;
export const SOCIAL_STATISTICS_RECIPES = document.recipes;
export const SOCIAL_ENABLED_STATISTICS_RECIPES = SOCIAL_STATISTICS_RECIPES.filter((recipe) => recipe.enabled);
export const SOCIAL_STATISTICS_RECIPES_BY_KEY = Object.fromEntries(
  SOCIAL_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, recipe]),
) as Record<SocialStatisticsLayerKey, SocialRecipe>;

export function getSocialRecipe(key: string): SocialRecipe | undefined {
  return SOCIAL_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === key);
}

function sameDimensions(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const bEntries = Object.entries(b);
  return Object.keys(a).length === bEntries.length && Object.entries(a).every(([key, value]) => b[key] === value);
}

/** Intersects public releases with the SSOT's immutable exact tuples. */
export function socialReleaseOptions(key: string, releases: readonly StatisticsRelease[]) {
  const recipe = getSocialRecipe(key);
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
export function resolveSocialRelease(
  key: string,
  release: Pick<StatisticsRelease, "release_id" | "period_start" | "period_end">,
  selectedDimensions: Record<string, unknown>,
) {
  const recipe = getSocialRecipe(key);
  if (!recipe?.enabled) return null;
  const matches = recipe.release_options.filter((option) => option.release_id === release.release_id
    && option.period_start === release.period_start
    && option.period_end === release.period_end
    && sameDimensions(option.dimensions, selectedDimensions));
  return matches.length === 1 ? { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions } : null;
}
