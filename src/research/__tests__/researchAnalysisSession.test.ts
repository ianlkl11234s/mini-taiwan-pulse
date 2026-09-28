import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { assertResultCollectionBudget, presentationMetrics, ResearchAnalysisSession } from "../researchAnalysisSession";
import { validQueryResultData } from "../QueryResponder";

afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });

describe("research analysis session", () => {
  it("labels multi-source comparison results with descriptor labels while preserving unknown ids", () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    const common = { recordGrain: "metric", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] } }], sourceRefs: [], coverage: "fixture", freshness: "current", units: {}, operation: "compare_regions", inputResultIds: ["left", "right"], method: {}, summary: {} };
    store.put({ ...common, resultId: "known-comparison", datasetId: "tw-schools+tw-public-libraries" });
    store.put({ ...common, resultId: "unknown-comparison", datasetId: "fixture-left+fixture-right" });
    expect(session.presentable(["known-comparison"])[0]?.displayLabel).toBe("全國各級學校＋公共圖書館 比較");
    expect(session.presentable(["unknown-comparison"])[0]?.displayLabel).toBe("fixture-left＋fixture-right 比較");
  });

  it("keeps raw and normalized units on the session presentation contract", () => {
    const session = new ResearchAnalysisSession();
    (session as unknown as { store: { put: (value: object) => void } }).store.put({
      resultId: "comparison", datasetId: "fixture-comparison", recordGrain: "metric", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      rows: [{ status: "observed", value: 20, normalizedValue: 12.5, geometry: { type: "Point", coordinates: [121.5, 25] } }],
      sourceRefs: [], coverage: "fixture", freshness: "current", units: { value: "cases", normalizedValue: "cases per 10000 persons" },
    });
    expect(session.presentable(["comparison"])).toEqual([expect.objectContaining({
      units: { value: "cases", normalizedValue: "cases per 10000 persons" },
    })]);
  });

  it("counts polygon holes and multipolygon parts in generic map bounds", () => {
    const polygon = presentationMetrics([{ geometry: {
      type: "Polygon", coordinates: [
        [[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]],
        [[121.52, 25.02], [121.54, 25.02], [121.54, 25.04], [121.52, 25.04], [121.52, 25.02]],
      ],
    } }], "Polygon");
    const multiPolygon = presentationMetrics([{ geometry: {
      type: "MultiPolygon", coordinates: [
        [[[121.7, 25], [121.71, 25], [121.71, 25.01], [121.7, 25.01], [121.7, 25]]],
        [[[121.72, 25], [121.73, 25], [121.73, 25.01], [121.72, 25.01], [121.72, 25]]],
      ],
    } }], "MultiPolygon");
    expect(polygon.vertexCount).toBe(10);
    expect(multiPolygon.vertexCount).toBe(10);
    expect([...polygon.positions, ...multiPolygon.positions]).toEqual(expect.arrayContaining([[121.52, 25.02], [121.73, 25.01]]));
    const session = new ResearchAnalysisSession();
    (session as unknown as { store: { put: (value: object) => void } }).store.put({
      resultId: "multipart", datasetId: "fixture", recordGrain: "place", geometry: { type: "MultiPolygon", role: "generalized", spatialAnalysisEligible: false },
      rows: [{ geometry: {
        type: "MultiPolygon", coordinates: [
          [[[121.7, 25], [121.71, 25], [121.71, 25.01], [121.7, 25.01], [121.7, 25]]],
          [[[121.72, 25], [121.73, 25], [121.73, 25.01], [121.72, 25.01], [121.72, 25]]],
        ],
      } }], sourceRefs: [], coverage: "fixture", freshness: "current", units: {},
    });
    expect(session.bounds(["multipart"])).toMatchObject({ bounds: [121.7, 25, 121.73, 25.01], featureCount: 1, vertexCount: 10 });
  });

  it("rejects a result collection above its feature budget", () => {
    const metrics = presentationMetrics(Array.from({ length: 10_001 }, (_, index) => ({ geometry: { type: "Point", coordinates: [121.5 + index / 1_000_000, 25] } })), "Point");
    expect(() => assertResultCollectionBudget([metrics])).toThrow("RESULT_COLLECTION_FEATURE_LIMIT");
  });

  it.runIf(process.env.RUN_RAW_BOUNDARY_INTEGRATION === "1")("presents all 22 raw counties with source and comparison values intact", async () => {
    const raw = new URL("../../../../../../../taipei-gis-analytics/data/processed/demographics/county_boundary/county_boundary_20260626.geojson", import.meta.url);
    const sourceBytes = await readFile(raw);
    const source = JSON.parse(new TextDecoder().decode(sourceBytes)) as { features: Array<{ properties: { 行政區域代碼: string }; geometry: Record<string, unknown> }> };
    const vertexCount = (value: unknown): number => Array.isArray(value) ? (typeof value[0] === "number" ? 1 : value.reduce((sum, item) => sum + vertexCount(item), 0)) : 0;
    expect(source.features).toHaveLength(22);
    expect(sourceBytes.byteLength).toBe(14_719_725);
    expect(source.features.reduce((sum, feature) => sum + vertexCount(feature.geometry.coordinates), 0)).toBe(332_091);

    const session = new ResearchAnalysisSession();
    const resultId = "raw-county-22-comparison";
    const sourceRef = { sourceId: "county-boundary", version: "COUNTY_MOI_1140318", acquiredAt: "2026-09-23T00:00:00Z", checksumSha256: "5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6", reference: "local-preview://county-boundary" };
    const rows = source.features.map((feature, index) => ({ area_code: feature.properties.行政區域代碼, status: "observed", comparison_status: "valid", value: 1_000 + index, normalizedValue: 10 + index / 10, geometry: feature.geometry }));
    (session as unknown as { store: { put: (value: object) => void } }).store.put({
      resultId, datasetId: "statistics:county-comparison", recordGrain: "metric", geometry: { type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true }, rows,
      sourceRefs: [sourceRef], coverage: "22 county-level observations; raw COUNTY_MOI_1140318 boundaries.", freshness: "current", units: { value: "persons", normalizedValue: "persons per 1000 persons" },
      lineage: { sourceContract: { datasetId: "statistics:county-comparison", boundaryVersion: "COUNTY_MOI_1140318" } },
    });

    const presented = session.presentable([resultId]);
    expect(presented[0]?.rows).toHaveLength(22);
    expect(presented[0]?.rows.map(row => row.value)).toEqual(rows.map(row => row.value));
    expect(session.bounds([resultId])).toMatchObject({ featureCount: 22, vertexCount: 332_091, bounds: [114.35928247200002, 10.371347663000051, 124.56115802500004, 26.38527526200005] });
    expect(session.execute("get_analysis_result", { resultId, limit: 50 })).toMatchObject({ totalRows: 22, sourceRefs: [sourceRef], rows: expect.arrayContaining([expect.objectContaining({ area_code: rows[0]?.area_code, value: 1_000, normalizedValue: 10 })]) });
  });

  it("treats a series (geometry:none) result as map-ineligible, and a spatial one as eligible", () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    store.put({
      resultId: "points", datasetId: "fixture-points", recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] } }], sourceRefs: [], coverage: "fixture", freshness: "current", units: {},
    });
    store.put({
      resultId: "series-result", datasetId: "fixture-events", recordGrain: "series", geometry: { type: "none", role: "none", spatialAnalysisEligible: false },
      rows: [{ period_start: "2026-09-01T00:00:00+08:00", value: 4, records: 1, missing_value: 0 }],
      sourceRefs: [], coverage: "fixture", freshness: "current", units: { value: "items" },
    });
    expect(session.mapEligible("points")).toBe(true);
    expect(session.mapEligible("series-result")).toBe(false);
    expect(session.mapEligible("does-not-exist")).toBe(false);
    expect(() => session.presentable(["points", "series-result"])).toThrow("RESULT_NOT_MAP_ELIGIBLE");
  });

  it("reads a series result's rows without the map-eligibility gate, and returns null for a non-series or missing id", () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    store.put({
      resultId: "series-result", datasetId: "fixture-events", recordGrain: "series", geometry: { type: "none", role: "none", spatialAnalysisEligible: false },
      rows: [
        { period_start: "2026-09-01T00:00:00+08:00", value: 4, records: 1, missing_value: 0 },
        { period_start: "2026-09-02T00:00:00+08:00", value: null, records: 1, missing_value: 1 },
      ],
      sourceRefs: [], coverage: "fixture", freshness: "current", units: { value: "items" },
    });
    store.put({
      resultId: "points", datasetId: "fixture-points", recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] } }], sourceRefs: [], coverage: "fixture", freshness: "current", units: {},
    });
    expect(session.seriesResult("series-result")).toMatchObject({
      resultId: "series-result", units: { value: "items" },
      rows: [{ period_start: "2026-09-01T00:00:00+08:00", value: 4 }, { period_start: "2026-09-02T00:00:00+08:00", value: null }],
    });
    expect(session.seriesResult("points")).toBeNull(); // spatial, not a series result
    expect(session.seriesResult("does-not-exist")).toBeNull();
  });

  it("dispatches generic point-to-area joins and area aggregation by result id", () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    const common = { recordGrain: "place", sourceRefs: [], coverage: "fixture", freshness: "current", units: {} };
    store.put({
      ...common, resultId: "points", datasetId: "fixture-points", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      rows: [
        { name: "inside", geometry: { type: "Point", coordinates: [121.51, 25.01] } },
        { name: "boundary", geometry: { type: "Point", coordinates: [121.5, 25.01] } },
      ],
    });
    store.put({
      ...common, resultId: "areas", datasetId: "fixture-areas", geometry: { type: "Polygon", role: "actual", spatialAnalysisEligible: true },
      rows: [{ area: "A", geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.52, 25], [121.52, 25.02], [121.5, 25.02], [121.5, 25]]] } }],
    });

    const within = session.execute("spatial_query", { pointResultId: "points", areaResultId: "areas", predicate: "within", limit: 20 });
    expect(within).toMatchObject({ totalRows: 1, summary: { matchedPoints: 1, unmatchedPoints: 1 } });
    const aggregate = session.execute("aggregate_by_area", { pointResultId: "points", areaResultId: "areas", predicate: "intersects", outputField: "poi_count", limit: 20 });
    expect(aggregate).toMatchObject({ totalRows: 1, rows: [{ area: "A", poi_count: 2 }], summary: { boundaryMatches: 1, zeroAreas: 0 } });
    expect(session.presentable([String(aggregate.resultId)])).toHaveLength(1);
  });

  it("finds the source-observed administrative area containing an explicit map coordinate", () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    store.put({
      resultId: "admin-areas", datasetId: "fixture-admin", recordGrain: "feature", geometry: { type: "Polygon", role: "actual", spatialAnalysisEligible: true },
      rows: [{ district: "甲區", geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }], sourceRefs: [], coverage: "fixture boundary", freshness: "current", units: {}, lineage: { source: "fixture" },
    });
    const found = session.execute("spatial_query", { predicate: "contains_center", areaResultId: "admin-areas", center: [121.55, 25.05] });
    expect(found).toMatchObject({ totalRows: 1, rows: [expect.objectContaining({ district: "甲區" })], method: { predicate: "contains_center", centerSource: "map_or_user_coordinate" }, sourceRefs: [], lineage: { inputs: [expect.objectContaining({ resultId: "admin-areas" })] } });
    expect(session.presentable([String(found.resultId)])).toEqual([expect.objectContaining({ geometry: { type: "Polygon", role: "actual", spatialAnalysisEligible: true }, rows: [expect.objectContaining({ district: "甲區" })] })]);
    expect(session.execute("spatial_query", { predicate: "contains_center", areaResultId: "admin-areas", center: [121.5, 25.05] })).toMatchObject({ totalRows: 0, summary: { matchedAreas: 0 } });
  });

  it("creates a derived center and straight-line scope without making either spatial-analysis eligible", () => {
    const session = new ResearchAnalysisSession();
    const scope = session.execute("create_analysis_scope", { center: [121.5638, 25.0375], radiusM: 1000, label: "市府周邊" });
    expect(scope).toMatchObject({ center: [121.5638, 25.0375], radiusM: 1000, distanceModel: "WGS84_spherical_geodesic", networkAccessibility: false });
    const resultIds = scope.resultIds as string[];
    expect(resultIds).toHaveLength(2);
    const [area, center] = session.presentable(resultIds);
    expect(area).toMatchObject({ displayLabel: "市府周邊・範圍", geometry: { type: "Polygon", role: "generalized", spatialAnalysisEligible: false } });
    expect(center).toMatchObject({ displayLabel: "市府周邊・中心點", geometry: { type: "Point", role: "generalized", spatialAnalysisEligible: false } });
    expect((area!.rows[0]!.geometry as { coordinates: unknown[][] }).coordinates[0]).toHaveLength(65);
    expect(scope).toMatchObject({ area: { resultId: resultIds[0], geometryType: "Polygon", spatialAnalysisEligible: false }, centerResult: { resultId: resultIds[1], geometryType: "Point", spatialAnalysisEligible: false } });
    expect(validQueryResultData(scope)).toBe(true);
    expect(() => session.execute("spatial_query", { resultId: resultIds[1], predicate: "within_distance", center: [121.5638, 25.0375], radiusM: 1000 })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
    expect(() => session.execute("create_analysis_scope", { center: [121.5638, 25.0375], radiusM: 0 })).toThrow("INVALID_DISTANCE_RADIUS");
  });

  it("stores walking contours as independently presentable and spatially eligible derived boundaries", () => {
    const session = new ResearchAnalysisSession();
    const receipt = session.storeWalkingIsochrone({
      status: "READY", operation: "walking_isochrone", provider: "valhalla", mode: "pedestrian", endpointClass: "public_demo", sendsCoordinatesExternally: true,
      externalConsent: true,
      request: { center: [121.5, 25], contoursMinutes: [5, 10] },
      graph: { engineVersion: "3.5.1", tilesetLastModified: "2026-09-20T00:00:00.000Z", osmChangeset: 123, checksumSha256: null, provenanceCompleteness: "provider_status_without_checksum", observedAt: "2026-09-22T00:00:00.000Z" },
      contours: [
        { minutes: 10, vertexCount: 5, geometry: { type: "MultiPolygon", coordinates: [[[[121.4, 24.9], [121.6, 24.9], [121.6, 25.1], [121.4, 25.1], [121.4, 24.9]]]] } },
        { minutes: 5, vertexCount: 5, geometry: { type: "MultiPolygon", coordinates: [[[[121.45, 24.95], [121.55, 24.95], [121.55, 25.05], [121.45, 25.05], [121.45, 24.95]]]] } },
      ],
      snapDistanceM: null, unreachable: false, disconnected: null, warnings: ["fixture"], limitations: ["fixture"], guarantees: ["no_haversine_fallback"],
    });
    const resultIds = (receipt.result as { resultIds: string[] }).resultIds;
    expect(resultIds).toHaveLength(2);
    expect(session.presentable(resultIds)).toEqual([
      expect.objectContaining({ displayLabel: "步行 10 分鐘", geometry: { type: "MultiPolygon", role: "derived", spatialAnalysisEligible: true } }),
      expect.objectContaining({ displayLabel: "步行 5 分鐘", geometry: { type: "MultiPolygon", role: "derived", spatialAnalysisEligible: true } }),
    ]);

    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    store.put({
      resultId: "points-for-walk", datasetId: "fixture-points", recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      rows: [
        { name: "inside", geometry: { type: "Point", coordinates: [121.5, 25] } },
        { name: "boundary", geometry: { type: "Point", coordinates: [121.45, 25] } },
        { name: "outside", geometry: { type: "Point", coordinates: [122, 25] } },
      ],
      sourceRefs: [], coverage: "fixture candidate scope", freshness: "current", units: {},
      excludedByReason: { missing_geometry: 2 },
      lineage: { queryScope: { datasetId: "fixture-points", bbox: [121.4, 24.9, 121.6, 25.1], totalMatched: 3 } },
    });
    const coverage = session.execute("spatial_query", { pointResultId: "points-for-walk", areaResultId: resultIds[1], predicate: "within", limit: 20 });
    expect(session.presentable([coverage.resultId as string])[0]?.displayLabel).toBe("fixture-points・範圍篩選");
    expect(coverage).toMatchObject({
      totalRows: 1,
      rows: [expect.objectContaining({ name: "inside" })],
      method: { predicate: "within", boundaryRule: "boundary_excluded" },
      summary: { pointRows: 3, matchedPoints: 1, unmatchedPoints: 2 },
    });
    expect((coverage.lineage as { inputs: unknown[] }).inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ resultId: "points-for-walk", lineage: expect.objectContaining({ queryScope: expect.objectContaining({ totalMatched: 3 }) }) }),
    ]));
    expect(session.execute("get_data_quality", { resultId: coverage.resultId })).toMatchObject({
      rows: 1, excludedByReason: { missing_geometry: 2 }, coverage: expect.stringContaining("fixture candidate scope"),
    });
    expect(session.execute("spatial_query", { pointResultId: "points-for-walk", areaResultId: resultIds[1], predicate: "intersects", limit: 20 }))
      .toMatchObject({ totalRows: 2, summary: { matchedPoints: 2, unmatchedPoints: 1 } });
  });

  it("composes query, spatial, aggregate, quality, paging and removal by resultId", async () => {
    const body = JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { code: "A", school_name: "甲", city: "臺北市" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [121.51, 25] }, properties: { code: "B", school_name: "乙", city: "臺北市" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { code: "C", school_name: "丙", city: null } },
    ] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-length": String(body.length) } })));
    const session = new ResearchAnalysisSession();
    const plan = await session.planDataAccess({ datasetId: "tw-schools", limit: 2 });
    expect(plan).toMatchObject({ datasetId: "tw-schools", costKnown: false, estimatedDownloadBytes: null, requiresApproval: false });
    const plannedResult = await session.materializeData(plan.planId);
    expect(plannedResult).toMatchObject({ planId: plan.planId, materialized: true, result: { totalMatched: 3 } });
    await expect(session.materializeData(plan.planId)).rejects.toThrow("PLAN_NOT_FOUND_OR_EXPIRED");
    const scoped = await session.queryRecords({ datasetId: "tw-schools", bbox: [121.4, 24.9, 121.6, 25.1], limit: 1 });
    const scopedEvidence = session.execute("get_data_quality", { resultId: scoped.resultId });
    expect(scopedEvidence).toMatchObject({ rows: 2, lineage: {
      queryScope: { datasetId: "tw-schools", bbox: [121.4, 24.9, 121.6, 25.1], parameters: {}, filters: [], time: null, totalMatched: 2 },
      sourceContract: { datasetId: "tw-schools", recordGrain: "place", geometry: { type: "Point", role: "actual" } },
    } });
    session.execute("remove_result", { resultId: scoped.resultId });
    const queried = await session.queryRecords({ datasetId: "tw-schools", limit: 2 });
    expect(queried).toMatchObject({ totalMatched: 3, returned: 2, displayTruncated: true });
    const resultId = String(queried.resultId);
    const nearby = session.execute("spatial_query", { resultId, predicate: "within_distance", center: [121.5, 25], radiusM: 1500, limit: 10 });
    expect(nearby).toMatchObject({ totalRows: 2, truncated: false });
    const aggregate = session.execute("aggregate_records", { resultId, operation: "count", groupBy: ["city"], limit: 10 });
    expect(aggregate).toMatchObject({ totalRows: 2 });
    expect(session.presentable([resultId])).toHaveLength(1);
    expect(session.bounds([resultId])).toMatchObject({ bounds: [120, 23, 121.51, 25], pointCount: 3 });
    expect(() => session.presentable([String(aggregate.resultId)])).toThrow("RESULT_NOT_MAP_ELIGIBLE");
    expect(session.execute("get_data_quality", { resultId })).toMatchObject({ rows: 3, nullByField: { city: 1 } });
    expect((session.execute("list_results", {}).results as unknown[]).length).toBe(3);
    expect(session.execute("get_analysis_result", { resultId, offset: 2, limit: 1 })).toMatchObject({ returned: 1, nextOffset: null });
    expect(session.execute("remove_result", { resultId })).toEqual({ resultId, removed: true });
    expect(() => session.execute("get_analysis_result", { resultId })).toThrow("RESULT_NOT_FOUND_OR_EXPIRED");
  });

  it("validates required plan selectors before materialization", async () => {
    const session = new ResearchAnalysisSession();
    await expect(session.planDataAccess({ datasetId: "regional-statistics:statsEducationCountyStudentTeacherRatio" })).rejects.toThrow("REQUIRED_PARAMETER_MISSING");
  });
});
