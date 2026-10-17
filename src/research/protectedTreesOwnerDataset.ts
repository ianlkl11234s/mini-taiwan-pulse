import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/protected-trees/protected-trees-owner-20260714.geojson";
const SOURCE_SHA256 = "27ee4336fac481b1bba5ff95db5e1699db11de97d40bc597a06e7643bcd88597";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "tree_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "species", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "species_scientific", type: "string", nullable: true, nullMeaning: "來源未提供學名；不是未知或不存在的樹種。", unit: null },
  { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區；不是未定位。", unit: null },
  { name: "dbh_m", type: "number", nullable: true, nullMeaning: "來源未提供胸徑；不是 0 公尺。", unit: "m" },
  { name: "girth_m", type: "number", nullable: true, nullMeaning: "來源未提供樹圍；不是 0 公尺。", unit: "m" },
  { name: "height_m", type: "number", nullable: true, nullMeaning: "來源未提供樹高；不是 0 公尺。", unit: "m" },
  { name: "crown_area_m2", type: "number", nullable: true, nullMeaning: "來源未提供樹冠面積；不是 0 平方公尺。", unit: "m²" },
  { name: "estimated_age_years", type: "number", nullable: true, nullMeaning: "來源未提供估計樹齡；不是 0 年。", unit: "year" },
  { name: "manager", type: "string", nullable: true, nullMeaning: "來源未提供管理單位；不能推論沒有管理者。", unit: null },
  { name: "status", type: "string", nullable: true, nullMeaning: "來源未提供列管狀態；不能推論未列管、死亡或移除。", unit: null },
  { name: "source_nid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const protectedTreesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-protected-trees-owner-20260714", label: "受保護樹木（owner-only 2026-07-14 快照）",
  description: "8 個縣市受保護／珍貴老樹名冊的固定合併快照，6,544 個有效 Point。各城市來源 URL 與授權未逐一驗證，僅可在本機 owner-only 作參考位置與屬性查詢，不是全國完整清冊或目前列管狀態。",
  layerRefs: ["protectedTreesNational"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "8 城原始資料混用 WGS84 與 TWD97，既有 pipeline 正規化為 Point。因各原始來源 URL、授權及座標精度未逐一驗證，只供 owner-only bbox／屬性參考；不得主張最近樹木、精確距離、現地樹位、樹冠範圍、存活狀態或可達性。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "固定 2026-07-14 快照只含台北市 3,874、新北市 996、桃園市 595、高雄市 717、新竹市 104、新竹縣 53、嘉義縣 92、花蓮縣 113，共 6,544 Point。上游 6,670 列有 126 筆無效座標被排除；未命中不表示沒有受保護樹木。台中、台南、澎湖與額外新竹市來源未納入，不能稱全國完整。保留 null：district 5,640、height_m 5,616、crown_area_m2 6,317、estimated_age_years 5,236、status 5,548、manager 2,369、dbh_m 936、species_scientific 1,674、girth_m 749。",
  license: "HOLD_LICENSE：catalog 僅記錄各縣市為 OGDL-Taiwan-1.0 或同等授權，未逐一驗證原始來源 URL 與授權；不公開發布或宣稱可再散布，僅限本機 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "各欄位 null 為來源未提供，依欄位定義保留；不得改成 0、未知類別或目前狀態。", missing: "bbox 或城市篩選無結果可能在 8 城範圍外、126 筆無效座標排除，或屬於未納入城市／來源；不代表沒有受保護樹木。", stale: "2026-07-14 固定快照不代表目前列管、存活、移除、修剪、健康、保護狀態或現地存在。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-14", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "台北、新北、桃園、高雄、新竹市、新竹縣、嘉義縣、花蓮縣政府既有快照", reference: SOURCE_URL, lineage: "8 城 raw CSV/JSON snapshots（原始 URL／授權未逐一記錄或驗證）-> taipei-gis-analytics protected_trees_national_20260714.geojson SHA-256 197651e6bc1db78ae1fc6e87d8e3ce698fb5f25bfbccbb516b2e47ff2c340549（6,544 Point；126 無效座標排除）-> byte-identical Mini public asset -> safe-field owner-only sidecar SHA-256 27ee4336fac481b1bba5ff95db5e1699db11de97d40bc597a06e7643bcd88597；sidecar 移除 address 與重複 lat/lon，保留所有非敏感欄位及 null。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 6_544, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "protected-trees-owner-reference-v1",
};

async function readProtectedTrees(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: protectedTreesOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "tree_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) throw new Error("PROTECTED_TREES_OWNER_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 6_544 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("PROTECTED_TREES_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: protectedTreesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: protectedTreesOwnerDescriptor.coverage, freshness: "stale", exclusions: { upstream_invalid_coordinates: 126, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const protectedTreesOwnerAdapter = createReferencePointDatasetAdapter(protectedTreesOwnerDescriptor, readProtectedTrees);
