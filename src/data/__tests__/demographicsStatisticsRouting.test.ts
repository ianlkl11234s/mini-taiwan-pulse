import { afterEach, expect, it, vi } from "vitest";
import { DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY } from "../demographicsStatisticsRecipes";
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

const probe = (key: keyof typeof DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY) => {
  const recipe = DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY[key];
  return { layerKey: recipe.layer_key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, includeHealth: true };
};

it("routes both delivered demographics datasets to the dataset-scoped DEV preview", async () => {
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "true");
  await expect(firstRequest(probe("statsDemographicsTownshipPopulationTotal"))).resolves.toBe("http://localhost:3721/__demographics-statistics-cdn/current.json");
  clearRegionalStatisticsCdnCache();
  await expect(firstRequest(probe("statsDemographicsCountyShareAge65Plus"))).resolves.toBe("http://localhost:3721/__demographics-statistics-cdn/current.json");
});

it("keeps an unregistered key on the configured CDN even when it claims a demographics dataset", async () => {
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  await expect(firstRequest({ layerKey: "statsBirthsTownship", datasetId: "population_age_structure", indicatorId: "share_age_65_plus", level: "county", includeHealth: true }))
    .resolves.toBe("https://production-cdn.test/statistics/current.json");
});

it("does not reroute a registered key whose dataset id was tampered with", async () => {
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  await expect(firstRequest({ ...probe("statsDemographicsCountyPopulationTotal"), datasetId: "labor_statistics" }))
    .resolves.toBe("https://production-cdn.test/statistics/current.json");
});

it("keeps existing Statistics recipes (incl. 出生登記) on their original CDN", async () => {
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://existing-cdn.test/statistics");
  const recipe = STATISTICS_RECIPES.statsBirthsTownship;
  await expect(firstRequest({ layerKey: "statsBirthsTownship", datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, includeHealth: true }))
    .resolves.toBe("https://existing-cdn.test/statistics/current.json");
});

it("fails closed when the preview flag is off or the app is not in DEV", async () => {
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "false");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  await expect(firstRequest(probe("statsDemographicsCountyPopulationTotal"))).resolves.toBe("https://production-cdn.test/statistics/current.json");

  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "true");
  await expect(firstRequest(probe("statsDemographicsCountyPopulationTotal"))).resolves.toBe("https://production-cdn.test/statistics/current.json");
});
