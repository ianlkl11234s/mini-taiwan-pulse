import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { serviceAreaPolygonAdapter, serviceAreaPolygonDescriptor } from "../serviceAreaPolygonDataset";

const mini = new URL("../../../public/geo/service_area_polygon.geojson", import.meta.url);
const analytics = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/service_area_polygon/service_area_polygon_20260524.geojson";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(mini)))); });
afterEach(() => vi.unstubAllGlobals());
function bboxAt(geometry: { type: string; coordinates: unknown }): [number, number, number, number] {
  const p = geometry.type === "Polygon" ? (geometry.coordinates as number[][][])[0]![0]! : (geometry.coordinates as number[][][][])[0]![0]![0]!;
  return [p[0]! - .00001, p[1]! - .00001, p[0]! + .00001, p[1]! + .00001];
}

it("keeps the 19 source surfaces, ODbL attribution and missingness separate", async () => {
  const result = await new QueryExecutor([serviceAreaPolygonAdapter]).execute({ datasetId: serviceAreaPolygonDescriptor.datasetId, select: ["name", "osm_id"], limit: 19 });
  expect(result.totalMatched).toBe(19);
  expect(result.cost).toMatchObject({ rowsScanned: 19, bytesScanned: 24_463 });
  expect(serviceAreaPolygonDescriptor.license).toContain("ODbL");
  expect(serviceAreaPolygonDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true });
  expect(result.coverage).toContain("不同");
});

it("matches two distinct places and a directional variant against the full processed source", async () => {
  const original = JSON.parse(await readFile(analytics, "utf8")) as { features: { properties: { Name: string; Direction: string }; geometry: { type: string; coordinates: unknown } }[] };
  const executor = new QueryExecutor([serviceAreaPolygonAdapter]);
  for (const name of ["東山服務區", "泰安服務區(北上)"]) {
    const feature = original.features.find(item => item.properties.Name === name)!;
    const result = await executor.execute({ datasetId: serviceAreaPolygonDescriptor.datasetId, bbox: bboxAt(feature.geometry), filters: [{ field: "name", op: "eq", value: name }], select: ["name", "direction", "geometry"], limit: 5 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name, direction: feature.properties.Direction, geometry: { type: "MultiPolygon" } });
  }
  const empty = await executor.execute({ datasetId: serviceAreaPolygonDescriptor.datasetId, bbox: [119, 21, 119.01, 21.01], select: ["name"], limit: 5 });
  expect(empty.totalMatched).toBe(0);
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  await expect(new QueryExecutor([serviceAreaPolygonAdapter]).execute({ datasetId: serviceAreaPolygonDescriptor.datasetId, select: ["name"] })).rejects.toThrow("SERVICE_AREA_SURFACE_SOURCE_MISMATCH");
});
