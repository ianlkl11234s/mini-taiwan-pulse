import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { clearHikingTrailsOwnerCache, hikingTrailsOwnerDescriptor, createHikingTrailsOwnerAdapter } from "../hikingTrailsOwnerDataset";

const runtime = "../runtime/owner-only/hiking-trails/";
const prefix = "/__local-research-owner-only/hiking-trails/";
const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/hiking_trails/hiking_trails.geojson";
beforeEach(() => { clearHikingTrailsOwnerCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${runtime}${url.slice(prefix.length)}`)))); });
afterEach(() => { vi.unstubAllGlobals(); clearHikingTrailsOwnerCache(); });

function firstPosition(geometry: { type: string; coordinates: unknown }): [number, number] { return geometry.type === "LineString" ? (geometry.coordinates as [number, number][])[0]! : (geometry.coordinates as [number, number][][])[0]![0]!; }

it("matches two independent source-place oracles while preserving source, license, and path geometry", async () => {
  const collection = JSON.parse(await readFile(source, "utf8")) as { features: { properties: { source: string; source_id: string; name: string | null }; geometry: { type: string; coordinates: unknown } }[] };
  const targets = [
    collection.features.find(feature => feature.properties.source === "A_forest" && feature.properties.source_id === "002")!,
    collection.features.find(feature => feature.properties.source === "B_osm" && feature.properties.source_id === "way/25214129")!,
  ];
  const executor = new QueryExecutor([createHikingTrailsOwnerAdapter()]);
  for (const target of targets) {
    const [lng, lat] = firstPosition(target.geometry);
    const result = await executor.execute({ datasetId: hikingTrailsOwnerDescriptor.datasetId, bbox: [lng, lat, lng, lat], filters: [{ field: "source_id", op: "eq", value: target.properties.source_id }], select: ["source", "source_license", "source_id", "name", "geometry"], limit: 10 });
    expect(result.rows).toContainEqual(expect.objectContaining({ source: target.properties.source, source_id: target.properties.source_id, name: target.properties.name, geometry: expect.objectContaining({ type: "MultiLineString" }) }));
    expect(result.rows[0]!.source_license).toContain(target.properties.source === "B_osm" ? "ODbL-1.0" : "OGDL-Taiwan-1.0");
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("requires a bounded place and retains the source-null semantics in its contract", async () => {
  const executor = new QueryExecutor([createHikingTrailsOwnerAdapter()]);
  await expect(executor.execute({ datasetId: hikingTrailsOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(hikingTrailsOwnerDescriptor.geometry).toMatchObject({ role: "actual", spatialAnalysisEligible: true });
  expect(hikingTrailsOwnerDescriptor.coverage).toContain("name 缺 1,107");
  expect(hikingTrailsOwnerDescriptor.coverage).toContain("region 缺 6,563");
  expect(hikingTrailsOwnerDescriptor.license).toContain("© OpenStreetMap contributors");
});
