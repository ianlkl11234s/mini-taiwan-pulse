import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { factoryLocationsOwnerAdapter, factoryLocationsOwnerDescriptor } from "../factoryLocationsOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/factory-locations/";
const prefix = "/__local-research-owner-only/factory-locations/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/business_registry/factory_locations/factory_locations_202606.geojson";
type Bbox = readonly [number, number, number, number];

async function rawOracle(bbox: Bbox, filters: Readonly<{ county?: string; industryIncludes?: string }>): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { county: string; industry_categories: string } }[] };
  return source.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
      && (filters.county === undefined || feature.properties.county === filters.county)
      && (filters.industryIncludes === undefined || feature.properties.industry_categories.includes(filters.industryIncludes));
  }).length;
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox and keeps only safe fields with reference-point semantics", async () => {
  const executor = new QueryExecutor([factoryLocationsOwnerAdapter]);
  await expect(executor.execute({ datasetId: factoryLocationsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(factoryLocationsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(factoryLocationsOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(factoryLocationsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["uniform_no", "factory_address", "responsible_person"]));
});

it.skipIf(!existsSync(`${root}manifest.json`))("reads immutable safe shards and preserves the active geocode-miss exclusion", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const shard = JSON.parse(gunzipSync(await readFile(`${root}${manifest.shards[0]!.path}`)).toString("utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { factory_id: string; factory_name: string } }[] };
  const target = shard.features[0]!; const [lng, lat] = target.geometry.coordinates;
  const result = await new QueryExecutor([factoryLocationsOwnerAdapter]).execute({ datasetId: factoryLocationsOwnerDescriptor.datasetId, bbox: [lng, lat, lng, lat], filters: [{ field: "factory_id", op: "eq", value: target.properties.factory_id }], limit: 100 });
  expect(result.rows[0]).toMatchObject({ factory_id: target.properties.factory_id, factory_name: target.properties.factory_name, geometry: { type: "Point", coordinates: [lng, lat] } });
  expect(result.excludedByReason).toMatchObject({ geocode_miss_active: 9_972 });
  expect(result.cost.downloadedBytes).toBeLessThan(8 * 1024 * 1024);
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches independent full-source location and category oracles within bounded reads", async () => {
  const cases: { bbox: Bbox; filters: { county?: string; industryIncludes?: string }; expected: number }[] = [
    { bbox: [121.45, 24.98, 121.50, 25.03], filters: { county: "新北市", industryIncludes: "26電子" }, expected: 420 },
    { bbox: [120.25, 22.55, 120.30, 22.60], filters: { county: "高雄市", industryIncludes: "25金屬製品製造業" }, expected: 9 },
  ];
  const executor = new QueryExecutor([factoryLocationsOwnerAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.bbox, item.filters);
    const filters = [
      ...(item.filters.county ? [{ field: "county", op: "eq" as const, value: item.filters.county }] : []),
      ...(item.filters.industryIncludes ? [{ field: "industry_categories", op: "contains" as const, value: item.filters.industryIncludes }] : []),
    ];
    const result = await executor.execute({ datasetId: factoryLocationsOwnerDescriptor.datasetId, bbox: item.bbox, filters, select: ["factory_id", "industry_categories", "geometry"], limit: 100 });
    expect(oracle).toBe(item.expected); expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
}, 60_000);

it.skipIf(!existsSync(`${root}manifest.json`))("fails closed when a broad bbox selects more than the 8 MiB partition budget", async () => {
  await expect(new QueryExecutor([factoryLocationsOwnerAdapter]).execute({ datasetId: factoryLocationsOwnerDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});
