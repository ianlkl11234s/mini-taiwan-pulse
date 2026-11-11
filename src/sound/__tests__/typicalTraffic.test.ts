import { describe, expect, it } from "vitest";
import type { FreewaySection } from "../../data/freewayLoader";
import { queryReceiver } from "../engines/receiverQuery";
import { freewaySectionsToRecords } from "../sourceAdapters/roadTrafficAdapter";
import {
  loadTypicalTraffic, typicalDayVerdict, vdBaselineToRecords, VD_NOT_APPLICABLE_ID, type VdBaselineEntry, type VdBaselineFile,
} from "../sourceAdapters/typicalTrafficAdapter";
import type { SoundSourceSet } from "../types";
import { RECV, latNorth } from "./fixtures";

// 去識別手寫 VD（非真實編號）
const WEEKDAY = "2026-11-09"; // 週一
const SUNDAY = "2026-11-08";
const HOLIDAY = "2026-01-01"; // 週四，開國紀念日
const ANOMALY = "2026-10-24"; // soundProfiles anomalyDays（颱風）
const start = (d: string) => Date.parse(`${d}T00:00:00+08:00`) / 1000;

const flow = (v: number | null): (number | null)[] => Array.from({ length: 24 }, (_, h) => (h === 3 ? null : h === 4 ? 0 : v));
const VD: VdBaselineEntry = {
  id: "VTEST01", road: "測試路", lon: RECV.longitude, lat: latNorth(100),
  wd_flow: flow(600), wd_flow_days: Array.from({ length: 24 }, (_, h) => (h === 5 ? 2 : 8)), wd_speed: Array(24).fill(40),
};
const FILE: VdBaselineFile = { meta: {}, vds: [VD, { ...VD, id: "VNOCOORD", lon: Number.NaN, lat: Number.NaN }] };

async function setFor(date: string, file: VdBaselineFile = FILE): Promise<SoundSourceSet<unknown, "road_traffic">> {
  return (await loadTypicalTraffic({ date }, async () => file)) as SoundSourceSet<unknown, "road_traffic">;
}
const at = (date: string, hour: number) => start(date) + hour * 3600 + 600;

describe("typicalTrafficAdapter（臺北市 VD 平日典型值）", () => {
  it("平日：有典型值 → active、evidence=estimated、proxyKind=typical_weekday_volume，註記樣本天數", async () => {
    const r = queryReceiver(RECV, at(WEEKDAY, 8), [await setFor(WEEKDAY)], ["road_traffic"]);
    const c = r.contributions[0]!;
    expect(r.families[0]!.status).toBe("active");
    expect(c.evidence).toBe("estimated");
    expect(c.proxyKind).toBe("typical_weekday_volume");
    expect(c.notes).toContain("flow_days:8");
    expect(c.notes).toContain("typical_value_not_same_day_observation");
    // 100 m（距離項 0.5）× (1 − e^(−600/600))；換算尺度 600 輛／小時（使用者 2026-11-11 決定）
    expect(c.relativePotential!).toBeCloseTo(0.5 * (1 - Math.exp(-1)), 2);
  });

  it("週末、國定假日 → unknown「無可靠典型值」，不當 0", async () => {
    for (const [d, reason] of [[SUNDAY, "weekend"], [HOLIDAY, "national_holiday"]] as const) {
      expect(typicalDayVerdict(d)).toEqual({ applies: false, reason });
      const r = queryReceiver(RECV, at(d, 8), [await setFor(d)], ["road_traffic"]);
      expect(r.families[0]!.status).toBe("unknown");
      expect(r.families[0]!.relativePotential).toBeNull();
      expect(r.contributions[0]!.sourceId).toBe(VD_NOT_APPLICABLE_ID);
      expect(r.contributions[0]!.unknownReason).toBe(`typical_not_applicable(${reason})`);
    }
  });

  it("異常日（soundProfiles anomalyDays，例：颱風）→ unknown，原因是異常日", async () => {
    expect(typicalDayVerdict(ANOMALY)).toEqual({ applies: false, reason: "anomaly_day" });
    const r = queryReceiver(RECV, at(ANOMALY, 14), [await setFor(ANOMALY)], ["road_traffic"]);
    expect(r.families[0]!.status).toBe("unknown");
    expect(r.contributions[0]!.unknownReason).toBe("typical_not_applicable(anomaly_day)");
  });

  it("放假日表範圍外 → unknown（不猜是否平日）", () => {
    expect(typicalDayVerdict("2027-03-03")).toEqual({ applies: false, reason: "calendar_not_covered" });
  });

  it("無座標 VD 剔除，不合成座標", () => {
    const recs = vdBaselineToRecords(FILE, WEEKDAY);
    expect(recs.map((r) => r.payload.vdId)).toEqual(["VTEST01"]);
  });

  it("流量 null → unknown（不變 0）；樣本天數不足 → unknown；典型流量 0 → 無貢獻（有效的 0）", async () => {
    const set = await setFor(WEEKDAY);
    const nullHour = queryReceiver(RECV, at(WEEKDAY, 3), [set], ["road_traffic"]);
    expect(nullHour.families[0]!.status).toBe("unknown");
    expect(nullHour.contributions[0]!.unknownReason).toBe("typical_flow_null");
    expect(nullHour.contributions[0]!.relativePotential).toBeNull();
    const thin = queryReceiver(RECV, at(WEEKDAY, 5), [set], ["road_traffic"]);
    expect(thin.contributions[0]!.unknownReason).toBe("typical_sample_insufficient");
    const zero = queryReceiver(RECV, at(WEEKDAY, 4), [set], ["road_traffic"]);
    expect(zero.contributions).toHaveLength(0);
    expect(zero.families[0]!.status).toBe("inactive");
  });

  it("VD 半徑內取代國道類型 proxy；半徑外維持國道 proxy", async () => {
    const section: FreewaySection = {
      section_id: "F1", section_name: "測試國道段", road_name: "國道1號", direction_label: "北向",
      coords: [[121.49, latNorth(50)], [121.51, latNorth(50)]], timeline: [],
    };
    const vd = await setFor(WEEKDAY);
    const merged: SoundSourceSet<unknown, "road_traffic"> = { ...vd, records: [...vd.records, ...freewaySectionsToRecords([section], WEEKDAY)] as never };
    const near = queryReceiver(RECV, at(WEEKDAY, 8), [merged], ["road_traffic"]);
    expect(near.contributions.every((c) => c.proxyKind === "typical_weekday_volume")).toBe(true);
    const farFile: VdBaselineFile = { meta: {}, vds: [{ ...VD, lat: latNorth(5_000) }] };
    const vdFar = await setFor(WEEKDAY, farFile);
    const merged2: SoundSourceSet<unknown, "road_traffic"> = { ...vdFar, records: [...vdFar.records, ...freewaySectionsToRecords([section], WEEKDAY)] as never };
    const far = queryReceiver(RECV, at(WEEKDAY, 8), [merged2], ["road_traffic"]);
    expect(far.contributions[0]!.proxyKind).toBe("road_type_no_volume");
  });
});
