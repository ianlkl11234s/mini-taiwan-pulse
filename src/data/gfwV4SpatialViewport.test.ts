import { describe, expect, it } from "vitest";
import { fixedShardViewportTiles, selectGfwV4CurrentNextSpatialFrames, spatialFrameNeedsPmtilesWorker } from "./gfwV4SpatialViewport";
import type { GfwV4SpatialTracksRelease } from "./gfwV4SpatialTracksLoader";

const release = (): GfwV4SpatialTracksRelease => ({
  releaseId: "2026-08-21__x", selectedUtcDate: "2026-08-21",
  artifacts: ["FISHING", "CARGO", "PASSENGER"].flatMap((bucket) => [-1, 0, 1, 2, 3].map((hour) => ({
    type: "track_frame_pmtiles" as const, path: `releases/x/${bucket}/${hour}`, bytes: 1, sha256: "a".repeat(64), contentLength: 1,
    contentType: "application/octet-stream" as const, contentEncoding: "identity" as const,
    bucket: bucket as "FISHING" | "CARGO" | "PASSENGER", selectedUtcDate: "2026-08-21", observedAt: new Date(Date.parse("2026-08-21T00:00:00Z") + hour * 3_600_000).toISOString().replace(".000Z", "+00:00"), format: "pmtiles",
  }))),
});
describe("GFW v4 Phase-2 viewport request", () => {
  it("limits requests to enabled buckets and the trail window plus next preload", () => { const request = selectGfwV4CurrentNextSpatialFrames(release(), ["FISHING", "CARGO", "PASSENGER"], Date.parse("2026-08-21T00:20:00Z") / 1_000, { west: 120, south: 20, east: 125, north: 28, zoom: 6 }); expect(request?.assets).toHaveLength(9); });
  it("advertises PMTiles to the Range/Worker route and fails closed on an invalid viewport", () => { const request = selectGfwV4CurrentNextSpatialFrames(release(), ["FISHING", "CARGO", "PASSENGER"], Date.parse("2026-08-21T00:20:00Z") / 1_000, { west: 120, south: 20, east: 125, north: 28, zoom: 6 }); expect(spatialFrameNeedsPmtilesWorker(request!)).toBe(true); expect(selectGfwV4CurrentNextSpatialFrames(release(), ["FISHING"], 0, { west: 1, south: 1, east: 1, north: 2, zoom: 3 })).toBeNull(); });
  it("clips unavailable cross-day history rather than inventing it", () => {
    const withoutPrevious = release();
    withoutPrevious.artifacts = withoutPrevious.artifacts.filter((asset) => !asset.path.endsWith("/-1"));
    const request = selectGfwV4CurrentNextSpatialFrames(withoutPrevious, ["FISHING", "CARGO", "PASSENGER"], Date.parse("2026-08-21T00:20:00Z") / 1_000, { west: 120, south: 20, east: 125, north: 28, zoom: 6 });
    expect(request?.assets).toHaveLength(6);
  });
  it("uses the declared fixed shard zoom rather than the map zoom", () => { const tiles = fixedShardViewportTiles({ west: 120, south: 20, east: 125, north: 28, zoom: 3 }, 7); expect(tiles.every((tile) => tile.z === 7)).toBe(true); expect(tiles.length).toBeGreaterThan(0); expect(() => fixedShardViewportTiles({ west: 1, south: 1, east: 1, north: 2, zoom: 3 }, 7)).toThrow("invalid"); });
});
