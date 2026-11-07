import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { withLoading } from "../lib/loadingRegistry";
import { supabase } from "../lib/supabase";
import { IE_COILLTE_SPEC_BY_KEY, normalizeIeCoillte, type IeCoillteKey } from "../data/ieCoillteTypes";

/**
 * 愛爾蘭 Coillte 國有林兩層（站主限定）資料供應 hook，比照 useGbEaPollutionInventoryLayer。
 *
 * - **visible 才 fetch**：非站主開不了這兩層（App lockedKeys／handleGatedIntercept），所以永遠不會呼叫 RPC。
 * - 一個 session 每層只打一次 RPC（module-level cache）；靜態資料，不訂閱時間軸。林道整包抓（RPC 預留 p_bbox，之後要依畫面分批只改這裡）。
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

/** 撤權：清掉該層 module cache（含進行中的請求） */
export function clearIeCoillteCache(key: IeCoillteKey): void {
  const slot = slots[key];
  slot.generation += 1;
  slot.data = null;
  slot.inflight = null;
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
