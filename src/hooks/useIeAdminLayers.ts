import { useEffect } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { paramDefault } from "../data/layerParamsSpec";
import { BOUNDARY_GRAY } from "../map/mapStyleScale";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { IE_ADMIN_COLOR, IE_ADMIN_LEVELS } from "../data/ieAdminTypes";

/**
 * 愛爾蘭行政邊界（第 0 波 C001，Tailte LA 2026＋CSO ED／SA 2022）：ie_admin_boundaries.pmtiles 一個檔、三個 tile layer（la／ed／sa）。
 * 照台灣行政界（design-system map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；透明度滑桿管線。
 * 「行政層級」select 一次只顯示一層，其他兩層整層隱藏，popup 不會重複命中。
 */
const KEY = "ieAdminBoundaries";
const SOURCE_ID = "ie-admin-boundaries";
const FILE = "ie_admin_boundaries.pmtiles";
const LINE_WIDTH = 1;

// 檔內各 tile layer 的實際縮放範圍不同（la 3–10、ed 5–12、sa 6–13；比照 useCaAdminLayers）。高縮放圖磚只含 sa，若三層共用同一
// maxzoom 的 source，la／ed 在高縮放抓不到圖磚就消失；因此每層各用一個 source（同一個檔），maxzoom 對齊該層上限，更高縮放改由 overzoom。
// layer id 寫成字面值：gisClickRegistry／lineFillTiers 的契約測試以字面值比對。順序＝IE_ADMIN_LEVELS（la、ed、sa）。
const subLayers = [
  { sourceLayer: "la", sourceId: "ie-admin-boundaries-la", srcMinzoom: 3, srcMaxzoom: 10, minzoom: IE_ADMIN_LEVELS[0].minzoom, fillId: "ie-admin-la-fill", lineId: "ie-admin-la-line" },
  { sourceLayer: "ed", sourceId: "ie-admin-boundaries-ed", srcMinzoom: 5, srcMaxzoom: 12, minzoom: IE_ADMIN_LEVELS[1].minzoom, fillId: "ie-admin-ed-fill", lineId: "ie-admin-ed-line" },
  { sourceLayer: "sa", sourceId: SOURCE_ID, srcMinzoom: 6, srcMaxzoom: 13, minzoom: IE_ADMIN_LEVELS[2].minzoom, fillId: "ie-admin-sa-fill", lineId: "ie-admin-sa-line" },
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

/** `levelIdx`：0＝地方政府 LA、1＝選舉分區 ED、2＝統計小區 SA（`IE_ADMIN_LEVELS` 順序）。 */
export function useIeAdminLayers(
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
      subLayers.forEach((sub, idx) => {
        if (!map.getSource(sub.sourceId)) {
          map.addSource(sub.sourceId, { type: PMTILES_SOURCE_TYPE, url: absoluteUrl(FILE), minzoom: sub.srcMinzoom, maxzoom: sub.srcMaxzoom } as any);
        }
        if (!map.getLayer(sub.fillId)) {
          map.addLayer({
            id: sub.fillId, type: "fill", source: sub.sourceId, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none" },
            // 面透明度 0：只當點擊熱區（map-layers §2.4 行政界）
            paint: { "fill-color": IE_ADMIN_COLOR, "fill-opacity": 0 },
          } as FillLayer);
        }
        if (!map.getLayer(sub.lineId)) {
          map.addLayer({
            id: sub.lineId, type: "line", source: sub.sourceId, "source-layer": sub.sourceLayer, minzoom: sub.minzoom,
            layout: { visibility: "none", ...hookLineLayout(KEY, sub.lineId) },
            paint: linePaint(sub.lineId, isDarkTheme, opacity),
          } as LineLayer);
        }
        const shown = idx === levelIdx;
        map.setLayoutProperty(sub.fillId, "visibility", shown ? "visible" : "none");
        map.setLayoutProperty(sub.lineId, "visibility", shown ? "visible" : "none");
        // 只對目前顯示、尚未載完的 source 註冊 loading（切換層級時新 source 也要有提示）
        if (shown && !map.isSourceLoaded(sub.sourceId)) keepLoadingUntilMapIdle(map, `${sub.sourceId}:render`, "愛爾蘭行政邊界載入中", sub.sourceId);
        map.setPaintProperty(sub.lineId, "line-opacity", hookLineOpacity(KEY, sub.lineId, clamp01(opacity), opacityDefault(), isDarkTheme));
        map.setPaintProperty(sub.lineId, "line-color", BOUNDARY_GRAY[isDarkTheme ? "dark" : "light"]);
      });
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, levelIdx, mapTick, isDarkTheme]);
}
