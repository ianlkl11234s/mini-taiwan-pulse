import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { culturalFacilitiesSourceCoordinatesAdapter, postOfficesSourceCoordinatesAdapter } from "../civicCultureDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers pinned source-coordinate postal and cultural facility datasets", async () => {
  const postalBytes = await readFile("public/civic_facilities/post_offices_national.geojson");
  const cultureBytes = await readFile("public/culture/cultural_facilities_national.geojson");
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(url.includes("post_offices") ? postalBytes : cultureBytes, { headers: { "content-type": "application/geo+json" } }))));

  const postal = await postOfficesSourceCoordinatesAdapter.read({});
  const culture = await culturalFacilitiesSourceCoordinatesAdapter.read({});
  expect(postOfficesSourceCoordinatesAdapter.descriptor).toMatchObject({ datasetId: "tw-post-offices-source-coordinates", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, versions: [{ checksumSha256: "ee8b89fc042fa891a0924f5d069dbed45591ad64eef8daecb9a1d6ffa1684770" }] });
  expect(culturalFacilitiesSourceCoordinatesAdapter.descriptor).toMatchObject({ datasetId: "tw-cultural-facilities-source-coordinates", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, versions: [{ checksumSha256: "0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d" }] });
  expect(postal.rows).toHaveLength(1278);
  expect(culture.rows).toHaveLength(787);
  expect(postal.exclusions).not.toHaveProperty("excluded_by_selection");
  expect(culture.exclusions).not.toHaveProperty("excluded_by_selection");
  expect(culturalFacilitiesSourceCoordinatesAdapter.descriptor.coverage).toContain("383 筆缺座標已在產物前排除");
  expect(culturalFacilitiesSourceCoordinatesAdapter.descriptor.fields.map(field => field.name)).not.toContain("coord_status");
});

it("maps the verified cultural layer and answers new-place and 台/臺 variants", async () => {
  const bytes = await readFile("public/culture/cultural_facilities_national.geojson");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));
  const executor = new QueryExecutor([culturalFacilitiesSourceCoordinatesAdapter]);
  const matsu = await executor.execute({ datasetId: "tw-cultural-facilities-source-coordinates", filters: [{ field: "city", op: "eq", value: "連江縣" }] });
  const taipei = await executor.execute({ datasetId: "tw-cultural-facilities-source-coordinates", filters: [{ field: "city", op: "eq", value: "台北市" }], limit: 2 });
  expect(registeredDatasetForLayer("culturalFacilities")?.datasetId).toBe("tw-cultural-facilities-source-coordinates");
  expect(matsu).toMatchObject({ totalMatched: 1, rows: [{ name: "連江縣政府文化處", city: "連江縣", geometry: { type: "Point", coordinates: [119.927222, 26.151111] } }] });
  expect(taipei.totalMatched).toBe(221);
  expect(taipei.rows).toHaveLength(2);
});

it("maps the postal layer and reads a new island location with 台/臺 normalization", async () => {
  const bytes = await readFile("public/civic_facilities/post_offices_national.geojson");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));
  const executor = new QueryExecutor([postOfficesSourceCoordinatesAdapter]);
  const westJu = await executor.execute({ datasetId: "tw-post-offices-source-coordinates", filters: [{ field: "name", op: "eq", value: "馬祖西莒郵局" }] });
  const taipei = await executor.execute({ datasetId: "tw-post-offices-source-coordinates", filters: [{ field: "city", op: "eq", value: "台北市" }], limit: 2 });
  expect(registeredDatasetForLayer("postOffices")?.datasetId).toBe("tw-post-offices-source-coordinates");
  expect(westJu).toMatchObject({ totalMatched: 1, rows: [{ name: "馬祖西莒郵局", city: "連江縣", district: "莒光鄉", geometry: { type: "Point", coordinates: [119.93339, 25.97175] } }] });
  expect(taipei.totalMatched).toBe(152);
  expect(taipei.rows).toHaveLength(2);
});
