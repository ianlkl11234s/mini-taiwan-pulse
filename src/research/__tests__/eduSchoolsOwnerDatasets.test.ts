import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import {
  eduRemoteSchoolsOwnerAdapter, eduRemoteSchoolsOwnerDescriptor, eduSchoolElementaryOwnerAdapter, eduSchoolElementaryOwnerDescriptor,
  eduSchoolJuniorOwnerAdapter, eduSchoolJuniorOwnerDescriptor, eduSchoolSeniorOwnerAdapter, eduSchoolSeniorOwnerDescriptor,
  eduSchoolSpecialOwnerAdapter, eduSchoolSpecialOwnerDescriptor, eduSchoolUniversityOwnerAdapter, eduSchoolUniversityOwnerDescriptor,
} from "../eduSchoolsOwnerDatasets";

const asset = "../runtime/owner-only/edu-schools/taiwan-schools-2024-owner.geojson";
const adapters = [eduSchoolElementaryOwnerAdapter, eduSchoolJuniorOwnerAdapter, eduSchoolSeniorOwnerAdapter, eduSchoolUniversityOwnerAdapter, eduSchoolSpecialOwnerAdapter, eduRemoteSchoolsOwnerAdapter];
const descriptors = [eduSchoolElementaryOwnerDescriptor, eduSchoolJuniorOwnerDescriptor, eduSchoolSeniorOwnerDescriptor, eduSchoolUniversityOwnerDescriptor, eduSchoolSpecialOwnerDescriptor, eduRemoteSchoolsOwnerDescriptor];

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(asset))("splits all six manifest meanings from one owner-only 4,315-Point source", async () => {
  const executor = new QueryExecutor(adapters);
  const [elementary, junior, senior, university, special, remote] = await Promise.all([
    executor.execute({ datasetId: eduSchoolElementaryOwnerDescriptor.datasetId, limit: 1 }),
    executor.execute({ datasetId: eduSchoolJuniorOwnerDescriptor.datasetId, limit: 1 }),
    executor.execute({ datasetId: eduSchoolSeniorOwnerDescriptor.datasetId, limit: 1 }),
    executor.execute({ datasetId: eduSchoolUniversityOwnerDescriptor.datasetId, limit: 1 }),
    executor.execute({ datasetId: eduSchoolSpecialOwnerDescriptor.datasetId, limit: 1 }),
    executor.execute({ datasetId: eduRemoteSchoolsOwnerDescriptor.datasetId, limit: 1 }),
  ]);
  expect([elementary.totalMatched, junior.totalMatched, senior.totalMatched, university.totalMatched, special.totalMatched]).toEqual([2656, 964, 508, 159, 28]);
  expect(remote.totalMatched).toBe(1152);
  expect(university.rows[0]!.school_level).toBeDefined();
  expect(remote.rows[0]!.region_type).toBeDefined();
  for (const descriptor of descriptors) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "website"]));
  }
});

it.skipIf(!existsSync(asset))("keeps the manifest grouping under two locations and a classification variant", async () => {
  const executor = new QueryExecutor(adapters);
  const taipeiElementary = await executor.execute({ datasetId: eduSchoolElementaryOwnerDescriptor.datasetId, bbox: [121.50, 25.02, 121.56, 25.08], select: ["school_name", "school_level", "geometry"], limit: 50 });
  const nanAoRemote = await executor.execute({ datasetId: eduRemoteSchoolsOwnerDescriptor.datasetId, bbox: [121.76, 24.42, 121.84, 24.50], select: ["school_name", "region_type", "geometry"], limit: 50 });
  const attachedJunior = await executor.execute({ datasetId: eduSchoolJuniorOwnerDescriptor.datasetId, filters: [{ field: "school_level", op: "eq", value: "附設國民中學" }], select: ["school_name", "school_level"], limit: 50 });
  expect(taipeiElementary.totalMatched).toBeGreaterThan(0);
  expect(taipeiElementary.rows.every(row => ["國民小學", "附設國民小學"].includes(String(row.school_level)))).toBe(true);
  expect(nanAoRemote.totalMatched).toBeGreaterThan(0);
  expect(nanAoRemote.rows.every(row => ["偏遠", "特偏", "極偏"].includes(String(row.region_type)))).toBe(true);
  expect(attachedJunior.totalMatched).toBe(228);
});

it("fails closed if the local owner-only bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([eduSchoolElementaryOwnerAdapter]).execute({ datasetId: eduSchoolElementaryOwnerDescriptor.datasetId })).rejects.toThrow("EDU_SCHOOLS_OWNER_SOURCE_SHA_MISMATCH");
});
