import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { isAccessDenied } from "../lib/layerGates";
import { fetchGbEaPollution, isMissingGbEaPollutionRpc } from "../data/gbEaPollutionLoader";
import { GB_EA_POLLUTION_RPC, GB_EA_POLLUTION_SOURCE_ID } from "../data/gbEnvPlanningTypes";

/**
 * 英格蘭污染排放申報（站主限定）資料供應 hook。
 *
 * - **visible 才 fetch**：非站主開不了這層（App lockedKeys／handleGatedIntercept），所以永遠不會呼叫 RPC。
 * - 一個 session 只打一次 RPC（module-level cache）；靜態年度資料，不訂閱時間軸。
 * - 樣式全在 overlayRegistry（dynamicData），這裡只 setData。
 * - 無權限（42501）靜默；函式尚未部署（PGRST202）只記一次 info。
 */

let cache: GeoJSON.FeatureCollection | null = null;
let inflight: Promise<GeoJSON.FeatureCollection> | null = null;
let missingRpcLogged = false;

function loadOnce(): Promise<GeoJSON.FeatureCollection> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetchGbEaPollution()
    .then((fc) => {
      cache = fc;
      inflight = null;
      return fc;
    })
    .catch((err: unknown) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/** 測試用：清掉 module cache */
export function resetGbEaPollutionCacheForTest(): void {
  cache = null;
  inflight = null;
  missingRpcLogged = false;
}

export function useGbEaPollutionInventoryLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(cache);
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    loadOnce()
      .then((fc) => { if (!cancelled) setData(fc); })
      .catch((err: unknown) => {
        if (isAccessDenied(err)) return;
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
