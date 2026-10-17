import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_ROOT = "/__local-research-owner-only/welfare-geocoded";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "welfare_class", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "sub_code", type: "string", nullable: true, nullMeaning: "來源列未提供機構子類別；不代表沒有類別或不屬於福利服務", unit: null },
  { name: "permit_status", type: "string", nullable: true, nullMeaning: "來源列未提供立案狀態；不代表目前未立案、停業、開放或可服務", unit: null },
  { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "src_datasets", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: "source_dataset_count" },
  { name: "inst_code", type: "string", nullable: true, nullMeaning: "來源列未提供機構代碼；不代表機構不存在", unit: null },
  { name: "uni_no", type: "string", nullable: true, nullMeaning: "來源列未提供統一編號；不代表沒有法人或登記", unit: null },
  { name: "src_system", type: "string", nullable: true, nullMeaning: "來源列未提供來源系統；不代表沒有管理系統", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

type Family = Readonly<{
  datasetId: string;
  label: string;
  file: string;
  sidecarSha256: string;
  upstreamSha256: string;
  rows: number;
  layerRef: "welfareChildcare" | "welfareDisability" | "welfareSocialWorkOrgs";
  publisher: string;
  rawSource: string;
  coverage: string;
  sourceCounts: string;
  precisionCounts: string;
  nulls: string;
}>;

const families = {
  childcare: {
    datasetId: "tw-welfare-childcare-owner-20260925", label: "托嬰中心名冊（owner-only 參考位置）", file: "welfare-childcare-owner-20260925.geojson",
    sidecarSha256: "1728987b244eeacd05764dd08cf65f9cf589390de7df9273c2b33621d90fdf94", upstreamSha256: "34511cde4fd56b742623c54df7e807c135289c72efd90db1578d18c407423786", rows: 1578, layerRef: "welfareChildcare",
    publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）", rawSource: "165355；托育服務整合資訊系統為主要來源系統",
    coverage: "固定 1,578 筆托嬰中心快照，全部有 Point；不含居家托育者。", sourceCounts: "tgos_upstream 1,354、Google 221、offline_l1/l15/l2 各 1", precisionCounts: "upstream 1,354、exact 200、approximate 16、interpolated 7、cached 1", nulls: "uni_no 72",
  },
  disability: {
    datasetId: "tw-welfare-disability-owner-20260925", label: "身心障礙福利機構（owner-only 參考位置）", file: "welfare-disability-owner-20260925.geojson",
    sidecarSha256: "8cd5128121b467cfa94aa6e7965d8eaaabffe5d1f96602356758e000d89743b3", upstreamSha256: "1317b144b57c19f8a580ee617b23f1e88adaee81ff271c0e3c9d405e21b001f6", rows: 334, layerRef: "welfareDisability",
    publisher: "全國身心障礙福利資訊整合平台等來源的既有處理快照", rawSource: "12061、130229、161606、165355 的混合來源；不可縮寫為單一 165355 資料集",
    coverage: "固定 334 筆身心障礙福利機構快照，全部有 Point。名額、實際安置、服務內容、地址與電話未進入 sidecar，不能據此推論容量、使用率或目前服務。", sourceCounts: "tgos_upstream 306、Google 7、offline_l2 15、offline_l15 4、offline_l1 2", precisionCounts: "upstream 306、exact 19、interpolated 4、approximate 3、cached 2", nulls: "sub_code/permit_status/inst_code/src_system 各 20；uni_no 266",
  },
  socialWorkOrgs: {
    datasetId: "tw-welfare-social-work-orgs-owner-20260925", label: "社福團體與社工事務所（owner-only 參考位置）", file: "welfare-social-work-orgs-owner-20260925.geojson",
    sidecarSha256: "325289231f890008a6a5b449d7981fab311f6d80d21375cac52ddb81a3926c5a", upstreamSha256: "697c1eced0ae73e04768606cc2b326b08bd1d76050d8aa4320c539e5c97a1e19", rows: 587, layerRef: "welfareSocialWorkOrgs",
    publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）", rawSource: "165355；多為登記組織與辦公室地址，不是服務設施",
    coverage: "固定 587 筆社福團體與社工事務所快照，全部有 Point；組織地址不能當服務據點、服務範圍或可近性母體。", sourceCounts: "tgos_upstream 551、Google 26、offline_l2 7、offline_l1 3", precisionCounts: "upstream 551、exact 22、approximate 10、cached 3、interpolated 1", nulls: "uni_no 61",
  },
} as const satisfies Record<string, Family>;

function fail(code: string): never { throw new Error(code); }

function createAdapter(family: Family) {
  const reference = `${SOURCE_ROOT}/${family.file}`;
  const descriptor: DatasetDescriptor = {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label,
    description: `${family.coverage} ${family.sourceCounts}。混入 Google 與離線補點，座標再散布權利未完成逐列公開審核，因此只供本機 owner-only 參考。`,
    layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: `${family.sourceCounts}；${family.precisionCounts}。所有 Point 都只代表地理編碼或來源位置，不能主張設施入口、最近距離、直線距離、道路可達性、服務範圍或目前位置。`, spatialAnalysisEligible: false },
    timeFields: [], coverage: `${family.coverage} ${family.nulls} 為保留的來源缺值。這是固定名冊快照，不代表目前立案、開放、收托、空位、服務量能或設施存續。`,
    license: "RIGHTS_HOLD：原始公開資料與來源系統的授權資訊依各列 src_datasets/src_system 而異；sidecar 含 Google 與離線補點座標，公開再散布權利未完成逐列審核，僅限 owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: `${family.nulls} 依欄位定義保留來源缺值；不得補零、補值或轉成狀態判定。`, stale: "固定快照不是目前可用性、營運、收托、名額、服務量能或服務範圍資料。" },
    versions: [{ versionId: `20260925-owner-sidecar-sha256:${family.sidecarSha256}`, observedAt: null, availableAt: null, checksumSha256: family.sidecarSha256, mutable: false }],
    source: { publisher: family.publisher, reference, lineage: `${family.rawSource} -> 既有完整 Point GeoJSON SHA-256 ${family.upstreamSha256} -> 安全欄位 owner-only sidecar SHA-256 ${family.sidecarSha256}。sidecar 保留 uid、名稱、分類、縣市、來源與座標 provenance，移除地址、電話及家族特有服務欄位。` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: family.rows, maxSourceBytes: 1024 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: "welfare-geocoded-owner-reference-v1",
  };
  const read = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: descriptor.datasetId, url: reference, idField: "uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
    if (snapshot.checksumSha256 !== family.sidecarSha256) fail("WELFARE_GEOCODED_OWNER_SOURCE_SHA_MISMATCH");
    if (snapshot.rows.length !== family.rows || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("WELFARE_GEOCODED_OWNER_SOURCE_SEMANTICS_MISMATCH");
    const source: SourceReceipt = { sourceId: descriptor.datasetId, version: `sha256:${family.sidecarSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sidecarSha256, reference };
    return { rows: snapshot.rows, source, coverage: descriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  return { descriptor, adapter: createReferencePointDatasetAdapter(descriptor, read) };
}

const childcare = createAdapter(families.childcare);
const disability = createAdapter(families.disability);
const socialWorkOrgs = createAdapter(families.socialWorkOrgs);

export const welfareChildcareOwnerDescriptor = childcare.descriptor;
export const welfareChildcareOwnerAdapter = childcare.adapter;
export const welfareDisabilityOwnerDescriptor = disability.descriptor;
export const welfareDisabilityOwnerAdapter = disability.adapter;
export const welfareSocialWorkOrgsOwnerDescriptor = socialWorkOrgs.descriptor;
export const welfareSocialWorkOrgsOwnerAdapter = socialWorkOrgs.adapter;
