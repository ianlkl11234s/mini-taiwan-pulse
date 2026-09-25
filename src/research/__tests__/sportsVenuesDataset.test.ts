import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { sportsVenuesSourceCoordinatesAdapter } from "../sportsVenuesDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/research/sports-venues-source-20260704.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("uses one fixed source for all five mutually exclusive sports layers", async () => {
  const executor = new QueryExecutor([sportsVenuesSourceCoordinatesAdapter]);
  const expected = [
    ["學校場館", 12221], ["其他公共場館", 1135], ["民營場館", 691],
    ["運動公園/開放空間", 596], ["國民運動中心", 357],
  ] as const;
  for (const [layer, count] of expected) {
    const result = await executor.execute({ datasetId: "tw-sports-venues-source-coordinates", filters: [{ field: "layer", op: "eq", value: layer }], select: ["venue_id", "layer", "geometry"], limit: 1 });
    expect(result.totalMatched).toBe(count);
    expect(result.sourceRefs[0]?.checksumSha256).toBe("28da39f158143c8dfd75ea8dd3755d9e91a3c56bd9fbabfa07e953a410c0dccb");
  }
  expect(expected.reduce((sum, [, count]) => sum + count, 0)).toBe(15000);
  expect(sportsVenuesSourceCoordinatesAdapter.descriptor.layerRefs).toHaveLength(5);
});

it("preserves observed access status and missing area in a bounded Taitung query", async () => {
  const executor = new QueryExecutor([sportsVenuesSourceCoordinatesAdapter]);
  const result = await executor.execute({ datasetId: "tw-sports-venues-source-coordinates", bbox: [121.13, 22.74, 121.17, 22.78], select: ["name", "layer", "open_status", "area_sqm", "geometry"], limit: 50 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.analysisComplete).toBe(true);
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(sportsVenuesSourceCoordinatesAdapter.descriptor.fields.find(field => field.name === "area_sqm")?.nullMeaning).toContain("不是 0");
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([sportsVenuesSourceCoordinatesAdapter]).execute({ datasetId: "tw-sports-venues-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
