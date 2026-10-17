import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { serviceAreaFixedPointAdapter } from "../serviceAreaFixedDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/geo/service_area.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads the complete pinned Highway Bureau source snapshot without treating it as access or current operations", async () => {
  const result = await new QueryExecutor([serviceAreaFixedPointAdapter]).execute({
    datasetId: "tw-freeway-service-areas-fixed-20260524", select: ["name", "operation_period", "geometry"], limit: 1,
  });

  expect(result).toMatchObject({ totalMatched: 22, rows: [{ name: "中壢", operation_period: "2019.06.01~2030.05.31" }] });
  expect(result.rows[0]?.geometry).toMatchObject({ type: "Point" });
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: "68fc87e6859530aa0ccf8ecaf61a23a3a95307c23d3a7a0f5461b1448d241b65" });
  expect(serviceAreaFixedPointAdapter.descriptor).toMatchObject({
    layerRefs: ["serviceArea"], geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
  });
  expect(serviceAreaFixedPointAdapter.descriptor.description).toContain("入口");
  expect(serviceAreaFixedPointAdapter.descriptor.coverage).toContain("freshness unknown");
});

it("answers a new-place bbox oracle and retains the same-name direction variant", async () => {
  const executor = new QueryExecutor([serviceAreaFixedPointAdapter]);
  const suao = await executor.execute({ datasetId: "tw-freeway-service-areas-fixed-20260524", bbox: [121.81, 24.61, 121.82, 24.63] });
  const rendeSouthbound = await executor.execute({
    datasetId: "tw-freeway-service-areas-fixed-20260524",
    filters: [{ field: "name", op: "eq", value: "仁德" }, { field: "direction", op: "eq", value: "南下" }],
  });

  expect(suao).toMatchObject({ totalMatched: 1, rows: [{ name: "蘇澳", geometry: { type: "Point", coordinates: [121.815535, 24.621322] } }] });
  expect(rendeSouthbound).toMatchObject({ totalMatched: 1, rows: [{ name: "仁德", direction: "南下", geometry: { type: "Point", coordinates: [120.265106, 22.905878] } }] });
});

it("fails closed when the pinned service-area asset bytes change", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([serviceAreaFixedPointAdapter]).execute({ datasetId: "tw-freeway-service-areas-fixed-20260524" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
