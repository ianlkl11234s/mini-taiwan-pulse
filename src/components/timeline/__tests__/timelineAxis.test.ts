import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildDiscreteAxis,
  buildLiveTicks,
  buildQuarterTicks,
  describeDataWindow,
  formatClock,
  gapsOutsideDataWindow,
  keyboardIndexTarget,
  keyboardSeekTarget,
  range,
  ratioToIndex,
} from "../timelineAxis";
import { TimelineControls } from "../../TimelineControls";
import { HistoricalTimeline } from "../../HistoricalTimeline";

// 2026-09-27 00:00 台北 = 2026-09-26T16:00Z
const DAY_START = Date.UTC(2026, 8, 26, 16) / 1000;
const dayEnd = (days: number) => DAY_START + days * 86_400 - 1;

describe("buildLiveTicks", () => {
  it("1 天：主刻度 00/04/…/24、次刻度每小時", () => {
    const ticks = buildLiveTicks(DAY_START, dayEnd(1), 1);
    expect(ticks).toHaveLength(25);
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual(["00", "04", "08", "12", "16", "20", "24"]);
    expect(ticks[0]!.pos).toBe(0);
    expect(ticks[ticks.length - 1]!.pos).toBe(1);
  });

  it("3 天：主刻度每天標日期、次刻度每 6 小時", () => {
    const ticks = buildLiveTicks(DAY_START, dayEnd(3), 3);
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual(["9/27", "9/28", "9/29", "9/30"]);
    expect(ticks).toHaveLength(13);
  });

  it("2 天：日界標日期，其餘標小時", () => {
    const labels = buildLiveTicks(DAY_START, dayEnd(2), 2).filter((t) => t.major).map((t) => t.label);
    expect(labels).toEqual(["9/27", "06", "12", "18", "9/28", "06", "12", "18", "9/29"]);
  });

  it("空視窗回傳空陣列", () => {
    expect(buildLiveTicks(10, 10, 1)).toEqual([]);
  });
});

describe("資料缺漏區段", () => {
  it("資料窗在視窗中途結束 → 後段斜線＋「只到」說明", () => {
    const dataEnd = DAY_START + 6 * 3600;
    const gaps = gapsOutsideDataWindow(DAY_START, dayEnd(1), DAY_START - 86_400 * 30, dataEnd);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.start).toBeCloseTo(0.25, 3);
    expect(gaps[0]!.end).toBe(1);
    expect(describeDataWindow("漁船熱區", DAY_START, dayEnd(1), DAY_START - 86_400 * 30, dataEnd, "2026-08-27", "2026-09-26"))
      .toBe("漁船熱區只到 9/26");
  });

  it("資料窗完全在視窗之前 → 整段斜線", () => {
    expect(gapsOutsideDataWindow(DAY_START, dayEnd(1), 0, DAY_START - 100)).toEqual([{ start: 0, end: 1 }]);
  });

  it("資料窗涵蓋整個視窗 → 無斜線、無說明", () => {
    expect(gapsOutsideDataWindow(DAY_START, dayEnd(1), 0, dayEnd(1) + 10)).toEqual([]);
    expect(describeDataWindow("漁船資料", DAY_START, dayEnd(1), 0, dayEnd(1) + 10, "a", "b")).toBeNull();
  });
});

describe("鍵盤", () => {
  it("←→ 5 分鐘、Shift 1 小時、Home/End 兩端，且不超出視窗", () => {
    const t = DAY_START + 3600;
    expect(keyboardSeekTarget("ArrowRight", false, t, DAY_START, dayEnd(1))).toBe(t + 300);
    expect(keyboardSeekTarget("ArrowLeft", true, t, DAY_START, dayEnd(1))).toBe(DAY_START);
    expect(keyboardSeekTarget("ArrowLeft", true, DAY_START + 10, DAY_START, dayEnd(1))).toBe(DAY_START);
    expect(keyboardSeekTarget("End", false, t, DAY_START, dayEnd(1))).toBe(dayEnd(1));
    expect(keyboardSeekTarget("Home", false, t, DAY_START, dayEnd(1))).toBe(DAY_START);
    expect(keyboardSeekTarget("a", false, t, DAY_START, dayEnd(1))).toBeNull();
  });

  it("離散軸索引步進", () => {
    expect(keyboardIndexTarget("ArrowRight", 11, 12)).toBe(11);
    expect(keyboardIndexTarget("ArrowLeft", 0, 12)).toBe(0);
    expect(keyboardIndexTarget("End", 3, 12)).toBe(11);
    expect(keyboardIndexTarget("Tab", 3, 12)).toBeNull();
  });
});

describe("歷史離散軸", () => {
  it("current 大於所有刻度時落在最後一格，小於所有刻度時落在第一格", () => {
    expect(buildDiscreteAxis([2020, 2021, 2022], 2025, String).index).toBe(2);
    expect(buildDiscreteAxis([2020, 2022, 2024], 2023, String).index).toBe(1);
    expect(buildDiscreteAxis([2020, 2021, 2022], 2010, String).index).toBe(0);
  });

  it("月粒度：12 格全標、指針在目前月份", () => {
    const axis = buildDiscreteAxis(range(1, 12), 9, String);
    expect(axis.index).toBe(8);
    expect(axis.ticks.filter((t) => t.label).map((t) => t.label)).toHaveLength(12);
  });

  it("月粒度限 7 個標籤：隔月標示、12 月一定標、11 月讓位", () => {
    const axis = buildDiscreteAxis(range(1, 12), 9, String, 7);
    expect(axis.ticks).toHaveLength(12);
    expect(axis.ticks.filter((t) => t.label).map((t) => t.label)).toEqual(["1", "3", "5", "7", "9", "12"]);
  });

  it("日粒度 31 天：隔格標、最後一天一定標", () => {
    const labels = buildDiscreteAxis(range(1, 31), 27, String).ticks.filter((t) => t.label).map((t) => t.label);
    expect(labels[0]).toBe("1");
    expect(labels[labels.length - 1]).toBe("31");
    expect(labels.length).toBeLessThanOrEqual(13);
  });

  it("比例轉最近索引", () => {
    expect(ratioToIndex(0, 12)).toBe(0);
    expect(ratioToIndex(1, 12)).toBe(11);
    expect(ratioToIndex(0.5, 3)).toBe(1);
  });

  it("房地產季刻度", () => {
    const min = Date.UTC(2024, 6, 1) / 1000;
    const max = Date.UTC(2026, 2, 31) / 1000;
    const labels = buildQuarterTicks(["2024Q3", "2024Q4", "2026Q1"], min, max).filter((t) => t.label).map((t) => t.label);
    expect(labels).toEqual(["2024Q3", "2024Q4", "2026Q1"]);
  });
});

it("formatClock 用台北時間", () => {
  expect(formatClock(DAY_START + 22 * 3600 + 42 * 60)).toBe("22:42");
  expect(formatClock(0)).toBe("--:--");
});

describe("元件靜態渲染", () => {
  const noop = () => {};
  // TC3：桌機預設收合，完整控制項在展開態；SSR 以手機（固定展開）驗展開內容。
  // 「現在」與範圍選單在日期膠囊的彈出面板內，面板預設關閉。
  it("即時模式（展開）：刻度軸 slider、中文控制項、沒有原生 range", () => {
    const html = renderToStaticMarkup(createElement(TimelineControls, {
      isMobile: true,
      playing: false, speed: 60, progress: 0.5, currentTime: DAY_START + 43_200, timeMode: "live",
      selectedDate: new Date(DAY_START * 1000), rangeDays: 1, windowStart: DAY_START, windowEnd: dayEnd(1),
      onToggle: noop, onSpeedChange: noop, onSeekByProgress: noop, onJumpToTime: noop, onTimeModeChange: noop,
      onDateChange: noop, onShiftDate: noop, onRangeDaysChange: noop,
    }));
    expect(html).toContain('role="slider"');
    expect(html).toContain('data-viewport-occluder="timeline"');
    expect(html).toContain("即時");
    expect(html).toContain("> 天");
    expect(html).toContain('aria-label="日期與範圍：');
    expect(html).toContain("60×");
    expect(html).not.toContain('type="range"');
    expect(html).not.toMatch(/Now|LIVE|\d+x</);
  });

  it("歷史模式（展開）：時間膠囊＋倍速", () => {
    const html = renderToStaticMarkup(createElement(HistoricalTimeline, {
      isMobile: true,
      year: 115, month: 9, day: 27, availableYears: range(104, 115), playing: false, speed: 1, granularity: "month",
      isDarkTheme: false, onTogglePlay: noop, onSpeedChange: noop, onYearChange: noop, onMonthChange: noop,
      onDayChange: noop, onGranularityChange: noop,
    }));
    expect(html).toContain('data-testid="historical-timeline"');
    expect(html).toContain("tl3--light");
    expect(html).toContain("115/09");
    expect(html).toContain('aria-label="時間與粒度：民國 115 年 9 月"');
    expect(html).toContain("1×");
    expect(html).not.toContain('type="range"');
  });
});
