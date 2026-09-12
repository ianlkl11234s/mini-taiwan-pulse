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

  it("aggregates without converting nulls into zero", () => {
    const { operations } = setup(pointResult());
    const mean = operations.aggregate({ resultId: "points", operation: "mean", field: "population", groupBy: ["city"] });
    expect(mean.rows).toEqual(expect.arrayContaining([expect.objectContaining({ city: "T", value: 10, nullOrNonNumeric: 1 }), expect.objectContaining({ city: "K", value: 30 })]));
    expect(operations.aggregate({ resultId: "points", operation: "count", field: "population" }).rows[0]).toMatchObject({ value: 2 });
  });

  it("enforces join cardinality and reports unmatched plus duplicate keys", () => {
    const left = pointResult("left");
    const right = { ...pointResult("right"), datasetId: "right", rows: [{ code: "A", label: "one" }, { code: "A", label: "two" }, { code: "Z", label: "orphan" }] };
    const { operations } = setup(left, right);
    expect(() => operations.keyJoin({ leftResultId: "left", rightResultId: "right", leftKey: "code", rightKey: "code", cardinality: "one_to_one" })).toThrow("JOIN_CARDINALITY_VIOLATION");
    const joined = operations.keyJoin({ leftResultId: "left", rightResultId: "right", leftKey: "code", rightKey: "code", cardinality: "one_to_many" });
    expect(joined.rows).toHaveLength(2); expect(joined.summary).toMatchObject({ unmatchedLeft: 2, unmatchedRight: 1, duplicatedRightKeys: 1 });
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
});
