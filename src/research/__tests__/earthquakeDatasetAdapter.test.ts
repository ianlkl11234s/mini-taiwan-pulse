import { describe, expect, it, vi } from "vitest";
import { createEarthquakeReplayAdapter, earthquakeReplayDescriptor, type EarthquakeReplayRawRow } from "../earthquakeDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const event = (overrides: Partial<EarthquakeReplayRawRow> = {}): EarthquakeReplayRawRow => ({
  event_id: "115064", occurred_at: "2026-09-21T21:16:13Z", magnitude: 4.2, depth_km: 7.5,
  epicenter_lng: 120.54, epicenter_lat: 23.21, location: null, station_count: 26,
  has_town: true, town_origin_time: null, has_grid: false, grid_event_time: null, has_tensor: true, tensor_origin_utc: null,
  ...overrides,
});

function executor(fetcher = vi.fn(async () => [event()])) {
  return { fetcher, query: new QueryExecutor([createEarthquakeReplayAdapter(fetcher)]) };
}

describe("CWA earthquake replay research adapter", () => {
  it("requires an eventId and only invokes its injected bounded fetcher with that id", async () => {
    const { fetcher, query } = executor();
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId })).rejects.toThrow("EARTHQUAKE_QUERY_SELECTOR_REQUIRED");
    await query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" }, limit: 2 });
    expect(fetcher).toHaveBeenCalledWith("115064", undefined);
  });

  it("requires an explicit bounded ISO window, keeps exact and window selectors exclusive, and orders the 50-row source window deterministically", async () => {
    const exact = vi.fn(async () => [event()]);
    const window = vi.fn(async () => [event({ event_id: "b", occurred_at: "2026-09-21T12:00:00Z" }), event({ event_id: "a", occurred_at: "2026-09-21T12:00:00Z" })]);
    const query = new QueryExecutor([createEarthquakeReplayAdapter(exact, window)]);
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z" } })).rejects.toThrow("EARTHQUAKE_WINDOW_REQUIRED");
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-29T00:00:00Z" } })).rejects.toThrow("INVALID_EARTHQUAKE_WINDOW");
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064", occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" } })).rejects.toThrow("EARTHQUAKE_QUERY_SELECTOR_CONFLICT");
    const result = await query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" }, limit: 50 });
    expect(window).toHaveBeenCalledWith({ occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z", limit: 51 }, undefined);
    expect(result.rows.map(row => row.event_id)).toEqual(["a", "b"]);
    expect(result).toMatchObject({ freshness: "unknown", sourceRefs: [expect.objectContaining({ acquiredAt: expect.any(String), version: expect.stringContaining("window:") })] });
  });

  it("accepts exactly 50 rows but rejects the 51st sentinel row instead of silently truncating", async () => {
    const rows50 = Array.from({ length: 50 }, (_, index) => event({ event_id: `E${index}`, occurred_at: `2026-09-21T00:${String(index % 60).padStart(2, "0")}:00Z` }));
    const accepted = new QueryExecutor([createEarthquakeReplayAdapter(vi.fn(async () => [event()]), vi.fn(async () => rows50))]);
    await expect(accepted.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" }, limit: 50 })).resolves.toMatchObject({ totalMatched: 50, freshness: "unknown" });
    const rows = Array.from({ length: 51 }, (_, index) => event({ event_id: `E${index}`, occurred_at: `2026-09-21T00:${String(index % 60).padStart(2, "0")}:00Z` }));
    const query = new QueryExecutor([createEarthquakeReplayAdapter(vi.fn(async () => [event()]), vi.fn(async () => rows))]);
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" } })).rejects.toThrow("EARTHQUAKE_WINDOW_TOO_DENSE");
  });

  it("rejects local-time windows and window rows that violate source filter, timestamp, or event-id contracts", async () => {
    const exact = vi.fn(async () => [event()]);
    const window = vi.fn(async () => [event({ event_id: "", occurred_at: "2026-09-21T12:00:00Z" })]);
    const query = new QueryExecutor([createEarthquakeReplayAdapter(exact, window)]);
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00", occurredBefore: "2026-09-22T00:00:00" } })).rejects.toThrow("INVALID_EARTHQUAKE_WINDOW");
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" } })).rejects.toThrow("EARTHQUAKE_EVENT_ID_FILTER_CONTRACT_MISMATCH");
    const outOfWindow = new QueryExecutor([createEarthquakeReplayAdapter(exact, vi.fn(async () => [event({ event_id: "outside", occurred_at: "2026-09-22T00:00:00Z" })]))]);
    await expect(outOfWindow.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { occurredAfter: "2026-09-21T00:00:00Z", occurredBefore: "2026-09-22T00:00:00Z" } })).rejects.toThrow("EARTHQUAKE_WINDOW_FILTER_CONTRACT_MISMATCH");
  });

  it("preserves CWA null magnitude/depth and the two-decimal actual epicenter receipt", async () => {
    const { query } = executor(vi.fn(async () => [event({ magnitude: null, depth_km: null })]));
    const result = await query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } });
    expect(result.rows[0]).toMatchObject({ magnitude: null, depth_km: null, geometry: { type: "Point", coordinates: [120.54, 23.21] } });
    expect(result.sourceRefs[0]).toMatchObject({ sourceId: "cwa-earthquake-replay-events", checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(result.coverage).toContain("not a complete earthquake catalog");
  });

  it("retains a missing epicenter as null geometry and excludes invalid coordinates explicitly", async () => {
    const missing = executor(vi.fn(async () => [event({ epicenter_lng: null, epicenter_lat: null })]));
    await expect(missing.query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).resolves.toMatchObject({ rows: [expect.objectContaining({ geometry: null })], excludedByReason: expect.objectContaining({ missing_geometry: 1 }) });
    const invalid = executor(vi.fn(async () => [event({ epicenter_lng: 181 })]));
    await expect(invalid.query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).resolves.toMatchObject({ rows: [expect.objectContaining({ geometry: null })], excludedByReason: expect.objectContaining({ invalid_geometry: 1 }) });
  });

  it("does not turn an invalid event time into a queryable event", async () => {
    const { query } = executor(vi.fn(async () => [event({ occurred_at: "not-a-time" })]));
    await expect(query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).resolves.toMatchObject({ totalMatched: 0, excludedByReason: expect.objectContaining({ invalid_occurred_at: 1 }) });
  });

  it("rejects duplicate or incorrectly filtered RPC output and propagates source failure", async () => {
    const duplicate = executor(vi.fn(async () => [event(), event()]));
    await expect(duplicate.query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).rejects.toThrow("DUPLICATE_EARTHQUAKE_EVENT_ID");
    const wrong = executor(vi.fn(async () => [event({ event_id: "other" })]));
    await expect(wrong.query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).rejects.toThrow("EARTHQUAKE_EVENT_ID_FILTER_CONTRACT_MISMATCH");
    const unavailable = executor(vi.fn(async () => { throw new Error("source unavailable"); }));
    await expect(unavailable.query.execute({ datasetId: earthquakeReplayDescriptor.datasetId, parameters: { eventId: "115064" } })).rejects.toThrow("source unavailable");
  });
});
