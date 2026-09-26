import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { waterFacilitiesOwnerAdapter, waterFacilitiesOwnerDescriptor } from "../waterFacilitiesOwnerDataset";

const sidecar = "../runtime/owner-only/water-facilities/water-facilities-owner-20260519.geojson";
const source = "public/geo/water_facilities.geojson";
type Bbox = readonly [number, number, number, number];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(source))("matches independent display oracles in two cities and a type variant", async () => {
  const features = (JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { facility_type: string } }[] }).features;
  const cases: { bbox: Bbox; type?: string }[] = [
    { bbox: [121.45, 25, 121.62, 25.12] },
    { bbox: [120.1, 22.9, 120.3, 23.1], type: "pump_station_official" },
  ];
  const executor = new QueryExecutor([waterFacilitiesOwnerAdapter]);
  for (const item of cases) {
    const expected = features.filter(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      return lng >= item.bbox[0] && lng <= item.bbox[2] && lat >= item.bbox[1] && lat <= item.bbox[3]
        && (item.type === undefined || feature.properties.facility_type === item.type);
    }).length;
    const result = await executor.execute({ datasetId: waterFacilitiesOwnerDescriptor.datasetId, bbox: item.bbox, filters: item.type ? [{ field: "facility_type", op: "eq", value: item.type }] : [], select: ["facility_id", "name", "facility_type", "source", "operator", "county", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
});

it.skipIf(!existsSync(sidecar))("keeps mixed-source proxy coordinates and sparse source strings", async () => {
  const executor = new QueryExecutor([waterFacilitiesOwnerAdapter]);
  const result = await executor.execute({ datasetId: waterFacilitiesOwnerDescriptor.datasetId, filters: [{ field: "source", op: "eq", value: "wra_gic" }], select: ["facility_id", "name", "facility_type", "source", "county"], limit: 100 });
  expect(result.totalMatched).toBe(83);
  expect(waterFacilitiesOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(waterFacilitiesOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(waterFacilitiesOwnerDescriptor.license).toContain("RIGHTS_HOLD");
});
