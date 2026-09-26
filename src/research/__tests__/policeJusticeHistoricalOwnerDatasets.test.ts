import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor, type QueryFilter } from "../queryExecutor";
import { theftTaoyuanOwnerAdapter, theftTaoyuanOwnerDescriptor, trafficAccidentYearlyOwnerAdapter, trafficAccidentYearlyOwnerDescriptor } from "../policeJusticeHistoricalOwnerDatasets";

const root = "../runtime/owner-only/police-justice-historical/";
const sources = {
  traffic: "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/police_justice/traffic_accident_yearly/traffic_accident_yearly_20260626.geojson",
  theft: "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/police_justice/theft_points_taoyuan/theft_points_taoyuan_20260626.geojson",
};
type Bbox = readonly [number, number, number, number];
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => { const parts = url.split("/"); return new Response(await readFile(`${root}${parts[parts.length - 1]}`), { headers: { "content-type": "application/geo+json" } }); })); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });
async function count(path: string, bbox: Bbox, filters: readonly QueryFilter[] = []) {
  const features = (JSON.parse(await readFile(path, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }[] }).features;
  return features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && filters.every(filter => feature.properties[filter.field] === filter.value); }).length;
}
it.skipIf(!existsSync(`${root}traffic-accident-yearly-owner-20260626.geojson`))("matches independent A1 source oracles at Puli and Taipei", async () => {
  const executor = new QueryExecutor([trafficAccidentYearlyOwnerAdapter]);
  for (const bbox of [[120.95, 23.95, 121.05, 24.05], [121.5, 25.02, 121.58, 25.1]] as const) {
    const result = await executor.execute({ datasetId: trafficAccidentYearlyOwnerDescriptor.datasetId, bbox, select: ["incident_id", "year", "agency", "weather", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(await count(sources.traffic, bbox));
  }
});
it.skipIf(!existsSync(`${root}theft-taoyuan-owner-20260626.geojson`))("matches independent Taoyuan source oracles while blocking unsafe year filters", async () => {
  const executor = new QueryExecutor([theftTaoyuanOwnerAdapter]); const bbox: Bbox = [121.25, 24.95, 121.35, 25.05]; const filters: QueryFilter[] = [{ field: "case_type", op: "eq", value: "住宅竊盜" }];
  const result = await executor.execute({ datasetId: theftTaoyuanOwnerDescriptor.datasetId, bbox, filters, select: ["case_id", "case_type", "year_raw", "date_raw", "district_raw", "geometry"], limit: 100 });
  expect(result.totalMatched).toBe(await count(sources.theft, bbox, filters));
  expect(theftTaoyuanOwnerDescriptor.access.query.filters).not.toContain("year_raw"); expect(theftTaoyuanOwnerDescriptor.access.query.filters).not.toContain("date_raw");
  expect(theftTaoyuanOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false }); expect(trafficAccidentYearlyOwnerDescriptor.supportedOperations).not.toContain("nearest");
});
