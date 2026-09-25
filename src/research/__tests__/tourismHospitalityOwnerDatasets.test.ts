import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";
import { tourismHotelOwnerAdapter, tourismHospitalityOwnerDescriptors, tourismRestaurantOwnerAdapter } from "../tourismHospitalityOwnerDatasets";

const sidecars = "../runtime/owner-only/tourism-hospitality/";
const prefix = "/__local-research-owner-only/tourism-hospitality/";
const upstream = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/tourism/";
const bboxes = { taipei: [121.50, 25.02, 121.57, 25.09] as const, kaohsiung: [120.27, 22.58, 120.36, 22.68] as const, taoyuan: [121.28, 24.97, 121.35, 25.04] as const, tainan: [120.16, 22.96, 120.25, 23.04] as const };
async function oracle(file: string, bbox: readonly [number, number, number, number]) {
  const data = JSON.parse(await readFile(`${upstream}${file}`, "utf8")) as { features: { geometry: { coordinates: [number, number] } }[] };
  return data.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]).length;
}
beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${sidecars}${url.slice(prefix.length)}`), { headers: { "content-type": "application/octet-stream" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bounded hospitality reads and removes address, phone, and descriptions", async () => {
  const executor = new QueryExecutor([tourismHotelOwnerAdapter, tourismRestaurantOwnerAdapter]);
  await expect(executor.execute({ datasetId: tourismHospitalityOwnerDescriptors[0]!.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  const hotels = await executor.execute({ datasetId: tourismHospitalityOwnerDescriptors[0]!.datasetId, bbox: bboxes.taipei, select: ["HotelID", "HotelStars", "LowestPrice", "geometry"], limit: 100 });
  const restaurants = await executor.execute({ datasetId: tourismHospitalityOwnerDescriptors[1]!.datasetId, bbox: bboxes.taoyuan, select: ["id", "name", "service_time", "geometry"], limit: 100 });
  expect(hotels.totalMatched).toBeGreaterThan(0); expect(restaurants.totalMatched).toBeGreaterThan(0);
  expect(tourismHospitalityOwnerDescriptors[0]!.fields.map(field => field.name)).not.toContain("address");
  expect(tourismHospitalityOwnerDescriptors[1]!.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "description"]));
  expect(hotels.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
});

it("matches fixed processed-source bbox oracles and keeps official Point semantics", async () => {
  const executor = new QueryExecutor([tourismHotelOwnerAdapter, tourismRestaurantOwnerAdapter]);
  const cases = [
    { datasetId: tourismHospitalityOwnerDescriptors[0]!.datasetId, file: "hotel/hotel_20260722.geojson", bbox: bboxes.taipei, expected: 522 },
    { datasetId: tourismHospitalityOwnerDescriptors[0]!.datasetId, file: "hotel/hotel_20260722.geojson", bbox: bboxes.kaohsiung, expected: 331 },
    { datasetId: tourismHospitalityOwnerDescriptors[1]!.datasetId, file: "restaurant/restaurant_20260723.geojson", bbox: bboxes.taoyuan, expected: 39 },
    { datasetId: tourismHospitalityOwnerDescriptors[1]!.datasetId, file: "restaurant/restaurant_20260723.geojson", bbox: bboxes.tainan, expected: 246 },
  ];
  for (const item of cases) {
    const result = await executor.execute({ datasetId: item.datasetId, bbox: item.bbox, select: ["record_id", "geometry"], limit: 100 });
    expect(await oracle(item.file, item.bbox)).toBe(item.expected); expect(result.totalMatched).toBe(item.expected);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
  expect(tourismHospitalityOwnerDescriptors.map(item => item.geometry)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "Point", role: "actual", spatialAnalysisEligible: true })]));
  expect(tourismHospitalityOwnerDescriptors[0]!.coverage).toContain("HotelStars=null");
  expect(tourismHospitalityOwnerDescriptors[0]!.coverage).toContain("LowestPrice=0");
});
