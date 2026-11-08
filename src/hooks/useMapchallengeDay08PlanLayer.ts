import { useEffect } from "react";
import type { Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION, MAPCHALLENGE_DAY08_PLAN_CORNERS, MAPCHALLENGE_DAY08_PLAN_URL,
} from "../data/mapchallengeDay08Types";

/**
 * 30 天地圖挑戰 Day 8：1955 中和鄉都市計畫圖（單張 jpg，Mapbox image source＋raster layer，沒有 feature 可點）。
 * overlay 引擎只收 geojson／pmtiles，所以照 useHistoricalMapLayer 自己掛：
 * 插在底圖第一個 symbol 圖層下面（不蓋地名，Day 8 步行可及／選址等向量 overlay 一律在上），style.load 後重掛。
 */
const SOURCE_ID = "mapchallenge-day08-plan1955";
const LAYER_ID = "mapchallenge-day08-plan1955-raster";

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useMapchallengeDay08PlanLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      return;
    }
    const value = Math.max(0, Math.min(1, opacity));
    const mount = () => {
      const fresh = !map.getSource(SOURCE_ID);
      if (fresh) {
        map.addSource(SOURCE_ID, {
          type: "image", url: MAPCHALLENGE_DAY08_PLAN_URL, coordinates: MAPCHALLENGE_DAY08_PLAN_CORNERS,
        });
        // image source 型別沒有 attribution 欄位：補在 instance 上，右下 AttributionBar 才收得到
        const src = map.getSource(SOURCE_ID) as { attribution?: string } | undefined;
        if (src) src.attribution = MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION;
      }
      const wasVisible = map.getLayer(LAYER_ID) && map.getLayoutProperty(LAYER_ID, "visibility") === "visible";
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID, type: "raster", source: SOURCE_ID,
          layout: { visibility: "none" }, paint: { "raster-opacity": value, "raster-fade-duration": 0 },
        } as RasterLayer, firstSymbolLayerId(map));
      }
      map.setLayoutProperty(LAYER_ID, "visibility", "visible");
      map.setPaintProperty(LAYER_ID, "raster-opacity", value);
      if (fresh || !wasVisible) keepLoadingUntilMapIdle(map, `${SOURCE_ID}:render`, "1955 都市計畫圖載入中", SOURCE_ID, 8000);
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick]);
}
