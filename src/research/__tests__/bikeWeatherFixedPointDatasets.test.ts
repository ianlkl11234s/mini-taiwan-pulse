import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bikeStationsFixedPointAdapter, weatherStationsFixedPointAdapter } from "../bikeWeatherFixedPointDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(async () => {
  clearPointDatasetCache();
  const [bike, weather] = await Promise.all([
    readFile("public/geo/bike_stations.geojson"),
    readFile("public/geo/weather_stations.geojson"),
  ]);
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(
    url.includes("bike_stations") ? bike : weather,
    { headers: { "content-type": "application/geo+json" } },
  ))));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync("public/geo/bike_stations.geojson"))("reads the verified fixed bike-station snapshot without claiming availability", async () => {
  const result = await new QueryExecutor([bikeStationsFixedPointAdapter]).execute({
    datasetId: "tw-bike-stations-fixed-20260301", select: ["StationUID", "BikesCapacity", "geometry"], limit: 1,
  });
  expect(result).toMatchObject({ totalMatched: 9408, rows: [{ StationUID: "TPE500101001", BikesCapacity: 28 }] });
  expect(result.rows[0]?.geometry).toMatchObject({ type: "Point" });
  expect(result.sourceRefs[0]?.checksumSha256).toBe("dbbd70b3912b8739c98c75d14a41bd0aa668bbca82f16d3012c20c48fff34b24");
  expect(bikeStationsFixedPointAdapter.descriptor).toMatchObject({ layerRefs: ["bikeStations"], geometry: { role: "actual", spatialAnalysisEligible: true } });
  expect(bikeStationsFixedPointAdapter.descriptor.coverage).toContain("不含即時 Availability");
});

it.skipIf(!existsSync("public/geo/weather_stations.geojson"))("reads only the fixed active-weather-station list and retains source nulls", async () => {
  const result = await new QueryExecutor([weatherStationsFixedPointAdapter]).execute({
    datasetId: "tw-weather-stations-active-fixed-20251129", select: ["station_id", "end_date", "new_station_id", "is_active", "geometry"], limit: 1,
  });
  expect(result).toMatchObject({ totalMatched: 838, rows: [{ station_id: "466850", end_date: null, new_station_id: null, is_active: true }] });
  expect(result.rows[0]?.geometry).toMatchObject({ type: "Point" });
  expect(result.sourceRefs[0]?.checksumSha256).toBe("08088afb391e63970fe979895b8f76cc9b7c9a427dc09a90dd38939a784e8222");
  expect(weatherStationsFixedPointAdapter.descriptor).toMatchObject({ layerRefs: ["weatherStations"], geometry: { role: "actual", spatialAnalysisEligible: true } });
  expect(weatherStationsFixedPointAdapter.descriptor.coverage).toContain("即時觀測未包含");
});
