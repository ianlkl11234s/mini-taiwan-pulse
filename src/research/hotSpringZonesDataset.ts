import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type PolygonGeometry } from "./spatialKernel";

const ASSET_URL = "/tourism/hot_spring_zones_national.geojson";
const PUBLIC_SHA256 = "1a5208c2f2f43e0659103a492a6eff812c9a9ced3e4845583a685ad0aee3305d";
const PROCESSED_SHA256 = "c05b9e9115188f5e5605736606efad99d6c9cf4cb3f70a8fcdc1fd9b404076f7";
const RAW_SHA256 = "420fd654b373995e309404a9719c1ba414876c8bf93a62862956e8a8ece97c74";
const BYTES = 8_109;
const ROWS = 16;
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 15_000;

type ObjectValue = Record<string, unknown>;
type Row = Record<string, unknown>;
export type HotSpringZonesFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const fields: readonly DatasetField[] = [
  { name: "zone_no", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_m2", type: "number", nullable: false, nullMeaning: null, unit: "m² (source announced area)" },
  { name: "remark", type: "string", nullable: true, nullMeaning: "來源未提供備註；不表示公告範圍、溫泉或設施不存在。", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const hotSpringZonesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-taipei-hot-spring-outcrop-zones-20260722", label: "臺北市溫泉露頭區公告範圍（2026-07-22 快照）",
  description: "臺北市政府公告溫泉露頭區範圍的 16 個固定 Polygon。面界保留公告範圍；不是全國溫泉區清單，亦不表示目前營業、入口位置、可進入性、水質或設施狀態。",
  layerRefs: ["tourHotSpringZones"], kind: "polygon", recordGrain: "feature", primaryKey: ["zone_no"], fields,
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "actual", precision: "Official Taipei outcrop-boundary LineStrings from a source archive without PRJ were assigned EPSG:3826, validated against announced DBF areas, closed and polygonized, then transformed to WGS84. The full resulting surface is retained.", spatialAnalysisEligible: true },
  timeFields: [], coverage: "16 announced hot-spring outcrop-area polygons in Taipei City only, processed 2026-07-22. Missing names or areas do not establish absence of hot springs, facilities, operating businesses, entrances, or national coverage.",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "remark=null is a source missing remark and remains null; it is never replaced with an inferred status or date.", missing: "This source covers Taipei City announced outcrop zones only. An absent place is not evidence of no hot spring or no announcement elsewhere.", stale: "The 2026-07-22 fixed processing date does not establish current operating status, access, entrance, safety, water quality, or a later legal announcement." },
  versions: [{ versionId: `public-sha256:${PUBLIC_SHA256}`, observedAt: null, availableAt: "2026-07-22", checksumSha256: PUBLIC_SHA256, mutable: false }],
  source: { publisher: "臺北市政府產業發展局", reference: "https://data.gov.tw/dataset/121214", lineage: `data.taipei dataset 121214 FY114 source ZIP sha256:${RAW_SHA256} (closed LineString EPSG:3826 without PRJ) -> validated closure and DBF announced area -> Polygon EPSG:4326 analytics hot_spring_zone_20260722.geojson sha256:${PROCESSED_SHA256} -> Mini static public asset sha256:${PUBLIC_SHA256}; Mini bytes differ from analytics formatting, with all 16 names, attributes, and full surfaces independently matched.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["zone_no", "name", "remark"], supportsBbox: true, maxRowsPerQuery: 16, maxScanRows: ROWS, maxResponseBytes: 256 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records"], adapterId: "taipei-hot-spring-outcrop-zones-fixed-v1",
};

function fail(code: string): never { throw new Error(code); }
function object(value: unknown): value is ObjectValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function digest(bytes: Uint8Array): Promise<string> { const result = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function polygon(value: unknown): PolygonGeometry { const geometry = parseSpatialGeometry(value); if (geometry.type !== "Polygon") fail("HOT_SPRING_ZONES_GEOMETRY_INVALID"); return geometry; }

/** Validates the complete browser-facing snapshot before returning any announced surface. */
export function validateHotSpringZonesSnapshot(source: unknown): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("HOT_SPRING_ZONES_COLLECTION_INVALID");
  const zoneNumbers = new Set<string>(); const nameCounts = new Map<string, number>();
  const rows = collection.features.map(feature => {
    const item = feature as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (item?.type !== "Feature" || !object(item.properties) || Object.keys(item.properties).length !== 4) fail("HOT_SPRING_ZONES_ROW_INVALID");
    const { zone_no, name, area_m2, remark } = item.properties;
    if (typeof zone_no !== "string" || !/^[A-Z]$/.test(zone_no) || zoneNumbers.has(zone_no) || typeof name !== "string" || !name
      || typeof area_m2 !== "number" || !Number.isFinite(area_m2) || area_m2 <= 0 || !(remark === null || typeof remark === "string" && remark.length > 0)) fail("HOT_SPRING_ZONES_ROW_INVALID");
    zoneNumbers.add(zone_no); nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    return { zone_no, name, area_m2, remark, geometry: polygon(item.geometry) };
  });
  if (nameCounts.get("馬槽") !== 5 || nameCounts.get("磺溪嶺") !== 3 || !nameCounts.has("硫磺谷") || !nameCounts.has("地熱谷")) fail("HOT_SPRING_ZONES_COVERAGE_INVALID");
  return rows;
}

export function createHotSpringZonesDatasetAdapter(fetcher: HotSpringZonesFetch = fetch): QueryAdapter {
  return {
    descriptor: hotSpringZonesDescriptor, allowedParameters: {},
    async read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterReadResult> {
      return withLoading("research:hot-spring-zones", "讀取溫泉露頭區公告範圍", (async () => {
        const response = await fetcher(ASSET_URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok || !response.body) fail("HOT_SPRING_ZONES_ASSET_UNAVAILABLE");
        const length = response.headers.get("content-length"); const declared = length === null ? null : Number(length);
        if (declared !== null && (!Number.isFinite(declared) || declared !== BYTES || declared > MAX_BYTES)) fail("HOT_SPRING_ZONES_ASSET_MISMATCH");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== BYTES || bytes.byteLength > MAX_BYTES || await digest(bytes) !== PUBLIC_SHA256) fail("HOT_SPRING_ZONES_SOURCE_MISMATCH");
        let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("HOT_SPRING_ZONES_JSON_INVALID"); }
        const rows = validateHotSpringZonesSnapshot(source); const acquiredAt = new Date().toISOString();
        const sourceRefs: SourceReceipt[] = [
          { sourceId: "data.gov.tw:121214", version: "FY114", checksumSha256: RAW_SHA256, reference: "https://data.gov.tw/dataset/121214", acquiredAt },
          { sourceId: "analytics:hot_spring_zone_20260722", version: "processed-2026-07-22", checksumSha256: PROCESSED_SHA256, reference: "../taipei-gis-analytics/data/processed/tourism/hot_spring_zone/hot_spring_zone_20260722.geojson", acquiredAt },
          { sourceId: hotSpringZonesDescriptor.datasetId, version: `public-sha256:${PUBLIC_SHA256}`, checksumSha256: PUBLIC_SHA256, reference: ASSET_URL, acquiredAt },
        ];
        return { rows, sourceRefs, coverage: hotSpringZonesDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
      })());
    },
  };
}

export const hotSpringZonesAdapter = createHotSpringZonesDatasetAdapter();
