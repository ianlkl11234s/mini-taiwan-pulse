import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cemeteryOsmAdapter, cemeteryOsmDescriptor } from "../cemeteryOsmDataset";
import { QueryExecutor } from "../queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "../spatialKernel";

const runtime = "../runtime/owner-only/cemetery-osm/cemetery-osm.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/funeral/cemetery_osm/cemetery_osm_20260805.geojson";
type Bbox = readonly [number, number, number, number];
type Feature = { properties: { osm_id: string }; geometry: unknown };

function surface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
async function oracle(bbox: Bbox): Promise<string[]> {
  const source = JSON.parse(await readFile(processed, "utf8")) as { features: Feature[] };
  return source.features.filter(feature => geometriesIntersect(parseSpatialGeometry(feature.geometry), surface(bbox))).map(feature => feature.properties.osm_id);
}

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(runtime), { headers: { "content-type": "application/geo+json", "content-length": "3602036" } }))); });
afterEach(() => vi.unstubAllGlobals());

it.skipIf(!existsSync(runtime))("requires a bbox and exposes only safe source fields with actual full surfaces", async () => {
  const executor = new QueryExecutor([cemeteryOsmAdapter]);
  await expect(executor.execute({ datasetId: cemeteryOsmDescriptor.datasetId, limit: 1 })).rejects.toThrow("BBOX_REQUIRED");
  const result = await executor.execute({ datasetId: cemeteryOsmDescriptor.datasetId, bbox: [121.45, 25, 121.65, 25.15], select: ["record_id", "name", "area_ha", "geometry"], limit: 100 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.rows.every(row => (row.geometry as { type?: unknown }).type === "MultiPolygon")).toBe(true);
  expect(cemeteryOsmDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["operator", "description", "wikidata", "attribution", "license"]));
  expect(cemeteryOsmDescriptor).toMatchObject({ geometry: { type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true }, access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } } });
});

it.skipIf(!existsSync(runtime))("matches independent full-source polygon intersection oracles in Taipei and Kaohsiung", async () => {
  const executor = new QueryExecutor([cemeteryOsmAdapter]);
  for (const bbox of [[121.45, 25, 121.65, 25.15], [120.15, 22.5, 120.45, 22.8]] as const) {
    const expected = await oracle(bbox);
    const result = await executor.execute({ datasetId: cemeteryOsmDescriptor.datasetId, bbox, select: ["record_id"], limit: 100 });
    expect(result.totalMatched).toBe(expected.length);
    expect(result.rows.map(row => String(row.record_id))).toEqual(expected.slice(0, 100));
    expect(result.cost).toMatchObject({ rowsScanned: 3_229, bytesScanned: 3_602_036 });
  }
});

it("fails closed when the bound owner-only bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([cemeteryOsmAdapter]).execute({ datasetId: cemeteryOsmDescriptor.datasetId, bbox: [121.45, 25, 121.65, 25.15], limit: 1 })).rejects.toThrow("CEMETERY_OSM_ASSET_MISMATCH");
});
