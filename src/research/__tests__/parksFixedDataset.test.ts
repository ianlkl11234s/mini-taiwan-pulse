import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parksFixedPointAdapter } from "../parksFixedDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const sourcePath = "public/urban/parks_taipei.geojson";
const taipeiBbox = [121.48, 25.02, 121.6, 25.15] as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sourcePath), {
    headers: { "content-type": "application/geo+json" },
  })));
});

afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sourcePath))("matches the Mini static city bbox oracle and retains source null variants", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }[];
  };
  const expectedTaipei = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) =>
    lng >= taipeiBbox[0] && lng <= taipeiBbox[2] && lat >= taipeiBbox[1] && lat <= taipeiBbox[3],
  ).length;
  expect(expectedTaipei).toBe(1_056);

  const executor = new QueryExecutor([parksFixedPointAdapter]);
  const city = await executor.execute({
    datasetId: "tw-urban-parks-fixed-20260705", bbox: taipeiBbox, select: ["city", "geometry"], limit: 1,
  });
  const taichungUnknownPlayground = await executor.execute({
    datasetId: "tw-urban-parks-fixed-20260705",
    filters: [{ field: "city", op: "eq", value: "臺中市" }, { field: "has_playground", op: "eq", value: null }],
    select: ["district", "address", "area_sqm", "has_playground"], limit: 1,
  });
  const taipeiFacility = await executor.execute({
    datasetId: "tw-urban-parks-fixed-20260705", filters: [{ field: "source_dataset", op: "eq", value: "136476" }],
    select: ["district", "address", "area_sqm", "has_playground"], limit: 1,
  });

  expect(city).toMatchObject({ totalMatched: expectedTaipei, freshness: "unknown" });
  expect(city.rows[0]?.geometry).toMatchObject({ type: "Point" });
  expect(taichungUnknownPlayground).toMatchObject({ totalMatched: 756, rows: [{ has_playground: null }] });
  expect(taipeiFacility).toMatchObject({ totalMatched: 520, rows: [{ district: expect.any(String), address: null, area_sqm: null, has_playground: expect.any(Boolean) }] });
  expect(parksFixedPointAdapter.descriptor).toMatchObject({
    layerRefs: ["parksTaipei"],
    geometry: { role: "actual", spatialAnalysisEligible: true },
    coverage: expect.stringContaining("臺中市 1,081"),
  });
  expect(parksFixedPointAdapter.descriptor.fields.find(field => field.name === "district")?.nullMeaning).toContain("沒有區名");
  expect(parksFixedPointAdapter.descriptor.fields.find(field => field.name === "has_playground")?.nullMeaning).toContain("無法判定");
  expect(parksFixedPointAdapter.descriptor.source.lineage).toContain("未跨源去重");
  expect(city.sourceRefs[0]?.checksumSha256).toBe("2f015b8f1f5cccc33db3abb1dae6d8bc9918c937288dbfb0a5c2aa43e9acf38a");
});
