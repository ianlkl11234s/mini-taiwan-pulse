import { describe, expect, it } from "vitest";
import type { WasteScheduleRoute } from "../../data/wasteScheduleLoader";
import { loadWaste, shiftTaipeiDateKey, taipeiDow, wasteRecordsForDate } from "../sourceAdapters/wasteAdapter";
import { queryFamilyInterval } from "../engines/receiverQuery";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

function route(city: string, stops: [number, number][], scheduleInferred = false, id = "R1"): WasteScheduleRoute {
  return {
    city,
    routeId: id,
    routeName: `路線${id}`,
    vehicleType: "garbage",
    scheduleInferred,
    stops: stops.map(([arr, dep], i) => ({
      stopId: 100 + i,
      stopSeq: i + 1,
      stopName: `停點${i + 1}`,
      lng: RECV.longitude,
      lat: latNorth(50 + i * 1000),
      arrivalSec: arr,
      departureSec: dep,
    })),
  };
}

function setOf(today: WasteScheduleRoute[], prev: WasteScheduleRoute[] = []): SoundSourceSet {
  return {
    family: "waste_collection",
    dateKey: DATE,
    records: wasteRecordsForDate(DATE, today, prev),
    coverage: [{ family: "waste_collection", provider: "waste_schedule_static", dateKey: DATE, status: "ok", windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "static_schedule" }],
  };
}

const at = (sec: number) => DAY_START + sec;

describe("wasteAdapter", () => {
  it("dow 依臺北日期計算，與執行環境時區無關", () => {
    expect(taipeiDow("2026-07-14")).toBe(2);
    expect(taipeiDow("2026-07-19")).toBe(0);
    expect(shiftTaipeiDateKey("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("load 讀當日與前一日的 dow", async () => {
    const dows: number[] = [];
    await loadWaste({ date: DATE, cities: ["新北市"] }, async (_c, dow) => {
      dows.push(dow);
      return [];
    });
    expect(dows.sort()).toEqual([1, 2]);
  });

  it("T01：前一日 24:11 的停點出現在今日 00:11，不重複也不漏", () => {
    const prev = [route("新北市", [[24 * 3600 + 11 * 60, 24 * 3600 + 13 * 60]], false, "MON")];
    const today = [route("新北市", [[24 * 3600 + 11 * 60, 24 * 3600 + 13 * 60]], false, "TUE")];
    const set = setOf(today, prev);
    const r = queryFamilyInterval("waste_collection", [set], RECV, at(11 * 60 + 30), at(11 * 60 + 30));
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0]!.notes).toContain("service_date:2026-07-13");
    expect(r.status).toBe("active");
    // 今日表定的 24:11 屬於明天 00:11，今日 23:59 不該出現
    expect(queryFamilyInterval("waste_collection", [set], RECV, at(86_340), at(86_340)).status).toBe("inactive");
    // 前一日早上的停點不跨進今天 → 被排除
    const prevMorning = setOf([], [route("新北市", [[8 * 3600, 8 * 3600 + 60]])]);
    expect(prevMorning.records).toHaveLength(0);
  });

  it("T02：星期欄位缺（臺北市）→ unknown，不顯示成確定收運", () => {
    const set = setOf([route("臺北市", [[20 * 3600, 20 * 3600 + 120]])]);
    const r = queryFamilyInterval("waste_collection", [set], RECV, at(20 * 3600 + 60), at(20 * 3600 + 60));
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.reason).toBe("calendar_weekday_unknown");
    const c = r.contributions[0]!;
    expect(c.evidence).toBe("inferred");
    expect(c.notes).toContain("calendar_confidence:weekday_unknown");
  });

  it("有星期欄位且真實時刻 → scheduled；推算時刻 → inferred", () => {
    const real = setOf([route("新北市", [[20 * 3600, 20 * 3600 + 120]])]);
    const c = queryFamilyInterval("waste_collection", [real], RECV, at(20 * 3600 + 60), at(20 * 3600 + 60)).contributions[0]!;
    expect(c.evidence).toBe("scheduled");
    expect(c.relativePotential).toBeGreaterThan(0);
    const inferred = setOf([route("新北市", [[20 * 3600, 20 * 3600 + 120]], true)]);
    const c2 = queryFamilyInterval("waste_collection", [inferred], RECV, at(20 * 3600 + 60), at(20 * 3600 + 60)).contributions[0]!;
    expect(c2.evidence).toBe("inferred");
    expect(c2.temporalPrecision).toBe("schedule_inferred_times");
  });

  it("星期欄位未查證的城市：顯示候選但 evidence=inferred，不標 scheduled", () => {
    const set = setOf([route("臺中市", [[20 * 3600, 20 * 3600 + 120]])]);
    const r = queryFamilyInterval("waste_collection", [set], RECV, at(20 * 3600 + 60), at(20 * 3600 + 60));
    expect(r.status).toBe("active");
    expect(r.contributions[0]!.evidence).toBe("inferred");
    expect(r.contributions[0]!.notes).toContain("calendar_confidence:weekday_unverified");
  });

  it("多日 sets 一起傳入時，跨午夜停點不重複計", () => {
    const stop: [number, number] = [24 * 3600 + 11 * 60, 24 * 3600 + 13 * 60];
    const mon = { ...setOf([route("新北市", [stop], false, "MON")]), dateKey: "2026-07-13" };
    mon.records = wasteRecordsForDate("2026-07-13", [route("新北市", [stop], false, "MON")], []);
    const tue = setOf([], [route("新北市", [stop], false, "MON")]);
    const r = queryFamilyInterval("waste_collection", [mon, tue], RECV, at(11 * 60 + 30), at(11 * 60 + 30));
    expect(r.contributions).toHaveLength(1);
  });

  it("只在停點位置發聲：兩停點之間的路段不產生來源", () => {
    // 停點 1 在 50 m、停點 2 在 1,050 m（> 半徑 500 m）；接收者在兩者之間時間不在停點 1 的窗
    const set = setOf([route("新北市", [[10 * 3600, 10 * 3600 + 60], [10 * 3600 + 600, 10 * 3600 + 660]])]);
    expect(queryFamilyInterval("waste_collection", [set], RECV, at(10 * 3600 + 400), at(10 * 3600 + 400)).status).toBe("inactive");
  });
});
