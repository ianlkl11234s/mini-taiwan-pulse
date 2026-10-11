import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useContext: () => undefined,
  useState: <T,>(initial: T) => [initial, vi.fn()] as const,
}));

vi.mock("../../../../hooks/useMonitorResource", () => ({
  useMonitorResource: () => ({ status: "ready", data: [], lastSuccessAt: 1 }),
}));

// 測試把 useContext 換成 undefined → 沒有 Provider 的 palette；直接給暗色主題
vi.mock("../monitorTheme", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../monitorTheme")>();
  const { DARK_INTEL } = await import("../../intelTheme");
  return { ...mod, useMonitorTheme: () => mod.monitorThemeFor(DARK_INTEL) };
});

import { TwseTicker, marketDataMs } from "../PressureRing";

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

describe("TwseTicker 缺值", () => {
  it("legacy：change_pct 為 null 時不顯示成 0%", () => {
    const text = textOf(TwseTicker({ data: { ...market, change_pct: null }, status: "ready", lastSuccessAt: Date.now(), open: false }));
    expect(text).toContain("22,000");
    expect(text).not.toMatch(/\+?0%/);
  });
  it("legacy：high／low 為 null 顯示 —，不是 0", () => {
    const text = textOf(TwseTicker({ data: { ...market, high: null, low: null }, status: "ready", lastSuccessAt: Date.now(), open: false }));
    expect(text).not.toMatch(/H\s*0|L\s*0/);
  });
});

describe("marketDataMs", () => {
  it("combines the history trade_date with the RPC HH:MM (Taipei), never today's date", () => {
    expect(marketDataMs("2026-09-30", "13:30")).toBe(Date.parse("2026-09-30T13:30:00+08:00"));
  });
  it("returns null without a date or with a bad time", () => {
    expect(marketDataMs(undefined, "13:30")).toBeNull();
    expect(marketDataMs("2026-09-30", null)).toBeNull();
    expect(marketDataMs("2026-09-30", "收盤")).toBeNull();
  });
});
