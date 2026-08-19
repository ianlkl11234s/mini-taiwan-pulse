import { useEffect } from "react";
import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 坡向分級（8 方位 + 平地）靜態向量圖層 — aspect_vector.pmtiles polygon。
 *
 * 資料來源：taipei-gis-analytics 產出的 base_map/aspect_vector.pmtiles
 *   source-layer = "aspect"，屬性 aspect_class 整數 1-9（zoom 5-12）。
 * 與既有 aspect PNG raster 並存：此為可點選 / 可疊圖分析的向量版。
 * fill-color 依 aspect_class match 染色（環狀 HSV，對齊既有 aspect PNG）。
 */

const SOURCE_ID = "aspect-vector";
const SOURCE_LAYER = "aspect";
const SOURCE_URL = "./base_map/aspect_vector.pmtiles";
const FILL_LAYER = "aspect-vector-fill";

// aspect_class 1-9 → 環狀 HSV（N=紅 E=黃 S=綠 W=藍，9=平地灰）；無值 fallback 灰
const COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "aspect_class"],
  1, "#e41a1c",
  2, "#ff7f00",
  3, "#ffde00",
  4, "#a6d854",
  5, "#4daf4a",
  6, "#20b2aa",
  7, "#377eb8",
  8, "#984ea3",
  9, "#bdbdbd",
  "#808080",
] as unknown as ExpressionSpecification;

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

export function useAspectVectorLayer(
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
      try { if (map) setVis(map, FILL_LAYER, false); } catch { /* map 可能已銷毀 */ }
    };
    // styleId 進 deps：底圖 style 切換時 effect 重跑 → 重新 ensureLayer（走與手動 re-toggle
    // 相同的成功路徑）。diff setStyle 會移除自訂圖層且 event listener 重掛不可靠，改靠 React 重跑。
  }, [mapRef, visible, opacity, styleId, mapTick]);
}
