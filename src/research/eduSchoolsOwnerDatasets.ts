import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/edu-schools/taiwan-schools-2024-owner.geojson";
const SOURCE_SHA256 = "9e44e6c92cd2335bec90e9e5946139422343f3ca7505b3ac07c9d61bb1194667";
const SOURCE_ROWS = 4315;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school_level", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "system_type", type: "string", nullable: true, nullMeaning: "來源未提供學校體制；不代表無體制、停辦或不屬於此學制", unit: null },
  { name: "region_type", type: "string", nullable: true, nullMeaning: "JSON null 代表來源沒有偏遠分級，不是零、一般校或未提供學制", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

type Family = Readonly<{ datasetId: string; label: string; layerRef: "eduSchoolElementary" | "eduSchoolJunior" | "eduSchoolSenior" | "eduSchoolUniversity" | "eduSchoolSpecial" | "eduRemoteSchools"; rows: number; selection: (row: Readonly<Record<string, unknown>>) => boolean; coverage: string }>;
const families: readonly Family[] = [
  { datasetId: "tw-schools-elementary-owner-2024", label: "國民小學名冊（owner-only 2024）", layerRef: "eduSchoolElementary", rows: 2656, selection: row => ["國民小學", "附設國民小學"].includes(String(row.school_level)), coverage: "國民小學 2,614 加附設國民小學 42，共 2,656 Point。" },
  { datasetId: "tw-schools-junior-owner-2024", label: "國民中學名冊（owner-only 2024）", layerRef: "eduSchoolJunior", rows: 964, selection: row => ["國民中學", "附設國民中學"].includes(String(row.school_level)), coverage: "國民中學 736 加附設國民中學 228，共 964 Point。" },
  { datasetId: "tw-schools-senior-owner-2024", label: "高中職名冊（owner-only 2024）", layerRef: "eduSchoolSenior", rows: 508, selection: row => row.school_level === "高級中等學校", coverage: "高級中等學校 508 Point。" },
  { datasetId: "tw-schools-university-owner-2024", label: "大專校院名冊（owner-only 2024）", layerRef: "eduSchoolUniversity", rows: 159, selection: row => ["大專校院", "空大及大專校院附設進修學校", "宗教研修學院"].includes(String(row.school_level)), coverage: "大專校院 140、空大及大專校院附設進修學校 10、宗教研修學院 9，共 159 Point。" },
  { datasetId: "tw-schools-special-owner-2024", label: "特殊教育學校名冊（owner-only 2024）", layerRef: "eduSchoolSpecial", rows: 28, selection: row => row.school_level === "特殊教育學校", coverage: "特殊教育學校 28 Point。" },
  { datasetId: "tw-schools-remote-owner-2024", label: "偏遠地區學校名冊（owner-only 2024）", layerRef: "eduRemoteSchools", rows: 1152, selection: row => ["偏遠", "特偏", "極偏"].includes(String(row.region_type)), coverage: "偏遠 830、特偏 192、極偏 130，共 1,152 Point；它與五個學制名冊重疊，不能與其相加為獨立學校數。" },
];
function fail(code: string): never { throw new Error(code); }
function createFamilyAdapter(family: Family) {
  const descriptor: DatasetDescriptor = {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label,
    description: `${family.coverage} 來源為 113 學年度各級學校名錄的原生數值座標處理產物；座標公開再散布授權尚未完成核對，僅供本機 owner-only 查詢。`,
    layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "原始名錄含經緯度的原生數值座標，但本輪未取得可公開再散布的授權收據。可用於本機 bbox 與屬性參考，不能主張最近學校、直線距離、步行可達性、學區、服務範圍或入口位置。", spatialAnalysisEligible: false },
    timeFields: [], coverage: `${family.coverage} 來源共 ${SOURCE_ROWS} Point，無 null/non-Point/invalid geometry。來源 school code 只在名錄中重複出現於不同列，故查詢主鍵是側錄列號 record_id，code 僅作來源欄位。113 學年度名錄是固定期間快照，不代表目前招生、校務、開放、學區或存續狀態。`,
    license: "RIGHTS_HOLD：原始來源與處理產物的公開座標再散布授權尚未核對；本 reader 僅限 owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "region_type 的 null 是非偏遠分級的來源值，不能補為零或其他分類。", stale: "113 學年度固定名錄不代表目前招生、校務、開放、學區或存續狀態。" },
    versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2025-08-14T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
    source: { publisher: "教育部 113 學年度各級學校名錄（含經緯度）", reference: SOURCE_URL, lineage: "taipei-gis-analytics data/raw/education/schools/113學年度各級學校名錄(含經緯度) 20250814.xlsx -> processed/education/schools/taiwan_schools_2024.geojson SHA 7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3 (4,315 Point) -> safe-field owner-only sidecar。sidecar 移除地址、電話與網站。" },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: SOURCE_ROWS, maxSourceBytes: 2 * 1024 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "edu-schools-owner-reference-v1",
  };
  const read = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: descriptor.datasetId, url: SOURCE_URL, idField: "code", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
    if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("EDU_SCHOOLS_OWNER_SOURCE_SHA_MISMATCH");
    if (snapshot.rows.length !== SOURCE_ROWS || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("EDU_SCHOOLS_OWNER_SOURCE_SEMANTICS_MISMATCH");
    const rows = snapshot.rows.filter(family.selection);
    if (rows.length !== family.rows) fail("EDU_SCHOOLS_OWNER_SELECTION_SEMANTICS_MISMATCH");
    const source: SourceReceipt = { sourceId: descriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
    return { rows, source, coverage: descriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  return { descriptor, adapter: createReferencePointDatasetAdapter(descriptor, read) };
}
const elementary = createFamilyAdapter(families[0]!);
const junior = createFamilyAdapter(families[1]!);
const senior = createFamilyAdapter(families[2]!);
const university = createFamilyAdapter(families[3]!);
const special = createFamilyAdapter(families[4]!);
const remote = createFamilyAdapter(families[5]!);
export const eduSchoolElementaryOwnerDescriptor = elementary.descriptor;
export const eduSchoolElementaryOwnerAdapter = elementary.adapter;
export const eduSchoolJuniorOwnerDescriptor = junior.descriptor;
export const eduSchoolJuniorOwnerAdapter = junior.adapter;
export const eduSchoolSeniorOwnerDescriptor = senior.descriptor;
export const eduSchoolSeniorOwnerAdapter = senior.adapter;
export const eduSchoolUniversityOwnerDescriptor = university.descriptor;
export const eduSchoolUniversityOwnerAdapter = university.adapter;
export const eduSchoolSpecialOwnerDescriptor = special.descriptor;
export const eduSchoolSpecialOwnerAdapter = special.adapter;
export const eduRemoteSchoolsOwnerDescriptor = remote.descriptor;
export const eduRemoteSchoolsOwnerAdapter = remote.adapter;
