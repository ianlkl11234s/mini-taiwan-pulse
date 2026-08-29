import type { GfwV4SpatialArtifact, GfwV4SpatialTracksRelease, GfwV4TrackBucket } from "./gfwV4SpatialTracksLoader";
import { selectGfwV4SpatialTrackAssets } from "./gfwV4SpatialTracksLoader";

export interface GfwV4Viewport { west: number; south: number; east: number; north: number; zoom: number; }
export interface GfwV4SpatialRequest { assets: readonly GfwV4SpatialArtifact[]; viewport: GfwV4Viewport; }
export interface GfwV4ShardTile { z: number; x: number; y: number; }

/** Fixed archive shard zoom only; caller must never substitute a map LOD pyramid. */
export function fixedShardViewportTiles(viewport: GfwV4Viewport, shardZoom: number): readonly GfwV4ShardTile[] {
  if (!Number.isInteger(shardZoom) || shardZoom < 0 || shardZoom > 14 || viewport.west >= viewport.east || viewport.south >= viewport.north) throw new Error("invalid fixed GFW v4 shard zoom or viewport");
  const scale = 2 ** shardZoom;
  const x = (lon: number) => Math.max(0, Math.min(scale - 1, Math.floor((lon + 180) / 360 * scale)));
  const y = (lat: number) => Math.max(0, Math.min(scale - 1, Math.floor((1 - Math.asinh(Math.tan(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180)) / Math.PI) / 2 * scale)));
  const west = x(viewport.west), east = x(viewport.east), north = y(viewport.north), south = y(viewport.south); const tiles: GfwV4ShardTile[] = [];
  for (let tileX = west; tileX <= east; tileX++) for (let tileY = north; tileY <= south; tileY++) tiles.push({ z: shardZoom, x: tileX, y: tileY });
  return tiles;
}

/**
 * 播放中每一格動畫都算一次「新視窗」是重建 Worker 的主因之一。量化到 0.1° 讓
 * 微幅 pan/zoom 收斂成同一個 key，且**一律向外取整** —— 量化只能放大視窗，
 * 絕不能把邊緣的 shard 吃掉。
 */
export function quantizeGfwV4Viewport(viewport: GfwV4Viewport, quantum = 10): GfwV4Viewport {
  if (!Number.isFinite(quantum) || quantum <= 0) throw new Error("invalid GFW v4 viewport quantum");
  return {
    west: Math.floor(viewport.west * quantum) / quantum,
    south: Math.floor(viewport.south * quantum) / quantum,
    east: Math.ceil(viewport.east * quantum) / quantum,
    north: Math.ceil(viewport.north * quantum) / quantum,
    zoom: viewport.zoom,
  };
}

/**
 * 真正決定「要抓哪些 PMTiles tile」的是 shard 集合，不是 bounds 的小數位。
 * 只要 pan/zoom 沒跨出這批 tile，簽章不變 → 播放中完全不必重選 shard。
 */
export function gfwV4ShardSignature(tiles: readonly GfwV4ShardTile[]): string {
  return tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`).join(",");
}

/** Never expands to a whole day: enabled buckets × H-1/H/H+1 for preload. */
export function selectGfwV4CurrentNextSpatialFrames(release: GfwV4SpatialTracksRelease, enabled: readonly GfwV4TrackBucket[], epochSeconds: number, viewport: GfwV4Viewport, trailingHours = 0.5): GfwV4SpatialRequest | null {
  if (!Number.isFinite(epochSeconds) || viewport.zoom < 0 || viewport.west >= viewport.east || viewport.south >= viewport.north) return null;
  const hour = Math.floor(epochSeconds / 3_600) * 3_600;
  if (!Number.isFinite(trailingHours) || trailingHours < 0) return null;
  const requested = new Set<string>();
  for (let offset = -Math.ceil(trailingHours); offset <= 1; offset++) requested.add(new Date((hour + offset * 3_600) * 1_000).toISOString().replace(".000Z", "+00:00"));
  const assets = selectGfwV4SpatialTrackAssets(release, enabled).filter((asset) => asset.type === "track_frame_pmtiles" && asset.observedAt !== undefined && requested.has(asset.observedAt));
  // Day boundaries only clip the unavailable predecessor/successor.  The selected
  // H itself remains mandatory; it is the sole observation that may form a head.
  const selected = new Date(hour * 1_000).toISOString().replace(".000Z", "+00:00");
  return enabled.every((bucket) => assets.some((asset) => asset.bucket === bucket && asset.observedAt === selected)) ? { assets, viewport } : null;
}

/** PMTiles is intentionally a Range source. A Worker supplies tile decode/cull; no day-pack fallback exists. */
export function spatialFrameNeedsPmtilesWorker(request: GfwV4SpatialRequest): boolean { return request.assets.some((asset) => asset.format === "pmtiles"); }
