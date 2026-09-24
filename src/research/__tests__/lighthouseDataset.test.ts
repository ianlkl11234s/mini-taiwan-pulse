import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lighthousesSourceCoordinatesAdapter } from "../lighthouseDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/geo/lighthouse.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("queries pinned lighthouse source coordinates by place and normalized name variant", async () => {
  const executor = new QueryExecutor([lighthousesSourceCoordinatesAdapter]);
  const greenIsland = await executor.execute({ datasetId: "tw-lighthouses-source-coordinates", filters: [{ field: "name", op: "contains", value: "綠島" }] });
  const taichungVariant = await executor.execute({ datasetId: "tw-lighthouses-source-coordinates", filters: [{ field: "name", op: "eq", value: "台中港燈塔" }] });

  expect(greenIsland).toMatchObject({ totalMatched: 1, rows: [{ name: "綠島燈塔", source_lat_dms: `22° 40' 34.6"`, source_lon_dms: `121° 27' 59.3"` }] });
  expect(taichungVariant).toMatchObject({ totalMatched: 1, rows: [{ name: "臺中港燈塔" }] });
  expect(greenIsland.sourceRefs[0]).toMatchObject({ checksumSha256: "83d159331d1a8b0e4251f9460894d0192d2538b90710d3186525c75ca6f96a00" });
});

it("keeps direct source coordinates eligible for bbox and nearest analysis", async () => {
  const executor = new QueryExecutor([lighthousesSourceCoordinatesAdapter]);
  const greenIsland = await executor.execute({ datasetId: "tw-lighthouses-source-coordinates", bbox: [121.45, 22.65, 121.48, 22.7] });

  expect(greenIsland).toMatchObject({ totalMatched: 1, rows: [{ name: "綠島燈塔" }] });
  expect(lighthousesSourceCoordinatesAdapter.descriptor).toMatchObject({
    layerRefs: ["lighthouses"],
    geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
  });
  expect(lighthousesSourceCoordinatesAdapter.descriptor.access.query.supportsBbox).toBe(true);
  expect(lighthousesSourceCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
  expect(lighthousesSourceCoordinatesAdapter.descriptor.coverage).toContain("日期 unknown");
  expect(registeredDatasetForLayer("lighthouses")?.datasetId).toBe("tw-lighthouses-source-coordinates");
});
