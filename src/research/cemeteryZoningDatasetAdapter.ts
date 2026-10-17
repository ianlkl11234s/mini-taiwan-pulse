import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

const ASSET_URL = "/funeral/cemetery_zoning.geojson";
const SOURCE_SHA256 = "55302cbf68ab98cf5608b6c5ac626eaef4eaa0dc3f80c46814f8b86f5d1a844e";
const SOURCE_BYTES = 601_318;
const FEATURE_COUNT = 114;
const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15_000;

type Row = Record<string, unknown>;
type ObjectValue = Record<string, unknown>;
export type CemeteryZoningFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function object(value: unknown): value is ObjectValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function abortReason(signal: AbortSignal): Error { return signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError"); }

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function nextChunk(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw abortReason(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => { void reader.cancel(signal.reason); reject(abortReason(signal)); };
    signal.addEventListener("abort", onAbort, { once: true });
    void reader.read().then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("CEMETERY_ZONING_TOO_LARGE");
  if (!response.body) throw new Error("CEMETERY_ZONING_BODY_REQUIRED");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await nextChunk(reader, signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("CEMETERY_ZONING_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function validGeoCrs(value: unknown): boolean {
  if (value === undefined) return true; // RFC 7946 GeoJSON defaults to WGS84 longitude/latitude.
  if (!object(value) || value.type !== "name" || !object(value.properties) || typeof value.properties.name !== "string") return false;
  return ["EPSG:4326", "URN:OGC:DEF:CRS:EPSG::4326", "URN:OGC:DEF:CRS:OGC:1.3:CRS84", "HTTP://WWW.OPENGIS.NET/DEF/CRS/EPSG/0/4326"].includes(value.properties.name.toUpperCase());
}

function position(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && Number.isFinite(value[0]) && typeof value[1] === "number" && Number.isFinite(value[1])
    && value[0] >= 119 && value[0] <= 123 && value[1] >= 21 && value[1] <= 27;
}
function ring(value: unknown): value is readonly [number, number][] {
  return Array.isArray(value) && value.length >= 4 && value.every(position) && value[0]![0] === value[value.length - 1]![0] && value[0]![1] === value[value.length - 1]![1];
}
function copyMultiPolygon(value: unknown): GeoJSON.MultiPolygon {
  if (!object(value) || value.type !== "MultiPolygon" || !Array.isArray(value.coordinates) || value.coordinates.length === 0
    || !value.coordinates.every(polygon => Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring))) throw new Error("CEMETERY_ZONING_GEOMETRY_INVALID");
  const polygons = value.coordinates as readonly (readonly (readonly [number, number][])[])[];
  return { type: "MultiPolygon", coordinates: polygons.map(polygon => polygon.map(currentRing => currentRing.map(current => [current[0], current[1]]))) };
}

/** Validates the immutable, browser-facing derivative before exposing any row. */
export function validateCemeteryZoningSnapshot(source: unknown): Row[] {
  if (!object(source) || source.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== FEATURE_COUNT || !validGeoCrs(source.crs)) throw new Error("CEMETERY_ZONING_FEATURE_COLLECTION_INVALID");
  const ids = new Set<string>();
  return source.features.map(feature => {
    if (!object(feature) || feature.type !== "Feature" || !object(feature.properties)) throw new Error("CEMETERY_ZONING_FEATURE_INVALID");
    const { zoning_id, zone_label, county, area_ha } = feature.properties;
    if (Object.keys(feature.properties).length !== 4 || typeof zoning_id !== "string" || !/^Z\d{4}$/.test(zoning_id) || ids.has(zoning_id)
      || typeof zone_label !== "string" || !/(墓|殯葬|殯儀)/.test(zone_label) || typeof county !== "string" || !["臺北市", "新北市"].includes(county)
      || typeof area_ha !== "number" || !Number.isFinite(area_ha) || area_ha < 0) throw new Error("CEMETERY_ZONING_PROPERTY_CONTRACT_MISMATCH");
    ids.add(zoning_id);
    return { zoning_id, zone_label, county, area_ha, geometry: copyMultiPolygon(feature.geometry) };
  });
}

export const cemeteryZoningDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-urban-cemetery-zones", label: "雙北都市計畫墓葬用地（衍生快照）",
  description: "雙北都市計畫圖資中以墓、殯葬或殯儀篩選的衍生 Polygon 快照；僅供探索，不是法律裁定、地籍精度、公墓全量或實際墓園現況。",
  layerRefs: [], kind: "polygon", recordGrain: "feature", primaryKey: ["zoning_id"],
  fields: [
    { name: "zoning_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "zone_label", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "hectares (source EPSG:3826 planar area)" },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "derived", precision: "Upstream make_valid -> WGS84 -> cemetery/funeral label selection -> 1e-6 degree precision-grid snapping; this adapter does not repair, simplify, or otherwise alter coordinates.", spatialAnalysisEligible: true },
  timeFields: [], coverage: "114 derived urban-planning zoning features in Taipei City and New Taipei City only; source snapshot landed 2026-08-01. Observation date is unknown.", license: "政府資料開放授權條款-第1版 (OGDL 1.0)",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "All exported attributes and geometry are required; null is rejected.", zero: "A source EPSG:3826 planar area of 0 hectares is retained as supplied; it is not missingness or proof of no cemetery activity.", missing: "An absent feature is outside this derived, label-filtered two-city snapshot; it does not establish absence of a cemetery or zoning designation." },
  versions: [{ versionId: SOURCE_SHA256, observedAt: null, availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺北市與新北市都市計畫公開資料（data.gov.tw 156197、166182）", reference: ASSET_URL, lineage: "upstream make_valid -> WGS84 -> select labels containing 墓|殯葬|殯儀 -> 1e-6 degree precision-grid snapping -> fixed browser GeoJSON SHA-256 verification. The local archive/raw-file SHA chain is unavailable; New Taipei City states its data are reference-only and published urban-plan documents/maps prevail." },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["zoning_id", "zone_label", "county", "area_ha", "geometry"], filters: ["zoning_id", "zone_label", "county", "area_ha"], supportsBbox: false, maxRowsPerQuery: 50, maxScanRows: FEATURE_COUNT, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "tw-urban-cemetery-zones-derived-v1",
};

export function createCemeteryZoningDatasetAdapter(fetcher: CemeteryZoningFetch = fetch): QueryAdapter {
  return {
    descriptor: cemeteryZoningDescriptor, allowedParameters: {},
    async read(_parameters, signal): Promise<AdapterReadResult> {
      return withLoading("research:cemetery-zoning", "載入雙北都市計畫墓葬用地", (async () => {
        if (signal?.aborted) throw abortReason(signal);
        const controller = new AbortController(); const forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", forwardAbort, { once: true }); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetcher(ASSET_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
          if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("CEMETERY_ZONING_ASSET_MISSING");
          if (!response.ok) throw new Error("CEMETERY_ZONING_UNAVAILABLE");
          const bytes = await boundedBytes(response, controller.signal);
          if (bytes.byteLength !== SOURCE_BYTES || await sha256(bytes) !== SOURCE_SHA256) throw new Error("CEMETERY_ZONING_SHA256_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("CEMETERY_ZONING_JSON_INVALID"); }
          const rows = validateCemeteryZoningSnapshot(source); const acquiredAt = new Date().toISOString();
          const sourceRefs: SourceReceipt[] = [
            { sourceId: "data.gov.tw:156197", version: "unknown", acquiredAt, checksumSha256: null, reference: "https://data.gov.tw/dataset/156197" },
            { sourceId: "data.gov.tw:166182", version: "unknown", acquiredAt, checksumSha256: null, reference: "https://data.gov.tw/dataset/166182" },
            { sourceId: "tw-urban-cemetery-zones:derived-snapshot", version: SOURCE_SHA256, acquiredAt, checksumSha256: SOURCE_SHA256, reference: ASSET_URL },
          ];
          return { rows, sourceRefs, coverage: cemeteryZoningDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: rows.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
        } catch (error) {
          if (signal?.aborted) throw abortReason(signal);
          if (controller.signal.aborted) throw new Error("CEMETERY_ZONING_REQUEST_TIMEOUT");
          throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
      })());
    },
  };
}
