import { describe, it, expect } from "vitest";
import { judgeFreshness, type MonitorFreshnessSpec } from "../monitorFreshness";

/** spec §5.35 狀態字表 */
const MIN = 60_000;
const DAY = 86_400_000;
// 2026-10-03 12:00 台灣時間
const NOW = Date.UTC(2026, 9, 3, 4, 0);
const stream: MonitorFreshnessSpec = { cadence: "stream", periodMin: 10 };
const daily: MonitorFreshnessSpec = { cadence: "days" };
const market: MonitorFreshnessSpec = { cadence: "market", periodMin: 1 };

describe("judgeFreshness", () => {
  it("即時：週期內、2 週期內都只顯示時間", () => {
    expect(judgeFreshness(stream, NOW - 5 * MIN, NOW).state).toBe("live");
    expect(judgeFreshness(stream, NOW - 20 * MIN, NOW).header).toBeNull();
  });

  it("延遲：> 2 週期，只把時間變色、不降灰", () => {
    const f = judgeFreshness(stream, NOW - 25 * MIN, NOW);
    expect(f.state).toBe("delay");
    expect(f.header).toEqual({ kind: "delay" });
    expect(f.muted).toBe(false);
    expect(f.reason).toBeNull();
  });

  it("過期：> 6 週期，pill＋降灰＋尾段斜線＋原因", () => {
    const f = judgeFreshness(stream, NOW - 3 * 3600_000, NOW);
    expect(f.state).toBe("stale");
    expect(f.header).toEqual({ kind: "stale", label: "過期 3 小時" });
    expect(f.muted).toBe(true);
    expect(f.staleUntil).toBe(NOW / 1000);
    expect(f.reason).toContain("10/03 09:00");
  });

  it("停更：> 7 天", () => {
    const f = judgeFreshness(stream, NOW - 10 * DAY, NOW);
    expect(f.state).toBe("stopped");
    expect(f.header).toEqual({ kind: "stopped", label: "停更 10 天" });
  });

  it("日批次以台灣日期差判斷：昨天即時、3 天過期、8 天停更", () => {
    const day = (n: number) => Date.UTC(2026, 9, 3 - n) - 8 * 3600_000; // 台灣午夜
    expect(judgeFreshness(daily, day(1), NOW).state).toBe("live");
    expect(judgeFreshness(daily, day(2), NOW).state).toBe("live");
    expect(judgeFreshness(daily, day(3), NOW).header).toEqual({ kind: "stale", label: "過期 3 天" });
    expect(judgeFreshness(daily, day(8), NOW).header).toEqual({ kind: "stopped", label: "停更 8 天" });
    expect(judgeFreshness({ cadence: "days", staleDays: 3 }, day(3), NOW).state).toBe("live");
  });

  it("收盤：中性 pill、不降灰；資料太舊時不能一直掛收盤", () => {
    const f = judgeFreshness(market, NOW - 20 * 3600_000, NOW, { paused: true });
    expect(f.state).toBe("paused");
    expect(f.header).toEqual({ kind: "paused", label: "收盤" });
    expect(f.muted).toBe(false);
    expect(judgeFreshness(market, NOW - 6 * DAY, NOW, { paused: true }).state).toBe("stale");
  });

  it("無資料：「—」＋原因，標題列不出 pill", () => {
    const f = judgeFreshness(stream, null, NOW);
    expect(f.state).toBe("none");
    expect(f.header).toBeNull();
    expect(f.reason).toBe("尚無資料");
  });

  it("來源已下架、事件型、未來時間", () => {
    expect(judgeFreshness(daily, NOW - DAY, NOW, { retired: true }).header).toEqual({ kind: "stopped", label: "來源已下架" });
    expect(judgeFreshness({ cadence: "event" }, NOW - 30 * DAY, NOW).state).toBe("live");
    expect(judgeFreshness(stream, NOW + 5 * MIN, NOW).state).toBe("live");
  });

  it("可覆寫卡底原因", () => {
    expect(judgeFreshness(daily, NOW - 30 * DAY, NOW, { reason: "上游未更新" }).reason).toBe("上游未更新");
  });
});
