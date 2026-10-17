import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/agri-wholesale-market/agri-wholesale-market-owner-20260525.geojson";
const SOURCE_SHA256 = "4f86b5385bbc6fe755dd5e277f53d40bda5fb95b21044d0a2b4ad0535990ba4e";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "row_id", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "company_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "capital_text", type: "string", nullable: false, nullMeaning: null, unit: "TWD_source_text" },
  { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "produced_at", type: "string", nullable: false, nullMeaning: null, unit: "source_datetime_text" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
export const agriWholesaleMarketOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-agri-wholesale-market-companies-owner-20260525", label: "農產品批發市場業者登記（owner-only）",
  description: "經濟部公司登記 F101061 業別固定名冊中核准設立的 53 家業者；地址經 TGOS geocode 成參考點。這不是實際市場據點、批發交易量或今日營運狀態。",
  layerRefs: ["agriWholesaleMarket"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "公司登記地址經 TGOS 轉 WGS84 的 Point，不代表批發市場設施、入口或交易地點；只做 bbox／屬性查詢，最近與可達性 HOLD。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "2026-05-22 原始 115 筆，53 筆核准設立且全數 geocoded；37 解散、24 廢止、1 撤銷不在本快照。缺列不代表當地沒有批發市場設施。來源產製日期逐筆保留。",
  license: "政府資料開放授權條款第 1 版；TGOS 地理編碼後只在本機 owner-only 查詢，公開坐標再散布與正式圖層同版仍待核。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "未命中也可能是該業別選集外或 bbox 外，並非零市場。", stale: "固定公司登記名冊不是今日核准、營運或交易證明。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-25T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部商業發展署 data.gov.tw 45640", reference: SOURCE_URL, lineage: "原 CSV SHA f69f564eefc4d77437b9d01750540af7955ab1bdb0dfa813b43fa448288dcde1 → 53 筆核准設立 TGOS geocode processed GeoJSON SHA cb53e333f57dfe1cefa8d17b606da37ff8315c6ccc85b5150b9eb8adf3764e4f → 53 筆安全欄位 owner-only sidecar；排除統編、負責人、完整地址與重複 lat/lon。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 53, maxScanRows: 53, maxSourceBytes: 100_000 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "agri-wholesale-company-owner-reference-v1",
};
async function readMarket(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: agriWholesaleMarketOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "row_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 53 || snapshot.exclusions.missing_geometry || snapshot.exclusions.invalid_geometry || snapshot.exclusions.non_point_geometry) throw new Error("AGRI_WHOLESALE_MARKET_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: agriWholesaleMarketOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: agriWholesaleMarketOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const agriWholesaleMarketOwnerAdapter = createReferencePointDatasetAdapter(agriWholesaleMarketOwnerDescriptor, readMarket);
