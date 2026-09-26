import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/fishery/aquaculture_cage_net.geojson";
const SHA = "56966411c994bf60de060e4d828d5e21226f4080d72047a939703320f21e108e";
const RAW_SHA = "6363a8a585bc7ed12a344b687e6918c8b354d963ba932b87b808d84163f1838b";
const BYTES = 20_001;
const COUNT = 42;
const fields: readonly DatasetField[] = [
  { name: "public_no", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "township", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "location", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const aquacultureCageNetDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-aquaculture-cage-net-20260607-local", label: "臺灣地區箱網範圍（固定面快照）",
  description: "農業部漁業署 datagov:127504 的 42 個海上養殖箱網 Polygon 固定快照；僅供歷史空間參考，不代表目前養殖活動。",
  layerRefs: ["aquacultureCageNet"], kind: "polygon", recordGrain: "feature", primaryKey: ["public_no"], fields,
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "actual", precision: "來源 SHP WGS84 Polygon；保留完整面，精度依原始資料。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "42 Polygon；澎湖海域為主。2026-06-07 是本機 pipeline 產物時間，不是來源觀測日；原始 metadata 為 2020 年，且 catalog manifest 2026-05-19 與產物不同，故不宣稱 current。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；來源 datagov:127504、農業部漁業署。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "未在 42 筆固定快照出現；不代表當地沒有箱網。", stale: "固定本機處理快照，不代表目前箱網存在、營運或養殖活動。" },
  versions: [{ versionId: `sha256:${SHA}`, observedAt: null, availableAt: "2026-06-07", checksumSha256: SHA, mutable: false }],
  source: { publisher: "農業部漁業署", reference: "datagov:127504", lineage: `raw SHP ZIP SHA-256 ${RAW_SHA} -> analytics processed GeoJSON SHA-256 ${SHA} (42 Polygon) -> byte-identical Mini display asset。` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["public_no", "township", "location"], supportsBbox: true, maxRowsPerQuery: COUNT, maxScanRows: COUNT, maxSourceBytes: 64 * 1024, maxResponseBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "aquaculture-cage-net-fixed-v1",
};

function fail(code: string): never { throw new Error(code); }
async function sha256(bytes: Uint8Array): Promise<string> { const d = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""); }

export const aquacultureCageNetAdapter: QueryAdapter = { descriptor: aquacultureCageNetDescriptor, allowedParameters: {}, read: (_p, signal): Promise<AdapterReadResult> => withLoading("research:aquaculture-cage-net", "海上養殖箱網", (async () => {
  const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body) fail("AQUACULTURE_CAGE_NET_UNAVAILABLE");
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) !== BYTES) fail("AQUACULTURE_CAGE_NET_SOURCE_MISMATCH");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== BYTES || await sha256(bytes) !== SHA) fail("AQUACULTURE_CAGE_NET_SOURCE_MISMATCH");
  const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== COUNT) fail("AQUACULTURE_CAGE_NET_COLLECTION_INVALID");
  const ids = new Set<string>();
  const rows = collection.features.map(raw => { const f = raw as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown }; const p = f.properties;
    if (f.type !== "Feature" || !p || typeof p.public_no !== "string" || !p.public_no || typeof p.township !== "string" || !p.township || typeof p.location !== "string" || !p.location) fail("AQUACULTURE_CAGE_NET_ROW_INVALID");
    if (ids.has(p.public_no)) fail("AQUACULTURE_CAGE_NET_DUPLICATE_PUBLIC_NO"); ids.add(p.public_no);
    const geometry = parseSpatialGeometry(f.geometry); if (geometry.type !== "Polygon") fail("AQUACULTURE_CAGE_NET_GEOMETRY_INVALID");
    return { public_no: p.public_no, township: p.township, location: p.location, geometry };
  });
  return { rows, sourceRefs: [{ sourceId: aquacultureCageNetDescriptor.datasetId, version: `sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: new Date().toISOString() }], coverage: aquacultureCageNetDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: COUNT, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
})()) };
