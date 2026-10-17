import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/geo/service_area_polygon.geojson";
const SHA = "c9f2a462c30ecbfd99fec7f15cd55371112add6ece074a76a881db4186fd84a8";
const RAW_OSM_SHA = "9047b532d2ac1425735d278a7ed91dff573264a488be8c0f8c869882f29df863";
const BYTES = 24_463;
const MAX_BYTES = 64 * 1024;
const fields: readonly DatasetField[] = [
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "freeway", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "direction", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha" },
  { name: "osm_id", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "osm_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const serviceAreaPolygonDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-service-area-osm-surfaces-20260524", label: "國道服務區 OSM 面範圍（固定快照）",
  description: "OSM highway=services 原面與高速公路局服務區屬性連結的固定快照，19 個面。bbox 查詢使用完整面真實相交；不代表入口、目前營運或道路可達性。",
  layerRefs: ["serviceAreaPolygon"], kind: "polygon", recordGrain: "feature", primaryKey: ["osm_type", "osm_id"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "OSM 社群繪製服務區佔地參考邊界；原 Polygon 包成單部件 MultiPolygon，保留完整面、洞與多部件；精度依原始繪製而異。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "2026-05-24 本地固定快照，19 個 OSM 面（18 Polygon、1 MultiPolygon）；與官方 22 個服務區點母體不同，查無面不等於無服務區。",
  license: "OSM 幾何 © OpenStreetMap contributors，ODbL 1.0；高速公路局屬性 data.gov.tw:8161 為 OGDL-Taiwan-1.0。再利用應遵守各自署名與條款。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "19 個面只涵蓋已辨識 OSM highway=services 的範圍；未匹配面不是零服務區。", stale: "2026-05-24 固定處理日不是 OSM 每筆編輯日，也不證明當前營運商、設施或入口狀態。" },
  versions: [{ versionId: `sha256:${SHA}`, observedAt: null, availableAt: "2026-05-24", checksumSha256: SHA, mutable: false }],
  source: { publisher: "© OpenStreetMap contributors；交通部高速公路局", reference: "https://www.openstreetmap.org/copyright", lineage: `OSM Overpass highway=services raw SHA ${RAW_OSM_SHA} + data.gov.tw:8161 service-area Point attributes -> analytics processed 20260524 GeoJSON -> byte-identical Mini display SHA ${SHA}. OSM surface and official location points are not one-to-one.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["name", "freeway", "direction", "osm_type", "osm_id"], supportsBbox: true, maxRowsPerQuery: 19, maxScanRows: 19, maxSourceBytes: MAX_BYTES, maxResponseBytes: 256 * 1024, timeoutMs: 15_000 }),
  supportedOperations: ["query_records"], adapterId: "service-area-osm-surfaces-fixed-v1",
};

function fail(code: string): never { throw new Error(code); }
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function multi(value: unknown): Record<string, unknown> {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("SERVICE_AREA_SURFACE_GEOMETRY_INVALID");
}

export const serviceAreaPolygonAdapter: QueryAdapter = {
  descriptor: serviceAreaPolygonDescriptor, allowedParameters: {},
  read: (_parameters, signal): Promise<AdapterReadResult> => withLoading("research:service-area-polygon", "國道服務區面範圍", (async () => {
    const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) fail("SERVICE_AREA_SURFACE_UNAVAILABLE");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) fail("SERVICE_AREA_SURFACE_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== BYTES || bytes.byteLength > MAX_BYTES || await sha256(bytes) !== SHA) fail("SERVICE_AREA_SURFACE_SOURCE_MISMATCH");
    const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 19) fail("SERVICE_AREA_SURFACE_COLLECTION_INVALID");
    const ids = new Set<string>();
    const rows = collection.features.map(raw => {
      const feature = raw as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown };
      const p = feature.properties;
      if (feature.type !== "Feature" || !p || typeof p.Name !== "string" || !p.Name || typeof p.Freeway !== "string" || !p.Freeway || typeof p.Direction !== "string" || !p.Direction || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha) || p.area_ha < 0 || typeof p.osm_id !== "number" || !Number.isSafeInteger(p.osm_id) || !["way", "relation"].includes(String(p.osm_type))) fail("SERVICE_AREA_SURFACE_ROW_INVALID");
      const id = `${p.osm_type}:${p.osm_id}`;
      if (ids.has(id)) fail("SERVICE_AREA_SURFACE_DUPLICATE_ID");
      ids.add(id);
      return { name: p.Name, freeway: p.Freeway, direction: p.Direction, area_ha: p.area_ha, osm_id: p.osm_id, osm_type: p.osm_type, geometry: multi(feature.geometry) };
    });
    const sourceRefs: SourceReceipt[] = [{ sourceId: serviceAreaPolygonDescriptor.datasetId, version: `sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: new Date().toISOString() }];
    return { rows, sourceRefs, coverage: serviceAreaPolygonDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: 19, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
  })()),
};
