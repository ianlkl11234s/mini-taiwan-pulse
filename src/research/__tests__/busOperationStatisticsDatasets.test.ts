import { describe, expect, it, vi } from "vitest";
import type { RegionalStatisticsResult } from "../../data/regionalStatisticsLoader";
import { QueryExecutor } from "../queryExecutor";
import { BUS_OPERATION_QUERY_RECIPES, BUS_OPERATION_STATISTICS_RECIPES, busOperationStatisticsDatasetId, createBusOperationStatisticsAdapters } from "../busOperationStatisticsDatasets";
import { createSocialStatisticsAdapters } from "../statisticsDatasetAdapters";

const checksum = "b".repeat(64);
const electricRecipe = BUS_OPERATION_STATISTICS_RECIPES.find(recipe => recipe.layer_key === "statsBusElectricVehicleCount")!;

function electricFixture(): RegionalStatisticsResult {
  const release = electricRecipe.release_options[0]!;
  return {
    catalog: [], releases: [],
    values: {
      status: "OK",
      release: { release_id: release.release_id, dataset_id: electricRecipe.dataset_id, indicator_id: electricRecipe.indicator_id, boundary_version: electricRecipe.boundary_version, period_start: release.period_start, period_end: release.period_end, levels: ["county"] },
      area_level: "county", total: 3, returned: 3, truncated: false, next_offset: null,
      observations: [
        { area_code: "63000", value: 0, status: "observed" },
        { area_code: "65000", value: null, status: "missing", source_status: "missing", source_token: "null" },
      ],
    },
    sources: { raw_sha256: checksum }, health: { status: "OK", coverage: electricRecipe.release_options[0]!.coverage },
    effectiveRecipe: { datasetId: electricRecipe.dataset_id, indicatorId: electricRecipe.indicator_id, level: "county", dimensions: release.dimensions, releaseId: release.release_id, layerKey: electricRecipe.layer_key },
    geometryManifest: { resource: "https://example.test/county.geojson", sha256: checksum, code_scheme: "fixture", boundary_version: electricRecipe.boundary_version, level: "county" },
    features: [
      { type: "Feature", properties: { area_code: "63000", area_name: "臺北市", indicator_name: electricRecipe.label, unit: electricRecipe.unit, value: 0, status: "observed", boundary_version: electricRecipe.boundary_version }, geometry: { type: "Polygon", coordinates: [[[121, 25], [121.1, 25], [121.1, 25.1], [121, 25.1], [121, 25]]] } },
      { type: "Feature", properties: { area_code: "65000", area_name: "新北市", indicator_name: electricRecipe.label, unit: electricRecipe.unit, value: null, status: "missing", source_status: "missing", source_token: "null", boundary_version: electricRecipe.boundary_version }, geometry: { type: "Polygon", coordinates: [[[121.1, 25], [121.2, 25], [121.2, 25.1], [121.1, 25.1], [121.1, 25]]] } },
      { type: "Feature", properties: { area_code: "68000", area_name: "桃園市", indicator_name: electricRecipe.label, unit: electricRecipe.unit, value: null, status: "missing", boundary_version: electricRecipe.boundary_version }, geometry: { type: "Polygon", coordinates: [[[121.2, 25], [121.3, 25], [121.3, 25.1], [121.2, 25.1], [121.2, 25]]] } },
    ],
  };
}

describe("bus operation statistics datasets", () => {
  it("locks the eight documented county releases, dimensions, and boundary", () => {
    expect(BUS_OPERATION_STATISTICS_RECIPES).toHaveLength(8);
    expect(BUS_OPERATION_STATISTICS_RECIPES.map(recipe => recipe.release_options[0]!.release_id)).toEqual([
      "2025-114-column1-fcb90c6e6b05", "2025-114-column2-2cfcc51bbaeb", "2025-114-column3-d29188c54350", "2025-114-column4-9e012e606e3a",
      "2025-114-column5-f4969fae6a17", "2025-114-column6-5a90492f645a", "2025-114-column7-27ac5f545458", "2025-114-column8-be577682e7b9",
    ]);
    expect(BUS_OPERATION_STATISTICS_RECIPES.every(recipe => recipe.level === "county" && recipe.boundary_version === "COUNTY_MOI_1140318" && recipe.release_options[0]?.period_start === "2025-01-01" && recipe.release_options[0]?.period_end === "2025-12-31")).toBe(true);
    expect(electricRecipe.release_options[0]?.dimensions).toEqual({ roc_year: "114", source_field: "COLUMN6", geographic_coverage: "national_county" });
    expect(electricRecipe.release_options[0]?.coverage).toEqual({ expected: { county_count: 22 }, observed: { county_count: 15, missing_county_count: 7, status: "PARTIAL" } });
    expect(BUS_OPERATION_QUERY_RECIPES).toHaveLength(7);
    expect(new QueryExecutor(createBusOperationStatisticsAdapters()).describe(busOperationStatisticsDatasetId(electricRecipe))).toBeNull();
  });

  it("verifies the held COLUMN6 source-null contract without registering its disputed label", async () => {
    const load = vi.fn(async () => electricFixture());
    const executor = new QueryExecutor(createSocialStatisticsAdapters([electricRecipe], load));
    const release = electricRecipe.release_options[0]!;
    const result = await executor.execute({ datasetId: busOperationStatisticsDatasetId(electricRecipe), parameters: { releaseId: release.release_id }, select: ["area_code", "value", "status", "source_status", "source_token", "dimensions", "boundary_version"] });

    expect(load).toHaveBeenCalledWith(expect.objectContaining({ datasetId: electricRecipe.dataset_id, indicatorId: electricRecipe.indicator_id, level: "county", dimensions: release.dimensions, releaseId: release.release_id, layerKey: electricRecipe.layer_key, allowReleaseFallback: false }), expect.any(AbortSignal));
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "63000", value: 0, status: "observed" }),
      expect.objectContaining({ area_code: "65000", value: null, status: "missing", source_status: "missing", source_token: "null" }),
    ]));
    expect(result.coverage).toContain('"county_count":15');
  });
});
