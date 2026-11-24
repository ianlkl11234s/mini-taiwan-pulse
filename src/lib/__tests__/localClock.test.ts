import { describe, expect, it } from "vitest";
import { countryForMapCenter, localClockFor, localClockForCountry } from "../localClock";

const utc = (iso: string) => Date.parse(iso) / 1000;

describe("localClockFor", () => {
  it("台北（及同位移）回 null", () => {
    expect(localClockFor(utc("2026-11-23T05:30:00Z"), "Asia/Taipei")).toBeNull();
    expect(localClockFor(utc("2026-11-23T05:30:00Z"), "Asia/Manila")).toBeNull();
  });

  it("倫敦冬令 UTC+0", () => {
    expect(localClockFor(utc("2026-01-15T05:30:00Z"), "Europe/London")).toEqual({ time: "05:30", offset: "+0", dayShift: 0 });
  });

  it("倫敦夏令 UTC+1", () => {
    expect(localClockFor(utc("2026-07-15T05:30:00Z"), "Europe/London")).toEqual({ time: "06:30", offset: "+1", dayShift: 0 });
  });

  it("隔天：東邊時區比台北晚（UTC+13 奧克蘭夏令）", () => {
    // UTC 2026-01-15 12:00 → 台北 20:00（15 日）、奧克蘭 01:00（16 日）
    expect(localClockFor(utc("2026-01-15T12:00:00Z"), "Pacific/Auckland")).toEqual({ time: "01:00", offset: "+13", dayShift: 1 });
  });

  it("前一天（台北凌晨、倫敦前一晚）", () => {
    // UTC 2026-01-15 00:30 → 台北 08:30（15 日）；溫哥華 16:30（14 日）
    expect(localClockFor(utc("2026-01-15T00:30:00Z"), "America/Vancouver")).toEqual({ time: "16:30", offset: "-8", dayShift: -1 });
    // 台北 00:30（15 日）= UTC 14 日 16:30 → 倫敦 14 日 16:30
    expect(localClockFor(utc("2026-01-14T16:30:00Z"), "Europe/London")).toEqual({ time: "16:30", offset: "+0", dayShift: -1 });
  });

  it("半小時位移", () => {
    expect(localClockFor(utc("2026-01-15T05:30:00Z"), "Asia/Kolkata")).toMatchObject({ time: "11:00", offset: "+5:30" });
  });

  it("無效輸入回 null", () => {
    expect(localClockFor(NaN, "Europe/London")).toBeNull();
  });
});

describe("localClockForCountry / countryForMapCenter", () => {
  const t = utc("2026-01-15T05:30:00Z");
  it("台灣、菲律賓、中國（+8）回 null", () => {
    expect(localClockForCountry(t, "TW")).toBeNull();
    expect(localClockForCountry(t, "PH")).toBeNull();
    expect(localClockForCountry(t, "CN")).toBeNull();
  });
  it("英國", () => {
    expect(localClockForCountry(t, "GB")).toEqual({ time: "05:30", offset: "+0", dayShift: 0 });
  });
  it("日本 UTC+9", () => {
    expect(localClockForCountry(t, "JP")).toEqual({ time: "14:30", offset: "+9", dayShift: 0 });
  });
  it("加拿大用預設 timeZone（跨時區依位置選是第 4 步）", () => {
    const clock = localClockForCountry(t, "CA");
    expect(clock).not.toBeNull();
    expect(clock!.offset.startsWith("-")).toBe(true);
  });
  it("不在任何國家框內回 null", () => {
    expect(countryForMapCenter(-30, 30)).toBeUndefined();
    expect(localClockForCountry(t, countryForMapCenter(-30, 30))).toBeNull();
  });
  it("倫敦座標判為英國", () => {
    expect(countryForMapCenter(-0.12, 51.5)).toBe("GB");
  });
});
