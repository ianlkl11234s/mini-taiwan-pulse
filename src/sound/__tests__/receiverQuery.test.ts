import { describe, expect, it } from "vitest";
import { dayProfile, queryReceiver } from "../engines/receiverQuery";
import { wasteRecordsForDate } from "../sourceAdapters/wasteAdapter";
import { dedupeAndLinkStrikes } from "../sourceAdapters/thunderAdapter";
import { flightsToAviationRecords } from "../sourceAdapters/aviationAdapter";
import { flightRowsToFlights } from "../../data/flightTrails";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

const okCov = (family: SoundSourceSet["family"], provider: string) => ({
  family,
  provider,
  dateKey: DATE,
  status: "ok" as const,
  windowStart: DAY_START,
  windowEnd: DAY_START + 86_400,
  temporalKind: "day_series" as const,
});

describe("receiverQuery", () => {
  it("T12：歷史日只有最新快照 → unavailable，不用當下資料回填", () => {
    const today = DAY_START + 86_400;
    const snapshot: SoundSourceSet = {
      family: "rain",
      dateKey: "2026-07-15",
      records: [],
      coverage: [{ ...okCov("rain", "latest"), dateKey: "2026-07-15", windowStart: today, windowEnd: today + 86_400, temporalKind: "latest_snapshot" }],
    };
    const r = queryReceiver(RECV, DAY_START + 3600, [snapshot], ["rain"]);
    expect(r.families[0]!.status).toBe("unavailable");
    expect(r.families[0]!.relativePotential).toBeNull();
    expect(r.families[0]!.reason).toBe("outside_source_time_coverage");
  });

  it("未載入的家族 → unavailable（null，不是 0／安靜）", () => {
    const r = queryReceiver(RECV, DAY_START + 3600, []);
    for (const f of r.families) {
      expect(f.status).toBe("unavailable");
      expect(f.relativePotential).toBeNull();
    }
  });

  it("indoor_unknown 接收者加註，不宣稱室內可聽程度", () => {
    const r = queryReceiver({ ...RECV, environment: "indoor_unknown" }, DAY_START, []);
    expect(r.families[0]!.notes[0]).toContain("indoor_unknown");
  });

  it("貢獻依潛勢排序，modeledDbA 一律 null", () => {
    const thunder: SoundSourceSet = {
      family: "thunder",
      dateKey: DATE,
      records: dedupeAndLinkStrikes([
        { source: "cwa", strikes: [
          { event_id: 1, strike_ts: DAY_START + 114, intensity_ka: null, strike_type: 0, lon: RECV.longitude, lat: latNorth(300) },
          { event_id: 2, strike_ts: DAY_START + 100, intensity_ka: null, strike_type: 0, lon: RECV.longitude, lat: latNorth(5000) },
        ] },
      ]),
      coverage: [okCov("thunder", "cwa")],
    };
    const r = queryReceiver(RECV, DAY_START + 100 + 15.5, [thunder]);
    expect(r.contributions).toHaveLength(2);
    expect(r.contributions[0]!.relativePotential!).toBeGreaterThan(r.contributions[1]!.relativePotential!);
    expect(r.contributions.every((c) => c.modeledDbA === null)).toBe(true);
  });
});

describe("dayProfile", () => {
  const waste: SoundSourceSet = {
    family: "waste_collection",
    dateKey: DATE,
    records: wasteRecordsForDate(DATE, [{
      city: "新北市", routeId: "R", routeName: null, vehicleType: "g", scheduleInferred: false,
      stops: [{ stopId: 1, stopSeq: 1, stopName: null, lng: RECV.longitude, lat: latNorth(30), arrivalSec: 7 * 3600 + 5 * 60, departureSec: 7 * 3600 + 6 * 60 }],
    }], []),
    coverage: [{ ...okCov("waste_collection", "waste_schedule_static"), temporalKind: "static_schedule" }],
  };
  const thunder: SoundSourceSet = { family: "thunder", dateKey: DATE, records: [], coverage: [{ ...okCov("thunder", "cwa"), status: "empty" }] };

  it("短暫停靠（1 分鐘）在 15 分鐘格內不被漏掉", () => {
    const p = dayProfile(RECV, DATE, 15, [waste, thunder]);
    expect(p.binStarts).toHaveLength(96);
    const w = p.families.find((f) => f.family === "waste_collection")!;
    const bin = 7 * 4; // 07:00–07:15
    expect(w.statuses[bin]).toBe("active");
    expect(w.values[bin]!).toBeGreaterThan(0);
    expect(w.values[bin + 1]).toBe(0);
    expect(w.unknownRatio).toBe(0);
  });

  it("T18：unknown／unavailable 格為 null 並計入 unknownRatio", () => {
    const p = dayProfile(RECV, DATE, 60, [waste, thunder]);
    const t = p.families.find((f) => f.family === "thunder")!;
    expect(t.values.every((v) => v === null)).toBe(true);
    expect(t.unknownRatio).toBe(1);
    const a = p.families.find((f) => f.family === "aviation")!;
    expect(a.statuses.every((s) => s === "unavailable")).toBe(true);
    expect(a.values.every((v) => v === null)).toBe(true);
  });

  it("90 秒飛越在 10 分鐘格內被細取樣捕捉", () => {
    const t = DAY_START + 9 * 3600 + 200;
    const lat = RECV.latitude;
    const trail = [[lat, RECV.longitude - 0.02, 800, t], [lat, RECV.longitude + 0.02, 800, t + 90]]
      .map((p) => p.join(",")).join(";");
    const aviation: SoundSourceSet = {
      family: "aviation",
      dateKey: DATE,
      records: flightsToAviationRecords(flightRowsToFlights([{ flight_id: "abc123", callsign: "T", aircraft_type: "", origin: "", destination: "", trail }]).flights),
      coverage: [okCov("aviation", "flight_trails")],
    };
    const p = dayProfile(RECV, DATE, 10, [aviation]);
    const a = p.families.find((f) => f.family === "aviation")!;
    expect(a.statuses[9 * 6]).toBe("active");
    expect(a.values[9 * 6]!).toBeGreaterThan(0.5);
    expect(a.values[9 * 6 + 1]).toBe(0);
  });

  it("stepMinutes 必須整除 1440", () => {
    expect(() => dayProfile(RECV, DATE, 7, [])).toThrow();
  });
});
