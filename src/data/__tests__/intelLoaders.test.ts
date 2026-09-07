import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
  supabaseConfigured: true,
}));

vi.mock("../../lib/loadingRegistry", () => ({
  withLoading: (_id: string, _label: string, promise: Promise<unknown>) => Promise.resolve(promise),
}));

import { fetchPressureIndex } from "../intelLoaders";

describe("fetchPressureIndex", () => {
  beforeEach(() => {
    fetchPressureIndex.invalidate();
    rpcMock.mockReset();
  });

  it.each([null, "", "   "])("does not turn a missing composite (%j) into zero", async (composite) => {
    rpcMock.mockResolvedValue({
      data: [{ composite, asof: "2026-09-07T00:00:00Z" }],
      error: null,
    });

    await expect(fetchPressureIndex()).resolves.toMatchObject({
      status: "error",
      data: { composite: 0, asof: null },
      lastSuccessAt: null,
    });
  });

  it.each([[0, 0], ["0", 0], ["12.5", 12.5]])("keeps a valid composite %j", async (composite, expected) => {
    rpcMock.mockResolvedValue({
      data: [{ composite, asof: "2026-09-07T00:00:00Z" }],
      error: null,
    });

    await expect(fetchPressureIndex()).resolves.toMatchObject({
      status: "ready",
      data: { composite: expected, asof: "2026-09-07T00:00:00Z" },
    });
  });
});
