import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import {
  wasteFacilitiesIncineratorOwnerAdapter, wasteFacilitiesIncineratorOwnerDescriptor,
  wasteFacilitiesLandfillOwnerAdapter, wasteFacilitiesLandfillOwnerDescriptor,
  wasteFacilitiesMonitoringOwnerAdapter, wasteFacilitiesMonitoringOwnerDescriptor,
  wasteFacilitiesRecyclingOwnerAdapter, wasteFacilitiesRecyclingOwnerDescriptor,
  wasteFacilitiesScrapYardOwnerAdapter, wasteFacilitiesScrapYardOwnerDescriptor,
  wasteFacilitiesTransferOwnerAdapter, wasteFacilitiesTransferOwnerDescriptor,
} from "../wasteFacilitiesOwnerDatasets";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/waste_management/waste_facilities";
const sidecarRoot = "../runtime/owner-only/waste-facilities/";
const prefix = "/__local-research-owner-only/waste-facilities/";
type Bbox = readonly [number, number, number, number];
const taipei = [121.45, 25.0, 121.62, 25.15] as const;
const kaohsiung = [120.2, 22.5, 120.8, 23.2] as const;

async function oracle(file: string, bbox: Bbox, facilityType: string): Promise<number> {
  const collection = JSON.parse(await readFile(`${analyticsRoot}/${file}`, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { facility_type: string } }[] };
  return collection.features.filter(({ geometry: { coordinates: [lng, lat] }, properties }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && properties.facility_type === facilityType).length;
}
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${sidecarRoot}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

const adapters = [wasteFacilitiesIncineratorOwnerAdapter, wasteFacilitiesLandfillOwnerAdapter, wasteFacilitiesMonitoringOwnerAdapter, wasteFacilitiesTransferOwnerAdapter, wasteFacilitiesRecyclingOwnerAdapter, wasteFacilitiesScrapYardOwnerAdapter];
const descriptors = [wasteFacilitiesIncineratorOwnerDescriptor, wasteFacilitiesLandfillOwnerDescriptor, wasteFacilitiesMonitoringOwnerDescriptor, wasteFacilitiesTransferOwnerDescriptor, wasteFacilitiesRecyclingOwnerDescriptor, wasteFacilitiesScrapYardOwnerDescriptor];

it("returns only its own facility category and fails closed on each source-category count", async () => {
  const executor = new QueryExecutor(adapters);
  const expected = [31, 12, 17, 38, 184, 15];
  for (const [index, descriptor] of descriptors.entries()) {
    const result = await executor.execute({ datasetId: descriptor.datasetId, select: ["facility_type", "record_ordinal"], limit: descriptor.access.limits.maxRowsPerQuery });
    expect(result.totalMatched).toBe(expected[index]);
    expect(result.rows.every(row => row.facility_type === descriptor.coverage.match(/facility_type=([^，]+)/)?.[1])).toBe(true);
    expect(result.cost.rowsScanned).toBe(index < 3 ? 66 : 237);
    expect(result.sourceRefs.some(source => source.checksumSha256 === (index < 3 ? "2d642d9986a4d0fc22012262a655b9b024804f2f0e4d9dac3f85394d7ad25ef2" : "66bbb1f6a6fdde0a133c93905842665a5a1b55f776f7156b5f68a24b5c1a7e06"))).toBe(true);
  }
});

it("matches independent Taipei government and Kaohsiung OSM bbox oracles", async () => {
  const executor = new QueryExecutor(adapters);
  const government = await executor.execute({ datasetId: wasteFacilitiesIncineratorOwnerDescriptor.datasetId, bbox: taipei, select: ["facility_name", "facility_type", "geometry"], limit: 31 });
  const osm = await executor.execute({ datasetId: wasteFacilitiesRecyclingOwnerDescriptor.datasetId, bbox: kaohsiung, select: ["facility_name", "facility_type", "status", "geometry"], limit: 100 });
  expect(government.totalMatched).toBe(await oracle("waste_facilities.geojson", taipei, "incinerator"));
  expect(government.totalMatched).toBe(6);
  expect(osm.totalMatched).toBe(await oracle("waste_facilities_osm.geojson", kaohsiung, "recycling_plant"));
  expect(osm.totalMatched).toBe(30);
});

it("keeps only reference-point operations and records the three unsupported layer categories", () => {
  for (const descriptor of descriptors) {
    expect(descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
    expect(descriptor.supportedOperations).not.toContain("nearest");
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "geocode_response_address", "normalized_address", "well_id", "osm_id"]));
  }
  expect(descriptors.map(descriptor => descriptor.layerRefs)).toEqual([["wfIncinerator"], ["wfLandfill"], ["wfMonitoring"], ["wfTransfer"], ["wfRecycling"], ["wfScrapYard"]]);
});
