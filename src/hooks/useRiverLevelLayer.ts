import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchRiverWaterLevelLatest,
  buildRiverLevelGeoJSON,
  type RiverWaterLevel,
} from "../data/riverLevelLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 河川水位即時圖層（Mapbox native circle）
 *
 * - 圓圈大小：water_level_m（大致反映該站所在河流規模）
 * - 顏色：正常青色；check_result=0 異常時紅色
 * - 每 5 min 輪詢
 * - Attach 用 polling（P0.1）；關鍵 checkpoint log（P0.2）
 */

const SOURCE_ID = "river-level";
const LAYER_GLOW = "river-level-glow";
const LAYER_CIRCLE = "river-level-circle";

const REFRESH_MS = 5 * 60 * 1000;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function colorExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["coalesce", ["get", "check_result"], 1], 0],
    "#ef4444",   // 異常
    "#22d3ee",   // 正常
  ] as unknown as ExpressionSpecification;
}

function radiusExpression(): ExpressionSpecification {
  // 水位絕對值分級（非所有站基準相同，但先給視覺差異）
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "water_level_m"], 0],
    0, 3,
    10, 4,
    50, 5.5,
    200, 7,
    500, 9,
    1000, 11,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": radiusExpression(),
        "circle-color": colorExpression(),
        "circle-blur": 0.9,
        "circle-opacity": isDark ? 0.35 : 0.3,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["literal", 2.5] as unknown as ExpressionSpecification,
        "circle-color": colorExpression(),
        "circle-opacity": isDark ? 0.95 : 0.85,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.5,
      },
    } as CircleLayer);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_GLOW, LAYER_CIRCLE]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

export function useRiverLevelLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
) {
  const mountedRef = useRef(false);
  const dataRef = useRef<RiverWaterLevel[]>([]);

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryAttach = () => {
      if (cancelled || mountedRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      if (!map.isStyleLoaded()) return;
      console.log("[RiverLevel] attaching layers");
      ensureLayers(map, isDark);
      setLayerVisibility(map, true);
      mountedRef.current = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      ensureLayers(map, isDark);
      setLayerVisibility(map, true);
      mountedRef.current = true;
    } else {
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

    const load = async () => {
      if (cancelled) return;
      try {
        console.log("[RiverLevel] fetching latest...");
        const list = await fetchRiverWaterLevelLatest();
        if (cancelled) return;
        dataRef.current = list;
        console.log(`[RiverLevel] loaded ${list.length} stations`);
        const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (src) {
          src.setData(buildRiverLevelGeoJSON(list));
          keepLoadingUntilMapIdle(map, "river-level-render", "河川水位 渲染中", SOURCE_ID);
        }
      } catch (err) {
        console.warn("[RiverLevel] fetch failed:", err);
      }
    };

    load();
    const fetchTimer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      clearInterval(fetchTimer);
      if (map.getLayer(LAYER_GLOW) || map.getLayer(LAYER_CIRCLE)) {
        setLayerVisibility(map, false);
      }
    };
  }, [mapRef, visible, isDark]);
}
