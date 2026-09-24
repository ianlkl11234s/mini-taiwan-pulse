import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { culturalFacilitiesSourceCoordinatesAdapter, postOfficesSourceCoordinatesAdapter } from "../civicCultureDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";

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
