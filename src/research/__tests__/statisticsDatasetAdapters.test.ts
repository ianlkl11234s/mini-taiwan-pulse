import { describe, expect, it, vi } from "vitest";
import { SOCIAL_ENABLED_STATISTICS_RECIPES } from "../../data/socialStatisticsRecipes";
import type { RegionalStatisticsResult } from "../../data/regionalStatisticsLoader";
import { QueryExecutor } from "../queryExecutor";
import { MAX_QUERY_RESULT_BYTES } from "../QueryResponder";
import { describeDataset } from "../researchDatasets";
import { createSocialStatisticsAdapters, socialStatisticsDatasetId } from "../statisticsDatasetAdapters";

const checksum = "a".repeat(64);

function fixture(recipe: (typeof SOCIAL_ENABLED_STATISTICS_RECIPES)[number], releaseId: string): RegionalStatisticsResult {
  const release = recipe.release_options.find(option => option.release_id === releaseId)!;
  return {
    catalog: [], releases: [],
    values: {
      status: "OK",
      release: { release_id: release.release_id, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, boundary_version: recipe.boundary_version, period_start: release.period_start, period_end: release.period_end, levels: [recipe.level] },
      area_level: recipe.level, total: 2, returned: 2, truncated: false, next_offset: null,
      observations: [
        { area_code: recipe.level === "county" ? "63000" : "63000010", value: 0, status: "observed" },
        { area_code: recipe.level === "county" ? "65000" : "65000010", value: null, status: "suppressed", source_status: "suppressed", source_token: "X" },
      ],
    },
    sources: { raw_sha256: checksum }, health: { status: "OK", coverage: release.coverage },
    effectiveRecipe: { datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, dimensions: release.dimensions, releaseId: release.release_id, layerKey: recipe.layer_key },
    geometryManifest: { resource: "https://example.test/boundary.geojson", sha256: checksum, code_scheme: "fixture", boundary_version: recipe.boundary_version, level: recipe.level },
    features: [
      {
        type: "Feature", properties: { area_code: recipe.level === "county" ? "63000" : "63000010", area_name: "第一行政區", indicator_name: recipe.label, unit: recipe.unit, value: 0, status: "observed", boundary_version: recipe.boundary_version },
        geometry: { type: "Polygon", coordinates: [[[121.4, 25], [121.45, 25], [121.45, 25.05], [121.4, 25.05], [121.4, 25]]] },
      },
      {
        type: "Feature", properties: { area_code: recipe.level === "county" ? "65000" : "65000010", area_name: "第二行政區", indicator_name: recipe.label, unit: recipe.unit, value: null, status: "suppressed", source_status: "suppressed", source_token: "X", boundary_version: recipe.boundary_version },
        geometry: { type: "MultiPolygon", coordinates: [[[[121.5, 25], [121.55, 25], [121.55, 25.05], [121.5, 25.05], [121.5, 25]]]] },
      },
      {
        type: "Feature", properties: { area_code: recipe.level === "county" ? "68000" : "68000010", area_name: "無觀測行政區", indicator_name: recipe.label, unit: recipe.unit, value: null, status: "missing", boundary_version: recipe.boundary_version },
        geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.65, 25], [121.65, 25.05], [121.6, 25.05], [121.6, 25]]] },
      },
    ],
  };
}

describe("social statistics dataset compiler", () => {
  it("compiles every enabled recipe into a unique valid descriptor", () => {
    const adapters = createSocialStatisticsAdapters();
    const executor = new QueryExecutor(adapters);
    const descriptors = executor.descriptors();
    expect(descriptors).toHaveLength(SOCIAL_ENABLED_STATISTICS_RECIPES.length);
    expect(new Set(descriptors.map(item => item.datasetId)).size).toBe(SOCIAL_ENABLED_STATISTICS_RECIPES.length);
    expect(descriptors.every(item => item.datasetId.startsWith("regional-statistics:") && item.access.query.enabled && item.geometry.type === "MultiPolygon" && item.geometry.crs === "EPSG:4326" && item.geometry.role === "actual" && item.geometry.spatialAnalysisEligible)).toBe(true);
    expect(descriptors.every(item => item.access.limits.maxResponseBytes === 1024 * 1024)).toBe(true);
    expect(descriptors.every(item => item.versions.length > 0 && item.fields.find(field => field.name === "value")?.unit)).toBe(true);
  });

  it("keeps a release-rich descriptor inside the paired query transport budget", () => {
    const descriptor = describeDataset("regional-statistics:statsEducationCountyStudentTeacherRatio");
    const bytes = new TextEncoder().encode(JSON.stringify({ ok: true, data: descriptor })).byteLength;
    expect(bytes).toBeLessThanOrEqual(MAX_QUERY_RESULT_BYTES);
  });

  it("uses the exact recipe selector and preserves county status semantics", async () => {
    const recipe = SOCIAL_ENABLED_STATISTICS_RECIPES.find(item => item.level === "county")!;
    const load = vi.fn(async (input: Parameters<typeof import("../../data/regionalStatisticsLoader").loadRegionalStatistics>[0]) => fixture(recipe, input.releaseId!));
    const executor = new QueryExecutor(createSocialStatisticsAdapters([recipe], load));
    const release = recipe.release_options[0]!;
    const result = await executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: release.release_id }, filters: [{ field: "status", op: "eq", value: "suppressed" }] });
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: "county", dimensions: release.dimensions, releaseId: release.release_id, layerKey: recipe.layer_key, allowReleaseFallback: false }), undefined);
    expect(result.freshness).toBe(release.health === "STALE" ? "stale" : "unknown");
    expect(result.rows[0]).toMatchObject({ value: null, status: "suppressed", boundary_version: recipe.boundary_version, boundary_sha256: checksum, dimensions: release.dimensions, geometry: { type: "MultiPolygon" } });
    expect(result.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: `regional-statistics:${recipe.layer_key}`, checksumSha256: checksum }),
      expect.objectContaining({ sourceId: `regional-statistics-boundary:${recipe.boundary_version}:${recipe.level}`, version: recipe.boundary_version, checksumSha256: checksum }),
    ]));
  });

  it("queries township recipes through the same adapter family", async () => {
    const recipe = SOCIAL_ENABLED_STATISTICS_RECIPES.find(item => item.level === "township")!;
    const load = vi.fn(async (input: Parameters<typeof import("../../data/regionalStatisticsLoader").loadRegionalStatistics>[0]) => fixture(recipe, input.releaseId!));
    const executor = new QueryExecutor(createSocialStatisticsAdapters([recipe], load));
    const release = recipe.release_options[0]!;
    const result = await executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: release.release_id }, select: ["area_code", "value", "status", "level", "period_end", "geometry"] });
    expect(result.rows.find(row => row.area_code === "63000010")).toMatchObject({ value: 0, status: "observed", level: "township", period_end: release.period_end, geometry: { type: "MultiPolygon" } });
    expect(result.rows.find(row => row.area_code === "68000010")).toMatchObject({ value: null, status: "missing", geometry: { type: "MultiPolygon" } });
    await expect(executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: "unregistered-release" } })).rejects.toThrow("RELEASE_NOT_ALLOWED");
  });

  it("rejects a returned release whose boundary manifest is not the recipe boundary", async () => {
    const recipe = SOCIAL_ENABLED_STATISTICS_RECIPES.find(item => item.level === "county")!;
    const release = recipe.release_options[0]!;
    const mismatch = fixture(recipe, release.release_id);
    mismatch.geometryManifest = { ...mismatch.geometryManifest, boundary_version: "wrong-boundary" };
    const load = vi.fn(async () => mismatch);
    const executor = new QueryExecutor(createSocialStatisticsAdapters([recipe], load));
    await expect(executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: release.release_id } })).rejects.toThrow("STATISTICS_RELEASE_CONTRACT_MISMATCH");
  });
});
