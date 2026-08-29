import { describe, expect, it } from "vitest";
import { formatGfwUtcWindow, mergeGfwTimelineWindows, nearestGfwWindowHour, utcDateWindowSeconds } from "./gfwTimelineDataWindow";

describe("GFW timeline data-window UX", () => {
  it("UTC 單日 release 完整涵蓋 24 小時，跨兩個台北日", () => {
    const window = utcDateWindowSeconds("2026-08-21", "2026-08-21");
    expect(window).toEqual({
      startUtcSeconds: Date.parse("2026-08-21T00:00:00Z") / 1000,
      endUtcSecondsExclusive: Date.parse("2026-08-22T00:00:00Z") / 1000,
    });
    expect(new Date(window!.startUtcSeconds * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }))
      .toContain("2026-08-21 08:00:00");
    expect(new Date((window!.endUtcSecondsExclusive - 1) * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }))
      .toContain("2026-08-22 07:59:59");
    expect(formatGfwUtcWindow(window!.startUtcSeconds, window!.endUtcSecondsExclusive))
      .toBe("2026-08-21 00:00–2026-08-22 00:00 UTC");
  });

  it("顯式跳轉選最近可用 UTC 整點，不在計算時改寫或 clamp 目前時間", () => {
    const start = Date.parse("2026-08-21T00:00:00Z") / 1000;
    const end = Date.parse("2026-08-22T00:00:00Z") / 1000;
    const before = Date.parse("2026-08-20T12:34:00Z") / 1000;
    const after = Date.parse("2026-08-23T12:34:00Z") / 1000;
    expect(nearestGfwWindowHour(before, start, end)).toBe(start);
    expect(nearestGfwWindowHour(after, start, end)).toBe(Date.parse("2026-08-21T23:00:00Z") / 1000);
    expect(before).toBe(Date.parse("2026-08-20T12:34:00Z") / 1000);
  });

  it("Grid 與 Tracks 相同 release window 合併成單一提示", () => {
    const start = Date.parse("2026-08-21T00:00:00Z") / 1000;
    const end = Date.parse("2026-08-22T00:00:00Z") / 1000;
    expect(mergeGfwTimelineWindows([
      { layers: ["Grid"], startUtcSeconds: start, endUtcSecondsExclusive: end },
      { layers: ["Tracks"], startUtcSeconds: start, endUtcSecondsExclusive: end },
    ])).toEqual([
      { layers: ["Grid", "Tracks"], startUtcSeconds: start, endUtcSecondsExclusive: end },
    ]);
  });
});
