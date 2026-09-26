import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { forestRecreationOwnerAdapter, forestRecreationOwnerDescriptor } from "../forestRecreationOwnerDataset";

const runtime = "../runtime/owner-only/forest-recreation/forest-recreation-owner-1151.geojson";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/forest_recreation_areas/forest_recreation_areas.geojson";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(runtime)))); });
afterEach(() => vi.unstubAllGlobals());
function center(geometry: { type: string; coordinates: unknown }): readonly [number, number, number, number] { const flat = geometry.type === "Polygon" ? (geometry.coordinates as number[][][]).flat() : (geometry.coordinates as number[][][][]).flat(2); const xs = flat.map(point => point[0]!), ys = flat.map(point => point[1]!); const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2; return [x - .00001, y - .00001, x + .00001, y + .00001]; }

it.skipIf(!existsSync(runtime))("keeps 23 official source surfaces and source-null attributes distinct", async () => {
  const result = await new QueryExecutor([forestRecreationOwnerAdapter]).execute({ datasetId: forestRecreationOwnerDescriptor.datasetId, select: ["ename", "park", "area_ha"], limit: 23 });
  expect(result.totalMatched).toBe(23); expect(result.cost).toMatchObject({ rowsScanned: 23 });
  expect(result.rows.find(row => row.ename === "Huisun Forest Recreation Area")).toMatchObject({ park: null, area_ha: 1567 });
  expect(forestRecreationOwnerDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true });
});

it.skipIf(!existsSync(runtime))("uses full-source Polygon intersection for two places and Cilan's park variants", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { properties: { ENAME: string; PARK: string | null }; geometry: { type: string; coordinates: unknown } }[] };
  const executor = new QueryExecutor([forestRecreationOwnerAdapter]);
  for (const name of ["Huisun Forest Recreation Area", "Alishan Forest Recreation Area"]) { const feature = source.features.find(item => item.properties.ENAME === name)!; const result = await executor.execute({ datasetId: forestRecreationOwnerDescriptor.datasetId, bbox: center(feature.geometry), select: ["ename", "area_ha"], limit: 5 }); expect(result.rows).toHaveLength(1); expect(result.rows[0]!.ename).toBe(name); }
  const cilan = source.features.filter(item => item.properties.ENAME === "Cilan Forest Recreation Area"); expect(cilan).toHaveLength(2); for (const feature of cilan) { const result = await executor.execute({ datasetId: forestRecreationOwnerDescriptor.datasetId, bbox: center(feature.geometry), filters: [{ field: "park", op: "eq", value: feature.properties.PARK! }], select: ["ename", "park"], limit: 2 }); expect(result.rows).toEqual([{ ename: feature.properties.ENAME, park: feature.properties.PARK }]); }
});
