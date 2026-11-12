import { describe, expect, it } from "vitest";
import { typicalDayVerdict, typicalFlowAt } from "../sourceAdapters/typicalTrafficAdapter";

// W6-2 起臺北 VD 典型值不再是點聲源：沿路延伸後的接收點／網格行為（含週末、假日、異常日無法判斷、
// 典型流量 0＝有效的 0）在 roadGrid.test.ts 驗；這裡只驗平日判定與逐小時取值兩支純函式。
const WEEKDAY = "2026-11-09"; // 週一
const SUNDAY = "2026-11-08";
const HOLIDAY = "2026-01-01"; // 週四，開國紀念日
const ANOMALY = "2026-10-24"; // soundProfiles anomalyDays（颱風）
const at = (d: string, hour: number) => Date.parse(`${d}T00:00:00+08:00`) / 1000 + hour * 3600 + 600;

describe("typicalTrafficAdapter（臺北市 VD 平日典型值）", () => {
  it("平日 → 可套用；週末、國定假日、異常日、放假日表範圍外 → 不套用（各有原因）", () => {
    expect(typicalDayVerdict(WEEKDAY)).toEqual({ applies: true });
    expect(typicalDayVerdict(SUNDAY)).toEqual({ applies: false, reason: "weekend" });
    expect(typicalDayVerdict(HOLIDAY)).toEqual({ applies: false, reason: "national_holiday" });
    expect(typicalDayVerdict(ANOMALY)).toEqual({ applies: false, reason: "anomaly_day" });
    expect(typicalDayVerdict("2027-03-03")).toEqual({ applies: false, reason: "calendar_not_covered" });
  });

  it("逐小時取值：流量 null → flow_null（不變 0）；樣本天數不足 → sample_insufficient；0 是有效值", () => {
    const flow = Array.from({ length: 24 }, (_, h) => (h === 3 ? null : h === 4 ? 0 : 600));
    const flowDays = Array.from({ length: 24 }, (_, h) => (h === 5 ? 2 : 8));
    const p = { flow, flowDays };
    expect(typicalFlowAt(p, at(WEEKDAY, 8))).toEqual({ vehPerHour: 600, days: 8 });
    expect(typicalFlowAt(p, at(WEEKDAY, 3))).toEqual({ missing: "flow_null" });
    expect(typicalFlowAt(p, at(WEEKDAY, 5))).toEqual({ missing: "sample_insufficient" });
    expect(typicalFlowAt(p, at(WEEKDAY, 4))).toEqual({ vehPerHour: 0, days: 8 });
  });
});
