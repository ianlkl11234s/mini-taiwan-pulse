import { describe, expect, it } from "vitest";
import { alignLocalInstant, countryClockTimeZone, countryForMapCenter, localClockFor, localClockForCountry } from "../localClock";
import { zonedParts } from "../zonedTime";

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
  it("加拿大跨多個時區 → 改顯示 UTC", () => {
    expect(localClockForCountry(t, "CA")).toEqual({ time: "05:30", offset: "+0", dayShift: 0, utc: true });
  });
  it("UTC 也標前一天（台北已跨日、UTC 還沒）", () => {
    expect(localClockForCountry(utc("2026-01-15T20:00:00Z"), "CA")).toEqual({ time: "20:00", offset: "+0", dayShift: -1, utc: true });
  });
  it("單一時區國家不帶 utc 旗標", () => {
    expect(localClockForCountry(t, "GB")?.utc).toBeUndefined();
  });
  it("不在任何國家框內回 null", () => {
    expect(countryForMapCenter(-30, 30)).toBeUndefined();
    expect(localClockForCountry(t, countryForMapCenter(-30, 30))).toBeNull();
  });
  it("review #1194：換世界副本（lng 超出 ±180）仍判得出國家", () => {
    expect(countryForMapCenter(139.7 + 360, 35.7)).toBe(countryForMapCenter(139.7, 35.7));
    expect(countryForMapCenter(139.7 + 360, 35.7)).toBeDefined();
    expect(countryForMapCenter(-0.12 - 360, 51.5)).toBe("GB");
  });
  it("倫敦座標判為英國", () => {
    expect(countryForMapCenter(-0.12, 51.5)).toBe("GB");
  });
});

describe("alignLocalInstant（當地同時刻，G2-4）", () => {
  const sameWall = (a: number, tzA: string, b: number, tzB: string) => {
    const pa = zonedParts(a * 1000, tzA);
    const pb = zonedParts(b * 1000, tzB);
    return [pa.year, pa.month, pa.day, pa.hour, pa.minute].join() === [pb.year, pb.month, pb.day, pb.hour, pb.minute].join();
  };

  it("台北 08:00 → 倫敦冬令 08:00：位移差 −8 小時，所以那一刻晚 8 小時", () => {
    const t = utc("2026-01-15T00:00:00Z");
    const r = alignLocalInstant(t, "Asia/Taipei", "Europe/London");
    expect(r - t).toBe(8 * 3600);
    expect(sameWall(t, "Asia/Taipei", r, "Europe/London")).toBe(true);
  });

  it("台北 08:00 → 倫敦夏令 08:00：位移差 −7 小時，那一刻晚 7 小時", () => {
    const t = utc("2026-07-15T00:00:00Z");
    const r = alignLocalInstant(t, "Asia/Taipei", "Europe/London");
    expect(r - t).toBe(7 * 3600);
    expect(sameWall(t, "Asia/Taipei", r, "Europe/London")).toBe(true);
  });

  it("台北 08:00 → 東京 08:00：位移差 +1 小時，那一刻早 1 小時", () => {
    const t = utc("2026-01-15T00:00:00Z");
    const r = alignLocalInstant(t, "Asia/Taipei", "Asia/Tokyo");
    expect(r - t).toBe(-3600);
    expect(sameWall(t, "Asia/Taipei", r, "Asia/Tokyo")).toBe(true);
  });

  it("夏令切換當天用目標那一刻的位移（英國 2026-03-29 01:00 起跳夏令）", () => {
    // 台北 3/29 12:00 → 倫敦 3/29 12:00 BST＝11:00Z；用同一刻的位移（GMT）猜會錯一小時
    const t = utc("2026-03-29T04:00:00Z");
    const r = alignLocalInstant(t, "Asia/Taipei", "Europe/London");
    expect(r).toBe(utc("2026-03-29T11:00:00Z"));
  });

  it("同時區原樣回傳", () => {
    const t = utc("2026-01-15T00:00:00Z");
    expect(alignLocalInstant(t, "Asia/Taipei", "Asia/Taipei")).toBe(t);
  });
});

describe("countryClockTimeZone", () => {
  it("單一時區國家用自己的時區；跨時區（加拿大）用 UTC", () => {
    expect(countryClockTimeZone("GB")).toBe("Europe/London");
    expect(countryClockTimeZone("CA")).toBe("UTC");
  });
  it("localClockForCountry always：和台北同位移也回傳", () => {
    const t = utc("2026-01-15T00:00:00Z");
    expect(localClockForCountry(t, "PH")).toBeNull();
    expect(localClockForCountry(t, "PH", true)).toMatchObject({ time: "08:00", offset: "+8" });
  });
});
