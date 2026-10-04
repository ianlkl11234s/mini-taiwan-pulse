import { describe, it, expect } from "vitest";
import {
  deriveManeuverEvents,
  computePrediction,
  MIN_PREDICTION_INTERVALS,
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

describe("deriveManeuverEvents — 缺值不當 0", () => {
  it("新舊任一端 inclination 為 null → 不產生假變軌", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.4, 94.4, 0.001),
      { ...row(7, 97.4, 94.4, 0.001), inclination: null },
    ];
    // 新的傾角 97.4、舊的 null：若把 null 當 0 會得到 +97.4° 假事件
    expect(deriveManeuverEvents(hist)).toHaveLength(0);
  });

  it("某欄缺值但其他欄真的變化 → 只用有值的欄位判斷", () => {
    const hist: TleHistoryRow[] = [
      row(0, 97.4, 94.5, 0.001),
      { ...row(7, 97.4, 94.4, 0.001), inclination: null },
    ];
    const ev = deriveManeuverEvents(hist);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.type).toBe("ALTITUDE_CHANGE");
    expect(ev[0]!.deltaInclination).toBeUndefined();
  });
});

describe("computePrediction — 依歷史間隔估算（無信心百分比）", () => {
  const day = (n: number) => new Date(Date.now() - n * 86400 * 1000).toISOString().slice(0, 10);
  const ev = (...ages: number[]) =>
    ages.map((n) => ({ date: day(n), type: "ALTITUDE_CHANGE" as const, detail: "" }));

  it("少於 2 events → null（樣本不足）", () => {
    const pred = computePrediction([]);
    expect(pred.muDays).toBeNull();
    expect(pred).not.toHaveProperty("confidencePercent");
  });

  it(`間隔數 < ${MIN_PREDICTION_INTERVALS}（n=2、3 個事件）→ 不給預測`, () => {
    expect(computePrediction(ev(0, 14)).muDays).toBeNull();
    expect(computePrediction(ev(0, 10, 30)).muDays).toBeNull();
    expect(computePrediction(ev(0, 10, 30)).sampleSize).toBe(3);
  });

  it(`剛好 ${MIN_PREDICTION_INTERVALS} 個間隔（4 個事件）→ 有 μ、σ 與區間`, () => {
    const pred = computePrediction(ev(0, 10, 30, 40));
    expect(pred.muDays).toBeCloseTo(40 / 3, 5);
    expect(pred.sigmaDays!).toBeGreaterThan(0);
    expect(pred.nextLowDays!).toBeLessThanOrEqual(pred.nextHighDays!);
    expect(pred.sampleSize).toBe(4);
  });

  it("等間隔 → σ=0", () => {
    const pred = computePrediction(ev(0, 7, 14, 21));
    expect(pred.muDays).toBeCloseTo(7, 5);
    expect(pred.sigmaDays).toBeCloseTo(0, 5);
  });
});
