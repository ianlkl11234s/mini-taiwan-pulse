import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { agriPoiSourceCoordinatesAdapter } from "../agriPoiDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/agriculture/agriculture_pois.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync("public/agriculture/agriculture_pois.geojson"))("registers all three agriculture POI source batches and supports a new-place variant", async () => {
  const executor = new QueryExecutor([agriPoiSourceCoordinatesAdapter]);
  const tainan = await executor.execute({
    datasetId: "tw-agri-pois-source-coordinates",
    filters: [{ field: "poi_name", op: "eq", value: "走馬瀨休閒農場" }],
  });
  const tainanTownship = await executor.execute({
    datasetId: "tw-agri-pois-source-coordinates",
    filters: [{ field: "TOWNID", op: "eq", value: "D19" }],
  });

  expect(tainan).toMatchObject({
    totalMatched: 1,
    rows: [{ poi_name: "走馬瀨休閒農場", poi_type: "leisure_farm", source_dataset_id: "177247", source_slug: "leisure_farms_2025", TOWNID: "D19", AA45: "D", AA46: "19", geometry: { type: "Point", coordinates: [120.42506771992176, 23.137429390477962] } }],
  });
  expect(tainanTownship.totalMatched).toBeGreaterThan(0);
  expect(tainan.sourceRefs[0]).toMatchObject({ checksumSha256: "47416af00d3e8e02fae1f1f625010f09a673659028f6bfc1c556413e8cafc207" });
  expect(registeredDatasetForLayer("agriPOI")?.datasetId).toBe("tw-agri-pois-source-coordinates");
  expect(agriPoiSourceCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
  expect(agriPoiSourceCoordinatesAdapter.descriptor.coverage).toContain("current opening／service status unknown");
});

it("fails closed if the pinned agriculture POI bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', {
    headers: { "content-type": "application/geo+json" },
  })));
  clearPointDatasetCache();
  await expect(new QueryExecutor([agriPoiSourceCoordinatesAdapter]).execute({ datasetId: "tw-agri-pois-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
