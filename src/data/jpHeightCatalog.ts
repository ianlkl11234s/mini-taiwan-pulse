export type JpHeightStatus = "ready" | "pending" | "unavailable" | "hold";
export type JpHeightCoverage = "partial" | "source-coverage";
export type JpHeightBbox = readonly [west: number, south: number, east: number, north: number];

export interface JpHeightAsset {
  url: string; bbox: JpHeightBbox; minzoom: number; maxzoom: number;
  bytes: number; sha256: string; sourceLayer?: string;
  sourceYear?: number; heightMethod?: string; geometryMethod?: string;
  attribution?: string; license?: string; coverage?: JpHeightCoverage; pixelSizeProjectedM?: number;
  /** Overview only: region ids whose cells are actually present in this archive. */
  regionIds?: string[];
}
export interface JpHeightRegion {
  id: string; label: string; bbox: JpHeightBbox; status: JpHeightStatus;
  buildings?: JpHeightAsset; grid?: JpHeightAsset; canopy?: JpHeightAsset;
}
export interface JpHeightCatalog {
  schema: "jp-height-catalog-v1";
  version: string;
  regions: JpHeightRegion[];
  overview?: JpHeightAsset;
  /** Coarse canopy coverage used only when no intersecting regional canopy asset can render. */
  canopyOverview?: JpHeightAsset;
}
export type JpHeightCatalogResult =
  | { status: "ready" | "legacy"; catalog: JpHeightCatalog }
  | { status: "unavailable"; error: string };

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const CATALOG_URL = "./jp-heights/catalog.json";
let loaded: JpHeightCatalogResult | undefined;
let inFlight: Promise<JpHeightCatalogResult> | undefined;

const legacyTokyoCatalog: JpHeightCatalog = {
  schema: "jp-height-catalog-v1", version: "legacy-tokyo-local", regions: [{
    id: "tokyo-shinjuku", label: "Tokyo/Shinjuku pilot", bbox: [139.55, 35.60, 139.90, 35.85], status: "ready",
    buildings: { url: "./jp-heights/buildings.pmtiles", bbox: [139.68936, 35.67923, 139.72122, 35.70026], minzoom: 12, maxzoom: 16, sourceLayer: "buildings", bytes: 3156972, sha256: "1f2a86b9661c7ae1810140959ebdbf9d065a347e62709938e45df8c2e0e48ac5", sourceYear: 2025, heightMethod: "bldg:measuredHeight", geometryMethod: "bldg:lod0RoofEdge", attribution: "PLATEAU", license: "CC BY 4.0", coverage: "partial" },
    grid: { url: "./jp-heights/building_grid.pmtiles", bbox: [139.672325, 35.596469, 139.785677, 35.777919], minzoom: 4, maxzoom: 12, sourceLayer: "building_grid", bytes: 10398, sha256: "11371f83d16f8ebb649a8f494705f8e9b1d45ade053dc4ad0f68aa31c3c632d8", coverage: "partial" },
    canopy: { url: "./jp-heights/canopy.pmtiles", bbox: [139.55, 35.60, 139.90, 35.85], minzoom: 9, maxzoom: 12, bytes: 1831713, sha256: "c2a3989bf95d9213173f6fd073f30f18ed3abdd218f42adc16a5ba4596afefde", sourceYear: 2026, heightMethod: "CHMv2", attribution: "Meta/WRI", license: "CC BY 4.0", coverage: "partial" },
  }],
};

function isBbox(value: unknown): value is JpHeightBbox {
  return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number" && Number.isFinite(n))
    && value[0]! >= -180 && value[2]! <= 180 && value[1]! >= -90 && value[3]! <= 90
    && value[0]! < value[2]! && value[1]! < value[3]!;
}
function isLocalAssetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value, globalThis.location?.origin ?? "http://localhost"); return url.origin === (globalThis.location?.origin ?? "http://localhost") && /^\/jp-heights\/.+\.pmtiles$/.test(url.pathname) && !url.search && !url.hash; } catch { return false; }
}
function parseAsset(value: unknown): JpHeightAsset | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const maxBytes = v.sourceLayer === "building_grid" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
  if (!isLocalAssetUrl(v.url) || !isBbox(v.bbox) || !Number.isInteger(v.minzoom) || !Number.isInteger(v.maxzoom)
    || (v.minzoom as number) < 0 || (v.maxzoom as number) > 22 || (v.minzoom as number) > (v.maxzoom as number) || !Number.isInteger(v.bytes) || (v.bytes as number) < 0 || (v.bytes as number) > maxBytes
    || typeof v.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(v.sha256)) return undefined;
  if (v.sourceLayer !== undefined && typeof v.sourceLayer !== "string") return undefined;
  for (const key of ["heightMethod", "geometryMethod", "attribution", "license"] as const) if (v[key] !== undefined && typeof v[key] !== "string") return undefined;
  if (v.sourceYear !== undefined && (!Number.isInteger(v.sourceYear) || (v.sourceYear as number) < 1900 || (v.sourceYear as number) > 2100)) return undefined;
  if (v.pixelSizeProjectedM !== undefined && (!(typeof v.pixelSizeProjectedM === "number") || !Number.isFinite(v.pixelSizeProjectedM) || (v.pixelSizeProjectedM as number) <= 0)) return undefined;
  if (v.coverage !== undefined && v.coverage !== "partial" && v.coverage !== "source-coverage") return undefined;
  if (v.regionIds !== undefined && (!Array.isArray(v.regionIds) || v.regionIds.length > 5000
    || new Set(v.regionIds).size !== v.regionIds.length
    || v.regionIds.some((id) => typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(id)))) return undefined;
  return v as unknown as JpHeightAsset;
}

export function parseJpHeightCatalog(value: unknown): JpHeightCatalog {
  if (!value || typeof value !== "object") throw new Error("catalog 格式無效");
  const raw = value as Record<string, unknown>;
  if (raw.schema !== "jp-height-catalog-v1" || typeof raw.version !== "string" || !raw.version) throw new Error("catalog schema/version 無效");
  if (!Array.isArray(raw.regions) || raw.regions.length > 5000) throw new Error("catalog regions 數量無效");
  const ids = new Set<string>();
  const regions = raw.regions.map((item): JpHeightRegion => {
    if (!item || typeof item !== "object") throw new Error("catalog region 格式無效");
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(r.id) || ids.has(r.id)
      || typeof r.label !== "string" || !r.label || !isBbox(r.bbox)
      || !["ready", "pending", "unavailable", "hold"].includes(String(r.status))) throw new Error("catalog region 欄位無效");
    ids.add(r.id);
    const out: JpHeightRegion = { id: r.id, label: r.label, bbox: r.bbox, status: r.status as JpHeightStatus };
    for (const key of ["buildings", "grid", "canopy"] as const) {
      if (r[key] !== undefined) { const asset = parseAsset(r[key]); if (!asset) throw new Error(`catalog ${r.id}/${key} 無效`); out[key] = asset; }
    }
    return out;
  });
  const overview = raw.overview === undefined ? undefined : parseAsset(raw.overview);
  if (raw.overview !== undefined && !overview) throw new Error("catalog overview 無效");
  const canopyOverview = raw.canopyOverview === undefined ? undefined : parseAsset(raw.canopyOverview);
  if (raw.canopyOverview !== undefined && !canopyOverview) throw new Error("catalog canopyOverview 無效");
  return { schema: "jp-height-catalog-v1", version: raw.version, regions,
    ...(overview ? { overview } : {}), ...(canopyOverview ? { canopyOverview } : {}) };
}

async function boundedJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_CATALOG_BYTES) throw new Error("catalog 超過 2MB");
  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; total += next.value.byteLength; if (total > MAX_CATALOG_BYTES) { await reader.cancel(); throw new Error("catalog 超過 2MB"); } chunks.push(next.value); }
  return JSON.parse(new TextDecoder().decode(await new Blob(chunks).arrayBuffer()));
}

export async function loadJpHeightCatalog(signal?: AbortSignal): Promise<JpHeightCatalogResult> {
  if (loaded && loaded.status !== "unavailable") return loaded;
  if (inFlight && !signal) return inFlight;
  const task = (async () => {
  try {
    const response = await fetch(CATALOG_URL, { signal });
    if (response.status === 404) return loaded = { status: "legacy", catalog: legacyTokyoCatalog };
    if (!response.ok) return loaded = { status: "unavailable", error: `catalog HTTP ${response.status}` };
    return loaded = { status: "ready", catalog: parseJpHeightCatalog(await boundedJson(response)) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return loaded = { status: "unavailable", error: error instanceof Error ? error.message : "catalog 載入失敗" };
  }
  })();
  if (!signal) { inFlight = task; void task.finally(() => { inFlight = undefined; }); }
  return task;
}
export function getLoadedJpHeightCatalog(): JpHeightCatalogResult | undefined { return loaded; }
