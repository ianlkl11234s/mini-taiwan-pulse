import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { funeralFacilitiesOwnerAdapter, funeralFacilitiesOwnerDescriptor, funeralOperatorsOwnerAdapter, funeralOperatorsOwnerDescriptor } from "../funeralPointsOwnerDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/funeral-points/";
const prefix = "/__local-research-owner-only/funeral-points/";
const analytics = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/funeral/";
const sources = {
  facilities: `${analytics}funeral_facilities_moi/funeral_facilities_moi_20260805.geojson`,
  operators: `${analytics}funeral_operators_biz/funeral_operators_biz_20260805.geojson`,
} as const;
type Bbox = readonly [number, number, number, number];

async function rawOracle(source: string, bbox: Bbox, field: string, value: string | boolean): Promise<number> {
  const collection = JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }[] };
  return collection.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && feature.properties[field] === value;
  }).length;
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox, exposes only safe fields, and holds exact spatial claims", async () => {
  const executor = new QueryExecutor([funeralFacilitiesOwnerAdapter, funeralOperatorsOwnerAdapter]);
  await expect(executor.execute({ datasetId: funeralFacilitiesOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  await expect(executor.execute({ datasetId: funeralOperatorsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(funeralFacilitiesOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(funeralOperatorsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(funeralFacilitiesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address_raw", "phone"]));
  expect(funeralOperatorsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["uniform_id", "address_raw", "address_norm", "capital", "permit_no"]));
  expect(funeralFacilitiesOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(funeralOperatorsOwnerDescriptor.supportedOperations).not.toContain("nearest");
});

it.skipIf(!existsSync(`${root}facilities/manifest.json`))("matches independent Taipei and Kaohsiung source oracles through bounded safe reads", async () => {
  const cases = [
    { adapter: funeralFacilitiesOwnerAdapter, descriptor: funeralFacilitiesOwnerDescriptor, source: sources.facilities, bbox: [121.48, 25.02, 121.58, 25.10] as const, field: "facility_type", value: "cemetery", expected: 15 },
    { adapter: funeralFacilitiesOwnerAdapter, descriptor: funeralFacilitiesOwnerDescriptor, source: sources.facilities, bbox: [120.25, 22.58, 120.35, 22.68] as const, field: "facility_type", value: "funeral_home", expected: 2 },
    { adapter: funeralOperatorsOwnerAdapter, descriptor: funeralOperatorsOwnerDescriptor, source: sources.operators, bbox: [121.48, 25.02, 121.58, 25.10] as const, field: "is_active", value: "True", expected: 256 },
    { adapter: funeralOperatorsOwnerAdapter, descriptor: funeralOperatorsOwnerDescriptor, source: sources.operators, bbox: [120.25, 22.58, 120.35, 22.68] as const, field: "is_active", value: "True", expected: 321 },
  ] as const;
  for (const item of cases) {
    const oracle = await rawOracle(item.source, item.bbox, item.field, item.value);
    const result = await new QueryExecutor([item.adapter]).execute({ datasetId: item.descriptor.datasetId, bbox: item.bbox, filters: [{ field: item.field, op: "eq", value: item.value }], select: [item.field, "geometry"], limit: 100 });
    expect(oracle).toBe(item.expected); expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it.skipIf(!existsSync(`${root}facilities/manifest.json`))("preserves explicit coverage, inactive, unlocated, and coordinate-right exclusions", async () => {
  const facilities = await new QueryExecutor([funeralFacilitiesOwnerAdapter]).execute({ datasetId: funeralFacilitiesOwnerDescriptor.datasetId, bbox: [121.48, 25.02, 121.58, 25.10], limit: 1 });
  const operators = await new QueryExecutor([funeralOperatorsOwnerAdapter]).execute({ datasetId: funeralOperatorsOwnerDescriptor.datasetId, bbox: [120.25, 22.58, 120.35, 22.68], limit: 1 });
  expect(facilities.excludedByReason).toMatchObject({ unlocated_source_records: 438, parcel_centroid_proxy: 1576, approximate_proxy: 429, google_coordinate_rights_unverified: 574 });
  expect(operators.excludedByReason).toMatchObject({ inactive_registration_records: 1664, google_coordinate_rights_unverified: 48 });
  expect(funeralFacilitiesOwnerDescriptor.license).toContain("unverified"); expect(funeralOperatorsOwnerDescriptor.license).toContain("unverified");
});

it.skipIf(!existsSync(`${root}operators/manifest.json`))("keeps nationwide reads within the declared partition scan and byte budgets", async () => {
  const result = await new QueryExecutor([funeralOperatorsOwnerAdapter]).execute({ datasetId: funeralOperatorsOwnerDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 });
  expect(result.totalMatched).toBe(6233); expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
});
