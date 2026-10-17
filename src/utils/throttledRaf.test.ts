import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startThrottledRaf } from "./throttledRaf";

describe("startThrottledRaf", () => {
  let frames: Array<(ts: number) => void> = [];
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: (ts: number) => void) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  const runFrames = (count: number, frameMs: number) => {
    for (let i = 0; i < count; i++) {
      const cb = frames.shift();
      if (!cb) return;
      cb(i * frameMs);
    }
  };

  it("60Hz 幀率下約每 50ms 呼叫一次（每 3 幀）", () => {
    const tick = vi.fn();
    startThrottledRaf(tick, 50);
    runFrames(60, 1000 / 60); // 1 秒
    expect(tick).toHaveBeenCalledTimes(20);
  });

  it("cancel 後不再呼叫、不再排程", () => {
    const tick = vi.fn();
    const stop = startThrottledRaf(tick, 50);
    runFrames(3, 1000 / 60);
    stop();
    const called = tick.mock.calls.length;
    runFrames(30, 1000 / 60);
    expect(tick.mock.calls.length).toBe(called);
  });

  it("tick 回傳 false 即停止迴圈", () => {
    const tick = vi.fn(() => false);
    startThrottledRaf(tick, 50);
    runFrames(30, 1000 / 60);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(frames.length).toBe(0);
  });
});
