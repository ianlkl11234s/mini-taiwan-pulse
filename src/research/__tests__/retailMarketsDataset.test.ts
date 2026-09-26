import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";
import { retailMarketsTgosAdapter } from "../retailMarketsDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/retail_markets_tgos_20260717.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers only the 653 TGOS address-level records with version-bound provenance", async () => {
  const executor = new QueryExecutor([retailMarketsTgosAdapter]);
  const taipei = await executor.execute({ datasetId: "tw-public-retail-markets-tgos", filters: [{ field: "county", op: "eq", value: "台北市" }] });
  const penghu = await executor.execute({ datasetId: "tw-public-retail-markets-tgos", filters: [{ field: "name", op: "eq", value: "七美公有零售市場" }] });

  expect(taipei).toMatchObject({ totalMatched: 71 });
  expect(penghu).toMatchObject({ totalMatched: 1, rows: [{ name: "七美公有零售市場", county: "澎湖縣", town: "七美鄉", address: "澎湖縣七美鄉南港村40號", business_hours: "早市", coord_method: "TGOS" }] });
  expect(penghu.sourceRefs[0]).toMatchObject({ checksumSha256: "545124678354a59c27c087af62553acaffd74c61b1717751d21614561b12bd88" });
  expect(registeredDatasetForLayer("retailMarkets")?.datasetId).toBe("tw-public-retail-markets-tgos");
  expect(executor.describe("tw-public-retail-markets-google-l1")).toBeNull();
  expect(retailMarketsTgosAdapter.descriptor.coverage).toContain("排除 70 筆 Google L1 與 8 筆 offline");
  expect(retailMarketsTgosAdapter.descriptor.coverage).toContain("58 筆無座標");
  expect(retailMarketsTgosAdapter.descriptor.fields.find(field => field.name === "town")).toMatchObject({ nullable: true, nullMeaning: expect.stringContaining("空字串") });
});

it("allows bbox reads for the unchanged TGOS Point geometry", async () => {
  const result = await new QueryExecutor([retailMarketsTgosAdapter]).execute({ datasetId: "tw-public-retail-markets-tgos", bbox: [119.42, 23.19, 119.43, 23.2] });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ name: "七美公有零售市場", geometry: { type: "Point", coordinates: [119.42515489517785, 23.19615159638243] } }] });
});

it("fails closed if the pinned TGOS sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  clearPointDatasetCache();
  await expect(new QueryExecutor([retailMarketsTgosAdapter]).execute({ datasetId: "tw-public-retail-markets-tgos" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
