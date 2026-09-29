import { afterEach, expect, it, vi } from "vitest";
import { LABOR_STATISTICS_RECIPES_BY_KEY } from "../laborStatisticsRecipes";
import { STATISTICS_RECIPES } from "../regionalStatisticsRecipes";
import { clearRegionalStatisticsCdnCache, loadRegionalStatistics } from "../regionalStatisticsLoader";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearRegionalStatisticsCdnCache();
});

async function firstRequest(recipe: Parameters<typeof loadRegionalStatistics>[0]) {
  const urls: string[] = [];
  vi.stubGlobal("window", { location: { origin: "http://localhost:3721" } });
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    urls.push(String(input));
    throw new Error("routing probe");
  });
  await expect(loadRegionalStatistics(recipe)).rejects.toThrow("routing probe");
  return urls[0];
}

it("routes only a registered labor recipe to the dataset-scoped DEV preview", async () => {
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "true");
  const labor = LABOR_STATISTICS_RECIPES_BY_KEY.statsLaborCountyAnnualSalaryMedian;
  await expect(firstRequest({ layerKey: labor.layer_key, datasetId: labor.dataset_id, indicatorId: labor.indicator_id, level: labor.level, includeHealth: true }))
    .resolves.toContain("/__labor-statistics-cdn/current.json");
});

it("routes a derived labor presentation through its registered source layer contract", async () => {
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "true");
  const source = LABOR_STATISTICS_RECIPES_BY_KEY.statsLaborCountyParticipationRate;
  await expect(firstRequest({
    layerKey: "statsLaborCountyNonLaborForce",
    sourceLayerKey: source.layer_key,
    datasetId: source.dataset_id,
    indicatorId: source.indicator_id,
    level: source.level,
    valueTransform: "complement_100",
    includeHealth: true,
  })).resolves.toContain("/__labor-statistics-cdn/current.json");
});

it("keeps an unregistered key on the configured CDN even when it claims the labor dataset", async () => {
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  await expect(firstRequest({ layerKey: "statsWasteCounty", datasetId: "labor_statistics", indicatorId: "annual_salary_median", level: "county", includeHealth: true }))
    .resolves.toBe("https://production-cdn.test/statistics/current.json");
});

it("keeps existing Statistics recipes on their original CDN", async () => {
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://existing-cdn.test/statistics");
  const recipe = STATISTICS_RECIPES.statsWasteCounty;
  await expect(firstRequest({ layerKey: "statsWasteCounty", datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, includeHealth: true }))
    .resolves.toBe("https://existing-cdn.test/statistics/current.json");
});

it("fails closed when the preview flag is false or the app is not in DEV", async () => {
  const labor = LABOR_STATISTICS_RECIPES_BY_KEY.statsLaborCountyAnnualSalaryMedian;
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "false");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  await expect(firstRequest({ layerKey: labor.layer_key, datasetId: labor.dataset_id, indicatorId: labor.indicator_id, level: labor.level, includeHealth: true }))
    .resolves.toBe("https://production-cdn.test/statistics/current.json");

  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_LABOR_STATISTICS_PREVIEW", "true");
  await expect(firstRequest({ layerKey: labor.layer_key, datasetId: labor.dataset_id, indicatorId: labor.indicator_id, level: labor.level, includeHealth: true }))
    .resolves.toBe("https://production-cdn.test/statistics/current.json");
});
