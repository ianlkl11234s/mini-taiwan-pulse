import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { waterDetentionBasinsAdapter, waterDetentionBasinsDescriptor } from "../waterDetentionBasinsDataset";

const display = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/public/geo/water_detention_basins.geojson";
const sidecar = "../runtime/owner-only/water-detention-basins/water-detention-basins-owner-20260511.geojson";
type Bbox = readonly [number, number, number, number];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("matches independent display bboxes in Tainan and Taoyuan plus a county variant", async () => {
  const source = JSON.parse(await readFile(display, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { county: string } }[] };
  const executor = new QueryExecutor([waterDetentionBasinsAdapter]);
  const cases: { bbox: Bbox; county?: string }[] = [
    { bbox: [120.24, 23.08, 120.29, 23.14] },
    { bbox: [121.35, 25.03, 121.41, 25.06], county: "taoyuan" },
  ];
  for (const item of cases) {
    const expected = source.features.filter(({ geometry: { coordinates: [lng, lat] }, properties }) => lng >= item.bbox[0] && lng <= item.bbox[2] && lat >= item.bbox[1] && lat <= item.bbox[3] && (!item.county || properties.county === item.county)).length;
    const result = await executor.execute({ datasetId: waterDetentionBasinsDescriptor.datasetId, bbox: item.bbox, filters: item.county ? [{ field: "county", op: "eq", value: item.county }] : [], select: ["basin_id", "name", "county", "area_m2", "geometry"], limit: 56 });
    expect(result.totalMatched).toBe(expected);
  }
});

it("keeps proxy geometry and source missingness out of nearest or capacity claims", async () => {
  expect(waterDetentionBasinsDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(waterDetentionBasinsDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "agency", "township", "status", "designed_volume_m3", "current_volume_m3", "max_depth_m"]));
  expect(waterDetentionBasinsDescriptor.valueSemantics.missing).toContain("桃園 11 筆");
});
