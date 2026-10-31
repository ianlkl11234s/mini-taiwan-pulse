import { useEffect } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { paramDefault } from "../data/layerParamsSpec";
import { BOUNDARY_GRAY } from "../map/mapStyleScale";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { KR_ADMIN_COLOR, KR_ADMIN_LEVELS } from "../data/krAdminTypes";

/**
 * 南韓行政邊界（第 0 波 C001）：kr_admin_boundaries.pmtiles 一個 source、三個 tile layer（sido／sgg／emd）。
 * 照台灣行政界（design-system map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；透明度滑桿管線。
 * 「行政層級」select 一次只顯示一層，其他兩層整層隱藏，popup 不會重複命中。
 */
const KEY = "krAdminBoundaries";
const SOURCE_ID = "kr-admin-boundaries";
const FILE = "kr_admin_boundaries.pmtiles";
const LINE_WIDTH = 1;

export const KR_ADMIN_FILL_LAYER_IDS = KR_ADMIN_LEVELS.map((level) => `kr-admin-${level.value}-fill`);
const subLayers = KR_ADMIN_LEVELS.map((level) => ({
  sourceLayer: level.value,
  minzoom: level.minzoom,
  fillId: `kr-admin-${level.value}-fill`,
  lineId: `kr-admin-${level.value}-line`,
}));

const opacityDefault = () => Number(paramDefault(KEY, `${KEY}Opacity`) ?? 0.85);

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function linePaint(id: string, isDarkTheme: boolean, opacity: number) {
  const color = BOUNDARY_GRAY[isDarkTheme ? "dark" : "light"];
  const def = opacityDefault();
  return {
    ...hookLinePaint(KEY, id, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": LINE_WIDTH }, { "line-color": color, "line-opacity": def, "line-width": LINE_WIDTH }, isDarkTheme),
    // L-5：行政界一律中性灰（暗／淡切換），不吃類別色
    "line-color": color,
  };
}

/** `levelIdx`：0＝시·도、1＝시군구、2＝행정동（`KR_ADMIN_LEVELS` 順序）。 */
export function useKrAdminLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  levelIdx: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const sub of subLayers) {
        if (map.getLayer(sub.fillId)) map.setLayoutProperty(sub.fillId, "visibility", "none");
        if (map.getLayer(sub.lineId)) map.setLayoutProperty(sub.lineId, "visibility", "none");
      }
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: PMTILES_SOURCE_TYPE, url: absoluteUrl(FILE), minzoom: 2, maxzoom: 12 } as any);
      }
      subLayers.forEach((sub, idx) => {
        if (!map.getLayer(sub.fillId)) {
          map.addLayer({
            id: sub.fillId, type: "fill", source: SOURCE_ID, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none" },
            // 面透明度 0：只當點擊熱區（map-layers §2.4 行政界）
            paint: { "fill-color": KR_ADMIN_COLOR, "fill-opacity": 0 },
          } as FillLayer);
        }
        if (!map.getLayer(sub.lineId)) {
          map.addLayer({
            id: sub.lineId, type: "line", source: SOURCE_ID, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none", ...hookLineLayout(KEY, sub.lineId) },
            paint: linePaint(sub.lineId, isDarkTheme, opacity),
          } as LineLayer);
        }
        const shown = idx === levelIdx;
        map.setLayoutProperty(sub.fillId, "visibility", shown ? "visible" : "none");
        map.setLayoutProperty(sub.lineId, "visibility", shown ? "visible" : "none");
        map.setPaintProperty(sub.lineId, "line-opacity", hookLineOpacity(KEY, sub.lineId, clamp01(opacity), opacityDefault(), isDarkTheme));
        map.setPaintProperty(sub.lineId, "line-color", BOUNDARY_GRAY[isDarkTheme ? "dark" : "light"]);
      });
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, levelIdx, mapTick, isDarkTheme]);
}
