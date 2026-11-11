import { describe, expect, it } from "vitest";
import type { RainGaugeDayRow } from "../../data/rainGaugeLoader";
import { rainRowsToRecords } from "../sourceAdapters/rainFieldAdapter";
import { queryFamilyInterval } from "../engines/receiverQuery";
import type { SoundSourceSet } from "../types";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";

const hourIso = (h: number) => new Date((DAY_START + h * 3600) * 1000).toISOString();

function rowAt(h: number, mm1h: number | null, opts: Partial<RainGaugeDayRow> = {}): RainGaugeDayRow {
  return {
    station_id: "S001",
    station_name: "測站甲",
    county: null,
    town: null,
    lat: latNorth(1000),
    lng: RECV.longitude,
    bucket_at: hourIso(h),
    observed_at: new Date((DAY_START + h * 3600 + 3000) * 1000).toISOString(),
    precipitation_10min: null,
    precipitation_1hr: mm1h,
    precipitation_3hr: null,
    precipitation_24hr: null,
    ...opts,
  };
}

function setOf(rows: RainGaugeDayRow[]): SoundSourceSet {
  return {
    family: "rain",
    dateKey: DATE,
    records: rainRowsToRecords(rows),
    coverage: [{ family: "rain", provider: "cwa_rain_gauge", dateKey: DATE, status: rows.length ? "ok" : "empty", windowStart: DAY_START, windowEnd: DAY_START + 86_400, temporalKind: "day_series" }],
  };
}

describe("rainFieldAdapter", () => {
  it("取最近站、回報站名與距離、標 hourly 粒度", () => {
    const set = setOf([rowAt(14, 12), rowAt(14, 50, { station_id: "S002", station_name: "測站乙", lat: latNorth(4000) })]);
    const r = queryFamilyInterval("rain", [set], RECV, DAY_START + 14.5 * 3600, DAY_START + 14.5 * 3600);
    expect(r.status).toBe("active");
    const c = r.contributions[0]!;
    expect(c.notes.join(" ")).toContain("測站甲(S001)");
    expect(c.spatialDistanceM).toBeCloseTo(1000, -1);
    expect(c.temporalPrecision).toBe("hourly");
    expect(c.notes).toContain("granularity:hourly");
    expect(c.relativePotential).toBeCloseTo(1 - Math.exp(-1.2), 5);
  });

  it("T09：最近站超過最大距離 → unknown，不外推街區雨勢", () => {
    const set = setOf([rowAt(14, 30, { lat: latNorth(20_000) })]);
    const r = queryFamilyInterval("rain", [set], RECV, DAY_START + 14.5 * 3600, DAY_START + 14.5 * 3600);
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.contributions[0]!.notes[0]).toMatch(/^no_rain_station_within_/);
  });

  it("T18：precipitation_1hr 為 null → unknown，不變 0；10min 不混用", () => {
    const set = setOf([rowAt(14, null, { precipitation_10min: 3 })]);
    const r = queryFamilyInterval("rain", [set], RECV, DAY_START + 14.5 * 3600, DAY_START + 14.5 * 3600);
    expect(r.status).toBe("unknown");
    expect(r.relativePotential).toBeNull();
    expect(r.relativePotential).not.toBe(0);
  });

  it("該站該小時無列 → unknown；0 mm → inactive（觀測到乾）", () => {
    const set = setOf([rowAt(14, 0)]);
    expect(queryFamilyInterval("rain", [set], RECV, DAY_START + 15.5 * 3600, DAY_START + 15.5 * 3600).status).toBe("unknown");
    const dry = queryFamilyInterval("rain", [set], RECV, DAY_START + 14.5 * 3600, DAY_START + 14.5 * 3600);
    expect(dry.status).toBe("inactive");
    expect(dry.relativePotential).toBe(0);
  });

  it("字串數值（PostgREST numeric）也能解析", () => {
    const recs = rainRowsToRecords([rowAt(1, "5.5" as unknown as number)]);
    expect(recs[0]!.payload.precipitation1hMm).toBe(5.5);
    expect(recs[0]!.validUntil - recs[0]!.validFrom).toBe(3600);
  });
});
