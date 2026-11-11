import { describe, expect, it } from "vitest";
import { flightRowsToFlights, type FlightTrailRow } from "../../data/flightTrails";
import {
  altitudeToMeters,
  altitudeUnitForFlightId,
  aviationPositionAt,
  flightsToAviationRecords,
} from "../sourceAdapters/aviationAdapter";
import { dayProfile, queryFamilyInterval } from "../engines/receiverQuery";
import { loadAviation } from "../sourceAdapters/aviationAdapter";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

const T = DAY_START + 10 * 3600;
const LAT = RECV.latitude;
const LON = RECV.longitude;

function row(flight_id: string, pts: [number, number, number, number][]): FlightTrailRow {
  return {
    flight_id,
    callsign: "TST001",
    aircraft_type: "",
    origin: "",
    destination: "",
    trail: pts.map((p) => p.join(",")).join(";"),
  };
}

function setFrom(rows: FlightTrailRow[]): SoundSourceSet {
  const records = flightsToAviationRecords(flightRowsToFlights(rows).flights);
  return {
    family: "aviation",
    dateKey: DATE,
    records,
    coverage: [{ family: "aviation", provider: "flight_trails", dateKey: DATE, status: "ok", windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "day_series" }],
  };
}

describe("altitude unit（依 flight_id）", () => {
  it("8 hex → ft、6 hex → m、其他 → unknown；切段後綴不影響", () => {
    expect(altitudeUnitForFlightId("3a1b2c4d")).toBe("ft");
    expect(altitudeUnitForFlightId("3a1b2c4d_1")).toBe("ft");
    expect(altitudeUnitForFlightId("abc123")).toBe("m");
    expect(altitudeUnitForFlightId("ABC123_0")).toBe("m");
    expect(altitudeUnitForFlightId("XYZ-1")).toBe("unknown");
    expect(altitudeUnitForFlightId("abc12")).toBe("unknown");
  });
  it("ft × 0.3048；unknown → null", () => {
    expect(altitudeToMeters(1000, "ft")).toBeCloseTo(304.8);
    expect(altitudeToMeters(1000, "m")).toBe(1000);
    expect(altitudeToMeters(1000, "unknown")).toBeNull();
  });
});

describe("aviationAdapter", () => {
  it("短間隔內線性插值；FR24（ft）換成公尺後算 3D 斜距", () => {
    const set = setFrom([row("3a1b2c4d", [[LAT, LON - 0.01, 3000, T], [LAT, LON + 0.01, 3000, T + 120]])]);
    const pos = aviationPositionAt((set.records[0]!.payload as never), T + 60);
    expect(pos).toMatchObject({ status: "position", interpolated: true });
    const r = queryFamilyInterval("aviation", [set], RECV, T + 60, T + 60);
    expect(r.status).toBe("active");
    const c = r.contributions[0]!;
    expect(c.propagationApproximation).toBe("3d");
    expect(c.spatialDistanceM).toBeCloseTo(3000 * 0.3048 - 1.5, 0);
    expect(c.modeledDbA).toBeNull();
    expect(c.relativePotential).toBeGreaterThan(0);
    expect(c.relativePotential).toBeLessThanOrEqual(1);
  });

  it("T04：>30 分鐘缺口不插值，回 unknown 並標 trail_incomplete", () => {
    const set = setFrom([
      row("abc123", [
        [LAT, LON, 1000, T],
        [LAT, LON, 1000, T + 60],
        [latNorth(1000), LON, 1000, T + 60 + 2400],
        [latNorth(1000), LON, 1000, T + 60 + 2460],
      ]),
    ]);
    // flightRowsToFlights 切成兩段，adapter 重組回一個航班
    expect(set.records).toHaveLength(1);
    expect((set.records[0]!.payload as { segments: unknown[] }).segments).toHaveLength(2);
    const mid = T + 60 + 1200;
    expect(aviationPositionAt(set.records[0]!.payload as never, mid)).toMatchObject({ status: "unknown" });
    const r = queryFamilyInterval("aviation", [set], RECV, mid, mid);
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.reason).toBe("trail_gap_over_30min_between_segments");
    expect(r.contributions[0]!.notes.join(" ")).toContain("trail_incomplete");
  });

  it("段內間隔超過插值上限也回 unknown", () => {
    const set = setFrom([row("abc123", [[LAT, LON, 1000, T], [LAT, LON, 1000, T + 1500]])]);
    expect(aviationPositionAt(set.records[0]!.payload as never, T + 700)).toMatchObject({ status: "unknown" });
  });

  it("T05：高度單位未知 → 只算 2D、潛勢 null、notes 標 blocker", () => {
    const set = setFrom([row("XYZ-1", [[LAT, LON, 900, T], [LAT, LON, 900, T + 60]])]);
    const r = queryFamilyInterval("aviation", [set], RECV, T + 30, T + 30);
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.reason).toBe("altitude_unit_unknown");
    const c = r.contributions[0]!;
    expect(c.propagationApproximation).toBe("2d");
    expect(c.relativePotential).toBeNull();
    expect(c.spatialDistanceM).toBeCloseTo(0, 0);
    expect(c.notes.some((n) => n.startsWith("blocker:T05"))).toBe(true);
  });

  it("航跡涵蓋時段外為 inactive；半徑外不列入", () => {
    const set = setFrom([row("abc123", [[LAT, LON, 1000, T], [LAT, LON, 1000, T + 60]])]);
    expect(queryFamilyInterval("aviation", [set], RECV, T - 600, T - 600).status).toBe("inactive");
    const far = setFrom([row("abc123", [[LAT + 1, LON, 1000, T], [LAT + 1, LON, 1000, T + 60]])]);
    const r = queryFamilyInterval("aviation", [far], RECV, T + 30, T + 30);
    expect(r.status).toBe("inactive");
    expect(r.relativePotential).toBe(0);
  });

  it("T18：查今天時，最後一筆航跡之後的時段是 null（unavailable），不是 0", async () => {
    const noon = DAY_START + 12 * 3600;
    const flights = flightRowsToFlights([row("abc123", [[LAT, LON, 1000, noon - 120], [LAT, LON, 1000, noon]])]).flights;
    const set = await loadAviation({ date: DATE, nowUnix: DAY_START + 18 * 3600 }, async () => ({ flights }));
    expect(set.coverage[0]!.windowEnd).toBe(noon);
    const p = dayProfile(RECV, DATE, 60, [set], ["aviation"]);
    const a = p.families[0]!;
    expect(a.values[10]).toBe(0); // 上午有資料、附近沒飛機
    expect(a.statuses[11]).toBe("active");
    for (let h = 13; h < 24; h++) {
      expect(a.values[h]).toBeNull();
      expect(a.statuses[h]).toBe("unavailable");
    }
  });
});
