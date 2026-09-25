import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireStationsOwnerAdapter, fireStationsOwnerDescriptor } from "../fireStationsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const asset = "../runtime/owner-only/fire-stations/fire-stations-source-20260710.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps all 717 source rows with coordinate provenance, without address or phone", async () => {
  const executor = new QueryExecutor([fireStationsOwnerAdapter]);
  const all = await executor.execute({ datasetId: fireStationsOwnerDescriptor.datasetId, limit: 1 });
  const google = await executor.execute({ datasetId: fireStationsOwnerDescriptor.datasetId, filters: [{ field: "geocoding_source", op: "eq", value: "google" }], select: ["station_id", "geocoding_precision", "geometry"], limit: 1 });
  const official = await executor.execute({ datasetId: fireStationsOwnerDescriptor.datasetId, filters: [{ field: "geocoding_source", op: "eq", value: "official_dataset" }], select: ["station_id", "geocoding_precision", "geometry"], limit: 1 });
  const failBbox = await executor.execute({ datasetId: fireStationsOwnerDescriptor.datasetId, filters: [{ field: "geocoding_precision", op: "eq", value: "FAIL_BBOX" }], select: ["station_id", "geocoding_precision"], limit: 20 });
  expect(all).toMatchObject({ totalMatched: 717, excludedByReason: { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 } });
  expect(google).toMatchObject({ totalMatched: 413, rows: [{ geometry: { type: "Point" } }] });
  expect(official).toMatchObject({ totalMatched: 304, rows: [{ geocoding_precision: null, geometry: { type: "Point" } }] });
  expect(failBbox.totalMatched).toBe(10);
  expect(failBbox.rows.every(row => row.geocoding_precision === "FAIL_BBOX")).toBe(true);
  expect(fireStationsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone"]));
});

it("allows bounded reference-position lookup but excludes nearby analysis", async () => {
  const executor = new QueryExecutor([fireStationsOwnerAdapter]);
  const result = await executor.execute({ datasetId: fireStationsOwnerDescriptor.datasetId, bbox: [121.50, 25.03, 121.54, 25.05], select: ["station_id", "name", "geometry"], limit: 50 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(fireStationsOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
});

it("fails closed if local sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([fireStationsOwnerAdapter]).execute({ datasetId: fireStationsOwnerDescriptor.datasetId })).rejects.toThrow("FIRE_STATIONS_OWNER_SOURCE_SHA_MISMATCH");
});
