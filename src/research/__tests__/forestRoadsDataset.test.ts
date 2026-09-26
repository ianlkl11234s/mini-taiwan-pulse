import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { parseLineGeometry } from "../linePolygonAnalysis";
import { clearForestRoadSnapshotCache, createForestRoadsAdapter, forestRoadsDescriptor } from "../forestRoadsDataset";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/research-public/forest-roads/";
const fetchSnapshot = async () => new Response(await readFile(`${root}forest-roads-2d.geojson`), { headers: { "content-type": "application/geo+json" } });

it("reads the SHA-bound 107-line snapshot with complete, explicitly 2D geometry", async () => {
  clearForestRoadSnapshotCache();
  const executor = new QueryExecutor([createForestRoadsAdapter(fetchSnapshot)]);
  const result = await executor.execute({
    datasetId: forestRoadsDescriptor.datasetId,
    filters: [{ field: "road_name", op: "eq", value: "卓社林道" }],
    select: ["record_id", "road_name", "interrupted_length_km", "control_point", "geometry"], limit: 1,
  });
  expect(result.totalMatched).toBe(1);
  expect(result.rows[0]).toMatchObject({ road_name: "卓社林道", interrupted_length_km: 0, control_point: null });
  const geometry = result.rows[0]!.geometry as { type: string; coordinates: unknown[] };
  expect(geometry.type).toBe("LineString");
  expect(geometry.coordinates.length).toBeGreaterThan(1);
  expect(geometry.coordinates.every(coordinate => Array.isArray(coordinate) && coordinate.length === 2)).toBe(true);
  expect(() => parseLineGeometry(geometry)).not.toThrow();
  expect(result.sourceRefs).toEqual([expect.objectContaining({ sourceId: "tw-forest-roads-2d-sidecar", checksumSha256: "c3d851c7c6bc25d0838c75bb16114f4470848cb4ef0cbfada65030c6a20c8e4b" })]);
  expect(result.excludedByReason).toEqual({});
  expect(result.cost.downloadedBytes).toBeLessThan(14 * 1024 * 1024);
});

it("fails closed when the fixed compact artifact differs from its recorded SHA", async () => {
  clearForestRoadSnapshotCache();
  const executor = new QueryExecutor([createForestRoadsAdapter(async () => new Response('{"type":"FeatureCollection","features":[]}'))]);
  await expect(executor.execute({ datasetId: forestRoadsDescriptor.datasetId, limit: 1 })).rejects.toThrow("FOREST_ROAD_SNAPSHOT_SHA_MISMATCH");
});

it("does not advertise point-distance or bbox support", () => {
  expect(forestRoadsDescriptor.access.query.supportsBbox).toBe(false);
  expect(forestRoadsDescriptor.supportedOperations).toEqual(["query_records", "line_intersects", "aggregate"]);
});
