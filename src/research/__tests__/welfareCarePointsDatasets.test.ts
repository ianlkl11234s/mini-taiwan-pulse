import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { elderlyCareHomesTgosUpstreamAdapter } from "../elderlyCareHomesDataset";
import { ltcInstitutionsTgosUpstreamAdapter } from "../ltcInstitutionsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const assets = {
  ltc: "../runtime/research-public/ltc_institutions_tgos_upstream.geojson",
  elderly: "../runtime/research-public/elderly_care_homes_tgos_upstream.geojson",
} as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(await readFile(String(input).includes("elderly") ? assets.elderly : assets.ltc), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads only the fixed 3,053-record TGOS LTC sidecar with its receipt and null semantics", async () => {
  const result = await new QueryExecutor([ltcInstitutionsTgosUpstreamAdapter]).execute({ datasetId: "tw-ltc-institutions-tgos-upstream", filters: [{ field: "name", op: "eq", value: "臺北市私立美樺居家式服務類長期照顧服務機構" }] });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ uid: "welfare_00109", coord_source: "tgos_upstream", coord_precision: "upstream" }], sourceRefs: [{ checksumSha256: "4d83b83a71e2898025c2a97c5189a57060c6ec67ea675732e9a9cd96c58f87c3" }] });
  const descriptor = ltcInstitutionsTgosUpstreamAdapter.descriptor;
  expect(descriptor.coverage).toContain("uni_no 有 15 筆 null");
  expect(descriptor.fields.find(field => field.name === "uni_no")).toMatchObject({ nullable: true });
});

it("reads only the fixed 1,043-record TGOS elderly-home sidecar with explicit source nulls", async () => {
  const executor = new QueryExecutor([elderlyCareHomesTgosUpstreamAdapter]);
  const result = await executor.execute({ datasetId: "tw-elderly-care-homes-tgos-upstream", filters: [{ field: "name", op: "eq", value: "臺北市私立天玉老人長期照顧中心(長期照護型)" }] });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ uid: "welfare_00736", coord_source: "tgos_upstream", coord_precision: "upstream", uni_no: null }], sourceRefs: [{ checksumSha256: "5031ace9289687cd58f1410c599caa593d51f776072067493c660565d6839cb0" }] });
  expect((await executor.execute({ datasetId: "tw-elderly-care-homes-tgos-upstream" })).totalMatched).toBe(1043);
  expect(elderlyCareHomesTgosUpstreamAdapter.descriptor.coverage).toContain("uni_no 978");
});

it("fails closed when a fixed welfare sidecar changes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([ltcInstitutionsTgosUpstreamAdapter]).execute({ datasetId: "tw-ltc-institutions-tgos-upstream" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
