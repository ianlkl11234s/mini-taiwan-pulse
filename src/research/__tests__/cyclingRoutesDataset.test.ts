import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { cyclingRoutesAdapter, cyclingRoutesDescriptor } from "../cyclingRoutesDataset";
import { lineIntersectsBbox, parseLineGeometry } from "../lineGeometry";

const path = "public/geo/cycling_routes.geojson";
type Bbox = readonly [number, number, number, number];
type Feature = { geometry: unknown; properties: { City: string; RouteName: string } };
async function source(): Promise<Feature[]> { return (JSON.parse(await readFile(path, "utf8")) as { features: Feature[] }).features; }
async function oracle(bbox: Bbox, city?: string): Promise<number[]> { return (await source()).flatMap((feature, index) => (!city || feature.properties.City === city) && lineIntersectsBbox(parseLineGeometry(feature.geometry), bbox) ? [index + 1] : []); }
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(path), { headers: { "content-length": "4384551" } }))); });
afterEach(() => vi.unstubAllGlobals());

it("tests actual line crossing, boundary touch and bbox-only near miss", () => {
  const bbox: Bbox = [0, 0, 1, 1];
  expect(lineIntersectsBbox(parseLineGeometry({ type: "LineString", coordinates: [[-1, 0.5], [2, 0.5]] }), bbox)).toBe(true);
  expect(lineIntersectsBbox(parseLineGeometry({ type: "MultiLineString", coordinates: [[[1, 1], [2, 2]]] }), bbox)).toBe(true);
  expect(lineIntersectsBbox(parseLineGeometry({ type: "LineString", coordinates: [[-1, 0.5], [0.5, 2]] }), bbox)).toBe(false);
});

it("requires bbox and preserves fixed line source semantics", async () => {
  await expect(new QueryExecutor([cyclingRoutesAdapter]).execute({ datasetId: cyclingRoutesDescriptor.datasetId, limit: 1 })).rejects.toThrow("BBOX_REQUIRED");
  expect(cyclingRoutesDescriptor.geometry).toMatchObject({ type: "MultiLineString", role: "actual", spatialAnalysisEligible: true });
  expect(cyclingRoutesDescriptor.valueSemantics.stale).toContain("FinishedTime");
});

it.skipIf(!existsSync(path))("matches complete source at two places and a city variant", async () => {
  const cases: readonly [Bbox, string | undefined][] = [
    [[121.50, 25.03, 121.51, 25.04], undefined],
    [[121.50, 25.03, 121.51, 25.04], "臺北市"],
    [[120.65, 24.14, 120.66, 24.15], undefined],
  ];
  for (const [bbox, city] of cases) {
    const expected = await oracle(bbox, city);
    const result = await new QueryExecutor([cyclingRoutesAdapter]).execute({ datasetId: cyclingRoutesDescriptor.datasetId, bbox, ...(city ? { filters: [{ field: "city", op: "eq" as const, value: city }] } : {}), select: ["route_id", "route_name", "city"], limit: 100 });
    expect(result.totalMatched).toBe(expected.length);
    expect(result.rows.map(row => Number(row.route_id)).sort((a, b) => a - b)).toEqual(expected);
    expect(result.cost.rowsScanned).toBe(1_749);
  }
});

it.skipIf(!existsSync(path))("rejects mutated source bytes", async () => {
  const bytes = await readFile(path); const altered = new Uint8Array(bytes); altered[100] = altered[100] === 65 ? 66 : 65;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(altered, { headers: { "content-length": String(altered.byteLength) } })));
  await expect(new QueryExecutor([cyclingRoutesAdapter]).execute({ datasetId: cyclingRoutesDescriptor.datasetId, bbox: [121.50, 25.03, 121.51, 25.04], limit: 1 })).rejects.toThrow("CYCLING_SHAPES_SOURCE_MISMATCH");
});
