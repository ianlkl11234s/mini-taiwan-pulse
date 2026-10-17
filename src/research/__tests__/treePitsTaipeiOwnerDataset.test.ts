import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { treePitsTaipeiOwnerAdapter, treePitsTaipeiOwnerDescriptor } from "../treePitsTaipeiOwnerDataset";
import { QueryExecutor } from "../queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "../spatialKernel";

const root = "../runtime/owner-only/tree-pits-taipei/";
const prefix = "/__local-research-owner-only/tree-pits-taipei/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_open_space/tree_pits_taipei/tree_pits_taipei_20260714.geojson";
type Bbox = readonly [number, number, number, number];
type SourceFeature = { geometry: unknown; properties: { pit_id: number; pit_type: string } };
function surface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
async function source(): Promise<SourceFeature[]> { return (JSON.parse(await readFile(sourcePath, "utf8")) as { features: SourceFeature[] }).features; }
async function oracle(bbox: Bbox, pitType?: string): Promise<SourceFeature[]> { return (await source()).filter(feature => (!pitType || feature.properties.pit_type === pitType) && geometriesIntersect(parseSpatialGeometry(feature.geometry), surface(bbox))); }

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => vi.unstubAllGlobals());

it("requires a bbox and describes the fixed owner-only actual MultiPolygon snapshot", async () => {
  const executor = new QueryExecutor([treePitsTaipeiOwnerAdapter]);
  await expect(executor.execute({ datasetId: treePitsTaipeiOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(treePitsTaipeiOwnerDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true });
  expect(treePitsTaipeiOwnerDescriptor.license).toContain("OGDL-Taiwan-1.0");
  expect(treePitsTaipeiOwnerDescriptor.valueSemantics.stale).toContain("不聲稱目前現況");
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches independent full-source oracles for two Taipei bboxes and a pit-type selector", async () => {
  const executor = new QueryExecutor([treePitsTaipeiOwnerAdapter]);
  const cases: readonly [Bbox, string | undefined][] = [
    [[121.500, 25.029, 121.510, 25.039], undefined],
    [[121.500, 25.029, 121.510, 25.039], "樹穴"],
    [[121.500, 25.120, 121.515, 25.132], undefined],
  ];
  for (const [bbox, pitType] of cases) {
    const expected = await oracle(bbox, pitType);
    const result = await executor.execute({ datasetId: treePitsTaipeiOwnerDescriptor.datasetId, bbox, ...(pitType ? { filters: [{ field: "pit_type", op: "eq" as const, value: pitType }] } : {}), select: ["pit_id", "pit_type"], limit: 100 });
    expect(result.totalMatched).toBe(expected.length);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it.skipIf(!existsSync(`${root}manifest.json`))("deduplicates a cross-cell source feature and includes a boundary touch while preserving hole exclusion semantics", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const ordinalCounts = new Map<number, number>();
  for (const shard of manifest.shards) {
    const bytes = await readFile(`${root}${shard.path}`); const collection = JSON.parse((await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text())) as { features: { sourceOrdinal: number }[] };
    for (const feature of collection.features) ordinalCounts.set(feature.sourceOrdinal, (ordinalCounts.get(feature.sourceOrdinal) ?? 0) + 1);
  }
  const ordinal = [...ordinalCounts].find(([, count]) => count > 1)?.[0]; expect(ordinal).toBeTypeOf("number");
  const feature = (await source())[ordinal!]; if (!feature) throw new Error("TEST_CROSS_CELL_SOURCE_NOT_FOUND"); const point = (feature.geometry as { coordinates: number[][][][] }).coordinates[0]![0]![0]! as [number, number];
  const bbox: Bbox = [point[0], point[1], point[0], point[1]];
  const result = await new QueryExecutor([treePitsTaipeiOwnerAdapter]).execute({ datasetId: treePitsTaipeiOwnerDescriptor.datasetId, bbox, filters: [{ field: "pit_id", op: "eq", value: feature.properties.pit_id }], select: ["pit_id"], limit: 1 });
  expect(result.rows).toEqual([{ pit_id: feature.properties.pit_id }]);
  const holed = parseSpatialGeometry({ type: "MultiPolygon", coordinates: [[[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]]] });
  expect(geometriesIntersect(holed, surface([1.25, 1.25, 2.75, 2.75]))).toBe(false);
  expect(geometriesIntersect(holed, surface([0, 2, 0, 2]))).toBe(true);
});

it.skipIf(!existsSync(`${root}manifest.json`))("fails closed before a broad bbox can exceed source scan budgets", async () => {
  await expect(new QueryExecutor([treePitsTaipeiOwnerAdapter]).execute({ datasetId: treePitsTaipeiOwnerDescriptor.datasetId, bbox: [121.45, 24.95, 121.65, 25.20], limit: 1 })).rejects.toThrow("SCAN_BUDGET_EXCEEDED");
});
