import { describe, expect, it } from "vitest";
import { AnalysisOperations, type StoredDataResult } from "../analysisOperations";
import { BrowserMemoryResultStore } from "../resultStore";

const source = [{ sourceId: "fixture", version: "v1", acquiredAt: "2026-09-12T00:00:00.000Z", checksumSha256: null, reference: "fixture://source" }];
function pointResult(id = "points"): StoredDataResult {
  return { resultId: id, datasetId: "tw-schools", recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, sourceRefs: source, coverage: "fixture", freshness: "current", units: { population: "people" }, rows: [
    { code: "A", population: 10, city: "T", geometry: { type: "Point", coordinates: [121.5, 25] } },
    { code: "B", population: null, city: "T", geometry: { type: "Point", coordinates: [121.6, 25.1] } },
    { code: "C", population: 30, city: "K", geometry: { type: "Point", coordinates: [120.3, 22.6] } },
  ] };
}
function areaResult(id = "areas"): StoredDataResult {
  return { resultId: id, datasetId: "tw-admin-boundaries", recordGrain: "feature", geometry: { type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true }, sourceRefs: source, coverage: "fixture boundaries v1", freshness: "current", units: {}, rows: [
    { area_code: "A", geometry: { type: "Polygon", coordinates: [[[121.4, 24.9], [121.55, 24.9], [121.55, 25.05], [121.4, 25.05], [121.4, 24.9]]] } },
    { area_code: "B", geometry: { type: "MultiPolygon", coordinates: [[[[121.55, 25.05], [121.7, 25.05], [121.7, 25.2], [121.55, 25.2], [121.55, 25.05]]]] } },
    { area_code: "EMPTY", geometry: { type: "Polygon", coordinates: [[[120, 24], [120.1, 24], [120.1, 24.1], [120, 24.1], [120, 24]]] } },
  ] };
}
function setup(...results: StoredDataResult[]) {
  const store = new BrowserMemoryResultStore<StoredDataResult>();
  results.forEach(result => store.put(result));
  return { store, operations: new AnalysisOperations(store) };
}

describe("BrowserMemoryResultStore", () => {
  it("expires, evicts, and does not leak mutations", () => {
    let now = 0; const store = new BrowserMemoryResultStore<{ resultId: string; nested: { value: number } }>({ maxResults: 2, ttlMs: 10, now: () => now });
    store.put({ resultId: "a", nested: { value: 1 } }); store.put({ resultId: "b", nested: { value: 2 } }); store.put({ resultId: "c", nested: { value: 3 } });
    expect(store.list().map(item => item.resultId)).toEqual(["b", "c"]);
    const saved = store.get("b")!; saved.nested.value = 99;
    expect(store.get("b")!.nested.value).toBe(2);
    now = 10; expect(store.get("b")).toBeNull(); expect(store.list()).toEqual([]);
  });
});

describe("AnalysisOperations", () => {
  it("runs spatial operations only against actual point geometry", () => {
    const { operations } = setup(pointResult());
    expect(operations.withinDistance({ resultId: "points", center: { lng: 121.5, lat: 25 }, radiusM: 1000 }).rows.map(row => row.code)).toEqual(["A"]);
    expect(operations.nearest({ resultId: "points", center: { lng: 121.5, lat: 25 }, limit: 2 }).rows.map(row => row.code)).toEqual(["A", "B"]);
    const { operations: proxyOps } = setup({ ...pointResult("proxy"), geometry: { type: "Point", role: "proxy", spatialAnalysisEligible: false } });
    expect(() => proxyOps.nearest({ resultId: "proxy", center: { lng: 121.5, lat: 25 } })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
  });

  it("spatially joins actual points to versioned polygon results", () => {
    const { operations } = setup(pointResult(), areaResult());
    const joined = operations.spatialJoin({ pointResultId: "points", areaResultId: "areas", predicate: "within" });
    expect(joined.rows).toEqual([
      expect.objectContaining({ code: "A", matched_area: expect.objectContaining({ area_code: "A" }) }),
      expect.objectContaining({ code: "B", matched_area: expect.objectContaining({ area_code: "B" }) }),
    ]);
    expect(joined.geometry).toMatchObject({ type: "Point", role: "actual" });
    expect(joined.summary).toMatchObject({ matchedPoints: 2, unmatchedPoints: 1, multipleMatches: 0, outputRows: 2 });
    expect(joined.method).toMatchObject({ predicate: "within", boundaryRule: "boundary_excluded" });
  });

  it("aggregates point records by area without turning source absence into real-world zero", () => {
    const { operations } = setup(pointResult(), areaResult());
    const aggregate = operations.aggregateByArea({ pointResultId: "points", areaResultId: "areas", predicate: "within", outputField: "places" });
    expect(aggregate.rows).toEqual([
      expect.objectContaining({ area_code: "A", places: 1 }),
      expect.objectContaining({ area_code: "B", places: 1 }),
      expect.objectContaining({ area_code: "EMPTY", places: 0 }),
    ]);
    expect(aggregate.geometry).toMatchObject({ type: "MultiPolygon", role: "actual" });
    expect(aggregate.summary).toMatchObject({ zeroAreas: 1, comparisons: 9 });
    expect(String(aggregate.summary.zeroMeaning)).toContain("not proof");
  });

  it("fails closed for ineligible boundaries and excessive spatial comparisons", () => {
    const ineligible = { ...areaResult("proxy-areas"), geometry: { type: "MultiPolygon" as const, role: "generalized" as const, spatialAnalysisEligible: false } };
    expect(() => setup(pointResult(), ineligible).operations.spatialJoin({ pointResultId: "points", areaResultId: "proxy-areas", predicate: "within" })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
    const manyPoints = { ...pointResult("many-points"), rows: Array.from({ length: 10_001 }, (_, index) => ({ geometry: { type: "Point", coordinates: [121.5, 25] }, index })) };
    const manyAreas = { ...areaResult("many-areas"), rows: Array.from({ length: 1_000 }, () => areaResult().rows[0]!) };
    expect(() => setup(manyPoints, manyAreas).operations.aggregateByArea({ pointResultId: "many-points", areaResultId: "many-areas", predicate: "within" })).toThrow("SPATIAL_COMPARISON_BUDGET_EXCEEDED");
  });

  it("aggregates without converting nulls into zero", () => {
    const { operations } = setup(pointResult());
    const mean = operations.aggregate({ resultId: "points", operation: "mean", field: "population", groupBy: ["city"] });
    expect(mean.rows).toEqual(expect.arrayContaining([expect.objectContaining({ city: "T", value: 10, nullOrNonNumeric: 1 }), expect.objectContaining({ city: "K", value: 30 })]));
    expect(operations.aggregate({ resultId: "points", operation: "count", field: "population" }).rows[0]).toMatchObject({ value: 2 });
    const nullOnly = setup({ ...pointResult("nulls"), rows: [{ population: null }] }).operations;
    expect(nullOnly.aggregate({ resultId: "nulls", operation: "sum", field: "population" }).rows[0]).toMatchObject({ value: null, nullOrNonNumeric: 1 });
  });

  it("enforces join cardinality and reports unmatched plus duplicate keys", () => {
    const left = pointResult("left");
    const right = { ...pointResult("right"), datasetId: "right", rows: [{ code: "A", label: "one" }, { code: "A", label: "two" }, { code: "Z", label: "orphan" }] };
    const { operations } = setup(left, right);
    expect(() => operations.keyJoin({ leftResultId: "left", rightResultId: "right", leftKey: "code", rightKey: "code", cardinality: "one_to_one" })).toThrow("JOIN_CARDINALITY_VIOLATION");
    const joined = operations.keyJoin({ leftResultId: "left", rightResultId: "right", leftKey: "code", rightKey: "code", cardinality: "one_to_many" });
    expect(joined.rows).toHaveLength(2); expect(joined.summary).toMatchObject({ unmatchedLeft: 2, unmatchedRight: 1, duplicatedRightKeys: 1 });
    expect(joined.rows[0]).toMatchObject({ left_code: "A", right_code: "A", right_label: "one" });
    const nullableLeft = { ...pointResult("nullable-left"), rows: [{ code: null }, { code: "A" }] };
    const nullableRight = { ...pointResult("nullable-right"), rows: [{ code: null }, { code: "A" }] };
    const nullableOps = setup(nullableLeft, nullableRight).operations;
    const nullableJoin = nullableOps.keyJoin({ leftResultId: "nullable-left", rightResultId: "nullable-right", leftKey: "code", rightKey: "code", cardinality: "one_to_one" });
    expect(nullableJoin.rows).toHaveLength(1);
    expect(nullableJoin.summary).toMatchObject({ unmatchedLeft: 1, unmatchedRight: 1, missingLeftKeys: 1, missingRightKeys: 1 });
  });

  it("calculates allowlisted metrics and retains nulls while rejecting a zero denominator", () => {
    const { operations } = setup({ ...pointResult(), rows: [{ numerator: 4, denominator: 2 }, { numerator: null, denominator: 4 }, { numerator: 1, denominator: 0 }] });
    expect(() => operations.calculateMetric({ resultId: "points", operation: "ratio", numeratorField: "numerator", denominatorField: "denominator" })).toThrow("ZERO_DENOMINATOR");
    const { operations: cleanOps } = setup({ ...pointResult("clean"), rows: [{ numerator: 4, denominator: 2 }, { numerator: null, denominator: 4 }] });
    expect(cleanOps.calculateMetric({ resultId: "clean", operation: "ratio", numeratorField: "numerator", denominatorField: "denominator" }).rows).toEqual([{ numerator: 4, denominator: 2, ratio: 2 }, { numerator: null, denominator: 4, ratio: null }]);
  });

  it("returns quality and record evidence from stored receipts only", () => {
    const { operations } = setup(pointResult());
    expect(operations.qualitySummary("points")).toMatchObject({ rows: 3, nullByField: { population: 1 }, spatialAnalysisEligible: true, sourceRefs: source });
    expect(operations.recordEvidence("points", 1)).toMatchObject({ recordIndex: 1, record: { code: "B" }, sourceRefs: source });
    expect(() => operations.recordEvidence("points", 3)).toThrow("RECORD_NOT_FOUND");
  });

  it("builds and compares UTC series without inventing missing or zero-baseline values", () => {
    const current = { ...pointResult("current-events"), units: { amount: "items" }, rows: [
      { published_at: "2026-09-01T01:00:00Z", amount: 4 }, { published_at: "2026-09-01T20:00:00Z", amount: null }, { published_at: null, amount: 8 },
    ] };
    const baseline = { ...pointResult("baseline-events"), units: { amount: "items" }, rows: [
      { published_at: "2026-09-01T02:00:00Z", amount: 0 }, { published_at: "2026-09-02T02:00:00Z", amount: 2 },
    ] };
    const { operations } = setup(current, baseline);
    const currentSeries = operations.readSeries({ resultId: "current-events", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const baselineSeries = operations.readSeries({ resultId: "baseline-events", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    expect(currentSeries.rows).toEqual([{ period_start: "2026-09-01T00:00:00.000Z", value: 4, records: 2, missing_value: 1 }]);
    expect(currentSeries.summary).toMatchObject({ invalidTime: 1, missingPeriodsFilled: false });
    const compared = operations.compareSeries({ currentResultId: currentSeries.resultId, baselineResultId: baselineSeries.resultId, operation: "ratio" });
    expect(compared.rows).toEqual([
      expect.objectContaining({ period_start: "2026-09-01T00:00:00.000Z", value: null, status: "zero_baseline" }),
      expect.objectContaining({ period_start: "2026-09-02T00:00:00.000Z", value: null, status: "missing_current" }),
    ]);
    expect(compared.summary).toMatchObject({ zeroBaseline: 1, missingCurrent: 1 });
  });
});
