/**
 * 領土格原型：把 tw_h3_grid.pmtiles 鋪在地圖上（灰色六角格底），依面板選的標籤／屬性上色，點格子選取。
 *
 * 生命週期照 useSlopeVectorLayer（styleId＋mapTick 進 deps，換底圖後重建）。
 * 解析度不在前端切：磚本身 z5–8 放 res7、z9–10 res8、z11–12 res9（maxzoom 12 之後 overzoom）。
 * 點擊取值：queryRenderedFeatures 讀磚內屬性（不需 h3-js）。
 */
import { useEffect, useMemo, useRef } from "react";
import type { Map as MapboxMap, MapMouseEvent, ExpressionSpecification } from "mapbox-gl";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "../hooks/useMapReadyTick";
import { SELECTION_RING } from "../styles/designTokens";
import {
  TERRITORY_PMTILES_URL, TERRITORY_SOURCE_LAYER, buildColorScale, fillColorExpr, fillOpacityExpr, gridBase, zoomToRes,
  type TerritoryAttribute,
} from "./territoryAttributes";
import { territoryStore, useTerritory } from "./territoryStore";
import { useTerritoryAttributes } from "./useTerritoryAttributes";

const SOURCE_ID = "territory-h3";
export const TERRITORY_FILL_LAYER = "territory-h3-fill";
const LINE_LAYER = "territory-h3-line";
const SELECTED_LAYER = "territory-h3-selected";
const LAYERS = [TERRITORY_FILL_LAYER, LINE_LAYER, SELECTED_LAYER] as const;

function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

function removeAll(map: MapboxMap) {
  for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

/** 格線：細到 res 帶低縮放端（格子約 4–6 px）也不糊成灰板 */
const LINE_WIDTH: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 5, 0.2, 8, 0.35, 9, 0.25, 11, 0.3, 14, 0.8];

interface PaintInput { activeAttr: TerritoryAttribute | null; opacity: number; isDark: boolean }

function applyPaint(map: MapboxMap, { activeAttr: attr, opacity, isDark }: PaintInput) {
  if (!map.getLayer(TERRITORY_FILL_LAYER)) return;
  const base = gridBase(isDark);
  const color = attr ? fillColorExpr(attr, buildColorScale(attr, isDark), isDark) : base.fill;
  map.setPaintProperty(TERRITORY_FILL_LAYER, "fill-color", color as ExpressionSpecification);
  map.setPaintProperty(TERRITORY_FILL_LAYER, "fill-opacity", fillOpacityExpr(attr?.key ?? null, opacity, isDark) as ExpressionSpecification);
  map.setPaintProperty(LINE_LAYER, "line-color", base.line);
  map.setPaintProperty(LINE_LAYER, "line-opacity", base.lineOpacity);
  map.setPaintProperty(SELECTED_LAYER, "line-color", isDark ? SELECTION_RING.dark : SELECTION_RING.light);
}

function applySelection(map: MapboxMap, selected: Record<string, unknown> | null) {
  if (!map.getLayer(SELECTED_LAYER)) return;
  map.setFilter(SELECTED_LAYER, ["==", ["get", "h3"], selected ? String(selected.h3 ?? "") : ""]);
}

export function useTerritoryGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  styleId: string,
  isDark: boolean,
) {
  const { open, activeKey, opacity, selected } = useTerritory();
  const attrs = useTerritoryAttributes(open);
  const mapTick = useMapReadyTick(mapRef, open);

  const activeAttr = useMemo(() => {
    if (attrs.status !== "ready" || !activeKey) return null;
    return attrs.data.attributes.find((a) => a.key === activeKey) ?? null;
  }, [attrs, activeKey]);

  const paintRef = useRef<PaintInput>({ activeAttr, opacity, isDark });
  paintRef.current = { activeAttr, opacity, isDark };

  // 生命週期：open 才掛 source／layers，關面板即移除
  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const onZoom = () => { if (map) territoryStore.setRes(zoomToRes(map.getZoom())); };
    const onClick = (e: MapMouseEvent) => {
      if (!map || !map.getLayer(TERRITORY_FILL_LAYER)) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: [TERRITORY_FILL_LAYER] })[0];
      territoryStore.select(hit ? { ...(hit.properties ?? {}) } : null);
    };
    const onEnter = () => { if (map) map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { if (map) map.getCanvas().style.cursor = ""; };

    const ensure = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;
      if (!open) { removeAll(map); return true; }

      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: PMTILES_SOURCE_TYPE, url: TERRITORY_PMTILES_URL, minzoom: 5, maxzoom: 12 } as never);
      }
      const before = firstSymbolLayerId(map);
      const base = gridBase(paintRef.current.isDark);
      if (!map.getLayer(TERRITORY_FILL_LAYER)) {
        map.addLayer({
          id: TERRITORY_FILL_LAYER, type: "fill", source: SOURCE_ID, "source-layer": TERRITORY_SOURCE_LAYER,
          paint: { "fill-color": base.fill, "fill-opacity": base.fillOpacity, "fill-antialias": false },
        }, before);
      }
      if (!map.getLayer(LINE_LAYER)) {
        map.addLayer({
          id: LINE_LAYER, type: "line", source: SOURCE_ID, "source-layer": TERRITORY_SOURCE_LAYER,
          paint: { "line-color": base.line, "line-opacity": base.lineOpacity, "line-width": LINE_WIDTH },
        }, before);
      }
      if (!map.getLayer(SELECTED_LAYER)) {
        map.addLayer({
          id: SELECTED_LAYER, type: "line", source: SOURCE_ID, "source-layer": TERRITORY_SOURCE_LAYER,
          filter: ["==", ["get", "h3"], ""],
          paint: { "line-color": SELECTION_RING.dark, "line-width": 2.5, "line-opacity": 1 },
        }, before);
      }
      applyPaint(map, paintRef.current);
      applySelection(map, territoryStore.getSnapshot().selected);
      onZoom();
      return true;
    };

    const retry = () => { if (ensure() && retryTimer) { clearInterval(retryTimer); retryTimer = null; } };
    retry();
    if (!map || !safeIsStyleLoaded(map as MapboxMap)) retryTimer = setInterval(retry, 200);

    // 換底圖：setStyle 晚於本 effect 重跑時，style.load 後再補一次（同 useSlopeVectorLayer）
    const onStyleLoad = () => { if (!cancelled) setTimeout(retry, 0); };
    const bound = map as MapboxMap | null;
    if (bound && open) {
      bound.on("style.load", onStyleLoad);
      bound.on("zoomend", onZoom);
      bound.on("click", onClick);
      bound.on("mouseenter", TERRITORY_FILL_LAYER, onEnter);
      bound.on("mouseleave", TERRITORY_FILL_LAYER, onLeave);
    }
    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      if (bound) {
        bound.off("style.load", onStyleLoad);
        bound.off("zoomend", onZoom);
        bound.off("click", onClick);
        bound.off("mouseenter", TERRITORY_FILL_LAYER, onEnter);
        bound.off("mouseleave", TERRITORY_FILL_LAYER, onLeave);
        try { bound.getCanvas().style.cursor = ""; } catch { /* map 可能已銷毀 */ }
        if (!open) return;
        try { removeAll(bound); } catch { /* map 可能已銷毀 */ }
      }
    };
  }, [mapRef, open, styleId, mapTick]);

  // 上色／透明度／主題變更：只改 paint
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open || !safeIsStyleLoaded(map)) return;
    applyPaint(map, { activeAttr, opacity, isDark });
  }, [mapRef, open, activeAttr, opacity, isDark, mapTick]);

  // 選取描邊
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open) return;
    applySelection(map, selected);
  }, [mapRef, open, selected, mapTick]);
}
