import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { govServiceOfficesTgosAdapter } from "../govServiceOfficesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/gov_service_offices_tgos_20260717.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers the 462 TGOS address-level offices with 台/臺 matching and no jurisdiction", async () => {
  const executor = new QueryExecutor([govServiceOfficesTgosAdapter]);
  const taipei = await executor.execute({ datasetId: "tw-gov-service-offices-tgos", filters: [{ field: "county", op: "eq", value: "台北市" }] });
  const dongyin = await executor.execute({ datasetId: "tw-gov-service-offices-tgos", filters: [{ field: "name", op: "eq", value: "連江縣東引鄉戶政事務所" }] });

  expect(taipei.totalMatched).toBe(15);
  expect(dongyin).toMatchObject({ totalMatched: 1, rows: [{ uid: "gov_service_offices:371050900A", name: "連江縣東引鄉戶政事務所", type: "household_registration", county: "連江縣", town: "東引鄉", address: "連江縣東引鄉中柳村122號", org_code: "371050900A", coord_method: "TGOS" }] });
  expect(dongyin.rows[0]).not.toHaveProperty("jurisdiction");
  expect(registeredDatasetForLayer("govServiceOffices")?.datasetId).toBe("tw-gov-service-offices-tgos");
  expect(executor.describe("tw-gov-service-offices-google-l1")).toBeNull();
  expect(govServiceOfficesTgosAdapter.descriptor.coverage).toContain("462 筆 TGOS");
  expect(govServiceOfficesTgosAdapter.descriptor.coverage).toContain("702 筆有座標");
  expect(govServiceOfficesTgosAdapter.descriptor.coverage).toContain("707 筆");
});

it("allows bbox reads for unchanged TGOS WGS84 Point geometry", async () => {
  const result = await new QueryExecutor([govServiceOfficesTgosAdapter]).execute({ datasetId: "tw-gov-service-offices-tgos", bbox: [120.48, 26.36, 120.50, 26.38] });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ name: "連江縣東引鄉戶政事務所", geometry: { type: "Point", coordinates: [120.49011046764997, 26.367265453907926] } }] });
});

it("fails closed if the pinned TGOS sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  clearPointDatasetCache();
  await expect(new QueryExecutor([govServiceOfficesTgosAdapter]).execute({ datasetId: "tw-gov-service-offices-tgos" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
