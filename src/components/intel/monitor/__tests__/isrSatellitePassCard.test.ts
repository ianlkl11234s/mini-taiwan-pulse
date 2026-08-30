import { describe, expect, it } from "vitest";
import {
  buildIsrPassBars,
  compareLatestToMedian,
  deriveIsrLatestDisplay,
  medianOfIsrPassCounts,
  selectIsrPassWindow,
} from "../IsrSatellitePassCard";
import type { IsrSatellitePassReport } from "../../../../data/isrSatellitePassesLoader";

function report(overrides: Partial<IsrSatellitePassReport> = {}): IsrSatellitePassReport {
  return {
    rows: [{ day: "2026-08-29", passCount: 0, uniqueSatelliteCount: 0, coverageComplete: true }],
    latestValidDay: "2026-08-29",
    computedAt: "2026-08-30T01:00:00Z",
    registryReviewedAt: "2026-08-28T00:00:00Z",
    scopeCoverageComplete: true,
    chinaIsrCensusComplete: false,
    coverageComplete: true,
    freshness: "fresh",
    regionKey: "twmain_12nm",
    tierMode: "confirmed_plus_dual_use",
    ...overrides,
  };
}

describe("ISR pass card zero/null semantics", () => {
  it("shows zero only for a fresh, complete latest day", () => {
    expect(deriveIsrLatestDisplay(report(), "ready")).toMatchObject({
      kind: "ready", passCount: 0, uniqueSatelliteCount: 0,
    });
  });

  it("does not expose a numeric headline for stale, incomplete, error or null states", () => {
    expect(deriveIsrLatestDisplay(report({ freshness: "stale" }), "ready")).toMatchObject({ kind: "stale", passCount: null });
    expect(deriveIsrLatestDisplay(report({ scopeCoverageComplete: false }), "ready")).toMatchObject({ kind: "incomplete", passCount: null });
    expect(deriveIsrLatestDisplay(report(), "error")).toMatchObject({ kind: "error", passCount: null });
    expect(deriveIsrLatestDisplay(report({ rows: [] }), "ready")).toMatchObject({ kind: "empty", passCount: null });
  });

  it("keeps v1-scope true zero and partial-census counts, but keeps missing counts null", () => {
    const bars = buildIsrPassBars([
      { day: "2026-08-28", passCount: 0, uniqueSatelliteCount: 0, coverageComplete: true },
      { day: "2026-08-29", passCount: 0, uniqueSatelliteCount: 0, coverageComplete: false },
      { day: "2026-08-30", passCount: null, uniqueSatelliteCount: null, coverageComplete: false },
    ], true, "2026-08-30");
    expect(bars.map((bar) => bar.value)).toEqual([0, 0, null]);
  });

  it("does not let an incomplete China-wide census suppress v1 scoped counts", () => {
    expect(deriveIsrLatestDisplay(report({
      coverageComplete: false,
      scopeCoverageComplete: true,
      chinaIsrCensusComplete: false,
      rows: [{ day: "2026-08-29", passCount: 4, uniqueSatelliteCount: 3, coverageComplete: false }],
    }), "ready")).toMatchObject({ kind: "ready", passCount: 4, uniqueSatelliteCount: 3 });
  });

  it("does not label a zero as true zero when the v1 registry scope is incomplete", () => {
    expect(buildIsrPassBars([
      { day: "2026-08-29", passCount: 0, uniqueSatelliteCount: 0, coverageComplete: false },
    ], false, "2026-08-29")[0]?.value).toBeNull();
  });

  it("excludes rows after latest_valid_day because they are not complete days", () => {
    const bars = buildIsrPassBars([
      { day: "2026-08-29", passCount: 2, uniqueSatelliteCount: 2, coverageComplete: false },
      { day: "2026-08-30", passCount: 1, uniqueSatelliteCount: 1, coverageComplete: false },
    ], true, "2026-08-29");
    expect(bars.map((bar) => bar.key)).toEqual(["2026-08-29"]);
  });
});

describe("ISR pass card calendar windows", () => {
  it("anchors the 30D window at latest_valid_day without synthesizing missing days", () => {
    const rows: IsrSatellitePassReport["rows"] = [
      { day: "2026-07-31", passCount: 1, uniqueSatelliteCount: 1, coverageComplete: true },
      { day: "2026-08-01", passCount: 2, uniqueSatelliteCount: 2, coverageComplete: true },
      { day: "2026-08-15", passCount: null, uniqueSatelliteCount: null, coverageComplete: false },
      { day: "2026-08-30", passCount: 4, uniqueSatelliteCount: 3, coverageComplete: true },
      { day: "2026-08-31", passCount: 5, uniqueSatelliteCount: 4, coverageComplete: true },
    ];

    expect(selectIsrPassWindow(rows, "2026-08-30", 30).map((row) => row.day)).toEqual([
      "2026-08-01",
      "2026-08-15",
      "2026-08-30",
    ]);
  });

  it("returns no window when latest_valid_day is unavailable", () => {
    expect(selectIsrPassWindow(report().rows, null, 120)).toEqual([]);
  });

  it("uses inclusive calendar boundaries for the 90D and 120D windows", () => {
    const rows: IsrSatellitePassReport["rows"] = [
      { day: "2026-05-02", passCount: 1, uniqueSatelliteCount: 1, coverageComplete: true },
      { day: "2026-05-03", passCount: 2, uniqueSatelliteCount: 2, coverageComplete: true },
      { day: "2026-06-01", passCount: 3, uniqueSatelliteCount: 3, coverageComplete: true },
      { day: "2026-06-02", passCount: 4, uniqueSatelliteCount: 4, coverageComplete: true },
      { day: "2026-08-30", passCount: 5, uniqueSatelliteCount: 5, coverageComplete: true },
    ];

    expect(selectIsrPassWindow(rows, "2026-08-30", 90).map((row) => row.day)).toEqual([
      "2026-06-02",
      "2026-08-30",
    ]);
    expect(selectIsrPassWindow(rows, "2026-08-30", 120).map((row) => row.day)).toEqual([
      "2026-05-03",
      "2026-06-01",
      "2026-06-02",
      "2026-08-30",
    ]);
  });
});

describe("ISR pass card median comparison", () => {
  it("excludes null but includes a legitimate zero in an odd-sized median", () => {
    expect(medianOfIsrPassCounts([0, null, 4, 2])).toBe(2);
  });

  it("averages the two central values for an even-sized median", () => {
    expect(medianOfIsrPassCounts([0, 2, null, 8, 10])).toBe(5);
  });

  it("keeps an all-missing window unknown instead of turning it into zero", () => {
    expect(medianOfIsrPassCounts([null, null])).toBeNull();
  });

  it("reports higher, lower and equal with an absolute difference", () => {
    expect(compareLatestToMedian(8, 5.5)).toEqual({ direction: "higher", difference: 2.5 });
    expect(compareLatestToMedian(3, 5.5)).toEqual({ direction: "lower", difference: 2.5 });
    expect(compareLatestToMedian(5.5, 5.5)).toEqual({ direction: "equal", difference: 0 });
    expect(compareLatestToMedian(null, 5.5)).toEqual({ direction: "unknown", difference: null });
  });
});
