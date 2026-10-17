import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/ports/ports-owner-20260527.geojson";
const SOURCE_SHA256 = "2c64fa271b2c48b741a268ce21f4e9a96f0a79ad7882e0a34d730cac079b864c";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "port_uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "port_class_group", type: "string", nullable: true, nullMeaning: "六筆對岸港口不屬臺灣四桶分類；不是未知港口或零港口。", unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_id", type: "string", nullable: true, nullMeaning: "六筆對岸港口沒有臺灣縣市代碼；不可歸為臺灣某縣市。", unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const portsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-ports-reference-owner-20260527", label: "港口參考點（owner-only 2026-05-27）",
  description: "農業部漁港與 TDX 商港／渡輪碼頭合併後的 277 個固定參考 Point。既有 ports 地圖使用另一份 277 Polygon 展示資產，尚未核其版次與港界來源；此 reader 不查港區面或海域邊界。",
  layerRefs: ["ports"], kind: "point", recordGrain: "place", primaryKey: ["port_uid"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "上游合併的港口代表座標；不表示碼頭入口、港區 polygon、泊位、可通航水域、航路、航行距離或目前營運。只能依參考位置做 bbox／屬性查詢。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-05-27 固定來源 277 Point：漁港 239、渡輪觀光碼頭 18、國際商港 7、國內商港 7、另有對岸 6 筆沒有臺灣 county_id 與四桶類別。來源標籤農業部 204、TDX 38、農業部+TDX 35。bbox 無結果不證明沒有港口。",
  license: "analytics catalog 記錄 OGDL-Taiwan-1.0，TDX 合併點的公開再散布收據與既有港區 polygon 來源同版仍待核；僅供 localhost owner-only 查詢。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "六筆對岸港口的臺灣 county_id／四桶類別缺值需保留；bbox 空結果不是零港口或無航運服務。", stale: "固定 2026-05-27 名冊不是今日泊位、航線、營運或可通航狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-27", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "農業部漁業署與交通部 TDX", reference: SOURCE_URL, lineage: "analytics ports_20260527.geojson SHA-256 80c46fd597679cbe717e2b24ac011b44b42a3514420ff4d6508fccab2c65479c (277 Point) -> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + "。sidecar 去除電話、英文名、原始 properties、重複經緯度；港區 polygon 展示檔 SHA b6163441f470f392ca94b0ee29f422fe0529eeb8c473e22c1934bf5d62a10518 未證明與此 Point 同源同版。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["port_uid", "name", "port_class_group", "county", "county_id", "source"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 277, maxSourceBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "ports-owner-reference-point-v1",
};

async function readPorts(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: portsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "port_uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 277 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("PORTS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: portsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: portsOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const portsOwnerAdapter = createReferencePointDatasetAdapter(portsOwnerDescriptor, readPorts);
