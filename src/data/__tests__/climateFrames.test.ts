import { describe, it, expect } from "vitest";
import { pickNearestFrame, type ClimateFrame } from "../climateFrames";

function frame(t: string, kind: "analysis" | "forecast" = "analysis"): ClimateFrame {
  return {
    t,
    tMs: Date.parse(t),
    png: `${kind}/${t}.png`,
    u_min: -1, u_max: 1, v_min: -1, v_max: 1,
    kind,
  };
}

// 升冪：過去 daily analysis 3 幀 + 未來 6h forecast 2 幀
const frames: ClimateFrame[] = [
  frame("2026-07-18T00:00:00Z"),
  frame("2026-07-19T00:00:00Z"),
  frame("2026-07-20T00:00:00Z"),
  frame("2026-07-20T06:00:00Z", "forecast"),
  frame("2026-07-20T12:00:00Z", "forecast"),
];

describe("pickNearestFrame", () => {
  it("空清單回 null", () => {
    expect(pickNearestFrame([], Date.now())).toBeNull();
  });

  it("命中恰好的幀", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-07-19T00:00:00Z"));
    expect(got?.t).toBe("2026-07-19T00:00:00Z");
  });

  it("兩幀之間取較近者", () => {
    // 07-19 20:00 距 07-19 00:00 = 20h，距 07-20 00:00 = 4h → 取後者
    const got = pickNearestFrame(frames, Date.parse("2026-07-19T20:00:00Z"));
    expect(got?.t).toBe("2026-07-20T00:00:00Z");
  });

  it("落在未來 forecast 區間選最近 forecast 幀", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-07-20T05:00:00Z"));
    expect(got?.t).toBe("2026-07-20T06:00:00Z");
    expect(got?.kind).toBe("forecast");
  });

  it("早於全部 → 取第一幀", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-07-01T00:00:00Z"));
    expect(got?.t).toBe("2026-07-18T00:00:00Z");
  });

  it("晚於全部 → 取最後一幀", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-08-01T00:00:00Z"));
    expect(got?.t).toBe("2026-07-20T12:00:00Z");
  });

  it("等距時取較早的幀", () => {
    // 07-19 12:00 距 07-19 00:00 與 07-20 00:00 皆 12h → 取較早
    const got = pickNearestFrame(frames, Date.parse("2026-07-19T12:00:00Z"));
    expect(got?.t).toBe("2026-07-19T00:00:00Z");
  });
});
