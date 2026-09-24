import { describe, it, expect, vi } from "vitest";
import { MAX_QUERY_RESULT_BYTES, MAX_QUERY_RESULT_STRING_LENGTH, QueryResponder, queryPollDelay, validQueryResultData } from "../QueryResponder";
import { BridgeError, type BridgeConnectionContext } from "../bridgeClient";
import { ResearchAnalysisSession } from "../researchAnalysisSession";
const request = { requestId: "query-1", operation: "map_context", args: {}, expiresAt: Date.now() + 30_000 };
function setup(execute = vi.fn().mockResolvedValue({ camera: [121, 25] }), onActivity = vi.fn()) {
  const client = { query: vi.fn().mockResolvedValue({ request }), queryResult: vi.fn().mockResolvedValue(undefined) };
  const onHealth = vi.fn();
  const responder = new QueryResponder({ client, studyId: "study", tabId: "tab" } as unknown as BridgeConnectionContext, execute, vi.fn(), onActivity, onHealth);
  return { client, responder, execute, onActivity, onHealth };
}
describe("QueryResponder", () => {
  it("backs off transient failures", () => {
    expect(queryPollDelay(0, "visible")).toBe(2_000);
    expect(queryPollDelay(1, "visible")).toBe(4_000);
    expect(queryPollDelay(3, "visible")).toBe(8_000);
    expect(queryPollDelay(8, "visible")).toBe(8_000);
    expect(queryPollDelay(0, "hidden")).toBe(10_000);
  });

  it("schedules capped retry probes before browser queries time out", async () => {
    const { responder, client } = setup();
    client.query.mockRejectedValue(new BridgeError("REQUEST_TIMEOUT"));
    await responder.tick(); await responder.tick(); await responder.tick(); await responder.tick();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    responder.start();
    await Promise.resolve(); await Promise.resolve();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8_000);
    expect(queryPollDelay(8, "visible") + 8_000).toBeLessThan(25_000);
    responder.stop();
    setTimeoutSpy.mockRestore();
  });

  it("returns tab-scoped data and retries delivery without rerunning the query", async () => {
    const { responder, client, execute, onActivity } = setup();
    client.queryResult.mockRejectedValueOnce(new Error("offline"));
    await responder.tick();
    expect(onActivity.mock.calls.map(call => call[0].phase)).toEqual(["started"]);
    await responder.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onActivity.mock.calls.map(call => call[0].phase)).toEqual(["started", "completed"]);
    expect(client.queryResult).toHaveBeenLastCalledWith("study", "tab", "query-1", { ok: true, data: { camera: [121,25] } });
  });
  it("does not publish a late result after disconnect", async () => {
    let complete!: (value: Record<string,unknown>) => void;
    const execute = vi.fn(() => new Promise<Record<string,unknown>>(resolve => { complete = resolve; }));
    const { responder, client, onActivity } = setup(execute);
    const running = responder.tick(); await Promise.resolve(); responder.stop(); complete({ rows: [] }); await running;
    expect(client.queryResult).not.toHaveBeenCalled();
    expect(onActivity.mock.calls.map(call => call[0].phase)).toEqual(["started"]);
  });
  it("never serializes arbitrary error text or oversized result data", async () => {
    const { responder, client, execute } = setup();
    execute.mockRejectedValueOnce(new Error("private data in exception"));
    await responder.tick();
    expect(client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: false, error: "QUERY_FAILED" });
    const accepted = setup(vi.fn().mockResolvedValue({ large: "x".repeat(64 * 1024) }));
    await accepted.responder.tick();
    expect(accepted.client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: false, error: "RESULT_TOO_LARGE" });
    const second = setup(vi.fn().mockResolvedValue({ large: "x".repeat(MAX_QUERY_RESULT_BYTES + 1) }));
    await second.responder.tick();
    expect(second.client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: false, error: "RESULT_TOO_LARGE" });
  });
  it("matches the Gateway's nested result limits and retains a recoverable result id", async () => {
    expect(validQueryResultData({ label: "x".repeat(MAX_QUERY_RESULT_STRING_LENGTH) })).toBe(true);
    expect(validQueryResultData({ label: "x".repeat(MAX_QUERY_RESULT_STRING_LENGTH + 1) })).toBe(false);
    expect(validQueryResultData({ rows: Array.from({ length: 101 }, () => null) })).toBe(false);
    const nested = Array.from({ length: 13 }, () => null).reduce(value => [value], "leaf" as unknown);
    expect(validQueryResultData(nested)).toBe(false);
    const retained = setup(vi.fn().mockResolvedValue({ resultId: "stored-result", coverage: "x".repeat(MAX_QUERY_RESULT_STRING_LENGTH + 1) }));
    await retained.responder.tick();
    expect(retained.client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: true, data: { resultId: "stored-result", recoverable: true, error: "RESULT_NOT_TRANSPORTABLE", recovery: "get_analysis_result" } });
  });
  it("compacts only oversized row geometry while retaining values and source metadata", async () => {
    const ring = Array.from({ length: 101 }, (_, index) => [121.5 + index / 10_000, 25]);
    ring.push(ring[0]!);
    const sourceRefs = [{ sourceId: "fixture", version: "v1", acquiredAt: "2026-09-22T00:00:00.000Z", checksumSha256: null, reference: "fixture://source" }];
    const compacted = setup(vi.fn().mockResolvedValue({ resultId: "polygon-result", sourceRefs, rows: [{ name: "行政區", value: 7, geometry: { type: "Polygon", coordinates: [ring] } }] }));
    await compacted.responder.tick();
    expect(compacted.client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: true, data: {
      resultId: "polygon-result", sourceRefs,
      rows: [{ name: "行政區", value: 7, geometry: { type: "Polygon", coordinatesOmitted: true } }],
    } });
  });
  it("keeps every semantic row for a 22-area comparison when wire geometry is compacted", async () => {
    const ring = Array.from({ length: 2_000 }, (_, index) => [121.5 + index / 1_000_000, 25]);
    ring.push(ring[0]!);
    const rows = Array.from({ length: 22 }, (_, index) => ({
      area_code: `C${String(index + 1).padStart(2, "0")}`, status: "observed", comparison_status: "valid", normalization_status: "valid",
      value: index + 1, normalizedValue: 10, geometry: { type: "Polygon", coordinates: [ring] },
    }));
    const delivered = setup(vi.fn().mockResolvedValue({
      resultId: "analysis-compare_regions-national", operation: "compare_regions", units: { value: "cases", normalizedValue: "cases per 10000 persons" }, rows,
    }));
    await delivered.responder.tick();
    const result = delivered.client.queryResult.mock.calls[0]?.[3];
    expect(result).toMatchObject({ ok: true, data: { resultId: "analysis-compare_regions-national", operation: "compare_regions", units: { normalizedValue: "cases per 10000 persons" } } });
    expect((result as { data: { rows: unknown[] } }).data.rows).toHaveLength(22);
    expect((result as { data: { rows: Array<Record<string, unknown>> } }).data.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "C01", value: 1, normalizedValue: 10, geometry: { type: "Polygon", coordinatesOmitted: true } }),
      expect.objectContaining({ area_code: "C22", value: 22, normalizedValue: 10, geometry: { type: "Polygon", coordinatesOmitted: true } }),
    ]));
  });
  it("sends real spatial and aggregate result pages after JSON omits undefined presentation fields", async () => {
    const session = new ResearchAnalysisSession();
    const store = (session as unknown as { store: { put: (value: object) => void } }).store;
    const sourceRefs = [{ sourceId: "fixture", version: "v1", acquiredAt: "2026-09-22T00:00:00.000Z", checksumSha256: null, reference: "fixture://source" }];
    store.put({ resultId: "points", datasetId: "fixture-points", recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, rows: [{ name: "甲", amount: 3, geometry: { type: "Point", coordinates: [121.5, 25] } }], sourceRefs, coverage: "fixture", freshness: "current", units: { amount: "items" } });
    const spatialPage = session.execute("spatial_query", { resultId: "points", predicate: "within_distance", center: [121.5, 25], radiusM: 1000 });
    const aggregatePage = session.execute("aggregate_records", { resultId: "points", operation: "sum", field: "amount" });
    for (const page of [spatialPage, aggregatePage]) {
      expect(page).toHaveProperty("presentation", undefined);
      const delivered = setup(vi.fn().mockResolvedValue(page));
      await delivered.responder.tick();
      expect(delivered.client.queryResult.mock.calls[0]?.[3]).toMatchObject({ ok: true, data: { resultId: page.resultId, sourceRefs } });
      expect(delivered.client.queryResult.mock.calls[0]?.[3].data).not.toHaveProperty("presentation");
    }
  });
  it("recovers a transient outage on an idle poll and escalates only repeated failures", async () => {
    const { responder, client, onHealth } = setup();
    client.query.mockRejectedValue(new BridgeError("REQUEST_TIMEOUT"));
    await responder.tick(); await responder.tick(); await responder.tick();
    expect(onHealth.mock.calls.map(call => call[0].state)).toEqual(["retrying", "retrying", "offline"]);
    client.query.mockResolvedValue({ request: null });
    await responder.tick(); await responder.tick();
    expect(onHealth.mock.calls.map(call => call[0].state)).toEqual(["retrying", "retrying", "offline", "recovered"]);
  });
  it("does not classify cancelled delivery or invalid pairing as network outages", async () => {
    const { responder, client, onHealth, onActivity } = setup();
    client.queryResult.mockRejectedValueOnce(new BridgeError("QUERY_DENIED"));
    await responder.tick();
    expect(onHealth).toHaveBeenLastCalledWith({ state: "cancelled", code: "QUERY_DENIED" });
    expect(onActivity.mock.calls.map(call => call[0].phase)).toEqual(["started"]);
    client.query.mockRejectedValueOnce(new BridgeError("SESSION_REVOKED"));
    await responder.tick();
    expect(onHealth).toHaveBeenLastCalledWith({ state: "auth", code: "SESSION_REVOKED" });
  });
  it("continues a healthy long-poll without a background-tab timer", async () => {
    const { responder, client } = setup();
    let hold!: () => void;
    client.query.mockResolvedValueOnce({ request: null }).mockImplementationOnce(() => new Promise(resolve => { hold = () => resolve({ request: null }); }));
    responder.start();
    await vi.waitFor(() => expect(client.query).toHaveBeenCalledTimes(2));
    expect((responder as unknown as { timer: ReturnType<typeof setTimeout> | null }).timer).toBeNull();
    responder.stop(); hold();
  });

});
