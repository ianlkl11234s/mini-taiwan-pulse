import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { loadFireEventsByYear, type FireEvent } from "../data/fireLoader";
import type { HistoricalGranularity } from "../components/HistoricalTimeline";
import { pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "fire-events-src";
const LAYER_ID = "fire-events-layer";

const CASUALTY_STROKE = { dark: "#ffffff", light: "#111827" } as const;
const OPACITY_DEFAULT = Number(paramDefault("fireEvents", "fireEventsOpacity"));

/**
 * 描邊：有傷亡（casualty）的事件用外框標示（依屬性變化＝資料編碼）：暗色白、淡色 #111827
 * （淡底圖上白框與細縫同色會看不見，比照北市抽水站）；其餘用底圖色細縫。opacity 為滑桿值，內部換算成相對預設的倍率。
 */
export function fireEventsPointStroke(isDark: boolean, opacity: number) {
  const seam = pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
  return {
    ...seam,
    "circle-stroke-color": ["case", ["get", "casualty"], CASUALTY_STROKE[isDark ? "dark" : "light"], seam["circle-stroke-color"]] as unknown as string,
  };
}

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
        ...fireEventsPointStroke(isDark, 1),
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

function updateOpacity(map: MapboxMap, isDark: boolean, opacity: number) {
  if (!map.getLayer(LAYER_ID)) return;
  map.setPaintProperty(LAYER_ID, "circle-opacity", (isDark ? 0.75 : 0.6) * opacity);
  const stroke = fireEventsPointStroke(isDark, opacity);
  map.setPaintProperty(LAYER_ID, "circle-stroke-color", stroke["circle-stroke-color"]);
  map.setPaintProperty(LAYER_ID, "circle-stroke-width", stroke["circle-stroke-width"]);
  map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
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
  opacity = 1,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const lastYearRef = useRef<number | null>(null);
  const yearEventsRef = useRef<FireEvent[]>([]);
  // 主題／透明度只走 ref + 下方樣式 effect，不進資料 effect 的 deps（避免 setData 重送）
  const styleRef = useRef({ isDarkTheme, opacity });
  styleRef.current = { isDarkTheme, opacity };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const run = async () => {
      try {
        ensureLayer(map, styleRef.current.isDarkTheme);
        updateOpacity(map, styleRef.current.isDarkTheme, styleRef.current.opacity);
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

    // 換底圖（setStyle）會清掉自訂 source/layer：用已快取資料重建，不重新抓
    const onStyleLoad = () => {
      if (!visible || lastYearRef.current !== year) return;
      try {
        ensureLayer(map, styleRef.current.isDarkTheme);
        updateOpacity(map, styleRef.current.isDarkTheme, styleRef.current.opacity);
        setData(map, filterByGranularity(yearEventsRef.current, granularity, month, day));
        setVisible(map, true);
      } catch { /* style 尚未就緒，下次 style.load 再試 */ }
    };
    map.on("style.load", onStyleLoad);
    return () => {
      cancelled = true;
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, visible, year, month, day, granularity, mapTick]);

  // 主題／透明度：只改 paint
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    updateOpacity(map, isDarkTheme, opacity);
  }, [mapRef, visible, isDarkTheme, opacity, mapTick]);
}
