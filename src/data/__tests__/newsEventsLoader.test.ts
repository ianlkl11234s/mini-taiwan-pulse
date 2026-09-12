import { afterEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ configured: false, rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  get supabaseConfigured() { return source.configured; },
  supabase: { rpc: source.rpc },
}));

import { fetchNewsEventsDayClusters, fetchNewsEventsDayClustersStrict } from "../newsEventsLoader";

afterEach(() => {
  source.configured = false;
  source.rpc.mockReset();
});

describe("news event research reader", () => {
  it("keeps the display reader fallback while strict research rejects an unconfigured source", async () => {
    await expect(fetchNewsEventsDayClusters("2026-09-11")).resolves.toEqual([]);
    await expect(fetchNewsEventsDayClustersStrict("2026-09-11")).rejects.toThrow("NEWS_EVENTS_SOURCE_NOT_CONFIGURED");
  });

  it("rejects malformed RPC payloads but accepts a legitimate empty event list", async () => {
    source.configured = true;
    source.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchNewsEventsDayClustersStrict("2026-09-11")).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    source.rpc.mockResolvedValueOnce({ data: { events: [] }, error: null });
    await expect(fetchNewsEventsDayClustersStrict("2026-09-11")).rejects.toThrow("NEWS_EVENTS_INVALID_RPC_RESPONSE");
    source.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchNewsEventsDayClustersStrict("2026-09-11")).resolves.toEqual([]);
  });
});
