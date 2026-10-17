import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/tourism-factories/tourism-factories-owner-20260723.geojson";
const SOURCE_SHA256 = "d61535fc102dbcea8b6fa813fd36d25c4ba5099239dabe845669315276691196";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "id", type: "string", nullable: false, nullMeaning: null, unit: null },
  ...["region", "city", "name", "zipcode", "geocode_source", "geocode_precision"].map(name => ({ name, type: "string" as const, nullable: false, nullMeaning: null, unit: null })),
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
export const tourismFactoriesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-tourism-factories-owner-20260723", label: "觀光工廠（2026-07-23 owner-only 參考位置）",
  description: "經濟部產業發展署觀光工廠名錄 158 筆固定快照。座標由地址 fallback geocode，含 34 筆 Google；僅可作 owner-only bbox／屬性參考，最近點與精確距離 HOLD。",
  layerRefs: ["tourFactories"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "地址地理編碼 Point：offline_l1 52、offline_l15 17、offline_l2 55、Google 34。Google 座標公開再散布權未核；不得用於最近點、精確距離、入口、道路距離、步行或 transit 可達性。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "固定 2026-07-23 快照，158/158 有 geocode Point。名錄不是目前開放、預約、參觀、營業、資格有效或服務供給的證明。",
  license: "原始觀光工廠名錄為 OGDL-Taiwan-1.0；34 筆 Google geocode 座標公開再散布權未核，僅限 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, stale: "固定快照不代表目前營業、參觀、預約或資格狀態。", null: "此 fixed sidecar 無 null geometry；未載入地址、電話、網站，不能把缺欄解讀為來源不存在。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: "2026-07-23", availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部產業發展署", reference: SOURCE_URL, lineage: "官方無座標觀光工廠 CSV SHA-256 5d2ee4616bbb3608c115e4c4c54647917564d67c1603e17684b80239662af60f -> processed fallback-geocoded GeoJSON SHA-256 a47d7ba0ff6e1221a4f94cac1aeeff75308d2779aed57d26a2f65895d7ee4014 -> safe-field owner-only sidecar；移除地址、電話、網站與重複 lat/lon。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 158, maxSourceBytes: 1 * 1024 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "tourism-factories-owner-reference-v1",
};
async function readFactories(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: tourismFactoriesOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 158 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("TOURISM_FACTORIES_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: tourismFactoriesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: tourismFactoriesOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const tourismFactoriesOwnerAdapter = createReferencePointDatasetAdapter(tourismFactoriesOwnerDescriptor, readFactories);
