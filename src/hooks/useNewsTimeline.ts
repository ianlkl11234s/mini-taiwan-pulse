import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * 新聞事件時間軸動態顯示 + ripple 脈衝動畫
 *
 * - timeBased=true：依據 currentTime 過濾，只顯示 published_ts <= currentTime（累積式）
 * - timeBased=false：該天所有新聞全部顯示
 * - rippleEnabled=true：剛出現的新聞（15 分鐘內）附帶向外擴散的 ripple 訊號圈
 */

/** 新聞在 timeline 時間內「剛出現」的持續秒數 */
const FRESH_WINDOW = 900; // 15 分鐘
/** 一次 ripple 脈衝在真實時間的週期（毫秒） */
const RIPPLE_CYCLE_MS = 2200;
/** 同時顯示的 ripple 圈數（錯開相位） */
const RIPPLE_COUNT = 2;
/** ripple 動畫更新間隔（毫秒），~30fps */
const FRAME_INTERVAL = 33;

const NEWS_LAYER_IDS = ["news-events-glow", "news-events-circle"];
const RIPPLE_IDS = Array.from({ length: RIPPLE_COUNT }, (_, i) => `news-events-ripple-${i}`);

export function useNewsTimeline(
  mapRef: React.RefObject<MapboxMap | null>,
  currentTime: number,
  visible: boolean,
  timeBased: boolean,
  rippleEnabled: boolean,
) {
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
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
          },
        } as mapboxgl.CircleLayer,
        before,
      );
    }

    return !!map.getLayer(RIPPLE_IDS[0]!);
  }, []);

  // ── 時間過濾：currentTime 變化時更新 filter ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;

    if (timeBased) {
      // 累積顯示：只顯示 published_ts <= currentTime 的新聞
      const showFilter = ["<=", ["get", "published_ts"], currentTime];
      for (const layerId of NEWS_LAYER_IDS) {
        if (map.getLayer(layerId)) {
          map.setFilter(layerId, showFilter as unknown as mapboxgl.FilterSpecification);
        }
      }
    } else {
      // 全部顯示：清除 filter
      for (const layerId of NEWS_LAYER_IDS) {
        if (map.getLayer(layerId)) {
          map.setFilter(layerId, null);
        }
      }
    }

    // Ripple filter：只在 timeBased + rippleEnabled 時有意義
    if (timeBased && rippleEnabled) {
      const rippleFilter = [
        "all",
        ["<=", ["get", "published_ts"], currentTime],
        [">", ["get", "published_ts"], currentTime - FRESH_WINDOW],
      ];
      for (const id of RIPPLE_IDS) {
        if (map.getLayer(id)) {
          map.setFilter(id, rippleFilter as unknown as mapboxgl.FilterSpecification);
        }
      }
    } else {
      // 非時間模式或 ripple 關閉：隱藏 ripple
      for (const id of RIPPLE_IDS) {
        if (map.getLayer(id)) {
          map.setFilter(id, ["literal", false] as unknown as mapboxgl.FilterSpecification);
        }
      }
    }
  }, [currentTime, visible, timeBased, rippleEnabled, mapRef]);

  // ── Ripple 動畫 rAF loop ──
  useEffect(() => {
    if (!visible || !rippleEnabled) {
      rippleReadyRef.current = false;
      return;
    }

    const animate = () => {
      const map = mapRef.current;
      if (!map) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // 節流：~30fps
      const now = performance.now();
      if (now - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = now;

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

          const radius = 8 + 35 * eased;
          const opacity = 0.55 * (1 - eased);
          const strokeWidth = 2 * (1 - eased * 0.5);

          map.setPaintProperty(id, "circle-radius", radius);
          map.setPaintProperty(id, "circle-stroke-opacity", opacity);
          map.setPaintProperty(id, "circle-stroke-width", strokeWidth);
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
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
