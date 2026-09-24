import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { govWelfareOfficesUpstreamCoordinatesAdapter } from "../govWelfareOfficesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/welfare/welfare_gov_offices_national.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers the 133 direct TGOS coordinates, retaining snapshot provenance and 台/臺 matching", async () => {
  const executor = new QueryExecutor([govWelfareOfficesUpstreamCoordinatesAdapter]);
  const taipei = await executor.execute({ datasetId: "tw-gov-welfare-offices-upstream-coordinates", filters: [{ field: "city", op: "eq", value: "台北市" }] });
  const kinmen = await executor.execute({ datasetId: "tw-gov-welfare-offices-upstream-coordinates", filters: [{ field: "name", op: "eq", value: "金門縣衛生局" }] });

  expect(taipei).toMatchObject({ totalMatched: 19, excludedByReason: { excluded_by_selection: 18 } });
  expect(kinmen).toMatchObject({ totalMatched: 1, rows: [{ uid: "welfare_08203", name: "金門縣衛生局", city: "金門縣", sub_code: "T0101", permit_status: "C04", coord_source: "tgos_upstream", coord_precision: "upstream", src_datasets: "165355", n_src: 1, inst_code: "WAA00000555", uni_no: "77355471" }] });
  expect(kinmen.sourceRefs[0]).toMatchObject({ checksumSha256: "cd6b21ef107b810a70a07bbbba1b4a4308f363d321c2d6a8c15f260b152ae664" });
  expect(registeredDatasetForLayer("welfareGovOffices")?.datasetId).toBe("tw-gov-welfare-offices-upstream-coordinates");
  expect(executor.describe("tw-gov-welfare-offices-google-exact")).toBeNull();
  expect(executor.describe("tw-gov-welfare-offices-offline-l2")).toBeNull();
});

it("allows actual-coordinate bbox reads only for the direct source subset", async () => {
  const result = await new QueryExecutor([govWelfareOfficesUpstreamCoordinatesAdapter]).execute({ datasetId: "tw-gov-welfare-offices-upstream-coordinates", bbox: [118.4, 24.43, 118.43, 24.45] });
  expect(result.totalMatched).toBe(2);
  expect(result.rows.map(row => row.name)).toEqual(["金門縣衛生局", "金門縣衛生局照管中心"]);
});

it("fails closed if the fixed 151-Point source bytes change", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  await expect(new QueryExecutor([govWelfareOfficesUpstreamCoordinatesAdapter]).execute({ datasetId: "tw-gov-welfare-offices-upstream-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
