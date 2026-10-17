import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import { createLineDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

const SOURCE_URL = "/research/forest-roads/forest-roads-2d.geojson";
const SOURCE_SHA256 = "68f26143a39beba971fa1517bda91334d378241de9c320fc52c68e8c1a551f16";
const SNAPSHOT_SHA256 = "c3d851c7c6bc25d0838c75bb16114f4470848cb4ef0cbfada65030c6a20c8e4b";
const EXPECTED_ROWS = 107;
const EXPECTED_VERTICES = 329_885;
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "road_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "road_number", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "branch", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "forestry_district", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "township", type: "string", nullable: true, nullMeaning: "來源未填鄉鎮；不是不在任何行政區。", unit: null },
  { name: "road_kind", type: "string", nullable: true, nullMeaning: "來源未填林道種別；不是未知或無道路。", unit: null },
  { name: "road_grade", type: "string", nullable: true, nullMeaning: "來源未填林道規格；不是無規格或不可通行。", unit: null },
  { name: "vehicle_length_km", type: "number", nullable: true, nullMeaning: "來源未提供車行長；不是零長度或目前可車行。", unit: "km" },
  { name: "walking_length_km", type: "number", nullable: true, nullMeaning: "來源未提供步行長；不是步行可達性估計。", unit: "km" },
  { name: "interrupted_length_km", type: "number", nullable: true, nullMeaning: "來源未提供中斷長；null 不代表目前未中斷。", unit: "km" },
  { name: "reviewed_length_km", type: "number", nullable: true, nullMeaning: "來源未提供檢討後長度；不是目前開放長度。", unit: "km" },
  { name: "control_point", type: "string", nullable: true, nullMeaning: "來源未列管制點；不是沒有管制或可自由進入。", unit: null },
  { name: "note", type: "string", nullable: true, nullMeaning: "來源未提供備註；不能推論現況。", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const forestRoadsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-forest-roads-fixed-source", label: "全臺林道線形（固定公開來源版）",
  description: "林業及自然保育署 datagov:38213 的 107 條固定來源版林道 LineString。可供線與面相交分析；資料沒有即時通行、封閉、施工或安全狀態，且線幾何距離不是步行或車行路網距離。",
  layerRefs: ["forestRoads"], kind: "line", recordGrain: "feature", primaryKey: ["record_id"], fields,
  geometry: { type: "LineString", crs: "EPSG:4326", role: "actual", precision: "來源 WGS84 LineString 的經緯度；原始每頂點 Z=0，因無高程語意而固定移除為 2D，未簡化。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "固定公開快照共 107 條、329,885 個原始頂點。此 reader 完整載入 13.1 MB 的固定 2D sidecar 並限制至 107 條；尚無 line bbox transport，因此不適合擴大到大型線資料。",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）", valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "快照中缺少一條林道不表示該道路不存在或未開放。",
    null: "欄位 null 為來源未填，不能替代為零、無管制或可通行。",
    stale: "此為固定來源版；上游未在此 artifact 提供觀測或取得時間，不表示目前林況或通行狀態。",
  },
  versions: [{ versionId: "datagov:38213-sha256-68f26143a39beba971fa1517bda91334d378241de9c320fc52c68e8c1a551f16", observedAt: null, availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "農業部林業及自然保育署", reference: "https://data.gov.tw/dataset/38213", lineage: "林業及自然保育署 datagov:38213 resource metadata lists CreateDate=2024-04-25; this is not treated as an observation, snapshot, or acquisition time. Immutable processed GeoJSON SHA-256 -> fixed 107-feature 2D research sidecar SHA-256. Sidecar strips source Z=0 and non-query fields only; every LineString vertex and retained source value stay unchanged." },
  access: boundedAccess({ mode: "public", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["road_name", "road_number", "branch", "forestry_district", "county", "township", "road_kind", "road_grade"], maxRowsPerQuery: 5, maxScanRows: EXPECTED_ROWS, maxResponseBytes: 1024 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records", "line_intersects", "aggregate"], adapterId: "forest-road-fixed-line-v1",
};

export type ForestRoadFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Snapshot = { rows: readonly Record<string, unknown>[]; bytes: number };
let cachedSnapshot: Snapshot | null = null;

function fail(code: string): never { throw new Error(code); }
function abortError(signal: AbortSignal): Error { return signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError"); }
function string(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 4_000; }
function nullableString(value: unknown): boolean { return value === null || string(value); }
function nullableNumber(value: unknown): boolean { return value === null || typeof value === "number" && Number.isFinite(value); }
function position(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) fail("FOREST_ROAD_SOURCE_TOO_LARGE");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) fail("FOREST_ROAD_SOURCE_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      if (signal.aborted) { await reader.cancel(signal.reason); throw abortError(signal); }
      const next = await reader.read(); if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); fail("FOREST_ROAD_SOURCE_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function parseSnapshot(bytes: Uint8Array): Snapshot {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("INVALID_FOREST_ROAD_SNAPSHOT"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_FOREST_ROAD_SNAPSHOT");
  const source = value as { type?: unknown; features?: unknown };
  if (source.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== EXPECTED_ROWS) fail("INVALID_FOREST_ROAD_SNAPSHOT");
  let vertices = 0; const ids = new Set<string>();
  const rows = source.features.map(feature => {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) fail("INVALID_FOREST_ROAD_FEATURE");
    const item = feature as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (item.type !== "Feature" || !item.properties || typeof item.properties !== "object" || Array.isArray(item.properties) || !item.geometry || typeof item.geometry !== "object" || Array.isArray(item.geometry)) fail("INVALID_FOREST_ROAD_FEATURE");
    const p = item.properties as Record<string, unknown>; const geometry = item.geometry as { type?: unknown; coordinates?: unknown };
    if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2 || !geometry.coordinates.every(position)
      || !string(p.record_id) || ids.has(p.record_id) || !string(p.road_name) || !string(p.road_number) || !string(p.branch) || !string(p.forestry_district) || !string(p.county)
      || !nullableString(p.township) || !nullableString(p.road_kind) || !nullableString(p.road_grade) || !nullableString(p.control_point) || !nullableString(p.note)
      || !nullableNumber(p.vehicle_length_km) || !nullableNumber(p.walking_length_km) || !nullableNumber(p.interrupted_length_km) || !nullableNumber(p.reviewed_length_km)) fail("INVALID_FOREST_ROAD_FEATURE");
    ids.add(p.record_id); vertices += geometry.coordinates.length;
    return { ...p, geometry: { type: "LineString", coordinates: geometry.coordinates } };
  });
  if (vertices !== EXPECTED_VERTICES) fail("FOREST_ROAD_VERTEX_COUNT_MISMATCH");
  return { rows, bytes: bytes.byteLength };
}

async function loadSnapshot(fetcher: ForestRoadFetch, signal?: AbortSignal): Promise<{ snapshot: Snapshot; cacheHit: boolean }> {
  if (cachedSnapshot) return { snapshot: cachedSnapshot, cacheHit: true };
  const controller = new AbortController(); const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (signal?.aborted) throw abortError(signal);
    const response = await fetcher(SOURCE_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
    if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) fail("FOREST_ROAD_SOURCE_MISSING");
    if (!response.ok) fail("FOREST_ROAD_SOURCE_UNAVAILABLE");
    const bytes = await boundedBytes(response, controller.signal);
    if (await sha256(bytes) !== SNAPSHOT_SHA256) fail("FOREST_ROAD_SNAPSHOT_SHA_MISMATCH");
    const snapshot = parseSnapshot(bytes); cachedSnapshot = snapshot;
    return { snapshot, cacheHit: false };
  } catch (error) {
    if (signal?.aborted) throw abortError(signal);
    if (controller.signal.aborted) fail("FOREST_ROAD_REQUEST_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
}

export function clearForestRoadSnapshotCache(): void { cachedSnapshot = null; }

export function createForestRoadsAdapter(fetcher: ForestRoadFetch = fetch): QueryAdapter {
  return createLineDatasetAdapter(forestRoadsDescriptor, async (_parameters, signal): Promise<AdapterSnapshot> => withLoading("research:forest-roads", "載入固定林道線形", (async () => {
    const { snapshot, cacheHit } = await loadSnapshot(fetcher, signal);
    const acquiredAt = new Date().toISOString();
    const source: SourceReceipt = { sourceId: "tw-forest-roads-2d-sidecar", version: `sha256:${SNAPSHOT_SHA256}`, acquiredAt, checksumSha256: SNAPSHOT_SHA256, reference: SOURCE_URL };
    return { rows: snapshot.rows, source, coverage: forestRoadsDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: cacheHit ? 0 : snapshot.bytes, requests: cacheHit ? 0 : 1, cacheHit };
  })()));
}

export const forestRoadsAdapter = createForestRoadsAdapter();
