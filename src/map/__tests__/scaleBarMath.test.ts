import { describe, expect, it } from "vitest";
import {
  accuracyRadiusPx,
  formatDistance,
  formatScaleRatio,
  metersPerPixel,
  niceDistance,
  scaleBarModel,
} from "../scaleBarMath";

describe("metersPerPixel", () => {
  it("赤道 z0 為周長 / 512", () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(40075016.686 / 512, 3);
  });
  it("每放大一級減半，緯度越高越小", () => {
    expect(metersPerPixel(25, 13)).toBeCloseTo(metersPerPixel(25, 12) / 2, 9);
    expect(metersPerPixel(60, 10)).toBeCloseTo(metersPerPixel(0, 10) / 2, 6);
  });
});

describe("niceDistance", () => {
  it.each([
    [1, 1], [1.9, 1], [2, 2], [4.99, 2], [5, 5], [9.9, 5], [10, 10], [380, 200], [7400, 5000], [0.3, 0.2],
  ])("%s → %s", (max, nice) => {
    expect(niceDistance(max)).toBeCloseTo(nice, 9);
  });
  it("非正數回 0", () => {
    expect(niceDistance(0)).toBe(0);
    expect(niceDistance(Number.NaN)).toBe(0);
  });
});

describe("formatDistance", () => {
  it("<1000 用 m，≥1000 用 km", () => {
    expect(formatDistance(500)).toBe("500 m");
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(2500)).toBe("2.5 km");
    expect(formatDistance(20000)).toBe("20 km");
  });
});

describe("formatScaleRatio", () => {
  it("2 位有效數字＋K／M", () => {
    // 12.17 m/px ÷ 0.0002646 ≈ 46,000
    expect(formatScaleRatio(12.17)).toBe("1:46K");
    expect(formatScaleRatio(0.1)).toBe("1:380");
    expect(formatScaleRatio(500)).toBe("1:1.9M");
  });
});

describe("scaleBarModel", () => {
  it("長條不超過 maxPx，距離是 1/2/5×10ⁿ，標籤同單位", () => {
    for (const z of [5, 7.3, 10, 12.5, 15, 18, 21]) {
      const m = scaleBarModel(25.04, z)!;
      expect(m.px).toBeLessThanOrEqual(200 + 1e-9);
      expect(m.px).toBeGreaterThan(200 / 5 - 1e-9);
      const lead = m.meters / 10 ** Math.floor(Math.log10(m.meters));
      expect([1, 2, 5]).toContain(Math.round(lead));
    }
  });
  it("臺北 z12.5 → 2 km 長條，中點 1", () => {
    const m = scaleBarModel(25.04, 12.5)!;
    expect(m.meters).toBe(2000);
    expect(m.labels).toEqual(["0", "1", "2 km"]);
    expect(m.ratio).toMatch(/^1:\d+(\.\d)?K$/);
  });
  it("公尺級中點不帶單位", () => {
    const m = scaleBarModel(25.04, 17)!;
    expect(m.labels[2]).toMatch(/ m$/);
    expect(m.labels[1]).not.toMatch(/m/);
  });
});

describe("accuracyRadiusPx", () => {
  it("精度公尺換成 px", () => {
    const mpp = metersPerPixel(25, 15);
    expect(accuracyRadiusPx(100, 25, 15)).toBeCloseTo(100 / mpp, 9);
    expect(accuracyRadiusPx(0, 25, 15)).toBe(0);
  });
});
