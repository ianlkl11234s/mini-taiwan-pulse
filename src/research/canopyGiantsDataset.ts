import {
  boundedAccess,
  DEFAULT_VALUE_SEMANTICS,
  type DatasetDescriptor,
  type DatasetField,
  type Scalar,
  type SourceReceipt,
} from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/forestry/canopy_giants_taiwan.geojson";
const SOURCE_SHA256 = "2b050b7c7d1ccb0391dd867a9c3398f7d4bafbe2a8f863f5f4d4df03bcc01e4d";
const SOURCE_COUNT = 7_823;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "height_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "dist_access_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "elev_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const canopyGiantsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1",
  datasetId: "tw-canopy-giants-20260724",
  label: "樹冠巨木（2026-07-24 固定衍生快照）",
  description: "7,823 個 45–85m、鄰域支持度已過濾的 Meta/WRI 10m 樹冠高度像素；可依 bbox 與三個公開衍生屬性查詢。",
  layerRefs: ["canopyGiants"],
  kind: "point",
  recordGrain: "place",
  primaryKey: ["record_id"],
  fields,
  geometry: {
    type: "Point",
    crs: "EPSG:4326",
    role: "proxy",
    precision: "座標是 EPSG:3857 的 10m 樹冠高度 raster cell center 轉 WGS84 並四捨五入至小數 5 位的衍生 Point；代表通過鄰域支持篩選的高樹冠像素，不是可辨識單株、樹幹、入口或道路可達位置。",
    spatialAnalysisEligible: false,
  },
  timeFields: [],
  coverage: "Meta/WRI Global Canopy Height Map v2（DINOv3）台灣本島 10m 樹冠高度的 2026-07-24 固定衍生快照：45–85m 像素經 5×5 鄰域中至少 30% 為 >=30m 樹冠的條件保留，共 7,823 Point。此範圍不涵蓋外島；bbox 無結果不代表沒有巨木、森林或可及路線。",
  license: "CC BY 4.0；使用時保留 Meta AI (Data for Good) × World Resources Institute（Tolan et al., 2024）署名。",
  valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "bbox 無列可能是本島覆蓋外、45m 以下、85m 以上被排除、未通過鄰域支持條件或 bbox 外；不是沒有樹木或森林。",
    stale: "2026-07-24 固定衍生快照，不代表目前樹高、樹況、倒伏、封閉、步道或林道狀態。",
  },
  versions: [{
    versionId: `20260724-canopy-giants-sha256:${SOURCE_SHA256}`,
    observedAt: null,
    availableAt: "2026-07-24",
    checksumSha256: SOURCE_SHA256,
    mutable: false,
  }],
  source: {
    publisher: "Meta AI (Data for Good) × World Resources Institute",
    reference: SOURCE_URL,
    lineage: "Meta/WRI Global Canopy Height Map v2 (DINOv3) Taiwan-main-island 10m raster -> retain 45–85m pixels -> remove isolated spikes by 5×5 neighboring canopy support -> accessibility distance and DEM elevation attributes -> Mini display GeoJSON SHA-256 2b050b7c…01e4 (7,823 Point).",
  },
  access: boundedAccess({
    mode: "public",
    method: "static_asset",
    fields: fields.map(field => field.name),
    filters: ["height_m", "dist_access_m", "elev_m"],
    supportsBbox: true,
    maxRowsPerQuery: 100,
    maxScanRows: SOURCE_COUNT,
    maxSourceBytes: 2 * 1024 * 1024,
  }),
  supportedOperations: ["query_records", "aggregate"],
  adapterId: "canopy-giants-reference-v1",
};

async function readCanopyGiants(
  _parameters: Readonly<Record<string, Scalar>>,
  signal?: AbortSignal,
  context?: { bbox?: readonly [number, number, number, number] },
): Promise<AdapterSnapshot> {
  if (!context?.bbox) throw new Error("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({
    datasetId: canopyGiantsDescriptor.datasetId,
    url: SOURCE_URL,
    idField: "record_id",
    safeFields: fields.map(field => field.name).filter(name => name !== "record_id" && name !== "geometry"),
  }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== SOURCE_COUNT
    || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) {
    throw new Error("CANOPY_GIANTS_SOURCE_SEMANTICS_MISMATCH");
  }
  const source: SourceReceipt = {
    sourceId: canopyGiantsDescriptor.datasetId,
    version: `sha256:${SOURCE_SHA256}`,
    acquiredAt: snapshot.acquiredAt,
    checksumSha256: SOURCE_SHA256,
    reference: SOURCE_URL,
  };
  return {
    rows: snapshot.rows,
    source,
    coverage: canopyGiantsDescriptor.coverage,
    freshness: "stale",
    exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length,
    bytesScanned: snapshot.bytes,
    downloadedBytes: snapshot.downloadedBytes,
    requests: snapshot.requests,
    cacheHit: snapshot.cacheHit,
  };
}

export const canopyGiantsAdapter = createReferencePointDatasetAdapter(canopyGiantsDescriptor, readCanopyGiants);
