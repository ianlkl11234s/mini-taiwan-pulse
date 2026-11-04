import { useEffect } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { paramDefault } from "../data/layerParamsSpec";
import { BOUNDARY_GRAY } from "../map/mapStyleScale";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { CA_ADMIN_COLOR, CA_ADMIN_LEVELS } from "../data/caInfraTypes";

/**
 * 加拿大行政邊界（第 0 波 C001，StatCan 2021 CBF）：ca_admin_boundaries.pmtiles 一個 source、三個 tile layer（pr／cd／csd）。
 * 照台灣行政界（design-system map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；透明度滑桿管線。
 * 「行政層級」select 一次只顯示一層，其他兩層整層隱藏，popup 不會重複命中。
 */
const KEY = "caAdminBoundaries";
const SOURCE_ID = "ca-admin-boundaries";
const FILE = "ca_admin_boundaries.pmtiles";
const LINE_WIDTH = 1;

// layer id 寫成字面值：gisClickRegistry／lineFillTiers 的契約測試以字面值比對。順序＝CA_ADMIN_LEVELS（pr、cd、csd）。
const subLayers = [
  { sourceLayer: "pr", minzoom: CA_ADMIN_LEVELS[0].minzoom, fillId: "ca-admin-pr-fill", lineId: "ca-admin-pr-line" },
  { sourceLayer: "cd", minzoom: CA_ADMIN_LEVELS[1].minzoom, fillId: "ca-admin-cd-fill", lineId: "ca-admin-cd-line" },
  { sourceLayer: "csd", minzoom: CA_ADMIN_LEVELS[2].minzoom, fillId: "ca-admin-csd-fill", lineId: "ca-admin-csd-line" },
] as const;

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

/** `levelIdx`：0＝省／地區、1＝普查區 CD、2＝普查分區 CSD（`CA_ADMIN_LEVELS` 順序）。 */
export function useCaAdminLayers(
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
        map.addSource(SOURCE_ID, { type: PMTILES_SOURCE_TYPE, url: absoluteUrl(FILE), minzoom: 1, maxzoom: 11 } as any);
      }
      subLayers.forEach((sub, idx) => {
        if (!map.getLayer(sub.fillId)) {
          map.addLayer({
            id: sub.fillId, type: "fill", source: SOURCE_ID, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none" },
            // 面透明度 0：只當點擊熱區（map-layers §2.4 行政界）
            paint: { "fill-color": CA_ADMIN_COLOR, "fill-opacity": 0 },
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
