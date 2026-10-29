import { useEffect } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer, FilterSpecification } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { paramDefault } from "../data/layerParamsSpec";
import { BOUNDARY_GRAY } from "../map/mapStyleScale";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { GB_ADMIN_LAD_COLOR, GB_SMALL_AREA_COLOR } from "../data/gbAdminTypes";

/**
 * 英國行政邊界（第 0b 波 C001）：LAD（gb_admin_lad.pmtiles）與四地統計小區（gb_admin_small_areas.pmtiles）。
 * 照台灣行政界（design-system map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；透明度滑桿管線。
 * 小區檔有兩個 tile layer：`small_areas`（LSOA21＋DZ22＋DZ21）與 `ni_sdz`（北愛 SDZ21）。
 * 北愛 DZ 與 SDZ 空間完全重疊，只能擇一顯示（select「北愛層級」）；另一個整層隱藏，popup 不會重複命中。
 */
type GbAdminKey = "gbAdminBoundaries" | "gbSmallAreaBoundaries";

export const GB_LAD_FILL_LAYER_ID = "gb-admin-lad-fill";
export const GB_LAD_LINE_LAYER_ID = "gb-admin-lad-line";
export const GB_SMALL_AREA_FILL_LAYER_ID = "gb-small-areas-fill";
export const GB_SMALL_AREA_LINE_LAYER_ID = "gb-small-areas-line";
export const GB_NI_SDZ_FILL_LAYER_ID = "gb-ni-sdz-fill";
export const GB_NI_SDZ_LINE_LAYER_ID = "gb-ni-sdz-line";

const LAD_SOURCE_ID = "gb-admin-lad";
const SMALL_AREA_SOURCE_ID = "gb-admin-small-areas";

const LINE_WIDTH = 1;

interface SubLayer {
  fillId: string;
  lineId: string;
  sourceLayer: string;
  minzoom: number;
  /** 依北愛層級（0＝DZ、1＝SDZ）決定是否顯示、要套的 filter */
  visibleFor: (niLevel: number) => boolean;
  filter: (niLevel: number) => FilterSpecification | null;
}

interface GbAdminConfig {
  key: GbAdminKey;
  sourceId: string;
  file: string;
  minzoom: number;
  maxzoom: number;
  color: string;
  subLayers: SubLayer[];
}

const LAD_CONFIG: GbAdminConfig = {
  key: "gbAdminBoundaries",
  sourceId: LAD_SOURCE_ID,
  file: "gb_admin_lad.pmtiles",
  minzoom: 2,
  maxzoom: 12,
  color: GB_ADMIN_LAD_COLOR,
  subLayers: [{
    fillId: GB_LAD_FILL_LAYER_ID, lineId: GB_LAD_LINE_LAYER_ID, sourceLayer: "gb_admin_lad", minzoom: 4,
    visibleFor: () => true, filter: () => null,
  }],
};

const SMALL_AREA_CONFIG: GbAdminConfig = {
  key: "gbSmallAreaBoundaries",
  sourceId: SMALL_AREA_SOURCE_ID,
  file: "gb_admin_small_areas.pmtiles",
  minzoom: 8,
  maxzoom: 13,
  color: GB_SMALL_AREA_COLOR,
  subLayers: [
    {
      fillId: GB_SMALL_AREA_FILL_LAYER_ID, lineId: GB_SMALL_AREA_LINE_LAYER_ID, sourceLayer: "small_areas", minzoom: 8,
      visibleFor: () => true,
      // 選 SDZ 時把北愛 DZ21 濾掉，改由 ni_sdz 子層畫
      filter: (niLevel) => (niLevel === 1 ? ["!=", ["get", "area_type"], "DZ21"] : null),
    },
    {
      fillId: GB_NI_SDZ_FILL_LAYER_ID, lineId: GB_NI_SDZ_LINE_LAYER_ID, sourceLayer: "ni_sdz", minzoom: 8,
      visibleFor: (niLevel) => niLevel === 1, filter: () => null,
    },
  ],
};

const opacityDefault = (key: GbAdminKey) => Number(paramDefault(key, `${key}Opacity`) ?? 0.85);

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function linePaint(key: GbAdminKey, id: string, isDarkTheme: boolean, opacity: number) {
  const color = BOUNDARY_GRAY[isDarkTheme ? "dark" : "light"];
  const def = opacityDefault(key);
  return {
    ...hookLinePaint(key, id, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": LINE_WIDTH }, { "line-color": color, "line-opacity": def, "line-width": LINE_WIDTH }, isDarkTheme),
    // L-5：行政界一律中性灰（暗／淡切換），不吃類別色
    "line-color": color,
  };
}

function useGbAdminLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  niLevel: number,
  config: GbAdminConfig,
  isDarkTheme: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hideAll = () => {
      for (const sub of config.subLayers) {
        if (map.getLayer(sub.fillId)) map.setLayoutProperty(sub.fillId, "visibility", "none");
        if (map.getLayer(sub.lineId)) map.setLayoutProperty(sub.lineId, "visibility", "none");
      }
    };
    if (!visible) {
      hideAll();
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(config.sourceId)) {
        map.addSource(config.sourceId, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(config.file),
          minzoom: config.minzoom,
          maxzoom: config.maxzoom,
        } as any);
      }
      for (const sub of config.subLayers) {
        if (!map.getLayer(sub.fillId)) {
          map.addLayer({
            id: sub.fillId, type: "fill", source: config.sourceId, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none" },
            // 面透明度 0：只當點擊熱區（map-layers §2.4 行政界）
            paint: { "fill-color": config.color, "fill-opacity": 0 },
          } as FillLayer);
        }
        if (!map.getLayer(sub.lineId)) {
          map.addLayer({
            id: sub.lineId, type: "line", source: config.sourceId, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none", ...hookLineLayout(config.key, sub.lineId) },
            paint: linePaint(config.key, sub.lineId, isDarkTheme, opacity),
          } as LineLayer);
        }
        const shown = sub.visibleFor(niLevel);
        const filter = sub.filter(niLevel);
        for (const id of [sub.fillId, sub.lineId]) {
          map.setLayoutProperty(id, "visibility", shown ? "visible" : "none");
          map.setFilter(id, filter);
        }
        map.setPaintProperty(sub.lineId, "line-opacity", hookLineOpacity(config.key, sub.lineId, clamp01(opacity), opacityDefault(config.key), isDarkTheme));
        map.setPaintProperty(sub.lineId, "line-color", BOUNDARY_GRAY[isDarkTheme ? "dark" : "light"]);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, niLevel, mapTick, config, isDarkTheme]);
}

export interface GbAdminLayerState {
  visible: boolean;
  opacity: number;
}

/** LAD 與統計小區兩個獨立的 PMTiles polygon 圖層。`niLevel`：0＝北愛 Data Zone、1＝Super Data Zone。 */
export function useGbAdminLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  lad: GbAdminLayerState,
  smallAreas: GbAdminLayerState & { niLevel: number },
  isDarkTheme = true,
) {
  useGbAdminLayer(mapRef, lad.visible, lad.opacity, 0, LAD_CONFIG, isDarkTheme);
  useGbAdminLayer(mapRef, smallAreas.visible, smallAreas.opacity, smallAreas.niLevel, SMALL_AREA_CONFIG, isDarkTheme);
}
