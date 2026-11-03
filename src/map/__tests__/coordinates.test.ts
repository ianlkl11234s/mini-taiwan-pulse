import { describe, expect, it } from "vitest";
import { formatLatLng, formatTwd97, wgs84ToTwd97 } from "../coordinates";

// 真值：pyproj 3.8（EPSG:4326 → EPSG:3826，always_xy）
const CONTROL: [number, number, number, number][] = [
  [121.5654, 25.0418, 307052.748, 2770526.576],
  [121, 23.5, 250000.0, 2599651.349],
  [120.3, 22.6, 178030.435, 2500160.02],
  [121.75, 25.13, 325626.536, 2780386.935],
  [119.6, 23.57, 107082.744, 2608101.474],
];

describe("wgs84ToTwd97", () => {
  it.each(CONTROL)("(%f, %f) 誤差 < 1 m", (lng, lat, x, y) => {
    const out = wgs84ToTwd97(lng, lat);
    expect(Math.abs(out.x - x)).toBeLessThan(1);
    expect(Math.abs(out.y - y)).toBeLessThan(1);
  });

  it("formatTwd97 取整數公尺", () => {
    expect(formatTwd97(121.5654, 25.0418)).toBe("307053, 2770527");
  });
});

describe("formatLatLng", () => {
  it("緯度在前、固定小數位", () => {
    expect(formatLatLng(25.0418, 121.5654)).toBe("25.0418, 121.5654");
    expect(formatLatLng(25.04181234, 121.565, 6)).toBe("25.041812, 121.565000");
  });
});
