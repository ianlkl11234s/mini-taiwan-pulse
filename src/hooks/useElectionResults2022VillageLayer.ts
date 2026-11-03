import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import {
  fetchVillageResults,
  setVillageLegendState,
  snapVillageBounds,
  villageCacheKey,
  villageQueryZoom,
  type VillageBounds,
  type VillageResultsMeta,
} from "../data/electionResults2022Loader";
import { isMissingPollingRpc } from "../data/pollingStationsLoader";
import { VILLAGE_RESULTS_MIN_ZOOM } from "../data/electionResults2022Types";

/**
 * 2022 村里得票（公開）資料供應 hook：依地圖視窗 bbox ＋整數 zoom 即時查 Supabase RPC。
 *
 * - moveend 後 debounce 400ms 才查；zoom < 8 不查（圖層 minzoom 同值，不畫）。
 * - 快取鍵＝整數 zoom ＋ 依 zoom 對齊的 bbox（loader 端 LRU）；同鍵不重查、不 setData。
 *   跨整數 zoom 會換鍵重查（RPC 依 zoom 簡化幾何；z≥10 才有完整欄位）。
 * - 新請求 abort 上一個；回來的若已過期直接丟掉。樣式全在 overlayRegistry。
 */

const SOURCE_ID = "election-results-2022-village";
const DEBOUNCE_MS = 400;
let missingRpcLogged = false;

function viewBounds(map: MapboxMap): VillageBounds | null {
  const b = map.getBounds();
  if (!b) return null;
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

export function useElectionResults2022VillageLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const feed = feedDynamicSource(map, SOURCE_ID);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let shownKey: string | null = null;
    let shownMeta: VillageResultsMeta | null = null;

    const run = () => {
      timer = undefined;
      if (disposed) return;
      const zoom = map.getZoom();
      if (zoom < VILLAGE_RESULTS_MIN_ZOOM) {
        controller?.abort();
        controller = null;
        setVillageLegendState({ meta: shownMeta, belowMinZoom: true });
        return;
      }
      const bounds = viewBounds(map);
      if (!bounds) return;
      const qz = villageQueryZoom(zoom);
      const key = villageCacheKey(snapVillageBounds(bounds, qz), qz);
      if (key === shownKey) {
        setVillageLegendState({ meta: shownMeta, belowMinZoom: false });
        return;
      }
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      fetchVillageResults(bounds, zoom, ctrl.signal)
        .then((d) => {
          if (disposed || ctrl.signal.aborted) return;
          shownKey = key;
          shownMeta = d.meta;
          feed.set(d.fc);
          setVillageLegendState({ meta: d.meta, belowMinZoom: false });
          keepLoadingUntilMapIdle(map, "politics:village2022:render", "2022 村里得票繪製", null);
        })
        .catch((err: unknown) => {
          if (disposed || ctrl.signal.aborted || (err as { name?: string } | null)?.name === "AbortError") return;
          if (isMissingPollingRpc(err)) {
            if (!missingRpcLogged) console.info("[ElectionResults2022] get_election_results_2022_village 尚未部署，圖層暫無資料");
            missingRpcLogged = true;
            return;
          }
          console.warn("[ElectionResults2022] load failed:", err);
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
    };
  }, [mapRef, mapTick, visible]);
}
