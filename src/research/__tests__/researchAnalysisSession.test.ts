import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { ResearchAnalysisSession } from "../researchAnalysisSession";

afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });

describe("research analysis session", () => {
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
