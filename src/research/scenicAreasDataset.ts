import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/tourism/national_scenic_areas_national.geojson";
const SHA = "9910b7329a361247989b91f50ebda63762e557411eae13dda6f1ead997384e38";
const BYTES = 200_445;
const COUNT = 12;
const fields = ["name", "category", "manager", "area_km2", "geometry"] as const;

export const scenicAreasDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-national-scenic-areas-20260524", label: "國家風景區（固定面快照）",
  description: "觀光署國家風景區 12 個 MultiPolygon 固定展示資產；不含森林遊樂區。",
  layerRefs: ["tourScenicAreas"], kind: "polygon", recordGrain: "feature", primaryKey: ["name"],
  fields: [
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "manager", type: "string", nullable: true, nullMeaning: "來源未提供管理機關；不是無管理機關。", unit: null },
    { name: "area_km2", type: "number", nullable: false, nullMeaning: null, unit: "km²" },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "固定 GeoJSON 面幾何；沿用處理產物的 EPSG:4326 MultiPolygon，精度依來源。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "2026-05-24 固定展示資產 12 個 national_scenic_area；上游 processed scenic_area_20260524.geojson 共 34 筆（12 國家風景區、22 森林遊樂區），且其備援來源缺少雲嘉南濱海國家風景區；本 reader 不補推缺漏。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；來源為觀光署國家風景區資料。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "未在 12 筆固定展示資產中出現；不代表該國家風景區不存在。", stale: "2026-05-24 固定快照，不代表目前邊界、管理機關或訪客數。" },
  versions: [{ versionId: `sha256:${SHA}`, observedAt: null, availableAt: "2026-05-24", checksumSha256: SHA, mutable: false }],
  source: { publisher: "交通部觀光署", reference: URL, lineage: "Gist 12 national scenic area SHP ZIPs -> taipei-gis-analytics processed scenic_area_20260524.geojson SHA d1fbd0b12f7e5cbea4f5c3e059f8c0638c9d1a936bb6036d89896c6fe54cc544（34 rows；category national_scenic_area 12、forest_recreation_area 22）-> Mini display subset national_scenic_areas_national.geojson（12 names and full 2D geometry independently matched, byte SHA bound）。Display-only annual_visitors_2024/yoy_pct lack an upstream receipt and are withheld from research. 上游備援缺雲嘉南濱海國家風景區，故 coverage 為已驗證 12 筆，不宣稱全國完整。" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields, filters: ["name", "category", "manager"], supportsBbox: true, maxRowsPerQuery: COUNT, maxScanRows: COUNT, maxSourceBytes: 256 * 1024, maxResponseBytes: 256 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "national-scenic-areas-fixed-v1",
};

async function digest(bytes: Uint8Array): Promise<string> { const d = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function fail(code: string): never { throw new Error(code); }
function xyGeometry(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if ((candidate.type !== "MultiPolygon" && candidate.type !== "Polygon") || !Array.isArray(candidate.coordinates)) return value;
  const trim = (part: unknown): unknown => Array.isArray(part) ? (typeof part[0] === "number" ? (part.length === 2 || part.length === 3 && part[2] === 0 ? part.slice(0, 2) : fail("SCENIC_AREAS_NONZERO_Z")) : part.map(trim)) : part;
  return { type: "MultiPolygon", coordinates: candidate.type === "Polygon" ? [trim(candidate.coordinates)] : trim(candidate.coordinates) };
}

export const scenicAreasAdapter: QueryAdapter = { descriptor: scenicAreasDescriptor, allowedParameters: {}, read: (_p, signal): Promise<AdapterReadResult> => withLoading("research:scenic-areas", "國家風景區", (async () => {
  const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body) fail("SCENIC_AREAS_UNAVAILABLE");
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) !== BYTES) fail("SCENIC_AREAS_SOURCE_MISMATCH");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== BYTES || await digest(bytes) !== SHA) fail("SCENIC_AREAS_SOURCE_MISMATCH");
  const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== COUNT) fail("SCENIC_AREAS_COLLECTION_INVALID");
  const ids = new Set<string>();
  const rows = collection.features.map(raw => { const f = raw as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown }; const p = f.properties;
    if (f.type !== "Feature" || !p || typeof p.name !== "string" || p.category !== "national_scenic_area" || typeof p.area_km2 !== "number" || !Number.isFinite(p.area_km2)) fail("SCENIC_AREAS_ROW_INVALID");
    if (ids.has(p.name)) fail("SCENIC_AREAS_DUPLICATE_NAME"); ids.add(p.name);
    const geometry = parseSpatialGeometry(xyGeometry(f.geometry)); if (geometry.type !== "MultiPolygon") fail("SCENIC_AREAS_GEOMETRY_INVALID");
    return { name: p.name, category: p.category, manager: p.manager ?? null, area_km2: p.area_km2, geometry };
  });
  return { rows, sourceRefs: [{ sourceId: scenicAreasDescriptor.datasetId, version: `sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: new Date().toISOString() }], coverage: scenicAreasDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: COUNT, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
})()) };
