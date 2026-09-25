import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { busStationsCityOwnerAdapter, busStationsIntercityOwnerAdapter, busStationsOwnerDescriptors } from "../busStationsOwnerDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/bus-stations/";
const prefix = "/__local-research-owner-only/bus-stations/";
const upstream = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/bus/";
const bboxes = { taipei: [121.50, 25.02, 121.56, 25.08] as const, kaohsiung: [120.29, 22.61, 120.35, 22.67] as const };
async function rawOracle(file: string, bbox: readonly [number, number, number, number]): Promise<number> {
  const collection = JSON.parse(await readFile(`${upstream}${file}`, "utf8")) as { features: { geometry: { coordinates: [number, number] } }[] };
  return collection.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]; }).length;
}
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });
it("requires bounded bbox queries and keeps source-specific safe station fields", async () => {
  const executor = new QueryExecutor([busStationsCityOwnerAdapter, busStationsIntercityOwnerAdapter]);
  await expect(executor.execute({ datasetId: busStationsOwnerDescriptors[0]!.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  const city = await executor.execute({ datasetId: busStationsOwnerDescriptors[0]!.datasetId, bbox: bboxes.taipei, select: ["station_uid", "station_name", "geometry"], limit: 100 });
  const intercity = await executor.execute({ datasetId: busStationsOwnerDescriptors[1]!.datasetId, bbox: bboxes.kaohsiung, select: ["station_uid", "station_name", "geometry"], limit: 100 });
  expect(city.totalMatched).toBeGreaterThan(0); expect(intercity.totalMatched).toBeGreaterThan(0);
  expect(city.rows[0]).toHaveProperty("geometry.type", "Point"); expect(busStationsOwnerDescriptors[0]!.fields.map(field => field.name)).not.toContain("station_address");
  expect(city.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024); expect(intercity.cost.rowsScanned).toBeLessThanOrEqual(20_000);
});
it("matches full-source City and InterCity bbox oracles in Taipei and Kaohsiung", async () => {
  const executor = new QueryExecutor([busStationsCityOwnerAdapter, busStationsIntercityOwnerAdapter]);
  const cases = [
    { adapter: busStationsOwnerDescriptors[0]!, file: "bus_stations_city.geojson", bbox: bboxes.taipei, expected: 1_346 },
    { adapter: busStationsOwnerDescriptors[0]!, file: "bus_stations_city.geojson", bbox: bboxes.kaohsiung, expected: 942 },
    { adapter: busStationsOwnerDescriptors[1]!, file: "bus_stations_intercity.geojson", bbox: bboxes.taipei, expected: 214 },
    { adapter: busStationsOwnerDescriptors[1]!, file: "bus_stations_intercity.geojson", bbox: bboxes.kaohsiung, expected: 34 },
  ];
  for (const item of cases) {
    const raw = await rawOracle(item.file, item.bbox);
    const result = await executor.execute({ datasetId: item.adapter.datasetId, bbox: item.bbox, select: ["station_uid", "geometry"], limit: 100 });
    expect(raw).toBe(item.expected); expect(result.totalMatched).toBe(raw);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});
it("reads a manifest shard with all point semantics intact", async () => {
  const manifest = JSON.parse(await readFile(`${root}city/manifest.json`, "utf8")) as { shards: { path: string }[] }; const shard = JSON.parse(gunzipSync(await readFile(`${root}city/${manifest.shards[0]!.path}`)).toString("utf8")) as { features: unknown[] };
  expect(shard.features.length).toBeGreaterThan(0); expect(busStationsOwnerDescriptors).toHaveLength(2); expect(busStationsOwnerDescriptors.map(item => item.geometry.spatialAnalysisEligible)).toEqual([true, true]);
});
