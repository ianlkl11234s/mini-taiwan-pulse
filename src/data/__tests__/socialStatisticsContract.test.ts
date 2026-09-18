import { describe, expect, it } from "vitest";
import {
  SOCIAL_ENABLED_STATISTICS_KEYS,
  SOCIAL_ENABLED_STATISTICS_RECIPES,
  SOCIAL_STATISTICS_SCOPE,
  getSocialRecipe,
  resolveSocialRelease,
  socialReleaseOptions,
} from "../socialStatisticsRecipes";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

const asRelease = (recipe: (typeof SOCIAL_ENABLED_STATISTICS_RECIPES)[number], option: (typeof recipe.release_options)[number]): StatisticsRelease => ({
  dataset_id: recipe.dataset_id,
  indicator_id: recipe.indicator_id,
  release_id: option.release_id,
  period_start: option.period_start,
  period_end: option.period_end,
  boundary_version: recipe.boundary_version,
  levels: [recipe.level],
});

describe("social statistics adapter contract", () => {
  it("consumes the upstream hash-bound production contract", () => {
    expect(SOCIAL_STATISTICS_SCOPE).toBe("production_published");
  });

  it("registers exactly the 45 enabled handoff recipes and 416 immutable selectors", () => {
    expect(SOCIAL_ENABLED_STATISTICS_RECIPES).toHaveLength(45);
    expect(new Set(SOCIAL_ENABLED_STATISTICS_KEYS).size).toBe(45);
    expect(SOCIAL_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.layer_key).sort()).toEqual([...SOCIAL_ENABLED_STATISTICS_KEYS].sort());
    // Registration exposes total/male/female selectors over one bundle; selectors remain exact when bundles are reused.
    expect(new Set(SOCIAL_ENABLED_STATISTICS_RECIPES.flatMap((recipe) => recipe.release_options.map((option) => option.release_id))).size).toBe(414);
    expect(SOCIAL_ENABLED_STATISTICS_RECIPES.reduce((count, recipe) => count + recipe.release_options.length, 0)).toBe(416);
    expect(SOCIAL_ENABLED_STATISTICS_RECIPES.every((recipe) => recipe.enabled && recipe.related_layer_keys.every((key) => typeof key === "string"))).toBe(true);
  });

  it("intersects every exact tuple with the public release identity and rejects altered identity", () => {
    for (const recipe of SOCIAL_ENABLED_STATISTICS_RECIPES) {
      const releases = recipe.release_options.map((option) => asRelease(recipe, option));
      expect(socialReleaseOptions(recipe.layer_key, releases)).toHaveLength(recipe.release_options.length);
      for (const option of recipe.release_options) {
        expect(resolveSocialRelease(recipe.layer_key, asRelease(recipe, option), option.dimensions)).toEqual({ releaseId: option.release_id, dimensions: option.dimensions });
        expect(resolveSocialRelease(recipe.layer_key, asRelease(recipe, option), { ...option.dimensions, unexpected: "value" })).toBeNull();
        expect(resolveSocialRelease(recipe.layer_key, { ...asRelease(recipe, option), release_id: `${option.release_id}-unknown` }, option.dimensions)).toBeNull();
        expect(socialReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), dataset_id: "wrong-dataset" }])).toEqual([]);
        expect(socialReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), period_end: "2099-12-31" }])).toEqual([]);
        expect(socialReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), boundary_version: "wrong-boundary" }])).toEqual([]);
        expect(socialReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), levels: [recipe.level === "county" ? "township" : "county"] }])).toEqual([]);
      }
    }
  });

  it("keeps dependent filters and semantic representatives exact", () => {
    const education = getSocialRecipe("statsEducationCountyStudentYearChange")!;
    expect(education.filters.find((filter) => filter.key === "academic_year_roc")?.options).toEqual(["105", "106", "107", "108", "109", "110", "111", "112", "113", "114"]);
    expect(education.release_options.some((option) => option.dimensions.education_stage === "elementary" && option.dimensions.academic_year_roc === "105" && option.dimensions.previous_academic_year_roc === "104")).toBe(true);

    const nursing = getSocialRecipe("statsHealthNursingStaffListedAgeSexSum")!;
    expect(nursing.release_options[0]?.dimensions).toEqual({ institution_type: "general_nursing_home", month: "12", roc_year: "114" });
    expect(nursing.release_options[0]?.coverage).toMatchObject({ expected: { county_count: 22 }, observed: { status: "PARTIAL" } });

    const beds = getSocialRecipe("statsHealthGeneralNursingHomeOpenBeds")!;
    expect(beds.release_options[0]?.dimensions.capacity_field).toBe("一般護理之家-開放床數");
    expect(beds.format.zero).toBe("0");

    const registration = getSocialRecipe("statsHealthCareWorkerRegistration")!;
    expect(registration.filters.find((filter) => filter.key === "sex")?.options).toEqual(["total", "male", "female"]);

    const housing = getSocialRecipe("statsHousingUnusedPctCounty")!;
    expect(housing.label).not.toContain("空屋率");
    expect(housing.disclosure).toContain("無人經常居住");
    expect(housing.disclosure).toContain("不能全稱空屋");
    expect(housing.release_options[0]?.period_start).toBe("2020-11-08");
  });
});
