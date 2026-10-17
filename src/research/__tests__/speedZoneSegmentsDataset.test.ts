import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { clearSpeedZoneSegmentsSnapshotCache, createSpeedZoneSegmentsAdapter, speedZoneSegmentsDescriptor } from "../speedZoneSegmentsDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../public/police_justice/speed_zone_segments/speed_zone_segments_20260626.geojson", import.meta.url);

function executor(bytes: Uint8Array) {
  const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json", "content-length": String(bytes.byteLength) } }));
  return { fetcher, query: new QueryExecutor([createSpeedZoneSegmentsAdapter(fetcher)]) };
}

it("reads the SHA-bound 25-LineString New Taipei snapshot and retains independent route-endpoint oracles", async () => {
  clearSpeedZoneSegmentsSnapshotCache();
  const bytes = await readFile(asset); const { fetcher, query } = executor(bytes);
  const first = await query.execute({ datasetId: speedZoneSegmentsDescriptor.datasetId, filters: [{ field: "entity_id", op: "eq", value: "pj_zone_nt_1_d0" }], select: ["entity_id", "location", "limit_kph", "geometry"], limit: 1 });
  const second = await query.execute({ datasetId: speedZoneSegmentsDescriptor.datasetId, filters: [{ field: "entity_id", op: "eq", value: "pj_zone_nt_14_d0" }], select: ["entity_id", "location", "limit_kph", "geometry"], limit: 1 });
  expect(fetcher).toHaveBeenCalledWith("/police_justice/speed_zone_segments/speed_zone_segments_20260626.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
  expect(first).toMatchObject({ totalMatched: 1, freshness: "stale", cost: { rowsScanned: 25, bytesScanned: 10_957 }, sourceRefs: [expect.objectContaining({ sourceId: "data.gov.tw:126156", checksumSha256: "287b76c66affa9857721dfdff6d89f34f540a0955ea773c232c0497d9cd27af4" })] });
  expect(first.rows[0]).toMatchObject({ entity_id: "pj_zone_nt_1_d0", location: "臺9線19K至23.1K(雙向)", limit_kph: "40公里", geometry: { type: "LineString", coordinates: [[121.6236371, 24.9569297], [121.5981891, 24.9531792]] } });
  expect(second.rows[0]).toMatchObject({ entity_id: "pj_zone_nt_14_d0", location: "三峽區台7乙線5.3K至8.1K(雙向)", limit_kph: "40公里", geometry: { type: "LineString", coordinates: [[121.3751827, 24.8705956], [121.3572005, 24.8548211]] } });
});

it("fails closed when the fixed snapshot bytes differ from its recorded SHA", async () => {
  clearSpeedZoneSegmentsSnapshotCache();
  const { query } = executor(new TextEncoder().encode('{"type":"FeatureCollection","features":[]}'));
  await expect(query.execute({ datasetId: speedZoneSegmentsDescriptor.datasetId, limit: 1 })).rejects.toThrow("SPEED_ZONE_SEGMENTS_SNAPSHOT_SHA_MISMATCH");
});

it("does not describe the fetch date as a current enforcement guarantee", () => {
  expect(speedZoneSegmentsDescriptor.timeFields).toEqual([]);
  expect(speedZoneSegmentsDescriptor.valueSemantics.stale).toContain("不保證目前狀態");
  expect(speedZoneSegmentsDescriptor.access.query.supportsBbox).toBe(true);
});
