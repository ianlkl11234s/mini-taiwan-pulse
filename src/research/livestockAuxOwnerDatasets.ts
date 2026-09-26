import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

type Family = {
  datasetId: string;
  layerRef: "livestockFeed" | "livestockMarket" | "livestockSlaughter";
  label: string;
  file: string;
  sidecarSha256: string;
  processedSha256: string;
  count: number;
  fields: readonly DatasetField[];
  coverage: string;
  lineage: string;
};

const common = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "facility_name", type: "string", nullable: false, nullMeaning: null, unit: null },
] as const satisfies readonly DatasetField[];
const geocode = { name: "geocode_type", type: "string", nullable: false, nullMeaning: null, unit: "Google_geocode_precision_category" } as const satisfies DatasetField;
const livestock = [
  { name: "livestock_type", type: "string", nullable: false, nullMeaning: null, unit: "source_livestock_text" },
  { name: "roster_source", type: "string", nullable: false, nullMeaning: null, unit: "source_roster_text" },
] as const satisfies readonly DatasetField[];
const geometry = { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null } as const satisfies DatasetField;

const families: readonly Family[] = [
  {
    datasetId: "tw-livestock-feed-factories-20260704-owner-only", layerRef: "livestockFeed", label: "飼料製造廠登記（owner-only 2026-07-04）",
    file: "feed-factories-owner-20260704.geojson", sidecarSha256: "cc3c6ce7f53697586f944418f7fa75a5642f8ed5a99d682a4d08d28a1bb7483f", processedSha256: "b56ce8e43fa840ec7056bfe0634b810cf3415751a061bc5983af33b62e2c11ca", count: 258,
    fields: [...common, geocode, geometry],
    coverage: "農業部 dataset 47859 製造登記證的既有處理快照：3,968 列登記品依 BAN 去重為 258 家已定位製造廠。raw CSV 收據未保留在本機；未命中不表示當地沒有飼料供應或製造設施。",
    lineage: "既有 local processed feed_factory_points.geojson SHA-256 b56c…11ca（258 Point）-> safe-field owner-only sidecar；raw CSV 的版本、checksum 與逐列授權收據未保留。sidecar 移除 BAN、地址與重複經緯度。",
  },
  {
    datasetId: "tw-livestock-markets-20260704-owner-only", layerRef: "livestockMarket", label: "肉品拍賣／批發市場（owner-only 2026-07-04）",
    file: "livestock-markets-owner-20260704.geojson", sidecarSha256: "a02fba74aea449f691a6fc376f7544636c0a26db9e926918774dd60b7791bcee", processedSha256: "ab7c4271e71aae3013750ed87109b86ceaef085f463f0667e9d36ad1e3fceb43", count: 21,
    fields: [...common, ...livestock, geocode, geometry],
    coverage: "APHIA 屠宰場名冊抽取的 21 家肉品市場既有處理快照；市場是屠宰加拍賣的子集，並非全國所有交易、零售或運銷設施。raw 名冊收據未保留在本機。",
    lineage: "既有 local processed market_points.geojson SHA-256 ab7c…eb43（21 Point）-> safe-field owner-only sidecar；APHIA raw 名冊版本、checksum 與抽取規則收據未保留。sidecar 移除地址與重複經緯度。",
  },
  {
    datasetId: "tw-livestock-slaughterhouses-20260704-owner-only", layerRef: "livestockSlaughter", label: "家畜禽屠宰場（owner-only 2026-07-04）",
    file: "slaughterhouses-owner-20260704.geojson", sidecarSha256: "16dbc25b21ea640ee4aa0dca9c43416755fdfedd227430afdc441284fe06aadd", processedSha256: "68dcbf1aff4323f8122e81cfe235aff4511f75dd7712eca9ca69eb2ff7dadb72", count: 185,
    fields: [...common, ...livestock, geocode, geometry],
    coverage: "APHIA 家畜 53、家禽 124 加台中／新竹縣／高雄市補充後 dedup 的 185 家既有處理快照。raw 名冊、版本及 dedup 收據未保留在本機；未命中不表示沒有屠宰、加工或食品安全資訊。",
    lineage: "既有 local processed slaughterhouse_points.geojson SHA-256 68dc…adb72（185 Point）-> safe-field owner-only sidecar；APHIA／縣市 raw 名冊 checksum 與精確合併收據未保留。sidecar 移除地址與重複經緯度。",
  },
];

function descriptor(family: Family): DatasetDescriptor {
  const url = `/__local-research-owner-only/livestock-aux/${family.file}`;
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label,
    description: "既有本機 Google 門牌 geocode 的固定 Point 快照。只可作 owner-only bbox 與屬性參考，沒有可公開再散布的座標權利收據，也不能回答最近、距離或可達性。",
    layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields: family.fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "Google 門牌 geocode 的參考 Point，含 ROOFTOP、APPROXIMATE、RANGE_INTERPOLATED 或 GEOMETRIC_CENTER。原始地址及逐列 geocode 收據未在 sidecar 保留；Point 不代表入口、廠區／市場邊界、實際交易或屠宰位置、最近設施、直線距離、道路、步行或 transit 可達性。", spatialAnalysisEligible: false },
    timeFields: [], coverage: family.coverage,
    license: "RIGHTS_HOLD：catalog 記錄原始名冊為 OGDL-Taiwan-1.0，但 raw receipt、來源版本與 Google-derived coordinate 的公開再散布權利未在本機逐列驗證。僅限 localhost owner-only，不可當作公開圖層或正式版同版證據。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 或篩選無 Point 可能在選集外、地址 geocode 未涵蓋或資料已過時；不能推論沒有該類設施、服務、交易、屠宰能力或供應。", stale: "2026-07-04 固定處理快照不代表目前登記、營運、開放、交易、屠宰、食品安全、產能、供應或停業狀態。" },
    versions: [{ versionId: `processed-20260704-sha256:${family.processedSha256}`, observedAt: null, availableAt: "2026-07-04", checksumSha256: family.sidecarSha256, mutable: false }],
    source: { publisher: "農業部／農業部動植物防疫檢疫署及部分縣市既有處理快照", reference: url, lineage: family.lineage },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: family.fields.map(field => field.name), filters: family.fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: Math.min(100, family.count), maxScanRows: family.count, maxSourceBytes: 512 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `${family.layerRef}-owner-reference-v1`,
  };
}

async function read(family: Family, descriptorValue: DatasetDescriptor, _parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const url = descriptorValue.source.reference;
  const snapshot = await loadPointDataset({ datasetId: descriptorValue.datasetId, url, idField: "facility_name", safeFields: descriptorValue.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== family.sidecarSha256 || snapshot.rows.length !== family.count || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error(`${family.layerRef.toUpperCase()}_OWNER_SOURCE_SEMANTICS_MISMATCH`);
  const source: SourceReceipt = { sourceId: descriptorValue.datasetId, version: `sha256:${family.sidecarSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sidecarSha256, reference: url };
  return { rows: snapshot.rows, source, coverage: descriptorValue.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

function adapter(family: Family) {
  const descriptorValue = descriptor(family);
  return { descriptor: descriptorValue, adapter: createReferencePointDatasetAdapter(descriptorValue, (parameters, signal) => read(family, descriptorValue, parameters, signal)) };
}

const feed = adapter(families[0]!);
const market = adapter(families[1]!);
const slaughter = adapter(families[2]!);
export const livestockFeedOwnerDescriptor = feed.descriptor;
export const livestockMarketOwnerDescriptor = market.descriptor;
export const livestockSlaughterOwnerDescriptor = slaughter.descriptor;
export const livestockFeedOwnerAdapter = feed.adapter;
export const livestockMarketOwnerAdapter = market.adapter;
export const livestockSlaughterOwnerAdapter = slaughter.adapter;
