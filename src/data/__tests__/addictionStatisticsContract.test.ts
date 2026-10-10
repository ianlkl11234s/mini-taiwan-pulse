import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADDICTION_ENABLED_STATISTICS_KEYS, ADDICTION_ENABLED_STATISTICS_RECIPES, ADDICTION_STATISTICS_RECIPES, ADDICTION_STATISTICS_RECIPES_BY_KEY,
  ADDICTION_STATISTICS_TOGGLE_GROUPS, addictionReleaseOptions, addictionStatusLegendRows, resolveAddictionRelease,
} from "../addictionStatisticsRecipes";
import { STATISTICS_RECIPES, statisticsRenderRecipe } from "../regionalStatisticsRecipes";
import { getStatisticsDataSourceDefinition } from "../statisticsDataSources";
import { getMedicalStatisticsGroup } from "../medicalStatisticsGroups";
import { getStatisticsVisual } from "../statisticsVisuals";
import { clearRegionalStatisticsCdnCache, loadRegionalStatistics, loadRegionalStatisticsValues, type StatisticsRelease } from "../regionalStatisticsLoader";

const hiv = ADDICTION_STATISTICS_RECIPES_BY_KEY.statsHivNewCasesCounty;
const asRelease = (recipe: typeof hiv, releaseId: string): StatisticsRelease => {
  const option = recipe.release_options.find((candidate) => candidate.release_id === releaseId)!;
  return { release_id: releaseId, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, boundary_version: recipe.boundary_version, period_start: option.period_start, period_end: option.period_end, levels: [recipe.level] } as StatisticsRelease;
};
const publicReleases = (recipe: typeof hiv) => recipe.release_options.map((option) => asRelease(recipe, option.release_id));

describe("addiction statistics recipes", () => {
  it("registers the 74 enabled recipes (313 selectors) and keeps 第二級毒品／毒防中心 disabled", () => {
    expect(ADDICTION_STATISTICS_RECIPES).toHaveLength(78);
    expect(ADDICTION_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.layer_key)).toEqual([...ADDICTION_ENABLED_STATISTICS_KEYS]);
    expect(ADDICTION_ENABLED_STATISTICS_RECIPES.reduce((sum, recipe) => sum + recipe.release_options.length, 0)).toBe(313);
    expect(ADDICTION_STATISTICS_RECIPES.filter((recipe) => !recipe.enabled).map((recipe) => recipe.layer_key).sort()).toEqual([
      "statsDrugGrade2SuspectsCounty", "statsDrugGrade2SuspectsPer100kCounty", "statsDrugPreventionCentersCounty", "statsDrugPreventionCentersPer100kCounty",
    ]);
    for (const key of ADDICTION_ENABLED_STATISTICS_KEYS) {
      expect(STATISTICS_RECIPES[key].dataset_id).toBe(ADDICTION_STATISTICS_RECIPES_BY_KEY[key].dataset_id);
      expect("releaseId" in STATISTICS_RECIPES[key]).toBe(false);
      expect(STATISTICS_RECIPES[key].dimensions).toEqual({});
    }
    expect(STATISTICS_RECIPES.statsHivCasesTownship.level).toBe("township");
    expect(STATISTICS_RECIPES.statsProsecutorDrugNewCasesDistrict.level).toBe("prosecutor_district");
  });

  it("wires the round-3 prosecutor districts and the corrected service-point releases", () => {
    const district = ADDICTION_STATISTICS_RECIPES_BY_KEY.statsProsecutorDrugNewCasesDistrict;
    expect(district).toMatchObject({ level: "prosecutor_district", boundary_version: "PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1", display_priority: "primary", unit: "人" });
    expect(district.release_options).toHaveLength(5);
    expect(district.disclosure).toContain("地檢署轄區不等於縣市");
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsProsecutorDrugNewCasesCounty.display_priority).toBe("secondary");
    // 改指同期更正版 release（舊 release 仍在 R2 但不在 whitelist）
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsDrugTreatmentFacilitiesCounty.default_release_id).toBe("2026-10-06-drug_treatment_facilities_count-county-v1-d7a263cac9a8");
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsDrugTreatmentFacilitiesCounty.release_options.map((option) => option.release_id)).not.toContain("2026-10-06-drug_treatment_facilities_count-county-v1-61efdcb25807");
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsHivSelftestOutletsPer100kTownship.default_release_id).toBe("2026-10-06-hiv_selftest_outlets_per_100k-township-v1-a5a5658a0b42");
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsNeedleSitesTotalCounty.disclosure).toContain("任一即算 1 處");
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsSubstitutionTreatmentSitesTownship.disclosure).toContain("不含 29 處衛星給藥點");
  });

  it("defaults to the latest delivered period and refuses dimensions or unknown releases", () => {
    const options = addictionReleaseOptions("statsHivNewCasesCounty", publicReleases(hiv));
    expect(options).toHaveLength(23);
    expect(options[0]?.releaseId).toBe(hiv.default_release_id);
    expect(addictionReleaseOptions("statsDrugGrade2SuspectsCounty", [])).toEqual([]);
    const release = asRelease(hiv, hiv.default_release_id);
    expect(resolveAddictionRelease("statsHivNewCasesCounty", release, {})).toEqual({ releaseId: hiv.default_release_id, dimensions: {} });
    expect(resolveAddictionRelease("statsHivNewCasesCounty", release, { sex: "total" })).toBeNull();
    expect(resolveAddictionRelease("statsHivNewCasesCounty", { ...release, release_id: "2025-unknown" }, {})).toBeNull();
  });

  it("puts raw and ratio, county and township in one row per concept", () => {
    expect(ADDICTION_STATISTICS_TOGGLE_GROUPS).toHaveLength(21);
    expect(getMedicalStatisticsGroup("statsNeedleEducationStationsPer100kTownship")?.options.map((option) => option.label)).toEqual([
      "縣市：據點數", "縣市：每 10 萬人", "鄉鎮：據點數", "鄉鎮：每 10 萬人",
    ]);
    expect(getMedicalStatisticsGroup("statsNeedleEducationStationsCounty")?.optionLabel).toBe("地理層級／口徑");
    expect(getMedicalStatisticsGroup("statsHivPer100kCounty")?.options.map((option) => option.key)).toEqual(["statsHivNewCasesCounty", "statsHivPer100kCounty"]);
    // 縣市新通報（gecdb）與鄉鎮確定病例（NIDSS）口徑不同：分兩列，不在同一個選單互換。
    expect(getMedicalStatisticsGroup("statsHivCasesTownship")?.options.map((option) => option.key)).toEqual(["statsHivCasesTownship", "statsHivPer100kYearTownship"]);
    // 地檢署：轄區層（primary）自成一列、排在縣市退化版（secondary，原列不變）前面。
    expect(getMedicalStatisticsGroup("statsProsecutorDeferredTreatmentCounty")?.optionLabel).toBe("指標");
    const district = getMedicalStatisticsGroup("statsProsecutorDrugUseDistrict");
    expect(district?.label).toContain("22 地檢署轄區");
    expect(district?.options.map((option) => option.key)).toEqual([
      "statsProsecutorDrugNewCasesDistrict", "statsProsecutorDrugUseDistrict", "statsProsecutorDrugGrade1District",
      "statsProsecutorDrugGrade2District", "statsProsecutorDeferredTreatmentDistrict",
    ]);
    const groupKeys = ADDICTION_STATISTICS_TOGGLE_GROUPS.map((group) => group.key);
    expect(groupKeys.indexOf("addiction:prosecutorDrugDistrict")).toBeLessThan(groupKeys.indexOf("addiction:prosecutorDrug"));
    expect(getMedicalStatisticsGroup("statsNeedleSitesTotalTownship")?.options.map((option) => option.key)).toEqual([
      "statsNeedleSitesTotalCounty", "statsNeedleSitesTotalPer100kCounty", "statsNeedleSitesTotalTownship", "statsNeedleSitesTotalPer100kTownship",
    ]);
    expect(getMedicalStatisticsGroup("statsAdultSmokingRateCounty")).toBeUndefined();
  });

  it("separates 不適用／無資料／隱私遮蔽 in the legend and never maps them to a value colour", () => {
    expect(addictionStatusLegendRows(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsProsecutorDrugNewCasesCounty)).toEqual([
      { kind: "not_applicable", hatch: "missing", label: expect.stringContaining("不適用") },
    ]);
    expect(addictionStatusLegendRows(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsProsecutorDrugNewCasesDistrict).map((row) => row.kind)).not.toContain("not_applicable");
    expect(addictionStatusLegendRows(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsAdultBetelRateCounty)).toEqual([
      { kind: "missing", hatch: "missing", label: expect.stringContaining("金門、連江") },
    ]);
    expect(addictionStatusLegendRows(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsHivCasesTownship)).toEqual([
      { kind: "suppressed", hatch: "suppressed", label: expect.stringContaining("隱私遮蔽") },
    ]);
  });

  it("gives observed 0 service points the lightest class and keeps fixed, non-binary breaks", () => {
    const points = statisticsRenderRecipe("statsNeedleEducationStationsTownship");
    expect(points.breaks[0]).toBeGreaterThan(0);
    expect(points.colors).toHaveLength(points.breaks.length + 1);
    expect(ADDICTION_STATISTICS_RECIPES_BY_KEY.statsNeedleEducationStationsTownship.legend.zero_note).toContain("0 處");
    for (const recipe of ADDICTION_ENABLED_STATISTICS_RECIPES) {
      expect(recipe.legend.breaks).not.toEqual([0]);
      expect(recipe.legend.breaks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses the health palette for disease, surveys and services and the existing security palette for enforcement", () => {
    expect(getStatisticsVisual("statsHivNewCasesCounty").theme).toBe("醫療");
    expect(getStatisticsVisual("statsSmokingCessationProvidersPer100kTownship").theme).toBe("醫療");
    expect(getStatisticsVisual("statsAdultBetelRateCounty").theme).toBe("醫療");
    expect(getStatisticsVisual("statsDrugSuspectsCounty").theme).toBe("治安");
    expect(getStatisticsVisual("statsDuiEnforcementPer100kCounty").theme).toBe("治安");
    expect(getStatisticsVisual("statsProsecutorDrugUseCounty").theme).toBe("治安");
    expect(getStatisticsVisual("statsProsecutorDrugUseDistrict").theme).toBe("治安");
    expect(getStatisticsVisual("statsNeedleSitesTotalPer100kTownship").theme).toBe("醫療");
    expect(getStatisticsVisual("statsSubstitutionTreatmentSitesCounty").theme).toBe("醫療");
    expect(getStatisticsVisual("statsDrugSuspectsCounty").theme).toBe(getStatisticsVisual("statsDrugSuspectsPer100kCounty").theme);
  });

  it("states location semantics and comparability limits in every source card", () => {
    for (const recipe of ADDICTION_ENABLED_STATISTICS_RECIPES) {
      const definition = getStatisticsDataSourceDefinition(recipe.layer_key);
      expect(definition?.provider).toBe(recipe.publisher);
      expect(definition?.sourceUrl).toMatch(/^https:\/\//);
      expect(definition?.license).toBe(recipe.license);
      expect(definition?.kind).toBe(recipe.derived ? "derived" : "source");
    }
    expect(getStatisticsDataSourceDefinition("statsDrugSuspectsCounty")?.disclosure).toContain("查獲（受理）警察機關所在縣市");
    expect(getStatisticsDataSourceDefinition("statsHivCasesTownship")?.disclosure).toContain("不可並列比較");
    expect(getStatisticsDataSourceDefinition("statsHivNewCasesCounty")?.disclosure).toContain("不可並列比較");
    expect(getStatisticsDataSourceDefinition("statsAdultSmokingRateCounty")?.disclosure).toContain("抽樣");
    expect(getStatisticsDataSourceDefinition("statsPrepServiceSitesPer100kTownship")?.disclosure).toContain("與名冊快照日（2026-10-06）不同");
    expect(getStatisticsDataSourceDefinition("statsProsecutorDrugNewCasesCounty")?.disclosure).toContain("不適用");
    // 來源自帶的酒駕犯罪率不是本專案衍生值。
    expect(getStatisticsDataSourceDefinition("statsDuiRateCounty")?.kind).toBe("source");
    expect(getStatisticsDataSourceDefinition("statsDrugTreatmentFacilitiesCounty")?.label).toContain("本專案減害點位圖層");
  });
});

describe("addiction statistics production loader", () => {
  const base = "https://cdn.test/statistics/v1";
  const prosecutor = ADDICTION_STATISTICS_RECIPES_BY_KEY.statsProsecutorDrugNewCasesCounty;
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const encode = (data: unknown) => new TextEncoder().encode(JSON.stringify(data));
  const release = asRelease(prosecutor, prosecutor.default_release_id);

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
      { type: "Feature", properties: { area_code: "66000" }, geometry: { type: "Polygon", coordinates: [[[120, 24], [120.1, 24], [120.1, 24.1], [120, 24]]] } },
    ] }, "geometries");
    const geometry = { resource: boundary.path, sha256: boundary.sha256, bytes: boundary.bytes, code_scheme: "area_code", boundary_version: prosecutor.boundary_version, level: "county" };
    const rows = [
      { area_code: "63000", value: null, status: "not_applicable" },
      { area_code: "66000", value: 812, status: "observed" },
    ];
    const artifact = put({
      schema_version: "regional-statistics-cdn-v1",
      values: { status: "OK", release, area_level: "county", total: 2, returned: 2, offset: 0, truncated: false, next_offset: null, observations: rows },
      sources: { status: "OK", source: { publisher: "法務部" } }, health: { status: "OK", availability: "CURRENT" }, geometry: { status: "OK", geometry },
    }, "artifacts");
    const manifest = put({
      schema_version: "regional-statistics-cdn-v1",
      catalog: { status: "OK", indicators: [{ dataset_id: prosecutor.dataset_id, indicator_id: prosecutor.indicator_id, name: prosecutor.label, unit: prosecutor.unit, levels: ["county"] }] },
      indicators: [{ dataset_id: prosecutor.dataset_id, indicator_id: prosecutor.indicator_id, releases: [release] }],
      selectors: [{ dataset_id: prosecutor.dataset_id, indicator_id: prosecutor.indicator_id, release_id: release.release_id, area_level: "county", dimensions: {}, artifact }],
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

  const recipe = { layerKey: "statsProsecutorDrugNewCasesCounty", datasetId: prosecutor.dataset_id, indicatorId: prosecutor.indicator_id, level: "county" as const, includeHealth: true };

  it("loads the deterministic default release and keeps not_applicable as null, not 0", async () => {
    const result = await loadRegionalStatisticsValues(recipe);
    expect(result.effectiveRecipe).toMatchObject({ releaseId: prosecutor.default_release_id, dimensions: {} });
    expect(result.values.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "63000", value: null, status: "not_applicable" }),
      expect.objectContaining({ area_code: "66000", value: 812, status: "observed" }),
    ]));
  });

  it("renders features with addiction disclosure and leaves not_applicable without a value", async () => {
    const result = await loadRegionalStatistics(recipe);
    const taipei = result.features.find((feature) => feature.properties?.area_code === "63000");
    expect(taipei?.properties).toMatchObject({ value: null, status: "not_applicable" });
    expect(String(taipei?.properties?.disclosure)).toContain("不適用");
  });

  it("rejects a release outside the delivered whitelist", async () => {
    await expect(loadRegionalStatisticsValues({ ...recipe, releaseId: "2026-unknown", allowReleaseFallback: false })).rejects.toThrow();
  });
});
