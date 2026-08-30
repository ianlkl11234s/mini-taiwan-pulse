import { describe, expect, it } from "vitest";
import {
  deriveIsrPassFreshness,
  hasIsrPassCounts,
  normalizeIsrPassDays,
  parseIsrSatellitePassReport,
} from "../isrSatellitePassesLoader";

const NOW = Date.parse("2026-08-30T12:00:00+08:00");

describe("ISR satellite daily pass RPC contract", () => {
  it("maps target_day and preserves a complete day's true zero", () => {
    const report = parseIsrSatellitePassReport([
      {
        target_day: "2026-08-29",
        region_key: "twmain_12nm",
        tier_mode: "confirmed_plus_dual_use",
        pass_count: 0,
        unique_satellite_count: 0,
        latest_valid_day: "2026-08-29",
        computed_at: "2026-08-30T01:00:00Z",
        coverage_complete: true,
        scope_coverage_complete: true,
        china_isr_census_complete: false,
        registry_reviewed_at: "2026-08-28T00:00:00Z",
      },
    ], "twmain_12nm", "confirmed_plus_dual_use", NOW);

    expect(report).toMatchObject({
      latestValidDay: "2026-08-29",
      coverageComplete: true,
      scopeCoverageComplete: true,
      chinaIsrCensusComplete: false,
      freshness: "fresh",
      regionKey: "twmain_12nm",
      tierMode: "confirmed_plus_dual_use",
    });
    expect(report.rows[0]).toEqual({
      day: "2026-08-29",
      passCount: 0,
      uniqueSatelliteCount: 0,
      coverageComplete: true,
    });
    expect(hasIsrPassCounts(report.rows[0])).toBe(true);
  });

  it("keeps incomplete/null/malformed counts unknown instead of coercing them to zero", () => {
    const report = parseIsrSatellitePassReport([
      {
        target_day: "2026-08-28",
        pass_count: null,
        unique_satellite_count: "bad",
        latest_valid_day: "2026-08-28",
        refreshed_at: "2026-08-30T01:00:00Z",
        coverage_complete: false,
      },
    ], "twmain_12nm", "confirmed_plus_dual_use", NOW);

    expect(report.rows[0]).toMatchObject({
      passCount: null,
      uniqueSatelliteCount: null,
      coverageComplete: false,
    });
    expect(hasIsrPassCounts(report.rows[0])).toBe(false);
  });

  it("does not synthesize missing calendar days", () => {
    const report = parseIsrSatellitePassReport([
      { target_day: "2026-08-27", pass_count: 3, unique_satellite_count: 2, coverage_complete: true },
      { target_day: "2026-08-29", pass_count: 4, unique_satellite_count: 3, coverage_complete: true },
    ], "twmain_12nm", "confirmed_plus_dual_use", NOW);
    expect(report.rows.map((row) => row.day)).toEqual(["2026-08-27", "2026-08-29"]);
  });

  it("normalizes p_days to the RPC's 1..31 contract", () => {
    expect(normalizeIsrPassDays(1)).toBe(1);
    expect(normalizeIsrPassDays(31)).toBe(31);
    expect(normalizeIsrPassDays(90)).toBe(31);
    expect(normalizeIsrPassDays(0)).toBe(30);
    expect(normalizeIsrPassDays(1.5)).toBe(30);
  });
});

describe("ISR pass freshness", () => {
  it("requires both a recent computation and a recent latest valid day", () => {
    expect(deriveIsrPassFreshness("2026-08-29", "2026-08-30T01:00:00Z", NOW)).toBe("fresh");
    expect(deriveIsrPassFreshness("2026-08-20", "2026-08-30T01:00:00Z", NOW)).toBe("stale");
    expect(deriveIsrPassFreshness("2026-08-29", "2026-08-25T01:00:00Z", NOW)).toBe("stale");
    expect(deriveIsrPassFreshness(null, "2026-08-30T01:00:00Z", NOW)).toBe("unknown");
  });
});
