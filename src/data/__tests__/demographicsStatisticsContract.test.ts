import { describe, expect, it } from "vitest";
import recipesJson from "../demographicsStatisticsRecipes.json";
import {
  DEMOGRAPHICS_ENABLED_STATISTICS_KEYS, DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY,
  DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS, demographicsIndicatorNote, demographicsReleaseOptions, resolveDemographicsRelease,
  type DemographicsStatisticsLayerKey,
} from "../demographicsStatisticsRecipes";
import { STATISTICS_RECIPES, statisticsRenderRecipe } from "../regionalStatisticsRecipes";
import { getStatisticsDataSourceDefinition } from "../statisticsDataSources";
import { getMedicalStatisticsGroup } from "../medicalStatisticsGroups";
import { statisticsLinkedSelects } from "../statisticsParamsSpec";
import { getStatisticsVisual, statisticsVisualColors } from "../statisticsVisuals";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

type Recipe = typeof DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES[number];
const publicReleases = (recipe: Recipe): StatisticsRelease[] => recipe.release_options.map((option) => ({
  release_id: option.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id,
  boundary_version: recipe.boundary_version, period_start: option.period_start, period_end: option.period_end, levels: [recipe.level],
}));
const delivered = (recipesJson as { recipes: Array<{ layer_key: string; enabled: boolean; level: string }> }).recipes;

describe("demographics statistics recipes", () => {
  it("registers exactly the enabled county/township handoff recipes; village HOLD stays out", () => {
    expect(delivered.every((recipe) => recipe.enabled)).toBe(true);
    expect(delivered.some((recipe) => recipe.level === "village")).toBe(false);
    // KEYS tuple must track the JSON, otherwise a new handoff silently misses the LayerVisibility union.
    expect(delivered.map((recipe) => recipe.layer_key).sort()).toEqual([...DEMOGRAPHICS_ENABLED_STATISTICS_KEYS].sort());
    expect(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES).toHaveLength(32);
    for (const key of DEMOGRAPHICS_ENABLED_STATISTICS_KEYS) {
      expect(STATISTICS_RECIPES[key].dataset_id).toBe(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY[key].dataset_id);
      expect("releaseId" in STATISTICS_RECIPES[key]).toBe(false);
    }
  });

  it("keeps 288 exact selectors (9 periods × 32 layers) with {roc_year, month} identity", () => {
    expect(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.reduce((sum, recipe) => sum + recipe.release_options.length, 0)).toBe(288);
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
      expect(new Set(recipe.release_options.map((option) => option.release_id)).size).toBe(recipe.release_options.length);
      for (const option of recipe.release_options) {
        expect(Object.keys(option.dimensions).sort()).toEqual(["month", "roc_year"]);
        expect(option.period_start).toBe(option.period_end);
      }
    }
  });

  it("defaults to the latest delivered period (115-08), not the oldest", () => {
    const recipe = DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyShareAge65Plus;
    expect(demographicsReleaseOptions(recipe.layer_key, publicReleases(recipe))[0]).toEqual({
      releaseId: "pas-share-age-65-plus-county-11508", dimensions: { month: "08", roc_year: "115" },
    });
    expect(STATISTICS_RECIPES.statsDemographicsCountyShareAge65Plus.dimensions).toEqual({ month: "08", roc_year: "115" });
    expect(demographicsReleaseOptions(recipe.layer_key, [])).toEqual([]);
  });

  it("refuses partial or foreign dimensions and releases from another level", () => {
    const county = DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyPopulationTotal;
    const release = publicReleases(county).find((item) => item.release_id.endsWith("-11412"))!;
    expect(resolveDemographicsRelease(county.layer_key, release, { roc_year: "114", month: "12" })).toEqual({ releaseId: release.release_id, dimensions: { month: "12", roc_year: "114" } });
    expect(resolveDemographicsRelease(county.layer_key, release, { roc_year: "114" })).toBeNull();
    expect(resolveDemographicsRelease(county.layer_key, release, {})).toBeNull();
    expect(resolveDemographicsRelease(county.layer_key, { ...release, release_id: "hrp-population-total-township-11412" }, { roc_year: "114", month: "12" })).toBeNull();
    const township = publicReleases(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsTownshipPopulationTotal);
    expect(demographicsReleaseOptions(county.layer_key, township)).toEqual([]);
  });

  it("preserves the PARTIAL township periods (高雄三民、鳳山 missing) instead of filling zero", () => {
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((item) => item.level === "township")) {
      for (const suffix of ["10712", "10812"]) {
        const option = recipe.release_options.find((item) => item.release_id.endsWith(`-${suffix}`))!;
        expect(option.health).toBe("PARTIAL");
        expect(option.coverage).toMatchObject({ numerator: 366, denominator: 368, status: "PARTIAL" });
      }
    }
  });

  it("uses the recipe's fixed breaks with the sequential RdPu population palette (no quantile, no red–green)", () => {
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
      const render = statisticsRenderRecipe(recipe.layer_key as DemographicsStatisticsLayerKey);
      expect(recipe.legend.method).toBe("fixed_breaks");
      expect(render.breaks).toEqual(recipe.legend.breaks);
      expect([...render.breaks].sort((a, b) => a - b)).toEqual(render.breaks);
      expect(render.breaks.some((value) => value < 0)).toBe(false);
      expect(render.colors).toEqual(statisticsVisualColors(recipe.layer_key, recipe.label, recipe.legend.breaks));
      expect(render.colors).not.toEqual(recipe.legend.colors);
      expect(getStatisticsVisual(recipe.layer_key, recipe.label).theme).toBe("人口");
    }
    expect(statisticsRenderRecipe("statsDemographicsTownshipShareAge65Plus").breaks).toEqual([14, 17, 20, 23]);
  });

  it("groups each concept into one row; every enabled layer belongs to exactly one group, county first", () => {
    const members = DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS.flatMap((group) => group.options.map((option) => option.key));
    expect([...members].sort()).toEqual([...DEMOGRAPHICS_ENABLED_STATISTICS_KEYS].sort());
    expect(new Set(members).size).toBe(members.length);
    expect(DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS.map((group) => group.label)).toEqual([
      "戶籍人口數", "戶數", "戶量（平均每戶人口）", "人口密度", "年齡組人口數", "年齡組人口占比", "老化指數與扶養比", "性比例", "年齡中位數",
    ]);
    expect(getMedicalStatisticsGroup("statsDemographicsTownshipPopulationDensity")?.options.map((option) => [option.key, option.label])).toEqual([
      ["statsDemographicsCountyPopulationDensity", "縣市"], ["statsDemographicsTownshipPopulationDensity", "鄉鎮市區"],
    ]);
    expect(getMedicalStatisticsGroup("statsDemographicsCountyShareAge65Plus")?.options[2]).toEqual({ key: "statsDemographicsCountyShareAge65Plus", label: "縣市：65 歲以上人口占比" });
  });

  it("exposes one period select (no month→year cascade) after the group variant select", () => {
    expect(statisticsLinkedSelects("statsDemographicsCountyMedianAge").map((spec) => [spec.provider, spec.field, spec.label])).toEqual([
      ["statisticsVariant", "demographics:medianAge", "地理層級"],
      ["statistics", "release", "資料期別"],
    ]);
  });

  it("states the RIS source and unverified licence, self-computed median and planar density area", () => {
    const density = getStatisticsDataSourceDefinition("statsDemographicsCountyPopulationDensity")!;
    expect(density.provider).toBe("內政部戶政司 RIS（授權條款待確認）");
    expect(density.license).toContain("待確認");
    expect(density.license).not.toMatch(/OGDL|第1版/);
    expect(density.kind).toBe("derived");
    expect(density.disclosure).toContain("EPSG:3826");
    expect(density.disclosure).toContain("1.8%");
    expect(getStatisticsDataSourceDefinition("statsDemographicsTownshipMedianAge")!.disclosure).toContain("自算");
    expect(getStatisticsDataSourceDefinition("statsDemographicsCountyPopulationTotal")!.kind).toBe("source");
    expect(demographicsIndicatorNote({ indicator_id: "pop_age_0_14" })).toBeUndefined();
  });
});
