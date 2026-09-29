import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { LABOR_ENABLED_STATISTICS_RECIPES } from "../laborStatisticsRecipes";
import { loadRegionalStatistics, clearRegionalStatisticsCdnCache } from "../regionalStatisticsLoader";
import { statisticsGeometryCache } from "../statisticsGeometryCache";

const root = process.env.LABOR_STATISTICS_DATA_ROOT;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.skipIf(!root)("loads all 12 delivered exact selectors through the real hash-validating loader", async () => {
  const base = "https://labor-delivery.test";
  const cdn = resolve(root!, "output/labor-statistics/cdn/v1");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", base);
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "false");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(base);
    const path = resolve(cdn, "." + url.pathname);
    expect(path.startsWith(cdn + sep)).toBe(true);
    return new Response(await readFile(path));
  });
  clearRegionalStatisticsCdnCache(); statisticsGeometryCache.clear();
  const results = [];
  for (const recipe of LABOR_ENABLED_STATISTICS_RECIPES) {
    for (const option of recipe.release_options) {
      const result = await loadRegionalStatistics({
        layerKey: recipe.layer_key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id,
        level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions, includeHealth: true,
      });
      expect(result.effectiveRecipe.releaseId).toBe(option.release_id);
      expect(result.effectiveRecipe.dimensions).toEqual(option.dimensions);
      expect(result.values.release.period_start).toBe(option.period_start);
      expect(result.health?.status).toBe("OK");
      expect(result.features.length).toBeGreaterThan(0);
      results.push({
        key: recipe.layer_key, release: option.release_id, dimensions: option.dimensions,
        observations: result.values.total, observed: result.values.observations.filter((value) => value.status === "observed").length,
        missing: result.values.observations.filter((value) => value.value === null).length,
        health: result.health, geometry: result.geometryManifest.sha256,
      });
    }
  }
  expect(results).toHaveLength(12);
  const salary = results.find((result) => result.key === "statsLaborCountyAnnualSalaryMedian")!;
  expect(salary).toMatchObject({ observations: 22, observed: 20, missing: 2, health: { coverage: { not_covered_area_codes: ["09007", "09020"] } } });
  const salaryRecipe = LABOR_ENABLED_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === salary.key)!;
  const salaryResult = await loadRegionalStatistics({
    layerKey: salaryRecipe.layer_key, datasetId: salaryRecipe.dataset_id, indicatorId: salaryRecipe.indicator_id,
    level: salaryRecipe.level, releaseId: salary.release, dimensions: salary.dimensions, includeHealth: true,
  });
  expect(salaryResult.values.observations.find((value) => value.area_code === "63000")).toMatchObject({ value: 73.5, status: "observed" });
  expect(salaryResult.values.observations.find((value) => value.area_code === "10018")).toMatchObject({ value: 90.2, status: "observed" });
  expect(salaryResult.values.observations.find((value) => value.area_code === "09007")).toMatchObject({ value: null, status: "missing" });
  expect(salaryResult.values.observations.find((value) => value.area_code === "09020")).toMatchObject({ value: null, status: "missing" });
  expect(salaryResult.features.find((feature) => feature.properties?.area_code === "63000")?.properties).toMatchObject({
    value: 73.5,
    status: "observed",
    location_semantics: "實際工作場所縣市：本國籍全時受僱員工的實際工作所在地；非居住地、戶籍、稅務或投保地。金門、連江未涵蓋。",
    boundary_version: "COUNTY_MOI_1140318",
    coverage_numerator: 20,
    coverage_denominator: 22,
  });
  expect(salaryResult.features.find((feature) => feature.properties?.area_code === "09007")?.properties).toMatchObject({
    value: null,
    status: "missing",
    missing_reason: "source_not_covered",
  });

  const villageRecipe = LABOR_ENABLED_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === "statsLaborVillageIncomeMedian")!;
  const villageOption = villageRecipe.release_options[0]!;
  const villageResult = await loadRegionalStatistics({
    layerKey: villageRecipe.layer_key, datasetId: villageRecipe.dataset_id, indicatorId: villageRecipe.indicator_id,
    level: villageRecipe.level, releaseId: villageOption.release_id, dimensions: villageOption.dimensions, includeHealth: true,
  });
  expect(villageResult.features.filter((feature) => feature.properties?.status === "observed")).toHaveLength(7602);
  expect(villageResult.features.filter((feature) => feature.properties?.missing_reason === "source_join_or_time_mismatch")).toHaveLength(371);
  expect(villageResult.geometryManifest.boundary_version).toBe("VILLAGE_NLSC_1150119");

  const participationRecipe = LABOR_ENABLED_STATISTICS_RECIPES.find((recipe) => recipe.layer_key === "statsLaborCountyParticipationRate")!;
  const participationOption = participationRecipe.release_options[0]!;
  const nonLaborShare = await loadRegionalStatistics({
    layerKey: "statsLaborCountyNonLaborForce",
    sourceLayerKey: participationRecipe.layer_key,
    datasetId: participationRecipe.dataset_id,
    indicatorId: participationRecipe.indicator_id,
    level: participationRecipe.level,
    releaseId: participationOption.release_id,
    dimensions: participationOption.dimensions,
    includeHealth: true,
    valueTransform: "complement_100",
    label: "非勞動力率",
  });
  expect(nonLaborShare.values.observations.find((value) => value.area_code === "10018")).toMatchObject({
    value: 40.4,
    status: "observed",
    inputs: { source_participation_rate_pct: 59.6 },
  });
  expect(nonLaborShare.features.find((feature) => feature.properties?.area_code === "10018")?.properties).toMatchObject({
    value: 40.4,
    indicator_name: "非勞動力率",
    unit: "%",
    comparison_formula: "100% − 勞動力參與率",
  });
}, 120000);
