import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "./spatialKernel";
import { withLoading } from "../lib/loadingRegistry";

type Bbox = readonly [number, number, number, number];
type Scale = 150 | 450;
interface Shard { path: string; sha256: string; bytes: number; encoding: "gzip"; uncompressedSha256: string; uncompressedBytes: number; featureCount: number; bbox: Bbox; }
interface Manifest { schemaVersion: "pulse-company-capital-grid-surface-partitions/1"; source: { sha256: string; bytes: number; featureCount: number; reference: string }; grid: { size_m: number; crs_projected: string; crs_output: string; occupied_only: boolean }; shards: readonly Shard[]; }

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;
const SOURCE: Record<Scale, { sha256: string; count: number; manifestSha: string; missingMedian: number }> = {
  150: { sha256: "a0da52b2b1ac58edff22f214d6a8ebda23aa4437476eee8af6d0b4bbc2204d03", count: 89_754, manifestSha: "bb61165aedb74049a1959bd4e4f06dab5d16fa2438f4e1aeba29125665de2c09", missingMedian: 35 },
  450: { sha256: "c79e8b49cf61ffb8292ad3c46ff26d799d7482b37529c7bfee2e15bc78536747", count: 26_834, manifestSha: "0f9e97a5f9acf386a1b8111ed17af8317c7a69ffe56b1c13d742438fc8201d6c", missingMedian: 11 },
};
const BASE = "/__local-research-owner-only/company-capital-grid-fine/";
const fields: readonly DatasetField[] = [
  { name: "grid_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "capital_sum", type: "number", nullable: false, nullMeaning: null, unit: "TWD" },
  { name: "n_companies", type: "number", nullable: false, nullMeaning: null, unit: "companies" },
  { name: "capital_median", type: "number", nullable: true, nullMeaning: "此 occupied-only 格網中的公司資本額皆缺值；不是零元資本。", unit: "TWD" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

function descriptor(scale: Scale): DatasetDescriptor {
  const source = SOURCE[scale]; const id = `tw-company-capital-grid-${scale}m-owner-202608`;
  return { schemaVersion: "pulse-dataset/0.1", datasetId: id, label: `公司資本額 ${scale}m 格網（202608 owner-only）`,
    description: `GCIS 202608 固定快照的 ${source.count.toLocaleString()} 個 occupied-only ${scale}m Polygon 格網。bbox 必填，讀取相交 immutable gzip 分片後以完整 Polygon 相交判斷；每格是公司登記資本額聚合，不是公司點、店家、工廠或行政區統計。`,
    layerRefs: ["companyCapitalGrid"], kind: "grid", recordGrain: "grid_cell", primaryKey: ["grid_id"], fields,
    geometry: { type: "Polygon", crs: "EPSG:4326", role: "generalized", precision: `EPSG:3826 canonical ${scale}m occupied-only grid transformed to WGS84; full source cell boundary, not a company premise or administrative boundary.`, spatialAnalysisEligible: false },
    timeFields: [], coverage: `202608 固定公司資料：657,882 source rows，排除 dead_or_abnormal 1,152 與 invalid_coordinate 2,565 後，以 654,165 筆公司聚合為 ${source.count.toLocaleString()} 個非空 ${scale}m 格網。未出現的格網不等於零家公司或零資本額。`,
    license: "RIGHTS_HOLD for public redistribution: processed manifest records OGDL-Taiwan-1.0, but the 118-member upstream source-matrix receipts have not all been rechecked. Localhost owner-only only.",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: `capital_median=null 且 capital_sum=0 表示該 occupied-only 格網中的公司資本額全缺，並非零元；未出現在輸出的格網不可推論為零。`, stale: "202608 是固定月快照，不能證明公司現仍存在、營業、位於此處或在格網內可達。" },
    versions: [{ versionId: `202608-grid${scale}-source-sha256:${source.sha256}`, observedAt: null, availableAt: "2026-08-18", checksumSha256: source.sha256, mutable: false }],
    source: { publisher: "經濟部商業發展署 GCIS", reference: `/research/company-capital-grid-${scale}m/source-identity/sha256-${source.sha256}`, lineage: "118 regional×industry company_stock source matrix -> 202608 company_stock -> status/coordinate exclusions -> EPSG:3826 150m grid -> nested aggregation -> source-SHA-bound safe-field localhost owner-only surface partitions. No company identifier, address, responsible person, or individual company Point is materialized." },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["grid_id"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: MAX_ROWS, maxSourceBytes: MAX_BYTES }), supportedOperations: ["query_records", "aggregate"], adapterId: `company-capital-grid-owner-${scale}m-partitions-v1` };
}

export const companyCapitalGrid150mOwnerDescriptor = descriptor(150);
export const companyCapitalGrid450mOwnerDescriptor = descriptor(450);
function fail(code: string): never { throw new Error(code); }
function validBbox(value: unknown): value is Bbox { return Array.isArray(value) && value.length === 4 && value.every(item => typeof item === "number" && Number.isFinite(item)) && value[0]! <= value[2]! && value[1]! <= value[3]!; }
function intersects(left: Bbox, right: Bbox): boolean { return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1]; }
async function sha256(bytes: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function bytes(response: Response): Promise<Uint8Array> { const length = Number(response.headers.get("content-length")); if (Number.isFinite(length) && length > MAX_BYTES) fail("DATASET_TOO_LARGE"); const value = new Uint8Array(await response.arrayBuffer()); if (value.byteLength > MAX_BYTES) fail("DATASET_TOO_LARGE"); return value; }
async function fetchChecked(url: string, expected: string, signal?: AbortSignal): Promise<Uint8Array> { const response = await fetch(url, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) }); if (!response.ok || !response.body) fail("COMPANY_CAPITAL_GRID_FINE_ASSET_UNAVAILABLE"); const value = await bytes(response); if (await sha256(value) !== expected) fail("COMPANY_CAPITAL_GRID_FINE_ASSET_MISMATCH"); return value; }
async function decode(shard: Shard, compressed: Uint8Array): Promise<Uint8Array> { if (typeof DecompressionStream === "undefined") fail("COMPRESSION_UNSUPPORTED"); const response = new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))); const value = await bytes(response); if (value.byteLength !== shard.uncompressedBytes || await sha256(value) !== shard.uncompressedSha256) fail("COMPANY_CAPITAL_GRID_FINE_PARTITION_MISMATCH"); return value; }
function manifestFor(value: unknown, scale: Scale): Manifest { const source = SOURCE[scale]; const item = value as Partial<Manifest>; if (!item || typeof item !== "object" || item.schemaVersion !== "pulse-company-capital-grid-surface-partitions/1" || !item.source || item.source.sha256 !== source.sha256 || item.source.featureCount !== source.count || item.source.reference !== `/research/company-capital-grid-${scale}m/source-identity/sha256-${source.sha256}` || item.grid?.size_m !== scale || item.grid.crs_output !== "EPSG:4326" || item.grid.occupied_only !== true || !Array.isArray(item.shards) || !item.shards.length || item.shards.length > 1024) fail("COMPANY_CAPITAL_GRID_FINE_MANIFEST_INVALID"); let declared = 0; const paths = new Set<string>(); for (const shard of item.shards) { if (!shard || shard.encoding !== "gzip" || shard.path !== `${shard.sha256}.geojson.gz` || !/^[a-f0-9]{64}$/.test(shard.sha256) || !/^[a-f0-9]{64}$/.test(shard.uncompressedSha256) || !Number.isSafeInteger(shard.bytes) || shard.bytes < 0 || !Number.isSafeInteger(shard.uncompressedBytes) || shard.uncompressedBytes < 0 || shard.uncompressedBytes > MAX_BYTES || !Number.isSafeInteger(shard.featureCount) || shard.featureCount < 1 || shard.featureCount > MAX_ROWS || !validBbox(shard.bbox) || paths.has(shard.path)) fail("COMPANY_CAPITAL_GRID_FINE_MANIFEST_INVALID"); paths.add(shard.path); declared += shard.featureCount; } if (declared < source.count) fail("COMPANY_CAPITAL_GRID_FINE_MANIFEST_INVALID"); return item as Manifest; }
function shardSurface([west, south, east, north]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }; }
function row(feature: unknown, ordinalSet: Set<number>, scale: Scale, shardBbox: Bbox): Record<string, unknown> | null {
  const item = feature as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown };
  const p = item?.properties; const ordinal = item?.sourceOrdinal; const capitalSum = p?.capital_sum; const companyCount = p?.n_companies; const median = p?.capital_median;
  if (item?.type !== "Feature" || typeof ordinal !== "number" || !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= SOURCE[scale].count
    || !p || typeof p.grid_id !== "string" || !new RegExp(`^G${scale === 150 ? "" : scale}_-?\\d+_-?\\d+$`).test(p.grid_id)
    || typeof capitalSum !== "number" || !Number.isSafeInteger(capitalSum) || capitalSum < 0
    || typeof companyCount !== "number" || !Number.isSafeInteger(companyCount) || companyCount < 1
    || !(median === null || typeof median === "number" && Number.isFinite(median) && median > 0)
    || (capitalSum === 0) !== (median === null)) fail("COMPANY_CAPITAL_GRID_FINE_ROW_INVALID");
  const geometry = parseSpatialGeometry(item.geometry);
  if (geometry.type !== "Polygon" || !geometriesIntersect(geometry, shardSurface(shardBbox))) fail("COMPANY_CAPITAL_GRID_FINE_PARTITION_SCOPE_INVALID");
  if (ordinalSet.has(ordinal)) return null; ordinalSet.add(ordinal);
  return { grid_id: p.grid_id, capital_sum: capitalSum, n_companies: companyCount, capital_median: median, geometry };
}
async function read(scale: Scale, context?: { bbox?: Bbox }, signal?: AbortSignal): Promise<AdapterReadResult> { if (!context?.bbox) fail("BBOX_REQUIRED"); const source = SOURCE[scale]; return withLoading(`research:company-capital-grid-${scale}m`, `公司資本額 ${scale}m 格網`, (async () => { const manifestPath = `${BASE}manifest-${scale}m.json`; const manifestBytes = await fetchChecked(manifestPath, source.manifestSha, signal); const manifest = manifestFor(JSON.parse(new TextDecoder().decode(manifestBytes)), scale); const selected = manifest.shards.filter(shard => intersects(shard.bbox, context.bbox!)); const declaredRows = selected.reduce((total, shard) => total + shard.featureCount, 0); const declaredBytes = manifestBytes.byteLength + selected.reduce((total, shard) => total + shard.uncompressedBytes, 0); if (declaredRows > MAX_ROWS || declaredBytes > MAX_BYTES) fail("SCAN_BUDGET_EXCEEDED"); const ordinals = new Set<number>(); const rows: Record<string, unknown>[] = []; let bytesScanned = manifestBytes.byteLength; for (const shard of selected) { const compressed = await fetchChecked(`${BASE}${shard.path}`, shard.sha256, signal); const decoded = await decode(shard, compressed); bytesScanned += decoded.byteLength; const collection = JSON.parse(new TextDecoder().decode(decoded)) as { type?: unknown; features?: unknown }; if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== shard.featureCount) fail("COMPANY_CAPITAL_GRID_FINE_PARTITION_INVALID"); for (const feature of collection.features) { const parsed = row(feature, ordinals, scale, shard.bbox); if (parsed) rows.push(parsed); } } const receipt: SourceReceipt = { sourceId: scale === 150 ? companyCapitalGrid150mOwnerDescriptor.datasetId : companyCapitalGrid450mOwnerDescriptor.datasetId, version: `sha256:${source.sha256}`, checksumSha256: source.sha256, reference: manifest.source.reference, acquiredAt: new Date().toISOString() }; const desc = scale === 150 ? companyCapitalGrid150mOwnerDescriptor : companyCapitalGrid450mOwnerDescriptor; return { rows, sourceRefs: [receipt], coverage: desc.coverage, freshness: "stale", exclusions: { dead_or_abnormal: 1_152, invalid_coordinate: 2_565, capital_median_missing: source.missingMedian }, rowsScanned: declaredRows, bytesScanned, downloadedBytes: bytesScanned, requests: selected.length + 1, cacheHit: false, expiresAt: null }; })()); }
export const companyCapitalGrid150mOwnerAdapter: QueryAdapter = { descriptor: companyCapitalGrid150mOwnerDescriptor, allowedParameters: {}, read: (_parameters: Readonly<Record<string, Scalar>>, signal, context) => read(150, context, signal) };
export const companyCapitalGrid450mOwnerAdapter: QueryAdapter = { descriptor: companyCapitalGrid450mOwnerDescriptor, allowedParameters: {}, read: (_parameters: Readonly<Record<string, Scalar>>, signal, context) => read(450, context, signal) };
