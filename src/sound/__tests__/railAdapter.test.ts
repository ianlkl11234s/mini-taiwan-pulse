import { describe, expect, it } from "vitest";
import { RailEngine } from "../../engines/RailEngine";
import type { RailSchedule, RailSystem } from "../../types";
import { dayProfile, queryReceiver } from "../engines/receiverQuery";
import type { RailStructure, SegmentStructure } from "../model/railSegments";
import {
  departuresToRecords,
  evaluateRail,
  loadRail,
  prepareTrack,
  queryRailInterval,
  type RailDepartureInput,
  type RailFetchers,
  type RailTrackInput,
} from "../sourceAdapters/railAdapter";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

// 東西向直線軌道，位於接收者北方 200 m；A(0)─B(0.375)─C(0.625)─D(1)，接收者最近點在 B–C 之間
const Y = latNorth(200);
const TRACK: RailTrackInput = {
  system: "trtc",
  trackId: "T-1-0",
  coords: [
    [121.48, Y],
    [121.52, Y],
  ],
  stationProgress: { A: 0, B: 0.375, C: 0.625, D: 1 },
};

const lookupWith =
  (s: Partial<Record<string, RailStructure>>) =>
  (_sys: string, a: string, b: string): SegmentStructure => ({
    structure: s[[a, b].sort().join("")] ?? "unknown",
    reason: "test",
    shares: null,
  });
const ALL_ELEVATED = lookupWith({ AB: "elevated", BC: "elevated", CD: "elevated" });

/** 06:00 從 A 出發，每站間 120 秒、停 20 秒 */
const DEP: RailDepartureInput = {
  trainId: "T-001",
  trackId: "T-1-0",
  departureTime: "06:00:00",
  totalTravelTime: 380,
  stations: [
    { station_id: "A", arrival: 0, departure: 20 },
    { station_id: "B", arrival: 140, departure: 160 },
    { station_id: "C", arrival: 280, departure: 300 },
    { station_id: "D", arrival: 380, departure: 380 },
  ],
};
const T0600 = DAY_START + 6 * 3600;

function recordsFor(lookup: ReturnType<typeof lookupWith>, deps: RailDepartureInput[] = [DEP], opDay = DATE) {
  const track = prepareTrack(TRACK, lookup);
  return departuresToRecords("trtc", opDay, deps, new Map([[track.trackId, track]]), "local_template").records;
}

function setOf(records: ReturnType<typeof recordsFor>): SoundSourceSet<unknown, "rail"> {
  return {
    family: "rail",
    dateKey: DATE,
    records: records as never,
    coverage: [{ family: "rail", provider: `rail_trtc@${DATE}`, dateKey: DATE, status: "ok", windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "static_schedule" }],
  };
}

describe("railAdapter", () => {
  it("同營運日同車次編號出現兩次 → record id 仍唯一（UI 以 id 建索引）", () => {
    const ids = recordsFor(ALL_ELEVATED, [DEP, { ...DEP, departureTime: "07:00:00" }]).map((r) => r.id);
    expect(ids).toEqual([`rail:trtc:${DATE}:T-001`, `rail:trtc:${DATE}:T-001@T-1-0`]);
  });

  it("列車位置與既有 RailEngine.update 一致（重用同規則）", () => {
    const [rec] = recordsFor(ALL_ELEVATED);
    const sched = { track_id: "T-1-0", route_id: "T-1", name: "t", train_color: "#fff", stations: ["A", "B", "C", "D"], departures: [{ departure_time: DEP.departureTime, train_id: DEP.trainId, total_travel_time: DEP.totalTravelTime, stations: DEP.stations }] } as unknown as RailSchedule;
    const sys: RailSystem = {
      id: "trtc",
      tracks: new Map([["T-1-0", { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: TRACK.coords } }]]),
      schedules: new Map([["T-1-0", sched]]),
      stationProgress: { "T-1-0": TRACK.stationProgress },
    };
    const engine = new RailEngine([sys]);
    for (const dt of [30, 90, 150, 200, 290, 350]) {
      const t = T0600 + dt;
      const ev = evaluateRail(rec!, t);
      const train = engine.update(t)[0]!;
      expect(ev.status).toBe("active");
      if (ev.status !== "active") continue;
      expect(ev.geometry.lon).toBeCloseTo(train.position[0], 9);
      expect(ev.geometry.lat).toBeCloseTo(train.position[1], 9);
    }
  });

  it("地下段不發聲：全線地下 → 家族 inactive（0），不產生貢獻", () => {
    const recs = recordsFor(lookupWith({ AB: "underground", BC: "underground", CD: "underground" }));
    const r = queryReceiver(RECV, T0600 + 210, [setOf(recs)], ["rail"]);
    expect(r.families[0]!.status).toBe("inactive");
    expect(r.contributions).toHaveLength(0);
    expect(r.families[0]!.notes.join()).toContain("rail_underground_segments_excluded");
  });

  it("地下段不發聲：B–C 地下時，潛勢只來自地上段（較遠），不是正上方 200 m", () => {
    const elevated = queryRailInterval(recordsFor(ALL_ELEVATED), RECV, T0600, T0600 + 600).contributions[0]!;
    const partial = queryRailInterval(recordsFor(lookupWith({ AB: "elevated", BC: "underground", CD: "elevated" })), RECV, T0600, T0600 + 600).contributions[0]!;
    expect(elevated.spatialDistanceM!).toBeCloseTo(200, -1);
    expect(partial.status).toBe("active");
    expect(partial.spatialDistanceM!).toBeGreaterThan(500);
    expect(partial.relativePotential!).toBeLessThan(elevated.relativePotential!);
    expect(partial.evidence).toBe("scheduled");
    expect(partial.modeledDbA).toBeNull();
  });

  it("unknown 段不當 0、也不當地面：status unknown、潛勢 null", () => {
    const recs = recordsFor(lookupWith({ AB: "underground", CD: "underground" })); // B–C 不在表 → unknown
    const r = queryReceiver(RECV, T0600 + 210, [setOf(recs)], ["rail"]);
    expect(r.families[0]!.status).toBe("unknown");
    expect(r.families[0]!.relativePotential).toBeNull();
    expect(r.families[0]!.reason).toBe("rail_structure_unknown");
    expect(r.contributions[0]!.railStructure).toBe("unknown");
  });

  it("站不在軌道 progress 表 → unknown（不用索引比例猜）", () => {
    const bad: RailDepartureInput = { ...DEP, stations: [{ station_id: "A", arrival: 0, departure: 20 }, { station_id: "Z", arrival: 140, departure: 160 }] };
    const r = queryRailInterval(recordsFor(ALL_ELEVATED, [bad]), RECV, T0600 + 60, T0600 + 60);
    expect(r.contributions[0]!.status).toBe("unknown");
    expect(r.contributions[0]!.relativePotential).toBeNull();
  });

  it("高速通過不漏：10 分鐘格內 30 秒穿過 4 km，格仍為 active 且取到最近距離", () => {
    const fast: RailDepartureInput = { ...DEP, totalTravelTime: 48, stations: [{ station_id: "A", arrival: 0, departure: 0 }, { station_id: "D", arrival: 48, departure: 48 }] };
    const set = setOf(recordsFor(ALL_ELEVATED, [fast]));
    const prof = dayProfile(RECV, DATE, 10, [set], ["rail"]);
    const bin = prof.binStarts.findIndex((b) => b === T0600);
    expect(prof.families[0]!.statuses[bin]).toBe("active");
    expect(prof.families[0]!.values[bin]!).toBeGreaterThan(0.5); // 最近 200 m（half=250 m → 0.61）
    expect(prof.families[0]!.statuses[bin + 1]).toBe("inactive");
  });

  it("跨日班表：D 日 00:30 屬於 D−1 營運日；D 營運日的 00:30 班是 D+1，不算進 D", async () => {
    const night: RailDepartureInput = { ...DEP, trainId: "N-1", departureTime: "00:30:00" };
    const late: RailDepartureInput = { ...DEP, trainId: "L-1", departureTime: "23:58:00" };
    const prevDay = "2026-07-13";
    const fetchers: RailFetchers = {
      network: async () => [TRACK],
      schedule: async (_s, opDay) => ({ departures: opDay === prevDay ? [night] : [night, late], basis: "local_template" }),
    };
    const set = await loadRail({ date: DATE, systems: ["trtc"], structureLookup: ALL_ELEVATED }, fetchers);
    const ids = set.records.map((r) => r.id);
    expect(ids).toContain(`rail:trtc:${prevDay}:N-1`); // D 00:30
    expect(ids).not.toContain(`rail:trtc:${DATE}:N-1`); // D+1 00:30
    expect(ids).toContain(`rail:trtc:${DATE}:L-1`); // D 23:58 跨到 D+1 仍屬 D
    const at = DAY_START + 30 * 60 + 210;
    const r = queryReceiver(RECV, at, [set], ["rail"]);
    expect(r.families[0]!.status).toBe("active");
    expect(r.contributions[0]!.notes).toContain(`op_day:${prevDay}`);
  });

  it("05:50 前發車、之後還在跑的 D−1 營運日列車不會在 05:50 後消失", async () => {
    const early: RailDepartureInput = { ...DEP, trainId: "E-1", departureTime: "05:30:00", totalTravelTime: 3600, stations: [{ station_id: "A", arrival: 0, departure: 0 }, { station_id: "D", arrival: 3600, departure: 3600 }] };
    const prevDay = "2026-07-13";
    const fetchers: RailFetchers = {
      network: async () => [TRACK],
      schedule: async (_s, opDay) => ({ departures: opDay === prevDay ? [early] : [], basis: "local_template" }),
    };
    const set = await loadRail({ date: DATE, systems: ["trtc"], structureLookup: ALL_ELEVATED }, fetchers);
    // 延長日制：D−1 營運日 05:30 ＝ D 05:30，行駛到 06:30；06:10 約在 2/3 處（距接收者約 1.3 km 內）
    const r = queryReceiver(RECV, DAY_START + 6 * 3600 + 600, [set], ["rail"]);
    expect(r.families[0]!.status).toBe("active");
    expect(r.contributions[0]!.notes).toContain(`op_day:${prevDay}`);
  });

  it("台鐵（日曆日制）：班表 D 的 04:57 班就是 D 日 04:57，不延到 D+1", async () => {
    const dawn: RailDepartureInput = { ...DEP, trainId: "TRA-1", departureTime: "04:57:00" };
    const fetchers: RailFetchers = {
      network: async () => [{ ...TRACK, system: "tra" }],
      schedule: async (_s, opDay) => ({ departures: opDay === DATE ? [dawn] : [], basis: "local_template" }),
    };
    const set = await loadRail({ date: DATE, systems: ["tra"], structureLookup: ALL_ELEVATED }, fetchers);
    expect(set.records.map((x) => x.id)).toContain(`rail:tra:${DATE}:TRA-1`);
    const r = queryReceiver(RECV, DAY_START + 4 * 3600 + 57 * 60 + 210, [set], ["rail"]);
    expect(r.families[0]!.status).toBe("active");
  });

  it("D−1 營運日班表取不到 → D 凌晨軌道附近 unknown（不拿今天班表回填）；白天照常", async () => {
    const fetchers: RailFetchers = {
      network: async () => [TRACK],
      schedule: async (_s, opDay) => (opDay === DATE ? { departures: [DEP], basis: "local_template" } : { departures: null, basis: "date_specific", reason: "no_schedule_for_op_day" }),
    };
    const set = await loadRail({ date: DATE, systems: ["trtc"], structureLookup: ALL_ELEVATED }, fetchers);
    const early = queryReceiver(RECV, DAY_START + 3600, [set], ["rail"]);
    expect(early.families[0]!.status).toBe("unknown");
    expect(early.families[0]!.relativePotential).toBeNull();
    expect(early.families[0]!.reason).toBe("rail_schedule_unavailable");
    const noon = queryReceiver(RECV, DAY_START + 12 * 3600, [set], ["rail"]);
    expect(noon.families[0]!.status).toBe("inactive");
    expect(set.coverage.find((c) => c.provider === "rail_trtc@2026-07-13")!.status).toBe("unavailable");
  });
});
