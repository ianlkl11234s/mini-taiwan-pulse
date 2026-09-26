import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";
import { religionTemplesOwnerAdapter, religionTemplesOwnerDescriptor } from "../religionTemplesOwnerDataset";

const root = "../runtime/owner-only/religion-temples/";
const prefix = "/__local-research-owner-only/religion-temples/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/religion/temples/temples_20260801.geojson";
type Bbox = readonly [number, number, number, number];
type Variant = Readonly<{ source?: string; registration_type?: string | null }>;
async function oracle(bbox: Bbox, variant: Variant = {}): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { source: string; registration_type: string | null } }[] };
  return source.features.filter(({ geometry: { coordinates: [lng, lat] }, properties }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
    && (variant.source === undefined || properties.source === variant.source) && (variant.registration_type === undefined || properties.registration_type === variant.registration_type)).length;
}
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox and exposes only the safe owner-only proxy schema", async () => {
  const executor = new QueryExecutor([religionTemplesOwnerAdapter]);
  await expect(executor.execute({ datasetId: religionTemplesOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(religionTemplesOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(religionTemplesOwnerDescriptor.supportedOperations).not.toEqual(expect.arrayContaining(["nearest", "counties"]));
  expect(religionTemplesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["name", "address", "phone", "principal", "moi_id", "_provenance", "source_url"]));
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches the Tainan full-source MOI registration variant oracle", async () => {
  const executor = new QueryExecutor([religionTemplesOwnerAdapter]);
  const tainan = [120.3, 23.3, 120.5, 23.5] as const;
  const moi = await executor.execute({ datasetId: religionTemplesOwnerDescriptor.datasetId, bbox: tainan, filters: [{ field: "source", op: "eq", value: "moi_temple_xml" }, { field: "registration_type", op: "eq", value: "補辦登記" }], select: ["source", "registration_type", "coord_source", "geometry"], limit: 100 });
  expect(await oracle(tainan, { source: "moi_temple_xml", registration_type: "補辦登記" })).toBe(moi.totalMatched);
  expect(moi.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(moi.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches the Kaohsiung full-source OSM null-registration variant oracle", async () => {
  const executor = new QueryExecutor([religionTemplesOwnerAdapter]);
  const kaohsiung = [120.2, 22.55, 120.4, 22.7] as const;
  const osm = await executor.execute({ datasetId: religionTemplesOwnerDescriptor.datasetId, bbox: kaohsiung, filters: [{ field: "source", op: "eq", value: "osm_overpass" }], select: ["source", "registration_type", "deity_family", "geometry"], limit: 100 });
  expect(await oracle(kaohsiung, { source: "osm_overpass" })).toBe(osm.totalMatched);
  expect(osm.rows).toHaveLength(osm.totalMatched); expect(osm.rows.every(row => row.registration_type === null)).toBe(true);
  expect(osm.excludedByReason).toMatchObject({ unresolved_source_coordinate: 2 });
});

it.skipIf(!existsSync(`${root}manifest.json`))("keeps nullable safe fields in immutable gzip shards and bounds a nationwide read", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string; featureCount: number }[] };
  const shard = JSON.parse(gunzipSync(await readFile(`${root}${manifest.shards[0]!.path}`)).toString("utf8")) as { features: { properties: Record<string, unknown> }[] };
  expect(Object.keys(shard.features[0]!.properties).sort()).toEqual(["coord_source", "deity_family", "entity_id", "geocode_precision", "heritage_flag", "in_moi_registry", "is_top100", "registration_type", "religion_type", "source"]);
  expect(manifest.shards.reduce((sum, entry) => sum + entry.featureCount, 0)).toBe(19_201);
  const nationwide = await new QueryExecutor([religionTemplesOwnerAdapter]).execute({ datasetId: religionTemplesOwnerDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 });
  expect(nationwide.totalMatched).toBe(19_200); expect(nationwide.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(nationwide.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
});
