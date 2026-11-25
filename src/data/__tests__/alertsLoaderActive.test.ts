import { afterEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: source.rpc } }));

import { fetchActiveAlerts, fetchActiveAlertsOrThrow } from "../alertsLoader";

afterEach(() => source.rpc.mockReset());

describe("active alerts list: 失敗與空清單要分得出來（review #1215）", () => {
  it("OrThrow 在 RPC 失敗時 reject；成功的空清單回 []", async () => {
    source.rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(fetchActiveAlertsOrThrow(null, 2)).rejects.toThrow("boom");
    source.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchActiveAlertsOrThrow(null, 3)).resolves.toEqual([]);
  });

  it("舊介面 fetchActiveAlerts 失敗仍回 []（其他呼叫端不變）", async () => {
    source.rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchActiveAlerts(null, 4)).resolves.toEqual([]);
  });
});
