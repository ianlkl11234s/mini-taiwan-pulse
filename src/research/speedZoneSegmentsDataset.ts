import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { QueryAdapter } from "./queryExecutor";

const SOURCE_URL = "/police_justice/speed_zone_segments/speed_zone_segments_20260626.geojson";
const RAW_SHA256 = "4e3741f27b79982e775c95dbbd1eaff59040ec48bc6db6b53a7882d28602c511";
const SNAPSHOT_SHA256 = "287b76c66affa9857721dfdff6d89f34f540a0955ea773c232c0497d9cd27af4";
const EXPECTED_ROWS = 25;
const EXPECTED_BYTES = 10_957;
const MAX_BYTES = 16 * 1024;
const TIMEOUT_MS = 15_000;

const fields: readonly DatasetField[] = [
  { name: "entity_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "seq", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "location", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "direction_idx", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "limit_kph", type: "string", nullable: false, nullMeaning: null, unit: "kph (來源字串，可能含適用車種條件)" },
  { name: "enforcement_item", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const speedZoneSegmentsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-new-taipei-speed-zone-segments-20260626", label: "新北區間平均速率執法路段（2026-06-26 快照）",
  description: "新北市公開資料 25 條區間平均速率執法起訖點參考線固定快照。直線不是實際道路軌跡；不保證目前啟用、執法、限速、施工或道路通行狀態。",
  layerRefs: ["speedZoneSegment"], kind: "line", recordGrain: "feature", primaryKey: ["entity_id"], fields,
  geometry: { type: "LineString", crs: "EPSG:4326", role: "proxy", precision: "以來源每筆起訖 WGS84 座標連成兩點直線；中間不是實際道路軌跡，不可判定精確相交或距離。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "新北市 data.gov.tw:126156 固定快照內的 25 條區間平均速率執法路段；沒有列入高雄 4 個 point 設備來源，查無相交僅表示此快照未收錄。",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）", valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "快照未列入路段不表示沒有測速、沒有執法或道路不存在。",
    null: "本固定 25 筆的保留欄位皆無 null；未來來源空值不可轉成零、未啟用或無執法。",
    stale: "fetched_at=2026-06-26 是此固定 artifact 的抓取日，不是每段啟用、執法或限速生效日，也不保證目前狀態。",
  },
  versions: [{ versionId: `processed-sha256:${SNAPSHOT_SHA256}`, observedAt: null, availableAt: "2026-06-26", checksumSha256: SNAPSHOT_SHA256, mutable: false }],
  source: { publisher: "新北市政府警察局", reference: "https://data.gov.tw/dataset/126156", lineage: `data.gov.tw:126156 raw newtaipei_zone_126156.csv sha256:${RAW_SHA256} -> analytics processed 25-LineString GeoJSON sha256:${SNAPSHOT_SHA256} -> byte-identical Mini public asset sha256:${SNAPSHOT_SHA256}. High-speed enforcement source variants from Kaohsiung are point equipment records and are intentionally excluded.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["entity_id", "seq", "location", "limit_kph", "enforcement_item", "facility_subtype", "city", "source", "source_tier", "fetched_at"], supportsBbox: true, maxRowsPerQuery: 25, maxScanRows: EXPECTED_ROWS, maxResponseBytes: 128 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "new-taipei-speed-zone-segment-fixed-line-v1",
};

export type SpeedZoneSegmentFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Snapshot = { rows: readonly Record<string, unknown>[]; bytes: number };
let cachedSnapshot: Snapshot | null = null;

function fail(code: string): never { throw new Error(code); }
function string(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 4_000; }
function position(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export function validateSpeedZoneSegmentsSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("SPEED_ZONE_SEGMENTS_COLLECTION_INVALID");
  const collection = value as { type?: unknown; features?: unknown };
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== EXPECTED_ROWS) fail("SPEED_ZONE_SEGMENTS_COLLECTION_INVALID");
  const ids = new Set<string>();
  const rows = collection.features.map(feature => {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) fail("SPEED_ZONE_SEGMENTS_FEATURE_INVALID");
    const item = feature as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (item.type !== "Feature" || !item.properties || typeof item.properties !== "object" || Array.isArray(item.properties) || !item.geometry || typeof item.geometry !== "object" || Array.isArray(item.geometry)) fail("SPEED_ZONE_SEGMENTS_FEATURE_INVALID");
    const p = item.properties as Record<string, unknown>; const geometry = item.geometry as { type?: unknown; coordinates?: unknown };
    if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2 || !geometry.coordinates.every(position)
      || !string(p.entity_id) || ids.has(p.entity_id) || !string(p.seq) || !string(p.location) || !Number.isInteger(p.direction_idx)
      || !string(p.limit_kph) || !string(p.enforcement_item) || p.facility_subtype !== "speed_zone_segment" || p.city !== "新北市"
      || p.source !== "newtaipei_126156" || p.source_tier !== 1 || p.fetched_at !== "2026-06-26") fail("SPEED_ZONE_SEGMENTS_FEATURE_INVALID");
    ids.add(p.entity_id);
    return { ...p, geometry: { type: "LineString", coordinates: geometry.coordinates } };
  });
  return { rows, bytes: 0 };
}

async function loadSnapshot(fetcher: SpeedZoneSegmentFetch, signal?: AbortSignal): Promise<{ snapshot: Snapshot; cacheHit: boolean }> {
  if (cachedSnapshot) return { snapshot: cachedSnapshot, cacheHit: true };
  const controller = new AbortController(); const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(SOURCE_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
    if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) fail("SPEED_ZONE_SEGMENTS_SOURCE_MISSING");
    if (!response.ok) fail("SPEED_ZONE_SEGMENTS_SOURCE_UNAVAILABLE");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) fail("SPEED_ZONE_SEGMENTS_SOURCE_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== EXPECTED_BYTES || bytes.byteLength > MAX_BYTES || await sha256(bytes) !== SNAPSHOT_SHA256) fail("SPEED_ZONE_SEGMENTS_SNAPSHOT_SHA_MISMATCH");
    const parsed = validateSpeedZoneSegmentsSnapshot(JSON.parse(new TextDecoder().decode(bytes)));
    const snapshot = { ...parsed, bytes: bytes.byteLength }; cachedSnapshot = snapshot;
    return { snapshot, cacheHit: false };
  } catch (error) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError");
    if (controller.signal.aborted) fail("SPEED_ZONE_SEGMENTS_REQUEST_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
}

export function clearSpeedZoneSegmentsSnapshotCache(): void { cachedSnapshot = null; }

export function createSpeedZoneSegmentsAdapter(fetcher: SpeedZoneSegmentFetch = fetch): QueryAdapter {
  return { descriptor: speedZoneSegmentsDescriptor, allowedParameters: {}, read: (_parameters, signal) => withLoading("research:speed-zone-segments", "載入新北區間平均速率執法路段", (async () => {
    const { snapshot, cacheHit } = await loadSnapshot(fetcher, signal);
    const source: SourceReceipt = { sourceId: "data.gov.tw:126156", version: `processed-sha256:${SNAPSHOT_SHA256}`, acquiredAt: new Date().toISOString(), checksumSha256: SNAPSHOT_SHA256, reference: SOURCE_URL };
    return { rows: snapshot.rows, sourceRefs: [source], coverage: speedZoneSegmentsDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: cacheHit ? 0 : snapshot.bytes, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
  })()) };
}

export const speedZoneSegmentsAdapter = createSpeedZoneSegmentsAdapter();
