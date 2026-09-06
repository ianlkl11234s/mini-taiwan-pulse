import { afterEach, describe, expect, it, vi } from "vitest";
import { __test__ } from "../supabase";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("resilientFetch retry safety", () => {
  it.each([
    ["REST scene POST", "https://example.test/rest/v1/user_scenes", "POST"],
    ["REST scene PATCH", "https://example.test/rest/v1/user_scenes?id=eq.x", "PATCH"],
    ["Auth POST", "https://example.test/auth/v1/token", "POST"],
    ["denylisted write RPC", "https://example.test/rest/v1/rpc/log_session_events", "POST"],
  ])("does not retry %s after a 500", async (_label, url, method) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("failed", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await __test__.resilientFetch(url, { method });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a new scene POST after a network TypeError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(__test__.resilientFetch("https://example.test/rest/v1/user_scenes", { method: "POST" })).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps retries for read-only RPC POST", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response("failed", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = __test__.resilientFetch("https://example.test/rest/v1/rpc/get_map_data", { method: "POST" });
    await vi.advanceTimersByTimeAsync(5_000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("classifies GET and HEAD as retryable reads", () => {
    expect(__test__.isRetryableRequest("https://example.test/rest/v1/user_scenes", { method: "GET" })).toBe(true);
    expect(__test__.isRetryableRequest("https://example.test/rest/v1/user_scenes", { method: "HEAD" })).toBe(true);
  });
});
