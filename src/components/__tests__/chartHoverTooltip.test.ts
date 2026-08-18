import { describe, it, expect } from "vitest";
import { computeTooltipPlacement, fmtChartValue } from "../ChartHoverTooltip";

/**
 * 只測純函式：本專案 vitest 是 `environment: "node"`、`include: src/**\/*.test.ts`，
 * 沒有 jsdom / testing-library，無法 render React 元件。浮層的 DOM 行為（portal、
 * 捲動隱藏、visibility 兩段式定位）靠瀏覽器實測驗收，不在單元測試覆蓋內。
 */

const VP = { viewportW: 1000, viewportH: 800 };

describe("computeTooltipPlacement", () => {
  it("預設落在游標右上", () => {
    const p = computeTooltipPlacement({ cursorX: 400, cursorY: 400, boxW: 120, boxH: 60, ...VP });
    expect(p.left).toBeGreaterThan(400);
    expect(p.top).toBeLessThan(400 - 60);
  });

  it("靠近右緣 → 往左翻（浮層整體落在游標左側）", () => {
    const p = computeTooltipPlacement({ cursorX: 960, cursorY: 400, boxW: 120, boxH: 60, ...VP });
    expect(p.left + 120).toBeLessThanOrEqual(960);
  });

  it("靠近上緣 → 往下翻（浮層整體落在游標下方）", () => {
    const p = computeTooltipPlacement({ cursorX: 400, cursorY: 10, boxW: 120, boxH: 60, ...VP });
    expect(p.top).toBeGreaterThanOrEqual(10);
  });

  it("右上角同時翻轉（左 + 下）", () => {
    const p = computeTooltipPlacement({ cursorX: 990, cursorY: 5, boxW: 120, boxH: 60, ...VP });
    expect(p.left + 120).toBeLessThanOrEqual(990);
    expect(p.top).toBeGreaterThanOrEqual(5);
  });

  it("翻轉後仍出界（浮層比可用空間大）→ clamp 進視窗", () => {
    const p = computeTooltipPlacement({
      cursorX: 10,
      cursorY: 10,
      boxW: 400,
      boxH: 300,
      viewportW: 320,
      viewportH: 240,
    });
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
    // clamp 之後不會跑到視窗右／下方外面（負值代表「盡量貼左上」，不是溢位）
    expect(p.left).toBeLessThanOrEqual(6);
    expect(p.top).toBeLessThanOrEqual(6);
  });

  it("永遠不會超出視窗右／下緣", () => {
    for (const cursorX of [0, 250, 500, 750, 1000]) {
      for (const cursorY of [0, 200, 400, 600, 800]) {
        const p = computeTooltipPlacement({ cursorX, cursorY, boxW: 160, boxH: 80, ...VP });
        expect(p.left + 160).toBeLessThanOrEqual(VP.viewportW);
        expect(p.top + 80).toBeLessThanOrEqual(VP.viewportH);
      }
    }
  });
});

describe("fmtChartValue", () => {
  it("四位數以上補千分位", () => {
    expect(fmtChartValue(49496, "MW")).toBe("49,496 MW");
  });

  it("% 不留空格", () => {
    expect(fmtChartValue(22.2, "%")).toBe("22.2%");
  });

  it("無單位只回數字", () => {
    expect(fmtChartValue(1234)).toBe("1,234");
  });

  it("非整數依量級決定小數位", () => {
    expect(fmtChartValue(5.25)).toBe("5.25");
    expect(fmtChartValue(52.25)).toBe("52.3");
    expect(fmtChartValue(521.25)).toBe("521");
  });

  it("整數保持整數（計數類不要變 0.00 次）", () => {
    expect(fmtChartValue(0, "次")).toBe("0 次");
    expect(fmtChartValue(8, "次")).toBe("8 次");
    expect(fmtChartValue(172, "次")).toBe("172 次");
  });
});
