import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import {
  fetchPollingHeat,
  fetchPollingStations,
  isMissingPollingRpc,
  pollingBoundsKey,
  setPollingLegendState,
  snapPollingBounds,
  type PollingBounds,
  type PollingStationsMeta,
} from "../data/pollingStationsLoader";
import { POLLING_MIN_ZOOM } from "../data/pollingStationsTypes";

/**
 * 2024 投開票所（公開）資料供應 hook：依地圖視窗 bbox 即時查 Supabase RPC。
 *
 * - moveend 後 debounce 300ms 才查；zoom < POLLING_MIN_ZOOM 不查（圖層本身 minzoom 同值，不畫）。
 * - 快取鍵＝對齊 0.02° 格網的 bbox（loader 端 LRU）；同一鍵不重查、不 setData。
 * - 新請求會 abort 上一個還在跑的；回來的若已過期（被 abort 或 effect 已清理）直接丟掉。
 * - 函式尚未部署（PGRST202）只記一次 info；樣式全在 overlayRegistry。
 * - 低縮放熱區：開圖層時抓一次全臺熱區點（get_polling_stations_2024_heat，loader session 快取）餵 HEAT_SOURCE_ID；
 *   zoom 交接（熱區淡出／點位淡入）全在 paint 的 zoom 表達式，不在這裡切。
 */

const SOURCE_ID = "polling-stations-2024";
const HEAT_SOURCE_ID = "polling-stations-2024-heat";
const DEBOUNCE_MS = 300;

let missingRpcLogged = false;
let missingHeatRpcLogged = false;

function viewBounds(map: MapboxMap): PollingBounds | null {
  const b = map.getBounds();
  if (!b) return null;
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

export function usePollingStationsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const feed = feedDynamicSource(map, SOURCE_ID);
    const heatFeed = feedDynamicSource(map, HEAT_SOURCE_ID);
    let disposed = false;
    fetchPollingHeat()
      .then((h) => {
        if (disposed) return;
        heatFeed.set(h.fc);
        keepLoadingUntilMapIdle(map, "polling:stations2024:heat:render", "2024 投開票所熱區繪製", null);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        if (isMissingPollingRpc(err)) {
          if (!missingHeatRpcLogged) console.info("[PollingStations] get_polling_stations_2024_heat 尚未部署，熱區暫無資料");
          missingHeatRpcLogged = true;
          return;
        }
        console.warn("[PollingStations] heat load failed:", err);
      });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let shownKey: string | null = null;
    let shownMeta: PollingStationsMeta | null = null;

    const run = () => {
      timer = undefined;
      if (disposed) return;
      if (map.getZoom() < POLLING_MIN_ZOOM) {
        controller?.abort();
        controller = null;
        setPollingLegendState({ meta: shownMeta, belowMinZoom: true });
        return;
      }
      const bounds = viewBounds(map);
      if (!bounds) return;
      const key = pollingBoundsKey(snapPollingBounds(bounds));
      if (key === shownKey) {
        setPollingLegendState({ meta: shownMeta, belowMinZoom: false });
        return;
      }
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      fetchPollingStations(bounds, ctrl.signal)
        .then((d) => {
          if (disposed || ctrl.signal.aborted) return;
          shownKey = key;
          shownMeta = d.meta;
          feed.set(d.fc);
          setPollingLegendState({ meta: d.meta, belowMinZoom: false });
          keepLoadingUntilMapIdle(map, "polling:stations2024:render", "2024 投開票所繪製", null);
        })
        .catch((err: unknown) => {
          if (disposed || ctrl.signal.aborted || (err as { name?: string } | null)?.name === "AbortError") return;
          if (isMissingPollingRpc(err)) {
            if (!missingRpcLogged) console.info("[PollingStations] get_polling_stations_2024 尚未部署，圖層暫無資料");
            missingRpcLogged = true;
            return;
          }
          console.warn("[PollingStations] load failed:", err);
        });
    };
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    };

    map.on("moveend", schedule);
    run();
    return () => {
      disposed = true;
      map.off("moveend", schedule);
      if (timer !== undefined) clearTimeout(timer);
      controller?.abort();
      feed.dispose();
      heatFeed.dispose();
    };
  }, [mapRef, mapTick, visible]);
}
