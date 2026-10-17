import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "b4de010d5620cb52110b520d9a9980532ea9be00c755f1254e4a5a16a84bb9e6";
const MANIFEST_SHA256 = "325a6c959dcf4e5f00dab13aa87a646579acdefcb55f425e70cdd368c39f178c";
const SOURCE_REFERENCE = `/research/med-aed/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/med-aed/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "place_id", type: "string", nullable: false, nullMeaning: null, unit: "source_place_id" },
  { name: "aed_id", type: "string", nullable: false, nullMeaning: null, unit: "source_aed_id" },
  { name: "place_name", type: "string", nullable: true, nullMeaning: "來源未填場所名稱。", unit: null },
  { name: "county", type: "string", nullable: true, nullMeaning: "來源未填縣市。", unit: null },
  { name: "district", type: "string", nullable: true, nullMeaning: "來源未填鄉鎮市區。", unit: null },
  { name: "place_category", type: "string", nullable: true, nullMeaning: "來源未填場所分類。", unit: null },
  { name: "place_type", type: "string", nullable: true, nullMeaning: "來源未填場所類型。", unit: null },
  { name: "open_hours", type: "string", nullable: true, nullMeaning: "來源未填開放時段。", unit: "source_slash_delimited_hours" },
  { name: "open_hours_note", type: "string", nullable: true, nullMeaning: "來源未填開放時間備註。", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const medAedOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-med-aed-20260524-owner-only", label: "AED 設置參考點（20260524 owner-only）",
  description: "衛福部 AED 急救資訊網 2026-05-24 固定快照的 15,490 個台灣範圍內 Point；bbox 必填，只讀命中的 immutable gzip 分片。sidecar 不含地址、設備擺放細節、聯絡電話或原始 lat/lng 欄位。",
  layerRefs: ["medAED"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "Point 保留官方 CSV 的 WGS84 記錄座標，僅供 owner-only bbox 與屬性參考。該固定快照未驗證目前設備功能、現場可進入性與開放時段；不得主張精確最近 AED、緊急可用、步行可達性、服務範圍或 coverage。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-05-24 固定快照：原始 CSV 15,494 筆，15,490 筆在既有台灣範圍（118–122.5E、21.5–26.5N）內並成為 Point；0 筆缺座標，4 筆在範圍外且未補造幾何。bbox 無結果不代表沒有 AED、設備失效或無緊急救援資源。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；來源為衛福部醫事司 AED 急救資訊網／data.gov.tw 12063。這個 source-SHA-bound reader 僅由 localhost owner-only sidecar 供目前工作區使用；PMTiles 顯示資產是否與此快照等價尚未驗證。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果可能在範圍外、原始 4 筆範圍外記錄或快照之外；不能推論沒有 AED、沒有急救資源或不可取得救援。", stale: "此每日來源的 2026-05-24 固定快照不代表設備今日存在、正常、可用、開放、可進入或有人可協助。" },
  versions: [{ versionId: `20260524-geojson-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-24", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "衛生福利部醫事司 AED 急救資訊網", reference: SOURCE_REFERENCE, lineage: "官方 data.gov.tw/dataset/12063 CSV SHA-256 bb2520…debe（15,494 rows；0 無座標、4 筆既有台灣範圍外）-> analytics processed aed_20260524.geojson SHA-256 b4de…b9e6（15,490 Point）-> safe-field source-SHA-bound local gzip partitions。地址、設備擺放位置與描述、電話、原始 lat/lng 欄位未收錄。" },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["place_id", "aed_id", "place_name", "county", "district", "place_category", "place_type"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 10_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "med-aed-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
async function readMedAed(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: medAedOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "aed_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("MED_AED_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: medAedOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: medAedOwnerDescriptor.coverage, freshness: "stale", exclusions: { raw_out_of_taiwan_range: 4, raw_missing_coordinates: 0, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const medAedOwnerAdapter = createReferencePointDatasetAdapter(medAedOwnerDescriptor, readMedAed);
