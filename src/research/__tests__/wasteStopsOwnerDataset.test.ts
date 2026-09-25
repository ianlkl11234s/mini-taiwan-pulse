import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";
import { wasteStopsOwnerAdapter, wasteStopsOwnerDescriptor } from "../wasteStopsOwnerDataset";

const root = "../runtime/owner-only/waste-stops/";
const prefix = "/__local-research-owner-only/waste-stops/";
const sourcePath = "public/geo/waste_stops_static.geojson";
const chiayi = [120.44, 23.44, 120.54, 23.54] as const;
type Bbox = readonly [number, number, number, number];
async function oracle(bbox: Bbox, via?: string): Promise<number> {
  const data = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { via: string } }[] };
  return data.features.filter(({ geometry: { coordinates: [lng, lat] }, properties }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && (via === undefined || properties.via === via)).length;
}
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires a bbox and exposes only safe owner-only proxy fields", async () => {
  const executor = new QueryExecutor([wasteStopsOwnerAdapter]);
  await expect(executor.execute({ datasetId: wasteStopsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(wasteStopsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(wasteStopsOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(wasteStopsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["id", "stop_name", "route_id", "route_name"]));
});

it("matches an independent Chiayi bbox and source-method variant oracle with bounded reads", async () => {
  const executor = new QueryExecutor([wasteStopsOwnerAdapter]);
  const all = await executor.execute({ datasetId: wasteStopsOwnerDescriptor.datasetId, bbox: chiayi, select: ["city", "via", "geometry"], limit: 100 });
  const tgosRound4 = await executor.execute({ datasetId: wasteStopsOwnerDescriptor.datasetId, bbox: chiayi, filters: [{ field: "via", op: "eq", value: "tgos_batch_v2_round4" }], select: ["via", "geometry"], limit: 100 });
  expect(await oracle(chiayi)).toBe(146); expect(all.totalMatched).toBe(146);
  expect(await oracle(chiayi, "tgos_batch_v2_round4")).toBe(95); expect(tgosRound4.totalMatched).toBe(95);
  expect(all.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(all.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(all.excludedByReason).toMatchObject({ government_open_data: 38_312, tgos: 30_938, poi_fallback: 1_135, legacy: 2_675 });
});

it("has only safe properties in the immutable partitions and fails closed for a nationwide scan", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const shard = JSON.parse(gunzipSync(await readFile(`${root}${manifest.shards[0]!.path}`)).toString("utf8")) as { features: { properties: Record<string, unknown> }[] };
  expect(Object.keys(shard.features[0]!.properties).sort()).toEqual(["city", "district", "routes_count", "vehicle_type", "via"]);
  await expect(new QueryExecutor([wasteStopsOwnerAdapter]).execute({ datasetId: wasteStopsOwnerDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});
