import { describe, it, expect } from "vitest";
import {
  deriveManeuverEvents,
  computePrediction,
  type TleHistoryRow,
} from "../satelliteHistoryLoader";

function row(
  daysAgo: number,
  inc: number,
  per: number,
  ecc: number,
): TleHistoryRow {
  const ms = Date.now() - daysAgo * 86400 * 1000;
  return {
    norad_id: 99999,
    name: "TEST",
    tle_line1: "",
    tle_line2: "",
    tle_epoch: String(daysAgo),
    inclination: inc,
    eccentricity: ecc,
    period_min: per,
    fetched_at: new Date(ms).toISOString(),
  };
}

describe("deriveManeuverEvents — 從 TLE 歷史推變軌", () => {
  it("變化不到閾值 → 0 events", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.4, 94.4, 0.001),
      row(7, 97.4, 94.4, 0.001),
      row(14, 97.4, 94.4, 0.001),
    ];
    expect(deriveManeuverEvents(hist)).toHaveLength(0);
  });

  it("傾角變 0.05° → PLANE_CHANGE", () => {
    // hist DESC 排序：[最新, ..., 最舊]
    const hist: TleHistoryRow[] = [
      row(0, 97.45, 94.4, 0.001),
      row(7, 97.4, 94.4, 0.001),
    ];
    const ev = deriveManeuverEvents(hist);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.type).toBe("PLANE_CHANGE");
  });

  it("週期變 0.1 min → ALTITUDE_CHANGE", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.4, 94.5, 0.001),
      row(7, 97.4, 94.4, 0.001),
    ];
    const ev = deriveManeuverEvents(hist);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.type).toBe("ALTITUDE_CHANGE");
  });

  it("離心率變 1e-4 → SHAPE_CHANGE", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.4, 94.4, 0.0011),
      row(7, 97.4, 94.4, 0.001),
    ];
    const ev = deriveManeuverEvents(hist);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.type).toBe("SHAPE_CHANGE");
  });

  it("輸出依 DESC 排序（最新在前）", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.45, 94.5, 0.001),
      row(7, 97.4, 94.5, 0.001),
      row(14, 97.4, 94.4, 0.001),
    ];
    const ev = deriveManeuverEvents(hist);
    expect(ev.length).toBeGreaterThanOrEqual(1);
    // 第一個 event 的 date 應該 >= 第二個
    if (ev.length >= 2) {
      expect(new Date(ev[0]!.date).getTime())
        .toBeGreaterThanOrEqual(new Date(ev[1]!.date).getTime());
    }
  });
});

describe("computePrediction — μ ± σ 信心區間", () => {
  it("少於 2 events → null（樣本不足）", () => {
    const pred = computePrediction([]);
    expect(pred.muDays).toBeNull();
    expect(pred.confidencePercent).toBeNull();
  });

  it("2 events 14 天間隔 → μ=14, σ=0", () => {
    const events = [
      { date: new Date(Date.now()).toISOString().slice(0, 10), type: "ALTITUDE_CHANGE" as const, detail: "" },
      { date: new Date(Date.now() - 14 * 86400 * 1000).toISOString().slice(0, 10), type: "ALTITUDE_CHANGE" as const, detail: "" },
    ];
    const pred = computePrediction(events);
    expect(pred.muDays).toBeCloseTo(14, 0);
    expect(pred.sigmaDays).toBeCloseTo(0, 1);
    expect(pred.sampleSize).toBe(2);
  });

  it("3 events 不等間隔 → σ > 0", () => {
    const t = Date.now();
    const events = [
      { date: new Date(t).toISOString().slice(0, 10), type: "ALTITUDE_CHANGE" as const, detail: "" },
      { date: new Date(t - 10 * 86400 * 1000).toISOString().slice(0, 10), type: "ALTITUDE_CHANGE" as const, detail: "" },
      { date: new Date(t - 30 * 86400 * 1000).toISOString().slice(0, 10), type: "ALTITUDE_CHANGE" as const, detail: "" },
    ];
    const pred = computePrediction(events);
    expect(pred.muDays).toBeGreaterThan(0);
    expect(pred.sigmaDays!).toBeGreaterThan(0);
    expect(pred.confidencePercent).toBeGreaterThan(0);
    expect(pred.confidencePercent).toBeLessThanOrEqual(80);
  });

  it("信心區間隨樣本數遞增 (n=2: 40%, n=10: 80% 上限)", () => {
    const mkEvents = (n: number) => Array.from({ length: n }, (_, i) => ({
      date: new Date(Date.now() - i * 7 * 86400 * 1000).toISOString().slice(0, 10),
      type: "ALTITUDE_CHANGE" as const,
      detail: "",
    }));
    const small = computePrediction(mkEvents(2));
    const large = computePrediction(mkEvents(15));
    expect(small.confidencePercent).toBeLessThan(large.confidencePercent!);
    expect(large.confidencePercent).toBeLessThanOrEqual(80);
  });
});
