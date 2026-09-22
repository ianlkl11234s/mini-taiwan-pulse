import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { assertResultCollectionBudget, presentationMetrics, ResearchAnalysisSession } from "../researchAnalysisSession";

afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });

describe("research analysis session", () => {
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

  it("creates a derived center and straight-line scope without making either spatial-analysis eligible", () => {
    const session = new ResearchAnalysisSession();
    const scope = session.execute("create_analysis_scope", { center: [121.5638, 25.0375], radiusM: 1000, label: "市府周邊" });
    expect(scope).toMatchObject({ center: [121.5638, 25.0375], radiusM: 1000, distanceModel: "WGS84_spherical_geodesic", networkAccessibility: false });
    const resultIds = scope.resultIds as string[];
    expect(resultIds).toHaveLength(2);
    const [area, center] = session.presentable(resultIds);
    expect(area).toMatchObject({ geometry: { type: "Polygon", role: "generalized", spatialAnalysisEligible: false } });
    expect(center).toMatchObject({ geometry: { type: "Point", role: "generalized", spatialAnalysisEligible: false } });
    expect((area!.rows[0]!.geometry as { coordinates: unknown[][] }).coordinates[0]).toHaveLength(65);
    expect(() => session.execute("spatial_query", { resultId: resultIds[1], predicate: "within_distance", center: [121.5638, 25.0375], radiusM: 1000 })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
    expect(() => session.execute("create_analysis_scope", { center: [121.5638, 25.0375], radiusM: 0 })).toThrow("INVALID_DISTANCE_RADIUS");
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
});
