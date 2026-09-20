import { describe, expect, it } from "vitest";
import rawRecipes from "../agriStatisticsRecipes.json?raw";
import {
  AGRI_ENABLED_STATISTICS_KEYS,
  AGRI_ENABLED_STATISTICS_RECIPES,
  agriReleaseOptions,
  getAgriRecipe,
  resolveAgriRelease,
  type AgriStatisticsLayerKey,
} from "../agriStatisticsRecipes";
import { STATISTICS_RECIPES } from "../regionalStatisticsRecipes";
import { AGRI_EXISTING_LAYER_REFERENCES, STATISTICS_TAB_LAYER_ROLES } from "../statisticsLayerRegistry";
import { AGRI_CATALOG_DATASET_ALIASES, LAYER_MANIFEST } from "../layerManifest";
import { STATISTICS_DATA_THEMES } from "../../components/sidebar/layerCatalog";
import type { StatisticsRelease } from "../regionalStatisticsLoader";

type HandoffRecipe = {
  layer_key: string;
  enabled: boolean;
  dataset_id: string;
  indicator_id: string;
  mode?: string;
  dimensions?: Record<string, string>;
};

const handoff = JSON.parse(rawRecipes) as {
  recipes: HandoffRecipe[];
  existing_layer_references: HandoffRecipe[];
};
const enabledKeys = [...AGRI_ENABLED_STATISTICS_KEYS];
const blockedKeys = [
  "statsForestMainProductValueCounty",
  "statsForestByproductValueCounty",
  "statsAquacultureStockingCounty",
];
const enabledRecipeSet = new Set(enabledKeys);
const catalogKeys = STATISTICS_DATA_THEMES.flatMap((theme) =>
  theme.groups.flatMap((group) => group.layers.map((layer) => layer.key)),
);

function asPublicRelease(recipe: (typeof AGRI_ENABLED_STATISTICS_RECIPES)[number], option: (typeof recipe.release_options)[number]): StatisticsRelease {
  return {
    dataset_id: recipe.dataset_id,
    indicator_id: recipe.indicator_id,
    release_id: option.release_id,
    period_start: option.period_start,
    period_end: option.period_end,
    boundary_version: recipe.boundary_version,
    levels: [recipe.level],
  };
}

const expectedPresentation = {
  statsPaddyLandAreaTownship: ["水田用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsDryFieldAreaTownship: ["旱田用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsOrchardAreaTownship: ["果園用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsAgriculturalFacilityAreaTownship: ["農業生產設施用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsLivestockBuildingAreaTownship: ["畜禽舍用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsPastureAreaTownship: ["牧場用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsAquacultureLandAreaTownship: ["水產養殖用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsConiferForestAreaTownship: ["針葉林用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsBroadleafForestAreaTownship: ["闊葉林用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsBambooForestAreaTownship: ["竹林用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsMixedForestAreaTownship: ["混合林用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsRoadLandAreaTownship: ["道路用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsRailLandAreaTownship: ["鐵路用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsAirportLandAreaTownship: ["機場用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsPortLandAreaTownship: ["港口用地面積", "公頃", [100, 500, 1000, 5000], "TOWN_MOI_1140318"],
  statsCropPlantedAreaTownship: ["作物種植面積", "公頃", [100, 500, 1000, 5000], "township_boundary_20260626_identity_only"],
  statsCropHarvestedAreaTownship: ["作物收穫面積", "公頃", [100, 500, 1000, 5000], "township_boundary_20260626_identity_only"],
  statsCropProductionTownship: ["作物收量", "公斤", [1000, 10000, 100000, 1000000], "township_boundary_20260626_identity_only"],
  statsCropYieldTownship: ["每公頃收穫量", "公斤/公頃", [1000, 10000, 100000, 1000000], "township_boundary_20260626_identity_only"],
  statsFisheryProductionCounty: ["漁業生產量", "公噸", [100, 500, 1000, 5000], "COUNTY_MOI_1140318"],
  statsFisheryProductionValueCounty: ["漁業生產值", "千元", [1000, 10000, 100000, 1000000], "COUNTY_MOI_1140318"],
  statsAquacultureAreaCounty: ["水產養殖面積", "公頃", [100, 500, 1000, 5000], "COUNTY_MOI_1140318"],
  statsLivestockFarmCountTownship: ["畜禽飼養場數", "場", [1000, 10000, 100000, 1000000], "township_reference_20260626_v1"],
  statsLivestockHeadCountTownship: ["畜禽在養數量", "頭(隻)", [1000, 10000, 100000, 1000000], "township_reference_20260626_v1"],
} as const;

describe("農林漁牧 statistics handoff contract", () => {
  it("registers exactly the 24 enabled handoff keys in recipe, registry, manifest, and catalog", () => {
    expect(AGRI_ENABLED_STATISTICS_RECIPES).toHaveLength(24);
    expect(new Set(enabledKeys).size).toBe(24);
    expect(Object.keys(expectedPresentation).sort()).toEqual([...enabledKeys].sort());
    expect(handoff.recipes.filter((recipe) => recipe.enabled).map((recipe) => recipe.layer_key).sort()).toEqual([...enabledKeys].sort());

    for (const recipe of AGRI_ENABLED_STATISTICS_RECIPES) {
      const key = recipe.layer_key as AgriStatisticsLayerKey;
      const manifest = LAYER_MANIFEST[key];
      expect((STATISTICS_TAB_LAYER_ROLES as Record<string, "choropleth" | "boundary">)[key]).toBe("choropleth");
      expect(manifest).toMatchObject({
        key: recipe.layer_key,
        label: recipe.label,
        // 交通統計沿用既有英文 theme title；其他新農林漁牧主題保留 handoff 中文 group。
        section: { theme: recipe.group === "交通統計" ? "交通統計 Transport Statistics" : recipe.group, group: recipe.subgroup },
        upstream: { datasets: [{ datasetId: AGRI_CATALOG_DATASET_ALIASES[recipe.dataset_id] ?? recipe.dataset_id }] },
        legend: recipe.layer_key,
        popup: "regionalStatistic",
      });
      expect(manifest.source).toMatchObject({
        kind: "custom",
        note: expect.stringContaining(recipe.dataset_id),
      });
      expect(catalogKeys).toContain(key);
    }
    expect(catalogKeys.filter((key) => enabledRecipeSet.has(key as typeof enabledKeys[number])).sort()).toEqual([...enabledKeys].sort());
  });

  it("keeps all three HOLD recipes out of every UI toggle registry", () => {
    expect(handoff.recipes.filter((recipe) => !recipe.enabled).map((recipe) => recipe.layer_key).sort()).toEqual([...blockedKeys].sort());
    for (const key of blockedKeys) {
      expect(getAgriRecipe(key)?.enabled).toBe(false);
      expect(STATISTICS_TAB_LAYER_ROLES).not.toHaveProperty(key);
      expect(LAYER_MANIFEST).not.toHaveProperty(key);
      expect(catalogKeys).not.toContain(key);
    }
  });

  it("preserves the two existing datasets as index-only cross-topic references", () => {
    const rice = STATISTICS_RECIPES.statsRiceHarvest;
    const pigWater = STATISTICS_RECIPES.statsPigWaterCounty;
    expect(rice).toMatchObject({ dataset_id: "rice_harvested_area_township", indicator_id: "rice_harvested_area_hectare", level: "township", unit: "公頃", dimensions: {}, breaks: [100, 500, 1000, 3000] });
    expect(pigWater).toMatchObject({ dataset_id: "livestock_pig_water_county", indicator_id: "pig_water_thousand_m3", level: "county", unit: "千立方公尺", dimensions: { animal_kind: "pig" }, breaks: [100, 500, 2000, 5000] });
    expect(handoff.existing_layer_references).toEqual(expect.arrayContaining([
      expect.objectContaining({ layer_key: "statsRiceHarvest", dataset_id: rice.dataset_id, indicator_id: rice.indicator_id, mode: "index_reference_only" }),
      expect.objectContaining({ layer_key: "statsPigWaterCounty", dataset_id: pigWater.dataset_id, indicator_id: pigWater.indicator_id, dimensions: pigWater.dimensions, mode: "index_reference_only" }),
    ]));
    expect(AGRI_EXISTING_LAYER_REFERENCES).toEqual(expect.arrayContaining([
      expect.objectContaining({ layer_key: "statsRiceHarvest", dataset_id: rice.dataset_id, indicator_id: rice.indicator_id, mode: "index_reference_only" }),
      expect.objectContaining({ layer_key: "statsPigWaterCounty", dataset_id: pigWater.dataset_id, indicator_id: pigWater.indicator_id, dimensions: pigWater.dimensions, mode: "index_reference_only" }),
    ]));
    expect(catalogKeys).toEqual(expect.arrayContaining(["statsRiceHarvest", "statsPigWaterCounty"]));
  });

  it("keeps fixed presentation and reference-boundary semantics machine-exact", () => {
    for (const recipe of AGRI_ENABLED_STATISTICS_RECIPES) {
      const key = recipe.layer_key as AgriStatisticsLayerKey;
      const [label, unit, breaks, boundary] = expectedPresentation[key];
      expect([recipe.label, recipe.unit, recipe.legend.breaks, recipe.boundary_version]).toEqual([label, unit, breaks, boundary]);
      expect(recipe.legend).toMatchObject({ method: "fixed_breaks", missing_color: "#9ca3af", suppressed_pattern: "diagonal_hatch", not_reported_label: "未報告", zero_uses_numeric_scale: true });
      if (recipe.boundary_version === "TOWN_MOI_1140318") {
        expect(recipe.source_statistical_boundary_version).toBe("TOWNSHIP_REFERENCE_MOI_11501");
      }
    }
  });

  it("resolves every one of the 2,748 immutable tuples and intersects only matching public releases", () => {
    const allPublicReleases = AGRI_ENABLED_STATISTICS_RECIPES.flatMap((recipe) => recipe.release_options.map((option) => asPublicRelease(recipe, option)));
    expect(allPublicReleases).toHaveLength(2748);

    for (const recipe of AGRI_ENABLED_STATISTICS_RECIPES) {
      expect(agriReleaseOptions(recipe.layer_key, allPublicReleases)).toHaveLength(recipe.release_options.length);
      for (const option of recipe.release_options) {
        expect(resolveAgriRelease(recipe.layer_key, option, option.dimensions)).toEqual({ releaseId: option.release_id, dimensions: option.dimensions });
      }
    }
  });

  it("rejects altered release identity, partial dimensions, extra dimensions, and an unavailable crop-season tuple", () => {
    const recipe = getAgriRecipe("statsCropPlantedAreaTownship")!;
    const option = recipe.release_options[0]!;
    const release = asPublicRelease(recipe, option);
    expect(agriReleaseOptions(recipe.layer_key, [{ ...release, dataset_id: "wrong_dataset" }])).toEqual([]);
    expect(agriReleaseOptions(recipe.layer_key, [{ ...release, indicator_id: "wrong_indicator" }])).toEqual([]);
    expect(agriReleaseOptions(recipe.layer_key, [{ ...release, boundary_version: "wrong_boundary" }])).toEqual([]);
    expect(agriReleaseOptions(recipe.layer_key, [{ ...release, period_end: "2099-12-31" }])).toEqual([]);
    expect(resolveAgriRelease(recipe.layer_key, { ...option, release_id: "not-a-release" }, option.dimensions)).toBeNull();
    expect(resolveAgriRelease(recipe.layer_key, option, { crop: option.dimensions.crop })).toBeNull();
    expect(resolveAgriRelease(recipe.layer_key, option, { ...option.dimensions, unexpected: "value" })).toBeNull();
    expect(resolveAgriRelease(recipe.layer_key, option, { ...option.dimensions, season: "不存在期別" })).toBeNull();
  });
});
