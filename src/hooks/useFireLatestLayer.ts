import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { loadFireEventsByYear, loadFireEventYears, type FireEvent } from "../data/fireLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 火災「最新年度」layer — 直接顯示資料庫最新一年（民國 113 / 2024）的火災點位，
 * 不需進歷史模式 / 調時間軸，任何模式都可開。
 *
 * 與 fireEvents（歷史，需選年/月/日）區隔：這是「最近一年火災快照」的常駐 layer。
 * 顏色 / 屬性 / popup 與 fireEvents 共用（FireEventPanel）。2D circle，無 Three.js 特效。
 */

const SOURCE_ID = "fire-latest-src";
const LAYER_ID = "fire-latest-layer";

function ensureLayer(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["case", ["get", "casualty"], 6, 3],
        "circle-color": ["case", ["get", "casualty"], "#ff1744", "#ff7043"],
        "circle-stroke-width": ["case", ["get", "casualty"], 1, 0],
        "circle-stroke-color": "#ffffff",
        "circle-opacity": isDark ? 0.8 : 0.65,
        "circle-blur": 0.15,
      },
    });
  }
}

function setData(map: MapboxMap, events: FireEvent[]) {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.longitude, e.latitude] },
      properties: {
        case_id: e.case_id,
        occurred_ts: e.occurred_ts,
        county: e.county,
        township: e.township,
        cause: e.cause,
        deaths: e.deaths,
        injuries: e.injuries,
        casualty: e.deaths > 0 || e.injuries > 0,
        month: e.month,
      },
    })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  if (!map.getLayer(LAYER_ID)) return;
  map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
}

function updateOpacity(map: MapboxMap, isDark: boolean, opacity: number) {
  if (!map.getLayer(LAYER_ID)) return;
  map.setPaintProperty(LAYER_ID, "circle-opacity", (isDark ? 0.8 : 0.65) * opacity);
  map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", opacity);
}

/** 最新年度火災點位（資料只載一次，任何模式可見）。 */
export function useFireLatestLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDarkTheme: boolean,
  opacity = 1,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const loadedRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const run = async () => {
      try {
        ensureLayer(map, isDarkTheme);
        updateOpacity(map, isDarkTheme, opacity);
      } catch {
        return;
      }
      if (!visible) {
        setVisible(map, false);
        return;
      }
      if (!loadedRef.current) {
        const years = await loadFireEventYears();
        if (cancelled) return;
        const maxYear = years.length
          ? Math.max(...years.map((y) => y.year))
          : new Date().getFullYear() - 1911;
        const events = await loadFireEventsByYear(maxYear);
        if (cancelled) return;
        setData(map, events);
        loadedRef.current = true;
      }
      setVisible(map, true);
    };
    run();
    return () => { cancelled = true; };
  }, [mapRef, visible, isDarkTheme, opacity, mapTick]);
}
