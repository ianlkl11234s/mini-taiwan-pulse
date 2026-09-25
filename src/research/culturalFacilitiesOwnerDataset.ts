import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const URL = "/__local-research-owner-only/cultural-facilities/cultural-facilities-owner-20260716.geojson";
const SHA256 = "3390db215e3d505ff44b6a99f5de37988c1b5f0053766d8254596381071e96f1";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "facility_id", type: "string", nullable: false, nullMeaning: "固定快照的來源列序；只在此版內穩定。", unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: "來源可為空字串。", unit: null }, { name: "address", type: "string", nullable: false, nullMeaning: "來源可為空字串。", unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: "來源有 25 筆空字串；不是缺失可補縣市。", unit: null }, { name: "facility_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_type_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "coord_status", type: "string", nullable: false, nullMeaning: "no_coord 表示來源列沒有可信座標。", unit: null },
  { name: "geometry", type: "json", nullable: true, nullMeaning: "383 筆 no_coord 保留在名冊；不是零設施、停業或不存在。", unit: null },
];
export const culturalFacilitiesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-cultural-facilities-moc-owner-20260716", label: "文化部文化設施（2026-07-16 owner-only）", description: "文化部 emap 六類設施固定快照 1,170 筆；787 Point 可 bbox，383 筆無座標仍可按屬性讀取。",
  layerRefs: ["culturalFacilities"], kind: "point", recordGrain: "place", primaryKey: ["facility_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源座標經 bbox 清洗並標示 coord_status；沒有逐筆入口或測量精度收據。Point 只作參考 bbox，不能主張最近、距離、入口、服務範圍、道路可達性或地圖呈現。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "文化部 emap 2026-07-16 固定快照：工藝之家、博物館、文化行政據點、特色圖書館、文創商店、實體書店共 1,170 筆；787 Point、383 no_coord。Mini display 同版只含 787 Point。city 25 筆空字串、address 9 筆空字串皆照原樣保留。",
  license: "文化部 cloud.culture.tw emap data.gov.tw/dataset/10046 標示 OGDL-Taiwan-1.0；本 reader 只供 localhost owner-only 固定快照查詢，未建立公開散布或目前營運聲明。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果不是該地沒有文化設施；383 no_coord 不會落入 bbox。", null: "geometry=null 與 coord_status=no_coord 均是來源未定位，不以行政區中心或地址補點。", stale: "2026-07-16 快照不代表今日營運、開放、活動、服務或設施全國完整性。" },
  versions: [{ versionId: `20260716-safe-sidecar-sha256:${SHA256}`, observedAt: null, availableAt: null, checksumSha256: SHA256, mutable: false }],
  source: { publisher: "文化部 cloud.culture.tw emap / data.gov.tw 10046", reference: URL, lineage: "6 raw MOC JSON SHA-bound -> processed cultural_facilities_moc_20260716.geojson SHA-256 5b018ab1615c4fb818f8b147cbb77df51f4ae8fb42abec231f792a615781a89b (1,170 rows) -> display cultural_facilities_national.geojson SHA-256 0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d (787 Point semantic subset) -> owner-only safe sidecar." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["facility_id", "name", "city", "facility_type", "source_type_id", "coord_status"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 1170, maxSourceBytes: 512 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "cultural-facilities-owner-reference-v1",
};
async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: culturalFacilitiesOwnerDescriptor.datasetId, url: URL, idField: "facility_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), preserveUnlocatedRecords: true }, { signal });
  if (snapshot.checksumSha256 !== SHA256 || snapshot.rows.length !== 1170 || snapshot.exclusions.missing_geometry !== 383 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) throw new Error("CULTURAL_FACILITIES_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: culturalFacilitiesOwnerDescriptor.datasetId, version: `sha256:${SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SHA256, reference: URL };
  return { rows: snapshot.rows, source, coverage: culturalFacilitiesOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const culturalFacilitiesOwnerAdapter = createReferencePointDatasetAdapter(culturalFacilitiesOwnerDescriptor, read);
