import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { campusPolygonOwnerAdapter, campusPolygonOwnerDescriptor } from "../campusPolygonOwnerDataset";
import { QueryExecutor } from "../queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "../spatialKernel";

const root = "../runtime/owner-only/campus-polygon/";
const prefix = "/__local-research-owner-only/campus-polygon/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/education/campus_polygon/campus_polygon_20260807.geojson";
type Bbox = readonly [number, number, number, number];
type SourceFeature = { geometry: unknown; properties: { school_level: string; school_level_zh: string | null; county: string; school_name: string } };
function surface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
async function source(): Promise<SourceFeature[]> { return (JSON.parse(await readFile(sourcePath, "utf8")) as { features: SourceFeature[] }).features; }
async function oracle(bbox: Bbox, schoolLevel?: string): Promise<SourceFeature[]> { return (await source()).filter(feature => (!schoolLevel || feature.properties.school_level === schoolLevel) && geometriesIntersect(parseSpatialGeometry(feature.geometry), surface(bbox))); }

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => vi.unstubAllGlobals());

it("pins raw, processed and display receipts; bbox is required", async () => {
  const executor = new QueryExecutor([campusPolygonOwnerAdapter]);
  await expect(executor.execute({ datasetId: campusPolygonOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(campusPolygonOwnerDescriptor).toMatchObject({ layerRefs: ["eduCampusPolygon", "eduCampusArea"], geometry: { type: "Polygon", role: "actual", spatialAnalysisEligible: true }, access: { mode: "owner_only", query: { supportsBbox: true } } });
  expect(campusPolygonOwnerDescriptor.versions[0]?.checksumSha256).toBe("950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff");
  expect(campusPolygonOwnerDescriptor.source.lineage).toContain("3735e97933bef4f93d163a607d902607c1c008f1481ad3f674ca4120d74e3f15");
});

it("matches independent full-source Polygon oracles in two counties and a school-level variant", async () => {
  const executor = new QueryExecutor([campusPolygonOwnerAdapter]);
  const cases: readonly [Bbox, string | undefined][] = [
    [[121.49, 25.02, 121.55, 25.08], undefined],
    [[121.49, 25.02, 121.55, 25.08], "elementary"],
    [[121.35, 23.97, 121.50, 24.08], undefined],
  ];
  for (const [bbox, schoolLevel] of cases) {
    const expected = await oracle(bbox, schoolLevel);
    const result = await executor.execute({ datasetId: campusPolygonOwnerDescriptor.datasetId, bbox, ...(schoolLevel ? { filters: [{ field: "school_level", op: "eq" as const, value: schoolLevel }] } : {}), select: ["record_id", "school_level"], limit: 100 });
    expect(result.totalMatched).toBe(expected.length);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(3_000);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("retains non-school rows and the separate experimental null Chinese-level semantics", async () => {
  const sourceRows = (await source()).filter(feature => feature.properties.school_level === "non_school");
  expect(sourceRows).toHaveLength(12);
  expect(sourceRows.every(feature => feature.properties.school_level_zh === "非學校設施")).toBe(true);
  const first = sourceRows[0]!; const point = (first.geometry as { coordinates: number[][][] }).coordinates[0]![0]! as [number, number];
  const result = await new QueryExecutor([campusPolygonOwnerAdapter]).execute({ datasetId: campusPolygonOwnerDescriptor.datasetId, bbox: [point[0], point[1], point[0], point[1]], filters: [{ field: "school_level", op: "eq", value: "non_school" }], select: ["school_level", "school_level_zh"], limit: 20 });
  expect(result.rows).toContainEqual({ school_level: "non_school", school_level_zh: "非學校設施" });
  expect(campusPolygonOwnerDescriptor.coverage).toContain("顯示圖層另行排除");
  expect((await source()).filter(feature => feature.properties.school_level === "experimental" && feature.properties.school_level_zh === null)).toHaveLength(12);
});

it("fails closed when a shard or manifest no longer matches its receipt", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"schemaVersion":"pulse-campus-polygon-surface-partitions/1"}')));
  await expect(new QueryExecutor([campusPolygonOwnerAdapter]).execute({ datasetId: campusPolygonOwnerDescriptor.datasetId, bbox: [121.49, 25.02, 121.55, 25.08], limit: 1 })).rejects.toThrow("CAMPUS_POLYGON_ASSET_MISMATCH");
});
