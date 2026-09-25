import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache, groundwaterWellsOwnerAdapter, groundwaterWellsOwnerDescriptor } from "../groundwaterWellsOwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/groundwater-wells/";
const prefix = "/__local-research-owner-only/groundwater-wells/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/water_resources/groundwater/groundwater_wells.geojson";
const p42MonitorPath = "../runtime/owner-only/water-monitor-stations/water-monitor-stations-owner-20260519.geojson";
type Bbox = readonly [number, number, number, number];

async function oracle(bbox: Bbox): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  return source.features.filter((feature: { geometry: { coordinates: [number, number] } }) => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
  }).length;
}
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox and keeps the live groundwater layer out of scope", async () => {
  const executor = new QueryExecutor([groundwaterWellsOwnerAdapter]);
  await expect(executor.execute({ datasetId: groundwaterWellsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(groundwaterWellsOwnerDescriptor.layerRefs).toEqual(["groundwaterWells"]);
  expect(groundwaterWellsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(groundwaterWellsOwnerDescriptor.supportedOperations).toEqual(["query_records"]);
});

it("matches two new-city source oracles and preserves known false/null semantics", async () => {
  const executor = new QueryExecutor([groundwaterWellsOwnerAdapter]);
  for (const [bbox, expected] of [[[120.30, 23.35, 120.55, 23.60], 32], [[121.55, 24.55, 121.85, 24.85], 39]] as const) {
    const result = await executor.execute({ datasetId: groundwaterWellsOwnerDescriptor.datasetId, bbox, select: ["well_id", "reported_county", "is_active", "elevation_m"], limit: 100 });
    expect(await oracle(bbox)).toBe(expected); expect(result.totalMatched).toBe(expected);
    expect(result.rows.every(row => row.is_active === false && row.elevation_m === null)).toBe(true);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(959); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("does not allow provenance county to become a geographic comparison filter or aggregate", async () => {
  const executor = new QueryExecutor([groundwaterWellsOwnerAdapter]);
  await expect(executor.execute({ datasetId: groundwaterWellsOwnerDescriptor.datasetId, bbox: [120.30, 23.35, 120.55, 23.60], filters: [{ field: "reported_county", op: "eq", value: "嘉義縣" }] })).rejects.toThrow("FILTER_NOT_ALLOWED");
  expect(groundwaterWellsOwnerDescriptor.supportedOperations).not.toContain("aggregate");
});

it("matches P42's 959-record groundwater subset without using the 2,032-record union as this reader source", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const p42 = JSON.parse(await readFile(p42MonitorPath, "utf8"));
  const expected = new Map(source.features.map((feature: { properties: { id: string; name: string }; geometry: { coordinates: [number, number] } }) => [feature.properties.id, [feature.properties.name, feature.geometry.coordinates]]));
  const observed = p42.features.filter((feature: { properties: { station_type: string } }) => feature.properties.station_type === "groundwater_well");
  expect(observed).toHaveLength(959);
  const actual = new Map(observed.map((feature: { properties: { station_id: string; name: string }; geometry: { coordinates: [number, number] } }) =>
    [feature.properties.station_id, [feature.properties.name, feature.geometry.coordinates]]));
  expect(actual).toEqual(expected);
});
