import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/riverside-trees-taipei/riverside-trees-taipei-owner-20260714.geojson";
const SOURCE_SHA256 = "2bc603414206c8b302754ac1d958916f505f2f3752ae08c640892c86e3ea4dbe";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "tree_id", type: "string", nullable: false, nullMeaning: "tree_id 有 3 個重複值，不能作此快照的唯一主鍵", unit: null },
  { name: "species", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供樹種；本版有 2 筆", unit: null },
  { name: "species_scientific", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供學名；本版有 58 筆", unit: null },
  { name: "family", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供科別；本版有 58 筆", unit: null },
  { name: "park_name", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供河濱公園；本版有 3 筆", unit: null },
  { name: "manager", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供管理單位；本版有 3 筆", unit: null },
  { name: "height_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "dbh_cm", type: "number", nullable: false, nullMeaning: null, unit: "cm" },
  { name: "crown_area_m2", type: "number", nullable: false, nullMeaning: null, unit: "m2" },
  { name: "estimated_age_years", type: "number", nullable: false, nullMeaning: null, unit: "years" },
  { name: "survey_date", type: "string", nullable: false, nullMeaning: "2 筆來源值為不完整的 1230，不能補成年月日或作時間篩選", unit: null },
  { name: "notes", type: "string", nullable: true, nullMeaning: "4,538 筆沒有備註；不是沒有樹、沒有調查或零尺寸", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const riversideTreesTaipeiOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-riverside-trees-taipei-owner-20260714", label: "臺北河濱生態喬木（owner-only 固定快照）",
  description: "臺北市政府工務局水利工程處河濱生態喬木調查的 10,917 個來源 WGS84 Point。本機原始下載 URL 與授權尚未取得可驗證收據，僅提供 owner-only 有界查詢；數值和調查日期都是歷史快照，不能當成現在樹木清冊。",
  layerRefs: ["riversideTreesTaipei"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "原始 CSV 同時含 TWD97 與 WGS84；pipeline 採 WGS84 欄位，保留臺北河濱範圍內 Point。可作 bbox 與直線參考距離，非樹冠邊界、現場位置復核、步行或維護可達性。", spatialAnalysisEligible: true },
  timeFields: [],
  coverage: "固定處理版有 10,917 Point：raw CSV 10,921 列中 4 列因缺失或臺北河濱範圍外座標排除。涵蓋 30 座河濱公園與 187 種；survey_date 大多是 2016-11 至 2017-06，另有 2 筆不完整 1230。此不是歷年序列、樹木現況、存活、修剪、倒伏、移除或管理狀態資料。",
  license: "RIGHTS_HOLD：本機 CSV 標示臺北市政府工務局水利工程處河濱生態喬木調查，但原始下載 URL 與授權未記錄；僅 owner-only，不可據此公開散布或升格 public 圖層來源。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "notes=null 只表示來源沒有備註；不得補零、補文字或推論樹木與調查狀態。", zero: "height_m、dbh_cm、crown_area_m2、estimated_age_years 的 0 是來源數值，不能改為 null 或未觀測；也不能據此推論目前樹況。", stale: "2016-11 至 2017-06 的 historical survey dates 與 2026-07-14 處理快照都不是目前樹木庫存、樹高、胸徑、樹齡、健康、倒伏、修剪或管理狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-14T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺北市政府工務局水利工程處（本機來源註記）", reference: SOURCE_URL, lineage: "原始 riverside_trees_taipei.csv SHA-256 dbcdd5f4dcb4ecf4681f5c296e9eef8a76d7060a6ce7296f53f91793a66c9cb3 (10,921 rows; download origin/license HOLD) -> analytics riverside_trees_taipei_20260714.geojson SHA-256 5c7f87775bb978a80fa07411480919e3af38055cdc54b6b14f92b2ab7495fa94 (10,917 Point) -> source-SHA-validated owner-only sidecar SHA-256 2bc603414206c8b302754ac1d958916f505f2f3752ae08c640892c86e3ea4dbe. Mini public display artifact shares the analytics SHA but is not used by this owner-only reader." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 10_917, maxSourceBytes: 5 * 1024 * 1024 }),
  supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "riverside-trees-taipei-owner-reference-v1",
};

async function readRiversideTrees(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: riversideTreesTaipeiOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "tree_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 10_917 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("RIVERSIDE_TREES_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: riversideTreesTaipeiOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: riversideTreesTaipeiOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const riversideTreesTaipeiOwnerAdapter = createPointDatasetAdapter(riversideTreesTaipeiOwnerDescriptor, readRiversideTrees);
