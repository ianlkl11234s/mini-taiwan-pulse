import { useEffect } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { jpPopulationMeshFillColor } from "../data/jpPopulationMeshModes";

const SOURCE_ID = "jp-population-mesh";
const SOURCE_LAYER = "jp_population_mesh_1km";
const LAYER_ID = "jp-population-mesh-fill";
const FILE = "jp_population_mesh_1km.pmtiles";
const MINZOOM = 4;
// ⚠️ 產製配方是 tippecanoe -Z4 -z11 —— 沒有 z12 以上的磚。
//    source 寫 11、圖層不設 maxzoom，讓 z12+ overzoom z11 而不是整層消失。
const MAXZOOM = 11;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

// outline 0：176,896 格 1km 網格，畫框線會糊成一片灰、也吃掉 choropleth 的顏色辨識度
// （見 handoff 對本層的 UX 指定）→ 只加 fill 子層，不加 line 子層。
function meshFillLayer(opacity: number, modeIdx: number): FillLayer {
  return {
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    layout: { visibility: "none" },
    paint: {
      "fill-color": jpPopulationMeshFillColor(modeIdx),
      "fill-opacity": clampOpacity(opacity),
    },
  } as FillLayer;
}

/**
 * 日本 1km 人口網格：單一 PMTiles polygon choropleth。
 * 9 種指標／年份靠 `modeIdx` 切換 —— 走 `setPaintProperty("fill-color", …)`
 * 重設表達式（比照 useJpStationsLayer 的模式切換），**不重建 source**。
 */
export function useJpPopulationMeshLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  modeIdx: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer(meshFillLayer(opacity, modeIdx));
      }
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "fill-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "fill-color", jpPopulationMeshFillColor(modeIdx));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, modeIdx, mapTick]);
}
