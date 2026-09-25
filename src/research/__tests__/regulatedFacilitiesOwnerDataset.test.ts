import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { regulatedFacilitiesOwnerAdapter, regulatedFacilitiesOwnerDescriptor } from "../regulatedFacilitiesOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";

const root = "../runtime/owner-only/regulated-facilities/";
const prefix = "/__local-research-owner-only/regulated-facilities/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/business_registry/regulated_facilities/regulated_facilities_20260818.geojson";
type Bbox = readonly [number, number, number, number];

async function rawOracle(bbox: Bbox, filters: Readonly<{ county?: string; industryGroup?: string; iswaste?: number }>): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { county: string; industry_group: string; iswaste: number } }[] };
  return source.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
      && (filters.county === undefined || feature.properties.county === filters.county)
      && (filters.industryGroup === undefined || feature.properties.industry_group === filters.industryGroup)
      && (filters.iswaste === undefined || feature.properties.iswaste === filters.iswaste);
  }).length;
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox, retains safe attributes, and states proxy geometry", async () => {
  const executor = new QueryExecutor([regulatedFacilitiesOwnerAdapter]);
  await expect(executor.execute({ datasetId: regulatedFacilitiesOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(regulatedFacilitiesOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(regulatedFacilitiesOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(regulatedFacilitiesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["emsno", "facility_name", "facility_address", "uniform_no", "company_name"]));
  expect(regulatedFacilitiesOwnerDescriptor.coverage).toContain("63.17%");
  expect(regulatedFacilitiesOwnerDescriptor.coverage).toContain("50.01% 是 company join");
});

it("preserves active coordinate misses and strips direct facility identifiers", async () => {
  const result = await new QueryExecutor([regulatedFacilitiesOwnerAdapter]).execute({ datasetId: regulatedFacilitiesOwnerDescriptor.datasetId, bbox: [121.54, 24.97, 121.57, 25.00], limit: 1 });
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ geometry: { type: "Point" } });
  expect(result.rows[0]).not.toEqual(expect.objectContaining({ emsno: expect.anything(), facility_name: expect.anything(), facility_address: expect.anything() }));
  expect(result.excludedByReason).toMatchObject({ active_facility_coordinate_miss: 47_063 });
});

it("matches two full-source bbox and attribute oracles within bounded reads", async () => {
  const cases: { bbox: Bbox; filters: { county?: string; industryGroup?: string; iswaste?: number } }[] = [
    { bbox: [121.45, 24.98, 121.50, 25.03], filters: { county: "新北市", industryGroup: "25" } },
    { bbox: [120.25, 22.55, 120.30, 22.60], filters: { county: "高雄市", iswaste: 1 } },
  ];
  const executor = new QueryExecutor([regulatedFacilitiesOwnerAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.bbox, item.filters);
    const filters = [
      ...(item.filters.county ? [{ field: "county", op: "eq" as const, value: item.filters.county }] : []),
      ...(item.filters.industryGroup ? [{ field: "industry_group", op: "eq" as const, value: item.filters.industryGroup }] : []),
      ...(item.filters.iswaste === undefined ? [] : [{ field: "iswaste", op: "eq" as const, value: item.filters.iswaste }]),
    ];
    const result = await executor.execute({ datasetId: regulatedFacilitiesOwnerDescriptor.datasetId, bbox: item.bbox, filters, select: ["county", "industry_group", "iswaste", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("fails closed when a broad bbox selects more than the partition byte budget", async () => {
  await expect(new QueryExecutor([regulatedFacilitiesOwnerAdapter]).execute({ datasetId: regulatedFacilitiesOwnerDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});
