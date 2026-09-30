import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { startThrottledRaf } from "../utils/throttledRaf";

/**
 * 新聞事件時間軸動態顯示 + ripple 脈衝動畫
 *
 * - timeBased=true：依據 currentTime 過濾，只顯示 published_ts <= currentTime（累積式）
 * - timeBased=false：該天所有新聞全部顯示
 * - rippleEnabled=true：剛出現的新聞（15 分鐘內）附帶向外擴散的 ripple 訊號圈
 */

/** 新聞在 timeline 時間內「剛出現」的持續秒數 */
const FRESH_WINDOW = 900; // 15 分鐘
/** critical 事件（gis_relevance=3 + severity>=2）的 ripple 延長至 60 分鐘 */
const CRITICAL_FRESH_WINDOW = 3600; // 60 分鐘
/** 一次 ripple 脈衝在真實時間的週期（毫秒） */
const RIPPLE_CYCLE_MS = 2200;
/** 同時顯示的 ripple 圈數（錯開相位） */
const RIPPLE_COUNT = 2;

const NEWS_LAYER_IDS = ["news-events-critical-halo", "news-events-glow", "news-events-circle", "news-events-count"];

/** critical 事件（gis_relevance=3 + severity>=2）ripple 強化條件 */
const CRITICAL_EXPR = [
  "all",
  [">=", ["coalesce", ["get", "max_gis_relevance"], 0], 3],
  [">=", ["coalesce", ["get", "max_severity"], 0], 2],
];
const RIPPLE_IDS = Array.from({ length: RIPPLE_COUNT }, (_, i) => `news-events-ripple-${i}`);

export function useNewsTimeline(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  timeBased: boolean,
  rippleEnabled: boolean,
) {
  const rippleReadyRef = useRef(false);

  /** 確保 ripple layers 存在（style 切換後需重建） */
  const ensureRippleLayers = useCallback((map: MapboxMap): boolean => {
    if (!map.getSource("news-events")) return false;

    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const id = RIPPLE_IDS[i]!;
      if (map.getLayer(id)) continue;

      const before = map.getLayer("news-events-glow") ? "news-events-glow" : undefined;
      map.addLayer(
        {
          id,
          type: "circle",
          source: "news-events",
          filter: ["literal", false] as unknown as mapboxgl.FilterSpecification,
          paint: {
            "circle-radius": 8,
            "circle-color": "transparent",
            "circle-stroke-color": "#ff9800",
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0,
            "circle-opacity": 0,
            // 動畫由 RAF 逐幀改寫：本層所有可過渡 paint 屬性都關掉 GL transition。任一 setPaintProperty 會替
            // 整層每個屬性重建 transition，隱藏層不再 recalculate → 未設 0 的屬性會卡住 hasTransitions() 持續 render
            "circle-radius-transition": { duration: 0, delay: 0 },
            "circle-stroke-opacity-transition": { duration: 0, delay: 0 },
            "circle-stroke-width-transition": { duration: 0, delay: 0 },
            "circle-stroke-color-transition": { duration: 0, delay: 0 },
            "circle-color-transition": { duration: 0, delay: 0 },
            "circle-opacity-transition": { duration: 0, delay: 0 },
          },
        } as mapboxgl.CircleLayer,
        before,
      );
    }

    return !!map.getLayer(RIPPLE_IDS[0]!);
  }, []);

  // ── 時間過濾：訂閱 timeStore 節流 200ms（不走 React re-render） ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;

    const applyFilter = (currentTime: number) => {
      if (timeBased) {
        const showFilter = ["<=", ["get", "published_ts"], currentTime];
        for (const layerId of NEWS_LAYER_IDS) {
          if (map.getLayer(layerId)) {
            map.setFilter(layerId, showFilter as unknown as mapboxgl.FilterSpecification);
          }
        }
      } else {
        for (const layerId of NEWS_LAYER_IDS) {
          if (map.getLayer(layerId)) {
            map.setFilter(layerId, null);
          }
        }
      }

      if (timeBased && rippleEnabled) {
        // 既有 ripple 顯示 15min 新事件，critical 事件延長至 60min（用 any 組合放寬）
        const rippleFilter = [
          "all",
          ["<=", ["get", "published_ts"], currentTime],
          [
            "any",
            [">", ["get", "published_ts"], currentTime - FRESH_WINDOW],
            [
              "all",
              CRITICAL_EXPR,
              [">", ["get", "published_ts"], currentTime - CRITICAL_FRESH_WINDOW],
            ],
          ],
        ];
        for (const id of RIPPLE_IDS) {
          if (map.getLayer(id)) {
            map.setFilter(id, rippleFilter as unknown as mapboxgl.FilterSpecification);
          }
        }
      } else {
        for (const id of RIPPLE_IDS) {
          if (map.getLayer(id)) {
            map.setFilter(id, ["literal", false] as unknown as mapboxgl.FilterSpecification);
          }
        }
      }
    };

    applyFilter(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(200, applyFilter);
  }, [visible, timeBased, rippleEnabled, mapRef]);

  // ── Ripple 動畫 rAF loop ──
  useEffect(() => {
    if (!visible || !rippleEnabled) {
      rippleReadyRef.current = false;
      return;
    }

    // 節流 ~20fps（RIPPLE_FRAME_MS）；相位以時間計算，速度不受節流影響
    const stop = startThrottledRaf((now) => {
      const map = mapRef.current;
      if (!map) return;

      // style 切換後 layers 可能消失，重建
      if (rippleReadyRef.current && !map.getLayer(RIPPLE_IDS[0]!)) {
        rippleReadyRef.current = false;
      }
      if (!rippleReadyRef.current) {
        rippleReadyRef.current = ensureRippleLayers(map);
      }

      if (rippleReadyRef.current) {
        for (let i = 0; i < RIPPLE_COUNT; i++) {
          const id = RIPPLE_IDS[i]!;
          if (!map.getLayer(id)) continue;

          // 各 ring 錯開相位
          const phase =
            ((now + i * (RIPPLE_CYCLE_MS / RIPPLE_COUNT)) % RIPPLE_CYCLE_MS) / RIPPLE_CYCLE_MS;
          // ease-out：前快後慢，更自然
          const eased = 1 - Math.pow(1 - phase, 2);

          const baseRadius = 8 + 35 * eased;
          const baseStroke = 2 * (1 - eased * 0.5);
          // critical 事件 ripple 半徑放大 1.6x、stroke 加粗 1.5x、改紅色更醒目
          const radiusExpr = [
            "case", CRITICAL_EXPR, baseRadius * 1.6, baseRadius,
          ];
          const strokeExpr = [
            "case", CRITICAL_EXPR, baseStroke * 1.5, baseStroke,
          ];
          const colorExpr = [
            "case", CRITICAL_EXPR, "#dc2626", "#ff9800",
          ];
          const opacity = 0.55 * (1 - eased);

          map.setPaintProperty(id, "circle-radius", radiusExpr as unknown as number);
          map.setPaintProperty(id, "circle-stroke-opacity", opacity);
          map.setPaintProperty(id, "circle-stroke-width", strokeExpr as unknown as number);
          map.setPaintProperty(id, "circle-stroke-color", colorExpr as unknown as string);
        }
      }
    });

    return () => {
      stop();
      rippleReadyRef.current = false;
    };
  }, [visible, rippleEnabled, mapRef, ensureRippleLayers]);

  // ── 可見性：隱藏時清除 ripple layers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const v = visible && rippleEnabled ? "visible" : "none";
    for (const id of RIPPLE_IDS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", v);
      }
    }
  }, [visible, rippleEnabled, mapRef]);
}
