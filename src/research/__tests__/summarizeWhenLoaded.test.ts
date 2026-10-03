import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeWhenLoaded, type VisibleSummary } from "../visibleSummary";

const summary = (status: "data_not_loaded" | "ok"): VisibleSummary => ({ basis: "rendered_viewport", note: "", truncated: false, layers: [{ layerKey: "aqiStations", label: "x", basis: "layer_data", status } as never] });

describe("summarizeWhenLoaded", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls until data arrives, then returns it", async () => {
    let calls = 0;
    const compute = vi.fn(() => summary(++calls >= 4 ? "ok" : "data_not_loaded"));
    const p = summarizeWhenLoaded(compute, 6000, 250);
    await vi.advanceTimersByTimeAsync(750);
    expect((await p).layers[0].status).toBe("ok");
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it("returns data_not_loaded as-is after the budget", async () => {
    const compute = vi.fn(() => summary("data_not_loaded"));
    const p = summarizeWhenLoaded(compute, 6000, 250);
    await vi.advanceTimersByTimeAsync(6000);
    expect((await p).layers[0].status).toBe("data_not_loaded");
    expect(compute).toHaveBeenCalledTimes(25);
  });

  it("does not wait when nothing is pending or budget is 0", async () => {
    const ok = vi.fn(() => summary("ok"));
    await summarizeWhenLoaded(ok);
    expect(ok).toHaveBeenCalledTimes(1);
    const none = vi.fn(() => summary("data_not_loaded"));
    await summarizeWhenLoaded(none, 0);
    expect(none).toHaveBeenCalledTimes(1);
  });
});
