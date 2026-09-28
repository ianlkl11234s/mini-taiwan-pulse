import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchWasteCleaningSquads, type WasteCleaningSquadRow } from "../data/wasteLoader";
import { POINT_STROKE, mapSeamColor, pointRadius } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 全國 清潔隊辦公點 layer — spatial.waste_cleaning_squads（359 / 23 縣市）。
 * 純靜態 POI，懶載入：toggle 開時才抓，之後永久 cache。
 *
 * 風格：綠色雙圓（glow + core）— 與既有 wasteStopsStatic 的橘色清運點區隔。
 * popup 顯示隊名 / 行政區 / 地址 / 電話 / 主管轄區。
 */

const SOURCE_ID = "waste-cleaning-squads-src";
const GLOW_LAYER_ID = "waste-cleaning-squads-glow";
const CORE_LAYER_ID = "waste-cleaning-squads-core";

const COLOR_DARK = "#22c55e";   // green-500
const COLOR_LIGHT = "#15803d";  // green-700

function ensureLayer(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  const color = isDark ? COLOR_DARK : COLOR_LIGHT;
  if (!map.getLayer(GLOW_LAYER_ID)) {
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: 6,
      paint: {
        "circle-radius": pointRadius("L"),
        "circle-color": color,
        "circle-blur": 0.7,
        // 靜態清潔隊據點；glow 不參與點擊，保留子圖層但不顯示。
        "circle-opacity": 0,
      },
    });
  }
  if (!map.getLayer(CORE_LAYER_ID)) {
    map.addLayer({
      id: CORE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: 6,
      paint: {
        "circle-radius": pointRadius("L"),
        "circle-color": color,
        "circle-stroke-color": mapSeamColor(isDark),
        "circle-stroke-width": POINT_STROKE.width,
        "circle-stroke-opacity": POINT_STROKE.opacity[isDark ? "dark" : "light"],
        "circle-opacity": 0.95,
      },
    });
  }
}

function setData(map: MapboxMap, rows: WasteCleaningSquadRow[]) {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        city: r.city,
        district: r.district,
        squad_name: r.squad_name,
        address: r.address,
        phone: r.phone,
        jurisdiction: r.jurisdiction,
        source: r.source,
        source_url: r.source_url,
      },
    })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [GLOW_LAYER_ID, CORE_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function useWasteCleaningSquadLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDarkTheme: boolean,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const loadedRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let retryPending = false;

    const retry = () => {
      retryPending = false;
      if (!cancelled) void run();
    };
    const scheduleRetry = () => {
      if (cancelled || retryPending) return;
      retryPending = true;
      map.once("idle", retry);
    };

    const run = async () => {
      if (!visible) {
        try { setVisible(map, false); } catch { scheduleRetry(); }
        return;
      }
      try {
        ensureLayer(map, isDarkTheme);
        if (map.getLayer(CORE_LAYER_ID)) {
          map.setPaintProperty(CORE_LAYER_ID, "circle-stroke-color", mapSeamColor(isDarkTheme));
          map.setPaintProperty(CORE_LAYER_ID, "circle-stroke-opacity", POINT_STROKE.opacity[isDarkTheme ? "dark" : "light"]);
        }
      } catch {
        scheduleRetry();
        return;
      }
      if (!loadedRef.current) {
        const rows = await fetchWasteCleaningSquads();
        if (cancelled) return;
        setData(map, rows);
        loadedRef.current = true;
      }
      setVisible(map, true);
    };

    void run();
    map.on("style.load", run);

    return () => {
      cancelled = true;
      map.off("style.load", run);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, visible, isDarkTheme, mapTick]);
}
