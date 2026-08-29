/**
 * Formal schema-4 GFW release boundary.
 *
 * The root is an atomic pointer; every browser consumer must verify its target
 * bytes and SHA-256 before it is allowed to inspect the immutable release.
 * This deliberately has no DEV/query switch: callers may fall back to v2/v3
 * only when the formal v4 root is absent or fails this contract.
 */
export const GFW_V4_ROOT_MANIFEST_URL = "/global-maritime/gfw-hourly/v4/manifest.json";
export const GFW_V4_BBOX = [115.93462, 20.36314, 134.73486, 36.52495] as const;
export const GFW_V4_TRACK_BUCKETS = ["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"] as const;
export const GFW_V4_DEFAULT_TRACK_BUCKETS = ["FISHING", "CARGO", "PASSENGER"] as const;

type JsonObject = Record<string, unknown>;
type ArtifactType = "tracks_day_pmtiles" | "track_frame_pmtiles" | "track_detail_bucket" | "grid_hour_pmtiles" | "grid_detail_bucket" | "fishing_effort_day" | "gear_observations";
export type GfwV4TrackBucket = typeof GFW_V4_TRACK_BUCKETS[number];

export interface GfwV4Artifact {
  type: ArtifactType;
  path: string;
  bytes: number;
  sha256: string;
  contentLength: number;
  contentType: "application/octet-stream" | "application/json";
  contentEncoding: "identity" | "gzip";
  semanticCounts: JsonObject;
}

export interface GfwV4GridHour {
  observedAt: string;
  path: string;
  bytes: number;
  sha256: string;
  cellCount: number;
  vesselCount: number;
  details: readonly { bucket: string; path: string; bytes: number; sha256: string; features: number }[];
}

export interface GfwV4Release {
  rootUrl: string;
  releaseUrl: string;
  releaseId: string;
  selectedUtcDate: string;
  bbox: readonly [number, number, number, number];
  sourceDatasetId: string;
  resolvedDatasetVersion: string;
  artifacts: readonly GfwV4Artifact[];
  grid: { sourceLayer: "gfw_grid_0_1"; hours: readonly GfwV4GridHour[] };
  fishingEffort: {
    path: string;
    bytes: number;
    sha256: string;
    featureCount: number;
    metric: "apparent_fishing_hours";
    unit: "hours";
    resolvedDatasetVersion: string;
    latestObservedActiveDate: string;
    latestAvailableDate: string | null;
    latestAvailableDateStatus: string;
    finalizationStatus: "not_provided_by_gfw";
    revisionSemantics: "dynamic_api_data_may_be_revised";
    attribution: string;
    caveat: string;
  };
}

const object = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const nonNegative = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const hash = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const hour = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/.test(value) && Number.isFinite(Date.parse(value));
const path = (value: unknown, prefix: string): value is string => typeof value === "string" && value.startsWith(prefix) && !value.startsWith("/") && !value.includes("..") && !value.split("/").some((part) => part === "." || part === "");
const same = (actual: unknown, expected: readonly string[]): boolean => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);

export function resolveGfwV4RootManifestUrl(cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? ""): string {
  return cdnBase.trim()
    ? new URL(GFW_V4_ROOT_MANIFEST_URL, `${cdnBase.replace(/\/$/, "")}/`).toString()
    : GFW_V4_ROOT_MANIFEST_URL;
}

export function parseGfwV4Root(raw: unknown): { releaseId: string; selectedUtcDate: string; path: string; bytes: number; sha256: string } | null {
  if (!object(raw) || raw.schema_version !== 4 || raw.production_cutover !== true || raw.poc === true || raw.shadow_only === true ||
    typeof raw.release_id !== "string" || !/^\d{4}-\d{2}-\d{2}__[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(raw.release_id) ||
    !date(raw.selected_utc_date) || raw.selected_utc_date !== raw.release_id.slice(0, 10) || !object(raw.release_manifest)) return null;
  const pointer = raw.release_manifest;
  const releasePath = `releases/${raw.release_id}/manifest.json`;
  return pointer.path === releasePath && positive(pointer.bytes) && hash(pointer.sha256)
    ? { releaseId: raw.release_id, selectedUtcDate: raw.selected_utc_date, path: releasePath, bytes: pointer.bytes, sha256: pointer.sha256 }
    : null;
}

function parseArtifact(raw: unknown, prefix: string): GfwV4Artifact | null {
  if (!object(raw) || !["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket", "grid_hour_pmtiles", "grid_detail_bucket", "fishing_effort_day", "gear_observations"].includes(String(raw.type)) ||
    !path(raw.path, prefix) || !positive(raw.bytes) || raw.content_length !== raw.bytes || !hash(raw.sha256) || raw.etag !== `"${raw.sha256}"` ||
    (raw.content_type !== "application/octet-stream" && raw.content_type !== "application/json") ||
    (raw.content_encoding !== "identity" && raw.content_encoding !== "gzip") || !object(raw.semantic_counts) ||
    raw.cache_control !== "public,max-age=604800,s-maxage=604800,immutable") return null;
  return { type: raw.type as ArtifactType, path: raw.path, bytes: raw.bytes, sha256: raw.sha256, contentLength: raw.content_length as number, contentType: raw.content_type, contentEncoding: raw.content_encoding, semanticCounts: raw.semantic_counts };
}

/** Pure parser; network byte/SHA validation happens in loadGfwV4Release. */
export function parseGfwV4Release(raw: unknown, rootUrl: string, releaseUrl: string): GfwV4Release | null {
  if (!object(raw) || raw.schema_version !== 4 || raw.production_cutover !== true || raw.immutable !== true ||
    typeof raw.release_id !== "string" || !date(raw.selected_utc_date) || raw.selected_utc_date !== raw.release_id.slice(0, 10) ||
    !Array.isArray(raw.bbox) || raw.bbox.length !== 4 || raw.bbox.some((value, index) => value !== GFW_V4_BBOX[index]) ||
    typeof raw.source_dataset_id !== "string" || raw.source_dataset_id.length === 0 || typeof raw.resolved_dataset_version !== "string" || raw.resolved_dataset_version.length === 0 ||
    !object(raw.layer_separation) || raw.layer_separation.grid !== "gfwHourlyGrid" || raw.layer_separation.tracks !== "gfwHourlyTracks" || raw.layer_separation.fishing_effort !== "gfwFishingEffort" || raw.layer_separation.dark_vessels !== "gfwDarkVessels" ||
    !object(raw.taxonomy) || raw.taxonomy.tanker !== "quarantine" || raw.taxonomy.carrier !== "independent_default_off" || raw.taxonomy.gear_fad !== "independent_non_vessel_observation" ||
    !object(raw.release_truth) || raw.release_truth.tier1_status !== "passed" || raw.release_truth.tier2_status !== "passed" || raw.release_truth.readback_status !== "passed" ||
    !object(raw.grid) || raw.grid.source_layer !== "gfw_grid_0_1" || raw.grid.resolution_degrees !== 0.1 || raw.grid.hour_count !== 24 || !Array.isArray(raw.grid.hours) || raw.grid.hours.length !== 24 ||
    !object(raw.tracks) || !same(raw.tracks.buckets, GFW_V4_TRACK_BUCKETS) || !same(raw.tracks.default_buckets, GFW_V4_DEFAULT_TRACK_BUCKETS) ||
    !object(raw.fishing_effort) || !object(raw.source_proof) || !object(raw.source_proof.fishing_effort) || !object(raw.source_proof.fishing_effort.lineage) || !Array.isArray(raw.artifacts)) return null;

  const prefix = `releases/${raw.release_id}/`;
  const assets = raw.artifacts.map((item) => parseArtifact(item, prefix));
  if (assets.some((asset) => asset === null)) return null;
  const artifacts = assets as GfwV4Artifact[];
  const byPath = new Map(artifacts.map((asset) => [asset.path, asset]));
  if (byPath.size !== artifacts.length) return null;
  const gridHours: GfwV4GridHour[] = [];
  for (let index = 0; index < 24; index += 1) {
    const item = raw.grid.hours[index];
    if (!object(item) || !hour(item.observed_at) || !object(item.pmtiles) || !Array.isArray(item.details) || item.details.length === 0) return null;
    const pmtiles = item.pmtiles;
    const asset = typeof pmtiles.path === "string" ? byPath.get(`${prefix}${pmtiles.path}`) : undefined;
    if (!asset || asset.type !== "grid_hour_pmtiles" || asset.contentEncoding !== "identity" || asset.contentType !== "application/octet-stream" ||
      asset.bytes !== pmtiles.bytes || asset.sha256 !== pmtiles.sha256 || !nonNegative(pmtiles.features) || !nonNegative(pmtiles.vessels) || !object(pmtiles.semantic_readback) ||
      pmtiles.semantic_readback.status !== "passed" || pmtiles.semantic_readback.source_layer !== "gfw_grid_0_1" || pmtiles.semantic_readback.expected_cells !== pmtiles.features || pmtiles.semantic_readback.unique_cells !== pmtiles.features) return null;
    const details = item.details.map((detail, detailIndex) => {
      if (!object(detail) || detail.type !== "grid_detail" || typeof detail.path !== "string" || !positive(detail.bytes) || !hash(detail.sha256) || !nonNegative(detail.features)) return null;
      const detailAsset = byPath.get(`${prefix}${detail.path}`);
      return detailAsset && detailAsset.type === "grid_detail_bucket" && detailAsset.contentEncoding === "gzip" && detailAsset.contentType === "application/json" && detailAsset.bytes === detail.bytes && detailAsset.sha256 === detail.sha256
        ? { bucket: `part-${String(detailIndex).padStart(4, "0")}.json.gz`, path: detailAsset.path, bytes: detail.bytes, sha256: detail.sha256, features: detail.features }
        : null;
    });
    if (details.some((detail) => detail === null)) return null;
    gridHours.push({ observedAt: item.observed_at, path: asset.path, bytes: pmtiles.bytes as number, sha256: pmtiles.sha256 as string, cellCount: pmtiles.features as number, vesselCount: pmtiles.vessels as number, details: details as NonNullable<typeof details[number]>[] });
  }
  const fishingPath = raw.fishing_effort.path;
  const fishing = typeof fishingPath === "string" ? byPath.get(fishingPath) : undefined;
  const lineage = raw.source_proof.fishing_effort.lineage;
  if (!fishing || fishing.type !== "fishing_effort_day" || fishing.contentEncoding !== "gzip" || fishing.contentType !== "application/json" ||
    raw.fishing_effort.feature_count !== fishing.semanticCounts.feature_count || !nonNegative(raw.fishing_effort.feature_count) ||
    !object(lineage) || lineage.date !== raw.selected_utc_date || lineage.metric !== "apparent_fishing_hours" || lineage.unit !== "hours" ||
    typeof lineage.resolved_dataset_version !== "string" || !date(lineage.latest_observed_active_date) ||
    (lineage.latest_available_date !== null && !date(lineage.latest_available_date)) ||
    typeof lineage.latest_available_date_status !== "string" || lineage.finalization_status !== "not_provided_by_gfw" ||
    lineage.revision_semantics !== "dynamic_api_data_may_be_revised" || typeof lineage.attribution !== "string" ||
    !lineage.attribution.includes("Global Fishing Watch") || typeof lineage.caveat !== "string" ||
    !lineage.caveat.includes("not vessel presence")) return null;
  return { rootUrl, releaseUrl, releaseId: raw.release_id, selectedUtcDate: raw.selected_utc_date, bbox: raw.bbox as [number, number, number, number], sourceDatasetId: raw.source_dataset_id, resolvedDatasetVersion: raw.resolved_dataset_version, artifacts, grid: { sourceLayer: "gfw_grid_0_1", hours: gridHours }, fishingEffort: { path: fishing.path, bytes: fishing.bytes, sha256: fishing.sha256, featureCount: raw.fishing_effort.feature_count, metric: "apparent_fishing_hours", unit: "hours", resolvedDatasetVersion: lineage.resolved_dataset_version, latestObservedActiveDate: lineage.latest_observed_active_date, latestAvailableDate: lineage.latest_available_date as string | null, latestAvailableDateStatus: lineage.latest_available_date_status, finalizationStatus: "not_provided_by_gfw", revisionSemantics: "dynamic_api_data_may_be_revised", attribution: lineage.attribution, caveat: lineage.caveat } };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

/** A schema-4 release is unavailable until the pointer's target is content-addressed. */
export async function loadGfwV4Release(rootUrl = resolveGfwV4RootManifestUrl(), fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<GfwV4Release | null> {
  try {
    const rootResponse = await fetchImpl(rootUrl, { cache: "no-cache" });
    if (!rootResponse.ok) return null;
    const root = parseGfwV4Root(await rootResponse.json());
    if (!root) return null;
    const releaseUrl = new URL(root.path, rootResponse.url || new URL(rootUrl, globalThis.location?.origin ?? "http://localhost").toString()).toString();
    const releaseResponse = await fetchImpl(releaseUrl, { cache: "force-cache" });
    if (!releaseResponse.ok) return null;
    const bytes = await releaseResponse.arrayBuffer();
    if (bytes.byteLength !== root.bytes || (await sha256Hex(bytes))?.toLowerCase() !== root.sha256.toLowerCase()) return null;
    return parseGfwV4Release(JSON.parse(new TextDecoder().decode(bytes)), rootUrl, releaseUrl);
  } catch {
    return null;
  }
}

export function resolveGfwV4ArtifactUrl(release: GfwV4Release, pathValue: string): string {
  // Artifact paths are rooted beside the atomic v4 root, not beside
  // releases/<id>/manifest.json (which would duplicate releases/<id>/).
  return new URL(pathValue, new URL(release.rootUrl, globalThis.location?.origin ?? "http://localhost")).toString();
}
