import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hotSpringsSourceCoordinatesAdapter } from "../hotSpringDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/tourism/hot_springs_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("queries fixed hot-spring outcrops by place and normalizes the 台/臺 county variant", async () => {
  const executor = new QueryExecutor([hotSpringsSourceCoordinatesAdapter]);
  const chihpen = await executor.execute({ datasetId: "tw-hot-spring-outcrops", filters: [{ field: "name", op: "eq", value: "知本" }] });
  const wulai = await executor.execute({ datasetId: "tw-hot-spring-outcrops", filters: [{ field: "name", op: "eq", value: "烏來" }] });
  const taipei = await executor.execute({ datasetId: "tw-hot-spring-outcrops", filters: [{ field: "county", op: "eq", value: "台北市" }], limit: 50 });

  expect(chihpen).toMatchObject({ totalMatched: 1, rows: [{ name: "知本", county: "臺東縣", district: "卑南鄉", type: "hot_spring" }] });
  expect(wulai).toMatchObject({ totalMatched: 1, rows: [{ name: "烏來", county: "新北市", district: "烏來區" }] });
  expect(taipei).toMatchObject({ totalMatched: 24, rows: expect.arrayContaining([expect.objectContaining({ name: "頂北投", county: "臺北市" })]) });
  expect(chihpen.sourceRefs[0]).toMatchObject({ checksumSha256: "703083205d872145b281e4bc4277f0fb8e3b924694ec9dc08990a409d67214bf" });
});

it("keeps source blank quality and supports actual-coordinate bbox reads", async () => {
  const executor = new QueryExecutor([hotSpringsSourceCoordinatesAdapter]);
  const blankQuality = await executor.execute({ datasetId: "tw-hot-spring-outcrops", filters: [{ field: "name", op: "eq", value: "地熱谷" }] });
  const chihpen = await executor.execute({ datasetId: "tw-hot-spring-outcrops", bbox: [121, 22.68, 121.02, 22.7] });

  expect(blankQuality).toMatchObject({ totalMatched: 1, rows: [{ name: "地熱谷", quality: "" }] });
  expect(chihpen).toMatchObject({ totalMatched: 1, rows: [{ name: "知本" }] });
  expect(hotSpringsSourceCoordinatesAdapter.descriptor).toMatchObject({
    layerRefs: ["tourHotSprings"],
    geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
  });
  expect(hotSpringsSourceCoordinatesAdapter.descriptor.fields.find(field => field.name === "quality")).toMatchObject({ nullable: true, nullMeaning: expect.stringContaining("空白") });
  expect(registeredDatasetForLayer("tourHotSprings")?.datasetId).toBe("tw-hot-spring-outcrops");
});

it("fails closed when the fixed asset bytes no longer match the verified SHA", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(`${await readFile("public/tourism/hot_springs_national.geojson", "utf8")} `, {
    headers: { "content-type": "application/geo+json" },
  })));

  await expect(new QueryExecutor([hotSpringsSourceCoordinatesAdapter]).execute({ datasetId: "tw-hot-spring-outcrops" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
