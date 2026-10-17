import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/geothermal-wells/geothermal-wells-owner-20260615.geojson";
const SOURCE_SHA256 = "39f0330f0e0971ba81d42e9014d50a0df05c866f287d4fe37d2139dc7aca1a7e";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "well_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geothermal_area", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "report_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "data_source_nid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const geothermalWellsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-geothermal-wells-owner-20260615", label: "中油地熱井（owner-only 2026-06-15 快照）",
  description: "中油 data.gov.tw 86147 的 36 口已列出地熱井固定快照。原始資料提供 DMS 經緯度，處理產物以可重算轉換為 WGS84 Point；可查歷史井位與名冊屬性，不表示目前探勘、施工、封井、生產、溫度、深度、壓力、安全或可進入狀態。",
  layerRefs: ["geothermalWells"], kind: "point", recordGrain: "place", primaryKey: ["well_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "中油原始 CSV 的 DMS 經緯度以公開 pipeline 的度分秒公式直接轉成 WGS84；36 筆全數可重算並與 processed 對齊。Point 可作固定快照的直線距離與 bbox 參考，但不是井筒軌跡、地熱儲層、施工範圍、入口、道路可達性或現在井況。", spatialAnalysisEligible: true },
  timeFields: [],
  coverage: "data.gov.tw 86147 的固定 2026-06-15 processed 快照共 36 口，集中於 15 個地熱區：宜蘭 20、新北 2、南投 3、臺北 2、臺東 7、花蓮 2。所有 36 筆都有有效 DMS 座標；原始有 3 筆附圖網址空白，但該欄位未對外提供。此選集不是全臺地熱資源、潛能區、所有既存鑽井或目前營運井的完整清冊。",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0），來源資料目錄記錄中油 CPC data.gov.tw dataset 86147。此 reader 只由本機 owner-only sidecar 提供，尚未建立公開前端同版收據。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox、縣市代碼或地熱區篩選沒有結果，只表示不在這 36 口固定名冊；不代表當地沒有地熱資源、探勘、鑽井或發電。", stale: "2026-06-15 fixed snapshot 不代表目前井況、鑽探、封井、生產、溫壓、深度、環境安全、開放或專案進度。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-06-15T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "台灣中油股份有限公司（CPC）", reference: SOURCE_URL, lineage: "CPC data.gov.tw dataset 86147 raw 86147.csv SHA-256 596bdfb2070d6d9a5c1485341a15da45b5ca7be4ec7d6ade1e7299cd5e304d9b（36 rows，DMS coordinate；3 blank figure_url）-> analytics geothermal_wells_20260615.geojson SHA-256 c5f1d58c04ba14250053aab0de7f5a30cb19bc3963db6fdf1a14bf6ba23abe15（36 WGS84 Point）-> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + "。sidecar 移除原始 DMS、附圖內容與外部報告／附圖 URL。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 36, maxScanRows: 36, maxSourceBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geothermal-wells-owner-fixed-point-v1",
};

async function readGeothermalWells(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: geothermalWellsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "well_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 36 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("GEOTHERMAL_WELLS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: geothermalWellsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: geothermalWellsOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const geothermalWellsOwnerAdapter = createPointDatasetAdapter(geothermalWellsOwnerDescriptor, readGeothermalWells);
