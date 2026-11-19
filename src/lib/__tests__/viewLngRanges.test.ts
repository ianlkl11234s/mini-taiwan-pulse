import { describe, expect, it } from "vitest";
import { viewLngRanges } from "../viewLngRanges";
import { bboxIntersects } from "../../map/layerVisibilityHint";

describe("viewLngRanges", () => {
  it("一般視窗不變", () => {
    expect(viewLngRanges(120, 125)).toEqual([[120, 125]]);
  });
  it("另一份世界 wrap 回 [-180, 180]", () => {
    expect(viewLngRanges(480, 485)).toEqual([[120, 125]]);
    expect(viewLngRanges(-240, -235)).toEqual([[120, 125]]);
  });
  it("跨 ±180 回兩段", () => {
    expect(viewLngRanges(179, 181)).toEqual([[-181, -179], [179, 181]]);
  });
  it("寬度 ≥ 360 視為整個世界", () => {
    expect(viewLngRanges(-200, 200)).toEqual([[-180, 180]]);
  });
});

describe("bboxIntersects 經度 wrap（review 2026-11-18 F031 橫向）", () => {
  const taiwan: [number, number, number, number] = [119, 21, 123, 26];
  it("另一份世界看得到涵蓋區就算相交", () => {
    expect(bboxIntersects([120 + 360, 22, 122 + 360, 25], taiwan)).toBe(true);
    expect(bboxIntersects([10, 22, 12, 25], taiwan)).toBe(false);
  });
});
