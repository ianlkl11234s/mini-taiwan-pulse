import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => [] as Array<{ open: boolean; queryKey: string }>);
vi.mock("react", () => ({ useEffect: () => {} }));
vi.mock("../useMonitorResource", () => ({ useMonitorResource: (options: { open: boolean; queryKey: string; emptyData: unknown }) => {
  calls.push(options);
  return { status: "ready", queryKey: options.queryKey, lastSuccessAt: 100,
    data: options.queryKey.startsWith("power-generation:") ? { plants: [{ id: "retained" }] } : options.emptyData };
} }));
import { useMonitorDashboardData } from "../useMonitorDashboardData";

describe("Monitor owner data boundary", () => {
  beforeEach(() => { calls.length = 0; });
  it("immediately masks retained private data and disables its request without an owner", () => {
    const state = useMonitorDashboardData(true, null);
    expect(state.powerDay).toMatchObject({ status: "denied", data: null, lastSuccessAt: null });
    expect(calls.find(x => x.queryKey.startsWith("power-generation:"))?.open).toBe(false);
  });
  it("uses distinct identities for different owners and keeps public sources enabled", () => {
    useMonitorDashboardData(true, "owner-a");
    useMonitorDashboardData(true, "owner-b");
    expect(calls.filter(x => x.queryKey.startsWith("power-generation:")).map(x => x.queryKey)).toEqual([
      "power-generation:24h:owner-a", "power-generation:24h:owner-b",
    ]);
    expect(calls.filter(x => !x.queryKey.startsWith("power-generation:")).every(x => x.open)).toBe(true);
  });
});
