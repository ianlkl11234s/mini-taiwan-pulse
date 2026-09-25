import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { aquacultureZoneOwnerAdapter, aquacultureZoneOwnerDescriptor } from "../aquacultureZoneOwnerDataset";

const path = `${process.cwd()}/../runtime/owner-only/aquaculture-zone/aquaculture-zone.geojson`;
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/agriculture/aquaculture_production_zone/aquaculture_production_zone.geojson";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(path)))); });
afterEach(() => vi.unstubAllGlobals());

function firstPoint(geometry: { type: string; coordinates: unknown }): number[] {
  const point = geometry.type === "Polygon"
    ? (geometry.coordinates as number[][][])[0]![0]!
    : (geometry.coordinates as number[][][][])[0]![0]![0]!;
  return point;
}
function smallBbox(point: number[]): [number, number, number, number] {
  return [point[0]! - 0.00001, point[1]! - 0.00001, point[0]! + 0.00001, point[1]! + 0.00001];
}

it("pins the source, normalizes full surfaces and keeps empty-bbox meaning", async () => {
  expect(aquacultureZoneOwnerDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true });
  expect(aquacultureZoneOwnerDescriptor.versions[0]?.checksumSha256).toBe("3096bf94ac94a98b642bd011e846ab7b886807b0bfe8c01fd8cb4aae05fcdb8e");
  const executor = new QueryExecutor([aquacultureZoneOwnerAdapter]);
  await expect(executor.execute({ datasetId: aquacultureZoneOwnerDescriptor.datasetId, select: ["record_id"] })).rejects.toThrow("BBOX_REQUIRED");
  const absent = await executor.execute({ datasetId: aquacultureZoneOwnerDescriptor.datasetId, bbox: [119, 21, 119.01, 21.01], select: ["record_id"], limit: 10 });
  expect(absent.totalMatched).toBe(0);
  expect(absent.coverage).toContain("不代表沒有養殖");
});

it("matches independent processed-source geometry at two counties and a name variant", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { properties: { zone_name: string; county: string }; geometry: { type: string; coordinates: unknown } }[] };
  const executor = new QueryExecutor([aquacultureZoneOwnerAdapter]);
  for (const county of ["臺南市", "宜蘭縣"]) {
    const feature = source.features.find(item => item.properties.county === county)!;
    const result = await executor.execute({ datasetId: aquacultureZoneOwnerDescriptor.datasetId, bbox: smallBbox(firstPoint(feature.geometry)), filters: [{ field: "zone_name", op: "eq", value: feature.properties.zone_name }], select: ["zone_name", "county", "geometry"], limit: 10 });
    expect(result.rows.some(row => row.zone_name === feature.properties.zone_name && row.county === county)).toBe(true);
    expect(result.rows.every(row => (row.geometry as { type: string }).type === "MultiPolygon")).toBe(true);
  }
});

it("fails closed when sidecar bytes differ from the pinned receipt", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([aquacultureZoneOwnerAdapter]).execute({ datasetId: aquacultureZoneOwnerDescriptor.datasetId, bbox: [120, 23, 121, 24], select: ["record_id"] })).rejects.toThrow("AQUACULTURE_ZONE_ASSET_MISMATCH");
});
