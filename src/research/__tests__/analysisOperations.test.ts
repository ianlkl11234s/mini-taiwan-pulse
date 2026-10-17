import { describe, expect, it } from "vitest";
import { AnalysisOperations, type StoredDataResult } from "../analysisOperations";
import { BrowserMemoryResultStore, DEFAULT_RESULT_STORE_CAPACITY, DEFAULT_RESULT_STORE_MAX_BYTES, DEFAULT_RESULT_STORE_MAX_ENTRY_BYTES } from "../resultStore";

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
function lineResult(id = "lines"): StoredDataResult {
  return { resultId: id, datasetId: "fixture-rivers", recordGrain: "feature", geometry: { type: "MultiLineString", role: "actual", spatialAnalysisEligible: true }, sourceRefs: source, coverage: "fixture line source", freshness: "current", units: {}, rows: [
    { line_id: "crosses", geometry: { type: "LineString", coordinates: [[121.45, 25], [121.65, 25]] } },
    { line_id: "outside", geometry: { type: "MultiLineString", coordinates: [[[120, 20], [120.1, 20.1]], [[122, 26], [122.1, 26.1]]] } },
  ] };
}
function setup(...results: StoredDataResult[]) {
  const store = new BrowserMemoryResultStore<StoredDataResult>();
  results.forEach(result => store.put(result));
  return { store, operations: new AnalysisOperations(store) };
}

describe("BrowserMemoryResultStore", () => {
  it("retains a bounded route-analysis batch before evicting the oldest", () => {
    const store = new BrowserMemoryResultStore<{ resultId: string }>();
    for (let index = 0; index < DEFAULT_RESULT_STORE_CAPACITY + 1; index += 1) store.put({ resultId: `result-${index}` });
    expect(DEFAULT_RESULT_STORE_CAPACITY).toBe(128);
    expect(store.list().map(item => item.resultId)).toEqual(Array.from({ length: 128 }, (_, index) => `result-${index + 1}`));
  });

  it("retains 31 three-step route results alongside eight active pins within the byte budget", () => {
    const store = new BrowserMemoryResultStore<{ resultId: string; payload: string }>();
    const active = Array.from({ length: 8 }, (_, index) => `route-${index}-source`);
    for (let route = 0; route < 31; route += 1) {
      for (const stage of ["source", "buffer", "measure"]) store.put({ resultId: `route-${route}-${stage}`, payload: "x".repeat(2_000) });
    }
    store.setPinned(active);
    expect(store.list()).toHaveLength(93);
    expect(active.every(resultId => store.has(resultId))).toBe(true);
    expect(DEFAULT_RESULT_STORE_MAX_BYTES).toBe(96 * 1024 * 1024);
  });

  it("evicts only unpinned entries to enforce byte and per-entry budgets", () => {
    const store = new BrowserMemoryResultStore<{ resultId: string; payload: string }>({ maxResults: 8, maxBytes: 400, maxEntryBytes: 300 });
    store.put({ resultId: "pinned", payload: "x".repeat(150) });
    store.put({ resultId: "older", payload: "x".repeat(150) });
    store.setPinned(["pinned"]);
    store.put({ resultId: "next", payload: "x".repeat(150) });
    expect(store.has("pinned")).toBe(true); expect(store.has("older")).toBe(false); expect(store.has("next")).toBe(true);
    expect(() => store.put({ resultId: "oversize", payload: "x".repeat(301) })).toThrow("RESULT_STORE_ENTRY_BYTES_EXCEEDED");
    store.setPinned(["pinned", "next"]);
    expect(() => store.put({ resultId: "blocked", payload: "x".repeat(150) })).toThrow("RESULT_STORE_BYTE_BUDGET_PINNED");
    expect(store.list().map(item => item.resultId)).toEqual(["pinned", "next"]);
  });

  it("allows a bounded raw 22-county boundary result without raising the entry limit indefinitely", () => {
    expect(DEFAULT_RESULT_STORE_MAX_ENTRY_BYTES).toBe(24 * 1024 * 1024);
    const store = new BrowserMemoryResultStore<{ resultId: string; payload: string }>();
    expect(() => store.put({ resultId: "county-boundaries", payload: "x".repeat(14_700_000) })).not.toThrow();
    expect(() => store.put({ resultId: "too-large", payload: "x".repeat(24 * 1024 * 1024) })).toThrow("RESULT_STORE_ENTRY_BYTES_EXCEEDED");
  });

  it("keeps the active collection pinned while evicting older unpinned results", () => {
    const store = new BrowserMemoryResultStore<{ resultId: string }>({ maxResults: 3 });
    store.put({ resultId: "active-a" }); store.put({ resultId: "active-b" }); store.put({ resultId: "older" });
    store.setPinned(["active-a", "active-b"]);
    store.put({ resultId: "next" });
    expect(store.list().map(item => item.resultId)).toEqual(["active-a", "active-b", "next"]);
    store.setPinned(["active-a", "active-b", "next"]);
    expect(() => store.put({ resultId: "overflow" })).toThrow("RESULT_STORE_CAPACITY_PINNED");
  });

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
  it("preserves distinct source receipts with the same source ID and version", () => {
    const first = { ...source[0]!, checksumSha256: "a".repeat(64) };
    const changed = { ...first, checksumSha256: "b".repeat(64) };
    const reacquired = { ...first, acquiredAt: "2026-09-13T00:00:00.000Z" };
    const { operations } = setup(
      { ...pointResult("left"), sourceRefs: [first] },
      { ...pointResult("right"), sourceRefs: [first, changed, reacquired] },
    );
    const joined = operations.keyJoin({ leftResultId: "left", rightResultId: "right", leftKey: "code", rightKey: "code", cardinality: "one_to_one" });
    expect(joined.sourceRefs).toEqual([first, changed, reacquired]);
  });

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

  it("matches complete actual lines to areas with explicit boundary inclusion", () => {
    const { operations } = setup(lineResult(), areaResult());
    const joined = operations.lineIntersects({ lineResultId: "lines", areaResultId: "areas" });
    expect(joined.rows).toEqual(expect.arrayContaining([expect.objectContaining({ line_id: "crosses", matched_area: expect.objectContaining({ area_code: "A" }) })]));
    expect(joined.summary).toMatchObject({ lineRows: 2, areaRows: 3, matchedLines: 1, unmatchedLines: 1 });
    expect(joined.method).toMatchObject({ predicate: "line_intersects", boundaryRule: "boundary_included" });
  });

  it("rejects aggregate segment work before iterating row pairs", () => {
    const lines = { ...lineResult("many-lines"), rows: Array.from({ length: 1_001 }, (_, index) => ({ line_id: index, geometry: { type: "LineString", coordinates: [[121.45, 25], [121.65, 25]] } })) };
    const areas = { ...areaResult("many-areas"), rows: Array.from({ length: 1_000 }, (_, index) => ({ area_code: index, geometry: areaResult().rows[0]!.geometry })) };
    expect(() => setup(lines, areas).operations.lineIntersects({ lineResultId: "many-lines", areaResultId: "many-areas" })).toThrow("SPATIAL_SEGMENT_COMPARISON_BUDGET_EXCEEDED");
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

  it("uses the same qualified area guard for derived contains-center results", () => {
    const derived = { ...areaResult("derived-areas"), geometry: { type: "MultiPolygon" as const, role: "derived" as const, spatialAnalysisEligible: true } };
    expect(setup(derived).operations.areasContainingCenter({ areaResultId: "derived-areas", center: { lng: 121.5, lat: 25 } })).toMatchObject({ summary: { matchedAreas: 1 }, method: { predicate: "contains_center" } });
    const generalized = { ...derived, resultId: "generalized-areas", geometry: { type: "MultiPolygon" as const, role: "generalized" as const, spatialAnalysisEligible: false } };
    expect(() => setup(generalized).operations.areasContainingCenter({ areaResultId: "generalized-areas", center: { lng: 121.5, lat: 25 } })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
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

  it("builds and compares Taipei-local series without inventing missing or zero-baseline values", () => {
    const eventLineage = { sourceContract: { timeFields: [{ name: "published_at", role: "published" }] } };
    // published_at is UTC; bucketing is Taiwan-local (Asia/Taipei, UTC+8). 01:00Z (09:00 Taipei) stays
    // on 09-01, but 20:00Z (04:00 Taipei next day) rolls into 09-02 — a real day-boundary split that a
    // naive UTC-day bucket would have missed (see the dedicated "01:00 台灣時間" test below).
    const current = { ...pointResult("current-events"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [
      { published_at: "2026-09-01T01:00:00Z", amount: 4 }, { published_at: "2026-09-01T20:00:00Z", amount: null }, { published_at: null, amount: 8 },
    ] };
    const baseline = { ...pointResult("baseline-events"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [
      { published_at: "2026-09-01T02:00:00Z", amount: 0 }, { published_at: "2026-09-02T02:00:00Z", amount: 2 },
    ] };
    const { operations } = setup(current, baseline);
    const currentSeries = operations.readSeries({ resultId: "current-events", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const baselineSeries = operations.readSeries({ resultId: "baseline-events", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    expect(currentSeries.rows).toEqual([
      { period_start: "2026-09-01T00:00:00+08:00", value: 4, records: 1, missing_value: 0 },
      { period_start: "2026-09-02T00:00:00+08:00", value: null, records: 1, missing_value: 1 },
    ]);
    expect(currentSeries.summary).toMatchObject({ invalidTime: 1, missingPeriodsFilled: false });
    expect(currentSeries.method).toMatchObject({ timezone: "Asia/Taipei" });
    const compared = operations.compareSeries({ currentResultId: currentSeries.resultId, baselineResultId: baselineSeries.resultId, operation: "ratio" });
    expect(compared.rows).toEqual([
      expect.objectContaining({ period_start: "2026-09-01T00:00:00+08:00", value: null, status: "zero_baseline" }),
      expect.objectContaining({ period_start: "2026-09-02T00:00:00+08:00", value: null, status: "missing_current" }),
    ]);
    expect(compared.summary).toMatchObject({ zeroBaseline: 1, missingCurrent: 1 });
  });

  it("buckets a 01:00 Taiwan-time (凌晨) record into its own Taipei calendar day, not the earlier UTC day", () => {
    const eventLineage = { sourceContract: { timeFields: [{ name: "published_at", role: "published" }] } };
    const events = { ...pointResult("early-morning"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [
      // 2026-09-20T17:00:00Z is still 09-20 in UTC, but 2026-09-21T01:00 Taiwan-local — a naive
      // UTC-day bucket would misfile this onto 09-20 instead of the Taiwan calendar day it actually falls on.
      { published_at: "2026-09-20T17:00:00Z", amount: 3 },
    ] };
    const { operations } = setup(events);
    const series = operations.readSeries({ resultId: events.resultId, timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    expect(series.rows).toEqual([{ period_start: "2026-09-21T00:00:00+08:00", value: 3, records: 1, missing_value: 0 }]);
  });

  it("fails closed when a series has insufficient evidence or a known incompatible unit", () => {
    const eventLineage = { sourceContract: { timeFields: [{ name: "published_at", role: "published" }] } };
    const incomplete = { ...pointResult("incomplete"), units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const compatible = { ...pointResult("items"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const incompatible = { ...pointResult("people"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "people" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const mixedRowUnits = { ...pointResult("mixed-units"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1, unit: "items" }, { published_at: "2026-01-02T00:00:00Z", amount: 1, unit: "people" }] };
    const { operations } = setup(incomplete, compatible, incompatible, mixedRowUnits);
    const incompleteSeries = operations.readSeries({ resultId: "incomplete", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const itemSeries = operations.readSeries({ resultId: "items", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const peopleSeries = operations.readSeries({ resultId: "people", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const mixedUnitSeries = operations.readSeries({ resultId: "mixed-units", timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    expect(() => operations.compareSeries({ currentResultId: incompleteSeries.resultId, baselineResultId: itemSeries.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_EVIDENCE_INSUFFICIENT");
    expect(() => operations.compareSeries({ currentResultId: mixedUnitSeries.resultId, baselineResultId: itemSeries.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_EVIDENCE_INSUFFICIENT");
    expect(() => operations.compareSeries({ currentResultId: itemSeries.resultId, baselineResultId: peopleSeries.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_INCOMPATIBLE_CONTRACT");
  });

  it("compares administrative daily series across releases only with matching declared boundary and indicator contracts", () => {
    const statisticsLineage = { sourceContract: { timeFields: [{ name: "period_end", role: "period_end" }] } };
    const statistic = (id: string, releaseId: string, value: number, boundaryVersion = "township-2026a"): StoredDataResult => ({
      ...pointResult(id), datasetId: `regional-statistics:${releaseId}`, recordGrain: "admin_statistic",
      sourceRefs: [{ sourceId: `regional-statistics-${releaseId}`, version: releaseId, acquiredAt: "2026-09-22T00:00:00.000Z", checksumSha256: null, reference: `fixture://${releaseId}` }],
      lineage: statisticsLineage, units: { value: "people" }, rows: [{
        release_id: releaseId, area_code: releaseId === "release-current" ? "A" : "B", indicator_id: "housing_total", level: "township",
        unit: "people", value, period_start: "2026-01-01T00:00:00.000Z", period_end: "2026-09-01T00:00:00.000Z",
        boundary_version: boundaryVersion, boundary_sha256: "a".repeat(64), dimensions: { sex: "all", age: "all" },
      }, {
        release_id: releaseId, area_code: releaseId === "release-current" ? "C" : "D", indicator_id: "housing_total", level: "township",
        unit: "people", value, period_start: "2026-01-01T00:00:00.000Z", period_end: "2026-09-01T00:00:00.000Z",
        boundary_version: boundaryVersion, boundary_sha256: "a".repeat(64), dimensions: { age: "all", sex: "all" },
      }],
    });
    const current = statistic("current-admin", "release-current", 10);
    const baseline = statistic("baseline-admin", "release-baseline", 8);
    const changedBoundary = statistic("changed-boundary", "release-other", 9, "township-2026b");
    const { operations } = setup(current, baseline, changedBoundary);
    const currentSeries = operations.readSeries({ resultId: current.resultId, timeField: "period_end", resolution: "day", operation: "sum", valueField: "value" });
    const baselineSeries = operations.readSeries({ resultId: baseline.resultId, timeField: "period_end", resolution: "day", operation: "sum", valueField: "value" });
    const changedBoundarySeries = operations.readSeries({ resultId: changedBoundary.resultId, timeField: "period_end", resolution: "day", operation: "sum", valueField: "value" });
    const compared = operations.compareSeries({ currentResultId: currentSeries.resultId, baselineResultId: baselineSeries.resultId, operation: "difference" });
    expect(compared.summary).toMatchObject({ comparisonEvidence: "contract_verified" });
    expect(compared.rows).toEqual([expect.objectContaining({ current_value: 20, baseline_value: 16, value: 4, status: "valid" })]);
    expect(() => operations.compareSeries({ currentResultId: currentSeries.resultId, baselineResultId: changedBoundarySeries.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_INCOMPATIBLE_CONTRACT");
  });

  it("rejects non-administrative series from different datasets without a shared indicator contract", () => {
    const eventLineage = { sourceContract: { timeFields: [{ name: "published_at", role: "published" }] } };
    const left = { ...pointResult("events-a"), datasetId: "fixture-events-a", lineage: eventLineage, units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const right = { ...pointResult("events-b"), datasetId: "fixture-events-b", lineage: eventLineage, units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const { operations } = setup(left, right);
    const leftSeries = operations.readSeries({ resultId: left.resultId, timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const rightSeries = operations.readSeries({ resultId: right.resultId, timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    expect(() => operations.compareSeries({ currentResultId: leftSeries.resultId, baselineResultId: rightSeries.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_INCOMPATIBLE_CONTRACT");
  });

  it("rejects a different daily or weekly resolution before comparing values", () => {
    const eventLineage = { sourceContract: { timeFields: [{ name: "published_at", role: "published" }] } };
    const events = { ...pointResult("events"), datasetId: "fixture-events", lineage: eventLineage, units: { amount: "items" }, rows: [{ published_at: "2026-01-01T00:00:00Z", amount: 1 }] };
    const { operations } = setup(events);
    const daily = operations.readSeries({ resultId: events.resultId, timeField: "published_at", resolution: "day", operation: "sum", valueField: "amount" });
    const weekly = operations.readSeries({ resultId: events.resultId, timeField: "published_at", resolution: "week", operation: "sum", valueField: "amount" });
    const counted = operations.readSeries({ resultId: events.resultId, timeField: "published_at", resolution: "day", operation: "count", valueField: "amount" });
    expect(counted.method).toMatchObject({ comparisonContract: { valueField: null, unit: "records" } });
    expect(() => operations.compareSeries({ currentResultId: daily.resultId, baselineResultId: weekly.resultId, operation: "difference" })).toThrow("SERIES_COMPARISON_INCOMPATIBLE_CONTRACT");
  });
});
