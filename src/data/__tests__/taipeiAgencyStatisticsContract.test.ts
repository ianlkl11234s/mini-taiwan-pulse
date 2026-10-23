import { beforeAll, describe, expect, it } from "vitest";
import { ensureStatisticsRecipeDetails } from "../statisticsRecipeDetails";
import { ATLAS_STATISTICS_TOGGLE_GROUPS, atlasDefaultReleaseOption, atlasReleaseOptions, atlasRenderScale, getAtlasRecipe, resolveAtlasRelease, atlasRecipeReleaseOptions } from "../atlasStatisticsRecipes";
import { TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS } from "../taipeiAgencyStatisticsRecipes";
import { statisticsLinkedSelects } from "../statisticsParamsSpec";
import { STATISTICS_CHOROPLETH_KEYS } from "../statisticsLayerRegistry";
import { LAYER_MANIFEST } from "../layerManifest";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

// 臺北市局處統計的 exact selector 按需載入（statisticsRecipeDetails）；其他 atlas 家族在目錄內。
beforeAll(() => ensureStatisticsRecipeDetails("taipeiAgency"));

const DATASETS = [
  "resource_recycling_township_taipei_monthly", "garbage_clearance_township_taipei_monthly", "sewer_connection_township_taipei_monthly",
  "factory_count_township_taipei_monthly", "building_usage_permits_township_taipei_monthly",
];

function publishedReleases(key: string): StatisticsRelease[] {
  const recipe = getAtlasRecipe(key)!;
  const unique = new Map(atlasRecipeReleaseOptions(recipe).map((option) => [option.release_id, option]));
  return [...unique.values()].map((option) => ({
    release_id: option.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id,
    period_start: option.period_start, period_end: option.period_end, boundary_version: recipe.boundary_version, levels: [recipe.level],
  }) as StatisticsRelease);
}

describe("臺北市局處統計契約", () => {
  it("11 層＝5 個鄉鎮 dataset、9,696 個 exact selector；全是鄉鎮層 choropleth，公車縣市層不上圖", () => {
    expect(TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS).toHaveLength(11);
    const recipes = TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS.map((key) => getAtlasRecipe(key)!);
    expect(new Set(recipes.map((recipe) => recipe.dataset_id))).toEqual(new Set(DATASETS));
    expect(recipes.reduce((sum, recipe) => sum + atlasRecipeReleaseOptions(recipe).length, 0)).toBe(9696);
    for (const recipe of recipes) {
      expect(recipe.level, recipe.layer_key).toBe("township");
      expect(recipe.boundary_version, recipe.layer_key).toBe("TOWN_MOI_1140318");
      expect(STATISTICS_CHOROPLETH_KEYS as readonly string[]).toContain(recipe.layer_key);
      expect(LAYER_MANIFEST[recipe.layer_key as keyof typeof LAYER_MANIFEST]?.section?.theme).toBe(recipe.data_theme);
      // 分類位置：不自成一類，併入各自縣市版所在主題
      expect(recipe.data_theme, recipe.layer_key).not.toMatch(/臺北市局處/);
      expect(recipe.subgroup, recipe.layer_key).toBe("臺北市 12 區（月）");
    }
    expect(recipes.some((recipe) => recipe.dataset_id.startsWith("bus_"))).toBe(false);
  });

  it("只涵蓋臺北市 12 區：圖例第一行與缺值列都講「未涵蓋」，不畫成 0", () => {
    for (const key of TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      expect(recipe.legend.notes![0], key).toBe("只涵蓋臺北市 12 區；其他縣市鄉鎮為未涵蓋，不是 0。");
      expect(recipe.status_labels.missing, key).toMatch(/^未涵蓋/);
      expect(recipe.status_labels.missing, key).toContain("不是 0");
      expect(recipe.status_labels.suppressed, key).toBeUndefined();
      expect(recipe.disclosure, key).toContain("僅涵蓋臺北市 12 區");
    }
  });

  it("disclosure：12 區垃圾加總≠全市、污水口徑斷點與縣市版不同、使照逐張計＋建築面積非樓地板、工廠「-」＝0", () => {
    const notes = (key: string) => getAtlasRecipe(key)!.legend.notes!.join("");
    expect(notes("statsTaipeiGarbageCollectedTownship")).toContain("12 區加總不等於全市清運量");
    for (const key of ["statsTaipeiSewerRatePublicTownship", "statsTaipeiSewerRateLegacyTownship"]) {
      expect(notes(key), key).toContain("108 年 5 月起公式與分類改變");
      expect(notes(key), key).toContain("82.8%");
    }
    expect(getAtlasRecipe("statsTaipeiSewerRatePublicTownship")!.indicator_id).toMatch(/_from_10805$/);
    expect(getAtlasRecipe("statsTaipeiSewerRateLegacyTownship")!.indicator_id).toMatch(/_to_10804$/);
    for (const key of TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS.filter((candidate) => candidate.startsWith("statsTaipeiUsagePermit"))) {
      expect(notes(key), key).toContain("比主計處年表多 6～21%");
    }
    expect(notes("statsTaipeiUsagePermitBuildingAreaTownship")).toContain("不是總樓地板面積");
    expect(notes("statsTaipeiFactoryCountByIndustryTownship")).toContain("記為 0 家");
    expect(notes("statsTaipeiFactoryCountTownship")).toContain("缺 12 個月");
  });

  it("色階：固定門檻、淺→深＝低→高；污水普及率兩口徑共用 70／80／85／90 %", () => {
    for (const key of TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS) {
      const scale = atlasRenderScale(key)!;
      expect(scale.direction, key).toBe("ascending");
      expect(scale.breaks.length, key).toBeLessThanOrEqual(4);
    }
    expect(atlasRenderScale("statsTaipeiSewerRatePublicTownship")!.breaks).toEqual([70, 80, 85, 90]);
    expect(atlasRenderScale("statsTaipeiSewerRateLegacyTownship")!.breaks).toEqual([70, 80, 85, 90]);
  });

  it("月份不是使用者維度：只有「資料期別」＋（產業別、建造類別）一個維度；預設＝最新月、產業 26、建造類別新建", () => {
    const fields = (key: string) => statisticsLinkedSelects(key).map((spec) => spec.field).filter((field) => field === "release" || field.startsWith("dim:"));
    expect(fields("statsTaipeiGarbageCollectedTownship")).toEqual(["release"]);
    expect(fields("statsTaipeiFactoryCountByIndustryTownship")).toEqual(["release", "dim:industry_code"]);
    expect(fields("statsTaipeiUsagePermitCountByBuildTypeTownship")).toEqual(["release", "dim:build_type"]);
    for (const key of TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const options = atlasReleaseOptions(key, publishedReleases(key));
      const chosen = atlasDefaultReleaseOption(key, options)!;
      expect(chosen.releaseId, key).toBe(recipe.default_release_id);
      expect(chosen, key).toEqual(options[0]);
      const latest = atlasRecipeReleaseOptions(recipe).reduce((max, option) => (option.period_end > max ? option.period_end : max), "");
      expect(atlasRecipeReleaseOptions(recipe).find((option) => option.release_id === chosen.releaseId)!.period_end, key).toBe(latest);
    }
    expect(atlasDefaultReleaseOption("statsTaipeiFactoryCountByIndustryTownship", atlasReleaseOptions("statsTaipeiFactoryCountByIndustryTownship", publishedReleases("statsTaipeiFactoryCountByIndustryTownship")))!.dimensions.industry_code).toBe("26");
    expect(atlasDefaultReleaseOption("statsTaipeiUsagePermitCountByBuildTypeTownship", atlasReleaseOptions("statsTaipeiUsagePermitCountByBuildTypeTownship", publishedReleases("statsTaipeiUsagePermitCountByBuildTypeTownship")))!.dimensions.build_type).toBe("新建");
  });

  it("exact selector 帶 roc_year／month（CDN selector 身分）：切期別時以 option 自己的 dims 解析", () => {
    const recipe = getAtlasRecipe("statsTaipeiResourceRecyclingTownship")!;
    const option = atlasRecipeReleaseOptions(recipe)[0]!;
    expect(Object.keys(option.dimensions).sort()).toEqual(["month", "roc_year"]);
    expect(resolveAtlasRelease(recipe.layer_key, option, option.dimensions)).toEqual({ releaseId: option.release_id, dimensions: option.dimensions });
    expect(resolveAtlasRelease(recipe.layer_key, option, {})).toBeNull();
  });

  it("群組：污水普及率兩口徑一列、工廠合計／產業別一列、使用執照五指標一列", () => {
    const group = (name: string) => ATLAS_STATISTICS_TOGGLE_GROUPS.find((candidate) => candidate.key === `atlas:taipeiAgency:${name}`);
    expect(group("taipeiSewerRate")!.options.map((option) => option.key)).toEqual(["statsTaipeiSewerRatePublicTownship", "statsTaipeiSewerRateLegacyTownship"]);
    expect(group("taipeiFactoryCount")!.options).toHaveLength(2);
    expect(group("taipeiUsagePermit")!.options.map((option) => option.label)).toEqual(["件數（合計）", "件數（依建造類別）", "棟數", "戶數", "建築面積"]);
    expect(group("taipeiResourceRecycling")).toBeUndefined();
  });
});
