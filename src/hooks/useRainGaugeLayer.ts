import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchRainGaugeLatest,
  buildRainGaugeGeoJSON,
  type RainGauge,
} from "../data/rainGaugeLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 即時雨量圖層（Mapbox native circle）
 *
 * 視覺：
 *   - circle-radius：precipitation_10min（0 → 小, 多 → 大）
 *   - circle-color：precipitation_1hr 依 CWA 分級 step expression
 *   - 無雨的站點半徑極小/透明，避免全台滿滿灰點
 *
 * 策略：
 *   - visible 變 true 首次 fetch
 *   - 每 5 min 輪詢一次（資料本身每 10 min 更新）
 */

const SOURCE_ID = "rain-gauge";
const LAYER_GLOW = "rain-gauge-glow";
const LAYER_CIRCLE = "rain-gauge-circle";

const REFRESH_MS = 5 * 60 * 1000;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** CWA 雨量分級 step expression（1hr mm → color） */
function rainColorExpression(): ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "precipitation_1hr"], 0],
    "#6b7280",       // 0
    0.1, "#93c5fd",  // 0.1 - 2.5 小雨
    2.5, "#3b82f6",  // 2.5 - 15 中雨
    15, "#22c55e",   // 15 - 40 大雨
    40, "#fbbf24",   // 40 - 80 豪雨
    80, "#f97316",   // 80 - 200 大豪雨
    200, "#ef4444",  // > 200 超大豪雨
  ] as unknown as ExpressionSpecification;
}

/** 半徑：瞬時（10min）雨量 interpolate */
function rainRadiusExpression(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "precipitation_10min"], 0],
    0, 2 * scale,
    2, 5 * scale,
    10, 10 * scale,
    30, 16 * scale,
    60, 22 * scale,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": rainRadiusExpression(scale * 1.8),
        "circle-color": rainColorExpression(),
        "circle-blur": 0.8,
        "circle-opacity": isDark ? 0.25 : 0.2,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": rainRadiusExpression(scale),
        "circle-color": rainColorExpression(),
        "circle-opacity": isDark ? 0.85 : 0.75,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.4,
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

export function useRainGaugeLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
) {
  const mountedRef = useRef(false);
  const dataRef = useRef<RainGauge[]>([]);

  // ── visible = true 時建 source/layer + 啟動 fetch ──
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Polling attach（P0.1：不用 map.once('load')）
    const tryAttach = () => {
      if (cancelled || mountedRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      if (!map.isStyleLoaded()) return;
      console.log("[RainGauge] attaching layers");
      ensureLayers(map, isDark, scale);
      setLayerVisibility(map, true);
      mountedRef.current = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      ensureLayers(map, isDark, scale);
      setLayerVisibility(map, true);
      mountedRef.current = true;
    } else {
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

    // Load + refresh
    const load = async () => {
      if (cancelled) return;
      try {
        console.log("[RainGauge] fetching latest...");
        const list = await fetchRainGaugeLatest();
        if (cancelled) return;
        dataRef.current = list;
        console.log(`[RainGauge] loaded ${list.length} stations`);

        const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (src) {
          src.setData(buildRainGaugeGeoJSON(list));
          keepLoadingUntilMapIdle(map, "rain-gauge-render", "即時雨量 渲染中", SOURCE_ID);
        } else {
          // source 還沒建好（tryAttach 還在 polling），下一輪 interval 再試
          console.log("[RainGauge] source not ready yet, will retry");
        }
      } catch (err) {
        console.warn("[RainGauge] fetch failed:", err);
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
  }, [mapRef, visible, isDark, scale]);
}
