import { describe, it, expect, vi } from "vitest";
import { QueryResponder } from "../QueryResponder";
import type { BridgeConnectionContext } from "../bridgeClient";
const request = { requestId: "query-1", operation: "map_context", args: {}, expiresAt: Date.now() + 30_000 };
function setup(execute = vi.fn().mockResolvedValue({ camera: [121, 25] })) {
  const client = { query: vi.fn().mockResolvedValue({ request }), queryResult: vi.fn().mockResolvedValue(undefined) };
  const responder = new QueryResponder({ client, studyId: "study", tabId: "tab" } as unknown as BridgeConnectionContext, execute, vi.fn());
  return { client, responder, execute };
}
describe("QueryResponder", () => {
  it("returns tab-scoped data and retries delivery without rerunning the query", async () => {
    const { responder, client, execute } = setup();
    client.queryResult.mockRejectedValueOnce(new Error("offline"));
    await responder.tick(); await responder.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(client.queryResult).toHaveBeenLastCalledWith("study", "tab", "query-1", { ok: true, data: { camera: [121,25] } });
  });
  it("does not publish a late result after disconnect", async () => {
    let complete!: (value: Record<string,unknown>) => void;
    const execute = vi.fn(() => new Promise<Record<string,unknown>>(resolve => { complete = resolve; }));
    const { responder, client } = setup(execute);
    const running = responder.tick(); await Promise.resolve(); responder.stop(); complete({ rows: [] }); await running;
    expect(client.queryResult).not.toHaveBeenCalled();
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
});
