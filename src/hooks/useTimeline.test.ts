import { describe, expect, it } from "vitest";
import {
  advanceReplayFrame,
  dayEndUnix,
  dayStartUnix,
  historicalPeriodSnapshot,
  taiwanDateParts,
} from "./useTimeline";

describe("useTimeline 時間契約", () => {
  it("以 Asia/Taipei 日曆日切窗，UTC 跨日不改成 UTC 日", () => {
    const instant = new Date("2026-08-21T20:30:00Z");
    expect(taiwanDateParts(instant)).toEqual([2026, 7, 22]);
    expect(new Date(dayStartUnix(instant) * 1000).toISOString()).toBe("2026-08-21T16:00:00.000Z");
    expect(new Date(dayEndUnix(instant) * 1000).toISOString()).toBe("2026-08-22T15:59:59.000Z");
  });

  it("播放抵達 windowEnd 時停止在尾端，不跳回 windowStart", () => {
    expect(advanceReplayFrame(100, 0.5, 60, 120)).toEqual({ time: 120, reachedEnd: true });
    expect(advanceReplayFrame(100, 0.1, 60, 120)).toEqual({ time: 106, reachedEnd: false });
  });

  it("民國 115/9/3 使用該日結束前 snapshot，window 精確覆蓋該台北日", () => {
    const snapshot = historicalPeriodSnapshot(115, 9, 3, "day");

    expect(new Date(snapshot.cursorTime * 1000).toISOString()).toBe("2026-09-03T15:59:59.999Z");
    expect(snapshot.cursorTime).toBeLessThan(Date.parse("2026-09-04T00:00:00+08:00") / 1000);
    expect(snapshot.dateKey).toBe("2026-09-03");
    expect(snapshot.windowStart).toBe("2026-09-02T16:00:00.000Z");
    expect(snapshot.windowEnd).toBe("2026-09-03T16:00:00.000Z");
  });

  it("年／月粒度同樣取期間結束前，而不是日初", () => {
    expect(new Date(historicalPeriodSnapshot(115, 9, 1, "month").cursorTime * 1000).toISOString())
      .toBe("2026-09-30T15:59:59.999Z");
    expect(new Date(historicalPeriodSnapshot(115, 1, 1, "year").cursorTime * 1000).toISOString())
      .toBe("2026-12-31T15:59:59.999Z");
  });
});
