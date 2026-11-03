import { describe, expect, it } from "vitest";
import { formatMeasureArea, formatMeasureDistance, measureArea, measureDistance, type LngLat } from "../measureMath";

const fmt = (value: number, options?: Intl.NumberFormatOptions) => value.toLocaleString("zh-TW", options);

describe("measureDistance", () => {
  it("赤道上 1° 經度約 111.2 km（turf 球面）", () => {
    const { segments, total } = measureDistance([[121, 0], [122, 0]]);
    expect(segments).toHaveLength(1);
    expect(total / 1000).toBeCloseTo(111.19, 1);
  });
  it("多段加總、單點為 0", () => {
    const pts: LngLat[] = [[121.5, 25], [121.51, 25], [121.51, 25.01]];
    const { segments, total } = measureDistance(pts);
    expect(segments).toHaveLength(2);
    expect(total).toBeCloseTo(segments[0]! + segments[1]!, 6);
    expect(measureDistance([[121, 25]]).total).toBe(0);
  });
});

describe("measureArea", () => {
  it("約 1 km × 1 km 的方塊接近 1 km²，周長約 4 km", () => {
    const dLat = 1000 / 111_195; // 1 km 緯度
    const dLng = dLat / Math.cos((25 * Math.PI) / 180);
    const pts: LngLat[] = [[121, 25], [121 + dLng, 25], [121 + dLng, 25 + dLat], [121, 25 + dLat]];
    const { area, perimeter } = measureArea(pts);
    expect(area / 1e6).toBeGreaterThan(0.99);
    expect(area / 1e6).toBeLessThan(1.01);
    expect(perimeter / 1000).toBeCloseTo(4, 1);
  });
  it("少於 3 點面積 0", () => {
    expect(measureArea([[121, 25], [121.1, 25]]).area).toBe(0);
  });
});

describe("formatMeasureDistance", () => {
  it("<1000 m 整數 m、否則 km 兩位", () => {
    expect(formatMeasureDistance(0, fmt)).toBe("0 m");
    expect(formatMeasureDistance(999.4, fmt)).toBe("999 m");
    expect(formatMeasureDistance(1000, fmt)).toBe("1.00 km");
    expect(formatMeasureDistance(5361.2, fmt)).toBe("5.36 km");
    expect(formatMeasureDistance(1_234_567, fmt)).toBe("1,234.57 km");
  });
});

describe("formatMeasureArea", () => {
  it("m² → 公頃 → km²", () => {
    expect(formatMeasureArea(9_999.4, fmt, "公頃")).toBe("9,999 m²");
    expect(formatMeasureArea(10_000, fmt, "公頃")).toBe("1.0 公頃");
    expect(formatMeasureArea(254_000, fmt, "ha")).toBe("25.4 ha");
    expect(formatMeasureArea(2_460_000, fmt, "公頃")).toBe("2.46 km²");
  });
});
