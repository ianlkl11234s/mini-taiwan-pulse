import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { lineIntersectsBbox, parseLineGeometry, type MultiLineStringGeometry } from "./lineGeometry";

type Bbox = readonly [number, number, number, number];
const URL = "/geo/cycling_routes.geojson";
const SHA = "690190820456105ac3aa92133c4fc7e222703e365a36c726fec20c5b2060bcba";
const RAW_SHA = "d190b049ef2c9f46134c230d043b090edb84e64bf56cc393d2fa282edf896d19";
const BYTES = 4_384_551;
const ROWS = 1_749;
const MAX_BYTES = 5 * 1024 * 1024;
const fields: readonly DatasetField[] = [
  { name: "route_id", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "route_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city_code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "town", type: "string", nullable: true, nullMeaning: "來源空字串或字面 NULL，非沒有自行車道。", unit: null },
  { name: "road_start", type: "string", nullable: true, nullMeaning: "來源空字串。", unit: null },
  { name: "road_end", type: "string", nullable: true, nullMeaning: "來源空字串。", unit: null },
  { name: "direction", type: "string", nullable: true, nullMeaning: "來源空字串。", unit: null },
  { name: "length_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const cyclingRoutesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-cycling-shapes-tdx-20260301", label: "TDX 自行車道路線（2026-03-01 固定快照）",
  description: "TDX /v2/Cycling/Shape/City 的本地固定快照，1,749 條 MultiLineString。bbox 查詢使用實際線相交；路線線型不代表目前可騎乘、連通、導航或路面安全。",
  layerRefs: ["cyclingRoutes"], kind: "line", recordGrain: "feature", primaryKey: ["route_id"], fields,
  geometry: { type: "MultiLineString", crs: "EPSG:4326", role: "actual", precision: "保留 TDX WKT 處理後的完整 WGS84 多段線；不以中心點、bbox 或顯示概化代替。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "20 個縣市的 1,749 條本地固定路線；資料缺少臺灣部分縣市及目前路況，查無相交僅表示此快照未收錄。",
  license: "TDX catalog 記政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）；本讀取器使用本地 byte-identical Mini 展示檔。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "town、起訖路段與 direction 來源空字串轉為 null；CyclingType 與 AuthorityName 大多或全部為字面 NULL，未作可用欄位。", zero: "length_m=0 僅在來源明示時才是零長度，不由缺值推得。", stale: "raw 檔名 2026-03-01 與本地處理版次不是每條路線實際完工或目前通行日期；FinishedTime 轉換已知有錯，故不輸出時間篩選。" },
  versions: [{ versionId: `processed-sha256:${SHA}`, observedAt: null, availableAt: "2026-03-01", checksumSha256: SHA, mutable: false }],
  source: { publisher: "交通部 TDX（各縣市來源彙整）", reference: "https://tdx.transportdata.tw/api-service/swagger/advanced", lineage: `TDX Cycling Shape raw local file cycling_shapes_raw_20260301.json sha256:${RAW_SHA} (1,749 records) -> analytics cycling_shapes_all.geojson -> Mini public/geo/cycling_routes.geojson sha256:${SHA}, byte-identical. Route ID is fixed-source ordinal, not TDX identifier. FinishedTime is withheld because known ROC conversion errors affect 24.4% of processed values.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["route_id", "city", "city_code", "town"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: ROWS, maxSourceBytes: MAX_BYTES, maxResponseBytes: 512 * 1024, timeoutMs: 15_000 }),
  supportedOperations: ["query_records"], adapterId: "tdx-cycling-shapes-fixed-line-v1",
};

function fail(code: string): never { throw new Error(code); }
function optional(value: unknown): string | null { if (typeof value !== "string") fail("CYCLING_SHAPES_ROW_INVALID"); return value.trim() && value !== "NULL" ? value : null; }
async function sha256(value: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", value); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

export function validateCyclingRoutesSnapshot(source: unknown, bbox: Bbox): Record<string, unknown>[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("CYCLING_SHAPES_COLLECTION_INVALID");
  const rows: Record<string, unknown>[] = [];
  for (const [ordinal, value] of collection.features.entries()) {
    const feature = value as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown }, p = feature?.properties;
    if (feature?.type !== "Feature" || !p || typeof p.RouteName !== "string" || !p.RouteName || typeof p.City !== "string" || !p.City || typeof p.CityCode !== "string" || !p.CityCode || typeof p.CyclingLength_m !== "number" || !Number.isFinite(p.CyclingLength_m) || p.CyclingLength_m < 0) fail("CYCLING_SHAPES_ROW_INVALID");
    const geometry = parseLineGeometry(feature.geometry);
    if (geometry.type !== "MultiLineString") fail("CYCLING_SHAPES_GEOMETRY_INVALID");
    const town = optional(p.Town), road_start = optional(p.RoadSectionStart), road_end = optional(p.RoadSectionEnd), direction = optional(p.Direction);
    if (lineIntersectsBbox(geometry, bbox)) rows.push({ route_id: ordinal + 1, route_name: p.RouteName, city: p.City, city_code: p.CityCode, town, road_start, road_end, direction, length_m: p.CyclingLength_m, geometry: geometry as MultiLineStringGeometry });
  }
  return rows;
}

export const cyclingRoutesAdapter: QueryAdapter = {
  descriptor: cyclingRoutesDescriptor, allowedParameters: {},
  read: (_parameters, signal, context): Promise<AdapterReadResult> => {
    if (!context?.bbox) fail("BBOX_REQUIRED");
    return withLoading("research:cycling-routes", "讀取自行車道路線", (async () => {
      const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
      if (!response.ok || !response.body) fail("CYCLING_SHAPES_ASSET_UNAVAILABLE");
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_BYTES) fail("CYCLING_SHAPES_TOO_LARGE");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== BYTES || bytes.byteLength > MAX_BYTES || await sha256(bytes) !== SHA) fail("CYCLING_SHAPES_SOURCE_MISMATCH");
      const rows = validateCyclingRoutesSnapshot(JSON.parse(new TextDecoder().decode(bytes)), context.bbox!);
      const sourceRefs: SourceReceipt[] = [{ sourceId: cyclingRoutesDescriptor.datasetId, version: `sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: new Date().toISOString() }];
      return { rows, sourceRefs, coverage: cyclingRoutesDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
    })());
  },
};
