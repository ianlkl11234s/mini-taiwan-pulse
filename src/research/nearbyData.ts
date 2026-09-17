import { withLoading } from "../lib/loadingRegistry";
import { LAYER_MANIFEST } from "../data/layerManifest";
import { describeLayer, discoverLayers, findPlaces, type DiscoveryContext } from "./discovery";

const SCHOOL_URL = "/education/schools.geojson";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FEATURES = 10_000;
const TIMEOUT_MS = 15_000;
const EARTH_RADIUS_M = 6_371_008.8;
const SAFE_SCHOOL_FIELDS = ["school_name", "school_level", "city", "district", "address", "region_type", "code"] as const;

export interface PointFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
  featureIndex: number;
}
interface RawFeature { type?: unknown; geometry?: unknown; properties?: unknown; }
interface RawCollection { type?: unknown; features?: unknown; }
interface CachedSchools {
  features: PointFeature[];
  dataHash: string;
  observedAt: string;
  exclusions: { missingGeometry: number; nonPoint: number; invalidCoordinates: number };
}

export interface ReadFeature {
  coordinates: { lng: number; lat: number };
  properties: Record<string, string | number | boolean | null>;
}
export interface NearbyRow {
  id: string;
  name: string;
  coordinates: [number, number];
  distanceM: number;
  properties: Record<string, string | number | boolean | null>;
}
interface SchoolSource {
  reference: string;
  observedAt: string;
  dataHash: string;
  cacheStatus: "session-memory";
  sourceStatus: string;
  sourceNote: string | null;
  sourceTime: "unknown";
  license: "unknown";
  coverage: "unknown";
}
export interface SchoolDatasetSnapshot {
  rows: Record<string, unknown>[];
  source: SchoolSource;
  exclusions: CachedSchools["exclusions"];
}
export interface ReadLayerResult {
  operation: "readLayer"; queryId: string; layerKey: string; dataReadSupport: "supported"; source: SchoolSource;
  offset: number; limit: number; totalMatched: number; returned: number; truncated: boolean; exclusions: CachedSchools["exclusions"] | null; features: ReadFeature[];
}
export interface NearbyResult {
  operation: "queryNearby"; queryId: string; layerKey: string; dataReadSupport: "supported" | "unsupported"; method: "haversine"; radiusM: number; center: { lng: number; lat: number };
  source: SchoolSource | null;
  totalMatched: number; returned: number; truncated: boolean; exclusions: CachedSchools["exclusions"] | null;
  rows: NearbyRow[];
}
export type DiscoveryOperation = "discoverLayers" | "describeLayer" | "findPlaces" | "readLayer" | "queryNearby";

let schoolsCache: CachedSchools | null = null;
let schoolsInFlight: Promise<CachedSchools> | null = null;
let sequence = 0;

function queryId(operation: string): string { sequence += 1; return `${operation}-${Date.now().toString(36)}-${sequence}`; }
function contextOrDefault(context?: DiscoveryContext): DiscoveryContext { return context ?? { locked: new Set(), visible: new Set() }; }
function supported(layerKey: string): layerKey is "schools" { return layerKey === "schools"; }
function validCoordinate(lng: unknown, lat: unknown): lng is number {
  return typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}
function bounds(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} 必須介於 ${min} 和 ${max}`);
  return value;
}
function safeProperties(properties: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const output: Record<string, string | number | boolean | null> = {};
  for (const key of SAFE_SCHOOL_FIELDS) {
    const value = properties[key];
    if (value === null) output[key] = null;
    else if (typeof value === "string") output[key] = value.slice(0, 160);
    else if (typeof value === "number" || typeof value === "boolean") output[key] = value;
  }
  return output;
}
function outward(feature: PointFeature): ReadFeature {
  return { coordinates: { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }, properties: safeProperties(feature.properties) };
}
function source(cache: CachedSchools): SchoolSource {
  const layer = describeLayer("schools");
  return { reference: SCHOOL_URL, observedAt: cache.observedAt, dataHash: cache.dataHash, cacheStatus: "session-memory", sourceStatus: layer?.sourceStatus ?? "unknown", sourceNote: LAYER_MANIFEST.schools.upstream.note ?? null, sourceTime: "unknown", license: "unknown", coverage: "unknown" };
}

async function readBytes(response: Response): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("DATASET_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function parseSchools(bytes: Uint8Array, dataHash: string): CachedSchools {
  let raw: RawCollection;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)) as RawCollection; } catch { throw new Error("INVALID_DATASET"); }
  if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) throw new Error("INVALID_DATASET");
  if (raw.features.length > MAX_FEATURES) throw new Error("INVALID_DATASET");
  const exclusions = { missingGeometry: 0, nonPoint: 0, invalidCoordinates: 0 };
  const features: PointFeature[] = [];
  for (let featureIndex = 0; featureIndex < raw.features.length; featureIndex++) {
    const candidate = raw.features[featureIndex];
    const feature = candidate as RawFeature;
    if (!feature || feature.type !== "Feature" || !feature.geometry) { exclusions.missingGeometry++; continue; }
    const geometry = feature.geometry as { type?: unknown; coordinates?: unknown };
    if (geometry.type !== "Point") { exclusions.nonPoint++; continue; }
    if (!Array.isArray(geometry.coordinates) || !validCoordinate(geometry.coordinates[0], geometry.coordinates[1])) { exclusions.invalidCoordinates++; continue; }
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] }, properties: feature.properties && typeof feature.properties === "object" && !Array.isArray(feature.properties) ? feature.properties as Record<string, unknown> : {}, featureIndex });
  }
  return { features, dataHash, observedAt: new Date().toISOString(), exclusions };
}
async function loadSchools(): Promise<CachedSchools> {
  if (schoolsCache) return schoolsCache;
  if (schoolsInFlight) return schoolsInFlight;
  schoolsInFlight = withLoading("research:nearby:schools", "載入學校資料", (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(SCHOOL_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (!response.ok) throw new Error("DATASET_UNAVAILABLE");
      const declaredBytes = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
      const bytes = await readBytes(response); const parsed = parseSchools(bytes, await sha256(bytes)); schoolsCache = parsed; return parsed;
    } catch (error) { throw new Error(error instanceof Error && error.name === "AbortError" ? "REQUEST_TIMEOUT" : error instanceof Error ? error.message : "DATASET_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  })());
  try { return await schoolsInFlight; } finally { schoolsInFlight = null; }
}

export function clearNearbyDataCache(): void { schoolsCache = null; schoolsInFlight = null; }

/** Shared analysis adapter entrypoint. This exposes normalized records, not layer visibility state. */
export async function loadSchoolDatasetSnapshot(): Promise<SchoolDatasetSnapshot> {
  const cache = await loadSchools();
  return {
    rows: cache.features.map(feature => ({
      ...safeProperties(feature.properties),
      geometry: { type: "Point", coordinates: [...feature.geometry.coordinates] },
      record_id: `${cache.dataHash.slice(0, 16)}-${feature.featureIndex}`,
    })),
    source: source(cache),
    exclusions: { ...cache.exclusions },
  };
}

export async function readLayer(layerKey: string, offset = 0, limit = 20, nameContains?: string, context?: DiscoveryContext): Promise<ReadLayerResult> {
  const safeOffset = bounds(offset, 0, 10_000, "offset"); const safeLimit = bounds(limit, 1, 20, "limit");
  if (context?.locked.has(layerKey)) throw new Error("LAYER_DENIED");
  if (!supported(layerKey)) throw new Error("LAYER_READ_UNSUPPORTED");
  const cache = await loadSchools(); const needle = nameContains?.normalize("NFKC").toLocaleLowerCase().trim() ?? "";
  const matched = needle ? cache.features.filter(feature => String(feature.properties.school_name ?? "").normalize("NFKC").toLocaleLowerCase().includes(needle)) : cache.features;
  const features = matched.slice(safeOffset, safeOffset + safeLimit).map(outward);
  return { operation: "readLayer", queryId: queryId("read"), layerKey, dataReadSupport: "supported", source: source(cache), offset: safeOffset, limit: safeLimit, totalMatched: matched.length, returned: features.length, truncated: safeOffset + features.length < matched.length, exclusions: cache.exclusions, features };
}

function haversineMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const radians = Math.PI / 180; const dLat = (b.lat - a.lat) * radians; const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function queryNearby(layerKey: string, center: { lng: number; lat: number }, radiusM: number, limit = 20, context?: DiscoveryContext): Promise<NearbyResult> {
  if (!validCoordinate(center.lng, center.lat)) throw new Error("center 必須是有效的 WGS84 經緯度");
  if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 10_000) throw new Error("INVALID_INPUT");
  const safeRadius = radiusM; const safeLimit = bounds(limit, 1, 50, "limit");
  if (context?.locked.has(layerKey)) throw new Error("LAYER_DENIED");
  if (!supported(layerKey)) throw new Error("LAYER_READ_UNSUPPORTED");
  const cache = await loadSchools();
  const matched = cache.features.map(feature => ({ feature, distance: haversineMeters(center, { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }) }))
    .filter(item => item.distance <= safeRadius + 1e-9) // one-nanometer tolerance for floating-point boundary error
    .sort((a, b) => a.distance - b.distance || String(a.feature.properties.code ?? "").localeCompare(String(b.feature.properties.code ?? "")));
  const rows = matched.slice(0, safeLimit).map(item => ({
    id: `${cache.dataHash.slice(0, 16)}-${item.feature.featureIndex}`,
    name: typeof item.feature.properties.school_name === "string" ? item.feature.properties.school_name.slice(0,160) : "",
    coordinates: [...item.feature.geometry.coordinates] as [number, number],
    distanceM: Math.round(item.distance * 1000) / 1000,
    properties: safeProperties(item.feature.properties),
  }));
  return { operation: "queryNearby", queryId: queryId("nearby"), layerKey, dataReadSupport: "supported", method: "haversine", radiusM: safeRadius, center, source: source(cache), totalMatched: matched.length, returned: rows.length, truncated: rows.length < matched.length, exclusions: cache.exclusions, rows };
}

export async function executeDiscovery(operation: DiscoveryOperation, args: Record<string, unknown>, context?: DiscoveryContext): Promise<Record<string, unknown>> {
  const ctx = contextOrDefault(context);
  switch (operation) {
    case "discoverLayers": return discoverLayers(String(args.query ?? ""), Number(args.offset ?? 0), Number(args.limit ?? 20), ctx) as Record<string, unknown>;
    case "describeLayer": { const layer = describeLayer(String(args.layerKey ?? ""), ctx); if (!layer) throw new Error("LAYER_NOT_FOUND"); return layer as unknown as Record<string, unknown>; }
    case "findPlaces": return findPlaces(String(args.query ?? ""), Number(args.limit ?? 10)) as Record<string, unknown>;
    case "readLayer": return await readLayer(String(args.layerKey ?? ""), Number(args.offset ?? 0), Number(args.limit ?? 20), typeof args.nameContains === "string" ? args.nameContains : undefined, ctx) as unknown as Record<string, unknown>;
    case "queryNearby": return await queryNearby(String(args.layerKey ?? ""), args.center as { lng: number; lat: number }, Number(args.radiusM), Number(args.limit ?? 20), ctx) as unknown as Record<string, unknown>;
  }
}
