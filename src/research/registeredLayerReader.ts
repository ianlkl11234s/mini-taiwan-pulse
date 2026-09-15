import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { withLoading } from "../lib/loadingRegistry";
import type { DatasetDescriptor, DatasetField, FieldType, SourceReceipt } from "./dataContracts";
import type { AdapterSnapshot } from "./queryAdapters";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FEATURES = 20_000;
const MAX_INFERRED_FIELDS = 38; // record_id and geometry make the descriptor cap 40.
const TIMEOUT_MS = 15_000;
const SAFE_FIELD = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const SAFE_GEOJSON_PATH = /^(?:\.\/|\/)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]*\.geojson$/;

type Row = Record<string, unknown>;
type Primitive = string | number | boolean | null;
type GeojsonSource = { kind: "geojson"; sourceId: string; url: string };
type Exclusions = { missing_geometry: number; non_point_geometry: number; invalid_geometry: number };

export interface RegisteredLayerSourceRef { sourceId: string; url: string; }
export interface RegisteredLayerReadOptions { locked: ReadonlySet<string>; }
export interface RegisteredLayerRead { descriptor: DatasetDescriptor; snapshot: AdapterSnapshot; }

function registeredSource(layerKey: string): GeojsonSource | null {
  if (!Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, layerKey)) return null;
  const entry = LAYER_MANIFEST[layerKey as ManifestKey];
  if (Array.isArray(entry.source) || entry.source.kind !== "geojson" || !SAFE_GEOJSON_PATH.test(entry.source.url)) return null;
  return entry.source;
}

function canonicalAssetPath(url: string): string { return url.startsWith("./") ? url.slice(1) : url; }

function sourceLocked(url: string, locked: ReadonlySet<string>): boolean {
  const canonical = canonicalAssetPath(url);
  for (const [key, entry] of Object.entries(LAYER_MANIFEST)) {
    const sources = Array.isArray(entry.source) ? entry.source : [entry.source];
    if (locked.has(key) && sources.some(source => source.kind === "geojson" && canonicalAssetPath(source.url) === canonical)) return true;
  }
  return false;
}

/** Returns only the fixed manifest asset reference; callers cannot supply a URL. */
export function describeRegisteredLayer(layerKey: string): RegisteredLayerSourceRef | null {
  const source = registeredSource(layerKey);
  return source ? { sourceId: source.sourceId, url: source.url } : null;
}

function validCoordinate(lng: unknown, lat: unknown): lng is number {
  return typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
    && typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function primitive(value: unknown): Primitive | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 4_000);
  if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") return value;
  return undefined;
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
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error("DATASET_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function parse(bytes: Uint8Array, checksumSha256: string): { rows: Row[]; exclusions: Exclusions; fields: DatasetField[]; mixedFields: string[]; sourceFeatureCount: number } {
  const text = new TextDecoder().decode(bytes);
  if (text.slice(0, 100).trimStart().startsWith("<")) throw new Error("DATASET_ASSET_MISSING");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("INVALID_DATASET"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || (raw as { type?: unknown }).type !== "FeatureCollection") throw new Error("INVALID_DATASET");
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length > MAX_FEATURES) throw new Error("INVALID_DATASET");

  const exclusions: Exclusions = { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 };
  const staged: { geometry: Row["geometry"]; properties: Record<string, unknown> }[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object" || Array.isArray(feature) || !(feature as { geometry?: unknown }).geometry) { exclusions.missing_geometry += 1; continue; }
    const geometry = (feature as { geometry: { type?: unknown; coordinates?: unknown } }).geometry;
    if (geometry.type !== "Point") { exclusions.non_point_geometry += 1; continue; }
    if (!Array.isArray(geometry.coordinates) || !validCoordinate(geometry.coordinates[0], geometry.coordinates[1])) { exclusions.invalid_geometry += 1; continue; }
    const value = (feature as { properties?: unknown }).properties;
    staged.push({ geometry: { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] }, properties: value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} });
  }
  if (features.length > 0 && staged.length === 0 && exclusions.non_point_geometry > 0) throw new Error("UNSUPPORTED_LAYER_GEOMETRY");

  const types = new Map<string, FieldType>();
  const mixed = new Set<string>();
  for (const item of staged) for (const [name, value] of Object.entries(item.properties)) {
    if (!SAFE_FIELD.test(name) || value === null || mixed.has(name)) continue;
    const safe = primitive(value);
    const type: FieldType | null = typeof safe === "string" ? "string" : typeof safe === "number" ? "number" : typeof safe === "boolean" ? "boolean" : null;
    if (!type) { mixed.add(name); types.delete(name); continue; }
    const existing = types.get(name);
    if (existing && existing !== type) { mixed.add(name); types.delete(name); } else if (!existing) types.set(name, type);
  }
  const selected = [...types.entries()].filter(([name]) => !mixed.has(name)).sort(([a], [b]) => a.localeCompare(b)).slice(0, MAX_INFERRED_FIELDS);
  const selectedNames = new Set(selected.map(([name]) => name));
  const rows = staged.map((item, index) => {
    const row: Row = { record_id: `${checksumSha256}-${index}`, geometry: item.geometry };
    for (const name of selectedNames) {
      const value = primitive(item.properties[name]);
      if (value !== undefined) row[name] = value;
    }
    return row;
  });
  const fields: DatasetField[] = [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    ...selected.map(([name, type]) => ({ name, type, nullable: staged.some(item => item.properties[name] === null || item.properties[name] === undefined), nullMeaning: "來源未提供或為 null", unit: null })),
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ];
  return { rows, exclusions, fields, mixedFields: [...mixed].sort(), sourceFeatureCount: features.length };
}

function descriptor(layerKey: string, source: GeojsonSource, fields: DatasetField[], checksumSha256: string, mixedFields: readonly string[]): DatasetDescriptor {
  const entry = LAYER_MANIFEST[layerKey as ManifestKey];
  const label = "label" in entry ? entry.label : layerKey;
  const description = "description" in entry ? entry.description : "已登記圖層來源資料";
  const notes = `registered local GeoJSON source; validated Point subset without layer display filters; use fields for an explicit filter; geometry precision unreviewed and therefore proxy; mixed-type fields omitted: ${mixedFields.join(",") || "none"}`;
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: `layer:${layerKey}`, label: `${label}來源資料`, description: `${description} 已驗證 Point 子集，未套用圖層顯示 filter；請用 fields 明確 filter。`,
    layerRefs: [layerKey], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "unreviewed registered GeoJSON coordinates", spatialAnalysisEligible: false },
    timeFields: [], coverage: `unknown; ${notes}`, license: "unknown",
    versions: [{ versionId: `sha256:${checksumSha256}`, observedAt: null, availableAt: null, checksumSha256, mutable: true }],
    source: { publisher: "unknown", reference: source.url, lineage: notes },
    accessPolicy: { mode: "public", maxRowsPerQuery: 1_000, maxScanRows: MAX_FEATURES },
    supportedOperations: ["query_records", "aggregate"], adapterId: "registered-layer-geojson-v1",
  };
}

export async function readRegisteredLayer(layerKey: string, options: RegisteredLayerReadOptions): Promise<RegisteredLayerRead> {
  if (!options || !(options.locked instanceof Set) && !(options.locked && typeof options.locked.has === "function")) throw new Error("INVALID_REGISTERED_LAYER_OPTIONS");
  const source = registeredSource(layerKey);
  if (!source) throw new Error("REGISTERED_LAYER_NOT_READABLE");
  if (options.locked.has(layerKey) || sourceLocked(source.url, options.locked)) throw new Error("LAYER_DENIED");
  return withLoading(`research:registered-layer:${layerKey}`, `載入 ${layerKey}`, (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(source.url, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("DATASET_ASSET_MISSING");
      if (!response.ok) throw new Error("DATASET_UNAVAILABLE");
      const bytes = await boundedBytes(response); const checksumSha256 = await sha256(bytes);
      const parsed = parse(bytes, checksumSha256); const acquiredAt = new Date().toISOString();
      const resultDescriptor = descriptor(layerKey, source, parsed.fields, checksumSha256, parsed.mixedFields);
      const receipt: SourceReceipt = { sourceId: source.sourceId, version: `sha256:${checksumSha256}`, acquiredAt, checksumSha256, reference: source.url };
      return { descriptor: resultDescriptor, snapshot: { rows: parsed.rows, source: receipt, coverage: resultDescriptor.coverage, freshness: "unknown", exclusions: parsed.exclusions, rowsScanned: parsed.sourceFeatureCount, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null } };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("REQUEST_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); }
  })());
}
