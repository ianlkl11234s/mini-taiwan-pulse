import { describe, it, expect, vi } from "vitest";
import { QueryResponder, queryPollDelay } from "../QueryResponder";
import { BridgeError, type BridgeConnectionContext } from "../bridgeClient";
const request = { requestId: "query-1", operation: "map_context", args: {}, expiresAt: Date.now() + 30_000 };
function setup(execute = vi.fn().mockResolvedValue({ camera: [121, 25] }), onActivity = vi.fn()) {
  const client = { query: vi.fn().mockResolvedValue({ request }), queryResult: vi.fn().mockResolvedValue(undefined) };
  const onHealth = vi.fn();
  const responder = new QueryResponder({ client, studyId: "study", tabId: "tab" } as unknown as BridgeConnectionContext, execute, vi.fn(), onActivity, onHealth);
  return { client, responder, execute, onActivity, onHealth };
}
describe("QueryResponder", () => {
  it("backs off transient failures and throttles hidden tabs", () => {
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
    const second = setup(vi.fn().mockResolvedValue({ large: "x".repeat(25 * 1024) }));
    await second.responder.tick();
    expect(second.client.queryResult.mock.calls[0]?.[3]).toEqual({ ok: false, error: "RESULT_TOO_LARGE" });
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

});
