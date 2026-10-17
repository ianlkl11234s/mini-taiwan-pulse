import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type MultiPolygonGeometry, type PolygonGeometry } from "./spatialKernel";
import { withLoading } from "../lib/loadingRegistry";

type Bbox = readonly [number, number, number, number];
interface Shard { path: string; sha256: string; bytes: number; encoding: "gzip"; uncompressedSha256: string; uncompressedBytes: number; featureCount: number; bbox: Bbox; }
interface Manifest { schemaVersion: "pulse-tree-pits-taipei-surface-partitions/1"; source: { rawSha256: string; processedSha256: string; rawBytes: number; processedBytes: number; featureCount: number; reference: string }; snapshot: "2026-07-14"; crs: "EPSG:4326"; geometry: "MultiPolygon"; cellDegrees: number; shards: readonly Shard[]; }

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;
const SOURCE = { rawSha256: "9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03", processedSha256: "72197a37c4446a456effa722eb1e6a96e4c200e1c71343322857f7455c13000e", rows: 56_720, manifestSha: "84abb47a9ee0a05b1a5d76aa6540e50044502e9ab8c2666d0545b1396fa6351c" } as const;
const BASE = "/__local-research-owner-only/tree-pits-taipei/";
const fields: readonly DatasetField[] = [
  { name: "pit_id", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "pit_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_m2", type: "number", nullable: false, nullMeaning: null, unit: "m²" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const treePitsTaipeiOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-taipei-tree-pits-owner-20260714", label: "臺北市樹穴及花圃（2026-07-14 owner-only）",
  description: "臺北市政府工務局公園路燈工程管理處的 2026-07-14 固定快照，共 56,720 筆完整 MultiPolygon：樹穴 50,904、花圃 5,816。bbox 必填，從 checksum 驗證的 localhost gzip 分片讀取後，以完整面幾何判斷相交；資料是樹穴／花圃邊界，並非單棵樹、樹冠或設施可用性。",
  layerRefs: ["treePitsTaipei"], kind: "polygon", recordGrain: "feature", primaryKey: ["pit_id"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "完整處理後 WGS84 MultiPolygon 邊界；保留 multipart 與孔洞，未以 centroid 或 bbox 替代。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "臺北市來源固定快照的 56,720 筆樹穴／花圃圖資；快照未涵蓋或未出現的地點不表示沒有樹木、樹穴或花圃。area_m2=0 僅 1 筆，是來源記錄的零面積值。",
  license: "OGDL-Taiwan-1.0。來源：臺北市政府工務局公園路燈工程管理處，臺北市樹穴及花圃圖資；localhost owner-only reader。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "未出現在 2026-07-14 固定快照的地點或欄位不是零，也不能推論沒有樹木或綠化。", zero: "area_m2=0 是來源明示的零面積記錄，非缺值。", stale: "此固定快照不聲稱目前現況、維護狀態、可進入性或樹木健康。" },
  versions: [{ versionId: `20260714-processed-sha256:${SOURCE.processedSha256}`, observedAt: null, availableAt: "2026-07-14", checksumSha256: SOURCE.processedSha256, mutable: false }],
  source: { publisher: "臺北市政府工務局公園路燈工程管理處", reference: "https://data.gov.tw/dataset/134908; https://data.taipei/dataset/detail?id=693705fa-4604-4207-bd50-8a9ce9fcfbc6; resource rid=3e2b359b-8dae-46e4-a747-5912d8743d0e", lineage: "Official raw resource sha256:9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03 -> fixed 2026-07-14 processed WGS84 MultiPolygon snapshot sha256:72197a37c4446a456effa722eb1e6a96e4c200e1c71343322857f7455c13000e -> safe-field owner-only surface partitions. The live resource is not used to make a current-condition claim." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["pit_id", "pit_type", "district"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: MAX_ROWS, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records"], adapterId: "tree-pits-taipei-owner-surface-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
function validBbox(value: unknown): value is Bbox { return Array.isArray(value) && value.length === 4 && value.every(item => typeof item === "number" && Number.isFinite(item)) && value[0]! <= value[2]! && value[1]! <= value[3]!; }
function intersects(left: Bbox, right: Bbox): boolean { return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1]; }
function surface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
async function sha256(value: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", value); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function bounded(response: Response): Promise<Uint8Array> { const length = Number(response.headers.get("content-length")); if (Number.isFinite(length) && length > MAX_BYTES) fail("DATASET_TOO_LARGE"); const value = new Uint8Array(await response.arrayBuffer()); if (value.byteLength > MAX_BYTES) fail("DATASET_TOO_LARGE"); return value; }
async function fetchChecked(url: string, expected: string, signal?: AbortSignal): Promise<Uint8Array> { const response = await fetch(url, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) }); if (!response.ok || !response.body) fail("TREE_PITS_TAIPEI_ASSET_UNAVAILABLE"); const value = await bounded(response); if (await sha256(value) !== expected) fail("TREE_PITS_TAIPEI_ASSET_MISMATCH"); return value; }
async function decode(shard: Shard, compressed: Uint8Array): Promise<Uint8Array> { if (typeof DecompressionStream === "undefined") fail("COMPRESSION_UNSUPPORTED"); const response = new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))); const value = await bounded(response); if (value.byteLength !== shard.uncompressedBytes || await sha256(value) !== shard.uncompressedSha256) fail("TREE_PITS_TAIPEI_PARTITION_MISMATCH"); return value; }
function manifestFor(value: unknown): Manifest {
  const item = value as Partial<Manifest>;
  if (!item || typeof item !== "object" || item.schemaVersion !== "pulse-tree-pits-taipei-surface-partitions/1" || item.snapshot !== "2026-07-14" || item.crs !== "EPSG:4326" || item.geometry !== "MultiPolygon" || typeof item.cellDegrees !== "number" || item.cellDegrees <= 0 || !item.source
    || item.source.rawSha256 !== SOURCE.rawSha256 || item.source.processedSha256 !== SOURCE.processedSha256 || item.source.featureCount !== SOURCE.rows || !Array.isArray(item.shards) || !item.shards.length || item.shards.length > 1024) fail("TREE_PITS_TAIPEI_MANIFEST_INVALID");
  const paths = new Set<string>(); let declared = 0;
  for (const shard of item.shards) { if (!shard || shard.encoding !== "gzip" || !new RegExp(`^${shard.sha256}-[a-f0-9]+\\.geojson\\.gz$`).test(shard.path) || !/^[a-f0-9]{64}$/.test(shard.sha256) || !/^[a-f0-9]{64}$/.test(shard.uncompressedSha256) || !Number.isSafeInteger(shard.bytes) || shard.bytes < 1 || !Number.isSafeInteger(shard.uncompressedBytes) || shard.uncompressedBytes < 1 || shard.uncompressedBytes > MAX_BYTES || !Number.isSafeInteger(shard.featureCount) || shard.featureCount < 1 || shard.featureCount > MAX_ROWS || !validBbox(shard.bbox) || paths.has(shard.path)) fail("TREE_PITS_TAIPEI_MANIFEST_INVALID"); paths.add(shard.path); declared += shard.featureCount; }
  if (declared < SOURCE.rows) fail("TREE_PITS_TAIPEI_MANIFEST_INVALID"); return item as Manifest;
}
function row(feature: unknown, ordinals: Set<number>, shardBbox: Bbox): Record<string, unknown> | null {
  const item = feature as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown }; const p = item?.properties, ordinal = item?.sourceOrdinal;
  if (item?.type !== "Feature" || !Number.isSafeInteger(ordinal) || (ordinal as number) < 0 || (ordinal as number) >= SOURCE.rows || !p || !Number.isSafeInteger(p.pit_id) || (p.pit_id as number) < 1 || !["樹穴", "花圃"].includes(p.pit_type as string) || typeof p.district !== "string" || !p.district || typeof p.area_m2 !== "number" || !Number.isFinite(p.area_m2) || p.area_m2 < 0) fail("TREE_PITS_TAIPEI_ROW_INVALID");
  const geometry = parseSpatialGeometry(item.geometry); if (geometry.type !== "MultiPolygon" || !geometriesIntersect(geometry, surface(shardBbox))) fail("TREE_PITS_TAIPEI_PARTITION_SCOPE_INVALID");
  const sourceOrdinal = ordinal as number; if (ordinals.has(sourceOrdinal)) return null; ordinals.add(sourceOrdinal); return { pit_id: p.pit_id, pit_type: p.pit_type, district: p.district, area_m2: p.area_m2, geometry: geometry as MultiPolygonGeometry };
}
async function read(context?: { bbox?: Bbox }, signal?: AbortSignal): Promise<AdapterReadResult> {
  if (!context?.bbox) fail("BBOX_REQUIRED"); return withLoading("research:tree-pits-taipei", "臺北市樹穴及花圃", (async () => {
    const manifestBytes = await fetchChecked(`${BASE}manifest.json`, SOURCE.manifestSha, signal); const manifest = manifestFor(JSON.parse(new TextDecoder().decode(manifestBytes))); const selected = manifest.shards.filter(shard => intersects(shard.bbox, context.bbox!));
    const rowsScanned = selected.reduce((total, shard) => total + shard.featureCount, 0), declaredBytes = manifestBytes.byteLength + selected.reduce((total, shard) => total + shard.uncompressedBytes, 0); if (rowsScanned > MAX_ROWS || declaredBytes > MAX_BYTES) fail("SCAN_BUDGET_EXCEEDED");
    const ordinals = new Set<number>(), rows: Record<string, unknown>[] = []; let bytesScanned = manifestBytes.byteLength;
    for (const shard of selected) { const compressed = await fetchChecked(`${BASE}${shard.path}`, shard.sha256, signal); const decoded = await decode(shard, compressed); bytesScanned += decoded.byteLength; const collection = JSON.parse(new TextDecoder().decode(decoded)) as { type?: unknown; features?: unknown }; if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== shard.featureCount) fail("TREE_PITS_TAIPEI_PARTITION_INVALID"); for (const feature of collection.features) { const parsed = row(feature, ordinals, shard.bbox); if (parsed) rows.push(parsed); } }
    const receipt: SourceReceipt = { sourceId: treePitsTaipeiOwnerDescriptor.datasetId, version: `processed-sha256:${SOURCE.processedSha256}`, checksumSha256: SOURCE.processedSha256, reference: manifest.source.reference, acquiredAt: new Date().toISOString() };
    return { rows, sourceRefs: [receipt], coverage: treePitsTaipeiOwnerDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned, bytesScanned, downloadedBytes: bytesScanned, requests: selected.length + 1, cacheHit: false, expiresAt: null };
  })());
}
export const treePitsTaipeiOwnerAdapter: QueryAdapter = { descriptor: treePitsTaipeiOwnerDescriptor, allowedParameters: {}, read: (_parameters: Readonly<Record<string, Scalar>>, signal, context) => read(context, signal) };
