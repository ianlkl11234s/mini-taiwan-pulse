import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { welfareChildcareOwnerAdapter, welfareChildcareOwnerDescriptor, welfareDisabilityOwnerAdapter, welfareDisabilityOwnerDescriptor, welfareSocialWorkOrgsOwnerAdapter, welfareSocialWorkOrgsOwnerDescriptor } from "../welfareGeocodedOwnerDatasets";

const root = "../runtime/owner-only/welfare-geocoded";
const files = new Map([
  ["welfare-childcare-owner-20260925.geojson", `${root}/welfare-childcare-owner-20260925.geojson`],
  ["welfare-disability-owner-20260925.geojson", `${root}/welfare-disability-owner-20260925.geojson`],
  ["welfare-social-work-orgs-owner-20260925.geojson", `${root}/welfare-social-work-orgs-owner-20260925.geojson`],
]);

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const parts = String(input).split("/");
    const name = parts[parts.length - 1];
    const path = name ? files.get(name) : undefined;
    return path ? new Response(await readFile(path), { headers: { "content-type": "application/geo+json" } }) : new Response("not found", { status: 404 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf([...files.values()].some(path => !existsSync(path)))("keeps all three mixed-coordinate snapshots owner-only with provenance and null receipts", async () => {
  const executor = new QueryExecutor([welfareChildcareOwnerAdapter, welfareDisabilityOwnerAdapter, welfareSocialWorkOrgsOwnerAdapter]);
  const childcare = await executor.execute({ datasetId: welfareChildcareOwnerDescriptor.datasetId, filters: [{ field: "coord_source", op: "eq", value: "google" }], limit: 1 });
  const disability = await executor.execute({ datasetId: welfareDisabilityOwnerDescriptor.datasetId, filters: [{ field: "uni_no", op: "eq", value: null }], limit: 1 });
  const socialWork = await executor.execute({ datasetId: welfareSocialWorkOrgsOwnerDescriptor.datasetId, filters: [{ field: "coord_source", op: "eq", value: "tgos_upstream" }], limit: 1 });

  expect(childcare).toMatchObject({ totalMatched: 221, excludedByReason: { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 }, rows: [{ coord_source: "google", geometry: { type: "Point" } }] });
  expect(disability).toMatchObject({ totalMatched: 266, rows: [{ uni_no: null }] });
  expect(socialWork).toMatchObject({ totalMatched: 551, rows: [{ coord_source: "tgos_upstream" }] });
  for (const descriptor of [welfareChildcareOwnerDescriptor, welfareDisabilityOwnerDescriptor, welfareSocialWorkOrgsOwnerDescriptor]) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "actual_day", "quota_day"]));
  }
});

it.skipIf(!existsSync(`${root}/welfare-childcare-owner-20260925.geojson`))("permits bounded reference-position lookup but fails closed when sidecar bytes change", async () => {
  const executor = new QueryExecutor([welfareChildcareOwnerAdapter]);
  await expect(executor.execute({ datasetId: welfareChildcareOwnerDescriptor.datasetId, bbox: [121.5, 25.02, 121.56, 25.06], limit: 10 })).resolves.toMatchObject({ totalMatched: expect.any(Number) });
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(executor.execute({ datasetId: welfareChildcareOwnerDescriptor.datasetId })).rejects.toThrow("WELFARE_GEOCODED_OWNER_SOURCE_SHA_MISMATCH");
});
