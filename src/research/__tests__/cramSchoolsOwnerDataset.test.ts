import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cramSchoolsOwnerAdapter, cramSchoolsOwnerDescriptor } from "../cramSchoolsOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/cram-schools/";
const prefix = "/__local-research-owner-only/cram-schools/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/education/cram_schools/cram_schools_20260807.geojson";
type Bbox = readonly [number, number, number, number];

async function oracle(bbox: Bbox, category?: string): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { [key: string]: string } }[] };
  return source.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && (category === undefined || feature.properties["短期補習班類別"] === category); }).length;
}

beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it.skipIf(!existsSync(`${root}manifest-receipt.json`))("keeps only safe fields and records source, missingness, precision, and proxy limits", async () => {
  const receipt = JSON.parse(await readFile(`${root}manifest-receipt.json`, "utf8"));
  expect(receipt).toMatchObject({ source: { sha256: "adf0dddc81dc6ba30ff71c72242b4263b5a3896b7faffd40cead7ee24711af4e", featureCount: 17137 }, raw: { rows: 17772 }, geocodeMissing: 635, precisionCounts: { exact: 10100, cached: 2831, tgos: 4129, interpolated: 77 } });
  expect(receipt.excludedFields).toEqual(expect.arrayContaining(["短期補習班名稱", "地址", "電子郵件"]));
  expect(cramSchoolsOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(cramSchoolsOwnerDescriptor.supportedOperations).not.toContain("nearest");
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches two independent city bbox oracles and a category variant within bounds", async () => {
  const executor = new QueryExecutor([cramSchoolsOwnerAdapter]);
  const cases = [
    { bbox: [121.48, 25.02, 121.58, 25.10] as const, category: "文理類" },
    { bbox: [120.28, 22.56, 120.38, 22.67] as const },
  ];
  for (const item of cases) {
    const result = await executor.execute({ datasetId: cramSchoolsOwnerDescriptor.datasetId, bbox: item.bbox, filters: item.category ? [{ field: "category", op: "eq", value: item.category }] : [], select: ["county", "category", "geocode_precision"], limit: 1 });
    expect(result.totalMatched).toBe(await oracle(item.bbox, item.category));
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(10_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("requires bbox and fails closed for an oversized broad request", async () => {
  const executor = new QueryExecutor([cramSchoolsOwnerAdapter]);
  await expect(executor.execute({ datasetId: cramSchoolsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  await expect(executor.execute({ datasetId: cramSchoolsOwnerDescriptor.datasetId, bbox: [118, 21.5, 122.5, 26.5], limit: 1 })).rejects.toThrow();
});
