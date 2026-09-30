import { describe, expect, it, vi } from "vitest";

vi.mock("h3-js", () => ({ cellToBoundary: vi.fn(() => []) }));

import { deferUntilH3, loadH3, requireH3 } from "../h3Runtime";

describe("h3Runtime", () => {
  it("defers until h3-js loads, replays only the latest call per key, and skips when not needed", async () => {
    const calls: string[] = [];
    expect(() => requireH3()).toThrow();
    expect(deferUntilH3("k", false, () => calls.push("unneeded"))).toBe(false);
    expect(deferUntilH3("k", true, () => calls.push("old"))).toBe(true);
    expect(deferUntilH3("k", true, () => calls.push("new"))).toBe(true);
    await loadH3();
    await Promise.resolve();
    expect(calls).toEqual(["new"]);
    expect(requireH3().cellToBoundary).toBeTypeOf("function");
    // 載入後同步執行，不再延後
    expect(deferUntilH3("k", true, () => calls.push("sync"))).toBe(false);
  });
});
