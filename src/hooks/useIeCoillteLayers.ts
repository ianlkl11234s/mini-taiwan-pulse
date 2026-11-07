import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { supabase } from "../lib/supabase";
import { IE_COILLTE_FOREST_ROADS, IE_COILLTE_ROADS_MIN_ZOOM, IE_COILLTE_SPEC_BY_KEY, normalizeIeCoillte, type IeCoillteKey } from "../data/ieCoillteTypes";

/**
 * 愛爾蘭 Coillte 國有林兩層（站主限定）資料供應 hook，比照 useGbEaPollutionInventoryLayer。
 *
 * - **visible 才 fetch**：非站主開不了這兩層（App lockedKeys／handleGatedIntercept），所以永遠不會呼叫 RPC。
 * - 遊憩點（useIeCoillteLayer）：一個 session 只打一次 RPC（module-level cache）；靜態資料，不訂閱時間軸。
 * - 林道（useIeCoillteForestRoadsLayer）：整包約 7.9MB 超過 2MB 門檻 → 依畫面 p_bbox 分批（z10 起，見 IE_COILLTE_ROADS_MIN_ZOOM），
 *   moveend debounce 300ms、bbox 對齊 0.05° 格網當快取鍵（LRU 16）、新請求 abort 舊的（比照 usePollingStationsLayer）。
 * - 樣式全在 overlayRegistry（dynamicData），這裡只 setData。
 * - 無權限（42501）靜默；函式尚未部署（PGRST202，migration 512 未套）只記一次 info。
 * - 撤權（登出／失去站主權限）時清掉 module cache 與 hook 內資料（lib/ownerGateRevoke）。
 * - Coillte 條款不得轉供 → 不快取到 localStorage、不輸出成任何檔。
 */

const GEOM_TYPES: Record<IeCoillteKey, readonly string[]> = {
  ieCoillteRecreation: ["Point"],
  ieCoillteForestRoads: ["LineString", "MultiLineString"],
};

/** RPC 錯誤：保留 PostgREST code，讓 hook 分辨無權限（42501）與函式不存在（PGRST202） */
export class IeCoillteRpcError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "IeCoillteRpcError";
    this.code = code;
    this.status = status;
  }
}

export function isMissingIeCoillteRpc(err: unknown): boolean {
  const v = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  return String(v?.code ?? "") === "PGRST202" || v?.status === 404
    || /could not find the function/i.test(String(v?.message ?? ""));
}

async function fetchIeCoillte(key: IeCoillteKey): Promise<GeoJSON.FeatureCollection> {
  const spec = IE_COILLTE_SPEC_BY_KEY[key];
  const { data, error, status } = await withLoading(`ie:${key}`, spec.loading.zh, supabase.rpc(spec.rpc));
  if (error) throw new IeCoillteRpcError(`${spec.rpc}: ${error.message}`, String(error.code ?? ""), status);
  return normalizeIeCoillte(data, GEOM_TYPES[key]);
}

interface CacheSlot { data: GeoJSON.FeatureCollection | null; inflight: Promise<GeoJSON.FeatureCollection> | null; generation: number; missingLogged: boolean }
const slots: Record<IeCoillteKey, CacheSlot> = {
  ieCoillteRecreation: { data: null, inflight: null, generation: 0, missingLogged: false },
  ieCoillteForestRoads: { data: null, inflight: null, generation: 0, missingLogged: false },
};

function loadOnce(key: IeCoillteKey): Promise<GeoJSON.FeatureCollection> {
  const slot = slots[key];
  if (slot.data) return Promise.resolve(slot.data);
  if (slot.inflight) return slot.inflight;
  const gen = slot.generation;
  const p = fetchIeCoillte(key)
    .then((fc) => {
      if (gen !== slot.generation) throw new Error(`[IeCoillte] ${key} access revoked`);
      slot.data = fc;
      slot.inflight = null;
      return fc;
    })
    .catch((err: unknown) => {
      if (slot.inflight === p) slot.inflight = null;
      throw err;
    });
  slot.inflight = p;
  return p;
}

/** 撤權：清掉該層 module cache（含進行中的請求；林道另清 bbox 快取） */
export function clearIeCoillteCache(key: IeCoillteKey): void {
  const slot = slots[key];
  slot.generation += 1;
  slot.data = null;
  slot.inflight = null;
  if (key === "ieCoillteForestRoads") roadsCache.clear();
}

/** 測試用：清掉兩層 module cache */
export function resetIeCoillteCacheForTest(): void {
  for (const key of Object.keys(slots) as IeCoillteKey[]) {
    clearIeCoillteCache(key);
    slots[key].missingLogged = false;
  }
}

export function useIeCoillteLayer(mapRef: React.RefObject<MapboxMap | null>, key: IeCoillteKey, visible: boolean) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(slots[key].data);
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => registerOwnerGateReset([key], () => {
    clearIeCoillteCache(key);
    setData(null);
  }), [key]);

  useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    loadOnce(key)
      .then((fc) => { if (!cancelled) setData(fc); })
      .catch((err: unknown) => {
        if (cancelled || isAccessDenied(err)) return;
        if (isMissingIeCoillteRpc(err)) {
          const slot = slots[key];
          if (!slot.missingLogged) console.info(`[IeCoillte] ${IE_COILLTE_SPEC_BY_KEY[key].rpc} 尚未部署，圖層暫無資料`);
          slot.missingLogged = true;
          return;
        }
        console.warn(`[IeCoillte] ${key} load failed:`, err);
      });
    return () => { cancelled = true; };
  }, [key, visible, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !data) return;
    const feed = feedDynamicSource(map, IE_COILLTE_SPEC_BY_KEY[key].sourceId);
    feed.set(data);
    return () => feed.dispose();
  }, [mapRef, mapTick, key, visible, data]);
}

// ── 林道：依畫面 bbox 分批 ─────────────────────────────────────────

export interface IeCoillteBounds { west: number; south: number; east: number; north: number }

const ROADS_GRID = 0.05;
const ROADS_CACHE_MAX = 16;
const ROADS_DEBOUNCE_MS = 300;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const roadsCache = new Map<string, GeoJSON.FeatureCollection>();

/** bbox 向外對齊 0.05° 格網（快取鍵與實際查詢範圍） */
export function snapIeCoillteBounds(b: IeCoillteBounds): IeCoillteBounds {
  const down = (v: number) => Number((Math.floor(v / ROADS_GRID) * ROADS_GRID).toFixed(2));
  const up = (v: number) => Number((Math.ceil(v / ROADS_GRID) * ROADS_GRID).toFixed(2));
  return {
    west: down(Math.min(b.west, b.east)),
    south: down(Math.min(b.south, b.north)),
    east: up(Math.max(b.west, b.east)),
    north: up(Math.max(b.south, b.north)),
  };
}

export function ieCoillteBoundsKey(b: IeCoillteBounds): string {
  return [b.west, b.south, b.east, b.north].map((v) => v.toFixed(2)).join(",");
}

function rememberRoads(key: string, fc: GeoJSON.FeatureCollection): void {
  roadsCache.delete(key);
  roadsCache.set(key, fc);
  while (roadsCache.size > ROADS_CACHE_MAX) {
    const oldest = roadsCache.keys().next().value;
    if (oldest === undefined) break;
    roadsCache.delete(oldest);
  }
}

/** 依 bbox 查林道（已對齊格網的範圍才查；快取命中不打 RPC） */
export async function fetchIeCoillteRoads(bounds: IeCoillteBounds, signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const snapped = snapIeCoillteBounds(bounds);
  const key = ieCoillteBoundsKey(snapped);
  const hit = roadsCache.get(key);
  if (hit) {
    rememberRoads(key, hit);
    return hit;
  }
  const gen = slots.ieCoillteForestRoads.generation;
  const spec = IE_COILLTE_FOREST_ROADS;
  let query = supabase.rpc(spec.rpc, { p_bbox: [snapped.west, snapped.south, snapped.east, snapped.north] });
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await withLoading(`ie:${spec.key}:${key}`, spec.loading.zh, query);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (error) throw new IeCoillteRpcError(`${spec.rpc}: ${error.message}`, String(error.code ?? ""), status);
  if (gen !== slots.ieCoillteForestRoads.generation) throw new Error("[IeCoillte] ieCoillteForestRoads access revoked");
  const fc = normalizeIeCoillte(data, GEOM_TYPES.ieCoillteForestRoads);
  rememberRoads(key, fc);
  return fc;
}

export function useIeCoillteForestRoadsLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean) {
  const key: IeCoillteKey = "ieCoillteForestRoads";
  const [revokeTick, setRevokeTick] = useState(0);
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => registerOwnerGateReset([key], () => {
    clearIeCoillteCache(key);
    setRevokeTick((t) => t + 1);
  }), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const feed = feedDynamicSource(map, IE_COILLTE_FOREST_ROADS.sourceId);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let shownKey: string | null = null;

    const run = () => {
      timer = undefined;
      if (disposed) return;
      // 低於起點縮放：不查（圖層 minzoom 同值不畫）；保留已畫資料，拉回來不必重抓
      if (map.getZoom() < IE_COILLTE_ROADS_MIN_ZOOM) {
        controller?.abort();
        controller = null;
        return;
      }
      const b = map.getBounds();
      if (!b) return;
      const bounds = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
      const k = ieCoillteBoundsKey(snapIeCoillteBounds(bounds));
      if (k === shownKey) {
        controller?.abort();
        controller = null;
        return;
      }
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      fetchIeCoillteRoads(bounds, ctrl.signal)
        .then((fc) => {
          if (disposed || ctrl.signal.aborted) return;
          shownKey = k;
          feed.set(fc);
          keepLoadingUntilMapIdle(map, "ie:ieCoillteForestRoads:render", "Coillte 林道繪製", null);
        })
        .catch((err: unknown) => {
          if (disposed || ctrl.signal.aborted || (err as { name?: string } | null)?.name === "AbortError") return;
          if (isAccessDenied(err)) return;
          if (isMissingIeCoillteRpc(err)) {
            const slot = slots[key];
            if (!slot.missingLogged) console.info(`[IeCoillte] ${IE_COILLTE_FOREST_ROADS.rpc} 尚未部署，圖層暫無資料`);
            slot.missingLogged = true;
            return;
          }
          console.warn("[IeCoillte] ieCoillteForestRoads load failed:", err);
        });
    };
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(run, ROADS_DEBOUNCE_MS);
    };

    map.on("moveend", schedule);
    run();
    return () => {
      disposed = true;
      map.off("moveend", schedule);
      if (timer !== undefined) clearTimeout(timer);
      controller?.abort();
      // 撤權或關圖層：清空畫面上的林道（資料不留在 source）
      feed.set(EMPTY_FC);
      feed.dispose();
    };
  }, [mapRef, mapTick, visible, revokeTick]);
}
