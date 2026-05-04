import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { loadFireEventsByYear, type FireEvent } from "../data/fireLoader";
import type { HistoricalGranularity } from "../components/HistoricalTimeline";

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
 * 依粒度 filter 火災事件。
 * - year: 全年
 * - month: 該月
 * - day: 該月該日
 *
 * Day 從 occurred_ts 用 getUTCDate() 取，因為來源 naive 時間以 UTC 存，
 * UTC 數字 = 來源原始日期（不需要 tz 轉換，避免 +8h 邊界誤差）。
 */
function filterByGranularity(
  events: FireEvent[],
  granularity: HistoricalGranularity,
  month: number,
  day: number,
): FireEvent[] {
  if (granularity === "year") return events;
  if (granularity === "month") return events.filter((e) => e.month === month);
  // day
  return events.filter((e) => {
    if (e.month !== month) return false;
    const d = new Date(e.occurred_ts * 1000).getUTCDate();
    return d === day;
  });
}

/**
 * Fire events Mapbox layer。年份切換時整批換資料；月/日切換為 client-side filter。
 */
export function useFireEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  year: number,
  month: number,
  day: number,
  granularity: HistoricalGranularity,
  isDarkTheme: boolean,
) {
  const lastYearRef = useRef<number | null>(null);
  const yearEventsRef = useRef<FireEvent[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const run = async () => {
      try {
        ensureLayer(map, isDarkTheme);
      } catch {
        return;
      }
      if (!visible) {
        setVisible(map, false);
        return;
      }
      // 年份變才重抓；其餘粒度切換僅 re-filter 本機快取
      if (lastYearRef.current !== year) {
        const events = await loadFireEventsByYear(year);
        if (cancelled) return;
        yearEventsRef.current = events;
        lastYearRef.current = year;
      }
      const filtered = filterByGranularity(yearEventsRef.current, granularity, month, day);
      setData(map, filtered);
      setVisible(map, true);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mapRef, visible, year, month, day, granularity, isDarkTheme]);
}
