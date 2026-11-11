/**
 * 路線剖面：每點時間遞增（出發＋距離÷速度），跨日使用隔天的來源，只給一天時過午夜 → unavailable（不是 0）。
 */
import { describe, expect, it } from "vitest";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";
import { resolveSpeed, routeProfile, sampleLineByDistance } from "../engines/routeProfile";
import { rainRowsToRecords } from "../sourceAdapters/rainFieldAdapter";
import { ROUTE } from "../model/soundProfiles";
import type { RainGaugeDayRow } from "../../data/rainGaugeLoader";
import type { SoundSourceSet } from "../types";

const NEXT = "2026-07-15";
const H = 3600;

function rainSet(date: string, dayStart: number, mmByHour: Record<number, number>): SoundSourceSet {
  const rows: RainGaugeDayRow[] = Object.entries(mmByHour).map(([h, mm]) => {
    const t = new Date((dayStart + Number(h) * H) * 1000).toISOString();
    return { station_id: "S1", station_name: "測站", county: null, town: null, lat: RECV.latitude, lng: RECV.longitude, bucket_at: t, observed_at: t, precipitation_10min: null, precipitation_1hr: mm, precipitation_3hr: null, precipitation_24hr: null };
  });
  return {
    family: "rain",
    dateKey: date,
    records: rainRowsToRecords(rows),
    coverage: [{ family: "rain", provider: "cwa_rain_gauge", dateKey: date, status: "ok", windowStart: dayStart, windowEnd: dayStart + 86_400, temporalKind: "day_series" }],
  };
}

// 往北 1,300 m 的直線（兩段，測多段內插）
const LINE: [number, number][] = [
  [RECV.longitude, RECV.latitude],
  [RECV.longitude, latNorth(650)],
  [RECV.longitude, latNorth(1_300)],
];

describe("routeProfile", () => {
  it("samples by distance incl. endpoint", () => {
    const pts = sampleLineByDistance(LINE, 50);
    expect(pts[0]![2]).toBe(0);
    expect(pts[pts.length - 1]![2]).toBeCloseTo(1_300, 0);
    expect(pts[pts.length - 1]![1]).toBeCloseTo(latNorth(1_300), 6);
    expect(pts.length).toBe(Math.ceil(pts[pts.length - 1]![2] / 50) + 1);
  });

  it("speeds come from soundProfiles; custom requires a speed", () => {
    expect(resolveSpeed("walk")).toBe(ROUTE.speedMps.value.walk);
    expect(resolveSpeed("bike")).toBe(4);
    expect(resolveSpeed("custom", 2)).toBe(2);
    expect(() => resolveSpeed("custom")).toThrow();
  });

  it("each sample time = depart + distance/speed (strictly increasing, not shared)", () => {
    const depart = DAY_START + 10 * H;
    const prof = routeProfile(LINE, depart, [rainSet(DATE, DAY_START, { 10: 5 })], { mode: "walk", families: ["rain"] });
    const ts = prof.samples.map((s) => s.unixSeconds);
    for (let i = 1; i < ts.length; i++) expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    for (const s of prof.samples) expect(s.unixSeconds).toBeCloseTo(depart + s.distanceM / 1.3, 6);
    expect(prof.arriveUnix).toBeCloseTo(depart + 1_300 / 1.3, 0);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it("crosses midnight correctly: after 00:00 uses next day's sources", () => {
    const depart = DAY_START + 23 * H + 50 * 60; // 23:50
    const nextStart = DAY_START + 86_400;
    const both = [rainSet(DATE, DAY_START, { 23: 0 }), rainSet(NEXT, nextStart, { 0: 10 })];
    const prof = routeProfile(LINE, depart, both, { mode: "walk", families: ["rain"] });
    const before = prof.samples.filter((s) => s.unixSeconds < nextStart);
    const after = prof.samples.filter((s) => s.unixSeconds >= nextStart);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(before.every((s) => s.families[0]!.status === "inactive")).toBe(true);
    expect(after.every((s) => s.families[0]!.status === "active")).toBe(true);
    expect(after[0]!.dominant?.family).toBe("rain");
    expect(after[0]!.families[0]!.contributions[0]!.sourceTime).toBe(new Date(nextStart * 1000).toISOString());

    // 只給當天：過午夜的點 → unavailable（不是 0）
    const oneDay = routeProfile(LINE, depart, [both[0]!], { mode: "walk", families: ["rain"] });
    const afterOne = oneDay.samples.filter((s) => s.unixSeconds >= nextStart);
    expect(afterOne.every((s) => s.families[0]!.status === "unavailable" && s.families[0]!.relativePotential === null)).toBe(true);
    expect(oneDay.families[0]!.unknownRatio).toBeGreaterThan(0);
  });

  it("caps sample count by widening spacing, never truncating the route", () => {
    const long: [number, number][] = [
      [RECV.longitude, RECV.latitude],
      [RECV.longitude, latNorth(150_000)],
    ];
    const prof = routeProfile(long, DAY_START, [], { mode: "bike", families: ["rain"] });
    expect(prof.samples.length).toBeLessThanOrEqual(ROUTE.maxSamples.value + 1);
    expect(prof.samples[prof.samples.length - 1]!.distanceM).toBeCloseTo(prof.totalDistanceM, 3);
    expect(prof.samples[0]!.families[0]!.status).toBe("unavailable");
  });
});
