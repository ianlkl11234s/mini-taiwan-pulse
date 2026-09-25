import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { companyPointsAdapter, companyPointsDescriptor, manufacturingCompanyPointsAdapter, manufacturingCompanyPointsDescriptor } from "../companyPointsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/point-partitions/company-points/";
const prefix = "/__local-research-point-partitions/company-points/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/intermediate/business_registry/company_points/company_points.geojsonseq";

function haversineMeters([lng1, lat1]: readonly [number, number], [lng2, lat2]: readonly [number, number]): number {
  const radians = Math.PI / 180, radius = 6_371_008.8;
  const dLat = (lat2 - lat1) * radians, dLng = (lng2 - lng1) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

async function rawOracle(center: readonly [number, number], radiusMeters: number): Promise<{ total: number; manufacturing: number }> {
  let total = 0, manufacturing = 0;
  for await (const line of createInterface({ input: createReadStream(sourcePath, "utf8"), crlfDelay: Infinity })) {
    const feature = JSON.parse(line) as { geometry: { coordinates: [number, number] }; properties: { is_manufacturing: number } };
    if (haversineMeters(center, feature.geometry.coordinates) <= radiusMeters) { total++; manufacturing += feature.properties.is_manufacturing; }
  }
  return { total, manufacturing };
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const bytes = new Uint8Array(await readFile(`${root}${url.slice(prefix.length)}`));
    return new Response(bytes, { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires a bounded read and keeps the company public-field and registered-address contract", async () => {
  const executor = new QueryExecutor([companyPointsAdapter]);
  expect(companyPointsDescriptor.access.query.supportsBbox).toBe(true);
  expect(companyPointsDescriptor.fields.map(field => field.name)).not.toContain("tax_id");
  expect(companyPointsDescriptor.fields.map(field => field.name)).not.toContain("address");
  expect(companyPointsDescriptor.fields.map(field => field.name)).not.toContain("responsible_person");
  expect(companyPointsDescriptor.geometry.precision).toContain("營業地址");
  await expect(executor.execute({ datasetId: companyPointsDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
});

it("reads only immutable shards for an exact bounded point and retains source exclusions", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const shard = JSON.parse(gunzipSync(await readFile(`${root}${manifest.shards[0]!.path}`)).toString("utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { company_name: string } }[] };
  const target = shard.features[0]!;
  const [lng, lat] = target.geometry.coordinates;
  const executor = new QueryExecutor([companyPointsAdapter]);
  const result = await executor.execute({ datasetId: companyPointsDescriptor.datasetId, bbox: [lng, lat, lng, lat], filters: [{ field: "company_name", op: "eq", value: target.properties.company_name }] });
  expect(result.totalMatched).toBeGreaterThanOrEqual(1);
  expect(result.rows[0]).toMatchObject({ company_name: target.properties.company_name, geometry: { type: "Point", coordinates: [lng, lat] } });
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: "d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b" });
  expect(result.excludedByReason).toMatchObject({ dead_or_abnormal: 1152, invalid_coordinate_after_status_exclusion: 2565 });
  expect(result.cost.downloadedBytes).toBeLessThan(8 * 1024 * 1024);
});

it.skipIf(!existsSync(sourcePath))("matches the full-source 2 km and manufacturing oracles in Hualien and Taitung with bounded cold/warm reads", async () => {
  const cases = [
    { center: [121.60, 23.99] as const, bbox: [121.58, 23.972, 121.62, 24.008] as const, expected: { total: 1257, manufacturing: 190 } },
    { center: [121.15, 22.76] as const, bbox: [121.13, 22.742, 121.17, 22.778] as const, expected: { total: 658, manufacturing: 163 } },
  ];
  const executor = new QueryExecutor([companyPointsAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.center, 2_000);
    const input = { datasetId: companyPointsDescriptor.datasetId, bbox: item.bbox, select: ["record_id", "is_manufacturing", "geometry"] as const, limit: 100 };
    const cold = await executor.executeDetailed(input);
    const warm = await executor.executeDetailed(input);
    const within = cold.materializedRows.filter(row => haversineMeters(item.center, (row.geometry as { coordinates: [number, number] }).coordinates) <= 2_000);
    expect(oracle).toEqual(item.expected);
    expect({ total: within.length, manufacturing: within.reduce((sum, row) => sum + Number(row.is_manufacturing), 0) }).toEqual(oracle);
    expect(cold.envelope.cost.downloadedBytes).toBeLessThan(8 * 1024 * 1024);
    expect(cold.envelope.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(warm.envelope.cost).toMatchObject({ downloadedBytes: 0, requests: 0, cacheHit: true });
    expect(cold.envelope.displayTruncated).toBe(true);
  }
}, 15_000);

it("keeps a dense Kaohsiung bbox below the scan and byte limits", async () => {
  // Independent one-pass count from the fixed full GeoJSONSeq: 5,299 points.
  const result = await new QueryExecutor([companyPointsAdapter]).execute({
    datasetId: companyPointsDescriptor.datasetId,
    bbox: [120.29, 22.61, 120.31, 22.63],
    select: ["is_manufacturing", "geometry"], limit: 100,
  });
  expect(result.totalMatched).toBe(5_299);
  expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
  expect(result.cost.bytesScanned).toBeLessThan(8 * 1024 * 1024);
});

it.skipIf(!existsSync(sourcePath))("keeps the exact-C manufacturing subset in two independent places", async () => {
  const executor = new QueryExecutor([manufacturingCompanyPointsAdapter]);
  for (const item of [
    { center: [121.60, 23.99] as const, bbox: [121.58, 23.972, 121.62, 24.008] as const, manufacturing: 190 },
    { center: [121.15, 22.76] as const, bbox: [121.13, 22.742, 121.17, 22.778] as const, manufacturing: 163 },
  ]) {
    const oracle = await rawOracle(item.center, 2_000);
    const result = await executor.executeDetailed({ datasetId: manufacturingCompanyPointsDescriptor.datasetId, bbox: item.bbox, select: ["record_id", "is_manufacturing", "geometry"], limit: 100 });
    const within = result.materializedRows.filter(row => haversineMeters(item.center, (row.geometry as { coordinates: [number, number] }).coordinates) <= 2_000);
    expect(oracle.manufacturing).toBe(item.manufacturing);
    expect(within.length).toBe(item.manufacturing);
    expect(result.materializedRows.every(row => row.is_manufacturing === 1)).toBe(true);
    expect(result.envelope.sourceRefs[0]?.checksumSha256).toBe("d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b");
  }
  await expect(executor.execute({ datasetId: manufacturingCompanyPointsDescriptor.datasetId, limit: 1 })).rejects.toThrow("BBOX_REQUIRED");
}, 30_000);
