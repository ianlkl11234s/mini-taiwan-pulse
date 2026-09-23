import { afterEach, describe, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ configured: true, rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ get supabaseConfigured() { return source.configured; }, supabase: { rpc: source.rpc } }));

import { createRoadEventCurrentAdapter, fetchRoadEventsCurrent, roadEventCurrentDescriptor, type RoadEventCurrentRawRow } from "../roadEventDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const raw = (overrides: Partial<RoadEventCurrentRawRow> = {}): RoadEventCurrentRawRow => ({ event_id: "E1", source: "live_freeway", event_type: 3, severity: 2, road_name: "國道一號", direction: "北向", start_km: null, end_km: null, title: "事故", description: null, location_other: null, blocked_lanes: null, geom: '{"type":"Point","coordinates":[121,25]}', matched_section_id: null, enrich_status: null, effective_time: "2026-09-23T00:00:00Z", expire_time: "2099-09-23T00:00:00Z", last_updated: "2026-09-23T00:01:00Z", ...overrides });
const NOW = new Date("2026-09-23T12:00:00Z");
function query(rows: readonly RoadEventCurrentRawRow[]) { const fetcher = vi.fn(async () => rows); return { fetcher, executor: new QueryExecutor([createRoadEventCurrentAdapter(fetcher, () => NOW)]) }; }
const input = (parameters: Record<string, string | number> = { source: "live_freeway" }) => ({ datasetId: roadEventCurrentDescriptor.datasetId, parameters });

afterEach(() => {
  source.configured = true;
  source.rpc.mockReset();
});

describe("TDX current road-event research adapter", () => {
  it("requires an allowlisted source and uses a 51-row RPC sentinel while retaining mixed source geometry outside analysis geometry", async () => {
    const current = query([raw({ geom: '{"type":"LineString","coordinates":[[121,25],[121.1,25.1]]}' })]);
    const result = await current.executor.execute(input());
    expect(current.fetcher).toHaveBeenCalledWith({ source: "live_freeway", eventType: null, unexpiredOnly: true, limit: 51 }, undefined);
    expect(roadEventCurrentDescriptor.geometry).toMatchObject({ type: "none", spatialAnalysisEligible: false });
    expect(result.freshness).toBe("unknown");
    expect(result.rows[0]).toMatchObject({ source_geometry: { type: "LineString" }, source_geometry_status: "parsed", lifecycle_status: "active", assessed_at: "2026-09-23T12:00:00.000Z" });
    await expect(current.executor.execute(input({ source: "unknown" }))).rejects.toThrow("ROAD_EVENT_SOURCE_NOT_ALLOWED");
    await expect(current.executor.execute(input({ source: "live_freeway", eventType: 99 }))).rejects.toThrow("ROAD_EVENT_TYPE_NOT_ALLOWED");
    await expect(current.executor.execute({ ...input(), parameters: { source: "live_freeway", unexpiredOnly: "true" as unknown as boolean } })).rejects.toThrow("PARAMETER_NOT_ALLOWED");
  });

  it("defaults to server-side unexpired filtering but permits an explicit false scope without local expiry filtering", async () => {
    const current = query([raw({ event_id: "expired-but-requested", effective_time: "2000-01-01T00:00:00Z", expire_time: "2000-01-02T00:00:00Z" })]);
    const result = await current.executor.execute({ ...input(), parameters: { source: "live_freeway", unexpiredOnly: false } });
    expect(current.fetcher).toHaveBeenCalledWith({ source: "live_freeway", eventType: null, unexpiredOnly: false, limit: 51 }, undefined);
    expect(result.rows[0]).toMatchObject({ lifecycle_status: "expired" });
    expect(result.coverage).toContain("unexpiredOnly=false");
    expect(result.sourceRefs[0]?.version).toContain("unexpiredOnly=false");
  });

  it("classifies only complete valid source intervals and never infers retraction from snapshot absence", async () => {
    const rows = [raw({ event_id: "scheduled", effective_time: "2099-01-01T00:00:00Z", expire_time: "2099-01-02T00:00:00Z" }), raw({ event_id: "expired", effective_time: "2000-01-01T00:00:00Z", expire_time: "2000-01-02T00:00:00Z" }), raw({ event_id: "at-start", effective_time: "2026-09-23T12:00:00Z", expire_time: "2026-09-24T00:00:00Z" }), raw({ event_id: "at-expire", effective_time: "2026-09-23T00:00:00Z", expire_time: "2026-09-23T12:00:00Z" }), raw({ event_id: "unknown", effective_time: null, expire_time: null }), raw({ event_id: "bad", effective_time: "not-time", expire_time: "2026-01-01T00:00:00Z" }), raw({ event_id: "backward", effective_time: "2026-09-24T00:00:00Z", expire_time: "2026-09-23T00:00:00Z" })];
    const result = await query(rows).executor.execute(input());
    expect(result.rows.map(row => [row.event_id, row.lifecycle_status])).toEqual([["scheduled", "scheduled"], ["expired", "expired"], ["at-start", "active"], ["at-expire", "expired"], ["unknown", "unknown"], ["bad", "unknown"], ["backward", "unknown"]]);
    expect(result.rows.find(row => row.event_id === "bad")).toMatchObject({ effective_time_raw: "not-time", effective_time: null });
    expect(result.coverage).toContain("not retractions");
  });

  it("validates source/type/identity before rejecting an otherwise dense 51-row response", async () => {
    await expect(query(Array.from({ length: 51 }, (_, index) => raw({ event_id: `E${index}` }))).executor.execute(input())).rejects.toThrow("ROAD_EVENT_WINDOW_TOO_DENSE");
    await expect(query(Array.from({ length: 51 }, (_, index) => raw({ event_id: `E${index}`, source: index === 50 ? "live_city" : "live_freeway" }))).executor.execute(input())).rejects.toThrow("ROAD_EVENT_SOURCE_FILTER_CONTRACT_MISMATCH");
    await expect(query(Array.from({ length: 51 }, (_, index) => raw({ event_id: `E${index}`, event_type: index === 50 ? 2 : 3 }))).executor.execute(input({ source: "live_freeway", eventType: 3 }))).rejects.toThrow("ROAD_EVENT_TYPE_FILTER_CONTRACT_MISMATCH");
    await expect(query([raw({ source: "live_city" })]).executor.execute(input())).rejects.toThrow("ROAD_EVENT_SOURCE_FILTER_CONTRACT_MISMATCH");
    await expect(query([raw({ event_type: 2 })]).executor.execute(input({ source: "live_freeway", eventType: 3 }))).rejects.toThrow("ROAD_EVENT_TYPE_FILTER_CONTRACT_MISMATCH");
    await expect(query([raw(), raw()]).executor.execute(input())).rejects.toThrow("DUPLICATE_ROAD_EVENT_ID");
    await expect(query([raw({ geom: "not-json" })]).executor.execute(input())).resolves.toMatchObject({ rows: [expect.objectContaining({ source_geometry_raw: "not-json", source_geometry: null, source_geometry_status: "unparseable" })], excludedByReason: {} });
  });

  it("pushes bounded selectors and caller abort signal into the RPC transport, and propagates its error", async () => {
    const signal = new AbortController().signal;
    const request = { abortSignal: vi.fn() };
    request.abortSignal.mockResolvedValueOnce({ data: [raw()], error: null });
    source.rpc.mockReturnValueOnce(request);
    await expect(fetchRoadEventsCurrent({ source: "live_highway", eventType: 3, unexpiredOnly: false, limit: 51 }, signal)).resolves.toEqual([raw()]);
    expect(source.rpc).toHaveBeenCalledWith("get_road_events_current", { p_source: "live_highway", p_event_type: 3, p_only_active: false, p_limit: 51 });
    expect(request.abortSignal).toHaveBeenCalledWith(signal);

    const failedRequest = { data: null, error: { message: "denied" }, abortSignal: vi.fn() };
    source.rpc.mockReturnValueOnce(failedRequest);
    await expect(fetchRoadEventsCurrent({ source: "live_freeway", eventType: null, unexpiredOnly: true, limit: 51 })).rejects.toThrow("Supabase get_road_events_current (live_freeway): denied");
    expect(failedRequest.abortSignal).not.toHaveBeenCalled();

    source.configured = false;
    await expect(fetchRoadEventsCurrent({ source: "live_freeway", eventType: null, unexpiredOnly: true, limit: 51 }, signal)).rejects.toThrow("Supabase not configured");
    expect(source.rpc).toHaveBeenCalledTimes(2);
  });
});
