import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lineIntersectsBbox, parseLineGeometry } from "../lineGeometry";
import { clearOsmPowerNetworkOwnerCache, createOsmPowerLinesOwnerAdapter, createOsmPowerTowersOwnerAdapter, osmPowerLinesOwnerDescriptor, osmPowerTowersOwnerDescriptor } from "../osmPowerNetworkOwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const runtime = "../runtime/owner-only/osm-power-network";
const analytics = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/energy";
const bboxes = [[121.45, 25.0, 121.62, 25.12], [120.1, 22.9, 120.3, 23.1]] as const;
const inside = (coordinates: readonly [number, number], bbox: readonly number[]) => coordinates[0] >= bbox[0]! && coordinates[0] <= bbox[2]! && coordinates[1] >= bbox[1]! && coordinates[1] <= bbox[3]!;

beforeEach(() => { clearOsmPowerNetworkOwnerCache(); });
afterEach(() => { vi.unstubAllGlobals(); clearOsmPowerNetworkOwnerCache(); });

it("keeps complete lines and matches two independent bbox and tag variants", async () => {
  const source = JSON.parse(await readFile(`${analytics}/osm_power_lines/osm_power_lines_20260615.geojson`, "utf8")) as { features: { geometry: { coordinates: [number, number][] }; properties: { voltage: string | null; line_type: string } }[] };
  const fetcher = async () => new Response(await readFile(`${runtime}/osm_power_lines_20260615.geojson`), { headers: { "content-type": "application/geo+json" } });
  const executor = new QueryExecutor([createOsmPowerLinesOwnerAdapter(fetcher)]);
  for (const [index, bbox] of bboxes.entries()) {
    const expected = source.features.filter(feature => lineIntersectsBbox(parseLineGeometry({ type: "LineString", coordinates: feature.geometry.coordinates }), bbox)).length;
    const result = await executor.execute({ datasetId: osmPowerLinesOwnerDescriptor.datasetId, bbox, select: ["osm_id", "line_type", "voltage", "geometry"], limit: 5 });
    expect(result.totalMatched).toBe(expected);
    if (index === 0 && result.rows.length) expect((result.rows[0]!.geometry as { coordinates: unknown[] }).coordinates.length).toBeGreaterThan(1);
  }
  const voltageNull = await executor.execute({ datasetId: osmPowerLinesOwnerDescriptor.datasetId, bbox: bboxes[0], filters: [{ field: "voltage", op: "eq", value: null }], select: ["osm_id", "voltage"], limit: 5 });
  expect(voltageNull.rows.every(row => row.voltage === null)).toBe(true);
  await expect(executor.execute({ datasetId: osmPowerLinesOwnerDescriptor.datasetId, limit: 1 })).rejects.toThrow("BBOX_REQUIRED");
});

it("matches two tower-place bboxes and retains source nulls", async () => {
  const source = JSON.parse(await readFile(`${analytics}/osm_power_towers/osm_power_towers_20260615.geojson`, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { material: string | null } }[] };
  const fetcher = async () => new Response(await readFile(`${runtime}/osm_power_towers_20260615.geojson`), { headers: { "content-type": "application/geo+json" } });
  const executor = new QueryExecutor([createOsmPowerTowersOwnerAdapter(fetcher)]);
  for (const bbox of bboxes) {
    const expected = source.features.filter(feature => inside(feature.geometry.coordinates, bbox)).length;
    const result = await executor.execute({ datasetId: osmPowerTowersOwnerDescriptor.datasetId, bbox, select: ["osm_id", "material", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
  const nullMaterial = await executor.execute({ datasetId: osmPowerTowersOwnerDescriptor.datasetId, bbox: bboxes[0], filters: [{ field: "material", op: "eq", value: null }], select: ["osm_id", "material"], limit: 100 });
  expect(nullMaterial.rows.every(row => row.material === null)).toBe(true);
  expect(osmPowerTowersOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", query: { supportsBbox: true } }, geometry: { role: "actual", spatialAnalysisEligible: true } });
});
