import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leftClock, rightClock, rightTimeOf, shiftWindowDateKeys } from "../sideClock";
import { compareStore } from "../compareStore";
import { countryStore } from "../countryStore";
import { timeStore } from "../timeStore";

const utc = (iso: string) => Date.parse(iso) / 1000;
// 台北 2026-01-15 08:00（冬令）
const T_WINTER = utc("2026-01-15T00:00:00Z");

function openCountries(right: "GB" | "JP" | "PH" | "CA", align: "instant" | "local") {
  compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: right, timeAlign: align });
}

describe("sideClock", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval, clearInterval });
    countryStore.reset();
    compareStore.reset();
    timeStore.setTime(T_WINTER);
  });
  afterEach(() => {
    compareStore.reset();
    countryStore.reset();
    vi.unstubAllGlobals();
  });

  it("同一刻、或不在並排：右側＝時間軸", () => {
    expect(rightClock.getTime()).toBe(T_WINTER);
    openCountries("GB", "instant");
    expect(rightClock.getTime()).toBe(T_WINTER);
    expect(rightClock.getDateKey()).toBe(timeStore.getDateKey());
    expect(leftClock.getTime()).toBe(T_WINTER);
  });

  it("當地同時刻：台灣 08:00 ↔ 英國 08:00（晚 8 小時）、東京 08:00（早 1 小時）；左側不動", () => {
    openCountries("GB", "local");
    expect(rightClock.getTime() - T_WINTER).toBe(8 * 3600);
    expect(leftClock.getTime()).toBe(T_WINTER);
    compareStore.setRightCountry("JP");
    expect(rightClock.getTime() - T_WINTER).toBe(-3600);
  });

  it("左側國家不是台灣：以左國鐘點對齊（日本 ↔ 英國差 9 小時）", () => {
    countryStore.set("JP");
    openCountries("GB", "local");
    expect(rightClock.getTime() - T_WINTER).toBe(9 * 3600);
  });

  it("位移和台北相同的國家（菲律賓）不換算", () => {
    openCountries("PH", "local");
    expect(rightClock.getTime()).toBe(T_WINTER);
  });

  it("跨多時區的國家（加拿大）用 UTC 鐘點，和時間軸小字同一個規則", () => {
    openCountries("CA", "local");
    // 台北 08:00 → UTC 08:00
    expect(rightClock.getTime()).toBe(utc("2026-01-15T08:00:00Z"));
  });

  it("時間軸暫停時切模式：訂閱者照樣收到新時間（raw／節流／日期）", () => {
    openCountries("GB", "instant");
    const raw: number[] = [];
    const throttled: number[] = [];
    const offRaw = rightClock.subscribe((t) => raw.push(t));
    const offThr = rightClock.subscribeThrottled(1000, (t) => throttled.push(t));
    compareStore.setTimeAlign("local");
    expect(raw).toEqual([T_WINTER + 8 * 3600]);
    expect(throttled).toEqual([T_WINTER + 8 * 3600]);
    // 右圖平移（rightCamera）不改對齊，不通知
    compareStore.setRightCamera({ center: [0, 51], zoom: 6, pitch: 0, bearing: 0 });
    expect(raw).toHaveLength(1);
    compareStore.setTimeAlign("instant");
    expect(raw).toEqual([T_WINTER + 8 * 3600, T_WINTER]);
    offRaw();
    offThr();
  });

  it("時間軸前進時 raw 訂閱拿到換算後的時間", () => {
    openCountries("JP", "local");
    const raw: number[] = [];
    const off = rightClock.subscribe((t) => raw.push(t));
    timeStore.setTime(T_WINTER + 60);
    expect(raw).toEqual([T_WINTER + 60 - 3600]);
    off();
  });

  it("日期訂閱：右側跨日的時刻自己判斷（台北 20:00 → 倫敦 20:00＝台北隔天 04:00）", () => {
    openCountries("GB", "instant");
    timeStore.setTime(utc("2026-01-15T12:00:00Z")); // 台北 1/15 20:00
    const dates: string[] = [];
    const off = rightClock.subscribeDate((k) => dates.push(k));
    compareStore.setTimeAlign("local");
    expect(rightClock.getDateKey()).toBe("2026-01-16");
    expect(dates).toEqual(["2026-01-16"]);
    off();
  });

  it("視窗日期跟著平移", () => {
    expect(shiftWindowDateKeys(["2026-01-15"], (t) => t + 8 * 3600)).toEqual(["2026-01-15", "2026-01-16"]);
    expect(shiftWindowDateKeys(["2026-01-15", "2026-01-16"], (t) => t - 3600)).toEqual(["2026-01-14", "2026-01-15", "2026-01-16"]);
    expect(shiftWindowDateKeys([], (t) => t)).toEqual([]);
  });

  it("rightTimeOf 不在當地同時刻時原樣回傳", () => {
    expect(rightTimeOf(T_WINTER)).toBe(T_WINTER);
  });
});
