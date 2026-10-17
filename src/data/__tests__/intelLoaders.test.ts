import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
  supabaseConfigured: true,
}));

vi.mock("../../lib/loadingRegistry", () => ({
  withLoading: (_id: string, _label: string, promise: Promise<unknown>) => Promise.resolve(promise),
}));

import { fetchPressureIndex, parsePressureSignals, isoWeekThursdayMs } from "../intelLoaders";

describe("fetchPressureIndex", () => {
  beforeEach(() => {
    fetchPressureIndex.invalidate();
    rpcMock.mockReset();
  });

  it.each([null, "", "   "])("does not turn a missing composite (%j) into zero", async (composite) => {
    rpcMock.mockResolvedValue({
      data: [{ composite, updated_at: "2026-09-07T00:00:00Z" }],
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
      data: [{ composite, updated_at: "2026-09-07T00:00:00Z" }],
      error: null,
    });

    await expect(fetchPressureIndex()).resolves.toMatchObject({
      status: "ready",
      data: { composite: expected, asof: "2026-09-07T00:00:00Z" },
    });
  });
});

describe("fetchPressureIndex 欄位對照", () => {
  beforeEach(() => {
    fetchPressureIndex.invalidate();
    rpcMock.mockReset();
  });

  it("reads updated_at and the per_signal object; missing vs_* stay null", async () => {
    rpcMock.mockResolvedValue({
      data: [{
        composite: 42, level: "attention", updated_at: "2026-10-03T01:00:00Z",
        vs_baseline: null, vs_1h_ago: 3,
        per_signal: { power: 80, road: "12", er: null, aqi: 0 },
      }],
      error: null,
    });
    const r = await fetchPressureIndex();
    expect(r.status).toBe("ready");
    expect(r.data.asof).toBe("2026-10-03T01:00:00Z");
    expect(r.data.vs_baseline).toBeNull();
    expect(r.data.vs_1h_ago).toBe(3);
    expect(r.data.per_signal).toEqual([
      { id: "power", label: "供電", score: 80 },
      { id: "road", label: "道路", score: 12 },
      { id: "aqi", label: "空品", score: 0 },
    ]);
  });

  it("a row without updated_at is an error, not a made-up time", async () => {
    rpcMock.mockResolvedValue({ data: [{ composite: 42, asof: "2026-10-03T01:00:00Z" }], error: null });
    await expect(fetchPressureIndex()).resolves.toMatchObject({ status: "error" });
  });
});

describe("parsePressureSignals", () => {
  it("returns [] for arrays and non-objects", () => {
    expect(parsePressureSignals([])).toEqual([]);
    expect(parsePressureSignals(null)).toEqual([]);
  });
});

describe("isoWeekThursdayMs", () => {
  const now = Date.parse("2026-10-03T04:00:00Z"); // 2026 W40 週六
  it("maps W40 of 2026 to Thursday 2026-10-01 (Taipei 00:00)", () => {
    expect(isoWeekThursdayMs(40, now)).toBe(Date.parse("2026-10-01T00:00:00+08:00"));
  });
  it("a week number later than now falls back to last year", () => {
    expect(isoWeekThursdayMs(52, now)).toBe(Date.parse("2025-12-25T00:00:00+08:00"));
  });
  it("rejects invalid weeks", () => {
    expect(isoWeekThursdayMs(0, now)).toBeNull();
    expect(isoWeekThursdayMs(54, now)).toBeNull();
  });
});
