import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { wraDamWeirsOwnerAdapter, wraDamWeirsOwnerDescriptor } from "../wraWaterSystemsOwnerDatasets";

const root = "../runtime/owner-only/wra-water-systems/";
const prefix = "/__local-research-owner-only/wra-water-systems/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/water_resources/dam_weirs_wra/dam_weirs_wra.geojson";
type Bbox = readonly [number, number, number, number];
async function oracle(bbox: Bbox): Promise<number> { const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] } }[] }; return source.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]; }).length; }
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps WRA dam points distinct from the 111-point display composite and omits corrupted Chinese names", async () => {
  const descriptor = wraDamWeirsOwnerDescriptor; expect(descriptor.layerRefs).toEqual(["waterReservoirs"]); expect(descriptor.coverage).toContain("98 Point"); expect(descriptor.source.lineage).toContain("not version-equivalent"); expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["name", "status", "basin_name", "river_name"])); expect(descriptor.geometry).toMatchObject({ type: "Point", role: "proxy", spatialAnalysisEligible: false });
});
it.skipIf(!existsSync(`${root}wra-dam-weirs-owner-20260519.geojson`))("matches independent north and south WRA source bboxes, preserving null engineering measures", async () => {
  const executor = new QueryExecutor([wraDamWeirsOwnerAdapter]); for (const bbox of [[121.45, 24.85, 121.65, 25.1], [120.3, 22.7, 120.6, 23.1]] as const) { const result = await executor.execute({ datasetId: wraDamWeirsOwnerDescriptor.datasetId, bbox, select: ["source_dam_id", "name_en", "dam_height_m", "capacity_m3"], limit: 98 }); expect(result.totalMatched).toBe(await oracle(bbox)); expect(result.cost.rowsScanned).toBe(98); }
  const missing = await executor.execute({ datasetId: wraDamWeirsOwnerDescriptor.datasetId, bbox: [120.36, 23.10, 120.37, 23.11], select: ["source_dam_id", "name_en", "dam_height_m", "capacity_m3"], limit: 1 }); expect(missing.rows).toEqual([{ source_dam_id: "wra:0", name_en: null, dam_height_m: null, capacity_m3: null }]);
});
