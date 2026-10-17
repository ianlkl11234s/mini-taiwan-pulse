import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d";
const MANIFEST_SHA256 = "35f59c0e4d6fc125a5b31e60ed5894c481494b4a54b853b294842b15283a8576";
const SOURCE_REFERENCE = `/research/nhi-medical/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/nhi-medical/manifest.json";
const SOURCE_COUNT = 31_603;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "category", type: "string", nullable: false, nullMeaning: null, unit: "nhi_processed_category" },
  { name: "geocode_source", type: "string", nullable: false, nullMeaning: null, unit: "tgos_google_or_google_retry" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

type Family = Readonly<{ datasetId: string; label: string; layerRef: "medHospital" | "medClinic" | "medPharmacy"; categories: readonly string[]; coverage: string }>;
const families = {
  hospital: { datasetId: "tw-nhi-medical-hospitals-owner-20260602", label: "健保特約醫院（owner-only 參考點）", layerRef: "medHospital", categories: ["hospital_district", "hospital_medical_center", "hospital_regional"], coverage: "451 筆：hospital_district 337、hospital_medical_center 29、hospital_regional 85。" },
  clinic: { datasetId: "tw-nhi-medical-clinic-other-owner-20260602", label: "健保特約診所及其他醫療院所（owner-only 參考點）", layerRef: "medClinic", categories: ["clinic", "health_center", "home_nursing", "lab", "medical_radiology", "midwifery", "occupational_therapy", "other_nhi", "physical_therapy", "rehab_home", "speech_therapy"], coverage: "23,472 筆：clinic 21,765；另有衛生所、居家護理、檢驗所、放射、助產、治療與 other_nhi 等 1,707 筆，不能稱為全數診所。" },
  pharmacy: { datasetId: "tw-nhi-medical-pharmacies-owner-20260602", label: "健保特約藥局（owner-only 參考點）", layerRef: "medPharmacy", categories: ["pharmacy"], coverage: "7,680 筆 category=pharmacy。" },
} as const satisfies Record<string, Family>;

function fail(code: string): never { throw new Error(code); }

function createFamily(family: Family) {
  const allowed = new Set(family.categories);
  const descriptor: DatasetDescriptor = {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label,
    description: `${family.coverage} NHI 已處理快照共 ${SOURCE_COUNT.toLocaleString("en-US")} 個 Point；bbox 必填，僅讀取相交的 immutable gzip 分片。保留 category 與 geocode_source，不含院所名稱、地址、電話、機構 ID、服務、科別、合約或營業欄位。`,
    layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源地理編碼來源為 TGOS 29,621、Google 1,603、Google retry 379；Point 僅能供 bounded owner-only bbox 與分類屬性參考，不能主張精確地點、最近院所、直線或道路距離、可達性、服務範圍、今日營運或特約狀態。", spatialAnalysisEligible: false },
    timeFields: [], coverage: `${family.coverage} 來源檔的全部 ${SOURCE_COUNT.toLocaleString("en-US")} 筆均為 Point。bbox 無結果不代表沒有醫療資源、無服務、無特約院所或範圍外沒有資料；此固定快照亦不代表目前營運、開放、服務或合約有效。`,
    license: "RIGHTS_HOLD：本 sidecar 的資料來源是 NHI（非舊 NLSC catalog）；原始 NHI 公開授權與下載 receipt 尚未驗證。又含 TGOS、Google、Google retry 地理編碼座標，公開再散布權利未獲逐筆確認，因此限 localhost owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果可能是查詢範圍、此固定快照或分片範圍的限制，不能推論資源不存在。", stale: "固定快照不是目前院所存在、開放、可服務、可預約、特約或可達性的證據。" },
    versions: [{ versionId: `20260602-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-06-02", checksumSha256: SOURCE_SHA256, mutable: false }],
    source: { publisher: "中央健康保險署（NHI）", reference: SOURCE_REFERENCE, lineage: `NHI processed nhi_institutions_geocoded.geojson SHA-256 ${SOURCE_SHA256} (${SOURCE_COUNT.toLocaleString("en-US")} Point) -> safe-field source-SHA-bound local gzip partitions；未採用已漂移的 NLSC catalog 描述。` },
    access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["category", "geocode_source"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: "nhi-medical-owner-reference-partitions-v1",
  };
  const read = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> => {
    if (!context?.bbox) fail("BBOX_REQUIRED");
    const snapshot = await loadPointDataset({ datasetId: descriptor.datasetId, url: SOURCE_REFERENCE, idField: "category", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
    if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("NHI_MEDICAL_SOURCE_SEMANTICS_MISMATCH");
    const rows = snapshot.rows.filter(row => typeof row.category === "string" && allowed.has(row.category));
    const source: SourceReceipt = { sourceId: descriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
    return { rows, source, coverage: descriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  return { descriptor, adapter: createReferencePointDatasetAdapter(descriptor, read) };
}

const hospital = createFamily(families.hospital);
const clinic = createFamily(families.clinic);
const pharmacy = createFamily(families.pharmacy);
export const nhiMedicalHospitalOwnerDescriptor = hospital.descriptor;
export const nhiMedicalHospitalOwnerAdapter = hospital.adapter;
export const nhiMedicalClinicOwnerDescriptor = clinic.descriptor;
export const nhiMedicalClinicOwnerAdapter = clinic.adapter;
export const nhiMedicalPharmacyOwnerDescriptor = pharmacy.descriptor;
export const nhiMedicalPharmacyOwnerAdapter = pharmacy.adapter;
