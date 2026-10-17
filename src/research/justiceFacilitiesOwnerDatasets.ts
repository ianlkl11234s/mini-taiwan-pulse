import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_BASE = "/__local-research-owner-only/justice-facilities";
type Family = Readonly<{ key: "antiCorruptionOffice" | "correctionalFacility" | "court" | "immigrationOffice" | "investigationBureau" | "prosecutorsOffice"; datasetId: string; label: string; file: string; sha256: string; rows: number; fields: readonly DatasetField[]; publisher: string; lineage: string; precision: string; coverage: string }>;
const required = (name: string): DatasetField => ({ name, type: "string", nullable: false, nullMeaning: null, unit: null });
const requiredNumber = (name: string): DatasetField => ({ name, type: "number", nullable: false, nullMeaning: null, unit: null });
const optional = (name: string, nullMeaning: string): DatasetField => ({ name, type: "string", nullable: true, nullMeaning, unit: null });
const common: readonly DatasetField[] = [required("record_id"), required("name")];
const families: readonly Family[] = [
  { key: "antiCorruptionOffice", datasetId: "tw-anti-corruption-offices-owner-20260626", label: "政風與廉政機構名冊（owner-only 2026-06-26）", file: "anti-corruption-offices-owner-20260626.geojson", sha256: "1cba125c63e521f7f7aab73877055986383e85821c5271e06c7102da5a92bc24", rows: 66, fields: [...common, required("entity_id"), required("level"), required("facility_subtype"), required("source"), requiredNumber("source_tier"), required("fetched_at"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "法務部廉政署與中央、地方政府政風機構（data.gov.tw 13772、13773）", lineage: "兩份不同原表：aac_central_13772.json SHA 36d3dad17ce50bcd5d71a1a506f6d39ac9a4857dc7a8e4139ce2804f524fa800（43 rows）+ aac_local_13773.json SHA b70df7779cc076a342c6980aff30a1566c1de10e55814dee6a922f9c5f3748dd（23 rows）-> processed anti_corruption_offices_20260626.geojson SHA 367a849aa628a16d8c9c7a63f0447209e222026671c6faa8df34dea5e4e8de4c（66 Point，Google geocode）-> owner-only safe-field sidecar。", precision: "兩份官方地址名冊本身沒有座標；66 Point 都是 Google geocode 參考位置。", coverage: "中央 43、地方 23，共 66 個固定快照名冊點；不代表受理狀態、檢舉管道、辦公室入口或服務可達性。" },
  { key: "correctionalFacility", datasetId: "tw-correctional-facilities-owner-20260626", label: "矯正機關名冊（owner-only 2026-06-26）", file: "correctional-facilities-owner-20260626.geojson", sha256: "8d9dfc90822e7b78e95f534e247101d608f8fef2e8baaedd0751375600ba4075", rows: 51, fields: [...common, required("entity_id"), required("facility_type"), optional("nature_zh", "原始名冊未標示中文業務性質；不代表非矯正機關"), required("source"), requiredNumber("source_tier"), required("fetched_at"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "法務部矯正署所屬機關通訊錄", lineage: "mjac_directory.json SHA 1e36d4b595c7c983e849307c0fc841c9d593ec23478f8eaa43cc2845d6e776ff（51 rows）-> processed correctional_facilities_20260626.geojson SHA de96d699fd75452aa144ec326d320245b7dcf1e4ed1c7b2cd85625e88ea94478（51 Point，Google geocode）-> owner-only safe-field sidecar。", precision: "官方 XLSX 名冊沒有座標；51 Point 都是 Google geocode 參考位置，可能與監所入口或邊界不同。", coverage: "監獄 29、看守所 12、戒治所 4、矯正學校 4、少觀所 2，共 51 個固定名冊點；不代表收容人數、開放、警戒或服務狀態。" },
  { key: "court", datasetId: "tw-courts-owner-20260626", label: "法院名冊（owner-only 2026-06-26）", file: "courts-owner-20260626.geojson", sha256: "7400380c2c7609693a57743573aa97a5c1bb01d5a45d3434cad9c3b35bdf2874", rows: 35, fields: [...common, required("entity_id"), required("court_type"), required("source"), requiredNumber("source_tier"), required("fetched_at"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "司法院各院通訊錄彙整", lineage: "courts_directory.json SHA a9abe2ea220433c9451aba1f271966288468691544abcdfb643174f372ab78da（35 rows）-> processed courts_20260626.geojson SHA b0024292a0346f8fb15fb9f87152e0faa59680e949f458da722fabea42640a24（35 Point，Google geocode）-> owner-only safe-field sidecar。", precision: "通訊錄地址經 Google geocode；35 個院級點不含簡易庭，兩組共址記錄依原表保留。", coverage: "最高法院 2、高等 6、地方法院 22、行政 3、智財商業 1、少年家事 1，共 35 個院級機關；不是法院管轄 polygon、開庭或案件資料。" },
  { key: "immigrationOffice", datasetId: "tw-immigration-offices-owner-20260626", label: "移民署服務站名冊（owner-only 2026-06-26）", file: "immigration-offices-owner-20260626.geojson", sha256: "7eaa55c8dd417ded38799d3b5c6e6b10ccdfb32c2746b474f06f42e7e965cff2", rows: 25, fields: [...common, required("agency_code"), required("name_en"), required("facility_subtype"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "內政部移民署國內服務站（data.gov.tw 73239）", lineage: "service_stations_73239.csv SHA 6e0750102c93789765c72d8f48f8605ed48522491e11a5a68fd128f202a0425a（25 rows、TgosWGS_X/Y）-> processed immigration_offices_20260626.geojson SHA 4dc884eda6ab1039e7f84cf3d9d3c21d3df266d4c561b9f8cea4a07458dc9f74（25 Point）-> owner-only safe-field sidecar；另一份 overseas_units_39361.csv SHA c7fec71e4ff2a91462a7920fe561e8320cc75ace69b251e28507c4428d334581 是無座標駐外名冊，未混入本層。", precision: "原表直接提供 TgosWGS_X/Y，但本機缺少可獨立核對的授權收據與位置精度說明，仍只作參考位置。", coverage: "國內服務站 25 Point；不含 39361 駐外據點，且不能代表櫃台開放、可辦業務、排隊或實際入口。" },
  { key: "investigationBureau", datasetId: "tw-investigation-bureau-owner-20260626", label: "調查局機關名冊（owner-only 2026-06-26）", file: "investigation-bureau-owner-20260626.geojson", sha256: "524049016a64ac097a8c5ec853b212ad927b242814298da60aa3c2e4ebdaca5c", rows: 29, fields: [...common, required("entity_id"), required("facility_subtype"), required("source"), requiredNumber("source_tier"), required("fetched_at"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "法務部調查局（data.gov.tw 38336）", lineage: "mjib_units_38336.csv SHA bfc5bb0b0fb5fa4b288e61c3affb4e421bbc4ab6c699b84ab8638593fc07fced（29 rows，地址名冊）-> processed investigation_bureau_20260626.geojson SHA bf8c9cebf887abf93d2e39d0207992dd0eed245e8e1db5c8fc5c552cdb200769（29 Point，Google geocode）-> owner-only safe-field sidecar。", precision: "官方表無座標；29 Point 都是 Google geocode 參考位置。", coverage: "調查局本部、22 縣市調查處及所屬單位共 29 個固定名冊點；不代表受理、值勤、管轄、業務範圍或入口。" },
  { key: "prosecutorsOffice", datasetId: "tw-prosecutors-offices-owner-20260626", label: "檢察署名冊（owner-only 2026-06-26）", file: "prosecutors-offices-owner-20260626.geojson", sha256: "c64b656ea8e099b4bffb81ada5835db385e60904315a271aa8ede10a3fca865c", rows: 29, fields: [...common, required("entity_id"), required("pros_type"), required("source"), requiredNumber("source_tier"), required("fetched_at"), { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }], publisher: "法務部所屬檢察機關通訊錄彙整", lineage: "prosecutors_directory.json SHA a178a2d7052140cb5b195348f977376debdc1b8b31f8788197f720e10da638aa（29 rows）-> processed prosecutors_offices_20260626.geojson SHA 84426ec9ebd8008d48a778e3233c48abe83f4106aab31f0a9479e58b338a2063（29 Point，Google geocode）-> owner-only safe-field sidecar。", precision: "通訊錄地址經 Google geocode；位置只供 bbox 與屬性參考。", coverage: "最高檢 1、高檢 6、地檢 22，共 29 個固定名冊點；不代表開庭、案件、受理、管轄或入口。" },
];

function fail(code: string): never { throw new Error(code); }
function createFamily(family: Family) {
  const sourceUrl = `${SOURCE_BASE}/${family.file}`;
  const descriptor: DatasetDescriptor = {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label,
    description: `${family.coverage} 本機處理完成，但來源版本與坐標公開再散布權利尚未形成完整可發布收據，因此僅提供 owner-only 查詢。`,
    layerRefs: [family.key], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields: family.fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: `${family.precision} 僅可做 bbox 與屬性查詢，不可主張最近設施、直線距離、入口、邊界、道路可達性或服務範圍。`, spatialAnalysisEligible: false },
    timeFields: [], coverage: family.coverage,
    license: "RIGHTS_HOLD：本機保存的 processed artifact 未附可獨立核對的完整授權收據；不發布坐標 sidecar。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, stale: "2026-06-26 固定處理快照，不代表目前機關、服務、開放或管轄狀態。" },
    versions: [{ versionId: `sha256:${family.sha256}`, observedAt: null, availableAt: "2026-06-26T00:00:00+08:00", checksumSha256: family.sha256, mutable: false }],
    source: { publisher: family.publisher, reference: sourceUrl, lineage: family.lineage },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: family.fields.map(field => field.name), filters: family.fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: Math.max(100, family.rows), maxSourceBytes: 1024 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `${family.datasetId}-reference-v1`,
  };
  const read = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: descriptor.datasetId, url: sourceUrl, idField: "record_id", safeFields: family.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
    if (snapshot.checksumSha256 !== family.sha256) fail(`JUSTICE_${family.key.toUpperCase()}_SOURCE_SHA_MISMATCH`);
    if (snapshot.rows.length !== family.rows || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail(`JUSTICE_${family.key.toUpperCase()}_SOURCE_SEMANTICS_MISMATCH`);
    const source: SourceReceipt = { sourceId: descriptor.datasetId, version: `sha256:${family.sha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sha256, reference: sourceUrl };
    return { rows: snapshot.rows, source, coverage: descriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  return { descriptor, adapter: createReferencePointDatasetAdapter(descriptor, read) };
}
const antiCorruption = createFamily(families[0]!);
const correctional = createFamily(families[1]!);
const courts = createFamily(families[2]!);
const immigration = createFamily(families[3]!);
const investigation = createFamily(families[4]!);
const prosecutors = createFamily(families[5]!);
export const antiCorruptionOfficeOwnerDescriptor = antiCorruption.descriptor;
export const antiCorruptionOfficeOwnerAdapter = antiCorruption.adapter;
export const correctionalFacilityOwnerDescriptor = correctional.descriptor;
export const correctionalFacilityOwnerAdapter = correctional.adapter;
export const courtOwnerDescriptor = courts.descriptor;
export const courtOwnerAdapter = courts.adapter;
export const immigrationOfficeOwnerDescriptor = immigration.descriptor;
export const immigrationOfficeOwnerAdapter = immigration.adapter;
export const investigationBureauOwnerDescriptor = investigation.descriptor;
export const investigationBureauOwnerAdapter = investigation.adapter;
export const prosecutorsOfficeOwnerDescriptor = prosecutors.descriptor;
export const prosecutorsOfficeOwnerAdapter = prosecutors.adapter;
