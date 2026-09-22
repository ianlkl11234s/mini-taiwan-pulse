import { afterEach, expect, it, vi } from "vitest";
import { SOCIAL_STATISTICS_RECIPES_BY_KEY } from "../socialStatisticsRecipes";
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

it("routes only an exact enabled social recipe to the DEV preview origin", async () => {
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "true");
  const social = SOCIAL_STATISTICS_RECIPES_BY_KEY.statsHousingTotalCounty;
  await expect(firstRequest({ layerKey: social.layer_key, datasetId: social.dataset_id, indicatorId: social.indicator_id, level: social.level, includeHealth: true })).resolves.toContain("/__social-statistics-cdn/current.json");
});

it("routes the fixed public CDN through the same-origin DEV proxy by default", async () => {
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "false");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "");
  const social = SOCIAL_STATISTICS_RECIPES_BY_KEY.statsHousingTotalCounty;
  await expect(firstRequest({ layerKey: social.layer_key, datasetId: social.dataset_id, indicatorId: social.indicator_id, level: social.level, includeHealth: true })).resolves.toBe("http://localhost:3721/__statistics-cdn/current.json");
});

it("keeps existing recipes on VITE_STATISTICS_CDN_BASE when preview is enabled", async () => {
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://existing-cdn.test/statistics");
  const recipe = STATISTICS_RECIPES.statsWasteCounty;
  await expect(firstRequest({ layerKey: "statsWasteCounty", datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: recipe.dimensions, includeHealth: true })).resolves.toBe("https://existing-cdn.test/statistics/current.json");
});

it("does not opt into the local route when the preview flag is false", async () => {
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "false");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  const social = SOCIAL_STATISTICS_RECIPES_BY_KEY.statsHousingTotalCounty;
  await expect(firstRequest({ layerKey: social.layer_key, datasetId: social.dataset_id, indicatorId: social.indicator_id, level: social.level, includeHealth: true })).resolves.toBe("https://production-cdn.test/statistics/current.json");
});

it("does not opt into the local route in production even when preview is enabled", async () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_SOCIAL_STATISTICS_PREVIEW", "true");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", "https://production-cdn.test/statistics");
  const social = SOCIAL_STATISTICS_RECIPES_BY_KEY.statsHousingTotalCounty;
  await expect(firstRequest({ layerKey: social.layer_key, datasetId: social.dataset_id, indicatorId: social.indicator_id, level: social.level, includeHealth: true })).resolves.toBe("https://production-cdn.test/statistics/current.json");
});
