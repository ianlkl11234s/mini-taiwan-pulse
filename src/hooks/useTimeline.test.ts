import { describe, expect, it } from "vitest";
import { advanceReplayFrame, dayEndUnix, dayStartUnix, taiwanDateParts } from "./useTimeline";

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
});
