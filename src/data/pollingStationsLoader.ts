import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { POLLING_FETCH_LIMIT, POLLING_HEAT_ELECTORS_UNIT, POLLING_HEAT_PARTIES, POLLING_HEAT_VOTES_UNIT, pollingLead, pollingNumber } from "./pollingStationsTypes";

/**
 * 2024 投開票所（公開）bbox 載入器。
 *
 * public.get_polling_stations_2024(p_west, p_south, p_east, p_north, p_limit) → jsonb
 *   { type: "FeatureCollection", meta: { total, mapped, in_bbox, truncated, loaded_at }, features: [Point…] }
 * RPC 由 gis-platform migration 495 建立（anon 可執行；只回有站址座標者）。
 *
 * - bbox 向外對齊 0.02° 格網當快取鍵（小幅平移直接命中），LRU 保留最近 16 個範圍。
 * - 呼叫端傳 AbortSignal：新的 moveend 來時中止上一個還在跑的請求（被中止的不進快取）。
 * - 載入時衍生 `lead`（2024 總統領先政黨），paint／圖例／popup 都讀它。
 */

export interface PollingBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface PollingStationsMeta {
  total: number | null;
  mapped: number | null;
  inBbox: number | null;
  truncated: boolean;
  loadedAt: string | null;
}

export interface PollingStationsData {
  fc: GeoJSON.FeatureCollection;
  meta: PollingStationsMeta;
}

export class PollingStationsError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "PollingStationsError";
    this.code = code;
    this.status = status;
  }
}

/** 函式尚未部署（migration 未套）：PostgREST 回 PGRST202／404 */
export function isMissingPollingRpc(err: unknown): boolean {
  const v = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  return String(v?.code ?? "") === "PGRST202" || v?.status === 404
    || /could not find the function/i.test(String(v?.message ?? ""));
}

const GRID = 0.02;

/** bbox 向外對齊格網（快取鍵與實際查詢範圍） */
export function snapPollingBounds(b: PollingBounds): PollingBounds {
  const down = (v: number) => Math.floor(v / GRID) * GRID;
  const up = (v: number) => Math.ceil(v / GRID) * GRID;
  return {
    west: Number(down(Math.min(b.west, b.east)).toFixed(2)),
    south: Number(down(Math.min(b.south, b.north)).toFixed(2)),
    east: Number(up(Math.max(b.west, b.east)).toFixed(2)),
    north: Number(up(Math.max(b.south, b.north)).toFixed(2)),
  };
}

export function pollingBoundsKey(b: PollingBounds): string {
  return [b.west, b.south, b.east, b.north].map((v) => v.toFixed(2)).join(",");
}

/** RPC 原始回應 → 上圖用資料（純函式，測試用） */
export function normalizePollingStations(raw: unknown): PollingStationsData {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features: GeoJSON.Feature[] = [];
  for (const f of rawFeatures) {
    if (!f || f.geometry?.type !== "Point") continue;
    const props = { ...(f.properties ?? {}) } as Record<string, unknown>;
    props.lead = pollingLead(props);
    // 投票率缺值時給 -1，paint 的 step 會落到最低階外的灰（見 overlayRegistry）
    props.pres24_turnout = pollingNumber(props.pres24_turnout) ?? -1;
    features.push({ type: "Feature", geometry: f.geometry, properties: props });
  }
  const meta = obj.meta ?? {};
  return {
    fc: { type: "FeatureCollection", features },
    meta: {
      total: pollingNumber(meta.total),
      mapped: pollingNumber(meta.mapped),
      inBbox: pollingNumber(meta.in_bbox),
      truncated: meta.truncated === true,
      loadedAt: typeof meta.loaded_at === "string" ? meta.loaded_at : null,
    },
  };
}

const CACHE_MAX = 16;
const cache = new Map<string, PollingStationsData>();

function remember(key: string, data: PollingStationsData): void {
  cache.delete(key);
  cache.set(key, data);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** 測試用：清快取 */
export function clearPollingStationsCache(): void {
  cache.clear();
}

export async function fetchPollingStations(bounds: PollingBounds, signal?: AbortSignal): Promise<PollingStationsData> {
  const snapped = snapPollingBounds(bounds);
  const key = pollingBoundsKey(snapped);
  const hit = cache.get(key);
  if (hit) {
    remember(key, hit);
    return hit;
  }
  if (!supabaseConfigured) return normalizePollingStations(null);
  let query = supabase.rpc("get_polling_stations_2024", {
    p_west: snapped.west,
    p_south: snapped.south,
    p_east: snapped.east,
    p_north: snapped.north,
    p_limit: POLLING_FETCH_LIMIT,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await withLoading(`polling:stations2024:${key}`, "2024 投開票所", query);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (error) {
    throw new PollingStationsError(`get_polling_stations_2024: ${error.message}`, String(error.code ?? ""), status);
  }
  const out = normalizePollingStations(data);
  remember(key, out);
  return out;
}

// ── 圖例用的狀態（載入後才有值；useSyncExternalStore 訂閱）──
export interface PollingLegendState {
  meta: PollingStationsMeta | null;
  /** 目前 zoom 低於 POLLING_MIN_ZOOM（不抓、不畫） */
  belowMinZoom: boolean;
}

let legendSnapshot: PollingLegendState = { meta: null, belowMinZoom: false };
const legendListeners = new Set<() => void>();

export function setPollingLegendState(next: PollingLegendState): void {
  if (next.meta === legendSnapshot.meta && next.belowMinZoom === legendSnapshot.belowMinZoom) return;
  legendSnapshot = next;
  for (const cb of legendListeners) cb();
}

export const pollingLegendStore = {
  subscribe(cb: () => void): () => void {
    legendListeners.add(cb);
    return () => { legendListeners.delete(cb); };
  },
  getSnapshot(): PollingLegendState {
    return legendSnapshot;
  },
};

// ── 低縮放熱區（全臺一次抓、session 快取）──
/**
 * public.get_polling_stations_2024_heat() → jsonb（gis-platform mig 496）
 *   { meta: { count, loaded_at }, cols: ["lng","lat","electors","dpp","kmt","tpp"], rows: [[…], …] }
 * 只含有站址座標者（村里／鄉鎮代表點不進熱區）。票數缺值為 null → 權重 0。
 * 三黨熱區：每所只計入該所領先政黨那一層（w_<領先黨>＝領先者得票數 ÷ 單位，其他兩層 0），各層空間上大致互斥；
 * 同票或全缺值三層都 0。
 * 權重在這裡先算好（w_electors／w_dpp…），paint 直接 get，不在 GPU 端除。
 */
export interface PollingHeatData {
  fc: GeoJSON.FeatureCollection<GeoJSON.Point>;
  count: number | null;
  loadedAt: string | null;
}

export function normalizePollingHeat(raw: unknown): PollingHeatData {
  const obj = (raw ?? {}) as { cols?: unknown; rows?: unknown; meta?: Record<string, unknown> };
  const cols = Array.isArray(obj.cols) ? obj.cols.map(String) : [];
  const rows = Array.isArray(obj.rows) ? (obj.rows as unknown[]) : [];
  const idx = (name: string) => cols.indexOf(name);
  const iLng = idx("lng");
  const iLat = idx("lat");
  const iE = idx("electors");
  const iParty = POLLING_HEAT_PARTIES.map((p) => [p, idx(p)] as const);
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (iLng >= 0 && iLat >= 0) {
    for (const r of rows) {
      if (!Array.isArray(r)) continue;
      const lng = pollingNumber(r[iLng]);
      const lat = pollingNumber(r[iLat]);
      if (lng === null || lat === null) continue;
      const props: Record<string, number> = {
        w_electors: Math.max(0, (iE >= 0 ? pollingNumber(r[iE]) : null) ?? 0) / POLLING_HEAT_ELECTORS_UNIT,
      };
      // 三黨熱區：每所只進「該所 2024 總統領先政黨」那一層（權重＝領先者得票數）；同票或缺值不進任何一層
      const votes: Record<string, unknown> = {};
      for (const [p, i] of iParty) votes[`pres24_${p}_votes`] = i >= 0 ? r[i] : null;
      const lead = pollingLead(votes);
      for (const [p] of iParty) {
        props[`w_${p}`] = p === lead ? Math.max(0, pollingNumber(votes[`pres24_${p}_votes`]) ?? 0) / POLLING_HEAT_VOTES_UNIT : 0;
      }
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props });
    }
  }
  const meta = obj.meta ?? {};
  return {
    fc: { type: "FeatureCollection", features },
    count: pollingNumber(meta.count),
    loadedAt: typeof meta.loaded_at === "string" ? meta.loaded_at : null,
  };
}

let heatPromise: Promise<PollingHeatData> | null = null;

/** 測試用：清熱區快取 */
export function clearPollingHeatCache(): void {
  heatPromise = null;
}

/** 全臺熱區點（session 內只抓一次；失敗不快取，下次開圖層再試） */
export function fetchPollingHeat(): Promise<PollingHeatData> {
  if (heatPromise) return heatPromise;
  if (!supabaseConfigured) return Promise.resolve(normalizePollingHeat(null));
  const p = (async () => {
    const { data, error, status } = await withLoading(
      "polling:stations2024:heat",
      "2024 投開票所熱區",
      supabase.rpc("get_polling_stations_2024_heat"),
    );
    if (error) {
      throw new PollingStationsError(`get_polling_stations_2024_heat: ${error.message}`, String(error.code ?? ""), status);
    }
    return normalizePollingHeat(data);
  })();
  heatPromise = p;
  p.catch(() => { if (heatPromise === p) heatPromise = null; });
  return p;
}
