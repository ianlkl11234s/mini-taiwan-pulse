import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { welfareElderlyHomesOwnerAdapter, welfareElderlyHomesOwnerDescriptor, welfareLtcInstitutionsOwnerAdapter, welfareLtcInstitutionsOwnerDescriptor } from "../welfareCarePointsOwnerDatasets";

const root = "../runtime/owner-only/welfare-care";
beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const parts = String(input).split("/");
    const name = parts[parts.length - 1];
    return new Response(await readFile(`${root}/${name}`), { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps both mixed-coordinate welfare snapshots owner-only with source and null receipts", async () => {
  const executor = new QueryExecutor([welfareLtcInstitutionsOwnerAdapter, welfareElderlyHomesOwnerAdapter]);
  const ltc = await executor.execute({ datasetId: welfareLtcInstitutionsOwnerDescriptor.datasetId, filters: [{ field: "coord_source", op: "eq", value: "google" }], limit: 1 });
  const elderly = await executor.execute({ datasetId: welfareElderlyHomesOwnerDescriptor.datasetId, filters: [{ field: "uni_no", op: "eq", value: null }], limit: 1 });
  expect(ltc).toMatchObject({ totalMatched: 29, rows: [{ coord_source: "google", geometry: { type: "Point" } }], sourceRefs: [{ checksumSha256: "ec904d7bb094f22f331f4fc884c2801aeca7901c5dcc96ec95cce2ce629e55d7" }] });
  expect(elderly).toMatchObject({ totalMatched: 1090, rows: [{ uni_no: null }], sourceRefs: [{ checksumSha256: "5167ef508cac220c6cb0c38c71fec236f63331f0adb4221aec8f5f3a91e4d984" }] });
  for (const descriptor of [welfareLtcInstitutionsOwnerDescriptor, welfareElderlyHomesOwnerDescriptor]) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "beds_approved"]));
  }
});

it("permits bounded reference lookup and fails closed if owner-only bytes change", async () => {
  const executor = new QueryExecutor([welfareLtcInstitutionsOwnerAdapter]);
  await expect(executor.execute({ datasetId: welfareLtcInstitutionsOwnerDescriptor.datasetId, bbox: [121.5, 25.02, 121.56, 25.06], limit: 10 })).resolves.toMatchObject({ totalMatched: expect.any(Number) });
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(executor.execute({ datasetId: welfareLtcInstitutionsOwnerDescriptor.datasetId })).rejects.toThrow("WELFARE_CARE_OWNER_SOURCE_SHA_MISMATCH");
});
