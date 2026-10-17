import { describe, expect, it } from "vitest";
import {
  ATLAS_ENABLED_STATISTICS_RECIPES, ATLAS_STATISTICS_TOGGLE_GROUPS, atlasDefaultReleaseOption, atlasPartialPeriod, atlasReleaseOptions,
  atlasSelectionRecipe, getAtlasRecipe,
} from "../atlasStatisticsRecipes";
import { CRIME_ENABLED_STATISTICS_KEYS } from "../crimeStatisticsRecipes";
import { statisticsPeriodLabel } from "../statisticsLabels";
import { LAYER_MANIFEST } from "../layerManifest";
import { STATISTICS_CHOROPLETH_KEYS } from "../statisticsLayerRegistry";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

function publishedReleases(key: string): StatisticsRelease[] {
  const recipe = getAtlasRecipe(key)!;
  return recipe.release_options.map((option) => ({
    release_id: option.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id,
    period_start: option.period_start, period_end: option.period_end, boundary_version: recipe.boundary_version, levels: [recipe.level],
  }) as StatisticsRelease);
}

describe("治安統計（G17）契約", () => {
  it("36 層＝9 案類 × 鄉鎮／縣市 × 件數／每十萬人，386 個 exact selector；舊 crimeAreaMonthly 已移除", () => {
    expect(CRIME_ENABLED_STATISTICS_KEYS).toHaveLength(36);
    const recipes = CRIME_ENABLED_STATISTICS_KEYS.map((key) => getAtlasRecipe(key)!);
    expect(recipes.reduce((sum, recipe) => sum + recipe.release_options.length, 0)).toBe(386);
    expect(new Set(recipes.map((recipe) => recipe.dataset_id))).toEqual(new Set(["crime_township_annual", "crime_county_annual", "telecom_fraud_township_annual", "telecom_fraud_county_annual"]));
    expect("crimeAreaMonthly" in LAYER_MANIFEST).toBe(false);
    expect(STATISTICS_CHOROPLETH_KEYS as readonly string[]).not.toContain("crimeAreaMonthly");
  });

  it("預設期別＝最新全年（2025），不是排第一的 2026 年 1–6 月部分期別", () => {
    for (const key of CRIME_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const options = atlasReleaseOptions(key, publishedReleases(key));
      const chosen = atlasDefaultReleaseOption(key, options)!;
      const option = recipe.release_options.find((candidate) => candidate.release_id === chosen.releaseId)!;
      expect([option.period_start, option.period_end], key).toEqual(["2025-01-01", "2025-12-31"]);
      expect(atlasSelectionRecipe(key)!.release_options[0]!.release_id, key).toBe(chosen.releaseId);
    }
  });

  it("其他 atlas 家族的預設期別不變（default_release_id 即最新期別）", () => {
    for (const recipe of ATLAS_ENABLED_STATISTICS_RECIPES.filter((candidate) => candidate.family !== "crime")) {
      const options = atlasReleaseOptions(recipe.layer_key, publishedReleases(recipe.layer_key));
      expect(atlasDefaultReleaseOption(recipe.layer_key, options), recipe.layer_key).toEqual(options[0]);
    }
  });

  it("部分期別只出現在件數層，標「部分期別」；比率層全為全年", () => {
    for (const key of CRIME_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const partial = recipe.release_options.filter((option) => option.partial_period_label);
      if (key.includes("Per100k")) expect(partial, key).toEqual([]);
      else expect(partial.map((option) => option.period_start), key).toContain("2026-01-01");
    }
    const h1 = getAtlasRecipe("statsTelecomFraudCasesTownship")!.release_options.find((option) => option.period_start === "2026-01-01")!;
    expect(statisticsPeriodLabel(h1)).toBe("2026 年 1–6 月（部分期別）");
    const q4 = getAtlasRecipe("statsTelecomFraudCasesTownship")!.release_options.find((option) => option.period_start === "2018-10-01")!;
    expect(atlasPartialPeriod(q4)).toEqual({ year: "2018", from: "10", to: "12" });
    const full = getAtlasRecipe("statsTelecomFraudCasesTownship")!.release_options.find((option) => option.period_start === "2025-01-01")!;
    expect(statisticsPeriodLabel(full)).toBe("2025 年");
  });

  it("圖例：人口分母＝戶籍人口、初步統計（查獲地只在毒品層）；電信詐欺註明 113Q3 跳 7 倍；不用排名字眼、不遮蔽", () => {
    for (const key of CRIME_ENABLED_STATISTICS_KEYS) {
      const recipe = getAtlasRecipe(key)!;
      const notes = recipe.legend.notes ?? [];
      expect(notes[0], key).toMatch(/^人口分母＝戶籍人口/);
      expect(notes.join(""), key).toContain("初步統計");
      // 「查獲地」只屬於毒品：其他案類的圖例說明、資料限制、位置口徑都不得出現；毒品層圖例只出現一次（不重複）。
      const text = [...notes, recipe.disclosure, recipe.location_semantics];
      if (key.startsWith("statsCrimeDrug")) expect(notes.filter((note) => note.includes("查獲地")), key).toHaveLength(1);
      else expect(text.join(""), key).not.toContain("查獲地");
      expect(recipe.location_semantics, key).not.toContain("查獲地");
      expect(new Set([...notes, recipe.location_semantics]).size, key).toBe(notes.length + 1);
      expect(JSON.stringify(recipe), key).not.toMatch(/最危險|最安全/);
      expect(recipe.status_labels.suppressed, key).toBeUndefined();
    }
    for (const key of CRIME_ENABLED_STATISTICS_KEYS.filter((candidate) => candidate.startsWith("statsTelecomFraud"))) {
      expect(getAtlasRecipe(key)!.legend.notes!.join(""), key).toContain("7 倍");
      expect(getAtlasRecipe(key)!.location_semantics, key).toContain("來源未說明是受騙地或報案地");
    }
  });

  it("每個案類一列，四個選項（鄉鎮件數在前）", () => {
    const groups = ATLAS_STATISTICS_TOGGLE_GROUPS.filter((group) => group.key.startsWith("atlas:crime:"));
    expect(groups).toHaveLength(9);
    for (const group of groups) {
      expect(group.options.map((option) => option.label)).toEqual(["鄉鎮・件數", "鄉鎮・每十萬人", "縣市・件數", "縣市・每十萬人"]);
    }
  });
});
