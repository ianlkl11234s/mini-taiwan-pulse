import { describe, expect, it } from "vitest";
import recipesJson from "../demographicsStatisticsRecipes.json";
import {
  DEMOGRAPHICS_ENABLED_STATISTICS_KEYS, DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY,
  DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS, demographicsDisplayLabel, demographicsIndicatorNote, demographicsPeriodLabel, demographicsReleaseOptions, resolveDemographicsRelease,
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
    expect(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES).toHaveLength(97);
    for (const key of DEMOGRAPHICS_ENABLED_STATISTICS_KEYS) {
      expect(STATISTICS_RECIPES[key].dataset_id).toBe(DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY[key].dataset_id);
      expect("releaseId" in STATISTICS_RECIPES[key]).toBe(false);
    }
  });

  it("keeps 620 exact selectors (P0 72＋P2 216＋P3 110＋P4 68＋P5 72＋P6 82), one tuple per release", () => {
    const perDataset = new Map<string, number>();
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) perDataset.set(recipe.dataset_id, (perDataset.get(recipe.dataset_id) ?? 0) + recipe.release_options.length);
    expect(Object.fromEntries(perDataset)).toEqual({
      household_registration_population: 72, population_age_structure: 216, population_vital_events: 110,
      population_migration: 68, indigenous_population: 72, foreign_origin_population: 82,
    });
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
      expect(new Set(recipe.release_options.map((option) => option.release_id)).size).toBe(recipe.release_options.length);
      const keys = Object.keys(recipe.release_options[0]!.dimensions).sort().join(",");
      expect(["month,roc_year", "roc_year", "month_range,roc_year"]).toContain(keys);
      for (const option of recipe.release_options) {
        expect(Object.keys(option.dimensions).sort().join(",")).toBe(keys);
        if (keys === "month,roc_year") expect(option.period_start).toBe(option.period_end);
      }
    }
  });

  it("keeps year-to-date (YTD) layers apart from annual values and labels them 1–8 月累計", () => {
    const ytd = DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.indicator_id.endsWith("_ytd"));
    expect(ytd).toHaveLength(16);
    for (const recipe of ytd) {
      expect(recipe.release_options).toHaveLength(1);
      expect(recipe.release_options[0]!.dimensions).toEqual({ month_range: "01-08", roc_year: "115" });
      expect(statisticsRenderRecipe(recipe.layer_key as DemographicsStatisticsLayerKey).label).toBe(demographicsDisplayLabel(recipe));
      expect(demographicsDisplayLabel(recipe)).toMatch(/（115 年 1–8 月累計）$/);
      expect(demographicsDisplayLabel(recipe)).not.toContain("YTD");
      expect(demographicsIndicatorNote(recipe)).toContain("不可與年度值比較");
      // 年度與 YTD 永不在同一群組列：群組內切換要求同一期別。
      const group = getMedicalStatisticsGroup(recipe.layer_key)!;
      expect(group.options.every((option) => option.key.endsWith("Ytd"))).toBe(true);
    }
    const births = DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyBirthsYtd;
    expect(demographicsPeriodLabel(births.layer_key, { release_id: births.release_options[0]!.release_id })).toBe("115 年 1–8 月累計");
    expect(demographicsPeriodLabel("statsDemographicsCountyBirths", { release_id: DEMOGRAPHICS_STATISTICS_RECIPES_BY_KEY.statsDemographicsCountyBirths.release_options[0]!.release_id })).toBeUndefined();
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
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((item) => item.level === "township" && ["household_registration_population", "population_age_structure", "indigenous_population"].includes(item.dataset_id))) {
      for (const suffix of ["10712", "10812"]) {
        const option = recipe.release_options.find((item) => item.release_id.endsWith(`-${suffix}`))!;
        expect(option.health).toBe("PARTIAL");
        expect(option.coverage).toMatchObject({ numerator: 366, denominator: 368, status: "PARTIAL" });
      }
    }
  });

  it("uses the recipe's fixed breaks: sequential RdPu, or PuOr centred on 0 for signed metrics (no quantile, no red–green)", () => {
    const signed = /^(natural_increase|natural_increase_rate|net_migration|net_migration_rate)(_ytd)?$/;
    for (const recipe of DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES) {
      const render = statisticsRenderRecipe(recipe.layer_key as DemographicsStatisticsLayerKey);
      expect(recipe.legend.method).toBe("fixed_breaks");
      expect(render.breaks).toEqual(recipe.legend.breaks);
      expect([...render.breaks].sort((a, b) => a - b)).toEqual(render.breaks);
      expect(render.colors).toEqual(statisticsVisualColors(recipe.layer_key, recipe.label, recipe.legend.breaks));
      expect(getStatisticsVisual(recipe.layer_key, recipe.label).theme).toBe("人口");
      if (signed.test(recipe.indicator_id)) {
        // 對稱於 0：0 是唯一中點，正負門檻互為相反數
        expect(render.breaks).toContain(0);
        expect([...render.breaks].map((value) => 0 - value).reverse().map((value) => value || 0)).toEqual([...render.breaks]);
        expect(render.colors).toEqual(["#b35806", "#f1a340", "#fee0b6", "#d8daeb", "#998ec3", "#542788"]);
      } else {
        expect(render.breaks.some((value) => value < 0)).toBe(false);
        expect(render.colors).not.toEqual(recipe.legend.colors);
      }
    }
    expect(statisticsRenderRecipe("statsDemographicsTownshipShareAge65Plus").breaks).toEqual([14, 17, 20, 23]);
  });

  it("groups each concept into one row; every enabled layer belongs to exactly one group, county first", () => {
    const members = DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS.flatMap((group) => group.options.map((option) => option.key));
    expect([...members].sort()).toEqual([...DEMOGRAPHICS_ENABLED_STATISTICS_KEYS].sort());
    expect(new Set(members).size).toBe(members.length);
    expect(DEMOGRAPHICS_STATISTICS_TOGGLE_GROUPS.map((group) => group.label)).toEqual([
      "戶籍人口數", "戶數", "戶量（平均每戶人口）", "人口密度", "年齡組人口數", "年齡組人口占比", "老化指數與扶養比", "性比例", "年齡中位數",
      "出生與死亡", "自然增加", "結婚與離婚", "人口動態年初累計", "遷入與遷出", "淨遷徙（社會增加）", "遷徙年初累計",
      "原住民人口數", "原住民人口占比", "已設戶籍外來人口數", "已設戶籍外來人口占比", "歸化國籍人數",
    ]);
    // 歸化只有縣市層：選單只列「縣市」
    expect(getMedicalStatisticsGroup("statsDemographicsCountyNaturalizationCount")?.options).toEqual([{ key: "statsDemographicsCountyNaturalizationCount", label: "縣市" }]);
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

  it("states the P3–P6 caveats: registration-date births with 2022 CSV month, county≠township gross migration, registered-only foreign origin with OGDL", () => {
    const births = getStatisticsDataSourceDefinition("statsDemographicsCountyBirths")!;
    expect(births.disclosure).toContain("2022 年含 1 個月");
    expect(births.provider).toBe("內政部戶政司 RIS（授權條款待確認）");
    expect(getStatisticsDataSourceDefinition("statsDemographicsCountyInMigration")!.disclosure).toContain("縣市遷入 ≠ 所屬鄉鎮遷入加總");
    const foreign = getStatisticsDataSourceDefinition("statsDemographicsTownshipForeignOriginPopulation")!;
    expect(foreign.disclosure).toContain("不是移工、不是外僑居留人數");
    expect(foreign.license).toContain("政府資料開放授權條款第 1 版");
    expect(foreign.sourceUrl).toBe("https://data.gov.tw/dataset/127528");
    const naturalization = getStatisticsDataSourceDefinition("statsDemographicsCountyNaturalizationCount")!;
    expect(naturalization.disclosure).toContain("年度流量");
    expect(naturalization.sourceUrl).toBe("https://data.gov.tw/dataset/62563");
    expect(getStatisticsDataSourceDefinition("statsDemographicsCountyIndigenousShare")!.disclosure).toContain("平埔");
    expect(getStatisticsDataSourceDefinition("statsDemographicsCountyNetMigrationRate")!.disclosure).toContain("棕色為負");
  });
});

it("explains STALE as a historical period rather than wrong data (upstream health: non-latest snapshot)", async () => {
  const { statisticsAvailabilityLabel } = await import("../statisticsLabels");
  expect(statisticsAvailabilityLabel("STALE")).toBe("STALE（歷史期別：已有較新期別，數值本身不受影響）");
  expect(statisticsAvailabilityLabel("CURRENT")).toContain("最新期別");
  expect(statisticsAvailabilityLabel("UNKNOWN_CODE")).toBe("UNKNOWN_CODE");
});
