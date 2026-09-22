import { afterEach, describe, expect, it, vi } from "vitest";
import { clearNearbyDataCache } from "../nearbyData";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { describeDataset, queryRecords, RESEARCH_QUERY_EXECUTOR, searchDatasets } from "../researchDatasets";
import { SOCIAL_ENABLED_STATISTICS_RECIPES } from "../../data/socialStatisticsRecipes";
import { LAYER_MANIFEST } from "../../data/layerManifest";

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
  it("keeps every dataset layer reference anchored to the manifest SSOT", () => {
    for (const descriptor of searchDatasets("").datasets) {
      for (const layerKey of descriptor.layerRefs) expect(LAYER_MANIFEST).toHaveProperty(layerKey);
    }
  });

  it("discovers the pilot families and compiled statistics with explicit geometry and null semantics", () => {
    expect(searchDatasets("").datasets.map(item => item.datasetId).slice(0, 6)).toEqual(["tw-schools", "tw-medical-hospitals", "tw-news-events", "land-use:paddy-area-township", "tw-schools-grid-150m", "tw-public-libraries"]);
    const schoolSearch = searchDatasets("學校", 0, 20);
    expect(new TextEncoder().encode(JSON.stringify(schoolSearch)).byteLength).toBeLessThanOrEqual(16 * 1024);
    expect(schoolSearch.datasets[0]).toMatchObject({ datasetId: expect.any(String), access: { queryEnabled: expect.any(Boolean) }, versionCount: expect.any(Number) });
    expect(schoolSearch.datasets[0]).not.toHaveProperty("fields");
    expect(schoolSearch.datasets[0]).not.toHaveProperty("versions");
    expect(RESEARCH_QUERY_EXECUTOR.descriptors().filter(item => item.datasetId.startsWith("regional-statistics:")).map(item => item.datasetId)).toHaveLength(SOCIAL_ENABLED_STATISTICS_RECIPES.length);
    expect(describeDataset("tw-news-events").geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
    expect(describeDataset("land-use:paddy-area-township").fields.find(field => field.name === "value")?.nullMeaning).toContain("suppressed");
  });

  it("does not let a guest search or describe an owner-only dataset", () => {
    const guestLocks = new Set(["newsEvents", "allenCoralAtlas"]);
    expect(searchDatasets("news", 0, 20, guestLocks).datasets.some(item => item.datasetId === "tw-news-events")).toBe(false);
    expect(() => describeDataset("tw-news-events", guestLocks)).toThrow("DATASET_NOT_FOUND");
    expect(describeDataset("tw-news-events", new Set()).access.mode).toBe("owner_only");
    expect(searchDatasets("coral", 0, 20, guestLocks).datasets).toEqual([]);
    expect(() => describeDataset("allen_coral_atlas", guestLocks)).toThrow("DATASET_NOT_FOUND");
    expect(describeDataset("allen_coral_atlas", new Set()).access).toMatchObject({ mode: "owner_only", query: { enabled: false } });
  });

  it("describes a public PMTiles pilot without claiming record access", async () => {
    const zoning = describeDataset("urban_zoning_taipei");
    expect(zoning).toMatchObject({ geometry: { type: "Polygon", spatialAnalysisEligible: false }, access: { mode: "public", method: "pmtiles_sidecar", query: { enabled: false } } });
    await expect(queryRecords({ datasetId: "urban_zoning_taipei" })).rejects.toThrow("DATASET_NOT_FOUND");
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

  it("queries the bounded convenience-store adapter while keeping source limits explicit", async () => {
    const body = JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5638, 25.0375] }, properties: { name: "甲門市", brand: "甲牌", addr: "台北市" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [121.6, 25.1] }, properties: { name: "乙門市", brand: "乙牌", addr: "" } },
    ] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-length": String(body.length) } })));
    const descriptor = describeDataset("tw-convenience-stores");
    expect(descriptor).toMatchObject({ geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, license: "unknown", access: { limits: { maxScanRows: 20_000 } } });
    expect(descriptor.coverage).toContain("status are unknown");
    const result = await queryRecords({ datasetId: "tw-convenience-stores", bbox: [121.55, 25.03, 121.57, 25.05], limit: 20 });
    expect(result).toMatchObject({ datasetId: "tw-convenience-stores", totalMatched: 1, returned: 1, freshness: "unknown" });
  });

  it("fails closed when the news source is not configured", async () => {
    await expect(queryNewsWithSupabasePayload(false, [])).rejects.toThrow("NEWS_EVENTS_SOURCE_NOT_CONFIGURED");
  });

  it("rejects null or non-array news RPC payloads, but accepts a legitimate empty array", async () => {
    await expect(queryNewsWithSupabasePayload(true, null)).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    await expect(queryNewsWithSupabasePayload(true, { events: [] })).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    await expect(queryNewsWithSupabasePayload(true, [{}])).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    await expect(queryNewsWithSupabasePayload(true, [])).resolves.toMatchObject({ datasetId: "tw-news-events", totalMatched: 0, returned: 0 });
  });
});

it("describe_dataset carries versioned semantics and prohibited claims", () => {
  for (const id of ["tw-schools", "tw-news-events", "land-use:paddy-area-township"]) {
    const card = describeDataset(id).semantics;
    expect(card?.semanticVersion).toBe("0.1.0");
    expect(card?.concepts.length).toBeGreaterThan(0);
    expect(card?.requiredEvidence.length).toBeGreaterThan(0);
    expect(card?.prohibitedClaims.length).toBeGreaterThan(0);
  }
  expect(describeDataset("tw-schools").semantics?.datasetVersion).toBeNull();
});
