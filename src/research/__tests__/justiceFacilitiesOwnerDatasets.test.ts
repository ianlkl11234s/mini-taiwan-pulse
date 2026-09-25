import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import {
  antiCorruptionOfficeOwnerAdapter, antiCorruptionOfficeOwnerDescriptor, correctionalFacilityOwnerAdapter, correctionalFacilityOwnerDescriptor,
  courtOwnerAdapter, courtOwnerDescriptor, immigrationOfficeOwnerAdapter, immigrationOfficeOwnerDescriptor,
  investigationBureauOwnerAdapter, investigationBureauOwnerDescriptor, prosecutorsOfficeOwnerAdapter, prosecutorsOfficeOwnerDescriptor,
} from "../justiceFacilitiesOwnerDatasets";

const root = "../runtime/owner-only/justice-facilities";
const assets: Record<string, string> = {
  "anti-corruption-offices-owner-20260626.geojson": `${root}/anti-corruption-offices-owner-20260626.geojson`,
  "correctional-facilities-owner-20260626.geojson": `${root}/correctional-facilities-owner-20260626.geojson`,
  "courts-owner-20260626.geojson": `${root}/courts-owner-20260626.geojson`,
  "immigration-offices-owner-20260626.geojson": `${root}/immigration-offices-owner-20260626.geojson`,
  "investigation-bureau-owner-20260626.geojson": `${root}/investigation-bureau-owner-20260626.geojson`,
  "prosecutors-offices-owner-20260626.geojson": `${root}/prosecutors-offices-owner-20260626.geojson`,
};
const adapters = [antiCorruptionOfficeOwnerAdapter, correctionalFacilityOwnerAdapter, courtOwnerAdapter, immigrationOfficeOwnerAdapter, investigationBureauOwnerAdapter, prosecutorsOfficeOwnerAdapter];
const descriptors = [antiCorruptionOfficeOwnerDescriptor, correctionalFacilityOwnerDescriptor, courtOwnerDescriptor, immigrationOfficeOwnerDescriptor, investigationBureauOwnerDescriptor, prosecutorsOfficeOwnerDescriptor];

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
    const asset = assets[String(url).split("/").pop()!];
    if (!asset) return new Response("missing", { status: 404 });
    return new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads six distinct source families as owner-only reference points", async () => {
  const executor = new QueryExecutor(adapters);
  const results = await Promise.all(descriptors.map(descriptor => executor.execute({ datasetId: descriptor.datasetId, limit: 1 })));
  expect(results.map(result => result.totalMatched)).toEqual([66, 51, 35, 25, 29, 29]);
  for (const descriptor of descriptors) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "email", "url"]));
  }
});

it("keeps bbox reads and facility-type variants bounded", async () => {
  const executor = new QueryExecutor(adapters);
  const taipeiCourts = await executor.execute({ datasetId: courtOwnerDescriptor.datasetId, bbox: [121.48, 25.02, 121.57, 25.08], select: ["name", "court_type", "geometry"], limit: 50 });
  const prisons = await executor.execute({ datasetId: correctionalFacilityOwnerDescriptor.datasetId, filters: [{ field: "facility_type", op: "eq", value: "prison" }], select: ["name", "facility_type"], limit: 50 });
  const centralAntiCorruption = await executor.execute({ datasetId: antiCorruptionOfficeOwnerDescriptor.datasetId, filters: [{ field: "level", op: "eq", value: "central" }], limit: 50 });
  expect(taipeiCourts.totalMatched).toBeGreaterThan(0);
  expect(prisons.totalMatched).toBe(29);
  expect(centralAntiCorruption.totalMatched).toBe(43);
});

it("fails closed when a sidecar changes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([courtOwnerAdapter]).execute({ datasetId: courtOwnerDescriptor.datasetId })).rejects.toThrow("JUSTICE_COURT_SOURCE_SHA_MISMATCH");
});
