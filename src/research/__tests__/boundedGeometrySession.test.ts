import { describe, expect, it } from "vitest";
import { validQueryResultData } from "../QueryResponder";
import { ResearchAnalysisSession } from "../researchAnalysisSession";

function sessionWithLine(role = "actual") {
  const session = new ResearchAnalysisSession();
  const store = (session as unknown as { store: { put(value: object): void } }).store;
  store.put({ resultId: "line", datasetId: "fixture-line", rows: [{ name: "測試支線", geometry: { type: "LineString", coordinates: [[120.44, 23.48], [120.445, 23.48]] } }], recordGrain: "feature", geometry: { type: "LineString", role, spatialAnalysisEligible: role === "actual" }, sourceRefs: [{ sourceId: "fixture", version: "v1", checksumSha256: "a".repeat(64), acquiredAt: "2026-09-24T00:00:00Z", reference: "/fixture" }], coverage: "fixture only", freshness: "unknown", units: {}, lineage: { datasets: ["fixture-line"], queryScope: { datasetId: "fixture-line", filters: [{ field: "route", op: "eq", value: "fixture" }], bbox: [120.4, 23.4, 120.5, 23.5], time: { start: "2026-09-01", end: "2026-09-24" }, parameters: { sourceVersion: "v1" }, totalMatched: 1 }, sourceContract: { datasetId: "fixture-line", recordGrain: "feature", timeFields: ["observed_at"], geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true } } } });
  return session;
}

describe("bounded geometry session integration", () => {
  it("preserves lineage, units and eligible derived surface through buffer, intersection and measurement", async () => {
    const session = sessionWithLine();
    const buffer = await session.executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200 });
    expect(session.presentable([String(buffer.resultId)])[0]?.displayLabel).toBe("測試支線・200 公尺線形環域");
    expect(buffer).toMatchObject({ operation: "line_buffer", geometry: { role: "derived", spatialAnalysisEligible: true }, sourceRefs: [expect.objectContaining({ version: "v1" })], inputResultIds: ["line"], freshness: "unknown" });
    const overlap = await session.executeGeometry({ predicate: "surface_intersection", leftResultId: buffer.resultId, rightResultId: buffer.resultId });
    expect(overlap).toMatchObject({ totalRows: 1, geometry: { role: "derived" } });
    expect(session.presentable([String(overlap.resultId)])[0]?.displayLabel).toBe("面交集（僅面積部分）");
    const measured = await session.executeGeometry({ predicate: "measure_geometry", resultId: overlap.resultId });
    expect(measured).toMatchObject({ geometry: { type: "none", spatialAnalysisEligible: false }, units: { areaM2: "m²" } });
    expect(Number((measured.summary as Record<string, unknown>).areaM2)).toBeGreaterThan(0);
  });
  it("rejects display geometry and unknown options without silently coercing a new request", async () => {
    await expect(sessionWithLine("generalized").executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200 })).rejects.toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
    await expect(sessionWithLine().executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200, url: "https://example.org" })).rejects.toThrow("INVALID_INPUT");
  });
  it("chains a V03 corridor into the existing point-within surface query", async () => {
    const session = sessionWithLine();
    const store = (session as unknown as { store: { put(value: object): void } }).store;
    store.put({ resultId: "points", datasetId: "fixture-points", rows: [{ name: "inside", geometry: { type: "Point", coordinates: [120.442, 23.48] } }, { name: "outside", geometry: { type: "Point", coordinates: [120.47, 23.5] } }], recordGrain: "feature", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [], coverage: "two fixture points", freshness: "unknown", units: {} });
    const corridor = await session.executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200 });
    const selected = session.execute("spatial_query", { predicate: "within", pointResultId: "points", areaResultId: corridor.resultId, limit: 20 });
    expect(selected).toMatchObject({ totalRows: 1, rows: [{ name: "inside" }] });
  });
  it("does not revive results after the paired session was cleared during lazy loading", async () => {
    const session = sessionWithLine();
    const request = session.executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200 });
    session.clear();
    await expect(request).rejects.toThrow("SESSION_REVOKED");
    expect(session.execute("list_results", {})).toEqual({ results: [] });
  });
  it("flattens source contracts and geometry-operation audit so the unchanged transport guard accepts the receipt", async () => {
    const session = sessionWithLine();
    const buffer = await session.executeGeometry({ predicate: "line_buffer", resultId: "line", radiusM: 200 });
    const overlap = await session.executeGeometry({ predicate: "surface_intersection", leftResultId: buffer.resultId, rightResultId: buffer.resultId });
    const measured = await session.executeGeometry({ predicate: "measure_geometry", resultId: overlap.resultId });
    const transportReceipt = JSON.parse(JSON.stringify(measured)) as Record<string, unknown>;
    const sourceLineage = ((transportReceipt.lineage as { sourceInputs: Array<{ lineage: object }> }).sourceInputs[0]!).lineage;
    const legacyBufferLineage = { inputs: [{ resultId: "line", lineage: sourceLineage }] };
    const legacyIntersectionLineage = { inputs: [{ resultId: buffer.resultId, lineage: legacyBufferLineage }, { resultId: buffer.resultId, lineage: legacyBufferLineage }] };
    const legacyReceipt = { ...transportReceipt, lineage: { inputs: [{ resultId: overlap.resultId, lineage: legacyIntersectionLineage }] } };
    expect(validQueryResultData(legacyReceipt)).toBe(false);
    expect(validQueryResultData(transportReceipt)).toBe(true);
    expect(measured).toMatchObject({ sourceRefs: [expect.objectContaining({ sourceId: "fixture", version: "v1" })], lineage: {
      format: "bounded_geometry_v03_flat", datasets: ["fixture-line"], authorizedDatasetIds: ["fixture-line"], inputResultIds: [overlap.resultId],
      sourceInputs: [{ resultId: "line", lineage: { queryScope: { datasetId: "fixture-line", filters: [{ field: "route", op: "eq", value: "fixture" }], time: { start: "2026-09-01", end: "2026-09-24" } }, sourceContract: { datasetId: "fixture-line", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true } } } }],
    } });
    const trail = (measured.lineage as { operationTrail: Array<{ operation: string; inputResultIds: string[]; method: object }> }).operationTrail;
    expect(trail.map(entry => entry.operation)).toEqual(["line_buffer", "surface_intersection", "measure_geometry"]);
    expect(trail[0]).toMatchObject({ inputResultIds: ["line"], method: { operation: "buffer", radiusM: 200 } });
    expect(trail[1]?.inputResultIds).toEqual([buffer.resultId, buffer.resultId]);
    expect(trail[2]?.inputResultIds).toEqual([overlap.resultId]);
  });
  it("flattens mixed legacy inputs to the leaf source contract before a V03 operation", async () => {
    const session = sessionWithLine();
    const store = (session as unknown as { store: { put(value: object): void } }).store;
    const sourceLineage = { queryScope: { datasetId: "fixture-line", filters: [{ field: "route", op: "eq", value: "fixture" }], time: { start: "2026-09-01", end: "2026-09-24" } }, sourceContract: { datasetId: "fixture-line", recordGrain: "feature", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true } } };
    store.put({ resultId: "legacy-line", datasetId: "derived:legacy", rows: [{ geometry: { type: "LineString", coordinates: [[120.44, 23.48], [120.445, 23.48]] } }], recordGrain: "feature", geometry: { type: "LineString", role: "derived", spatialAnalysisEligible: true }, sourceRefs: [{ sourceId: "fixture", version: "v1", checksumSha256: "a".repeat(64), acquiredAt: "2026-09-24T00:00:00Z", reference: "/fixture" }], coverage: "fixture only", freshness: "unknown", units: {}, lineage: { inputs: [{ resultId: "legacy-intermediate", lineage: { inputs: [{ resultId: "line", lineage: sourceLineage }] } }] } });
    const buffer = await session.executeGeometry({ predicate: "line_buffer", resultId: "legacy-line", radiusM: 200 });
    expect(buffer.lineage).toMatchObject({ sourceInputs: [{ resultId: "line", lineage: sourceLineage }] });
    expect(JSON.stringify(buffer.lineage)).not.toContain("legacy-intermediate");
  });
  it("fails closed when flattened lineage item counts or metadata bytes exceed the V03 budget", async () => {
    const oversizedSources = sessionWithLine();
    const sourceStore = (oversizedSources as unknown as { store: { put(value: object): void } }).store;
    sourceStore.put({ resultId: "many-sources", datasetId: "fixture-line", rows: [{ geometry: { type: "LineString", coordinates: [[120.44, 23.48], [120.445, 23.48]] } }], recordGrain: "feature", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [], coverage: "fixture", freshness: "unknown", units: {}, lineage: { sourceInputs: Array.from({ length: 65 }, (_, index) => ({ resultId: `source-${index}`, lineage: { queryScope: { datasetId: "fixture-line" }, sourceContract: { geometry: { type: "LineString" } } } })) } });
    await expect(oversizedSources.executeGeometry({ predicate: "line_buffer", resultId: "many-sources", radiusM: 20 })).rejects.toThrow("LINEAGE_BUDGET_EXCEEDED");

    const oversizedTrail = sessionWithLine();
    const trailStore = (oversizedTrail as unknown as { store: { put(value: object): void } }).store;
    trailStore.put({ resultId: "many-operations", datasetId: "fixture-line", rows: [{ geometry: { type: "LineString", coordinates: [[120.44, 23.48], [120.445, 23.48]] } }], recordGrain: "feature", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [], coverage: "fixture", freshness: "unknown", units: {}, lineage: { operationTrail: Array.from({ length: 64 }, (_, index) => ({ resultId: `operation-${index}`, operation: "line_buffer", inputResultIds: ["line"], method: { operation: "buffer" } })) } });
    await expect(oversizedTrail.executeGeometry({ predicate: "line_buffer", resultId: "many-operations", radiusM: 20 })).rejects.toThrow("LINEAGE_BUDGET_EXCEEDED");

    const oversizedMetadata = sessionWithLine();
    const metadataStore = (oversizedMetadata as unknown as { store: { put(value: object): void } }).store;
    metadataStore.put({ resultId: "large-metadata", datasetId: "fixture-line", rows: [{ geometry: { type: "LineString", coordinates: [[120.44, 23.48], [120.445, 23.48]] } }], recordGrain: "feature", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [], coverage: "fixture", freshness: "unknown", units: {}, lineage: { queryScope: { datasetId: "fixture-line", parameters: { receipt: "x".repeat(33 * 1024) } }, sourceContract: { geometry: { type: "LineString" } } } });
    await expect(oversizedMetadata.executeGeometry({ predicate: "line_buffer", resultId: "large-metadata", radiusM: 20 })).rejects.toThrow("LINEAGE_BUDGET_EXCEEDED");
  });
});
