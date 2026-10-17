import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/cultural-museums/cultural-museums-owner-20260716.geojson";
const SOURCE_SHA256 = "5b6d23839afaba52d1eec098bdff2417a37755def4e46e81df653084535dea09";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "museum_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name_eng", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: true, nullMeaning: "文化部原始列未提供地址，pipeline 留為 no_coord；不代表地方文化館不存在、閉館或不在該縣市", unit: null },
];

export const culturalMuseumsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-local-cultural-museums-owner-20260716", label: "地方文化館名冊（owner-only 2026-07-16 快照）",
  description: "文化部 emap typeId=C 的 266 筆地方文化館固定名冊。來源經緯度皆空，252 個 Point 是 pipeline 以 offline 與 Google 地理編碼補回的參考位置；僅可依參考位置 bbox 篩選，禁止最近距離、入口、道路可達性或服務範圍主張。",
  layerRefs: ["culturalMuseums"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "266 筆官方名冊的來源 latitude/longitude 皆為空字串。252 筆 reference Point：offline_l2 138（exact）、google 80（exact 或 approximate）、offline_l15 24（interpolated）、offline_l1 10（cached）；14 筆 no_coord 為 geometry=null。Google 座標再散布權利未完成公開審核；任何 Point 都不保證館舍入口、實際邊界、道路可達性或最近距離。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-07-16 固定地方文化館快照 266 筆，原始 emap 坐標全空。252 筆有後續地理編碼參考 Point、14 筆因來源無地址保持 no_coord；city 有 22 筆原始 cityName 空值時由地址前綴補入。這是名冊快照，更新頻率不定期，不能代表目前開館、展覽、服務或館舍存續狀態。既有 display asset 的 252 Point 與此 processed 快照的全部有幾何列逐筆對齊；display 缺少 14 筆 null geometry，兩者不可混為同一完整點位母體。",
  license: "原始名冊：政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；含 80 筆 Google geocode 參考座標，公開再散布權利未完成審核，因此本 reader 僅 owner-only。",
  valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-16T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "文化部 emap 地方文化館（typeId=C；data.gov.tw 6244）", reference: SOURCE_URL, lineage: "文化部 emap raw 20260716 JSON SHA e57dc9f32d63a3456b433395a5d13d64bf3ba09dac8dacf627ff4c602c9fd891（266 rows、latitude/longitude 全空）-> processed local_cultural_museums_moc_20260716.geojson SHA 33d38a6ea41a4d04882f67a57cb32a537c1cdf1cbf98d84bdc287da7a36a932d（252 Point、14 null；逐列 source/precision）-> owner-only safe-field sidecar SHA/count/alignment validation。public display local_cultural_museums_national.geojson SHA 5f283e24f90e1ae1e53711762a80b438ea259b0b53b1aeb534b38faed49b452e 僅含對齊的 252 Point；公開再散布維持 HOLD。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 266, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "cultural-museums-owner-reference-point-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readCulturalMuseumsOwner(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({
    datasetId: culturalMuseumsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "museum_id",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), preserveUnlocatedRecords: true,
  }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("CULTURAL_MUSEUMS_OWNER_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 266 || snapshot.exclusions.missing_geometry !== 14 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("CULTURAL_MUSEUMS_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: culturalMuseumsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: culturalMuseumsOwnerDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const culturalMuseumsOwnerAdapter = createReferencePointDatasetAdapter(culturalMuseumsOwnerDescriptor, readCulturalMuseumsOwner);
