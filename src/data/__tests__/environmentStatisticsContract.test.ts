import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENVIRONMENT_ENABLED_STATISTICS_KEYS, ENVIRONMENT_ENABLED_STATISTICS_RECIPES, ENVIRONMENT_STATISTICS_RECIPES_BY_KEY,
  ENVIRONMENT_STATISTICS_TOGGLE_GROUPS, environmentLegendRows, environmentReleaseOptions, resolveEnvironmentRelease,
} from "../environmentStatisticsRecipes";
import { STATISTICS_RECIPES, statisticsRenderRecipe } from "../regionalStatisticsRecipes";
import { getStatisticsDataSourceDefinition } from "../statisticsDataSources";
import { getMedicalStatisticsGroup } from "../medicalStatisticsGroups";
import { clearRegionalStatisticsCdnCache, loadRegionalStatisticsValues, type StatisticsRelease } from "../regionalStatisticsLoader";

const complaints = ENVIRONMENT_STATISTICS_RECIPES_BY_KEY.statsComplaintsCounty;
const asRelease = (recipe: typeof complaints, releaseId: string): StatisticsRelease => {
  const option = recipe.release_options.find((candidate) => candidate.release_id === releaseId)!;
  return { release_id: releaseId, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, boundary_version: recipe.boundary_version, period_start: option.period_start, period_end: option.period_end, levels: [recipe.level] } as StatisticsRelease;
};
const publicReleases = (recipe: typeof complaints) => [...new Set(recipe.release_options.map((option) => option.release_id))].map((id) => asRelease(recipe, id));

describe("environment statistics recipes", () => {
  it("registers exactly the 37 delivered layers as enabled Statistics recipes", () => {
    expect(ENVIRONMENT_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.layer_key).sort()).toEqual([...ENVIRONMENT_ENABLED_STATISTICS_KEYS].sort());
    for (const key of ENVIRONMENT_ENABLED_STATISTICS_KEYS) {
      expect(STATISTICS_RECIPES[key].dataset_id).toBe(ENVIRONMENT_STATISTICS_RECIPES_BY_KEY[key].dataset_id);
      // releaseId 不寫死：loader 由 exact whitelist 取最新公開期別。
      expect("releaseId" in STATISTICS_RECIPES[key]).toBe(false);
    }
  });

  it("defaults to the latest period and the delivered total dimension, not alphabetical order", () => {
    const options = environmentReleaseOptions("statsComplaintsCounty", publicReleases(complaints));
    expect(options[0]).toEqual({ releaseId: "2025-complaint_cases-v1-eed49448d474", dimensions: { complaint_type: "total" } });
    expect(STATISTICS_RECIPES.statsComplaintsCounty.dimensions).toEqual({ complaint_type: "total" });
    expect(environmentReleaseOptions("statsComplaintsCounty", [])).toEqual([]);
  });

  it("only exposes observed tuples and refuses unknown dimensions", () => {
    const perFacility = ENVIRONMENT_STATISTICS_RECIPES_BY_KEY.statsEnvInspectionsPerFacilityCounty;
    expect(new Set(perFacility.release_options.map((option) => option.release_id)).size).toBe(1);
    expect(perFacility.release_options.map((option) => option.dimensions.inspection_type)).toHaveLength(5);
    const release = asRelease(perFacility, perFacility.release_options[0]!.release_id);
    expect(resolveEnvironmentRelease(perFacility.layer_key, release, { inspection_type: "construction" })).toBeNull();
    expect(resolveEnvironmentRelease(perFacility.layer_key, release, { inspection_type: "total" })).not.toBeNull();
    expect(resolveEnvironmentRelease("statsAqiPoorRatioCounty", asRelease(ENVIRONMENT_STATISTICS_RECIPES_BY_KEY.statsAqiPoorRatioCounty, ENVIRONMENT_STATISTICS_RECIPES_BY_KEY.statsAqiPoorRatioCounty.default_release_id), { extra: "x" })).toBeNull();
  });

  it("reads tap-water failures as a binary 有／無 with observed 0 in the base class", () => {
    const failures = ENVIRONMENT_STATISTICS_RECIPES_BY_KEY.statsTapWaterFailuresCounty;
    const render = statisticsRenderRecipe("statsTapWaterFailuresCounty");
    expect(render.breaks).toEqual([1]);
    expect(render.colors).toHaveLength(2);
    expect(environmentLegendRows(failures, render.colors)?.map((row) => row.label)).toEqual(["0：無不合格", "大於 0：有不合格"]);
    expect(statisticsRenderRecipe("statsTapWaterFailureRateCounty").breaks[0]).toBeGreaterThan(0);
  });

  it("groups raw and ratio as one toggle with the raw layer first", () => {
    expect(ENVIRONMENT_STATISTICS_TOGGLE_GROUPS).toHaveLength(9);
    const fine = getMedicalStatisticsGroup("statsEnvFineRateCounty");
    expect(fine?.options.map((option) => [option.key, option.label])).toEqual([
      ["statsEnvFineCasesCounty", "原始數"], ["statsEnvFineRateCounty", "裁處率（罰鍰÷稽查）"],
    ]);
    expect(getMedicalStatisticsGroup("statsBodDischargedCounty")?.options.map((option) => option.label)).toEqual(["原始數", "每平方公里"]);
    const pnd = getMedicalStatisticsGroup("statsComplaintsPer10kCounty");
    expect(pnd?.optionLabel).toBe("指標");
    expect(pnd?.options.map((option) => option.key)).toEqual(["statsComplaintCasesPndCounty", "statsComplaintPopulationCounty", "statsComplaintsPer10kCounty"]);
  });

  it("lists every layer in the data-source overview with derived ratios marked as derived", () => {
    for (const recipe of ENVIRONMENT_ENABLED_STATISTICS_RECIPES) {
      const definition = getStatisticsDataSourceDefinition(recipe.layer_key);
      expect(definition?.provider).toBe(recipe.publisher);
      expect(definition?.sourceUrl).toMatch(/^https:\/\//);
      expect(definition?.kind).toBe(recipe.pair_raw_key ? "derived" : "source");
    }
    expect(getStatisticsDataSourceDefinition("statsEnvFineRateCounty")?.disclosure).toContain("可大於 100%");
    expect(getStatisticsDataSourceDefinition("statsResponsibleEnterprisesCounty")?.disclosure).toContain("不是來源統計期");
    expect(getStatisticsDataSourceDefinition("statsMotorTestedCounty")?.disclosure).toContain("車籍縣市");
  });
});

describe("environment statistics production loader", () => {
  const base = "https://cdn.test/statistics/v1";
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const encode = (data: unknown) => new TextEncoder().encode(JSON.stringify(data));
  const [latest, previous] = ["2025-complaint_cases-v1-eed49448d474", "2024-complaint_cases-v1-c53e61597fb4"].map((id) => asRelease(complaints, id));

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
    const geometry = { resource: "geometries/county.geojson", sha256: "0".repeat(64), code_scheme: "area_code", boundary_version: complaints.boundary_version, level: "county" };
    const selectors = [[latest!, "total"], [latest!, "air"], [previous!, "total"]].map(([release, type]) => {
      const rows = [{ area_code: "63000", value: type === "total" ? 10 : 0, status: "observed" }];
      const artifact = put({
        schema_version: "regional-statistics-cdn-v1",
        values: { status: "OK", release, area_level: "county", total: 1, returned: 1, offset: 0, truncated: false, next_offset: null, observations: rows },
        sources: { status: "OK", source: { publisher: "環境部" } }, health: { status: "OK", availability: "CURRENT" }, geometry: { status: "OK", geometry },
      }, "artifacts");
      return { dataset_id: complaints.dataset_id, indicator_id: complaints.indicator_id, release_id: (release as StatisticsRelease).release_id, area_level: "county", dimensions: { complaint_type: type }, artifact };
    });
    const manifest = put({
      schema_version: "regional-statistics-cdn-v1",
      catalog: { status: "OK", indicators: [{ dataset_id: complaints.dataset_id, indicator_id: complaints.indicator_id, name: complaints.label, unit: complaints.unit, levels: ["county"] }] },
      indicators: [{ dataset_id: complaints.dataset_id, indicator_id: complaints.indicator_id, releases: [previous, latest] }],
      selectors, geometries: [geometry],
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

  const recipe = { layerKey: "statsComplaintsCounty", datasetId: complaints.dataset_id, indicatorId: complaints.indicator_id, level: "county" as const, includeHealth: true };

  it("loads the latest public period with the total dimension when no release is selected", async () => {
    const result = await loadRegionalStatisticsValues({ ...recipe, dimensions: { complaint_type: "total" } });
    expect(result.effectiveRecipe).toMatchObject({ releaseId: latest!.release_id, dimensions: { complaint_type: "total" } });
    expect(result.values.observations[0]).toMatchObject({ value: 10, status: "observed" });
  });

  it("keeps an explicitly selected earlier period and an observed 0 dimension as real values", async () => {
    const earlier = await loadRegionalStatisticsValues({ ...recipe, releaseId: previous!.release_id, dimensions: { complaint_type: "total" }, allowReleaseFallback: false });
    expect(earlier.values.release.period_start).toBe("2024-01-01");
    const air = await loadRegionalStatisticsValues({ ...recipe, releaseId: latest!.release_id, dimensions: { complaint_type: "air" }, allowReleaseFallback: false });
    expect(air.values.observations[0]).toMatchObject({ value: 0, status: "observed" });
  });

  it("rejects a tuple outside the delivered whitelist instead of guessing", async () => {
    await expect(loadRegionalStatisticsValues({ ...recipe, releaseId: latest!.release_id, dimensions: { complaint_type: "smoke" }, allowReleaseFallback: false }))
      .rejects.toThrow("白名單");
  });
});
