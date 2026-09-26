import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/water-detention-basins/water-detention-basins-owner-20260511.geojson";
const SOURCE_SHA256 = "c2e6713f17b24cc3c792704b486508a6c34ba2c826da8fa50bcc686fd3dad01c";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "basin_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "basin_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_m2", type: "number", nullable: true, nullMeaning: "桃園 11 筆原始名冊沒有面積欄位；不是零面積或沒有滯洪能力。", unit: "m2" },
  { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: "data.gov.tw dataset id" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const waterDetentionBasinsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-water-detention-basins-owner-20260511", label: "臺南、桃園滯洪池名冊（owner-only 2026-05-11 快照）",
  description: "data.gov.tw 108523 的臺南 45 筆與 152950 的桃園 11 筆可定位滯洪池。既有顯示 GeoJSON 與本 reader 同一 SHA 的 56 個 Point；其他來源名冊尚未有幾何，不在本 reader 內。",
  layerRefs: ["waterDetentionBasins"], kind: "point", recordGrain: "place", primaryKey: ["basin_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "臺南原始 TM97 X/Y 由既有 pipeline 轉 WGS84，桃園原始資料提供 WGS84。資料沒有池界 polygon、入口、深度、容量、測量精度或現況驗收；Point 僅可作固定名冊 bbox 與屬性參考。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-05-11 固定本機快照 56 筆：臺南 45、桃園 11。資料總表另有高雄、臺北、臺中與科學園區等紀錄，但那些列無幾何或是事件／統計資料，未混入。bbox 無結果不代表當地沒有滯洪池、蓄洪設施或防洪能力。",
  license: "上游 data catalog 記載資料來源為 data.gov.tw 108523、152950，授權為 OGDL-Taiwan-1.0；本 reader 維持 localhost owner-only，尚無公開發布或遠端同版 readback 收據。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "area_m2 的 null 專指桃園 11 筆來源未提供面積；不代表零面積、容量、狀態或防洪服務。所有 56 筆的 township、status、designed_volume_m3、current_volume_m3、max_depth_m 都沒有來源值，故沒有輸出。", stale: "2026-05-11 fixed snapshot 不是目前水位、可用容量、清淤、施工、維修、警戒、淹水風險、進入條件或防洪服務證據。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-11T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺南市政府水利局與桃園市政府水務局", reference: SOURCE_URL, lineage: "data.gov.tw 108523 台南 raw SHA-256 df2521430f8a76f204361e9c5300cfa83d1f5c0efa010c4f9ef7ff41333f2aab（45 rows, TM97） + 152950 桃園 raw SHA-256 7644ebf0dcec99ffcfb9621c612540874ae43237eceb4a72db5d8188a721a132（11 rows, WGS84） -> water pipeline fixed display GeoJSON SHA-256 6dd46deca47a13b479ad8dede339eb1c4e14c0540b08b5b3472e1d6fc250686a（56 Point） -> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + "。sidecar 移除地址、管理機關與未驗證狀態／容量欄位。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["basin_id", "name", "county", "basin_type", "area_m2", "source_dataset_id"], supportsBbox: true, maxRowsPerQuery: 56, maxScanRows: 56, maxSourceBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "water-detention-basins-owner-reference-point-v1",
};

async function readWaterDetentionBasins(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: waterDetentionBasinsDescriptor.datasetId, url: SOURCE_URL, idField: "basin_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 56 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("WATER_DETENTION_BASINS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: waterDetentionBasinsDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: waterDetentionBasinsDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const waterDetentionBasinsAdapter = createReferencePointDatasetAdapter(waterDetentionBasinsDescriptor, readWaterDetentionBasins);
