import { describe, expect, it } from "vitest";
import { BENCH_RESULT_WINDOW_KEY, installBenchResultBridge } from "./automation";
import type { BenchRunExport } from "./metrics";

describe("GFW v4 browser automation result bridge", () => {
  it("exposes the live latest result through a read-only getter and cleans up", () => {
    const target = {};
    let latest: BenchRunExport | null = null;
    const cleanup = installBenchResultBridge(target, () => latest);
    const descriptor = Object.getOwnPropertyDescriptor(target, BENCH_RESULT_WINDOW_KEY);
    expect(descriptor?.set).toBeUndefined();
    expect(descriptor?.enumerable).toBe(false);
    expect(Reflect.get(target, BENCH_RESULT_WINDOW_KEY)).toBeNull();
    latest = { selectedDate: "2026-08-20" } as BenchRunExport;
    expect(Reflect.get(target, BENCH_RESULT_WINDOW_KEY)).toBe(latest);
    cleanup();
    expect(Object.prototype.hasOwnProperty.call(target, BENCH_RESULT_WINDOW_KEY)).toBe(false);
  });
});
