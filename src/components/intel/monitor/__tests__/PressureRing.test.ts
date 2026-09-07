import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useState: <T,>(initial: T) => [initial, vi.fn()] as const,
}));

import { TwseTicker } from "../PressureRing";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return "";
}

const market = {
  index: 22_000, prev_close: 21_900, open: 21_950, high: 22_030, low: 21_870,
  change: 100, change_pct: 0.46, turnover: "100 萬張", time: "13:30", status: "盤中" as string | null,
};

describe("TwseTicker stale presentation", () => {
  it("keeps the last successful quote but labels an interrupted refresh instead of market status", () => {
    const text = textOf(TwseTicker({ data: market, status: "error", lastSuccessAt: Date.now(), open: false }));
    expect(text).toContain("22,000");
    expect(text).toContain("更新中斷");
    expect(text).toContain("最後成功");
    expect(text).not.toContain("盤中 13:30");
  });
});
