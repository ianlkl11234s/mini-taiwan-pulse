/** Phase-2 schema-4 Tracks boundary; candidate-only until the separate cutover gate passes. */
export const GFW_V4_SPATIAL_ROOT_URL = "/global-maritime/gfw-hourly/v4/manifest.json";
export const GFW_V4_TRACK_BUCKETS = ["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"] as const;
export const GFW_V4_DEFAULT_TRACK_BUCKETS = ["FISHING", "CARGO", "PASSENGER"] as const;
const DATA_BUCKETS = ["fishing", "cargo", "passenger", "carrier", "other", "unknown"] as const;
export type GfwV4TrackBucket = typeof GFW_V4_TRACK_BUCKETS[number];
type DataBucket = typeof DATA_BUCKETS[number];
export type GfwV4TrackArtifactType = "tracks_day_pmtiles" | "track_frame_pmtiles" | "track_detail_bucket";
type ObjectLike = Record<string, unknown>;
const object = (value: unknown): value is ObjectLike => value !== null && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:00:00\+00:00$/.test(value) && Number.isFinite(Date.parse(value));
const same = (value: unknown, expected: readonly string[]) => Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
const bucket = (value: unknown): value is DataBucket => typeof value === "string" && DATA_BUCKETS.includes(value as DataBucket);
const path = (value: unknown, prefix: string): value is string => typeof value === "string" && value.startsWith(prefix) && !value.startsWith("/") && !value.includes("..");
const toUiBucket = (value: DataBucket): GfwV4TrackBucket => value.toUpperCase() as GfwV4TrackBucket;

export interface GfwV4SpatialArtifact {
  type: GfwV4TrackArtifactType;
  path: string;
  bytes: number;
  sha256: string;
  contentLength: number;
  contentType: "application/octet-stream" | "application/json";
  contentEncoding: "identity" | "gzip";
  bucket: GfwV4TrackBucket;
  selectedUtcDate: string;
  observedAt?: string;
  format: "geojson" | "pmtiles";
}
export interface GfwV4SpatialTracksRelease { releaseId: string; selectedUtcDate: string; artifacts: readonly GfwV4SpatialArtifact[]; }

/** Root is a small atomic pointer. Artifacts remain only in the immutable release manifest. */
export function parseGfwV4SpatialRoot(raw: unknown): { releaseId: string; selectedUtcDate: string; releaseManifestPath: string; sha256: string; bytes: number } | null {
  if (!object(raw) || raw.schema_version !== 4 || typeof raw.release_id !== "string" || !/^\d{4}-\d{2}-\d{2}__[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(raw.release_id) || !date(raw.selected_utc_date) || raw.selected_utc_date !== raw.release_id.slice(0, 10) || !object(raw.release_manifest)) return null;
  const pointer = raw.release_manifest;
  const manifestPath = `releases/${raw.release_id}/manifest.json`;
  return pointer.path === manifestPath && hash(pointer.sha256) && Number.isInteger(pointer.bytes) && (pointer.bytes as number) >= 0
    ? { releaseId: raw.release_id, selectedUtcDate: raw.selected_utc_date, releaseManifestPath: manifestPath, sha256: pointer.sha256, bytes: pointer.bytes as number } : null;
}

function validBucketData(data: ObjectLike, selectedDate: string): boolean {
  return DATA_BUCKETS.every((name) => {
    const value = data[name];
    if (!object(value) || !Array.isArray(value.days) || value.days.length !== 1 || !Array.isArray(value.frames) || value.frames.length !== 24) return false;
    const day = value.days[0];
    if (!object(day) || day.display_date !== selectedDate || day.format !== "pmtiles" || !path(day.path, `tracks/${name}/tracks/days/`) || !Array.isArray(day.detail_buckets) || day.detail_buckets.length !== 16) return false;
    const ids = new Set<string>();
    if (!day.detail_buckets.every((detail) => object(detail) && typeof detail.bucket === "string" && /^[0-9a-f]$/.test(detail.bucket) && !ids.has(detail.bucket) && (ids.add(detail.bucket), true) && path(detail.path, `tracks/${name}/tracks/details/${selectedDate}/`))) return false;
    const observed = new Set<string>();
    return value.frames.every((frame) => object(frame) && frame.format === "pmtiles" && frame.content_encoding === "identity" && timestamp(frame.observed_at) && frame.observed_at.slice(0, 10) === selectedDate && !observed.has(frame.observed_at) && (observed.add(frame.observed_at), true) && path(frame.path, `tracks/${name}/tracks/frames/`));
  });
}

/**
 * Stage parser for frozen schema-4 metadata. `semantic_counts` is deliberate:
 * it is the ledger-owned metadata field; POC-only `scope` is never accepted.
 * `production_cutover` is intentionally left to the formal installer.
 */
export function parseGfwV4SpatialTracksRelease(raw: unknown): GfwV4SpatialTracksRelease | null {
  if (!object(raw) || raw.schema_version !== 4 || typeof raw.release_id !== "string" || !date(raw.selected_utc_date) || raw.selected_utc_date !== raw.release_id.slice(0, 10) || typeof raw.resolved_dataset_version !== "string" || !object(raw.tracks) || !same(raw.tracks.buckets, GFW_V4_TRACK_BUCKETS) || !same(raw.tracks.default_buckets, GFW_V4_DEFAULT_TRACK_BUCKETS) || !object(raw.tracks.bucket_data) || !validBucketData(raw.tracks.bucket_data, raw.selected_utc_date) || !object(raw.taxonomy) || raw.taxonomy.tanker !== "quarantine" || raw.taxonomy.gear_fad !== "independent_non_vessel_observation" || !object(raw.layer_separation) || raw.layer_separation.grid !== "gfwHourlyGrid" || raw.layer_separation.tracks !== "gfwHourlyTracks" || raw.layer_separation.fishing_effort !== "gfwFishingEffort" || raw.layer_separation.dark_vessels !== "gfwDarkVessels" || !Array.isArray(raw.artifacts)) return null;
  const prefix = `releases/${raw.release_id}/`;
  const paths = new Set<string>();
  const assets: GfwV4SpatialArtifact[] = [];
  for (const item of raw.artifacts) {
    // Grid/fishing assets are validated by their own loaders. Do not reject a complete release for containing them.
    if (!object(item) || !["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket"].includes(String(item.type))) continue;
    if (!path(item.path, prefix) || paths.has(item.path) || !hash(item.sha256) || !Number.isInteger(item.bytes) || (item.bytes as number) < 0 || !Number.isInteger(item.content_length) || item.content_length !== item.bytes || item.etag !== `"${item.sha256}"` || (item.content_type !== "application/octet-stream" && item.content_type !== "application/json") || (item.content_encoding !== "identity" && item.content_encoding !== "gzip") || !object(item.semantic_counts) || !bucket(item.semantic_counts.bucket)) return null;
    const day = item.type === "tracks_day_pmtiles";
    const frame = item.type === "track_frame_pmtiles";
    if ((day && (item.content_type !== "application/octet-stream" || item.content_encoding !== "identity" || item.semantic_counts.display_date !== raw.selected_utc_date)) || (frame && (!timestamp(item.semantic_counts.observed_at) || item.semantic_counts.observed_at.slice(0, 10) !== raw.selected_utc_date || item.content_type !== "application/octet-stream" || item.content_encoding !== "identity")) || (!day && !frame && (item.content_type !== "application/json" || item.content_encoding !== "gzip" || item.semantic_counts.display_date !== raw.selected_utc_date))) return null;
    paths.add(item.path);
    assets.push({ type: item.type as GfwV4TrackArtifactType, path: item.path, bytes: item.bytes as number, sha256: item.sha256, contentLength: item.content_length as number, contentType: item.content_type, contentEncoding: item.content_encoding, bucket: toUiBucket(item.semantic_counts.bucket), selectedUtcDate: raw.selected_utc_date, observedAt: frame ? item.semantic_counts.observed_at as string : undefined, format: day || frame ? "pmtiles" : "geojson" });
  }
  return GFW_V4_TRACK_BUCKETS.every((name) => {
    const own = assets.filter((asset) => asset.bucket === name);
    const nested = (raw.tracks as ObjectLike).bucket_data as ObjectLike;
    const nestedBucket = object(nested) ? nested[name.toLowerCase()] : null;
    const pmtilesFrames = own.filter((asset) => asset.type === "track_frame_pmtiles").length;
    return own.filter((asset) => asset.type === "tracks_day_pmtiles").length === 1 && object(nestedBucket) && pmtilesFrames === 24 && own.filter((asset) => asset.type === "track_detail_bucket").length === 16;
  }) ? { releaseId: raw.release_id, selectedUtcDate: raw.selected_utc_date, artifacts: assets } : null;
}

/** The Worker/GPU consumer gets immutable URLs, never per-tick GeoJSON setData payloads. */
export function selectGfwV4SpatialTrackAssets(release: GfwV4SpatialTracksRelease, enabled: readonly GfwV4TrackBucket[]): readonly GfwV4SpatialArtifact[] {
  const selected = new Set(enabled);
  return selected.size === 0 || [...selected].some((name) => !GFW_V4_TRACK_BUCKETS.includes(name)) ? [] : release.artifacts.filter((asset) => selected.has(asset.bucket));
}
export function resolveGfwV4SpatialArtifactUrl(asset: GfwV4SpatialArtifact, rootUrl = GFW_V4_SPATIAL_ROOT_URL): string { return new URL(asset.path, new URL(rootUrl, globalThis.location?.origin ?? "http://localhost")).toString(); }
