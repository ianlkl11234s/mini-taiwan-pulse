import { describe, expect, it } from "vitest";
import { buildIsrPassBars, deriveIsrLatestDisplay } from "../IsrSatellitePassCard";
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
