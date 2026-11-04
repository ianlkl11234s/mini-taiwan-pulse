import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { VILLAGE_RESULTS_FULL_ZOOM, VILLAGE_RESULTS_MAX_QUERY_ZOOM, VILLAGE_RESULTS_MIN_ZOOM } from "./electionResults2022Types";

/**
 * 2022 村里得票（公開）bbox 載入器。
 *
 * public.get_election_results_2022_village(p_west, p_south, p_east, p_north, p_zoom int) → FeatureCollection（gis-platform mig 496）
 *   meta: { count, zoom, detail ('basic'|'full'), reason, loaded_at }
 *   z<8 回空；z8–9 只回精簡欄位（villcode, village, status, m_/c_ top／margin_pp／turnout）；z≥10 完整欄位。
 *
 * - 一律以整數 zoom（floor，夾在 8–14）呼叫；快取鍵含 zoom，跨 z9→z10 自然重查拿完整欄位。
 * - bbox 依 zoom 對齊格網（z8 1°、每放大一級減半、最細 0.02°），小幅平移直接命中快取，LRU 12 個範圍。
 * - 載入時把 meta.detail 寫進每個 feature 的 `_detail`，popup 據此判斷要不要提示「放大看詳細」。
 *
 * z8–9 不走 bbox：改用 get_election_results_2022_village_overview()（mig 498；全臺、預先 coverage 簡化不留縫），
 * 開圖層後（且 zoom < 10 時）抓一次、session 快取；cols／rows／geoms 在前端組回 FeatureCollection，欄名同 basic。
 */

/** 這個 zoom 該用全臺總覽（z8–9）還是 bbox（z ≥ 10） */
export function villageUsesOverview(zoom: number): boolean {
  return zoom >= VILLAGE_RESULTS_MIN_ZOOM && zoom < VILLAGE_RESULTS_FULL_ZOOM;
}

/**
 * 這個 zoom 要抓什麼：z < 8 不抓；z8–9 抓總覽（總覽 RPC 未部署時退回 bbox）；z ≥ 10 抓 bbox。
 * hook 只照這個決定呼叫，測試據此保證 z < 10 不打 bbox RPC。
 */
export function villageFetchPlan(zoom: number, overviewMissing = false): "none" | "overview" | "bbox" {
  if (zoom < VILLAGE_RESULTS_MIN_ZOOM) return "none";
  if (villageUsesOverview(zoom) && !overviewMissing) return "overview";
  return "bbox";
}

export interface VillageBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface VillageResultsMeta {
  count: number | null;
  zoom: number | null;
  detail: string | null;
  loadedAt: string | null;
}

export interface VillageResultsData {
  fc: GeoJSON.FeatureCollection;
  meta: VillageResultsMeta;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** 呼叫 RPC 用的整數 zoom（floor 後夾在 8–14） */
export function villageQueryZoom(zoom: number): number {
  return Math.max(VILLAGE_RESULTS_MIN_ZOOM, Math.min(VILLAGE_RESULTS_MAX_QUERY_ZOOM, Math.floor(zoom)));
}

/** 該 zoom 的 bbox 對齊格網（度） */
export function villageGrid(qz: number): number {
  return Math.max(0.02, 2 ** (VILLAGE_RESULTS_MIN_ZOOM - qz));
}

export function snapVillageBounds(b: VillageBounds, qz: number): VillageBounds {
  const g = villageGrid(qz);
  const r = (v: number) => Number(v.toFixed(4));
  return {
    west: r(Math.floor(Math.min(b.west, b.east) / g) * g),
    south: r(Math.floor(Math.min(b.south, b.north) / g) * g),
    east: r(Math.ceil(Math.max(b.west, b.east) / g) * g),
    north: r(Math.ceil(Math.max(b.south, b.north) / g) * g),
  };
}

export function villageCacheKey(b: VillageBounds, qz: number): string {
  return `${qz}:${[b.west, b.south, b.east, b.north].map((v) => v.toFixed(4)).join(",")}`;
}

/** RPC 原始回應 → 上圖用資料（純函式，測試用） */
export function normalizeVillageResults(raw: unknown): VillageResultsData {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const meta = obj.meta ?? {};
  const detail = typeof meta.detail === "string" ? meta.detail : null;
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features: GeoJSON.Feature[] = [];
  for (const f of rawFeatures) {
    const t = f?.geometry?.type;
    if (t !== "Polygon" && t !== "MultiPolygon") continue;
    const props = { ...(f.properties ?? {}) } as Record<string, unknown>;
    if (props.status !== "ok" && props.status !== "merged" && props.status !== "missing") props.status = "missing";
    props._detail = detail === "basic" ? "basic" : "full";
    features.push({ type: "Feature", geometry: f.geometry, properties: props });
  }
  return {
    fc: { type: "FeatureCollection", features },
    meta: {
      count: num(meta.count),
      zoom: num(meta.zoom),
      detail,
      loadedAt: typeof meta.loaded_at === "string" ? meta.loaded_at : null,
    },
  };
}

/** overview RPC 原始回應（cols＋rows＋geoms）→ FeatureCollection（純函式，測試用）；properties 欄名＝cols */
export function normalizeVillageOverview(raw: unknown): VillageResultsData {
  const obj = (raw ?? {}) as { cols?: unknown; rows?: unknown; geoms?: unknown; meta?: Record<string, unknown> };
  const cols = Array.isArray(obj.cols) ? obj.cols.map(String) : [];
  const rows = Array.isArray(obj.rows) ? (obj.rows as unknown[]) : [];
  const geoms = Array.isArray(obj.geoms) ? (obj.geoms as unknown[]) : [];
  const features: GeoJSON.Feature[] = [];
  rows.forEach((r, i) => {
    const g = geoms[i] as GeoJSON.Geometry | null | undefined;
    if (!Array.isArray(r) || !g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return;
    const props: Record<string, unknown> = {};
    cols.forEach((c, j) => { props[c] = r[j] ?? null; });
    features.push({ type: "Feature", geometry: g, properties: props });
  });
  const meta = obj.meta ?? {};
  // 交給 bbox 版的 normalize 統一處理 status 與 _detail
  return normalizeVillageResults({ meta: { ...meta, detail: "basic" }, features });
}

let overviewPromise: Promise<VillageResultsData> | null = null;

/** 測試用：清總覽快取 */
export function clearVillageOverviewCache(): void {
  overviewPromise = null;
}

/** 全臺總覽（z8–9 用；session 內只抓一次，失敗不快取） */
export function fetchVillageOverview(): Promise<VillageResultsData> {
  if (overviewPromise) return overviewPromise;
  if (!supabaseConfigured) return Promise.resolve(normalizeVillageOverview(null));
  const p = (async () => {
    const { data, error, status } = await withLoading(
      "politics:village2022:overview",
      "2022 村里得票（全臺）",
      supabase.rpc("get_election_results_2022_village_overview"),
    );
    if (error) {
      const e = new Error(`get_election_results_2022_village_overview: ${error.message}`) as Error & { code?: string; status?: number };
      e.code = String(error.code ?? "");
      e.status = status;
      throw e;
    }
    return normalizeVillageOverview(data);
  })();
  overviewPromise = p;
  p.catch(() => { if (overviewPromise === p) overviewPromise = null; });
  return p;
}

const CACHE_MAX = 12;
const cache = new Map<string, VillageResultsData>();

function remember(key: string, data: VillageResultsData): void {
  cache.delete(key);
  cache.set(key, data);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** 測試用：清快取 */
export function clearVillageResultsCache(): void {
  cache.clear();
}

export async function fetchVillageResults(bounds: VillageBounds, zoom: number, signal?: AbortSignal): Promise<VillageResultsData> {
  const qz = villageQueryZoom(zoom);
  const snapped = snapVillageBounds(bounds, qz);
  const key = villageCacheKey(snapped, qz);
  const hit = cache.get(key);
  if (hit) {
    remember(key, hit);
    return hit;
  }
  if (!supabaseConfigured) return normalizeVillageResults(null);
  let query = supabase.rpc("get_election_results_2022_village", {
    p_west: snapped.west,
    p_south: snapped.south,
    p_east: snapped.east,
    p_north: snapped.north,
    p_zoom: qz,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await withLoading(`politics:village2022:${key}`, "2022 村里得票", query);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (error) {
    const e = new Error(`get_election_results_2022_village: ${error.message}`) as Error & { code?: string; status?: number };
    e.code = String(error.code ?? "");
    e.status = status;
    throw e;
  }
  const out = normalizeVillageResults(data);
  remember(key, out);
  return out;
}

// ── 圖例用的狀態（useSyncExternalStore 訂閱）──
export interface VillageLegendState {
  meta: VillageResultsMeta | null;
  belowMinZoom: boolean;
}

let legendSnapshot: VillageLegendState = { meta: null, belowMinZoom: false };
const legendListeners = new Set<() => void>();

export function setVillageLegendState(next: VillageLegendState): void {
  if (next.meta === legendSnapshot.meta && next.belowMinZoom === legendSnapshot.belowMinZoom) return;
  legendSnapshot = next;
  for (const cb of legendListeners) cb();
}

export const villageLegendStore = {
  subscribe(cb: () => void): () => void {
    legendListeners.add(cb);
    return () => { legendListeners.delete(cb); };
  },
  getSnapshot(): VillageLegendState {
    return legendSnapshot;
  },
};
