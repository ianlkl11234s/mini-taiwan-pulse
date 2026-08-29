import { describe, expect, it } from "vitest";
import { fixedShardViewportTiles, gfwV4ShardSignature, quantizeGfwV4Viewport, selectGfwV4CurrentNextSpatialFrames, spatialFrameNeedsPmtilesWorker } from "./gfwV4SpatialViewport";
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

describe("GFW v4 shard key debounce inputs", () => {
  it("quantizes outward only, so the coarse viewport can never lose an edge shard", () => {
    const raw = { west: 120.4137, south: 20.9612, east: 125.0031, north: 28.0409, zoom: 5.7 };
    const coarse = quantizeGfwV4Viewport(raw);
    expect(coarse).toEqual({ west: 120.4, south: 20.9, east: 125.1, north: 28.1, zoom: 5.7 });
    expect(coarse.west).toBeLessThanOrEqual(raw.west);
    expect(coarse.south).toBeLessThanOrEqual(raw.south);
    expect(coarse.east).toBeGreaterThanOrEqual(raw.east);
    expect(coarse.north).toBeGreaterThanOrEqual(raw.north);
    // Negative coordinates must also expand, not round toward zero.
    expect(quantizeGfwV4Viewport({ west: -120.4137, south: -20.9612, east: -119.0031, north: -18.0409, zoom: 3 }))
      .toEqual({ west: -120.5, south: -21, east: -119, north: -18, zoom: 3 });
  });

  it("keeps the shard signature stable across a pan that stays inside the same z6 tiles", () => {
    const shards = (viewport: { west: number; south: number; east: number; north: number }) =>
      gfwV4ShardSignature(fixedShardViewportTiles(quantizeGfwV4Viewport({ ...viewport, zoom: 6 }), 6));
    // z6 tiles span 5.625°; a sub-degree playback pan must not re-select shards.
    expect(shards({ west: 121.0, south: 24.0, east: 123.0, north: 26.0 }))
      .toBe(shards({ west: 121.31, south: 24.22, east: 123.31, north: 26.22 }));
    // Crossing the tile edge must change it, otherwise new data never loads.
    expect(shards({ west: 121.0, south: 24.0, east: 123.0, north: 26.0 }))
      .not.toBe(shards({ west: 121.0, south: 24.0, east: 129.0, north: 26.0 }));
  });
});
