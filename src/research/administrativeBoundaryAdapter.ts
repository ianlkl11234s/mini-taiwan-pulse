import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

const HARD_MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

type Row = Record<string, unknown>;
export type AdministrativeBoundaryFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type AdministrativeBoundaryContract = Readonly<{
  datasetId: string;
  layerRefs?: readonly string[];
  sourceUrl: string;
  sourceSha256: string;
  version: string;
  /** Date represented by this administrative snapshot; null when the publisher does not declare one. */
  observedAt?: string | null;
  /** When the immutable raw artifact was obtained; null must remain explicit rather than inferred from a local read. */
  rawAcquiredAt?: string | null;
  publisher: string;
  license: string;
  codeProperty: string;
  nameProperty: string;
  expectedAreas: number;
  maxBytes: number;
}>;

function object(value: unknown): value is Row { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validSha(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }
function validDateOrNull(value: string | null | undefined): boolean { return value === undefined || value === null || Number.isFinite(Date.parse(value)); }
function validGeoCrs(value: unknown): boolean {
  if (value === undefined) return true; // RFC 7946 GeoJSON defaults to WGS84 longitude/latitude.
  if (!object(value) || value.type !== "name" || !object(value.properties) || typeof value.properties.name !== "string") return false;
  return ["EPSG:4326", "URN:OGC:DEF:CRS:EPSG::4326", "URN:OGC:DEF:CRS:OGC:1.3:CRS84", "HTTP://WWW.OPENGIS.NET/DEF/CRS/EPSG/0/4326"].includes(value.properties.name.toUpperCase());
}
function sameOriginPath(value: string): boolean {
  return /^\/[A-Za-z0-9_][A-Za-z0-9._/-]*$/.test(value)
    && value.split("/").slice(1).every(segment => segment.length > 0 && segment !== "." && segment !== "..");
}
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

async function boundedBytes(response: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("BOUNDARY_TOO_LARGE");
  if (!response.body) throw new Error("BOUNDARY_BODY_REQUIRED");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await nextChunk(reader, signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("BOUNDARY_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function position(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && Number.isFinite(value[0]) && typeof value[1] === "number" && Number.isFinite(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}
function ring(value: unknown): value is readonly [number, number][] {
  return Array.isArray(value) && value.length >= 4 && value.every(position) && value[0]![0] === value[value.length - 1]![0] && value[0]![1] === value[value.length - 1]![1];
}
function clonePolygon(value: readonly (readonly [number, number][])[]): GeoJSON.Position[][] {
  return value.map(currentRing => currentRing.map(current => [current[0], current[1]]));
}
function asMultiPolygon(value: unknown): GeoJSON.MultiPolygon {
  if (!object(value) || !["Polygon", "MultiPolygon"].includes(String(value.type)) || !Array.isArray(value.coordinates)) throw new Error("BOUNDARY_GEOMETRY_INVALID");
  if (value.type === "Polygon") {
    if (value.coordinates.length === 0 || !value.coordinates.every(ring)) throw new Error("BOUNDARY_GEOMETRY_INVALID");
    return { type: "MultiPolygon", coordinates: [clonePolygon(value.coordinates as unknown as readonly (readonly [number, number][])[])] };
  }
  if (value.coordinates.length === 0 || !value.coordinates.every(polygon => Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring))) throw new Error("BOUNDARY_GEOMETRY_INVALID");
  return { type: "MultiPolygon", coordinates: value.coordinates.map(polygon => clonePolygon(polygon as unknown as readonly (readonly [number, number][])[])) };
}

function descriptor(contract: AdministrativeBoundaryContract): DatasetDescriptor {
  const observedAt = contract.observedAt ?? null;
  const rawAcquiredAt = contract.rawAcquiredAt ?? null;
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: contract.datasetId, label: `${contract.version} 行政界線`, description: `已驗證 ${contract.publisher} 原始行政界線；同源 immutable bytes 依 code property 保留實際 Polygon/MultiPolygon。`,
    layerRefs: contract.layerRefs ?? [], kind: "polygon", recordGrain: "feature", primaryKey: ["area_code"],
    fields: [
      { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "area_name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "boundary_sha256", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
    ],
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "Verified raw administrative-boundary artifact; no simplification or area interpolation by this adapter.", spatialAnalysisEligible: true },
    timeFields: [], coverage: `${contract.expectedAreas} expected administrative areas from verified raw boundary bytes.`, license: contract.license,
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "Boundary code, name, and geometry are required; null is rejected.", missing: "An absent code is outside this immutable boundary snapshot, not proof that no administrative area exists." },
    versions: [{ versionId: contract.version, observedAt, availableAt: null, checksumSha256: contract.sourceSha256, mutable: false }],
    source: { publisher: contract.publisher, reference: contract.sourceUrl, lineage: `fixed same-origin raw boundary bytes -> SHA-256 verification -> code/name-preserving MultiPolygon rows; snapshot observedAt=${observedAt ?? "unknown"}; raw acquiredAt=${rawAcquiredAt ?? "unknown"}` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: ["area_code", "area_name", "boundary_version", "boundary_sha256", "geometry"], filters: ["area_code"], maxRowsPerQuery: contract.expectedAreas, maxScanRows: contract.expectedAreas, maxSourceBytes: contract.maxBytes, timeoutMs: TIMEOUT_MS }),
    supportedOperations: ["query_records", "line_intersects", "aggregate"], adapterId: "verified-administrative-boundary-v1",
  };
}

function validateContract(contract: AdministrativeBoundaryContract): void {
  if (!/^[A-Za-z][A-Za-z0-9._:-]{0,159}$/.test(contract.datasetId) || !sameOriginPath(contract.sourceUrl) || !validSha(contract.sourceSha256) || !validDateOrNull(contract.observedAt) || !validDateOrNull(contract.rawAcquiredAt) || !contract.version || !contract.publisher || !contract.license || !contract.codeProperty || !contract.nameProperty || !Number.isInteger(contract.expectedAreas) || contract.expectedAreas < 1 || contract.expectedAreas > 2_000 || !Number.isInteger(contract.maxBytes) || contract.maxBytes < 2 || contract.maxBytes > HARD_MAX_BYTES) throw new Error("INVALID_ADMINISTRATIVE_BOUNDARY_CONTRACT");
}

export function createAdministrativeBoundaryAdapter(contract: AdministrativeBoundaryContract, fetcher: AdministrativeBoundaryFetch = fetch): QueryAdapter {
  validateContract(contract); const dataDescriptor = descriptor(contract);
  return {
    descriptor: dataDescriptor, allowedParameters: {},
    async read(_parameters, signal): Promise<AdapterReadResult> {
      return withLoading(`research:boundary:${contract.datasetId}`, `載入 ${contract.version} 行政界線`, (async () => {
        if (signal?.aborted) throw abortReason(signal);
        const controller = new AbortController(); const forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", forwardAbort, { once: true }); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetcher(contract.sourceUrl, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
          if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("BOUNDARY_ASSET_MISSING");
          if (!response.ok) throw new Error("BOUNDARY_UNAVAILABLE");
          const bytes = await boundedBytes(response, contract.maxBytes, controller.signal);
          if (await sha256(bytes) !== contract.sourceSha256) throw new Error("BOUNDARY_SHA256_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("BOUNDARY_JSON_INVALID"); }
          if (!object(source) || source.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== contract.expectedAreas) throw new Error("BOUNDARY_FEATURE_COLLECTION_INVALID");
          if (!validGeoCrs(source.crs)) throw new Error("BOUNDARY_CRS_UNSUPPORTED");
          const codes = new Set<string>(); const rows: Row[] = [];
          for (const feature of source.features) {
            if (!object(feature) || feature.type !== "Feature" || !object(feature.properties)) throw new Error("BOUNDARY_FEATURE_INVALID");
            const code = feature.properties[contract.codeProperty], name = feature.properties[contract.nameProperty];
            if (typeof code !== "string" || !code || typeof name !== "string" || !name || codes.has(code)) throw new Error("BOUNDARY_CODE_CONTRACT_MISMATCH");
            codes.add(code); rows.push({ area_code: code, area_name: name, boundary_version: contract.version, boundary_sha256: contract.sourceSha256, geometry: asMultiPolygon(feature.geometry) });
          }
          const acquiredAt = new Date().toISOString(); const receipt: SourceReceipt = { sourceId: `administrative-boundary:${contract.version}`, version: contract.version, acquiredAt, checksumSha256: contract.sourceSha256, reference: contract.sourceUrl };
          return {
            rows, sourceRefs: [receipt],
            lineage: { sourceContract: { observedAt: contract.observedAt ?? null, rawAcquiredAt: contract.rawAcquiredAt ?? null } },
            coverage: dataDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: rows.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null,
          };
        } catch (error) {
          if (signal?.aborted) throw abortReason(signal);
          if (controller.signal.aborted) throw new Error("REQUEST_TIMEOUT");
          throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
      })());
    },
  };
}
