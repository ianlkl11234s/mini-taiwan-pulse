import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { fetchCouncilDistricts } from "../data/councilDistrictsLoader";
import { isMissingPollingRpc } from "../data/pollingStationsLoader";

/**
 * 2026 議員選區（公開）資料供應 hook：開圖層時抓一次全臺選區（get_council_districts_2026，loader session 快取）
 * 後 setData。樣式全在 overlayRegistry。
 */

const SOURCE_ID = "council-districts-2026";
let missingRpcLogged = false;

export function useCouncilDistrictsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const feed = feedDynamicSource(map, SOURCE_ID);
    let disposed = false;
    fetchCouncilDistricts()
      .then((d) => {
        if (disposed) return;
        feed.set(d.fc);
        keepLoadingUntilMapIdle(map, "politics:councilDistricts2026:render", "2026 議員選區繪製", null);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        if (isMissingPollingRpc(err)) {
          if (!missingRpcLogged) console.info("[CouncilDistricts] get_council_districts_2026 尚未部署，圖層暫無資料");
          missingRpcLogged = true;
          return;
        }
        console.warn("[CouncilDistricts] load failed:", err);
      });
    return () => {
      disposed = true;
      feed.dispose();
    };
  }, [mapRef, mapTick, visible]);
}
