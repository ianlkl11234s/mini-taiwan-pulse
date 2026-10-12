import { describe, expect, it } from "vitest";
import {
  ATLAS_ENABLED_STATISTICS_KEYS, ATLAS_ENABLED_STATISTICS_RECIPES, ATLAS_STATISTICS_TOGGLE_GROUPS,
  atlasDefaultDimensions, atlasReleaseOptions, atlasRenderScale, atlasScaleNote, getAtlasRecipe, resolveAtlasRelease,
} from "../atlasStatisticsRecipes";
import { STATISTICS_RECIPES, statisticsRenderRecipe } from "../regionalStatisticsRecipes";
import { statisticsDimensionValueLabel } from "../statisticsLabels";
import { statisticsLinkedSelects } from "../statisticsParamsSpec";
import { getStatisticsDataSourceDefinition } from "../statisticsDataSources";
import { LAYER_MANIFEST } from "../layerManifest";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

/** 交付白名單轉成「已公開 release」：每個 release_id 一筆（含所有維度組合）。 */
function publishedReleases(key: string): StatisticsRelease[] {
  const recipe = getAtlasRecipe(key)!;
  const seen = new Map<string, StatisticsRelease>();
  for (const option of recipe.release_options) {
    seen.set(option.release_id, {
      release_id: option.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id,
      period_start: option.period_start, period_end: option.period_end, boundary_version: recipe.boundary_version, levels: [recipe.level],
    } as StatisticsRelease);
  }
  return [...seen.values()];
}

describe("atlas 批次統計契約", () => {
  it("66 個 recipe、2,278 個 exact selector，key 不重複且都有 manifest 與資料來源卡", () => {
    expect(ATLAS_ENABLED_STATISTICS_KEYS).toHaveLength(66);
    expect(new Set(ATLAS_ENABLED_STATISTICS_KEYS).size).toBe(66);
    expect(ATLAS_ENABLED_STATISTICS_RECIPES.reduce((sum, recipe) => sum + recipe.release_options.length, 0)).toBe(2278);
    for (const key of ATLAS_ENABLED_STATISTICS_KEYS) {
      expect(LAYER_MANIFEST[key].legend, key).toBe(key);
      expect(getStatisticsDataSourceDefinition(key)?.datasetIds, key).toEqual([getAtlasRecipe(key)!.dataset_id]);
    }
  });

  it("loader 第一個選項＝最新期別＋layer-plan 預設維度", () => {
    const defaults: Record<string, Record<string, string>> = {
      statsHealthCancerIncidenceAsr: { sex: "all", site: "all_sites" },
      statsHealthImmunizationCompletion: { vaccine: "mmr_1" },
      statsHealthMentalOutpatientPer1000: { disease: "all_mental" },
      statsHealthHospitalAlos: { bed_type: "general_total" },
      statsHealthLowBirthWeightRate: { sex: "all" },
      statsEinvoiceAvgTicket: { industry: "便利商店" },
    };
    for (const recipe of ATLAS_ENABLED_STATISTICS_RECIPES) {
      const first = atlasReleaseOptions(recipe.layer_key, publishedReleases(recipe.layer_key))[0]!;
      const latest = recipe.release_options.reduce((max, option) => option.period_end > max ? option.period_end : max, "");
      expect(recipe.release_options.find((option) => option.release_id === first.releaseId)!.period_end, recipe.layer_key).toBe(latest);
      expect(first.dimensions, recipe.layer_key).toEqual(atlasDefaultDimensions(recipe));
      expect(STATISTICS_RECIPES[recipe.layer_key as keyof typeof STATISTICS_RECIPES].dimensions).toEqual(atlasDefaultDimensions(recipe));
      if (defaults[recipe.layer_key]) expect(atlasDefaultDimensions(recipe)).toEqual(defaults[recipe.layer_key]);
    }
  });

  it("拒絕不完整維度與猜測的 release", () => {
    const key = "statsHealthCancerIncidenceAsr";
    const option = getAtlasRecipe(key)!.release_options[0]!;
    const release = { release_id: option.release_id, period_start: option.period_start, period_end: option.period_end };
    expect(resolveAtlasRelease(key, release, option.dimensions)).toEqual({ releaseId: option.release_id, dimensions: option.dimensions });
    expect(resolveAtlasRelease(key, release, { sex: option.dimensions.sex })).toBeNull();
    expect(resolveAtlasRelease(key, { ...release, release_id: "guess" }, option.dimensions)).toBeNull();
  });

  it("連動選單：期別在前，接著 recipe 宣告的維度", () => {
    expect(statisticsLinkedSelects("statsHealthCancerIncidenceAsr").filter((spec) => spec.provider === "statistics").map((spec) => spec.field)).toEqual(["release", "dim:sex", "dim:site"]);
    expect(statisticsLinkedSelects("statsFiscalLocalRevenue").filter((spec) => spec.provider === "statistics").map((spec) => spec.field)).toEqual(["release"]);
    expect(statisticsDimensionValueLabel("site", "lung", "cancer_incidence_county")).toBe("肺、支氣管及氣管");
    expect(statisticsDimensionValueLabel("sex", "all", "cancer_incidence_county")).toBe("全部");
    expect(statisticsDimensionValueLabel("vaccine", "mmr_1", "immunization_coverage_county")).toBe("麻疹腮腺炎德國麻疹混合疫苗第一劑");
  });

  it("每個會出現的非數值狀態都有圖例文字；門檻嚴格遞增且不是 [0]", () => {
    for (const recipe of ATLAS_ENABLED_STATISTICS_RECIPES) {
      const scales = [recipe.legend.breaks, ...Object.values(recipe.legend.by_dimension ?? {}).map((scale) => scale.breaks)];
      for (const breaks of scales) {
        expect(breaks, recipe.layer_key).not.toEqual([0]);
        expect(breaks.length, recipe.layer_key).toBeGreaterThanOrEqual(2);
        expect([...breaks].sort((a, b) => a - b), recipe.layer_key).toEqual(breaks);
        expect(new Set(breaks).size, recipe.layer_key).toBe(breaks.length);
      }
    }
    expect(getAtlasRecipe("statsDebrisFlowAlertStreamsCounty")!.status_labels.not_applicable).toContain("無土石流潛勢溪流");
    expect(getAtlasRecipe("statsCetaceanStrandedCounty")!.status_labels.not_applicable).toContain("非臨海縣市");
    expect(getAtlasRecipe("statsIndigenousReservedLandArea")!.status_labels.not_applicable).toContain("無原住民保留地");
    expect(getAtlasRecipe("statsHealthHospitalAlos")!.status_labels.not_applicable).toContain("無此類病床");
    expect(getAtlasRecipe("statsEinvoiceAvgTicket")!.status_labels.suppressed).toContain("少於 5 家");
  });

  it("社會脆弱度：綜合與暴露量越高越深，三個能力構面反轉；子指標依正負號", () => {
    const direction = (key: string) => getAtlasRecipe(key)!.legend.direction;
    expect(direction("statsSocialVulnerabilityCompositeCounty")).toBe("ascending");
    expect(direction("statsSocialVulnerabilityExposureCounty")).toBe("ascending");
    for (const key of ["statsSocialVulnerabilityMitigationCounty", "statsSocialVulnerabilityResponseCounty", "statsSocialVulnerabilityRecoveryCounty"]) {
      expect(direction(key)).toBe("descending");
      expect(atlasScaleNote(key)).toContain("能力較弱");
      const recipe = statisticsRenderRecipe(key as keyof typeof STATISTICS_RECIPES);
      // 反轉：最低一級（值最小）是最深色
      const ascending = statisticsRenderRecipe("statsSocialVulnerabilityCompositeCounty").colors;
      expect(recipe.colors[0]).toBe(ascending[ascending.length - 1]);
    }
    const sub = "statsSocialVulnerabilitySubindicatorCounty";
    expect(atlasRenderScale(sub, { sub_indicator: "si05" })?.direction).toBe("ascending");
    expect(atlasRenderScale(sub, { sub_indicator: "si11" })?.direction).toBe("descending");
  });

  it("量級不同的維度組合各用一組固定門檻（map 與圖例同一來源）", () => {
    const key = "statsHealthCancerIncidenceAsr";
    expect(statisticsRenderRecipe(key).breaks).toEqual([250, 300, 350, 400]);
    const thyroid = statisticsRenderRecipe(key, undefined, { sex: "all", site: "thyroid" });
    expect(thyroid.breaks).toEqual(atlasRenderScale(key, { sex: "all", site: "thyroid" })!.breaks);
    expect(Math.max(...thyroid.breaks)).toBeLessThan(50);
  });

  it("原始數在群組第一個（群組列只在第一個成員渲染）", () => {
    const group = (key: string) => ATLAS_STATISTICS_TOGGLE_GROUPS.find((candidate) => candidate.key === key)!.options.map((option) => option.key);
    expect(group("atlas:health:tbNewCases")[0]).toBe("statsHealthTbNewCases");
    expect(group("atlas:sports:sportsBudget")).toEqual(["statsSportsBudgetTotal", "statsSportsBudgetPerCapita"]);
    expect(group("atlas:marine:seaTurtleStranded")[0]).toBe("statsSeaTurtleStrandedCounty");
  });
});
