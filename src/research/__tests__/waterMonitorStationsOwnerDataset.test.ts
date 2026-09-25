import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor, type QueryFilter } from "../queryExecutor";
import { waterMonitorStationsOwnerAdapter, waterMonitorStationsOwnerDescriptor } from "../waterMonitorStationsOwnerDataset";

const sidecar = "../runtime/owner-only/water-monitor-stations/water-monitor-stations-owner-20260519.geojson";
const inputs = [
  "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/water_resources/rain_gauge_stations/rain_gauge_stations.geojson",
  "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/water_resources/river_water_level_realtime/river_level_stations_wra.geojson",
  "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/water_resources/groundwater/groundwater_wells.geojson",
];
type Bbox = readonly [number, number, number, number];

async function sourceFeatures() { return (await Promise.all(inputs.map(async path => (JSON.parse(await readFile(path, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { station_type: string; is_active: boolean } }[] }).features))).flat(); }
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("matches independent source oracles in two places and a status/type variant", async () => {
  const features = await sourceFeatures();
  const cases: { bbox: Bbox; type?: string; active?: boolean }[] = [
    { bbox: [121.45, 25, 121.62, 25.12] },
    { bbox: [121.7, 24.92, 121.8, 25], type: "river_level", active: true },
  ];
  const executor = new QueryExecutor([waterMonitorStationsOwnerAdapter]);
  for (const item of cases) {
    const expected = features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= item.bbox[0] && lng <= item.bbox[2] && lat >= item.bbox[1] && lat <= item.bbox[3] && (item.type === undefined || feature.properties.station_type === item.type) && (item.active === undefined || feature.properties.is_active === item.active); }).length;
    const filters: QueryFilter[] = [];
    if (item.type !== undefined) filters.push({ field: "station_type", op: "eq", value: item.type });
    if (item.active !== undefined) filters.push({ field: "is_active", op: "eq", value: item.active });
    const result = await executor.execute({ datasetId: waterMonitorStationsOwnerDescriptor.datasetId, bbox: item.bbox, filters, select: ["station_id", "station_type", "is_active", "reported_county", "county_spatial_check", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
});

it("keeps county QA visible but never exposes reported_county as a filter", async () => {
  const executor = new QueryExecutor([waterMonitorStationsOwnerAdapter]);
  const mismatch = await executor.execute({ datasetId: waterMonitorStationsOwnerDescriptor.datasetId, filters: [{ field: "county_spatial_check", op: "eq", value: "mismatch" }], select: ["station_id", "reported_county", "county_spatial_check"], limit: 100 });
  expect(mismatch.totalMatched).toBe(360);
  expect(waterMonitorStationsOwnerDescriptor.access.query.filters).not.toContain("reported_county");
  expect(waterMonitorStationsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(waterMonitorStationsOwnerDescriptor.supportedOperations).not.toContain("nearest");
});
