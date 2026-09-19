import { withLoading } from "../lib/loadingRegistry";

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
}

export interface PointDatasetSnapshot {
  rows: readonly Record<string, unknown>[];
  checksumSha256: string;
  acquiredAt: string;
  bytes: number;
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

function parse(config: PointDatasetConfig, bytes: Uint8Array, checksumSha256: string): PointDatasetSnapshot {
  if (new TextDecoder().decode(bytes.slice(0, 100)).trimStart().startsWith("<")) throw new Error("DATASET_ASSET_MISSING");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("INVALID_DATASET"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || (raw as { type?: unknown }).type !== "FeatureCollection") throw new Error("INVALID_DATASET");
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length > MAX_FEATURES) throw new Error("INVALID_DATASET");
  const exclusions = { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 };
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    if (!feature || typeof feature !== "object" || Array.isArray(feature) || feature.type !== "Feature"
      || (feature.properties !== null && (typeof feature.properties !== "object" || Array.isArray(feature.properties)))) throw new Error("INVALID_DATASET");
    const geometry = feature.geometry;
    let point: { type: "Point"; coordinates: number[] } | null = null;
    if (!geometry) exclusions.missing_geometry++;
    else if (geometry.type !== "Point") exclusions.non_point_geometry++;
    else if (!Array.isArray(geometry.coordinates) || !validCoordinate(geometry.coordinates[0], geometry.coordinates[1])) exclusions.invalid_geometry++;
    else point = { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] };
    if (!point && !config.preserveUnlocatedRecords) continue;
    const source = (feature.properties ?? {}) as Record<string, unknown>;
    const row: Record<string, unknown> = { geometry: point };
    for (const field of config.safeFields) {
      const value = safeValue(source[field]);
      if (value !== undefined) row[field] = value;
    }
    row.record_id = `${checksumSha256}-${index}`;
    rows.push(row);
  }
  return { rows, checksumSha256, acquiredAt: new Date().toISOString(), bytes: bytes.byteLength, cacheHit: false, exclusions };
}

export async function loadPointDataset(config: PointDatasetConfig): Promise<PointDatasetSnapshot> {
  const existing = cache.get(config.datasetId);
  if (existing) return { ...existing, cacheHit: true };
  const pending = inFlight.get(config.datasetId);
  if (pending) return { ...(await pending), cacheHit: true };
  const request = withLoading(`research:dataset:${config.datasetId}`, `載入 ${config.datasetId}`, (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(config.url, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (response.status === 404) throw new Error("DATASET_ASSET_MISSING");
      if (!response.ok) throw new Error("DATASET_UNAVAILABLE");
      if (response.headers.get("content-type")?.includes("text/html")) throw new Error("DATASET_ASSET_MISSING");
      const bytes = await boundedBytes(response);
      const snapshot = parse(config, bytes, await sha256(bytes));
      cache.set(config.datasetId, snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("REQUEST_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); }
  })());
  inFlight.set(config.datasetId, request);
  try { return await request; } finally { inFlight.delete(config.datasetId); }
}

export function clearPointDatasetCache(): void { cache.clear(); inFlight.clear(); }
