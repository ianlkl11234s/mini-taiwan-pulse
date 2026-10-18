import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async () => (await import("./hookHarness")).reactMock);

import { harness } from "./hookHarness";
import { useTimeline } from "../useTimeline";

const render = (timeMode: "live" | "replay") => {
  harness.begin();
  return useTimeline({ dataStartTime: 0, dataEndTime: 0, timeMode });
};

describe("useTimeline 模式切換與自動播放（F194）", () => {
  beforeEach(() => { vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval, clearInterval });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => { harness.cleanup(); vi.unstubAllGlobals(); });

  it("一般 replay：資料載入完成的 autoPlay 會開始播放", () => {
    render("replay").autoPlay();
    expect(render("replay").playing).toBe(true);
  });

  it("live → replay 視同使用者暫停：之後的 autoPlay 不可自行開始播放", () => {
    render("live").setTimeMode("replay");
    const replay = render("live");
    expect(replay.timeMode).toBe("replay");
    replay.autoPlay();
    expect(render("live").playing).toBe(false);
  });

});
