import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

type Spec = { datasetId: string; layerRef: string; label: string; url: string; sha256: string; rows: number; fields: readonly DatasetField[]; coverage: string; license: string; lineage: string; filters: readonly string[] };
const common: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
const trafficFields: readonly DatasetField[] = [
  { name: "incident_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "year", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "month", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "date", type: "string", nullable: false, nullMeaning: "固定 YYYYMMDD 原始字串；不表示可用的即時時間。", unit: null },
  { name: "time", type: "string", nullable: false, nullMeaning: "固定 HHMMSS 原始字串；不表示目前發生時間。", unit: null }, { name: "agency", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "weather", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "light", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "road_type", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "speed_limit", type: "string", nullable: false, nullMeaning: "來源文字，不轉為數值或道路限速現況。", unit: null },
  { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
];
const theftFields: readonly DatasetField[] = [
  { name: "case_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "case_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "year_raw", type: "string", nullable: false, nullMeaning: "來源混用 ROC、西元與異常值；只可讀取，禁止比較、排序、篩選或推導年份。", unit: null },
  { name: "date_raw", type: "string", nullable: false, nullMeaning: "來源日期字串品質未逐列驗證，不解析為時間欄位或日期篩選。", unit: null },
  { name: "district_raw", type: "string", nullable: false, nullMeaning: "1,423 筆均為空字串；不是未知區域，也不能依座標回填。", unit: null },
  { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
];
const specs: readonly Spec[] = [
  { datasetId: "tw-traffic-a1-fatal-incidents-owner-20260626", layerRef: "trafficAccidentYearly", label: "A1 死亡交通事故（owner-only 2025）", url: "/__local-research-owner-only/police-justice-historical/traffic-accident-yearly-owner-20260626.geojson", sha256: "7381ad9f678d19accc9d02b7f1cb67d4b63bc47b402ab980402b12e91e1a7dc4", rows: 1600, fields: [...common, ...trafficFields], filters: ["incident_id", "year", "month", "agency", "weather", "light", "road_type", "speed_limit", "facility_subtype", "source"], coverage: "2025 年全國 A1（24 小時內死亡）事故固定快照 1,600 Point；A2 與 6,132 筆歷年重大事故未納入。location 地址不在 sidecar。", license: "警政署 data.gov.tw 177136 標示 OGDL-Taiwan-1.0；精確歷史事故位置僅 localhost owner-only，不能作目前事故、道路安全、即時路況或公開地圖聲明。", lineage: "raw npa_114_injury_177136.zip SHA-256 bb589b97b9473b639be262183b6f2e6b256b0f52c6c28ae1770214c62bdea99e -> processed traffic_accident_yearly_20260626.geojson SHA-256 732c01d31864741b482cec34fca8952d41fca56a0ceb8c9f2eff4854516f0fb4 (1,600 deduplicated A1 Point) -> safe owner-only sidecar SHA-256 7381ad9f678d19accc9d02b7f1cb67d4b63bc47b402ab980402b12e91e1a7dc4. Mini declared display asset is missing, therefore DISPLAY_HOLD." },
  { datasetId: "tw-taoyuan-theft-incidents-owner-20260626", layerRef: "theftTaoyuan", label: "桃園竊盜事件（owner-only 歷史快照）", url: "/__local-research-owner-only/police-justice-historical/theft-taoyuan-owner-20260626.geojson", sha256: "fc30d85d930c2c4e93bbbebb0ef94dbcd8d2afdbfe268ae98341482601e9c6e3", rows: 1423, fields: [...common, ...theftFields], filters: ["case_id", "case_type", "facility_subtype", "source"], coverage: "桃園 1,423 個歷史竊盜 Point：住宅 615、機車 565、自行車 175、汽車 68。district_raw 全部空字串；year_raw 混用 ROC、西元與異常值，不能用於年份比較或篩選。", license: "桃園市 data.gov.tw 167673 標示 OGDL-Taiwan-1.0；精確犯罪點只供 localhost owner-only，不能主張現在治安、事件發生率或公開地圖。", lineage: "raw theft_167673.csv SHA-256 20ff5ed3f07afd711ef2b0586c3127b17503c36403959163626b05ac527ba657 -> processed theft_points_taoyuan_20260626.geojson SHA-256 3e60392a46a65efd06bbc4b9803713908bab44b98b3930e5ac4709d461e69572 (1,423 Point) -> safe owner-only sidecar SHA-256 fc30d85d930c2c4e93bbbebb0ef94dbcd8d2afdbfe268ae98341482601e9c6e3. Mini declared display asset is missing, therefore DISPLAY_HOLD." },
];

function descriptor(spec: Spec): DatasetDescriptor {
  return { schemaVersion: "pulse-dataset/0.1", datasetId: spec.datasetId, label: spec.label, description: `${spec.coverage} 固定歷史敏感位置只可作 bounded owner-only bbox／屬性參考。`, layerRefs: [spec.layerRef], kind: "point", recordGrain: "event", primaryKey: [spec.fields.some(field => field.name === "incident_id") ? "incident_id" : "case_id"], fields: spec.fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "原表有經緯度，但精確歷史事故與犯罪位置在本 reader 一律降為 proxy；只能 bbox 與屬性查詢，不能主張最近、距離、入口、服務範圍、道路可達性或地圖呈現。", spatialAnalysisEligible: false }, timeFields: [], coverage: spec.coverage, license: spec.license,
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果不是沒有事故、犯罪、受害或道路風險。", null: "缺值依個別欄位定義保留，不以零值或行政區中心補點。", stale: "2026-06-26 的處理快照與其歷史事件不是目前事故、犯罪、道路狀況或治安指標。" }, versions: [{ versionId: `sha256:${spec.sha256}`, observedAt: null, availableAt: "2026-06-26T00:00:00+08:00", checksumSha256: spec.sha256, mutable: false }], source: { publisher: spec.datasetId.includes("traffic") ? "內政部警政署" : "桃園市政府", reference: spec.url, lineage: spec.lineage }, access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: spec.fields.map(field => field.name), filters: spec.filters, supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: spec.rows, maxSourceBytes: 1024 * 1024 }), supportedOperations: spec.layerRef === "theftTaoyuan" ? ["query_records"] : ["query_records", "aggregate"], adapterId: `${spec.datasetId}-proxy-v1` };
}
export const trafficAccidentYearlyOwnerDescriptor = descriptor(specs[0]!);
export const theftTaoyuanOwnerDescriptor = descriptor(specs[1]!);
async function read(spec: Spec, descriptorValue: DatasetDescriptor, idField: string, _parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: descriptorValue.datasetId, url: spec.url, idField, safeFields: spec.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== spec.sha256 || snapshot.rows.length !== spec.rows || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("POLICE_JUSTICE_HISTORICAL_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: descriptorValue.datasetId, version: `sha256:${spec.sha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: spec.sha256, reference: spec.url };
  return { rows: snapshot.rows, source, coverage: descriptorValue.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const trafficAccidentYearlyOwnerAdapter = createReferencePointDatasetAdapter(trafficAccidentYearlyOwnerDescriptor, (parameters, signal) => read(specs[0]!, trafficAccidentYearlyOwnerDescriptor, "incident_id", parameters, signal));
export const theftTaoyuanOwnerAdapter = createReferencePointDatasetAdapter(theftTaoyuanOwnerDescriptor, (parameters, signal) => read(specs[1]!, theftTaoyuanOwnerDescriptor, "case_id", parameters, signal));
