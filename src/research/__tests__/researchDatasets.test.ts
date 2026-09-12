import { afterEach, describe, expect, it, vi } from "vitest";
import { clearNearbyDataCache } from "../nearbyData";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { describeDataset, queryRecords, searchDatasets } from "../researchDatasets";

afterEach(() => {
  clearNearbyDataCache();
  clearPointDatasetCache();
  vi.unstubAllGlobals();
  vi.doUnmock("../../lib/supabase");
  vi.resetModules();
});

async function queryNewsWithSupabasePayload(configured: boolean, data: unknown) {
  vi.resetModules();
  vi.doMock("../../lib/supabase", () => ({
    supabaseConfigured: configured,
    supabase: { rpc: vi.fn().mockResolvedValue({ data, error: null }) },
  }));
  const { queryRecords: queryNews } = await import("../researchDatasets");
  return queryNews({ datasetId: "tw-news-events", parameters: { date: "2026-09-11", minRelevance: 0, eventsOnly: false, minSeverity: 0 } });
}

describe("built-in research datasets", () => {
  it("discovers the three pilot families with explicit geometry and null semantics", () => {
    expect(searchDatasets("").datasets.map(item => item.datasetId)).toEqual(["tw-schools", "tw-medical-hospitals", "tw-news-events", "land-use:paddy-area-township"]);
    expect(describeDataset("tw-news-events").geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
    expect(describeDataset("land-use:paddy-area-township").fields.find(field => field.name === "value")?.nullMeaning).toContain("suppressed");
  });

  it("queries two real point adapters without consulting layer visibility", async () => {
    const schoolBody = JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { code: "A", school_name: "甲校", city: "臺北市", region_type: null } },
      { type: "Feature", geometry: null, properties: { code: "B", school_name: "缺座標校" } },
    ] });
    const hospitalBody = JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [121.52, 25.04] }, properties: { facility_id: "H1", facility_name: "甲醫院", county: "臺北市" } },
    ] });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const body = String(input).includes("medical_hospitals") ? hospitalBody : schoolBody;
      return Promise.resolve(new Response(body, { headers: { "content-length": String(body.length) } }));
    }));
    const result = await queryRecords({ datasetId: "tw-schools", select: ["record_id", "school_name", "region_type", "geometry"], filters: [{ field: "city", op: "eq", value: "臺北市" }] });
    const hospitals = await queryRecords({ datasetId: "tw-medical-hospitals", select: ["record_id", "facility_name", "county", "geometry"] });
    expect(result).toMatchObject({ datasetId: "tw-schools", totalMatched: 1, returned: 1, excludedByReason: { missing_geometry: 1 } });
    expect((result.rows as Array<Record<string, unknown>>)[0]?.region_type).toBeNull();
    expect(hospitals).toMatchObject({ datasetId: "tw-medical-hospitals", totalMatched: 1, returned: 1 });
  });

  it("fails closed when the news source is not configured", async () => {
    await expect(queryNewsWithSupabasePayload(false, [])).rejects.toThrow("NEWS_EVENTS_SOURCE_NOT_CONFIGURED");
  });

  it("rejects null or non-array news RPC payloads, but accepts a legitimate empty array", async () => {
    await expect(queryNewsWithSupabasePayload(true, null)).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    await expect(queryNewsWithSupabasePayload(true, { events: [] })).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    await expect(queryNewsWithSupabasePayload(true, [])).resolves.toMatchObject({ datasetId: "tw-news-events", totalMatched: 0, returned: 0 });
  });
});
