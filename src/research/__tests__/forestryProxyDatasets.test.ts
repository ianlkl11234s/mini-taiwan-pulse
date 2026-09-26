import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { forestryProxyAdapters } from "../forestryProxyDatasets";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";
import { summarizeDatasetLayer } from "../datasetLayerStatistics";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const path = String(input instanceof Request ? input.url : input);
    if (!/^\/forestry\/(flat_forest_parks|forest_education_centers)\.geojson$/.test(path)) throw new Error(`Unexpected asset: ${path}`);
    const body = await readFile(new URL(`../../../public${path}`, import.meta.url));
    return new Response(body, { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });

it("queries two new places by source text without treating county centroids as locations", async () => {
  const executor = new QueryExecutor(forestryProxyAdapters);
  const park = await executor.execute({ datasetId: "tw-flat-forest-parks", filters: [{ field: "admin_name", op: "contains", value: "屏東" }] });
  const center = await executor.execute({ datasetId: "tw-forest-education-centers", filters: [{ field: "address", op: "contains", value: "宜蘭" }] });
  expect(park).toMatchObject({ totalMatched: 1, rows: [{ name: "林後四林平地森林園區" }] });
  expect(center).toMatchObject({ totalMatched: 1, rows: [{ name: "羅東自然教育中心" }] });
  expect(park.sourceRefs[0]?.checksumSha256).toBe("76f0764c475902eba9780802e9919f8aa035f98ef0638867ee87bf513c8f608c");
  for (const adapter of forestryProxyAdapters) {
    expect(adapter.descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
    expect(adapter.descriptor.supportedOperations).toEqual(["query_records", "aggregate"]);
    await expect(executor.execute({ datasetId: adapter.descriptor.datasetId, bbox: [120, 22, 122, 26] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
  }
});

it("answers wording variants with complete source counts and no spatial inference", async () => {
  const executor = new QueryExecutor(forestryProxyAdapters);
  const allParks = await executor.execute({ datasetId: "tw-flat-forest-parks" });
  const countyCenter = await executor.execute({ datasetId: "tw-forest-education-centers", filters: [{ field: "address", op: "contains", value: "嘉義縣" }] });
  expect(allParks.totalMatched).toBe(3);
  expect(countyCenter).toMatchObject({ totalMatched: 1, rows: [{ name: "觸口自然教育中心" }] });
  expect(executor.describe("tw-forest-education-centers")?.coverage).toContain("8 筆自然教育中心來源紀錄");
  expect(registeredDatasetForLayer("forestFlatParks")?.datasetId).toBe("tw-flat-forest-parks");
  const layerResult = await summarizeDatasetLayer({ layerKey: "forestEducationCenters", filters: [{ field: "address", value: "602 嘉義縣番路鄉新福村1鄰五虎寮18號" }] }, new Set());
  expect(layerResult).toMatchObject({ datasetId: "tw-forest-education-centers", totalMatched: 1, bounds: null });
});
