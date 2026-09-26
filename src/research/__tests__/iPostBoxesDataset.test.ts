import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { iPostBoxesSourceCoordinatesAdapter } from "../iPostBoxesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/civic_facilities/ibox_national.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers the complete verified iPost Box source snapshot and preserves source-empty payment semantics", async () => {
  const result = await new QueryExecutor([iPostBoxesSourceCoordinatesAdapter]).execute({ datasetId: "tw-ipost-boxes-source-coordinates", limit: 1 });
  expect(result).toMatchObject({ totalMatched: 2345, rows: [{ payment_method: "" }] });
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: "0c0dccddc71a8dec9d51353be2439529c10f93b174d8acc4f7bf4f735a81e572" });
  expect(registeredDatasetForLayer("iPostBoxes")?.datasetId).toBe("tw-ipost-boxes-source-coordinates");
  expect(iPostBoxesSourceCoordinatesAdapter.descriptor.coverage).toContain("122 個重複座標均保留");
  expect(iPostBoxesSourceCoordinatesAdapter.descriptor.source.lineage).toContain("must not be interpreted as free");
});

it("answers a new island place and treats 台/臺 address variants equivalently", async () => {
  const executor = new QueryExecutor([iPostBoxesSourceCoordinatesAdapter]);
  const matsu = await executor.execute({ datasetId: "tw-ipost-boxes-source-coordinates", filters: [{ field: "name", op: "eq", value: "馬祖郵局ｉ郵箱" }] });
  const taipei = await executor.execute({ datasetId: "tw-ipost-boxes-source-coordinates", filters: [{ field: "address", op: "contains", value: "台北市" }], limit: 2 });
  const taipeiTraditional = await executor.execute({ datasetId: "tw-ipost-boxes-source-coordinates", filters: [{ field: "address", op: "contains", value: "臺北市" }], limit: 2 });

  expect(matsu).toMatchObject({ totalMatched: 1, rows: [{ address: "連江縣南竿鄉福沃村141號", geometry: { type: "Point", coordinates: [119.942563, 26.157342] } }] });
  expect(taipei.totalMatched).toBeGreaterThan(0);
  expect(taipei.totalMatched).toBe(taipeiTraditional.totalMatched);
  expect(taipei.rows).toHaveLength(2);
});

it("fails closed if the pinned iPost source bytes change", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  await expect(new QueryExecutor([iPostBoxesSourceCoordinatesAdapter]).execute({ datasetId: "tw-ipost-boxes-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
