import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { loadFireEventsByYear, type FireEvent } from "../data/fireLoader";

const SOURCE_ID = "fire-events-src";
const LAYER_ID = "fire-events-layer";

function ensureLayer(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        // 死傷：強紅放大；無死傷：淡橘小點。透明度配合暗/亮底圖。
        "circle-radius": [
          "case",
          ["get", "casualty"], 6,
          3,
        ],
        "circle-color": [
          "case",
          ["get", "casualty"], "#ff1744",
          "#ff7043",
        ],
        "circle-stroke-width": [
          "case",
          ["get", "casualty"], 1,
          0,
        ],
        "circle-stroke-color": "#ffffff",
        "circle-opacity": isDark ? 0.75 : 0.6,
        "circle-blur": 0.15,
      },
    });
  }
}

function setData(map: MapboxMap, events: FireEvent[]) {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  const fc: GeoJSON.FeatureCollection<GeoJSON.Point> = {
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
  };
  src.setData(fc);
}

function setVisible(map: MapboxMap, visible: boolean) {
  if (!map.getLayer(LAYER_ID)) return;
  map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
}

/**
 * Fire events Mapbox layer。當前年份切換時整批換資料。
 * 僅在歷史模式且 toggle 開啟時實際 fetch；切回即時模式 layer hide 但不卸載 source。
 */
export function useFireEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  year: number,
  isDarkTheme: boolean,
) {
  const lastYearRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const run = async () => {
      try {
        ensureLayer(map, isDarkTheme);
      } catch {
        // 樣式還沒 ready，下個 effect run 會再嘗試
        return;
      }
      if (!visible) {
        setVisible(map, false);
        return;
      }
      // 同年不重抓（loader 自帶 cache，但避免不必要 setData）
      if (lastYearRef.current !== year) {
        const events = await loadFireEventsByYear(year);
        if (cancelled) return;
        setData(map, events);
        lastYearRef.current = year;
      }
      setVisible(map, true);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mapRef, visible, year, isDarkTheme]);
}
