import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { gasStationsCanonicalAdapter } from "../gasStationsDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/gas-stations-canonical-20260620.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync("../runtime/research-public/gas-stations-canonical-20260620.geojson"))("keeps the verified canonical full source and all five gas-station layer references", async () => {
  const result = await new QueryExecutor([gasStationsCanonicalAdapter]).execute({ datasetId: "tw-gas-stations-canonical", select: ["entity_id", "brand", "geometry"], limit: 1 });
  expect(result).toMatchObject({ totalMatched: 3053, analysisComplete: true });
  expect(gasStationsCanonicalAdapter.descriptor.layerRefs).toEqual(["gasStationCpc", "gasStationFpcc", "gasStationTaisugar", "gasStationOther", "gasStationCanonical"]);
  expect(result.sourceRefs[0]?.checksumSha256).toBe("326b81ef20deef1dc3f9ced16c4e124b2db0bda97c4b86422dee8c5c5b9c3da3");
});

it.skipIf(!existsSync("../runtime/research-public/gas-stations-canonical-20260620.geojson"))("supports overlapping brand membership, bbox, and nearby point queries", async () => {
  const executor = new QueryExecutor([gasStationsCanonicalAdapter]);
  const fpcc = await executor.execute({ datasetId: "tw-gas-stations-canonical", filters: [{ field: "brand", op: "contains", value: "台塑" }], select: ["brand"], limit: 1 });
  const taitung = await executor.execute({ datasetId: "tw-gas-stations-canonical", bbox: [121.13, 22.74, 121.17, 22.78], select: ["name", "brand", "geometry"], limit: 50 });
  expect(fpcc.totalMatched).toBe(350);
  expect(taitung.totalMatched).toBeGreaterThan(0);
  expect(taitung.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(gasStationsCanonicalAdapter.descriptor.supportedOperations).toContain("nearest");
  expect(gasStationsCanonicalAdapter.descriptor.coverage).toContain("不可當作互斥總數");
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([gasStationsCanonicalAdapter]).execute({ datasetId: "tw-gas-stations-canonical" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
