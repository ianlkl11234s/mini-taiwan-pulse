import { withLoading } from "../lib/loadingRegistry";
import { loadPointPartitions, type PointBbox, type PointSpatialPartitionConfig } from "./pointDatasetPartitions";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FEATURES = 20_000;
const TIMEOUT_MS = 15_000;

export interface PointDatasetConfig {
  datasetId: string;
  url: string;
  safeFields: readonly string[];
  idField: string;
  /** Count source records even without usable points; geometry remains null. */
  preserveUnlocatedRecords?: boolean;
  /** Immutable, source-SHA-bound spatial shards used only for bbox reads. */
  spatialPartition?: PointSpatialPartitionConfig;
}

export interface PointDatasetSnapshot {
  rows: readonly Record<string, unknown>[];
  checksumSha256: string;
  acquiredAt: string;
  bytes: number;
  downloadedBytes: number;
  requests: number;
  cacheHit: boolean;
  exclusions: { missing_geometry: number; non_point_geometry: number; invalid_geometry: number };
}

const cache = new Map<string, PointDatasetSnapshot>();
const inFlight = new Map<string, Promise<PointDatasetSnapshot>>();

function validCoordinate(lng: unknown, lat: unknown): lng is number {
  return typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat)
    && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

async function boundedBytes(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("DATASET_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function safeValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 4000);
  if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") return value;
  return undefined;
}

function parseFeatures(config: PointDatasetConfig, features: readonly unknown[], checksumSha256: string, partitioned: boolean): Omit<PointDatasetSnapshot, "checksumSha256" | "acquiredAt" | "bytes" | "downloadedBytes" | "requests" | "cacheHit"> {
  if (features.length > MAX_FEATURES) throw new Error("INVALID_DATASET");
  const exclusions = { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 };
  const rows: Record<string, unknown>[] = [];
  const ordinals = new Set<number>();
  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    if (!feature || typeof feature !== "object" || Array.isArray(feature) || (feature as { type?: unknown }).type !== "Feature"
      || ((feature as { properties?: unknown }).properties !== null && (typeof (feature as { properties?: unknown }).properties !== "object" || Array.isArray((feature as { properties?: unknown }).properties)))) throw new Error("INVALID_DATASET");
    const sourceOrdinal = (feature as { sourceOrdinal?: unknown }).sourceOrdinal;
    if (partitioned && (!Number.isSafeInteger(sourceOrdinal) || (sourceOrdinal as number) < 0 || ordinals.has(sourceOrdinal as number))) throw new Error("INVALID_PARTITION_ORDINAL");
    if (partitioned) ordinals.add(sourceOrdinal as number);
    const geometry = (feature as { geometry?: unknown }).geometry as { type?: unknown; coordinates?: unknown } | null | undefined;
    let point: { type: "Point"; coordinates: number[] } | null = null;
    if (!geometry) exclusions.missing_geometry++;
    else if (geometry.type !== "Point") exclusions.non_point_geometry++;
    else if (!Array.isArray(geometry.coordinates) || !validCoordinate(geometry.coordinates[0], geometry.coordinates[1])) exclusions.invalid_geometry++;
    else point = { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] };
    if (!point && !config.preserveUnlocatedRecords) continue;
    const source = ((feature as { properties?: unknown }).properties ?? {}) as Record<string, unknown>;
    const row: Record<string, unknown> = { geometry: point };
    for (const field of config.safeFields) {
      const value = safeValue(source[field]);
      if (value !== undefined) row[field] = value;
    }
    row.record_id = `${checksumSha256}-${partitioned ? sourceOrdinal : index}`;
    rows.push(row);
  }
  return { rows, exclusions };
}

function parse(config: PointDatasetConfig, bytes: Uint8Array, checksumSha256: string): PointDatasetSnapshot {
  if (new TextDecoder().decode(bytes.slice(0, 100)).trimStart().startsWith("<")) throw new Error("DATASET_ASSET_MISSING");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("INVALID_DATASET"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || (raw as { type?: unknown }).type !== "FeatureCollection") throw new Error("INVALID_DATASET");
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features)) throw new Error("INVALID_DATASET");
  return { ...parseFeatures(config, features, checksumSha256, false), checksumSha256, acquiredAt: new Date().toISOString(), bytes: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false };
}

function fullCacheKey(config: PointDatasetConfig): string { return `${config.datasetId}|${config.url}|${config.spatialPartition?.sourceSha256 ?? ""}`; }

async function loadPartitioned(config: PointDatasetConfig, bbox: PointBbox, signal?: AbortSignal): Promise<PointDatasetSnapshot> {
  if (!config.spatialPartition) throw new Error("INVALID_PARTITION_CONFIG");
  const partition = await loadPointPartitions(config.spatialPartition, config.url, bbox, signal);
  return {
    ...parseFeatures(config, partition.features, config.spatialPartition.sourceSha256, true), checksumSha256: config.spatialPartition.sourceSha256,
    acquiredAt: new Date().toISOString(), bytes: partition.bytes, downloadedBytes: partition.downloadedBytes, requests: partition.requests, cacheHit: partition.cacheHit,
  };
}

export async function loadPointDataset(config: PointDatasetConfig, options: { bbox?: PointBbox; signal?: AbortSignal } = {}): Promise<PointDatasetSnapshot> {
  if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (options.bbox && config.spatialPartition) return withLoading(`research:dataset:${config.datasetId}`, `載入 ${config.datasetId}`, loadPartitioned(config, options.bbox, options.signal));
  const cacheKey = fullCacheKey(config);
  const existing = cache.get(cacheKey);
  if (existing) return { ...existing, downloadedBytes: 0, requests: 0, cacheHit: true };
  const pending = !options.signal ? inFlight.get(cacheKey) : undefined;
  if (pending) return { ...(await pending), downloadedBytes: 0, requests: 0, cacheHit: true };
  const request = withLoading(`research:dataset:${config.datasetId}`, `載入 ${config.datasetId}`, (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    try {
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const response = await fetch(config.url, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (response.status === 404) throw new Error("DATASET_ASSET_MISSING");
      if (!response.ok) throw new Error("DATASET_UNAVAILABLE");
      if (response.headers.get("content-type")?.includes("text/html")) throw new Error("DATASET_ASSET_MISSING");
      const bytes = await boundedBytes(response);
      const checksumSha256 = await sha256(bytes);
      if (config.spatialPartition && checksumSha256 !== config.spatialPartition.sourceSha256) throw new Error("SOURCE_SHA_MISMATCH");
      const snapshot = parse(config, bytes, checksumSha256);
      cache.set(cacheKey, snapshot);
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new Error("REQUEST_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", onAbort); }
  })());
  if (!options.signal) inFlight.set(cacheKey, request);
  try { return await request; } finally { if (!options.signal) inFlight.delete(cacheKey); }
}

export function clearPointDatasetCache(): void { cache.clear(); inFlight.clear(); }
