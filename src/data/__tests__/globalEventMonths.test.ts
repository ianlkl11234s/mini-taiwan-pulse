import { describe, expect, it } from "vitest";
import { globalEventMonthFile, parseGlobalEventMonth } from "../globalEventMonths";

const file = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  format: "global-events-month-v1", month: "2026-10", timezone: "Asia/Taipei", partial: false, candidates: 5, noise_excluded: 2, no_location: 1,
  cols: ["id", "t", "cat", "sev", "title", "pts"], rows, ...extra,
});

describe("全球重大事件每月期別檔", () => {
  it("檔名依月份、放在 static-rpc", () => {
    expect(globalEventMonthFile("2026-10")).toBe("/static-rpc/get_global_event_month_202610.json");
  });

  it("每列一個候選、地點陣列攤成物件，地點種類用全名", () => {
    const month = parseGlobalEventMonth(file([["afb6ff66259d", 1793462400, "other", 2, "烏克蘭居民撤離", [[32.31, 46.5, "c"], [32, 49, "n"]]]]));
    expect(month).toMatchObject({ month: "2026-10", partial: false, candidates: 5, noiseExcluded: 2, noLocation: 1 });
    expect(month.events).toEqual([{ id: "afb6ff66259d", t: 1793462400, category: "other", severity: 2, title: "烏克蘭居民撤離",
      places: [{ lng: 32.31, lat: 46.5, kind: "city_center" }, { lng: 32, lat: 49, kind: "country_center" }] }]);
  });

  it("座標缺漏或超出範圍的地點不補 0、沒有地點的列略過，缺的嚴重度保持 null", () => {
    const month = parseGlobalEventMonth(file([
      ["a", 1, "conflict", null, "x", [[null, null, "c"], [200, 10, "c"], [10, 20, "e"]]],
      ["b", 2, "conflict", 3, "y", []],
      ["c", 3, "conflict", 3, "z", [["", "", "c"]]],
    ]));
    expect(month.events.map((event) => event.id)).toEqual(["a"]);
    expect(month.events[0]).toMatchObject({ severity: null, places: [{ lng: 10, lat: 20, kind: "event_point" }] });
  });

  it("格式或欄位不符時明確報錯", () => {
    expect(() => parseGlobalEventMonth({ ...file([]), format: "v0" })).toThrow(/unknown format/);
    expect(() => parseGlobalEventMonth({ ...file([]), cols: ["id", "t"] })).toThrow(/missing columns/);
  });
});
