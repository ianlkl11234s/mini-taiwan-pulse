import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { welfareChildServicesOwnerAdapter, welfareChildServicesOwnerDescriptor } from "../welfareChildServicesOwnerDataset";

const asset = "../runtime/owner-only/welfare-child-services/welfare-child-services-owner-20260812.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("retains all 1,425 source rows including structural no-coordinate records", async () => {
  const executor = new QueryExecutor([welfareChildServicesOwnerAdapter]);
  const all = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, limit: 1 });
  const unlocated = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, filters: [{ field: "coord_status", op: "eq", value: "no_coord" }], select: ["uid", "coord_status", "coord_source", "geometry"], limit: 50 });
  const parentChild = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, filters: [{ field: "welfare_class", op: "eq", value: "parent_child_center" }], limit: 1 });
  expect(all).toMatchObject({ totalMatched: 1425, excludedByReason: { missing_geometry: 29, non_point_geometry: 0, invalid_geometry: 0 } });
  expect(unlocated.totalMatched).toBe(29);
  expect(unlocated.rows).toHaveLength(29);
  expect(unlocated.rows.every(row => row.coord_status === "no_coord" && row.coord_source === null && row.geometry === null)).toBe(true);
  expect(parentChild.totalMatched).toBe(196);
  expect(welfareChildServicesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "service_content", "service_hours"]));
});

it("bounds reference positions at two places and handles a coordinate-source variant", async () => {
  const executor = new QueryExecutor([welfareChildServicesOwnerAdapter]);
  const taipei = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, bbox: [121.50, 25.02, 121.56, 25.06], select: ["uid", "welfare_class", "geometry"], limit: 50 });
  const tainan = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, bbox: [120.17, 22.98, 120.24, 23.03], select: ["uid", "welfare_class", "geometry"], limit: 50 });
  const google = await executor.execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, filters: [{ field: "coord_source", op: "eq", value: "google" }], select: ["uid", "coord_source"], limit: 1 });
  expect(taipei.totalMatched).toBeGreaterThan(0);
  expect(tainan.totalMatched).toBeGreaterThan(0);
  expect(taipei.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(tainan.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(google).toMatchObject({ totalMatched: 146, rows: [{ coord_source: "google" }] });
  expect(welfareChildServicesOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
});

it("fails closed when owner-only sidecar bytes differ", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([welfareChildServicesOwnerAdapter]).execute({ datasetId: welfareChildServicesOwnerDescriptor.datasetId })).rejects.toThrow("WELFARE_CHILD_SERVICES_OWNER_SOURCE_SHA_MISMATCH");
});
