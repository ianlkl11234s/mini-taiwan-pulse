import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_ROOT = "/__local-research-owner-only/welfare-care";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  ...["name", "welfare_class", "city", "coord_source", "coord_precision", "src_datasets"].map(name => ({ name, type: "string" as const, nullable: false, nullMeaning: null, unit: null })),
  { name: "sub_code", type: "string", nullable: true, nullMeaning: "來源列未提供機構子類別；不代表沒有類別或不屬於福利服務", unit: null },
  { name: "permit_status", type: "string", nullable: true, nullMeaning: "來源列未提供立案狀態；不代表目前未立案、停業、開放或可服務", unit: null },
  { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: "source_dataset_count" },
  { name: "inst_code", type: "string", nullable: true, nullMeaning: "來源列未提供機構代碼；不代表機構不存在", unit: null },
  { name: "uni_no", type: "string", nullable: true, nullMeaning: "來源列未提供統一編號；不代表沒有法人或登記", unit: null },
  { name: "src_system", type: "string", nullable: true, nullMeaning: "來源列未提供來源系統；不代表沒有管理系統", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
type Family = Readonly<{ datasetId: string; label: string; file: string; sidecarSha256: string; upstreamSha256: string; rows: number; layerRef: "welfareLtcInstitutions" | "welfareElderlyHomes"; publisher: string; coverage: string; counts: string; nulls: string }>;
const families = {
  ltc: { datasetId: "tw-ltc-institutions-owner-20260925", label: "長照立案機構（owner-only 參考位置）", file: "welfare-ltc-institutions-owner-20260925.geojson", sidecarSha256: "ec904d7bb094f22f331f4fc884c2801aeca7901c5dcc96ec95cce2ce629e55d7", upstreamSha256: "876b771afdb69676a342750f215fbfdaffd4cdfeaf4b73704d4297a2591c72cb", rows: 3117, layerRef: "welfareLtcInstitutions", publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）", coverage: "固定 3,117 筆長照立案機構快照，全部有 Point。", counts: "tgos_upstream 3,053、Google 29、offline_l1 9、offline_l2 25、offline_l15 1；upstream 3,053、exact 45、cached 9、approximate 6、interpolated 4", nulls: "uni_no 17" },
  elderly: { datasetId: "tw-elderly-care-homes-owner-20260925", label: "老人住宿機構（owner-only 參考位置）", file: "welfare-elderly-care-homes-owner-20260925.geojson", sidecarSha256: "5167ef508cac220c6cb0c38c71fec236f63331f0adb4221aec8f5f3a91e4d984", upstreamSha256: "0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f", rows: 1160, layerRef: "welfareElderlyHomes", publisher: "衛生福利部社會福利機構總表與既有福利資料產物（data.gov.tw/dataset/165355、8572；一筆來源標示 161606）", coverage: "固定 1,160 筆老人住宿機構快照，全部有 Point。", counts: "tgos_upstream 1,043、Google 33、offline_l1 10、offline_l2 46、offline_l15 28；upstream 1,043、exact 67、cached 10、approximate 9、interpolated 31", nulls: "sub_code/permit_status/inst_code/src_system 各 81；uni_no 1,090" },
} as const satisfies Record<string, Family>;
function fail(code: string): never { throw new Error(code); }
function createAdapter(family: Family) {
  const reference = `${SOURCE_ROOT}/${family.file}`;
  const descriptor: DatasetDescriptor = {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label, description: `${family.coverage} ${family.counts}。含 Google 與離線補點，僅供本機 owner-only 參考。`,
    layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: `${family.counts}。Point 是來源或地理編碼位置，不能主張設施入口、精確最近、直線距離、道路可達性、服務範圍或目前位置。`, spatialAnalysisEligible: false }, timeFields: [],
    coverage: `${family.coverage} ${family.nulls} 為保留來源缺值；固定快照不代表目前立案、開放、收托、空位、服務量能或設施存續。`, license: "RIGHTS_HOLD：sidecar 含 Google 與離線補點座標，公開再散布權利未完成逐列審核，僅限 owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: `${family.nulls} 為來源缺值；不得補零、補值或轉成狀態判定。`, stale: "固定快照不是目前可用性、營運、收托、名額、服務量能或服務範圍資料。" }, versions: [{ versionId: `20260925-owner-sidecar-sha256:${family.sidecarSha256}`, observedAt: null, availableAt: null, checksumSha256: family.sidecarSha256, mutable: false }],
    source: { publisher: family.publisher, reference, lineage: `既有完整 Point GeoJSON SHA-256 ${family.upstreamSha256} -> 安全欄位 owner-only sidecar SHA-256 ${family.sidecarSha256}；保留來源與座標 provenance，移除地址、電話及家族特有服務欄位。` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: family.rows, maxSourceBytes: 2 * 1024 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "welfare-care-owner-reference-v1",
  };
  const read = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: descriptor.datasetId, url: reference, idField: "uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
    if (snapshot.checksumSha256 !== family.sidecarSha256) fail("WELFARE_CARE_OWNER_SOURCE_SHA_MISMATCH");
    if (snapshot.rows.length !== family.rows || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("WELFARE_CARE_OWNER_SOURCE_SEMANTICS_MISMATCH");
    const source: SourceReceipt = { sourceId: descriptor.datasetId, version: `sha256:${family.sidecarSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sidecarSha256, reference };
    return { rows: snapshot.rows, source, coverage: descriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  return { descriptor, adapter: createReferencePointDatasetAdapter(descriptor, read) };
}
const ltc = createAdapter(families.ltc); const elderly = createAdapter(families.elderly);
export const welfareLtcInstitutionsOwnerDescriptor = ltc.descriptor;
export const welfareLtcInstitutionsOwnerAdapter = ltc.adapter;
export const welfareElderlyHomesOwnerDescriptor = elderly.descriptor;
export const welfareElderlyHomesOwnerAdapter = elderly.adapter;
