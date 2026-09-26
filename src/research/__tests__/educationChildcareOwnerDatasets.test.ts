import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { educationAfterschoolCareOwnerAdapter, educationAfterschoolCareOwnerDescriptor, educationKindergartenOwnerAdapter, educationKindergartenOwnerDescriptor, educationMutualCareOwnerAdapter, educationMutualCareOwnerDescriptor } from "../educationChildcareOwnerDatasets";

const assets = new Map([
  ["kindergartens-20260807-owner.geojson", "../runtime/owner-only/education-childcare/kindergartens-20260807-owner.geojson"],
  ["afterschool-care-20260807-owner.geojson", "../runtime/owner-only/education-childcare/afterschool-care-20260807-owner.geojson"],
  ["mutual-care-20260807-owner.geojson", "../runtime/owner-only/education-childcare/mutual-care-20260807-owner.geojson"],
]);
const adapters = [educationKindergartenOwnerAdapter, educationAfterschoolCareOwnerAdapter, educationMutualCareOwnerAdapter];
const descriptors = [educationKindergartenOwnerDescriptor, educationAfterschoolCareOwnerDescriptor, educationMutualCareOwnerDescriptor];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(assets.get(url.split("/").pop()!)!), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(assets.get("kindergartens-20260807-owner.geojson")!))("retains all three independent source tables while preserving their unlocated records", async () => {
  const executor = new QueryExecutor(adapters);
  const results = await Promise.all(descriptors.map(descriptor => executor.execute({ datasetId: descriptor.datasetId, limit: 1 })));
  expect(results.map(result => result.totalMatched)).toEqual([6747, 787, 148]);
  for (const descriptor of descriptors) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "address_clean", "phone", "電話", "地址"]));
  }
});

it.skipIf(!existsSync(assets.get("kindergartens-20260807-owner.geojson")!))("uses independent location oracles and keeps bbox separate from unlocated source rows", async () => {
  const executor = new QueryExecutor(adapters);
  const taipeiKindergarten = await executor.execute({ datasetId: educationKindergartenOwnerDescriptor.datasetId, bbox: [121.49, 25.02, 121.57, 25.09], select: ["name", "academic_year", "geometry"], limit: 100 });
  const taichungAfterSchool = await executor.execute({ datasetId: educationAfterschoolCareOwnerDescriptor.datasetId, bbox: [120.65, 24.12, 120.71, 24.20], select: ["name", "city", "geometry"], limit: 100 });
  const unlocatedKindergarten = await executor.execute({ datasetId: educationKindergartenOwnerDescriptor.datasetId, filters: [{ field: "coordinate_status", op: "eq", value: "unlocated" }], select: ["name", "coordinate_status", "geometry"], limit: 100 });
  expect(taipeiKindergarten.totalMatched).toBe(355);
  expect(taichungAfterSchool.totalMatched).toBe(5);
  expect(unlocatedKindergarten.totalMatched).toBe(58);
  expect(unlocatedKindergarten.rows.every(row => row.geometry === null && row.coordinate_status === "unlocated")).toBe(true);
});

it.skipIf(!existsSync(assets.get("mutual-care-20260807-owner.geojson")!))("allows terminology variants through fields without treating reference coordinates as proximity", async () => {
  const executor = new QueryExecutor(adapters);
  const mutual = await executor.execute({ datasetId: educationMutualCareOwnerDescriptor.datasetId, filters: [{ field: "ownership", op: "eq", value: "私立" }], select: ["name", "ownership", "geometry"], limit: 100 });
  expect(mutual.totalMatched).toBeGreaterThan(0);
  expect(educationMutualCareOwnerDescriptor.geometry.spatialAnalysisEligible).toBe(false);
  expect(educationMutualCareOwnerDescriptor.supportedOperations).not.toContain("nearest");
});

it("fails closed when an owner-only sidecar changes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([educationKindergartenOwnerAdapter]).execute({ datasetId: educationKindergartenOwnerDescriptor.datasetId })).rejects.toThrow("EDUCATION_CHILDCARE_kindergarten_OWNER_SOURCE_SHA_MISMATCH");
});
