import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import subset from "./fixtures/schools-grid-subset.json";
import { validateGridBundle } from "../gridDatasetAdapter";
import { ResearchAnalysisSession } from "../researchAnalysisSession";
import { installAnalysisResults, removeAnalysisResults } from "../analysisResultOverlay";
import type { Map as MapboxMap } from "mapbox-gl";

const pin = vi.hoisted(() => ({ bundleSha256: "0".repeat(64), bytes: 0 }));
vi.mock("../contracts/schools-grid-receipt.json", () => ({ default: pin }));

afterEach(() => vi.unstubAllGlobals());
it("rejects stale, mismatched versions, invalid counts and missing/suppressed counts instead of zero", () => {
  expect(validateGridBundle(subset).rows).toHaveLength(2);
  for (const change of [
    (b: typeof subset) => { b.asset.lifecycle = "stale"; },
    (b: typeof subset) => { b.geojson.features[0]!.properties.source_version = "wrong"; },
    (b: typeof subset) => { b.geojson.features[0]!.properties.metric_status = "suppressed"; },
    (b: typeof subset) => { b.geojson.features[0]!.properties.source_place_record_count = 0; },
    (b: typeof subset) => { b.summary.assigned_features++; },
    (b: typeof subset) => { b.gridDefinition.cell_size_m = 100; },
    (b: typeof subset) => { b.geojson.features[1]!.properties.grid_id = b.geojson.features[0]!.properties.grid_id; },
  ]) { const b = structuredClone(subset); change(b); expect(() => validateGridBundle(b)).toThrow(); }
});

async function roundTrip(body: string) {
  pin.bundleSha256 = createHash("sha256").update(body).digest("hex"); pin.bytes = Buffer.byteLength(body);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(body))));
  const session = new ResearchAnalysisSession();
  const query = await session.queryRecords({ datasetId: "tw-schools-grid-150m", limit: 1 });
  expect(query.returned).toBe(1);
  expect(query.displayTruncated).toBe(true);
  const resultId = String(query.resultId);
  const polygon = session.presentable([resultId]);
  expect(polygon[0]!.geometry).toMatchObject({ type: "Polygon", role: "generalized", spatialAnalysisEligible: false });
  expect(() => session.execute("spatial_query", { resultId, predicate: "nearest", center: [121.5,25] })).toThrow();
  expect(session.bounds([resultId])).toMatchObject({ pointCount: 0, featureCount: polygon[0]!.rows.length, vertexCount: polygon[0]!.rows.length * 5 });
  const sum = session.execute("aggregate_records", { resultId, operation: "sum", field: "source_place_record_count" });
  expect(sum.totalRows).toBe(1);
  expect(sum).toHaveProperty("lineage.inputs.0.lineage.gridDefinition.cell_size_m",150);
  expect(session.execute("get_record_evidence", { resultId, recordIndex: 0 })).toHaveProperty("lineage.gridDefinition.cell_size_m",150);
  expect(query.sourceRefs).toHaveLength(2);
  expect(session.execute("get_analysis_result", { resultId })).toHaveProperty("lineage.gridDefinition.cell_size_m",150);
  const sources = new Map(), layers = new Map();
  const map = { getSource: (id: string) => sources.get(id), addSource: (id: string, data: unknown) => sources.set(id, data), getLayer: (id: string) => layers.get(id), addLayer: (layer: { id: string }) => layers.set(layer.id, layer), removeLayer: (id: string) => layers.delete(id), removeSource: (id: string) => sources.delete(id), setPaintProperty: vi.fn() };
  installAnalysisResults(map as unknown as MapboxMap, polygon);
  expect([...layers.values()][0].type).toBe("fill");
  expect([...sources.values()][0].data.features.length).toBe(polygon[0]!.rows.length);
  removeAnalysisResults(map as unknown as MapboxMap); expect(layers.size).toBe(0); expect(sources.size).toBe(0);
  expect(session.hasResult(resultId)).toBe(true);
  session.execute("remove_result", { resultId }); expect(session.hasResult(resultId)).toBe(false);
  return { query, polygon, sum };
}
it("routes a real-source subset through datasetId → resultId → polygon and preserves lineage", async () => { await roundTrip(JSON.stringify(subset)); });
it.runIf(Boolean(process.env.PULSE_GRID_BUNDLE_PATH))("reads the complete real materialized schools artifact", async () => {
  const body = readFileSync(process.env.PULSE_GRID_BUNDLE_PATH!, "utf8");
  const { query, polygon, sum } = await roundTrip(body);
  expect(query.totalMatched).toBe(4061);
  expect(polygon[0]!.rows.reduce((n, r) => n + Number(r.source_place_record_count),0)).toBe(4315);
  expect(JSON.stringify(sum.rows)).toContain("4315");
});

it("rejects modified artifact bytes before treating the bundle as verified geometry", async () => {
  pin.bundleSha256 = "0".repeat(64); const body = JSON.stringify(subset); pin.bytes = Buffer.byteLength(body);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  await expect(new ResearchAnalysisSession().queryRecords({ datasetId: "tw-schools-grid-150m" })).rejects.toThrow("GRID_ARTIFACT_VERSION_MISMATCH");
});
