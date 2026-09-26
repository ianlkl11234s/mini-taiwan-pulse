import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/forest-treatment-works/forest-treatment-works-owner-20260802.geojson";
const SOURCE_SHA256 = "9b0288a63d668541fce810a42af1f157cd5ecb176fca4da5859e41097f0b48db";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "planyear", type: "number", nullable: false, nullMeaning: null, unit: "ROC year" },
  { name: "eng_no", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "eng_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: "77 筆以空字串表示來源未填縣市；不是未定位或沒有工程。", unit: null },
  { name: "country", type: "string", nullable: false, nullMeaning: "77 筆以空字串表示來源未填鄉鎮區；不是未定位或沒有工程。", unit: null },
  { name: "coord_rule", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const forestTreatmentWorksOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-forest-treatment-works-owner-20260802", label: "林業治理工程（owner-only 固定快照）",
  description: "林業及自然保育署 data.gov.tw 47601 的固定處理產物，含 6,213 個可定位 Point。處理前的 raw 快照目前為 9,999 筆，與處理管線紀錄的 6,275 筆原始版本不一致；因此只能作 owner-only bbox／屬性參考，不能主張為完整原始版本、最近工程或精確距離結果。",
  layerRefs: ["forestTreatmentWorks"], kind: "point", recordGrain: "event", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "既有 pipeline 以 x1/y1 重建 WGS84：tm2 6,084、tm2_swapped 115、wgs84 3、wgs84_swapped 11；原始 x/y 已從 sidecar 移除。雖是工程記錄的代表座標，因 raw 版本不連續與少數座標修復規則，僅供 owner-only bbox／屬性參考；不得主張最近工程、精確直線距離、工程範圍、現況或可及性。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "固定 processed 快照有 6,213 Point；資料目錄記錄其前版 6,275 筆中 62 筆無法定位而排除，但目前本機 raw.json 是 9,999 筆，無法證明與這份 processed 產物同一版。年度為民國 92–113 年，描述工程計畫年度，不代表工程開工、完工、仍在施作或目前防災狀態。city 與 country 各有 77 個空字串。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；資料來源 data.gov.tw/dataset/47601。RAW_VERSION_MISMATCH_HOLD：目前可驗 raw 快照與處理來源版本不一致，先只限本機 owner-only，不升格為公開空間分析資料。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox、行政欄位或工程年度無結果，可能是 62 筆不可定位排除、77 筆空行政欄位或 raw 版本差異；不代表沒有工程。", stale: "民國 92–113 年工程計畫與 2026-08-02 座標修復快照，不代表工程進度、完工、維護、災害或安全狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-02T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "農業部林業及自然保育署", reference: SOURCE_URL, lineage: `data.gov.tw/dataset/47601（OGDL-Taiwan-1.0）-> analytics processed forestry_treatment_works.geojson SHA-256 266a981d42ec5c601b1fdf6b79097cadb96724a13eb815dc7b3680960efe8e2b（6,213 Point；Mini display asset byte-identical）-> safe-field owner-only sidecar SHA-256 ${SOURCE_SHA256}. Current raw.json SHA-256 2c623886278f0c6acbb6b9c5fcc65a80f025730adaf06cc6d677982d99288b22 has 9,999 rows, whereas processing documentation describes 6,275 input rows; this mismatch remains HOLD.` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 6_213, maxSourceBytes: 4 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "forest-treatment-works-owner-reference-v1",
};

async function readForestTreatmentWorks(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: forestTreatmentWorksOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "eng_no", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 6_213 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("FOREST_TREATMENT_WORKS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: forestTreatmentWorksOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: forestTreatmentWorksOwnerDescriptor.coverage, freshness: "stale", exclusions: { upstream_unlocated_from_documented_predecessor: 62, raw_version_mismatch_hold: 1, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const forestTreatmentWorksOwnerAdapter = createReferencePointDatasetAdapter(forestTreatmentWorksOwnerDescriptor, readForestTreatmentWorks);
