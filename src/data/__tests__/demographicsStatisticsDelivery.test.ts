import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY } from "../demographicsStatisticsRecipes";
import { loadRegionalStatistics, clearRegionalStatisticsCdnCache } from "../regionalStatisticsLoader";
import { statisticsGeometryCache } from "../statisticsGeometryCache";

/**
 * Real-data gate: point DEMOGRAPHICS_STATISTICS_DATA_ROOT at the taipei-gis-analytics checkout after running
 * pipelines/shared/regional_statistics/assemble_demographics_preview.py. Skipped when the local preview is absent.
 */
const root = process.env.DEMOGRAPHICS_STATISTICS_DATA_ROOT;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

type Recipe = typeof DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES[number];
const load = (recipe: Recipe, suffix: string) => {
  const option = recipe.release_options.find((item) => item.release_id.endsWith(`-${suffix}`))!;
  return loadRegionalStatistics({
    layerKey: recipe.layer_key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id,
    level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions, includeHealth: true,
  });
};

it.skipIf(!root)("loads all 288 delivered exact selectors through the real hash-validating loader", async () => {
  const base = "https://demographics-delivery.test";
  const cdn = resolve(root!, "output/demographics-statistics-preview/cdn/v1");
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", base);
  vi.stubEnv("VITE_DEMOGRAPHICS_STATISTICS_PREVIEW", "false");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(base);
    const path = resolve(cdn, "." + url.pathname);
    expect(path.startsWith(cdn + sep)).toBe(true);
    return new Response(await readFile(path));
  });
  clearRegionalStatisticsCdnCache(); statisticsGeometryCache.clear();

  let loaded = 0;
  for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
    for (const option of recipe.release_options) {
      const result = await loadRegionalStatistics({
        layerKey: recipe.layer_key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id,
        level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions, includeHealth: true,
      });
      expect(result.effectiveRecipe.releaseId).toBe(option.release_id);
      expect(result.values.release.period_end).toBe(option.period_end);
      expect(result.health?.coverage_status).toBe(option.coverage.status);
      expect(result.features).toHaveLength(recipe.level === "county" ? 22 : 368);
      loaded += 1;
    }
  }
  expect(loaded).toBe(288);

  // 全國 11412 65+ 占比＝縣市 65+ 人數加總 ÷ 縣市戶籍人口加總（不平均比率）。
  const old = await load(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyPopAge65Plus, "11412");
  const total = await load(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyPopulationTotal, "11412");
  const sum = (values: typeof old.values.observations) => values.reduce((acc, value) => acc + (value.value ?? 0), 0);
  expect(sum(old.values.observations)).toBe(4673155);
  expect(Math.round(sum(old.values.observations) / sum(total.values.observations) * 10000) / 100).toBe(20.06);

  const share = await load(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyShareAge65Plus, "11412");
  expect(share.features.find((feature) => feature.properties?.area_code === "63000")?.properties).toMatchObject({
    value: 24.18, status: "observed", unit: "%", boundary_version: "COUNTY_MOI_1140318",
    location_semantics: "戶籍登記地（村里）；非常住地、非工作地。",
  });

  // 鄉鎮 10712：高雄三民、鳳山 missing（不補 0），PARTIAL 366/368 保留。
  const partial = await load(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsTownshipShareAge65Plus, "10712");
  const missing = partial.features.filter((feature) => feature.properties?.status !== "observed").map((feature) => feature.properties?.area_code).sort();
  expect(missing).toEqual(["64000050", "64000120"]);
  expect(partial.features.find((feature) => feature.properties?.area_code === "64000050")?.properties).toMatchObject({ value: null, status: "missing" });
  expect(partial.health).toMatchObject({ coverage_status: "PARTIAL", coverage_numerator: 366, coverage_denominator: 368 });

  const density = await load(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyPopulationDensity, "11412");
  expect(String(density.features[0]?.properties?.disclosure)).toContain("EPSG:3826");
}, 300000);
