import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";
import { useMapReadyTick } from "./useMapReadyTick";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";

/**
 * 航空器空域 eAIP — 共用 1 份 PMTiles，filter 拆兩個 toggle：
 *
 *   ✈️ aviationControl     FIR (3) + TMA (6)
 *      - 概念：飛航情報區 / 終端管制區（航管路徑/區域，不是禁飛）
 *      - 視覺：FIR 只邊框（範圍極大會蓋滿整個畫面），TMA 淡 fill+邊框
 *
 *   ⛔ aviationRestricted  CTR + CONTROL + SURFACE + RCR + DANGER + ULZ + CIRCUIT (72)
 *      - 概念：對航空器有限制的具體區域（機場管制 / 軍方限航 / 危險 / 起降）
 *      - 視覺：正常 fill+line，按類別 ICAO 色
 *
 * PMTiles：/public/coverage/aviation_airspace.pmtiles（z 4-12）
 * source-layer: "aviation_airspace"
 * props: layer / code / name_zh / name_en / floor_m / ceiling_m / floor_raw /
 *        ceiling_raw / airspace_class / layer_index / source / remarks
 */

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

let sourceTypeRegistered = false;
function registerSourceTypeOnce() {
  if (sourceTypeRegistered) return;
  sourceTypeRegistered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (t: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(SOURCE_TYPE, PmTilesSource);
  } catch {
    // 已註冊
  }
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}coverage`;
const SOURCE_ID = "aviation-airspace";
const SOURCE_LAYER = "aviation_airspace";

const CONTROL_FILL = "aviation-control-fill";   // 只 TMA
const CONTROL_LINE = "aviation-control-line";   // FIR + TMA
const RESTRICTED_FILL = "aviation-restricted-fill";
const RESTRICTED_LINE = "aviation-restricted-line";

const FIR_AND_TMA: FilterSpecification = [
  "in", ["get", "layer"], ["literal", ["FIR", "TMA"]],
] as unknown as FilterSpecification;
const TMA_ONLY: FilterSpecification = [
  "==", ["get", "layer"], "TMA",
] as unknown as FilterSpecification;
const RESTRICTED_LAYERS: FilterSpecification = [
  "in", ["get", "layer"], ["literal",
    ["CTR", "CONTROL", "SURFACE", "RCR", "DANGER", "ULZ", "CIRCUIT"]],
] as unknown as FilterSpecification;

const COLOR_EXPR: mapboxgl.ExpressionSpecification = [
  "match", ["get", "layer"],
  "FIR", "#6495ED",
  "TMA", "#4682B4",
  "CTR", "#1E90FF",
  "CONTROL", "#1E90FF",
  "SURFACE", "#1E90FF",
  "RCR", "#DC3545",
  "DANGER", "#FF5722",
  "ULZ", "#FFC107",
  "CIRCUIT", "#4CAF50",
  "#94a3b8",
] as unknown as mapboxgl.ExpressionSpecification;

// 禁限航 fill 各類基礎不透明度
const RESTRICTED_OPACITY_FACTOR: mapboxgl.ExpressionSpecification = [
  "match", ["get", "layer"],
  "CTR", 0.45, "CONTROL", 0.45, "SURFACE", 0.45,
  "RCR", 0.50, "DANGER", 0.55,
  "ULZ", 0.42, "CIRCUIT", 0.35,
  0.35,
] as unknown as mapboxgl.ExpressionSpecification;

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

/** 透明度只改 paint，不進生命週期 effect 的 deps */
function applyOpacity(map: MapboxMap, controlOpacity: number, restrictedOpacity: number) {
  const controlFillOpacity = 0.22 * controlOpacity;
  const controlLineOpacity = Math.min(1, controlOpacity * 0.9 + 0.2);
  if (map.getLayer(CONTROL_FILL)) {
    map.setPaintProperty(CONTROL_FILL, "fill-opacity", hookFillOpacity("aviationControl", CONTROL_FILL, controlFillOpacity, 0.22 * 0.7));
  }
  if (map.getLayer(CONTROL_LINE)) {
    map.setPaintProperty(CONTROL_LINE, "line-opacity", hookLineOpacity("aviationControl", CONTROL_LINE, controlLineOpacity, Math.min(1, 0.7 * 0.9 + 0.2)));
  }
  const restrictedFillOpacity: mapboxgl.ExpressionSpecification = [
    "*", RESTRICTED_OPACITY_FACTOR, restrictedOpacity,
  ] as unknown as mapboxgl.ExpressionSpecification;
  const restrictedLineOpacity = Math.min(1, restrictedOpacity * 0.9 + 0.2);
  if (map.getLayer(RESTRICTED_FILL)) {
    map.setPaintProperty(RESTRICTED_FILL, "fill-opacity", hookFillOpacity("aviationRestricted", RESTRICTED_FILL, restrictedFillOpacity, ["*", RESTRICTED_OPACITY_FACTOR, 0.7] as unknown as mapboxgl.ExpressionSpecification));
  }
  if (map.getLayer(RESTRICTED_LINE)) {
    map.setPaintProperty(RESTRICTED_LINE, "line-opacity", hookLineOpacity("aviationRestricted", RESTRICTED_LINE, restrictedLineOpacity, Math.min(1, 0.7 * 0.9 + 0.2)));
  }
}

export function useAviationAirspaceLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  controlVisible: boolean,
  restrictedVisible: boolean,
  controlOpacity: number,
  restrictedOpacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);
  const opacityRef = useRef({ controlOpacity, restrictedOpacity });
  opacityRef.current = { controlOpacity, restrictedOpacity };

  useEffect(() => {
    const anyVisible = controlVisible || restrictedVisible;
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayers = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;

      if (!anyVisible) {
        setVis(map, CONTROL_FILL, false); setVis(map, CONTROL_LINE, false);
        setVis(map, RESTRICTED_FILL, false); setVis(map, RESTRICTED_LINE, false);
        return true;
      }

      registerSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: SOURCE_TYPE,
          url: `${BASE}/aviation_airspace.pmtiles`,
          minzoom: 4,
          maxzoom: 12,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }

      // ── Control 群：FIR 只邊框、TMA 淡 fill+邊框 ──
      const { controlOpacity, restrictedOpacity } = opacityRef.current;
      const controlFillOpacity = 0.22 * controlOpacity;
      const controlLineOpacity = Math.min(1, controlOpacity * 0.9 + 0.2);
      if (!map.getLayer(CONTROL_FILL)) {
        map.addLayer({
          id: CONTROL_FILL,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 5,
          filter: TMA_ONLY,
          paint: hookFillPaint("aviationControl", CONTROL_FILL, {
            "fill-color": COLOR_EXPR,
            "fill-opacity": controlFillOpacity,
            "fill-antialias": false,
          }, { "fill-color": COLOR_EXPR, "fill-opacity": 0.22 * 0.7, "fill-antialias": false }),
        });
      }
      if (!map.getLayer(CONTROL_LINE)) {
        map.addLayer({
          id: CONTROL_LINE,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 4,
          filter: FIR_AND_TMA,
          layout: hookLineLayout("aviationControl", CONTROL_LINE),
          paint: hookLinePaint("aviationControl", CONTROL_LINE, {
            "line-color": COLOR_EXPR,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.4, 12, 2.2],
            "line-opacity": controlLineOpacity,
            "line-dasharray": [4, 2],
          }, { "line-color": COLOR_EXPR, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.4, 12, 2.2], "line-opacity": Math.min(1, 0.7 * 0.9 + 0.2), "line-dasharray": [4, 2] }),
        });
      }

      // ── Restricted 群：CTR/CONTROL/SURFACE/RCR/DANGER/ULZ/CIRCUIT ──
      const restrictedFillOpacity: mapboxgl.ExpressionSpecification = [
        "*", RESTRICTED_OPACITY_FACTOR, restrictedOpacity,
      ] as unknown as mapboxgl.ExpressionSpecification;
      const restrictedLineOpacity = Math.min(1, restrictedOpacity * 0.9 + 0.2);
      if (!map.getLayer(RESTRICTED_FILL)) {
        map.addLayer({
          id: RESTRICTED_FILL,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 5,
          filter: RESTRICTED_LAYERS,
          paint: hookFillPaint("aviationRestricted", RESTRICTED_FILL, {
            "fill-color": COLOR_EXPR,
            "fill-opacity": restrictedFillOpacity,
            "fill-antialias": false,
          }, { "fill-color": COLOR_EXPR, "fill-opacity": ["*", RESTRICTED_OPACITY_FACTOR, 0.7] as unknown as mapboxgl.ExpressionSpecification, "fill-antialias": false }),
        });
      }
      if (!map.getLayer(RESTRICTED_LINE)) {
        map.addLayer({
          id: RESTRICTED_LINE,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 6,
          filter: RESTRICTED_LAYERS,
          layout: hookLineLayout("aviationRestricted", RESTRICTED_LINE),
          paint: hookLinePaint("aviationRestricted", RESTRICTED_LINE, {
            "line-color": COLOR_EXPR,
            "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 10, 1.0, 12, 1.6],
            "line-opacity": restrictedLineOpacity,
          }, { "line-color": COLOR_EXPR, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 10, 1.0, 12, 1.6], "line-opacity": Math.min(1, 0.7 * 0.9 + 0.2) }),
        });
      }

      applyOpacity(map, controlOpacity, restrictedOpacity);
      setVis(map, CONTROL_FILL, controlVisible);
      setVis(map, CONTROL_LINE, controlVisible);
      setVis(map, RESTRICTED_FILL, restrictedVisible);
      setVis(map, RESTRICTED_LINE, restrictedVisible);
      console.log("[AviationAirspace] layers ready", { controlVisible, restrictedVisible });
      return true;
    };

    const retry = () => {
      if (ensureLayers() && retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    retry();
    if (!map || !safeIsStyleLoaded(map)) retryTimer = setInterval(retry, 200);

    const onStyleLoad = () => {
      if (!cancelled) setTimeout(retry, 0);
    };
    // bindTimer 只在圖層可見時建立：偵測 mapRef 換新實例好重綁 style.load，
    // 不可見時沒有畫面需求，等 anyVisible 轉真 effect 會重跑自然重建
    let bindTimer: ReturnType<typeof setInterval> | null = null;
    if (anyVisible) {
      bindTimer = setInterval(() => {
        const nextMap = mapRef.current;
        if (!nextMap || nextMap === map) return;
        map?.off("style.load", onStyleLoad);
        map = nextMap;
        map.on("style.load", onStyleLoad);
        retry();
      }, 200);
    }
    const initialMap = map as MapboxMap | null;
    if (initialMap) initialMap.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      if (bindTimer) clearInterval(bindTimer);
      map?.off("style.load", onStyleLoad);
      try {
        if (map) {
          setVis(map, CONTROL_FILL, false); setVis(map, CONTROL_LINE, false);
          setVis(map, RESTRICTED_FILL, false); setVis(map, RESTRICTED_LINE, false);
        }
      } catch { /* map 可能已銷毀 */ }
    };
  }, [mapRef, controlVisible, restrictedVisible, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(controlVisible || restrictedVisible) || !safeIsStyleLoaded(map)) return;
    applyOpacity(map, controlOpacity, restrictedOpacity);
  }, [mapRef, controlVisible, restrictedVisible, controlOpacity, restrictedOpacity, mapTick]);
}
