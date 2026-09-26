import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { airportsOwnerAdapter, airportsOwnerDescriptor } from "../airportsOwnerDataset";

const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/airport/airports_merged_latest.geojson";
const sidecar = "../runtime/owner-only/airports/airports-owner-20260519.geojson";
type Bbox = readonly [number, number, number, number];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("matches independent Point oracles in Taipei and Kaohsiung, including airport-type filtering", async () => {
  const features = (JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { airport_type: string } }[] }).features;
  const cases: { bbox: Bbox; airportType?: string }[] = [
    { bbox: [121.45, 25.0, 121.7, 25.2] },
    { bbox: [120.15, 22.45, 120.4, 22.95], airportType: "medium_airport" },
  ];
  const executor = new QueryExecutor([airportsOwnerAdapter]);
  for (const item of cases) {
    const expected = features.filter(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      return lng >= item.bbox[0] && lng <= item.bbox[2] && lat >= item.bbox[1] && lat <= item.bbox[3]
        && (item.airportType === undefined || feature.properties.airport_type === item.airportType);
    }).length;
    const result = await executor.execute({ datasetId: airportsOwnerDescriptor.datasetId, bbox: item.bbox, filters: item.airportType ? [{ field: "airport_type", op: "eq", value: item.airportType }] : [], select: ["name", "icao", "iata", "airport_type", "source", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
});

it.skipIf(!existsSync(sidecar))("preserves source missingness and keeps Point reference distinct from airport boundary display geometry", async () => {
  const executor = new QueryExecutor([airportsOwnerAdapter]);
  const result = await executor.execute({ datasetId: airportsOwnerDescriptor.datasetId, filters: [{ field: "tdx_airport_id", op: "eq", value: null }], select: ["name", "tdx_airport_id"], limit: 100 });
  expect(result.totalMatched).toBe(108);
  expect(airportsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(airportsOwnerDescriptor.source.lineage).toContain("16 Polygon/MultiPolygon");
  expect(airportsOwnerDescriptor.supportedOperations).not.toContain("nearest");
});
