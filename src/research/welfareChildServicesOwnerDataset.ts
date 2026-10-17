import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/welfare-child-services/welfare-child-services-owner-20260812.geojson";
const SOURCE_SHA256 = "55926bb2c37bfe6143201f19d9b303b423cc8ab3a3ec6b9f8ea6e7b3280332f9";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "welfare_class", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: true, nullMeaning: "來源列未能由地址解析縣市；不代表服務據點不存在或不服務任何縣市", unit: null },
  { name: "coord_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_source", type: "string", nullable: true, nullMeaning: "29 筆結構性無地址的行動、到宅或依法保密安置機構沒有座標來源；不是零座標或待補資料", unit: null },
  { name: "coord_precision", type: "string", nullable: true, nullMeaning: "無座標列沒有精度；不是低精度位置", unit: null },
  { name: "src_datasets", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: "source_dataset_count" },
  { name: "class_conflict", type: "string", nullable: true, nullMeaning: "來源間沒有發現分類衝突；不代表服務內容完全相同", unit: null },
  { name: "unit_type", type: "string", nullable: true, nullMeaning: "來源未提供單位型態；不代表沒有服務單位", unit: null },
  { name: "service_mode", type: "string", nullable: true, nullMeaning: "來源未提供服務方式；不代表沒有服務", unit: null },
  { name: "geometry", type: "json", nullable: true, nullMeaning: "29 筆結構性無地址、行動或依法保密機構沒有 Point；仍保留供屬性查詢，不能放入 bbox 結果", unit: null },
];

export const welfareChildServicesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-welfare-child-services-owner-20260812", label: "兒童及少年服務名冊（owner-only 2026-08-12 快照）",
  description: "固定 1,425 筆跨來源兒童及少年服務名冊，包含 1,396 筆 Point 與 29 筆結構性無地址紀錄。座標混合 TGOS 上游、Google 與離線地理編碼；Google 與離線座標的公開再散布權利未逐列審核，因此只供本機 owner-only 參考。",
  layerRefs: ["welfareChildServices"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "1,396 筆 Point：Google 146、離線 geocode 1,210（offline_l1 498、offline_l15 166、offline_l2 546）、TGOS 上游 40；精度 exact 635、cached 498、interpolated 175、approximate 48、upstream 40。另 29 筆為結構性無地址，geometry=null。所有 Point 僅可作參考位置 bbox 篩選，不能主張最近據點、距離、入口、服務範圍、道路可達性或目前服務位置。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-08-12 固定處理快照，22 縣市範圍但 11 筆 city 空字串。三類混裝：兒童發展／早療 1,107、兒少福利與安置 122、親子館／育兒支持 196；早療含教育、衛生與社福單位，不能直接視為純社福設施。29 筆無地址不等待 geocode，可能是行動據點、到宅服務或依法保密安置機構。固定名冊不是現行開放、收案、床位、服務量能、服務區域或營運狀態。",
  license: "原始來源列為 data.gov.tw 130229、160907、161606、165355、161604，資料目錄記為 OGDL-Taiwan-1.0；但 sidecar 含 Google 與離線地理編碼參考座標，公開再散布權利未完成逐列審核，整份僅限 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "coord_source、coord_precision 與 geometry 的 null 是 29 筆結構性無地址紀錄；其他欄位 null 依欄位定義保留來源缺值，不得補零、補址或推論目前服務狀態。", stale: "2026-08-12 固定快照不是目前開放、收案、床位、服務量能或服務範圍資料。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-12T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "衛生福利部社會及家庭署與衛生福利部公開名冊的既有分類快照", reference: SOURCE_URL, lineage: "data.gov.tw 130229、160907、161606、165355、161604 -> taipei-gis-analytics child_services_20260812.geojson SHA-256 ac0c94e29487b56589d25bd301ff4369f931dc166a27b446591ac405fe1d7e2a（1,425 rows；1,396 Point、29 null geometry）-> 安全欄位 owner-only sidecar SHA-256。sidecar 移除地址、電話、服務內容、服務時間及來源專屬敏感欄位。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 1425, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "welfare-child-services-owner-reference-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readWelfareChildServices(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: welfareChildServicesOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), preserveUnlocatedRecords: true }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("WELFARE_CHILD_SERVICES_OWNER_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 1425 || snapshot.exclusions.missing_geometry !== 29 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("WELFARE_CHILD_SERVICES_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: welfareChildServicesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: welfareChildServicesOwnerDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const welfareChildServicesOwnerAdapter = createReferencePointDatasetAdapter(welfareChildServicesOwnerDescriptor, readWelfareChildServices);
