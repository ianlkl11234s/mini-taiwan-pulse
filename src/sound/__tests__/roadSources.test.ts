import { describe, expect, it } from "vitest";
import type { RoadEvent } from "../../data/roadEventsLoader";
import { queryReceiver } from "../engines/receiverQuery";
import { roadworkSnapshotSet, coveredCitiesFromPerCity, parseMvpBSceneBlocks } from "../mvpBSources";
import { roadEventsToRecords, ROADWORK_PROVIDER } from "../sourceAdapters/roadworkAdapter";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV } from "./fixtures";

// 臺北市內的接收點（RECV 121.5,25.0 也在臺北市與新北市外框內）
const NOON = DAY_START + 12 * 3600;

function okSet<F extends "road_traffic" | "roadwork">(family: F, provider: string, records: unknown[]): SoundSourceSet<unknown, F> {
  return {
    family,
    dateKey: DATE,
    records: records as never,
    coverage: [{ family, provider, dateKey: DATE, status: "ok", windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "day_series" }],
  };
}

// 道路車流（T01）測試 W6-2 起移到 roadGrid.test.ts（路網＋國道 VD 每日包；舊的國道類型 proxy 與 RPC 路徑已移除）。

const PERMIT: RoadEvent = {
  event_id: "E1",
  source: "event_city",
  event_type: 2,
  severity: null,
  road_name: null,
  direction: null,
  start_km: null,
  end_km: null,
  title: "管線工程",
  description: null,
  location_other: null,
  blocked_lanes: null,
  geometry: {
    type: "Polygon",
    coordinates: [[[121.4995, 24.9995], [121.5005, 24.9995], [121.5005, 25.0005], [121.4995, 25.0005], [121.4995, 24.9995]]],
  },
  matched_section_id: null,
  enrich_status: null,
  start_ts: DAY_START + 9 * 3600,
  end_ts: DAY_START + 17 * 3600,
  last_updated_ts: DAY_START,
};
const COVERED = ["臺北市", "新北市"];

describe("roadworkAdapter（C01）", () => {
  it("許可期間內 → possible activity：active、evidence=scheduled、註明許可≠機具運轉", () => {
    const { records } = roadEventsToRecords([PERMIT], DATE, COVERED);
    const r = queryReceiver(RECV, NOON, [okSet("roadwork", ROADWORK_PROVIDER, records)], ["roadwork"]);
    const c = r.contributions[0]!;
    expect(r.families[0]!.status).toBe("active");
    expect(c.spatialDistanceM).toBe(0); // 在施工範圍內
    expect(c.evidence).toBe("scheduled");
    expect(c.proxyKind).toBe("permit_window_possible_activity");
    expect(c.notes).toContain("permit_is_not_machinery_operation");
    expect(c.relativePotential!).toBeLessThan(1); // 乘 possibleActivityWeight
  });

  it("施工許可時段外 → inactive（涵蓋縣市內 0）", () => {
    const { records } = roadEventsToRecords([PERMIT], DATE, COVERED);
    const r = queryReceiver(RECV, DAY_START + 20 * 3600, [okSet("roadwork", ROADWORK_PROVIDER, records)], ["roadwork"]);
    expect(r.families[0]!.status).toBe("inactive");
    expect(r.families[0]!.relativePotential).toBe(0);
  });

  it("EventType 7（挖掘管制區）與缺生效時間的事件不當施工", () => {
    const { records, skipped } = roadEventsToRecords([{ ...PERMIT, event_id: "E7", event_type: 7 }, { ...PERMIT, event_id: "E0", start_ts: 0 }], DATE, COVERED);
    expect(records.filter((r) => r.payload.kind === "permit")).toHaveLength(0);
    expect(skipped).toMatchObject({ notRoadwork: 1, noStart: 1 });
  });

  it("接收者所在縣市沒有施工資料 → unknown，不是 0", () => {
    const { records } = roadEventsToRecords([], DATE, ["臺中市"]);
    const r = queryReceiver(RECV, NOON, [okSet("roadwork", ROADWORK_PROVIDER, records)], ["roadwork"]);
    expect(r.families[0]!.status).toBe("unknown");
    expect(r.families[0]!.reason).toBe("roadwork_city_not_covered");
    expect(r.families[0]!.relativePotential).toBeNull();
  });

  it("快照區塊：coverage 取 health；per_city=0 的縣市不算涵蓋；形狀不對的區塊丟掉", () => {
    expect(coveredCitiesFromPerCity({ Taipei: 41, NewTaipei: 523, Kaohsiung: 0 })).toEqual(["新北市", "臺北市"]);
    // 涵蓋看施工筆數（per_city_roadwork），不看含挖掘管制區的 per_city
    const taipeiOnlyType7 = roadworkSnapshotSet({ health: "ok", per_city: { Taipei: 41, NewTaipei: 5 }, per_city_roadwork: { Taipei: 0, NewTaipei: 5 }, events: [] }, DATE);
    expect(queryReceiver(RECV, NOON, [taipeiOnlyType7], ["roadwork"]).families[0]!.reason).toBe("roadwork_city_not_covered");
    // 外框重疊處（臺北外框蓋到新北）有實際施工許可時：active 勝過 unknown（下限），未涵蓋仍留一筆 unknown 貢獻
    const overlap = roadworkSnapshotSet({ health: "ok", per_city_roadwork: { Taipei: 0, NewTaipei: 5 }, events: [PERMIT] }, DATE);
    const ov = queryReceiver(RECV, NOON, [overlap], ["roadwork"]);
    expect(ov.families[0]!.status).toBe("active");
    expect(ov.contributions.some((c) => c.status === "unknown" && c.unknownReason === "roadwork_city_not_covered")).toBe(true);
    expect(queryReceiver(RECV, DAY_START + 20 * 3600, [overlap], ["roadwork"]).families[0]!.status).toBe("unknown"); // 許可外不能說「沒施工」
    const block = parseMvpBSceneBlocks({ roadwork: { health: "ok", per_city: { Taipei: 3, NewTaipei: 5 }, per_city_roadwork: { Taipei: 3, NewTaipei: 5 }, events: [] } }).roadwork!;
    const set = roadworkSnapshotSet(block, DATE);
    expect(set.coverage[0]!.status).toBe("ok");
    const r = queryReceiver(RECV, NOON, [set], ["roadwork"]);
    expect(r.families[0]!.status).toBe("inactive"); // bbox 內 0 筆＋health ok＝真的沒有
    expect(parseMvpBSceneBlocks({ roadwork: { health: "weird", events: [] } }).roadwork).toBeUndefined();
    // 快照只裁切接收點 ±5 km：接收點移出區塊 bbox → unknown，不是「沒有施工」
    const clipped = roadworkSnapshotSet({ ...block, bbox: [121.6, 25.05, 121.7, 25.15] }, DATE);
    const out = queryReceiver(RECV, NOON, [clipped], ["roadwork"]);
    expect(out.families[0]!.status).toBe("unknown");
    expect(out.families[0]!.reason).toBe("outside_snapshot_bbox");
    const empty = roadworkSnapshotSet({ ...block, health: "empty" }, DATE);
    expect(queryReceiver(RECV, NOON, [empty], ["roadwork"]).families[0]!.status).toBe("unknown");
  });
});
