import { useEffect } from "react";
import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 坡度分級（建管六級坡）靜態向量圖層 — slope_vector.pmtiles polygon。
 *
 * 資料來源：taipei-gis-analytics 產出的 base_map/slope_vector.pmtiles
 *   source-layer = "slope"，屬性 slope_class 整數 1-6（zoom 5-12）。
 * 與既有 slope PNG raster 並存：此為可點選 / 可疊圖分析的向量版。
 * fill-color 依 slope_class match 染色（與 LegendPanel SlopeVectorLegend 同色）。
 */

const SOURCE_ID = "slope-vector";
const SOURCE_LAYER = "slope";
const SOURCE_URL = "./base_map/slope_vector.pmtiles";
const FILL_LAYER = "slope-vector-fill";

// slope_class 1-6 → 建管六級坡色階（綠→紅）；無值 fallback 灰
const COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "slope_class"],
  1, "#1a9850",
  2, "#66bd63",
  3, "#d9ef8b",
  4, "#fee08b",
  5, "#fc8d59",
  6, "#d73027",
  "#808080",
] as unknown as ExpressionSpecification;

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

export function useSlopeVectorLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  styleId: string,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayer = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;

      if (!visible) {
        setVis(map, FILL_LAYER, false);
        return true;
      }

      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: SOURCE_URL,
          minzoom: 5,
          maxzoom: 12,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(FILL_LAYER)) {
        map.addLayer({
          id: FILL_LAYER,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 5,
          paint: {
            "fill-color": COLOR_EXPR,
            "fill-opacity": opacity,
            "fill-antialias": false,
          },
        });
      } else {
        map.setPaintProperty(FILL_LAYER, "fill-opacity", opacity);
      }
      setVis(map, FILL_LAYER, true);
      return true;
    };

    const retry = () => {
      if (ensureLayer() && retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    retry();
    if (!map || !safeIsStyleLoaded(map)) retryTimer = setInterval(retry, 200);

    const onStyleLoad = () => {
      if (!cancelled) setTimeout(retry, 0);
    };
    const bindTimer = setInterval(() => {
      const nextMap = mapRef.current;
      if (!nextMap || nextMap === map) return;
      map?.off("style.load", onStyleLoad);
      map = nextMap;
      map.on("style.load", onStyleLoad);
      retry();
    }, 200);
    const initialMap = map as MapboxMap | null;
    if (initialMap) initialMap.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      clearInterval(bindTimer);
      map?.off("style.load", onStyleLoad);
      if (map) setVis(map, FILL_LAYER, false);
    };
    // styleId 進 deps：底圖 style 切換時 effect 重跑 → 重新 ensureLayer（走與手動 re-toggle
    // 相同的成功路徑）。diff setStyle 會移除自訂圖層且 event listener 重掛不可靠，改靠 React 重跑。
  }, [mapRef, visible, opacity, styleId, mapTick]);
}
