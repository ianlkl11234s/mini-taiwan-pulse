import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 機場管制/限航/危險 rim-glow 測試 —— 純 Mapbox 疊層版
 *
 * 概念：對同一份 PMTiles polygon，疊 4 個 Mapbox line 層 + 1 個 inner fill
 *   1. line-blur=12, width=18, opacity=0.15   ← 遠 halo（最寬最柔）
 *   2. line-blur=6,  width=8,  opacity=0.30   ← 中 halo
 *   3. line-blur=2,  width=3,  opacity=0.55   ← 內 halo
 *   4. line-blur=0,  width=1.2,opacity=0.95   ← 亮核（清脆邊）
 *   5. fill-opacity=0.06 淡淡内餡
 *
 * 效果：霓虹管邊框，遠看像 rim glow，不需 additive/Three.js。
 * 是 Path A（Mapbox 原生）方案 — 沒 additive 但已能到 ~70% 星系感。
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
const SOURCE_ID = "aviation-airspace"; // 跟原生 layer 共用 source
const SOURCE_LAYER = "aviation_airspace";

const LAYER_IDS = [
  "aviation-restricted-glow-fill",
  "aviation-restricted-glow-halo-far",
  "aviation-restricted-glow-halo-mid",
  "aviation-restricted-glow-halo-near",
  "aviation-restricted-glow-core",
] as const;

const RESTRICTED_LAYERS: FilterSpecification = [
  "in", ["get", "layer"], ["literal",
    ["CTR", "CONTROL", "SURFACE", "RCR", "DANGER", "ULZ", "CIRCUIT"]],
] as unknown as FilterSpecification;

const COLOR_EXPR: mapboxgl.ExpressionSpecification = [
  "match", ["get", "layer"],
  "CTR", "#38bdf8",
  "CONTROL", "#38bdf8",
  "SURFACE", "#38bdf8",
  "RCR", "#fb7185",
  "DANGER", "#f97316",
  "ULZ", "#facc15",
  "CIRCUIT", "#4ade80",
  "#e2e8f0",
] as unknown as mapboxgl.ExpressionSpecification;

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}
function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

export function useAviationRestrictedGlowLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayers = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;

      if (!visible) {
        for (const id of LAYER_IDS) setVis(map, id, false);
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

      // 1. 淡淡内餡
      if (!map.getLayer("aviation-restricted-glow-fill")) {
        map.addLayer({
          id: "aviation-restricted-glow-fill",
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 5,
          filter: RESTRICTED_LAYERS,
          paint: {
            "fill-color": COLOR_EXPR,
            "fill-opacity": 0.06 * opacity,
            "fill-antialias": false,
          },
        });
      } else {
        map.setPaintProperty("aviation-restricted-glow-fill", "fill-opacity", 0.06 * opacity);
      }

      // 2-5. 四層 line 疊光暈
      const passes: Array<[string, number, number, number]> = [
        // id-suffix, line-blur, line-width, opacity
        ["halo-far",  12, 18, 0.15],
        ["halo-mid",   6,  8, 0.30],
        ["halo-near",  2,  3, 0.55],
        ["core",       0,  1.2, 0.95],
      ];
      for (const [suffix, blur, width, alpha] of passes) {
        const id = `aviation-restricted-glow-${suffix}`;
        const paintOpacity = Math.min(1, alpha * opacity);
        if (!map.getLayer(id)) {
          map.addLayer({
            id,
            type: "line",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            minzoom: 4,
            filter: RESTRICTED_LAYERS,
            paint: {
              "line-color": COLOR_EXPR,
              "line-width": width,
              "line-blur": blur,
              "line-opacity": paintOpacity,
            },
          });
        } else {
          map.setPaintProperty(id, "line-opacity", paintOpacity);
        }
      }

      for (const id of LAYER_IDS) setVis(map, id, visible);
      console.log("[AviationRestrictedGlow] ready", { visible, opacity });
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
    const onStyleLoad = () => { if (!cancelled) setTimeout(retry, 0); };
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
      if (map) for (const id of LAYER_IDS) setVis(map, id, false);
    };
  }, [mapRef, visible, opacity, mapTick]);
}
