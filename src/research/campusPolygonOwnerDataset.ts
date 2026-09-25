import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "./spatialKernel";

type Bbox = readonly [number, number, number, number];
interface Shard { path: string; sha256: string; bytes: number; encoding: "gzip"; uncompressedSha256: string; uncompressedBytes: number; featureCount: number; bbox: Bbox; }
interface Manifest { schemaVersion: "pulse-campus-polygon-surface-partitions/1"; source: { rawSha256: string; processedSha256: string; processedBytes: number; featureCount: number; reference: string }; snapshot: "2026-08-07"; crs: "EPSG:4326"; geometry: "Polygon"; cellDegrees: number; shards: readonly Shard[]; }

const BASE = "/__local-research-owner-only/campus-polygon/";
const MAX_BYTES = 8 * 1024 * 1024, MAX_ROWS = 3_000;
const SOURCE = { rawSha256: "14fdbec063543c260059f662c380be80ae6f1285c6967e5d35896b11c514eb48", processedSha256: "950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff", processedBytes: 9_847_540, rows: 4_336, manifestSha: "3e7158e6013dd72e33a3dd6f0b51d5f0078054c46b604c4c12b8f5ed07af4232" } as const;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school_level", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school_level_zh", type: "string", nullable: true, nullMeaning: "12 筆 experimental 來源列未提供中文學制；不是未知學制、零筆學校或可忽略列。", unit: null },
  { name: "is_branch", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha" },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_yyyymm", type: "string", nullable: false, nullMeaning: null, unit: "YYYYMM" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const campusPolygonOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-campus-polygon-owner-20260807", label: "各級學校校地範圍（2026-08-07 owner-only）",
  description: "TGOS 121 分帶處理後 4,336 筆學校校地 Polygon 固定快照。每次 bbox 必填，只讀 checksum 驗證的相交 gzip 分片，再由完整 Polygon 作真實相交；不是入口、通行路徑、學區、就學區、服務範圍或步行可達性。",
  layerRefs: ["eduCampusPolygon", "eduCampusArea"], kind: "polygon", recordGrain: "feature", primaryKey: ["record_id"], fields,
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "actual", precision: "來源 TGOS 校地參考完整 Polygon；不以 centroid 或 bbox 代替，保留邊界形狀。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "2026-08-07 pipeline 固定快照，4,336 筆 Polygon。涵蓋 20 縣市，澎湖與金門沒有此來源面；bbox 無結果不代表沒有學校、校地、教育服務或可到達的教育設施。12 筆 school_level=non_school 保留為可查來源列，顯示圖層另行排除；另有 12 筆 experimental 的 school_level_zh=null。",
  license: "上游資料目錄記載 OGDL-Taiwan-1.0；本 SHA-bound safe-field sidecar 僅 localhost owner-only，未驗公開發布。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "school_level_zh=null 僅表示 12 筆 experimental 來源列未提供中文學制；查無 bbox 列不表示當地沒有學校或教育資源。", zero: "area_ha=0 若出現是來源明示面積值，非缺值。", stale: "2026-08-07 pipeline snapshot 與每筆 source_yyyymm 不同；兩者都不代表目前招生、開放、校地權屬、出入口、容量、服務或通行狀態。" },
  versions: [{ versionId: `processed-sha256:${SOURCE.processedSha256}`, observedAt: null, availableAt: "2026-08-07", checksumSha256: SOURCE.processedSha256, mutable: false }],
  source: { publisher: "內政部國土測繪中心 TGOS／教育資料處理管線", reference: "/research/campus-polygon/source-identity/sha256-950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff", lineage: "TGOS campus_121.zip raw SHA-256 14fdbec063543c260059f662c380be80ae6f1285c6967e5d35896b11c514eb48 -> processed campus_polygon_20260807.geojson SHA-256 950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff (4,336 Polygon, 9,847,540 bytes) -> safe-field owner-only surface partitions. Mini campus_polygon.pmtiles SHA-256 3735e97933bef4f93d163a607d902607c1c008f1481ad3f674ca4120d74e3f15 is a display artifact, not this reader's analytical source." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["record_id", "school_name", "school_level", "school_level_zh", "is_branch", "area_ha", "county", "county_source", "source_yyyymm"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: MAX_ROWS, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "campus-polygon-owner-surface-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
function validBbox(value: unknown): value is Bbox { return Array.isArray(value) && value.length === 4 && value.every(item => typeof item === "number" && Number.isFinite(item)) && value[0]! <= value[2]! && value[1]! <= value[3]!; }
function intersects(left: Bbox, right: Bbox): boolean { return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1]; }
function surface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
async function sha256(value: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", value); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function bounded(response: Response): Promise<Uint8Array> { const length = Number(response.headers.get("content-length")); if (Number.isFinite(length) && length > MAX_BYTES) fail("CAMPUS_POLYGON_DATASET_TOO_LARGE"); const value = new Uint8Array(await response.arrayBuffer()); if (value.byteLength > MAX_BYTES) fail("CAMPUS_POLYGON_DATASET_TOO_LARGE"); return value; }
async function fetchChecked(url: string, expected: string, signal?: AbortSignal): Promise<Uint8Array> { if (signal?.aborted) throw new DOMException("aborted", "AbortError"); const response = await fetch(url, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) }); if (!response.ok || !response.body) fail("CAMPUS_POLYGON_ASSET_UNAVAILABLE"); const value = await bounded(response); if (await sha256(value) !== expected) fail("CAMPUS_POLYGON_ASSET_MISMATCH"); return value; }
async function decode(shard: Shard, compressed: Uint8Array): Promise<Uint8Array> { if (typeof DecompressionStream === "undefined") fail("COMPRESSION_UNSUPPORTED"); const value = await bounded(new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")))); if (value.byteLength !== shard.uncompressedBytes || await sha256(value) !== shard.uncompressedSha256) fail("CAMPUS_POLYGON_PARTITION_MISMATCH"); return value; }
function manifestFor(value: unknown): Manifest {
  const item = value as Partial<Manifest>;
  if (!item || typeof item !== "object" || item.schemaVersion !== "pulse-campus-polygon-surface-partitions/1" || item.snapshot !== "2026-08-07" || item.crs !== "EPSG:4326" || item.geometry !== "Polygon" || item.source?.rawSha256 !== SOURCE.rawSha256 || item.source.processedSha256 !== SOURCE.processedSha256 || item.source.processedBytes !== SOURCE.processedBytes || item.source.featureCount !== SOURCE.rows || !Array.isArray(item.shards) || !item.shards.length || item.shards.length > 1024) fail("CAMPUS_POLYGON_MANIFEST_INVALID");
  const paths = new Set<string>(); let declared = 0;
  for (const shard of item.shards) { if (!shard || shard.encoding !== "gzip" || !new RegExp(`^${shard.sha256}-[a-f0-9]+\\.geojson\\.gz$`).test(shard.path) || !/^[a-f0-9]{64}$/.test(shard.sha256) || !/^[a-f0-9]{64}$/.test(shard.uncompressedSha256) || !Number.isSafeInteger(shard.bytes) || shard.bytes < 1 || !Number.isSafeInteger(shard.uncompressedBytes) || shard.uncompressedBytes < 1 || shard.uncompressedBytes > MAX_BYTES || !Number.isSafeInteger(shard.featureCount) || shard.featureCount < 1 || shard.featureCount > MAX_ROWS || !validBbox(shard.bbox) || paths.has(shard.path)) fail("CAMPUS_POLYGON_MANIFEST_INVALID"); paths.add(shard.path); declared += shard.featureCount; }
  if (declared < SOURCE.rows) fail("CAMPUS_POLYGON_MANIFEST_INVALID"); return item as Manifest;
}
function row(feature: unknown, ordinals: Set<number>, shardBbox: Bbox): Record<string, unknown> | null {
  const item = feature as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown }, p = item?.properties, ordinal = item?.sourceOrdinal;
  if (item?.type !== "Feature" || !Number.isSafeInteger(ordinal) || (ordinal as number) < 0 || (ordinal as number) >= SOURCE.rows || !p || p.record_id !== String(ordinal) || typeof p.school_name !== "string" || !p.school_name || typeof p.school_level !== "string" || !p.school_level || !(typeof p.school_level_zh === "string" || p.school_level_zh === null) || typeof p.is_branch !== "boolean" || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha) || p.area_ha < 0 || typeof p.county !== "string" || !p.county || !["name_prefix", "centroid_sjoin"].includes(p.county_source as string) || typeof p.source_yyyymm !== "string" || !/^\d{6}$/.test(p.source_yyyymm)) fail("CAMPUS_POLYGON_ROW_INVALID");
  const geometry = parseSpatialGeometry(item.geometry); if (geometry.type !== "Polygon" || !geometriesIntersect(geometry, surface(shardBbox))) fail("CAMPUS_POLYGON_PARTITION_SCOPE_INVALID"); const sourceOrdinal = ordinal as number; if (ordinals.has(sourceOrdinal)) return null; ordinals.add(sourceOrdinal);
  return { record_id: p.record_id, school_name: p.school_name, school_level: p.school_level, school_level_zh: p.school_level_zh, is_branch: p.is_branch, area_ha: p.area_ha, county: p.county, county_source: p.county_source, source_yyyymm: p.source_yyyymm, geometry };
}
async function read(context?: { bbox?: Bbox }, signal?: AbortSignal): Promise<AdapterReadResult> {
  if (!context?.bbox) fail("BBOX_REQUIRED"); return withLoading("research:campus-polygon-owner", "各級學校校地範圍", (async () => {
    const manifestBytes = await fetchChecked(`${BASE}manifest.json`, SOURCE.manifestSha, signal); const manifest = manifestFor(JSON.parse(new TextDecoder().decode(manifestBytes))); const selected = manifest.shards.filter(shard => intersects(shard.bbox, context.bbox!));
    const rowsScanned = selected.reduce((sum, shard) => sum + shard.featureCount, 0), declaredBytes = manifestBytes.byteLength + selected.reduce((sum, shard) => sum + shard.uncompressedBytes, 0); if (rowsScanned > MAX_ROWS || declaredBytes > MAX_BYTES) fail("SCAN_BUDGET_EXCEEDED");
    const ordinals = new Set<number>(), rows: Record<string, unknown>[] = []; let bytesScanned = manifestBytes.byteLength, downloadedBytes = manifestBytes.byteLength;
    for (const shard of selected) { const compressed = await fetchChecked(`${BASE}${shard.path}`, shard.sha256, signal); const decoded = await decode(shard, compressed); bytesScanned += decoded.byteLength; downloadedBytes += compressed.byteLength; const collection = JSON.parse(new TextDecoder().decode(decoded)) as { type?: unknown; features?: unknown }; if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== shard.featureCount) fail("CAMPUS_POLYGON_PARTITION_INVALID"); for (const feature of collection.features) { const parsed = row(feature, ordinals, shard.bbox); if (parsed) rows.push(parsed); } }
    const receipt: SourceReceipt = { sourceId: campusPolygonOwnerDescriptor.datasetId, version: `processed-sha256:${SOURCE.processedSha256}`, checksumSha256: SOURCE.processedSha256, reference: manifest.source.reference, acquiredAt: new Date().toISOString() };
    return { rows, sourceRefs: [receipt], coverage: campusPolygonOwnerDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned, bytesScanned, downloadedBytes, requests: selected.length + 1, cacheHit: false, expiresAt: null };
  })());
}
export const campusPolygonOwnerAdapter: QueryAdapter = { descriptor: campusPolygonOwnerDescriptor, allowedParameters: {}, read: (_parameters: Readonly<Record<string, Scalar>>, signal, context) => read(context, signal) };
