import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, ExpressionSpecification, FilterSpecification, CircleLayer } from "mapbox-gl";
import { fetchEarthquakes, earthquakesToGeoJSON, type EarthquakeEvent } from "../data/earthquakeLoader";

/**
 * 地震事件 timeline 動態顯示
 *
 * - pre   : 即將發生（current < occurred <= current + PRE_WINDOW）→ 極淡標記，預示
 * - post  : 已發生（occurred <= current）→ 淡化標記持續顯示
 * - ripple: 剛發生（current - FRESH_WINDOW <= occurred <= current）→ 擴散圈動畫
 *
 * 圓圈大小依規模、顏色依深度。
 */

const SOURCE_ID = "earthquakes";
const LAYER_PRE = "earthquake-pre";
const LAYER_POST = "earthquake-post";
const RIPPLE_COUNT = 2;
const RIPPLE_IDS = Array.from({ length: RIPPLE_COUNT }, (_, i) => `earthquake-ripple-${i}`);

/** 預示視窗：發生前多久就出現淡標記（秒） */
const PRE_WINDOW = 1800; // 30 分鐘
/** 剛發生視窗：擴散動畫持續多久（秒，timeline 時間） */
const FRESH_WINDOW = 1200; // 20 分鐘
const RIPPLE_CYCLE_MS = 2400;
const FRAME_INTERVAL = 33;

/** 給定 unix 秒，回傳「該時間在台灣時區所屬日」的 [00:00, 隔日 00:00) unix 秒區間 */
function taipeiDayBounds(ts: number): { dayStart: number; dayEnd: number } {
  // 台灣 UTC+8，日邊界 = UTC 那天的 16:00 前一天
  const SEC_PER_DAY = 86400;
  const tzOffset = 8 * 3600;
  const dayStart = Math.floor((ts + tzOffset) / SEC_PER_DAY) * SEC_PER_DAY - tzOffset;
  return { dayStart, dayEnd: dayStart + SEC_PER_DAY };
}

/** 圓圈半徑：依規模 (M3=4px, M5=10px, M7=22px) */
const RADIUS_EXPR = [
  "interpolate", ["linear"], ["get", "magnitude"],
  2, 3,
  4, 6,
  5, 10,
  6, 16,
  7, 24,
] as unknown as ExpressionSpecification;

/** 顏色：依深度 (淺=紅, 中=橘, 深=藍) */
const COLOR_EXPR = [
  "interpolate", ["linear"], ["get", "depth_km"],
  0, "#ff3b30",
  30, "#ff9500",
  70, "#ffcc00",
  150, "#42a5f5",
  300, "#3949ab",
] as unknown as ExpressionSpecification;

function buildLayers(map: MapboxMap) {
  if (!map.getSource(SOURCE_ID)) return false;

  // post: 已發生的持續淡化標記
  if (!map.getLayer(LAYER_POST)) {
    map.addLayer({
      id: LAYER_POST,
      type: "circle",
      source: SOURCE_ID,
      filter: ["literal", false] as unknown as FilterSpecification,
      paint: {
        "circle-radius": RADIUS_EXPR,
        "circle-color": COLOR_EXPR,
        "circle-opacity": 0.35,
        "circle-stroke-color": COLOR_EXPR,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.55,
      },
    } as CircleLayer);
  }

  // pre: 即將發生的預示
  if (!map.getLayer(LAYER_PRE)) {
    map.addLayer({
      id: LAYER_PRE,
      type: "circle",
      source: SOURCE_ID,
      filter: ["literal", false] as unknown as FilterSpecification,
      paint: {
        "circle-radius": RADIUS_EXPR,
        "circle-color": "transparent",
        "circle-stroke-color": COLOR_EXPR,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.25,
      },
    } as CircleLayer);
  }

  // ripple
  for (const id of RIPPLE_IDS) {
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: "circle",
      source: SOURCE_ID,
      filter: ["literal", false] as unknown as FilterSpecification,
      paint: {
        "circle-radius": 8,
        "circle-color": "transparent",
        "circle-stroke-color": COLOR_EXPR,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0,
      },
    } as CircleLayer);
  }

  return true;
}

export function useEarthquakeLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  currentTime: number,
  visible: boolean,
) {
  const eventsRef = useRef<EarthquakeEvent[]>([]);
  const dataReadyRef = useRef(false);
  const layersReadyRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  // 載入一次
  useEffect(() => {
    let cancelled = false;
    fetchEarthquakes()
      .then((evs) => {
        if (cancelled) return;
        eventsRef.current = evs;
        dataReadyRef.current = true;
        // 嘗試立即注入
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
      })
      .catch((err) => console.warn("[Earthquake] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: earthquakesToGeoJSON(eventsRef.current),
      });
    }
    if (!layersReadyRef.current || !map.getLayer(LAYER_POST)) {
      layersReadyRef.current = buildLayers(map);
    }
    return layersReadyRef.current;
  }, []);

  // 更新 filter（隨 currentTime / visible 變動）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;

    const allIds = [LAYER_POST, LAYER_PRE, ...RIPPLE_IDS];
    const v = visible ? "visible" : "none";
    for (const id of allIds) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    if (!visible) return;

    // 限定為 timeline 當天（台灣時區 00:00 ~ 24:00）
    const { dayStart, dayEnd } = taipeiDayBounds(currentTime);

    const postFilter = [
      "all",
      [">=", ["get", "occurred_ts"], dayStart],
      ["<", ["get", "occurred_ts"], dayEnd],
      ["<=", ["get", "occurred_ts"], currentTime],
    ];
    const preFilter = [
      "all",
      [">=", ["get", "occurred_ts"], dayStart],
      ["<", ["get", "occurred_ts"], dayEnd],
      [">", ["get", "occurred_ts"], currentTime],
      ["<=", ["get", "occurred_ts"], currentTime + PRE_WINDOW],
    ];
    const rippleFilter = [
      "all",
      [">=", ["get", "occurred_ts"], dayStart],
      ["<", ["get", "occurred_ts"], dayEnd],
      ["<=", ["get", "occurred_ts"], currentTime],
      [">", ["get", "occurred_ts"], currentTime - FRESH_WINDOW],
    ];

    if (map.getLayer(LAYER_POST))
      map.setFilter(LAYER_POST, postFilter as unknown as FilterSpecification);
    if (map.getLayer(LAYER_PRE))
      map.setFilter(LAYER_PRE, preFilter as unknown as FilterSpecification);
    for (const id of RIPPLE_IDS) {
      if (map.getLayer(id))
        map.setFilter(id, rippleFilter as unknown as FilterSpecification);
    }
  }, [currentTime, visible, ensureSource, mapRef]);

  // ripple 動畫
  useEffect(() => {
    if (!visible) return;

    const animate = () => {
      const map = mapRef.current;
      if (!map) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      const now = performance.now();
      if (now - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = now;

      // style 切換後 layers 可能消失
      if (layersReadyRef.current && !map.getLayer(RIPPLE_IDS[0]!)) {
        layersReadyRef.current = false;
      }
      if (!layersReadyRef.current) ensureSource(map);

      if (layersReadyRef.current) {
        for (let i = 0; i < RIPPLE_COUNT; i++) {
          const id = RIPPLE_IDS[i]!;
          if (!map.getLayer(id)) continue;
          const phase =
            ((now + i * (RIPPLE_CYCLE_MS / RIPPLE_COUNT)) % RIPPLE_CYCLE_MS) / RIPPLE_CYCLE_MS;
          const eased = 1 - Math.pow(1 - phase, 2);
          // 規模越大，擴散範圍越大
          const baseR = 6;
          const maxAdd = 60;
          map.setPaintProperty(id, "circle-radius", [
            "+",
            ["*", ["get", "magnitude"], 2],
            baseR + maxAdd * eased,
          ] as unknown as ExpressionSpecification);
          map.setPaintProperty(id, "circle-stroke-opacity", 0.7 * (1 - eased));
          map.setPaintProperty(id, "circle-stroke-width", 2.5 * (1 - eased * 0.5));
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, ensureSource, mapRef]);
}
