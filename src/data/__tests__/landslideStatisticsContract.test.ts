import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LANDSLIDE_ENABLED_STATISTICS_KEYS, LANDSLIDE_ENABLED_STATISTICS_RECIPES, LANDSLIDE_STATISTICS_RECIPES, LANDSLIDE_STATISTICS_RECIPES_BY_KEY,
  LANDSLIDE_STATISTICS_TOGGLE_GROUPS, landslideReleaseOptions, resolveLandslideRelease,
} from "../landslideStatisticsRecipes";
import { STATISTICS_RECIPES, statisticsRenderRecipe } from "../regionalStatisticsRecipes";
import { getStatisticsDataSourceDefinition } from "../statisticsDataSources";
import { getMedicalStatisticsGroup } from "../medicalStatisticsGroups";
import { getStatisticsVisual } from "../statisticsVisuals";
import { clearRegionalStatisticsCdnCache, loadRegionalStatistics, loadRegionalStatisticsValues, type StatisticsRelease } from "../regionalStatisticsLoader";

const loss = LANDSLIDE_STATISTICS_RECIPES_BY_KEY.statsSwcDisasterLossCounty;
const asRelease = (recipe: typeof loss, releaseId: string): StatisticsRelease => {
  const option = recipe.release_options.find((candidate) => candidate.release_id === releaseId)!;
  return { release_id: releaseId, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, boundary_version: recipe.boundary_version, period_start: option.period_start, period_end: option.period_end, levels: [recipe.level] } as StatisticsRelease;
};
const publicReleases = (recipe: typeof loss) => recipe.release_options.map((option) => asRelease(recipe, option.release_id));

describe("landslide statistics recipes", () => {
  it("registers 4 enabled county recipes (79 selectors) and keeps 崩塌地處理面積 off the map", () => {
    expect(LANDSLIDE_STATISTICS_RECIPES).toHaveLength(5);
    expect(LANDSLIDE_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.layer_key)).toEqual([...LANDSLIDE_ENABLED_STATISTICS_KEYS]);
    expect(LANDSLIDE_ENABLED_STATISTICS_RECIPES.reduce((sum, recipe) => sum + recipe.release_options.length, 0)).toBe(79);
    expect(LANDSLIDE_STATISTICS_RECIPES.filter((recipe) => !recipe.enabled).map((recipe) => recipe.layer_key)).toEqual(["statsSlopeWorksCollapsedLandCounty"]);
    for (const key of LANDSLIDE_ENABLED_STATISTICS_KEYS) {
      expect(STATISTICS_RECIPES[key].dataset_id).toBe(LANDSLIDE_STATISTICS_RECIPES_BY_KEY[key].dataset_id);
      expect("releaseId" in STATISTICS_RECIPES[key]).toBe(false);
      expect(STATISTICS_RECIPES[key].dimensions).toEqual({});
      expect(STATISTICS_RECIPES[key].level).toBe("county");
    }
  });

  it("defaults to the latest delivered year and refuses dimensions or unknown releases", () => {
    const options = landslideReleaseOptions("statsSwcDisasterLossCounty", publicReleases(loss));
    // 損失只有 14 年：缺 2011–2018 與 2021，選單不列不存在的年份。
    expect(options).toHaveLength(14);
    expect(options[0]?.releaseId).toBe(loss.default_release_id);
    expect(loss.release_options.map((option) => option.period_start.slice(0, 4))).not.toContain("2015");
    expect(landslideReleaseOptions("statsSlopeWorksCollapsedLandCounty", [])).toEqual([]);
    const release = asRelease(loss, loss.default_release_id);
    expect(resolveLandslideRelease("statsSwcDisasterLossCounty", release, {})).toEqual({ releaseId: loss.default_release_id, dimensions: {} });
    expect(resolveLandslideRelease("statsSwcDisasterLossCounty", release, { sex: "total" })).toBeNull();
    expect(resolveLandslideRelease("statsSwcDisasterLossCounty", { ...release, release_id: "2025-unknown" }, {})).toBeNull();
  });

  it("puts 崩塌筆數 and 崩塌面積 in one row; single indicators stay ungrouped", () => {
    expect(LANDSLIDE_STATISTICS_TOGGLE_GROUPS).toHaveLength(1);
    expect(getMedicalStatisticsGroup("statsLandslideAreaCounty")?.options.map((option) => option.key)).toEqual(["statsLandslideCountCounty", "statsLandslideAreaCounty"]);
    expect(getMedicalStatisticsGroup("statsSlopeWorksCostCounty")).toBeUndefined();
  });

  it("keeps fixed non-binary breaks and labels 未列 / 0 / 推定單位 in the legend data", () => {
    for (const recipe of LANDSLIDE_ENABLED_STATISTICS_RECIPES) {
      const render = statisticsRenderRecipe(recipe.layer_key as typeof LANDSLIDE_ENABLED_STATISTICS_KEYS[number]);
      expect(recipe.legend.breaks.length).toBeGreaterThanOrEqual(4);
      expect(render.colors).toHaveLength(render.breaks.length + 1);
    }
    expect(LANDSLIDE_STATISTICS_RECIPES_BY_KEY.statsSlopeWorksCostCounty.status_labels.missing).toContain("未列");
    expect(LANDSLIDE_STATISTICS_RECIPES_BY_KEY.statsLandslideCountCounty.status_labels).toEqual({});
    expect(LANDSLIDE_STATISTICS_RECIPES_BY_KEY.statsLandslideCountCounty.legend.zero_note).toContain("0");
    expect(LANDSLIDE_STATISTICS_RECIPES_BY_KEY.statsSlopeWorksCostCounty.legend.display_note).toContain("億元");
    expect(loss.unit).toBe("千元");
    expect(loss.legend.display_note).toContain("推定");
  });

  it("uses the existing environment palette, not a new one", () => {
    for (const key of LANDSLIDE_ENABLED_STATISTICS_KEYS) expect(getStatisticsVisual(key).theme).toBe("環境");
  });

  it("discloses the series break, the 2019 m² conversion, typhoon caveat, missing years and the presumed unit", () => {
    const area = getStatisticsDataSourceDefinition("statsLandslideAreaCounty");
    expect(area?.disclosure).toContain("2016→2017");
    expect(area?.disclosure).toContain("平方公尺");
    expect(area?.disclosure).toContain("不一定反映當年颱風");
    expect(getStatisticsDataSourceDefinition("statsSwcDisasterLossCounty")?.disclosure).toContain("2011–2018");
    expect(getStatisticsDataSourceDefinition("statsSwcDisasterLossCounty")?.disclosure).toContain("推定");
    expect(getStatisticsDataSourceDefinition("statsSlopeWorksCostCounty")?.disclosure).toContain("未列");
    for (const recipe of LANDSLIDE_ENABLED_STATISTICS_RECIPES) {
      const definition = getStatisticsDataSourceDefinition(recipe.layer_key);
      expect(definition?.kind).toBe("source");
      expect(definition?.provider).toBe(recipe.publisher);
      expect(definition?.license).toBe(recipe.license);
      expect(definition?.sourceUrl).toMatch(/^https:\/\/data\.gov\.tw\/dataset\//);
    }
  });
});

describe("landslide statistics production loader", () => {
  const base = "https://cdn.test/statistics/v1";
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const encode = (data: unknown) => new TextEncoder().encode(JSON.stringify(data));
  const release = asRelease(loss, loss.default_release_id);

  beforeEach(() => {
    clearRegionalStatisticsCdnCache();
    vi.stubEnv("VITE_STATISTICS_CDN_BASE", base);
    vi.stubGlobal("crypto", webcrypto);
    const files = new Map<string, Uint8Array>();
    const put = (data: unknown, folder: string) => {
      const bytes = encode(data);
      const path = `${folder}/${sha(bytes)}.json`;
      files.set(path, bytes);
      return { path, sha256: sha(bytes), bytes: bytes.byteLength };
    };
    const boundary = put({ type: "FeatureCollection", features: [
      { type: "Feature", properties: { area_code: "63000" }, geometry: { type: "Polygon", coordinates: [[[121, 25], [121.1, 25], [121.1, 25.1], [121, 25]]] } },
      { type: "Feature", properties: { area_code: "10008" }, geometry: { type: "Polygon", coordinates: [[[120.9, 23.9], [121, 23.9], [121, 24], [120.9, 23.9]]] } },
    ] }, "geometries");
    const geometry = { resource: boundary.path, sha256: boundary.sha256, bytes: boundary.bytes, code_scheme: "area_code", boundary_version: loss.boundary_version, level: "county" };
    const rows = [
      { area_code: "63000", value: null, status: "missing" },
      { area_code: "10008", value: 1306542, status: "observed" },
    ];
    const artifact = put({
      schema_version: "regional-statistics-cdn-v1",
      values: { status: "OK", release, area_level: "county", total: 2, returned: 2, offset: 0, truncated: false, next_offset: null, observations: rows },
      sources: { status: "OK", source: { publisher: "農業部" } }, health: { status: "OK", availability: "CURRENT" }, geometry: { status: "OK", geometry },
    }, "artifacts");
    const manifest = put({
      schema_version: "regional-statistics-cdn-v1",
      catalog: { status: "OK", indicators: [{ dataset_id: loss.dataset_id, indicator_id: loss.indicator_id, name: loss.label, unit: loss.unit, levels: ["county"] }] },
      indicators: [{ dataset_id: loss.dataset_id, indicator_id: loss.indicator_id, releases: [release] }],
      selectors: [{ dataset_id: loss.dataset_id, indicator_id: loss.indicator_id, release_id: release.release_id, area_level: "county", dimensions: {}, artifact }],
      geometries: [geometry],
    }, "manifests");
    files.set("current.json", encode({ schema_version: "regional-statistics-cdn-v1", manifest }));
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const path = String(input).slice(base.length + 1);
      const bytes = files.get(path);
      if (!bytes) throw new Error(`unexpected ${path}`);
      return new Response(bytes);
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); clearRegionalStatisticsCdnCache(); });

  const recipe = { layerKey: "statsSwcDisasterLossCounty", datasetId: loss.dataset_id, indicatorId: loss.indicator_id, level: "county" as const, includeHealth: true };

  it("loads the deterministic default year and keeps 未列 counties as null, not 0", async () => {
    const result = await loadRegionalStatisticsValues(recipe);
    expect(result.effectiveRecipe).toMatchObject({ releaseId: loss.default_release_id, dimensions: {} });
    expect(result.values.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "63000", value: null, status: "missing" }),
      expect.objectContaining({ area_code: "10008", value: 1306542, status: "observed" }),
    ]));
  });

  it("renders features with the landslide disclosure and location semantics", async () => {
    const result = await loadRegionalStatistics(recipe);
    const taipei = result.features.find((feature) => feature.properties?.area_code === "63000");
    expect(taipei?.properties).toMatchObject({ value: null, status: "missing" });
    expect(String(taipei?.properties?.disclosure)).toContain("推定");
    expect(String(taipei?.properties?.location_semantics)).toContain("來源表所列縣市");
  });

  it("rejects a release outside the delivered whitelist", async () => {
    await expect(loadRegionalStatisticsValues({ ...recipe, releaseId: "2026-unknown", allowReleaseFallback: false })).rejects.toThrow();
  });
});
