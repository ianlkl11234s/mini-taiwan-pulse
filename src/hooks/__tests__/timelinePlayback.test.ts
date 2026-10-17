import { describe, expect, it } from "vitest";
import { advanceReplayFrame, replayPlaybackEnd } from "../useTimeline";

describe("replay 播放終點", () => {
  it("今天的視窗停在「現在」，不播進未來", () => {
    const windowEnd = 1_000_000;
    const now = 900_000;
    expect(replayPlaybackEnd(windowEnd, now)).toBe(now);
  });

  it("過去日期的視窗停在視窗結尾", () => {
    expect(replayPlaybackEnd(500_000, 900_000)).toBe(500_000);
  });

  it("抵達終點時停在終點並回報 reachedEnd", () => {
    expect(advanceReplayFrame(890, 1, 60, 900)).toEqual({ time: 900, reachedEnd: true });
    expect(advanceReplayFrame(800, 1, 60, 900)).toEqual({ time: 860, reachedEnd: false });
  });

  it("已經在終點之後（使用者拖進未來）按播放：原地停，不往回跳", () => {
    expect(advanceReplayFrame(950, 1, 60, 900)).toEqual({ time: 950, reachedEnd: true });
  });
});
