import { useEffect } from "react";
import type { LineLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, LINE_WIDTH } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_MARITIME_ATTRIBUTION, GB_MARITIME_CLOSING_KINDS, GB_MARITIME_CLOSING_MINZOOM, GB_MARITIME_DASHED_KINDS,
  GB_MARITIME_FALLBACK_COLOR, GB_MARITIME_LIMIT_TYPES, GB_MARITIME_SOLID_KINDS, gbMaritimeLimitColor,
  type GbMaritimeLimitKind,
} from "../data/gbMaritimeLimitTypes";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 英國海域界線（第 1 波 C002，UKHO）：PMTiles line，依 `limit_type` 分色分寬。
 * L-5 法定／海域界：類別色、尖角（butt／miter）；L-2 虛線 `[4,3]` 只給大陸棚與四地分區線。
 * `line-dasharray` 不能 data-driven → 實線、虛線、封口線（z8 起）三個子層。
 */
const KEY = "gbMaritimeLimits";
const SOURCE_ID = "gb-maritime-limits";
const SOURCE_LAYER = "gb_maritime_limits";
const FILE = "gb_maritime_limits.pmtiles";
const MINZOOM = 2;
const MAXZOOM = 10;
const LAYER_MINZOOM = 3;

export const GB_MARITIME_SOLID_LAYER_ID = "gb-maritime-limits-line";
export const GB_MARITIME_DASHED_LAYER_ID = "gb-maritime-limits-dashed";
export const GB_MARITIME_CLOSING_LAYER_ID = "gb-maritime-limits-closing";

interface SubLayer { id: string; kinds: GbMaritimeLimitKind[]; minzoom: number; dashed: boolean }
const SUB_LAYERS: SubLayer[] = [
  { id: GB_MARITIME_CLOSING_LAYER_ID, kinds: GB_MARITIME_CLOSING_KINDS, minzoom: GB_MARITIME_CLOSING_MINZOOM, dashed: false },
  { id: GB_MARITIME_DASHED_LAYER_ID, kinds: GB_MARITIME_DASHED_KINDS, minzoom: LAYER_MINZOOM, dashed: true },
  { id: GB_MARITIME_SOLID_LAYER_ID, kinds: GB_MARITIME_SOLID_KINDS, minzoom: LAYER_MINZOOM, dashed: false },
];

const OPACITY_DEFAULT = Number(paramDefault(KEY, `${KEY}Opacity`) ?? 0.85);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function colorExpr(kinds: GbMaritimeLimitKind[], isDark: boolean): unknown[] {
  const expr: unknown[] = ["match", ["get", "limit_type"]];
  for (const type of GB_MARITIME_LIMIT_TYPES) if (kinds.includes(type.value)) expr.push(type.value, gbMaritimeLimitColor(type, isDark));
  expr.push(GB_MARITIME_FALLBACK_COLOR);
  return expr;
}

/** L-1 線寬依類別：z10／z14 兩點插值，輸出是 data-driven match。 */
function widthExpr(kinds: GbMaritimeLimitKind[]): unknown[] {
  const at = (idx: 0 | 1) => {
    const expr: unknown[] = ["match", ["get", "limit_type"]];
    for (const type of GB_MARITIME_LIMIT_TYPES) if (kinds.includes(type.value)) expr.push(type.value, LINE_WIDTH[type.width][idx]);
    expr.push(LINE_WIDTH.thin[idx]);
    return expr;
  };
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

function linePaint(sub: SubLayer, isDark: boolean, opacity: number) {
  const base = {
    "line-color": colorExpr(sub.kinds, isDark),
    "line-width": widthExpr(sub.kinds),
    "line-opacity": clamp01(opacity),
    ...(sub.dashed ? { "line-dasharray": [...LINE_DASH.boundary] } : {}),
  };
  return hookLinePaint(KEY, sub.id, base, { ...base, "line-opacity": OPACITY_DEFAULT }, isDark);
}

export function useGbMaritimeLimitsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const sub of SUB_LAYERS) if (map.getLayer(sub.id)) map.setLayoutProperty(sub.id, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(SOURCE_ID)) {
        sourceAdded = true;
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl(FILE), attribution: GB_MARITIME_ATTRIBUTION, minzoom: MINZOOM, maxzoom: MAXZOOM,
        } as any);
      }
      for (const sub of SUB_LAYERS) {
        if (!map.getLayer(sub.id)) {
          map.addLayer({
            id: sub.id, type: "line", source: SOURCE_ID, "source-layer": SOURCE_LAYER, minzoom: sub.minzoom,
            filter: ["in", ["get", "limit_type"], ["literal", sub.kinds]],
            // L-3：界線保持尖角
            layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
            paint: linePaint(sub, isDarkTheme, opacity),
          } as LineLayer);
        }
        map.setLayoutProperty(sub.id, "visibility", "visible");
        map.setPaintProperty(sub.id, "line-color", colorExpr(sub.kinds, isDarkTheme) as any);
        map.setPaintProperty(sub.id, "line-opacity", hookLineOpacity(KEY, sub.id, clamp01(opacity), OPACITY_DEFAULT, isDarkTheme));
      }
      if (sourceAdded) keepLoadingUntilMapIdle(map, `${SOURCE_ID}:render`, "英國海域界線載入中", SOURCE_ID);
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, isDarkTheme, mapTick]);
}
