import { describe, expect, it } from "vitest";
import { COUNTRIES, countryForPoint, isCountryCode } from "../countries";

describe("countries", () => {
  it("國碼與 chip 一致、bbox 都是合法矩形", () => {
    for (const country of COUNTRIES) {
      expect(country.chip).toBe(country.code);
      expect(country.labelKey).toBe(`country.${country.code}`);
      for (const [west, south, east, north] of country.bboxes) {
        expect(west).toBeLessThan(east);
        expect(south).toBeLessThan(north);
      }
    }
    expect(isCountryCode("JP")).toBe(true);
    expect(isCountryCode("jp")).toBe(false);
  });

  it.each([
    ["台北", 121.53, 25.05, "TW"],
    ["金門", 118.3, 24.45, "TW"],
    ["馬祖", 119.95, 26.15, "TW"],
    ["澎湖", 119.57, 23.57, "TW"],
    ["蘭嶼", 121.55, 22.05, "TW"],
    ["東京", 139.77, 35.68, "JP"],
    ["札幌", 141.35, 43.06, "JP"],
    ["福岡", 130.4, 33.59, "JP"],
    ["那霸", 127.68, 26.21, "JP"],
    ["與那國", 123.0, 24.47, "JP"],
    ["石垣", 124.16, 24.34, "JP"],
    ["巴黎", 2.35, 48.86, "FR"],
    ["馬賽", 5.37, 43.3, "FR"],
    ["阿雅克肖", 8.74, 41.93, "FR"],
    ["史特拉斯堡", 7.75, 48.58, "FR"],
  ] as const)("%s → %s", (_name, lng, lat, code) => {
    expect(countryForPoint(lng, lat)).toBe(code);
  });

  it.each([
    ["釣魚台一帶", 123.5, 25.75],
    ["釜山", 129.07, 35.18],
    ["上海", 121.47, 31.23],
    ["布魯塞爾", 4.35, 50.85],
    ["太平洋", 150, 20],
  ] as const)("%s 不屬於任何國家", (_name, lng, lat) => {
    expect(countryForPoint(lng, lat)).toBeUndefined();
  });
});
