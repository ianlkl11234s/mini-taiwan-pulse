import { describe, expect, it } from "vitest";
import type { AtlasRecipeCatalogEntry } from "../atlasStatisticsTypes";
import { CATEGORY_FALLBACK_COLOR, atlasCategoryRows, atlasRecipeRenderScale } from "../atlasStatisticsRecipes";
import { STATISTICS_PARTY_COLOR, statisticsVisualColors } from "../statisticsVisuals";
import { statisticsFillColorExpression } from "../statisticsFillColor";

/** 選舉統計 fixture（形狀照 docs/handoff/election-statistics-recipes.json 契約；真資料交付前只測前端能力）。 */
function fixture(legend: Partial<AtlasRecipeCatalogEntry["legend"]>, dimensions: AtlasRecipeCatalogEntry["dimensions"] = []): AtlasRecipeCatalogEntry {
  return {
    layer_key: "statsElectionFixture", enabled: true, family: "election", label: "最高黨", group: "g", group_label: "g", option_label: "o",
    subgroup: "選舉", data_theme: "政治 Politics", tab_theme: "選舉 Elections", visual_theme: "politics", dataset_id: "election_mayor_village",
    indicator_id: "top_party", level: "village" as AtlasRecipeCatalogEntry["level"], boundary_version: "x", unit: "", aggregation: "source_defined",
    default_release_id: "r1", dimensions, release_options: [],
    legend: { method: "fixed_breaks", breaks: [1, 2], direction: "ascending", scale_note: null, zero_note: null, display_note: null, by_dimension: null, dimension_notes: null, ...legend },
    status_labels: { missing: "無資料" }, format: { locale: "zh-TW", maximumFractionDigits: 1 }, derived: true, location_semantics: "x", disclosure: "x",
    publisher: "中選會", license: "OGDL-1.0", source_landing_url: "", source_download_url: "", source_title: "",
  };
}

describe("類別型圖例（legend.method＝categorical）", () => {
  const top = fixture({
    method: "categorical",
    categories: [
      { value: 1, label: "民進黨", key: "dpp" },
      { value: 2, label: "國民黨", key: "kmt" },
      { value: 4, label: "無黨籍", key: "ind" },
      { value: 5, label: "其他", color: "#123456", key: "other" },
      { value: 9, label: "未知鍵" },
    ],
  });

  it("color 缺省時用 key 對應政黨色；明寫 color 優先；都沒有用中性灰", () => {
    expect(atlasCategoryRows(top)).toEqual([
      { value: 1, label: "民進黨", color: STATISTICS_PARTY_COLOR.dpp },
      { value: 2, label: "國民黨", color: STATISTICS_PARTY_COLOR.kmt },
      { value: 4, label: "無黨籍", color: STATISTICS_PARTY_COLOR.ind },
      { value: 5, label: "其他", color: "#123456" },
      { value: 9, label: "未知鍵", color: CATEGORY_FALLBACK_COLOR },
    ]);
    expect(atlasCategoryRows(fixture({}))).toBeNull();
  });

  it("地圖用 match 整數碼上色，清單外的碼為中性灰；非類別型維持 step", () => {
    const rows = atlasCategoryRows(top)!;
    const expr = statisticsFillColorExpression({ breaks: [1], colors: ["#000", "#fff"], categories: rows });
    expect(expr.slice(0, 2)).toEqual(["match", ["to-number", ["get", "value"]]]);
    expect(expr.slice(2, 6)).toEqual([1, STATISTICS_PARTY_COLOR.dpp, 2, STATISTICS_PARTY_COLOR.kmt]);
    expect(expr[expr.length - 1]).toBe(CATEGORY_FALLBACK_COLOR);
    expect(statisticsFillColorExpression({ breaks: [10, 20], colors: ["#a", "#b", "#c"] })).toEqual(["step", ["get", "value"], "#a", 10, "#b", 20, "#c"]);
  });
});

describe("藍綠 diverging（palette＝partisan）", () => {
  it("負值偏綠、正值偏藍；奇數類別正中為中性灰", () => {
    const colors = statisticsVisualColors("k", "國民黨減民進黨", [-30, -15, -5, 5, 15, 30], "diverging", { palette: "partisan" });
    expect(colors).toHaveLength(7);
    expect(colors[3]).toBe("#e5e7eb");
    const greenish = (c: string) => Number.parseInt(c.slice(3, 5), 16) > Number.parseInt(c.slice(5, 7), 16);
    expect(greenish(colors[0]!)).toBe(true);
    expect(greenish(colors[6]!)).toBe(false);
  });

  it("recipe legend.palette 帶到渲染色階；by_dimension 組合沿用 recipe 色票", () => {
    const recipe = fixture({ breaks: [-10, 0, 10], direction: "diverging", palette: "partisan", by_dimension: { b: { breaks: [-5, 0, 5], direction: "diverging" } } },
      [{ key: "x", label: "x", default: "a", options: [{ value: "a", label: "a" }, { value: "b", label: "b" }] }]);
    expect(atlasRecipeRenderScale(recipe, { x: "a" })).toEqual({ breaks: [-10, 0, 10], direction: "diverging", palette: "partisan" });
    expect(atlasRecipeRenderScale(recipe, { x: "b" })).toEqual({ breaks: [-5, 0, 5], direction: "diverging", palette: "partisan" });
  });
});

describe("vote_share 依所選政黨 sequential（legend.party_dimension）", () => {
  const recipe = fixture({ breaks: [20, 40, 60], party_dimension: "party" },
    [{ key: "party", label: "政黨", default: "dpp", options: ["dpp", "kmt", "tpp", "all"].map((value) => ({ value, label: value })) }]);

  it("選到已知政黨 → partyColor；預設值也算；非政黨值不帶", () => {
    expect(atlasRecipeRenderScale(recipe, { party: "kmt" }).partyColor).toBe(STATISTICS_PARTY_COLOR.kmt);
    expect(atlasRecipeRenderScale(recipe).partyColor).toBe(STATISTICS_PARTY_COLOR.dpp);
    expect(atlasRecipeRenderScale(recipe, { party: "all" }).partyColor).toBeUndefined();
  });

  it("partyColor 產生同色相、由淺到深的 sequential（白 → 黨色 → 黑，L* 等距）", () => {
    const colors = statisticsVisualColors("k", "得票率", [20, 40, 60, 80], "ascending", { partyColor: STATISTICS_PARTY_COLOR.kmt });
    expect(colors).toHaveLength(5);
    const lum = (c: string) => [1, 3, 5].reduce((sum, i) => sum + Number.parseInt(c.slice(i, i + 2), 16), 0);
    for (let i = 1; i < colors.length; i++) expect(lum(colors[i]!)).toBeLessThan(lum(colors[i - 1]!));
    // 國民黨色系：中段藍通道最大
    const mid = colors[2]!;
    const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(mid.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r!);
  });
});

describe("類別型 not_applicable（最高黨並列）和缺值分開畫", () => {
  it("類別型：not_applicable 實心淺灰、不疊斜線；非類別型維持原樣", async () => {
    const { statisticsFillCase, statisticsMissingFilter, STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR } = await import("../statisticsFillColor");
    const hasValue = ["has"];
    const isMissing = ["missing"];
    const categorical = { breaks: [2], colors: ["#111111", "#222222"], categories: [{ value: 1, color: "#111111" }, { value: 2, color: "#222222" }] };
    const fill = statisticsFillCase(categorical, hasValue, "rgba(0,0,0,0)");
    expect(fill).toContain(STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR);
    expect(statisticsMissingFilter(categorical, isMissing)).toEqual(["all", isMissing, ["!=", ["get", "status"], "not_applicable"]]);
    const numeric = { breaks: [10], colors: ["#eeeeee", "#111111"] };
    expect(statisticsFillCase(numeric, hasValue, "rgba(0,0,0,0)")).not.toContain(STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR);
    expect(statisticsMissingFilter(numeric, isMissing)).toBe(isMissing);
  });
});
