import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

const ASSET_URL = "/geo/active_faults.geojson";
const SOURCE_SHA256 = "a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e";
const SOURCE_BYTES = 2_632_866;
const FEATURE_COUNT = 22;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const EXPECTED_CODES = new Set(["F0001", "F0002", "F0003", "F0004", "F0005", "F0006", "F0008", "F0009", "F0010", "F0012", "F0013", "F0014", "F0015", "F0017", "F0018", "F0019", "F0020", "F0021", "F0022", "F0023", "F0024", "F1011"]);

type ObjectValue = Record<string, unknown>;
type Position = readonly [number, number];
type MultiPolygon = { type: "MultiPolygon"; coordinates: readonly (readonly (readonly Position[])[])[] };
type Row = { fault_code: string; geometry: MultiPolygon };
export type ActiveFaultsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("ACTIVE_FAULTS_TOO_LARGE");
  if (!response.body) throw new Error("ACTIVE_FAULTS_BODY_REQUIRED");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await nextChunk(reader, signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("ACTIVE_FAULTS_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** The fixed source has 2D and [lng, lat, 0] vertices.  A non-zero third ordinate would change the declared horizontal-surface contract and is rejected. */
function position(value: unknown): Position {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)
    || typeof value[0] !== "number" || !Number.isFinite(value[0]) || typeof value[1] !== "number" || !Number.isFinite(value[1])
    || value[0] < 119 || value[0] > 123 || value[1] < 21 || value[1] > 27
    || value.length === 3 && (typeof value[2] !== "number" || !Number.isFinite(value[2]) || value[2] !== 0)) throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
  return [value[0], value[1]];
}

function ring(value: unknown): readonly Position[] {
  if (!Array.isArray(value) || value.length < 4) throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
  const coordinates = value.map(position);
  const first = coordinates[0]!; const last = coordinates[coordinates.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
  return coordinates;
}

function polygon(value: unknown): readonly (readonly Position[])[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
  return value.map(ring);
}

function normalizedGeometry(value: unknown): MultiPolygon {
  if (!object(value)) throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
  if (value.type === "Polygon") return { type: "MultiPolygon", coordinates: [polygon(value.coordinates)] };
  if (value.type === "MultiPolygon" && Array.isArray(value.coordinates) && value.coordinates.length > 0) return { type: "MultiPolygon", coordinates: value.coordinates.map(polygon) };
  throw new Error("ACTIVE_FAULTS_GEOMETRY_INVALID");
}

function faultCode(properties: ObjectValue): string {
  const matches = new Set(Object.values(properties).flatMap(value => typeof value === "string" ? value.match(/F\d{4}/g) ?? [] : []));
  if (matches.size !== 1) throw new Error("ACTIVE_FAULTS_PROPERTY_CONTRACT_MISMATCH");
  const code = [...matches][0]!;
  if (!EXPECTED_CODES.has(code)) throw new Error("ACTIVE_FAULTS_PROPERTY_CONTRACT_MISMATCH");
  return code;
}

/** Validates the SHA-bound source, returning only the official code and horizontal legal-reference surface. */
export function validateActiveFaultsSnapshot(source: unknown): Row[] {
  if (!object(source) || source.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== FEATURE_COUNT) throw new Error("ACTIVE_FAULTS_FEATURE_COLLECTION_INVALID");
  const codes = new Set<string>();
  const rows = source.features.map(feature => {
    if (!object(feature) || feature.type !== "Feature" || !object(feature.properties)) throw new Error("ACTIVE_FAULTS_FEATURE_INVALID");
    const fault_code = faultCode(feature.properties);
    if (codes.has(fault_code)) throw new Error("ACTIVE_FAULTS_DUPLICATE_FAULT_CODE");
    codes.add(fault_code);
    return { fault_code, geometry: normalizedGeometry(feature.geometry) };
  });
  if (codes.size !== EXPECTED_CODES.size || [...EXPECTED_CODES].some(code => !codes.has(code))) throw new Error("ACTIVE_FAULTS_PROPERTY_CONTRACT_MISMATCH");
  return rows.sort((left, right) => left.fault_code.localeCompare(right.fault_code));
}

export const activeFaultsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-active-faults-sensitive-zones", label: "活動斷層地質敏感區（固定快照）",
  description: "經濟部地質調查及礦業管理中心活動斷層地質敏感區的固定面域快照；僅供位置參考，非法律判定、地籍現況、風險分級或當前地震資料。",
  layerRefs: ["activeFaults"], kind: "polygon", recordGrain: "feature", primaryKey: ["fault_code"],
  fields: [
    { name: "fault_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "Fixed WGS84 browser snapshot. Polygon members are wrapped as one-part MultiPolygons and [lng,lat,0] vertices lose only their zero third ordinate; horizontal rings, holes, and multipart boundaries are otherwise unchanged.", spatialAnalysisEligible: true },
  timeFields: [], coverage: "22 announced active-fault geological-sensitive-zone features: official local catalog has 23 entries, but this fixed asset excludes superseded F0011 and has no observed-at timestamp. An empty bbox is not evidence that a location has no fault, legal restriction, or hazard.",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）；上游檔案使用說明要求僅作土地位置參考，公告與正式圖資為準。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "fault_code and geometry are required; null is rejected.", missing: "No match is only absence from this 22-feature fixed snapshot, not absence of a fault, legal restriction, seismic risk, or a current hazard.", stale: "This fixed snapshot has unknown observation date and does not report current revisions, earthquakes, ground motion, recurrence, or risk.", zero: "No numeric hazard value is supplied; zero must not be inferred.", suppressed: "No suppressed numeric values are represented by this geometry-only adapter." },
  versions: [{ versionId: SOURCE_SHA256, observedAt: null, availableAt: "2026-03-06T10:41:56+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部地質調查及礦業管理中心（GSMMA）", reference: "https://data.gov.tw/dataset/27744", lineage: "GSMMA active-fault geological-sensitive-zone catalog and individual announced Shapefiles -> taipei-gis-analytics active_faults_sensitive_zones.geojson -> SHA-256-bound browser asset. The asset is byte-identical to that local raw GeoJSON; source commit 9615a613 records its import on 2026-03-06. Only the official F code and horizontal surface are exposed; source-folder labels, mixed encodings, dates, descriptions, areas, and other raw attributes are deliberately excluded." },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["fault_code", "geometry"], filters: ["fault_code"], supportsBbox: true, maxRowsPerQuery: FEATURE_COUNT, maxScanRows: FEATURE_COUNT, maxResponseBytes: 512 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "tw-active-faults-sensitive-zones-v1",
};

export function createActiveFaultsDatasetAdapter(fetcher: ActiveFaultsFetch = fetch): QueryAdapter {
  return {
    descriptor: activeFaultsDescriptor, allowedParameters: {},
    async read(_parameters, signal): Promise<AdapterReadResult> {
      return withLoading("research:active-faults", "載入活動斷層地質敏感區", (async () => {
        if (signal?.aborted) throw abortReason(signal);
        const controller = new AbortController(); const forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", forwardAbort, { once: true }); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetcher(ASSET_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
          if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("ACTIVE_FAULTS_ASSET_MISSING");
          if (!response.ok) throw new Error("ACTIVE_FAULTS_UNAVAILABLE");
          const bytes = await boundedBytes(response, controller.signal);
          if (bytes.byteLength !== SOURCE_BYTES || await sha256(bytes) !== SOURCE_SHA256) throw new Error("ACTIVE_FAULTS_SHA256_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("ACTIVE_FAULTS_JSON_INVALID"); }
          const rows = validateActiveFaultsSnapshot(source); const acquiredAt = new Date().toISOString();
          const sourceRefs: SourceReceipt[] = [
            { sourceId: "data.gov.tw:27744", version: "catalog-reference", acquiredAt, checksumSha256: null, reference: "https://data.gov.tw/dataset/27744" },
            { sourceId: "tw-active-faults-sensitive-zones:derived-snapshot", version: SOURCE_SHA256, acquiredAt, checksumSha256: SOURCE_SHA256, reference: ASSET_URL },
          ];
          return { rows, sourceRefs, coverage: activeFaultsDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: rows.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
        } catch (error) {
          if (signal?.aborted) throw abortReason(signal);
          if (controller.signal.aborted) throw new Error("ACTIVE_FAULTS_REQUEST_TIMEOUT");
          throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
      })());
    },
  };
}

export const activeFaultsAdapter = createActiveFaultsDatasetAdapter();
