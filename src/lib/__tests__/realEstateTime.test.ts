import { describe, expect, it } from "vitest";
import { snapQuarterStart, stepReCursor } from "../realEstateTime";

const ts = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

describe("stepReCursor（房地產游標鍵盤步進）", () => {
  it("季：前後各一季，不因固定 92 天跳過 Q1", () => {
    expect(snapQuarterStart(stepReCursor(ts(2025, 4, 1), "quarter", -1))).toBe(ts(2025, 1, 1));
    expect(stepReCursor(ts(2025, 1, 1), "quarter", 1)).toBe(ts(2025, 4, 1));
  });

  it("月：依日曆前後一個月，月底夾到目標月末", () => {
    expect(stepReCursor(ts(2025, 3, 1), "month", -1)).toBe(ts(2025, 2, 1));
    expect(stepReCursor(ts(2025, 1, 31), "month", 1)).toBe(ts(2025, 2, 28));
    expect(stepReCursor(ts(2024, 12, 15), "month", 1)).toBe(ts(2025, 1, 15));
  });

  it("週：固定 ±7 天", () => {
    expect(stepReCursor(ts(2025, 3, 1), "week", 1)).toBe(ts(2025, 3, 8));
  });
});
