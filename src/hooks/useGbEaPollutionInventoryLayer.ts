import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { fetchGbEaPollution, isMissingGbEaPollutionRpc } from "../data/gbEaPollutionLoader";
import { GB_EA_POLLUTION_RPC, GB_EA_POLLUTION_SOURCE_ID } from "../data/gbEnvPlanningTypes";

/**
 * 英格蘭污染排放申報（站主限定）資料供應 hook。
 *
 * - **visible 才 fetch**：非站主開不了這層（App lockedKeys／handleGatedIntercept），所以永遠不會呼叫 RPC。
 * - 一個 session 只打一次 RPC（module-level cache）；靜態年度資料，不訂閱時間軸。
 * - 樣式全在 overlayRegistry（dynamicData），這裡只 setData。
 * - 無權限（42501）靜默；函式尚未部署（PGRST202）只記一次 info。
 * - 撤權（登出／失去站主權限）時清掉 module cache 與 hook 內資料（lib/ownerGateRevoke，review F088）。
 */

let cache: GeoJSON.FeatureCollection | null = null;
let inflight: Promise<GeoJSON.FeatureCollection> | null = null;
let missingRpcLogged = false;
/** 撤權時遞增：撤權前發出、撤權後才回來的請求不得寫回 cache */
let generation = 0;

function loadOnce(): Promise<GeoJSON.FeatureCollection> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  const gen = generation;
  const p = fetchGbEaPollution()
    .then((fc) => {
      if (gen !== generation) throw new Error("[GbEaPollution] access revoked");
      cache = fc;
      inflight = null;
      return fc;
    })
    .catch((err: unknown) => {
      if (inflight === p) inflight = null;
      throw err;
    });
  inflight = p;
  return p;
}

/** 撤權：清掉 module cache（含進行中的請求） */
export function clearGbEaPollutionCache(): void {
  generation += 1;
  cache = null;
  inflight = null;
}

/** 測試用：清掉 module cache */
export function resetGbEaPollutionCacheForTest(): void {
  clearGbEaPollutionCache();
  missingRpcLogged = false;
}

const GB_EA_POLLUTION_LAYER_KEY = "gbPollutionInventoryEngland";

export function useGbEaPollutionInventoryLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(cache);
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => registerOwnerGateReset([GB_EA_POLLUTION_LAYER_KEY], () => {
    clearGbEaPollutionCache();
    setData(null);
  }), []);

  useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    loadOnce()
      .then((fc) => { if (!cancelled) setData(fc); })
      .catch((err: unknown) => {
        if (cancelled || isAccessDenied(err)) return;
        if (isMissingGbEaPollutionRpc(err)) {
          if (!missingRpcLogged) console.info(`[GbEaPollution] ${GB_EA_POLLUTION_RPC} 尚未部署，圖層暫無資料`);
          missingRpcLogged = true;
          return;
        }
        console.warn("[GbEaPollution] load failed:", err);
      });
    return () => { cancelled = true; };
  }, [visible, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !data) return;
    const feed = feedDynamicSource(map, GB_EA_POLLUTION_SOURCE_ID);
    feed.set(data);
    return () => feed.dispose();
  }, [mapRef, mapTick, visible, data]);
}
