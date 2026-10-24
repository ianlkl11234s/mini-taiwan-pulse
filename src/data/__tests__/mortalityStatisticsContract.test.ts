import { beforeAll, describe, expect, it } from "vitest";
import { ensureStatisticsRecipeDetails } from "../statisticsRecipeDetails";
import { ATLAS_STATISTICS_TOGGLE_GROUPS, atlasDefaultReleaseOption, atlasReleaseOptions, atlasRenderScale, getAtlasRecipe, atlasRecipeReleaseOptions } from "../atlasStatisticsRecipes";
import { MORTALITY_ENABLED_STATISTICS_KEYS } from "../mortalityStatisticsRecipes";
import { STATISTICS_CHOROPLETH_KEYS } from "../statisticsLayerRegistry";
import { LAYER_MANIFEST } from "../layerManifest";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

// 死因統計的 exact selector 按需載入（statisticsRecipeDetails）。
beforeAll(() => ensureStatisticsRecipeDetails("mortality"));

function publishedReleases(key: string): StatisticsRelease[] {
  const recipe = getAtlasRecipe(key)!;
  const unique = new Map(atlasRecipeReleaseOptions(recipe).map((option) => [option.release_id, option]));
  return [...unique.values()].map((option) => ({
    release_id: option.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id,
    period_start: option.period_start, period_end: option.period_end, boundary_version: recipe.boundary_version, levels: [recipe.level],
  }) as StatisticsRelease);
}

describe("死因統計（G20）契約", () => {
  it("6 層＝鄉鎮 4（5 年率／5 年人數／逐年率／逐年人數）＋縣市 2，3,863 個 exact selector，同一群組", () => {
    expect(MORTALITY_ENABLED_STATISTICS_KEYS).toHaveLength(6);
    const recipes = MORTALITY_ENABLED_STATISTICS_KEYS.map((key) => getAtlasRecipe(key)!);
    expect(recipes.reduce((sum, recipe) => sum + atlasRecipeReleaseOptions(recipe).length, 0)).toBe(3863);
    expect(recipes.map((recipe) => recipe.level)).toEqual(["township", "township", "township", "township", "county", "county"]);
    for (const recipe of recipes) {
      expect(STATISTICS_CHOROPLETH_KEYS as readonly string[]).toContain(recipe.layer_key);
      expect(LAYER_MANIFEST[recipe.layer_key as keyof typeof LAYER_MANIFEST]?.section?.theme).toBe("疾病與健康統計 Disease & Health Statistics");
      expect(recipe.tab_theme).toBe("醫療與長照 Health & Care");
      expect(recipe.subgroup).toBe("死因統計");
    }
    const group = ATLAS_STATISTICS_TOGGLE_GROUPS.find((candidate) => candidate.key === "atlas:mortality:mortalityCause")!;
    expect(group.options.map((option) => option.key)).toEqual([...MORTALITY_ENABLED_STATISTICS_KEYS]);
    expect(group.optionLabel).toBe("地理層級／口徑");
  });

  it("預設：鄉鎮 110–114 年 5 年平均粗死亡率、全死因", () => {
    const key = "statsMortalityCauseTownship";
    const recipe = getAtlasRecipe(key)!;
    const first = atlasDefaultReleaseOption(key, atlasReleaseOptions(key, publishedReleases(key)))!;
    expect(first.releaseId).toBe(recipe.default_release_id);
    const option = atlasRecipeReleaseOptions(recipe).find((candidate) => candidate.release_id === first.releaseId)!;
    expect([option.period_start, option.period_end]).toEqual(["2021-01-01", "2025-12-31"]);
    expect(first.dimensions).toEqual({ cause: "all" });
  });

  it("死因 43 值（全死因＋42 類）；人數另有性別；率沒有性別", () => {
    for (const key of MORTALITY_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const cause = recipe.dimensions.find((dimension) => dimension.key === "cause")!;
      expect(cause.options, key).toHaveLength(43);
      expect(cause.default).toBe("all");
      expect(cause.options.find((option) => option.value === "38")?.label).toContain("COVID-19");
      const sex = recipe.dimensions.find((dimension) => dimension.key === "sex");
      if (recipe.unit === "人") expect(sex?.options.map((option) => option.value), key).toEqual(["all", "female", "male"]);
      else expect(sex, key).toBeUndefined();
    }
  });

  it("不遮蔽；0 是真值；不適用（COVID-19 108 年以前）與無資料（分母缺）分開標示；圖例必寫出典、粗率、波動、分母", () => {
    for (const key of MORTALITY_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      expect(recipe.status_labels.suppressed, key).toBeUndefined();
      expect(recipe.legend.zero_note, key).toContain("不是無資料");
      const notes = recipe.legend.notes!.join("");
      expect(notes, key).toContain("衛生福利部統計處");
      expect(notes, key).toContain("政府資料開放授權條款");
      expect(notes, key).toContain("0 為該期無死亡");
      if (recipe.unit !== "人") {
        expect(notes, key).toContain("未做年齡標準化");
        expect(notes, key).toContain("12 月底戶籍人口");
      }
    }
    expect(getAtlasRecipe("statsMortalityRateTownship")!.status_labels.missing).toContain("分母");
    expect(getAtlasRecipe("statsMortalityRateTownship")!.legend.notes!.join("")).toContain("小鄉鎮");
    expect(getAtlasRecipe("statsMortalityDeathsTownship")!.legend.notes!.join("")).toContain("小鄉鎮");
    expect(getAtlasRecipe("statsMortalityCauseCounty")!.status_labels.not_applicable).toContain("COVID-19");
  });

  it("每個非預設（死因[, 性別]）組合都有自己的固定門檻", () => {
    for (const key of MORTALITY_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const tuples = new Set(atlasRecipeReleaseOptions(recipe).map((option) => recipe.dimensions.map((dimension) => option.dimensions[dimension.key]).join("|")));
      const defaultTuple = recipe.dimensions.map((dimension) => dimension.default).join("|");
      for (const tuple of tuples) {
        if (tuple === defaultTuple) continue;
        expect(recipe.legend.by_dimension?.[tuple], `${key} ${tuple}`).toBeDefined();
      }
      const lung = atlasRenderScale(key, Object.fromEntries(recipe.dimensions.map((dimension) => [dimension.key, dimension.key === "cause" ? "06" : dimension.default])));
      expect(lung!.breaks, key).not.toEqual(recipe.legend.breaks);
    }
  });
});
