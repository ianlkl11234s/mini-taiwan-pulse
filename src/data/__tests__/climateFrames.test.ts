import { describe, it, expect } from "vitest";
import { pickNearestFrame, FRAME_PICK_TOLERANCE_MS, type ClimateFrame } from "../climateFrames";

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

describe("pickNearestFrame 容差上限", () => {
  const HOUR = 3600_000;

  it("不傳容差 → 維持舊行為（多遠都給）", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-08-14T00:00:00Z"));
    expect(got?.t).toBe("2026-07-20T12:00:00Z");
  });

  it("窗口過期（幀停在 7/20、目標 8/14）→ null", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-08-14T00:00:00Z"), FRAME_PICK_TOLERANCE_MS);
    expect(got).toBeNull();
  });

  it("daily 幀最壞合法距離 12h 仍在 18h 容差內", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-07-19T12:00:00Z"), FRAME_PICK_TOLERANCE_MS);
    expect(got?.t).toBe("2026-07-19T00:00:00Z");
  });

  it("距離剛好等於容差 → 給（不是嚴格小於）", () => {
    // 目標 07-18 00:00 減 18h＝07-17 06:00，距首幀恰 18h
    const got = pickNearestFrame(frames, Date.parse("2026-07-17T06:00:00Z"), 18 * HOUR);
    expect(got?.t).toBe("2026-07-18T00:00:00Z");
  });

  it("距離超過容差 1ms → null", () => {
    const got = pickNearestFrame(frames, Date.parse("2026-07-17T06:00:00Z") - 1, 18 * HOUR);
    expect(got).toBeNull();
  });

  it("空清單 + 容差 → null", () => {
    expect(pickNearestFrame([], Date.now(), FRAME_PICK_TOLERANCE_MS)).toBeNull();
  });
});
