import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { tourAttractionsSourceCoordinatesAdapter } from "../tourAttractionsDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/tour-attractions-source-20260722.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads the fixed V2.1 attraction snapshot without converting unreported visitor values to zero", async () => {
  const executor = new QueryExecutor([tourAttractionsSourceCoordinatesAdapter]);
  const all = await executor.execute({ datasetId: "tw-tour-attractions-source-coordinates", select: ["id", "name", "annual_visitors_2024", "geometry"], limit: 1 });
  const missingVisitors = await executor.execute({ datasetId: "tw-tour-attractions-source-coordinates", filters: [{ field: "category", op: "eq", value: "Nature" }], select: ["id", "name", "category", "geometry"], limit: 1 });
  expect(all.totalMatched).toBe(6070);
  expect(all.sourceRefs[0]?.checksumSha256).toBe("ccdff175dfce339bf68a6ae125da470de1b3f018df62f346d474ebffeb9f4b6d");
  expect(all.rows[0]).toMatchObject({ id: "Attraction_345040000G_000001", name: "太平山國家森林遊樂區", geometry: { type: "Point" } });
  expect(missingVisitors.totalMatched).toBeGreaterThan(0);
  expect(tourAttractionsSourceCoordinatesAdapter.descriptor.fields.find(field => field.name === "annual_visitors_2024")?.nullable).toBe(true);
});
