import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { railStationsMetroOwnerAdapter, railStationsMetroOwnerDescriptor, railStationsTHSROwnerAdapter, railStationsTHSROwnerDescriptor, railStationsTRAOwnerAdapter, railStationsTRAOwnerDescriptor } from "../railStationsOwnerDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const asset = "../runtime/owner-only/rail-stations/rail-stations-owner-20260529.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps the 12 THSR, 244 TRA, and 279 metro or light-rail records separate", async () => {
  const executor = new QueryExecutor([railStationsTHSROwnerAdapter, railStationsTRAOwnerAdapter, railStationsMetroOwnerAdapter]);
  const thsr = await executor.execute({ datasetId: railStationsTHSROwnerDescriptor.datasetId, limit: 1 });
  const tra = await executor.execute({ datasetId: railStationsTRAOwnerDescriptor.datasetId, filters: [{ field: "station_class", op: "eq", value: "0" }], select: ["system_id", "station_id", "name", "geometry"], limit: 20 });
  const metro = await executor.execute({ datasetId: railStationsMetroOwnerDescriptor.datasetId, filters: [{ field: "system_id", op: "eq", value: "krtc" }], select: ["system_id", "station_id", "geometry"], limit: 50 });
  expect(thsr).toMatchObject({ totalMatched: 12, excludedByReason: { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 } });
  expect(tra.totalMatched).toBeGreaterThan(0);
  expect(tra.rows.every(row => row.system_id === "tra" && (row.geometry as { type?: string }).type === "Point")).toBe(true);
  expect(metro).toMatchObject({ totalMatched: 39 });
  expect(metro.rows.every(row => row.system_id === "krtc")).toBe(true);
});

it("uses actual point geometry for bounded station lookup and does not expose source address fields", async () => {
  const executor = new QueryExecutor([railStationsTRAOwnerAdapter]);
  const result = await executor.execute({ datasetId: railStationsTRAOwnerDescriptor.datasetId, bbox: [121.50, 25.03, 121.61, 25.06], select: ["name", "geometry"], limit: 50 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.rows.every(row => (row.geometry as { type?: string }).type === "Point")).toBe(true);
  expect(railStationsTRAOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "name_en", "lat", "lng"]));
  expect(railStationsTHSROwnerDescriptor.access.mode).toBe("owner_only");
  expect(railStationsMetroOwnerDescriptor.geometry).toMatchObject({ role: "actual", spatialAnalysisEligible: true });
});

it("fails closed if the local sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([railStationsTHSROwnerAdapter]).execute({ datasetId: railStationsTHSROwnerDescriptor.datasetId })).rejects.toThrow("RAIL_STATIONS_OWNER_SOURCE_SHA_MISMATCH");
});
