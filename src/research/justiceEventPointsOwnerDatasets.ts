import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/justice-event-points/women-child-warning-owner-20260626.geojson";
const SOURCE_SHA256 = "bbd5a338f632783cdb338ad8f086002fc91ca1e2bde6d5044e88f13b14fc75c4";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "warning_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
const fail = (code: string): never => { throw new Error(code); };

export const womenChildWarningOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-women-child-warning-owner-20260626", label: "婦幼安全警示地點（owner-only 2026-06-26）",
  description: "警政署公開婦幼安全警示地點的固定處理快照。sidecar 移除地址、轄區、聯絡人、電話與地理編碼文字；Point 為 Google 地理編碼參考位置，只供 bbox 與屬性查詢。",
  layerRefs: ["womenChildWarning"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "原始兩份警示地點名冊無座標，185 Point 由地址 Google geocode；另有 3 筆機關層級地址未能地理編碼。不可主張最近、距離、入口、道路可達性、即時安全狀態或警力部署。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "data.gov.tw 6247 的 186 個有效公開列加 data.gov.tw 26272 的 2 列，共 188 個地點；185 個可地理編碼 Point，3 個未定位來源列未以行政區中心補點。這不是個人事故或案件資料。",
  license: "OGDL-Taiwan-1.0 原始名冊；sidecar 含 Google geocode 參考座標，公開再散布權利未逐列核對，僅供 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "sidecar bbox 無結果不代表該區無安全風險或沒有警示地點；3 個原始列因地理編碼失敗未出現在 Point 側。", stale: "2026-06-26 固定快照不代表目前警示、治安、照明、警力、事件或現地安全狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-06-26T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "內政部警政署；桃園市政府警察局鏡像", reference: SOURCE_URL, lineage: "wcs_npa_6247.csv SHA-256 598ca79b8347ad1a8c9213b11608d0496cd9cc1b62ccfcd3c729559d6daad021（188 physical lines；186 valid rows after repeated header exclusion）+ wcs_taoyuan_26272.csv SHA-256 245d6277298eb197a6d3cb9735b89882b9d1e7670b7b3a1ec86911a51ae6491b（3 physical lines；2 rows）-> processed women_child_warning_20260626.geojson SHA-256 29a48e8e229802f0f78e1c57c550aca3f5e02e3ac67e682cad8dbdf016f58e89（185 Point，3 geocode failures）-> safe-field owner-only sidecar；移除 name、address、dept、branch、contact、phone、geocode_formatted。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["warning_type", "source", "source_tier", "fetched_at"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 185, maxSourceBytes: 512 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "women-child-warning-owner-reference-v1",
};

async function readWomenChildWarning(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: womenChildWarningOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("JUSTICE_WOMEN_CHILD_WARNING_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 185 || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("JUSTICE_WOMEN_CHILD_WARNING_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: womenChildWarningOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: womenChildWarningOwnerDescriptor.coverage, freshness: "unknown", exclusions: { upstream_geocode_failure: 3, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const womenChildWarningOwnerAdapter = createReferencePointDatasetAdapter(womenChildWarningOwnerDescriptor, readWomenChildWarning);
