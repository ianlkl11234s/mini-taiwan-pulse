import { describe, expect, it, vi } from "vitest";
const captured = vi.hoisted(() => ({ options: null as any }));
vi.mock("react", () => ({ useCallback: (fn: unknown) => fn }));
vi.mock("../useIntelPollingQuery", () => ({ useIntelPollingQuery: (options: unknown) => { captured.options = options; return options; } }));
import { useMonitorResource } from "../useMonitorResource";

describe("raw Monitor resource adapter", () => {
  it.each([null, []])("keeps valid empty outcomes (%j), query identity and polling cadence", async (data) => {
    useMonitorResource({ open: true, queryKey: "source:scope", intervalMs: 60_000, emptyData: null, load: async () => data });
    expect(captured.options).toMatchObject({ enabled: true, queryKey: "source:scope", intervalMs: 60_000 });
    expect(await captured.options.load()).toMatchObject({ status: "ready", data });
  });
  it("preserves the original permission failure for the shared state machine", async () => {
    const failure = { code: "42501", message: "denied" };
    useMonitorResource({ open: true, queryKey: "private", intervalMs: 1, emptyData: null, load: async () => { throw failure; } });
    await expect(captured.options.load()).rejects.toBe(failure);
  });
});
