import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/forestry/wildlife_distribution_3rd.geojson";
const SOURCE_SHA256 = "57f6cc342ab104804899af83b5c023e5b5555babd12c281479fd99b8ef01af48";
const SOURCE_COUNT = 1_241;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "RECORDNO", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "WILDLIFE_", type: "number", nullable: false, nullMeaning: "來源沒有說明此唯一流水值是物種、數量或觀測值；不得據此推論任何一種動物出現或其數量。", unit: null },
  { name: "PERIMETER", type: "number", nullable: false, nullMeaning: "所有列均為 0；原始欄位沒有語意文件，不能把它當作零範圍、零長度或零動物。", unit: null },
  { name: "TM2X", type: "string", nullable: false, nullMeaning: null, unit: "TWD97 TM2 m (source text)" },
  { name: "TM2Y", type: "string", nullable: false, nullMeaning: null, unit: "TWD97 TM2 m (source text)" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const forestWildlifeReferenceDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1",
  datasetId: "tw-forest-wildlife-reference-20260607",
  label: "第三次森林資源調查野生動物分布（參考格網快照）",
  description: "林業及自然保育署 data.gov.tw 38126 的 1,241 個固定處理 Point。欄位沒有物種、個體數或觀測日期，TM2X/TM2Y 顯示調查格網／代表座標；僅可作 owner-only bbox 與原始欄位查找，不能當作實際動物位置或目前分布。",
  layerRefs: ["forestWildlife"],
  kind: "point",
  recordGrain: "place",
  primaryKey: ["record_id"],
  fields,
  geometry: {
    type: "Point",
    crs: "EPSG:4326",
    role: "proxy",
    precision: "既有處理產物把第三次森林資源調查的 TM2X/TM2Y 格網／代表座標轉為 WGS84 Point。來源 TM2 值多呈 500m 級格網，亦有較細或不規則偏移；未取得逐筆原始轉換與格網邊界收據。Point 只可用於參考 bbox／屬性篩選，不能主張最近野生動物、直線距離、實際出沒位置、族群範圍、現況或可達性。",
    spatialAnalysisEligible: false,
  },
  timeFields: [],
  coverage: "固定處理快照共 1,241 Point，全部 Geometry 為有效 Point，所有欄位非 null；RECORDNO 與 WILDLIFE_ 各為 1,241 個唯一值，TM2X/TM2Y 組合有 176 個重複格網位置（最大 9 筆）。資料目錄標示 2026-06-07 ingest，processed manifest 的 last_updated 為 2026-05-19，但不是調查或動物觀測日期。bbox 無結果不代表當地沒有野生動物、棲地或調查。",
  license: "政府資料開放授權條款-第1版（data.gov.tw/dataset/38126）。SOURCE_LINEAGE_HOLD：本機可驗 Mini 固定處理 GeoJSON，但本次沒有可核對的 immutable raw checksum、原始資源版本或逐筆座標轉換收據；僅限 owner-only 參考查詢，不升格為完整、最新或精確空間分析資料。",
  valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "bbox 或欄位篩選沒有列，可能是固定快照不含該格網、調查範圍外或來源未涵蓋；不代表沒有動物、棲地或調查。",
    zero: "PERIMETER=0 是來源欄位值，來源未說明其量測語意；不能解讀為零範圍、零長度或零動物。",
    stale: "資料目錄的 2026-05/06 處理時間不等於調查或觀測時間。固定快照不代表目前動物出沒、數量、保育狀態、棲地品質或通行狀態。",
  },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-06-07T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: {
    publisher: "農業部林業及自然保育署",
    reference: SOURCE_URL,
    lineage: "data.gov.tw/dataset/38126（第三次森林資源調查野生動物分佈；OGDL-Taiwan-1.0）-> taipei-gis-analytics wildlife_distribution_3rd processed GeoJSON（1,241 Point；目錄 last_updated 2026-05-19、ingest 2026-06-07）-> Mini static asset SHA-256 57f6cc342ab104804899af83b5c023e5b5555babd12c281479fd99b8ef01af48. SOURCE_LINEAGE_HOLD: no immutable raw checksum, source resource revision, coordinate transform receipt, grid boundary, species mapping, count definition, or observation date was available for this reader.",
  },
  access: boundedAccess({
    mode: "owner_only",
    method: "static_asset",
    fields: fields.map(field => field.name),
    filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name),
    supportsBbox: true,
    maxRowsPerQuery: 100,
    maxScanRows: SOURCE_COUNT,
    maxSourceBytes: 2 * 1024 * 1024,
  }),
  supportedOperations: ["query_records", "aggregate"],
  adapterId: "forest-wildlife-reference-v1",
};

async function readForestWildlife(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({
    datasetId: forestWildlifeReferenceDescriptor.datasetId,
    url: SOURCE_URL,
    idField: "RECORDNO",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)),
  }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== SOURCE_COUNT
    || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) {
    throw new Error("FOREST_WILDLIFE_REFERENCE_SOURCE_MISMATCH");
  }
  const source: SourceReceipt = {
    sourceId: forestWildlifeReferenceDescriptor.datasetId,
    version: `sha256:${SOURCE_SHA256}`,
    acquiredAt: snapshot.acquiredAt,
    checksumSha256: SOURCE_SHA256,
    reference: SOURCE_URL,
  };
  return {
    rows: snapshot.rows,
    source,
    coverage: forestWildlifeReferenceDescriptor.coverage,
    freshness: "stale",
    exclusions: { source_lineage_hold: 1, duplicate_tm2_grid_locations: 176, ...snapshot.exclusions },
    rowsScanned: snapshot.rows.length,
    bytesScanned: snapshot.bytes,
    downloadedBytes: snapshot.downloadedBytes,
    requests: snapshot.requests,
    cacheHit: snapshot.cacheHit,
  };
}

export const forestWildlifeReferenceAdapter = createReferencePointDatasetAdapter(forestWildlifeReferenceDescriptor, readForestWildlife);
