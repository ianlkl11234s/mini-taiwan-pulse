// Preserved research draft. Not registered in RESEARCH_QUERY_EXECUTOR; source rights,
// focused tests, display-version receipt and normal MCP/browser acceptance remain open.
import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type MultiPolygonGeometry } from "./spatialKernel";

type Row = Record<string, unknown>;
type Scope = "control" | "restricted";
const URL = "/__local-research-owner-only/aviation-airspace/airspace-airac-01-26-owner.geojson";
const SHA = "b32288f6d8a7bb31313b3b6ad853e27f1e2323b1ef65a814f50de6350d405fb7";
const BYTES = 134_531;
const SOURCE_SHA = "93db71eff491407e1222a404fd2443fa21b09d1ce78c3e87bb085d0f5ab778fc";
const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 15_000;
const COUNTS: Record<string, number> = { FIR: 3, TMA: 6, RCR: 29, ULZ: 20, CTR: 12, SURFACE: 6, CONTROL: 2, DANGER: 2, CIRCUIT: 1 };
const CONTROL = new Set(["FIR", "TMA"]);
const RESTRICTED = new Set(["RCR", "ULZ", "CTR", "SURFACE", "CONTROL", "DANGER", "CIRCUIT"]);
const fields: readonly DatasetField[] = [
  { name: "layer", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name_zh", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name_en", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "floor_m", type: "number", nullable: true, nullMeaning: "eAIP 解析版未提供可換算的下限，不能當 0 m。", unit: "m" },
  { name: "ceiling_m", type: "number", nullable: true, nullMeaning: "eAIP 解析版未提供可換算的上限，不能當無限高。", unit: "m" },
  { name: "floor_raw", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "ceiling_raw", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "airspace_class", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "layer_index", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "warnings", type: "json", nullable: false, nullMeaning: null, unit: null },
  { name: "remarks", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry_repaired", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
function descriptor(scope: Scope): DatasetDescriptor {
  const control = scope === "control";
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: control ? "tw-eaip-control-airac-01-26-owner" : "tw-eaip-restricted-airac-01-26-owner",
    label: control ? "eAIP FIR／TMA 固定歷史空域" : "eAIP 管制／限航／危險區固定歷史空域",
    description: "民航局 eAIP AIRAC 01-26 的本機解析快照；水平面與上下高度須一起讀，不能作現行飛行許可、安全或法定空域判斷。",
    layerRefs: control ? ["aviationControl"] : ["aviationRestricted", "aviationRestrictedGlow"], kind: "polygon", recordGrain: "feature", primaryKey: ["code", "layer_index"], fields,
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "proxy", precision: "eAIP 描述解析並採樣弧線的水平面。RCR7 原面自交，本機研究副本以 buffer(0) 修復且面積不變；原始 GeoJSON 不改。高度與執行時段另見屬性及原 eAIP，bbox 相交不能推論現時可飛或受限。", spatialAnalysisEligible: false },
    timeFields: [], coverage: control ? "AIRAC 01-26 固定 9 面：FIR 3 個高度層、TMA 6；不等於禁航區。" : "AIRAC 01-26 固定 72 面：CTR/CONTROL/SURFACE/RCR/DANGER/ULZ/CIRCUIT。發光層只重用這 72 面，沒有獨立來源。",
    license: "HOLD：eAIP 網頁可讀不等於已核實公開重發布授權；本機 owner-only。既有 PMTiles 的同版產製 receipt 未驗。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "本 AIRAC cycle 未收錄或未解析的區域不能視為無飛航限制。", null: "floor_m／ceiling_m 的 null 是無可換算高度，保留 floor_raw／ceiling_raw；不能補零或無限高。", stale: "AIRAC 01-26 為歷史 cycle；未核現在 eAIP、NOTAM、軍演或臨時公告，不能用來決定飛行是否合法或安全。" },
    versions: [{ versionId: `AIRAC-01-26-sidecar-sha256:${SHA}`, observedAt: null, availableAt: null, checksumSha256: SHA, mutable: false }],
    source: { publisher: "交通部民用航空局飛航服務總台 AIS", reference: URL, lineage: `四份 AIRAC 01-26 ENR 2.1/5.1/5.3/5.5 HTML -> analytics 81-feature GeoJSON SHA ${SOURCE_SHA} -> safe owner-only sidecar SHA ${SHA}; RCR7 surface repaired and flagged. eAIP source-page licensing and display-tile exact build identity remain unverified.` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["layer", "code", "name_zh", "airspace_class", "source", "geometry_repaired"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 81, maxResponseBytes: 1024 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `eaip-airac-01-26-${scope}-owner-v1`,
  };
}
export const aviationControlOwnerDescriptor = descriptor("control");
export const aviationRestrictedOwnerDescriptor = descriptor("restricted");
export type AviationAirspaceFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let cached: { rows: Row[]; acquiredAt: string } | null = null;
function fail(code: string): never { throw new Error(code); }
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== BYTES)) fail("AIRSPACE_SIZE_MISMATCH");
  if (!response.body) fail("AIRSPACE_BODY_MISSING");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { if (signal.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError"); const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); fail("AIRSPACE_TOO_LARGE"); } chunks.push(next.value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (bytes.byteLength !== BYTES) fail("AIRSPACE_SIZE_MISMATCH");
  return bytes;
}
function multi(value: unknown): MultiPolygonGeometry {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("AIRSPACE_GEOMETRY_INVALID");
}
function rowsFromSource(source: unknown): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 81) fail("AIRSPACE_COLLECTION_INVALID");
  const count: Record<string, number> = {}, ids = new Set<string>(); let repaired = 0, floorNull = 0, ceilingNull = 0;
  const rows = collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: unknown; geometry?: unknown };
    const p = feature?.properties as Record<string, unknown> | undefined;
    if (feature?.type !== "Feature" || !p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length !== fields.length - 1) fail("AIRSPACE_ROW_INVALID");
    const { layer, code, layer_index: index, floor_m: floor, ceiling_m: ceiling, geometry_repaired: fix } = p;
    if (typeof layer !== "string" || COUNTS[layer] === undefined || typeof code !== "string" || !code || typeof index !== "number" || !Number.isInteger(index) || typeof fix !== "boolean" || (floor !== null && (typeof floor !== "number" || !Number.isFinite(floor))) || (ceiling !== null && (typeof ceiling !== "number" || !Number.isFinite(ceiling)))) fail("AIRSPACE_ROW_INVALID");
    for (const name of ["name_zh", "name_en", "floor_raw", "ceiling_raw", "airspace_class", "source", "remarks"]) if (typeof p[name] !== "string") fail("AIRSPACE_ROW_INVALID");
    if (!Array.isArray(p.warnings)) fail("AIRSPACE_ROW_INVALID");
    const key = `${code}:${index}`; if (ids.has(key)) fail("AIRSPACE_DUPLICATE_ID"); ids.add(key);
    count[layer] = (count[layer] ?? 0) + 1; if (fix) { if (code !== "RCR7") fail("AIRSPACE_REPAIR_CONTRACT_MISMATCH"); repaired++; }
    if (floor === null) floorNull++; if (ceiling === null) ceilingNull++;
    return { ...p, geometry: multi(feature.geometry) };
  });
  if (Object.keys(count).length !== Object.keys(COUNTS).length || Object.entries(COUNTS).some(([layer, expected]) => count[layer] !== expected) || repaired !== 1 || floorNull !== 21 || ceilingNull !== 1) fail("AIRSPACE_COVERAGE_MISMATCH");
  return rows;
}
const defaultFetch: AviationAirspaceFetch = (...args) => fetch(...args);
function adapter(scope: Scope, sourceDescriptor: DatasetDescriptor, fetcher: AviationAirspaceFetch): QueryAdapter {
  return { descriptor: sourceDescriptor, allowedParameters: {}, async read(_parameters, signal): Promise<AdapterReadResult> {
    return withLoading(`research:airspace:${scope}`, `讀取 AIRAC 01-26 ${scope} 空域`, (async () => {
      const cacheHit = cached !== null;
      if (!cached) {
        const controller = new AbortController(), forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", forwardAbort, { once: true });
        const timeout = setTimeout(() => controller.abort(new Error("AIRSPACE_TIMEOUT")), TIMEOUT_MS);
        try {
          if (signal?.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError");
          const response = await fetcher(URL, { credentials: "same-origin", redirect: "error", signal: controller.signal });
          if (!response.ok || response.headers.get("content-type")?.includes("text/html")) fail("AIRSPACE_ASSET_UNAVAILABLE");
          const bytes = await boundedBytes(response, controller.signal);
          if (await digest(bytes) !== SHA) fail("AIRSPACE_SHA_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("AIRSPACE_JSON_INVALID"); }
          cached = { rows: rowsFromSource(source), acquiredAt: new Date().toISOString() };
        } finally { clearTimeout(timeout); signal?.removeEventListener("abort", forwardAbort); }
      }
      const rows = cached.rows.filter(row => (scope === "control" ? CONTROL : RESTRICTED).has(String(row.layer)));
      const sourceRefs: SourceReceipt[] = [{ sourceId: "eaip-airac-01-26-research", version: `sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: cached.acquiredAt }];
      return { rows, sourceRefs, coverage: sourceDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: 81, bytesScanned: BYTES, downloadedBytes: cacheHit ? 0 : BYTES, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
    })());
  } };
}
export function clearAviationAirspaceOwnerCache(): void { cached = null; }
export const aviationControlOwnerAdapter = adapter("control", aviationControlOwnerDescriptor, defaultFetch);
export const aviationRestrictedOwnerAdapter = adapter("restricted", aviationRestrictedOwnerDescriptor, defaultFetch);
