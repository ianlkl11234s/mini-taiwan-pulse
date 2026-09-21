import { describe, expect, it, vi } from "vitest";
import { SOCIAL_ENABLED_STATISTICS_RECIPES } from "../../data/socialStatisticsRecipes";
import type { RegionalStatisticsValuesResult } from "../../data/regionalStatisticsLoader";
import { QueryExecutor } from "../queryExecutor";
import { createSocialStatisticsAdapters, socialStatisticsDatasetId } from "../statisticsDatasetAdapters";

const checksum = "a".repeat(64);

function fixture(recipe: (typeof SOCIAL_ENABLED_STATISTICS_RECIPES)[number], releaseId: string): RegionalStatisticsValuesResult {
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
    geometryManifest: { resource: "fixture", sha256: checksum, code_scheme: "fixture", boundary_version: recipe.boundary_version, level: recipe.level },
  };
}

describe("social statistics dataset compiler", () => {
  it("compiles every enabled recipe into a unique valid descriptor", () => {
    const adapters = createSocialStatisticsAdapters();
    const executor = new QueryExecutor(adapters);
    const descriptors = executor.descriptors();
    expect(descriptors).toHaveLength(SOCIAL_ENABLED_STATISTICS_RECIPES.length);
    expect(new Set(descriptors.map(item => item.datasetId)).size).toBe(SOCIAL_ENABLED_STATISTICS_RECIPES.length);
    expect(descriptors.every(item => item.datasetId.startsWith("regional-statistics:") && item.access.query.enabled && item.geometry.type === "none" && item.geometry.spatialAnalysisEligible === false)).toBe(true);
    expect(descriptors.every(item => item.versions.length > 0 && item.fields.find(field => field.name === "value")?.unit)).toBe(true);
  });

  it("uses the exact recipe selector and preserves county status semantics", async () => {
    const recipe = SOCIAL_ENABLED_STATISTICS_RECIPES.find(item => item.level === "county")!;
    const load = vi.fn(async (input: Parameters<typeof import("../../data/regionalStatisticsLoader").loadRegionalStatisticsValues>[0]) => fixture(recipe, input.releaseId!));
    const executor = new QueryExecutor(createSocialStatisticsAdapters([recipe], load));
    const release = recipe.release_options[0]!;
    const result = await executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: release.release_id }, filters: [{ field: "status", op: "eq", value: "suppressed" }] });
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: "county", dimensions: release.dimensions, releaseId: release.release_id, layerKey: recipe.layer_key, allowReleaseFallback: false }), undefined);
    expect(result).toMatchObject({ freshness: release.health === "STALE" ? "stale" : "unknown", rows: [expect.objectContaining({ value: null, status: "suppressed", boundary_version: recipe.boundary_version, dimensions: release.dimensions })] });
  });

  it("queries township recipes through the same adapter family", async () => {
    const recipe = SOCIAL_ENABLED_STATISTICS_RECIPES.find(item => item.level === "township")!;
    const load = vi.fn(async (input: Parameters<typeof import("../../data/regionalStatisticsLoader").loadRegionalStatisticsValues>[0]) => fixture(recipe, input.releaseId!));
    const executor = new QueryExecutor(createSocialStatisticsAdapters([recipe], load));
    const release = recipe.release_options[0]!;
    const result = await executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: release.release_id }, select: ["area_code", "value", "status", "level", "period_end"] });
    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ area_code: "63000010", value: 0, status: "observed", level: "township", period_end: release.period_end })]));
    await expect(executor.execute({ datasetId: socialStatisticsDatasetId(recipe), parameters: { releaseId: "unregistered-release" } })).rejects.toThrow("RELEASE_NOT_ALLOWED");
  });
});
