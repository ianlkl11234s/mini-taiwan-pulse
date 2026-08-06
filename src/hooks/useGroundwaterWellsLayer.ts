import { useEffect, useRef } from "react";
import type { Map as MapboxMap, CircleLayer, GeoJSONSource } from "mapbox-gl";
import { fetchGroundwaterLatest, type GroundwaterLatestRow } from "../data/groundwaterLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 地下水井靜態點位層（backdrop，48h 內有讀值的 ~733 站）
 *
 * 與 useGroundwaterLayer 的動態層分工：
 *   - 這層：永遠顯示站位（灰色小點），不受 timeline 影響
 *   - 動態層：疊在上面，隨 timeline 變半徑/顏色
 *
 * 為什麼不綁 timeline：水井靜態 backdrop 用來呈現監測網密度；delta_24h
 * 雖有時序意義但相對「最新」這個 anchor（timeStore 初始 = now - 1h），
 * 小時級 scrubbing 看不出變化，直接一次載入即可。
 */

const SOURCE_ID = "groundwater-wells";
const LAYER_CIRCLE = "groundwater-wells-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function buildFC(rows: GroundwaterLatestRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        station_id: r.station_id,
        well_name: r.well_name ?? "",
        agency_unit: r.agency_unit ?? "",
        county: r.county ?? "",
        township: r.township ?? "",
        water_level_m: r.water_level_m,
        delta_24h: r.delta_24h,
        observed_at: r.observed_at,
      },
    })),
  };
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 2.2 * scale,
        "circle-color": isDark ? "#94a3b8" : "#64748b", // slate-400 / slate-500
        "circle-opacity": (isDark ? 0.75 : 0.6) * opacity,
        "circle-stroke-width": 0.6,
        "circle-stroke-color": isDark ? "#1e293b" : "#ffffff",
        "circle-stroke-opacity": 0.8 * opacity,
      },
    } as CircleLayer);
  }
}

function updatePaint(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getLayer(LAYER_CIRCLE)) return;
  map.setPaintProperty(LAYER_CIRCLE, "circle-radius", 2.2 * scale);
  map.setPaintProperty(LAYER_CIRCLE, "circle-opacity", (isDark ? 0.75 : 0.6) * opacity);
  map.setPaintProperty(LAYER_CIRCLE, "circle-stroke-opacity", 0.8 * opacity);
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  if (map.getLayer(LAYER_CIRCLE)) {
    map.setLayoutProperty(LAYER_CIRCLE, "visibility", visible ? "visible" : "none");
  }
}

export function useGroundwaterWellsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) return;
      ensureLayers(map, isDark, scale, opacity);
      updatePaint(map, isDark, scale, opacity);
      setLayerVisibility(map, true);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) attach();
    else pollTimer = setInterval(attach, 200);

    // 資料只抓一次（靜態 backdrop；collector 60 min 更新頻率，session 內夠用）
    if (!dataLoadedRef.current) {
      fetchGroundwaterLatest()
        .then((rows) => {
          if (cancelled) return;
          dataLoadedRef.current = true;
          const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          if (!src) return;
          src.setData(buildFC(rows));
          console.log(`[GroundwaterWells] loaded ${rows.length} stations`);
          keepLoadingUntilMapIdle(map, "groundwater-wells-render", "水井點位 渲染中", SOURCE_ID);
        })
        .catch((err) => console.warn("[GroundwaterWells] fetch failed:", err));
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (map.getLayer(LAYER_CIRCLE)) setLayerVisibility(map, false);
    };
  }, [mapRef, visible, isDark, scale, opacity, mapTick]);
}
