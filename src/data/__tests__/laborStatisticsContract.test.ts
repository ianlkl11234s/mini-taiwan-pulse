import { describe, expect, it } from "vitest";
import {
  LABOR_ENABLED_STATISTICS_KEYS,
  LABOR_ENABLED_STATISTICS_RECIPES,
  LABOR_STATISTICS_SCOPE,
  getLaborRecipe,
  getLaborStatisticsPresentationMetric,
  getLaborStatisticsPresentationView,
  isLaborStatisticsPresentationSelection,
  laborReleaseOptions,
  resolveLaborRelease,
} from "../laborStatisticsRecipes";
import type { LaborStatisticsScope } from "../laborStatisticsRecipes";
import { transformStatisticsObservation, type StatisticsRelease } from "../regionalStatisticsLoader";
import { statisticsBaseKey, statisticsRenderRecipe } from "../regionalStatisticsRecipes";

const asRelease = (recipe: (typeof LABOR_ENABLED_STATISTICS_RECIPES)[number], option: (typeof recipe.release_options)[number]): StatisticsRelease => ({
  dataset_id: recipe.dataset_id,
  indicator_id: recipe.indicator_id,
  release_id: option.release_id,
  period_start: option.period_start,
  period_end: option.period_end,
  boundary_version: recipe.boundary_version,
  levels: [recipe.level],
});

describe("labor statistics adapter contract", () => {
  it("retains the local frontend wiring handoff scope literal", () => {
    const localHandoffScope: LaborStatisticsScope = "local_frontend_wiring_ready_not_production";
    expect(LABOR_STATISTICS_SCOPE).toBe(localHandoffScope);
  });

  it("registers exactly the 9 enabled handoff recipes and 12 immutable selectors", () => {
    expect(LABOR_ENABLED_STATISTICS_RECIPES).toHaveLength(9);
    expect(new Set(LABOR_ENABLED_STATISTICS_KEYS).size).toBe(9);
    expect(LABOR_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.layer_key).sort()).toEqual([...LABOR_ENABLED_STATISTICS_KEYS].sort());
    expect(LABOR_ENABLED_STATISTICS_RECIPES.reduce((count, recipe) => count + recipe.release_options.length, 0)).toBe(12);
    expect(LABOR_ENABLED_STATISTICS_RECIPES.every((recipe) => recipe.enabled && recipe.dataset_id === "labor_statistics")).toBe(true);
  });

  it("intersects every exact tuple and rejects wrong dataset, indicator, period, boundary, level, or dimensions", () => {
    for (const recipe of LABOR_ENABLED_STATISTICS_RECIPES) {
      const releases = recipe.release_options.map((option) => asRelease(recipe, option));
      expect(laborReleaseOptions(recipe.layer_key, releases)).toHaveLength(recipe.release_options.length);
      for (const option of recipe.release_options) {
        expect(resolveLaborRelease(recipe.layer_key, asRelease(recipe, option), option.dimensions)).toEqual({ releaseId: option.release_id, dimensions: option.dimensions });
        expect(resolveLaborRelease(recipe.layer_key, asRelease(recipe, option), {})).toBeNull();
        expect(resolveLaborRelease(recipe.layer_key, asRelease(recipe, option), { ...option.dimensions, unexpected: "value" })).toBeNull();
        expect(resolveLaborRelease(recipe.layer_key, { ...asRelease(recipe, option), release_id: "unknown-release" }, option.dimensions)).toBeNull();
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), dataset_id: "wrong-dataset" }])).toEqual([]);
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), indicator_id: "wrong-indicator" }])).toEqual([]);
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), period_start: "2099-01-01" }])).toEqual([]);
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), period_end: "2099-12-31" }])).toEqual([]);
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), boundary_version: "wrong-boundary" }])).toEqual([]);
        expect(laborReleaseOptions(recipe.layer_key, [{ ...asRelease(recipe, option), levels: [recipe.level === "county" ? "village" : "county"] }])).toEqual([]);
      }
    }
  });

  it("keeps coverage, missingness, and industry selector semantics exact", () => {
    const village = getLaborRecipe("statsLaborVillageIncomeMedian")!;
    expect(village.release_options[0]?.coverage).toMatchObject({ denominator: 7973, numerator: 7602, observed: { missing_count: 371, status: "PARTIAL" } });
    expect(village.disclosure).toContain("371村里缺值不補零");
    expect(village.legend.breaks).toEqual([388, 415, 438, 460, 486, 523, 593]);
    expect(village.legend.colors).toHaveLength(8);

    const salary = getLaborRecipe("statsLaborCountyAnnualSalaryMedian")!;
    expect(salary.release_options[0]?.dimensions).toEqual({ employee_scope: "national_full_time", roc_year: "113", sex: "total" });
    expect(salary.release_options[0]?.coverage).toMatchObject({ not_covered_area_codes: ["09007", "09020"], numerator: 20 });

    const industry = getLaborRecipe("statsLaborCountyEmploymentByIndustry")!;
    expect(industry.release_options.map((option) => option.dimensions.industry)).toEqual(["agriculture", "industry", "manufacturing", "services"]);
    expect(industry.disclosure).toContain("manufacturing 是 industry 子集");
  });

  it("keeps non-labor-force count and share inside one layer while reusing the exact participation-rate selector", () => {
    const key = "statsLaborCountyNonLaborForce";
    const view = getLaborStatisticsPresentationView(key)!;
    expect(view.metrics.map((metric) => metric.optionLabel)).toEqual(["人數（千人）", "非勞動力率（%）"]);

    const derived = getLaborStatisticsPresentationMetric(key, "participation_rate")!;
    expect(derived).toMatchObject({ sourceLayerKey: "statsLaborCountyParticipationRate", valueTransform: "complement_100" });
    expect(statisticsBaseKey(key, "participation_rate")).toBe("statsLaborCountyParticipationRate");
    expect(statisticsRenderRecipe(key, "participation_rate")).toMatchObject({
      indicator_id: "participation_rate",
      label: "非勞動力率",
      unit: "%",
      breaks: [39.6, 40.2, 40.8, 42],
      sourceLayerKey: "statsLaborCountyParticipationRate",
      valueTransform: "complement_100",
    });
    expect(transformStatisticsObservation({ area_code: "10018", value: 59.6, status: "observed" }, "complement_100"))
      .toMatchObject({ value: 40.4, inputs: { source_participation_rate_pct: 59.6 } });
    expect(transformStatisticsObservation({ area_code: "09007", value: null, status: "missing" }, "complement_100"))
      .toEqual({ area_code: "09007", value: null, status: "missing" });
    expect(isLaborStatisticsPresentationSelection(key, {
      datasetId: "labor_statistics",
      indicatorId: "unknown",
      sourceLayerKey: key,
    })).toBe(false);
  });
});
