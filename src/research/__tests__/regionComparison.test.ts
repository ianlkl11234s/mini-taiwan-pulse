import { describe, expect, it } from "vitest";
import type { StoredDataResult } from "../analysisOperations";
import { compareRegions } from "../regionComparison";

const sha = "a".repeat(64);
const polygon = (x: number): GeoJSON.Polygon => ({ type: "Polygon", coordinates: [[[x, 25], [x + .01, 25], [x + .01, 25.01], [x, 25.01], [x, 25]]] });

function result(rows: readonly Record<string, unknown>[], overrides: Partial<StoredDataResult> = {}): StoredDataResult {
  return {
    resultId: "numerator", datasetId: "stats:fixture", rows, recordGrain: "admin_statistic",
    geometry: { type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [], coverage: "fixture release", freshness: "current", units: { value: "cases" }, ...overrides,
  };
}

function rows(values: Record<string, number | null>, changes: Partial<Record<string, Record<string, unknown>>> = {}): Record<string, unknown>[] {
  return Object.entries(values).map(([area_code, value], i) => ({
    release_id: "r1", dataset_id: "stats:fixture", indicator_id: "incidents", dimensions: { sex: "all" }, period_start: "2026-01-01", period_end: "2026-12-31", unit: "cases", level: "county", boundary_version: "v1", boundary_sha256: sha,
    area_code, area_name: `Area ${area_code}`, value, status: value === null ? "missing" : "observed", geometry: polygon(121 + i), ...changes[area_code],
  }));
}

describe("compareRegions", () => {
  it("A04 compares same-release canonical areas without summing and retains each boundary", () => {
    const output = compareRegions(result(rows({ A04: 20, A05: 10 })), { areaCodes: ["A04", "A05"], baselineAreaCode: "A05" });
    expect(output.rows).toEqual([
      expect.objectContaining({ area_code: "A04", value: 20, absoluteDifference: 10, ratio: 2, normalizedValue: null, status: "observed" }),
      expect.objectContaining({ area_code: "A05", value: 10, absoluteDifference: 0, ratio: 1, geometry: expect.objectContaining({ type: "Polygon" }) }),
    ]);
    expect(output.method).toMatchObject({ noAggregation: true, noAreaInterpolation: true });
    expect(output.geometry).toMatchObject({ role: "actual", spatialAnalysisEligible: true });
  });

  it("compares values and retains display polygons without granting topology eligibility", () => {
    const source = result(rows({ A04: 20, A05: 10 }), { geometry: { type: "MultiPolygon", role: "generalized", spatialAnalysisEligible: false } });
    const output = compareRegions(source, { areaCodes: ["A04", "A05"], baselineAreaCode: "A05" });
    expect(output.rows[0]).toMatchObject({ value: 20, absoluteDifference: 10, geometry: expect.any(Object) });
    expect(output.geometry).toEqual(source.geometry);
    expect(output.summary.geometriesRetained).toBe(2);
  });

  it("A05 calculates per-10,000 only from an explicitly allowlisted population denominator", () => {
    const numerator = result(rows({ A04: 20, A05: 10 }));
    const denominator = result(rows({ A04: 10_000, A05: 5_000 }, {
      A04: { dataset_id: "stats:population", indicator_id: "population", unit: "persons" }, A05: { dataset_id: "stats:population", indicator_id: "population", unit: "persons" },
    }), { resultId: "population", datasetId: "stats:population", units: { value: "persons" } });
    const output = compareRegions(numerator, { areaCodes: ["A04", "A05"], baselineAreaCode: "A05", denominatorResult: denominator, per: 10_000 });
    expect(output.rows.map(row => row.normalizedValue)).toEqual([20, 20]);
    expect(output.units.normalizedValue).toBe("cases per 10000 persons");
    const nonPopulationPeople = result(rows({ A04: 10_000, A05: 5_000 }, {
      A04: { indicator_id: "students", unit: "persons" }, A05: { indicator_id: "students", unit: "persons" },
    }), { units: { value: "persons" } });
    expect(() => compareRegions(numerator, { areaCodes: ["A04", "A05"], baselineAreaCode: "A05", denominatorResult: nonPopulationPeople })).toThrow("REGION_COMPARISON_DENOMINATOR_NOT_POPULATION");
  });

  it("A06 preserves zero, missing, suppressed, not-reported and zero-denominator states", () => {
    const numerator = result(rows({ A04: 0, A05: 10, A06: null, A07: null, A08: null }, { A07: { status: "suppressed" }, A08: { status: "not_reported" } }));
    const denominator = result(rows({ A04: 1_000, A05: 0, A06: null, A07: null, A08: null }, {
      A04: { indicator_id: "population", unit: "persons" }, A05: { indicator_id: "population", unit: "persons" }, A06: { indicator_id: "population", unit: "persons" }, A07: { indicator_id: "population", unit: "persons", status: "suppressed" }, A08: { indicator_id: "population", unit: "persons", status: "not_reported" },
    }), { units: { value: "persons" } });
    const output = compareRegions(numerator, { areaCodes: ["A04", "A05", "A06", "A07", "A08"], baselineAreaCode: "A04", denominatorResult: denominator });
    expect(output.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "A04", value: 0, normalizedValue: 0, comparison_status: "baseline_zero" }),
      expect.objectContaining({ area_code: "A05", normalization_status: "zero_denominator", ratio: null }),
      expect.objectContaining({ area_code: "A06", status: "missing", normalizedValue: null, normalization_status: "denominator_missing" }),
      expect.objectContaining({ area_code: "A07", status: "suppressed", normalizedValue: null, normalization_status: "denominator_suppressed" }),
      expect.objectContaining({ area_code: "A08", status: "not_reported", normalizedValue: null, normalization_status: "denominator_not_reported" }),
    ]));
  });

  it("A07 rejects mismatched unit, period, boundary and duplicate observations", () => {
    for (const [field, value] of [["unit", "other"], ["period_end", "2027-01-01"], ["boundary_sha256", "b".repeat(64)]] as const) {
      const altered = result(rows({ A04: 20, A05: 10 }, { A05: { [field]: value } }));
      expect(() => compareRegions(altered, { areaCodes: ["A04", "A05"], baselineAreaCode: "A05" })).toThrow("REGION_COMPARISON_AMBIGUOUS_CONTRACT");
    }
    expect(() => compareRegions(result([...rows({ A04: 20, A05: 10 }), rows({ A04: 20 })[0]!]), { areaCodes: ["A04", "A05"], baselineAreaCode: "A05" })).toThrow("REGION_COMPARISON_DUPLICATE_AREA_OBSERVATION");
  });
});
