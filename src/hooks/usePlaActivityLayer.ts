import { useEffect, useRef, useCallback } from "react";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  FilterSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchPlaTracksRange,
  fetchPlaDailyStats,
  tracksToGeoJSON,
  type PlaTrack,
  type PlaDailyStat,
} from "../data/plaTracksLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 共機活動區 timeline 圖層（依日期回放 + 多日疊加）
 *
 * - 資料：spatial.pla_tracks（國防部每日航跡示意圖向量化產物，migration 330/331）
 * - fill / line 兩層共用單一 GeoJSON source，依 shape_kind 分色
 * - **疊加**：trailDays = 1 / 30 / 60 / 90 / 120，把視窗內所有日子的形狀疊在一起，
 *   舊的淡新的亮（`days_ago` 驅動），重疊處自然累積成熱點
 * - **累積回放**：從最舊一天往前播，形狀一天一天長出來，播完 = 完整疊圖。
 *   實作上只改 Mapbox filter（`days_ago >= thresh`），**不重打 RPC、不 setData**
 * - ⚠️ 依鐵則不得把 currentTime 放進 deps，一律走 timeStore 訂閱；
 *   本圖層無 intraday 變化故只掛 `subscribeDate`，不掛 `subscribeThrottled`
 * - 回放走自己的 clock（比照 earthquakeReplay）—— 全域時間軸最多 7 天視窗，
 *   表達不了 30~120 天的掃描
 */

const SOURCE_ID = "pla-activity";
const FILL_ID = "pla-activity-fill";
const LINE_ID = "pla-activity-line";
const CACHE_MAX = 7;

/** 給 useMapInteraction 的可點擊 layer 清單（fill + line 兩層都要納入） */
export const PLA_ACTIVITY_CLICK_LAYERS = [FILL_ID, LINE_ID];

/** 疊加天數選項（1 = 單日） */
export const PLA_TRAIL_DAYS = [1, 30, 60, 90, 120] as const;
export type PlaTrailDays = (typeof PLA_TRAIL_DAYS)[number];

/**
 * 基準值校準在「滑桿 = 0.6」而非 1.0 —— 這樣預設看到的亮度就是調校過的樣子，
 * 使用者還留有 0.6→1.0 的往上拉亮空間（0.6 × 0.5 = 舊的 1.0 × 0.3）。
 * line 在低 trailDays 時 o=1 會算超過 1，故 expr 外層 clamp。
 */
const BASE_FILL_OPACITY = 0.5;
const BASE_LINE_OPACITY = 1 / 0.6;
/** 最舊那天保留的亮度比例 —— 太低會整片看不見，太高則新舊分不出來 */
const OLDEST_FADE = 0.35;
/** 一輪回放的秒數（與 trailDays 無關，維持一致的節奏感）＋ 播完停留秒數 */
const SWEEP_SECONDS = 18;
const HOLD_SECONDS = 2.5;

/** 未核實的形狀用虛線框，視覺上就與已核實區分 */
const LINE_DASH: ExpressionSpecification = [
  "case",
  ["==", ["get", "needs_review"], 1],
  ["literal", [2, 2]],
  ["literal", [1, 0]],
] as unknown as ExpressionSpecification;

/**
 * 疊加天數 → 單層 alpha 的縮放。
 *
 * ⚠️ 不縮放的話 120 天會糊成一片：alpha 疊加是 1-(1-a)^n，a=0.22 疊 20 層就
 * 已經 0.99 接近不透明，底圖與密度差異全部看不見（實測 120 天整塊紫到蓋掉台灣）。
 * 目標是讓「熱區的典型重疊層數」落在 0.3~0.6 的可讀區間 —— pow(-0.6) 實測合適：
 * 單層 alpha 30 天 ≈ 0.039、120 天 ≈ 0.017（疊 20~40 層後約 0.5，區間上緣）。
 * 線框衰減得慢一點（-0.35），輪廓才是「軌跡感」的來源。
 */
const fillScale = (trailDays: number) =>
  trailDays <= 1 ? 1 : Math.pow(trailDays, -0.6);
const lineScale = (trailDays: number) =>
  trailDays <= 1 ? 1 : Math.pow(trailDays, -0.35);

/** 新舊淡化：days_ago 0（最新）→ 1.0，最舊 → OLDEST_FADE。單日不淡化 */
function ageFade(trailDays: number): ExpressionSpecification | number {
  if (trailDays <= 1) return 1;
  return [
    "interpolate",
    ["linear"],
    ["get", "days_ago"],
    0, 1,
    Math.max(trailDays - 1, 1), OLDEST_FADE,
  ] as unknown as ExpressionSpecification;
}

const fillOpacityExpr = (o: number, trailDays: number): ExpressionSpecification =>
  [
    "*",
    o * fillScale(trailDays),
    ["case", ["==", ["get", "needs_review"], 1], BASE_FILL_OPACITY * 0.5, BASE_FILL_OPACITY],
    ageFade(trailDays),
  ] as unknown as ExpressionSpecification;

const lineOpacityExpr = (o: number, trailDays: number): ExpressionSpecification =>
  [
    "min",
    1,
    ["*", o * BASE_LINE_OPACITY * lineScale(trailDays), ageFade(trailDays)],
  ] as unknown as ExpressionSpecification;

/** 疊加時線變細，否則 200 條輪廓會蓋過密度本身 */
const lineWidth = (trailDays: number) => (trailDays <= 1 ? 1.6 : 0.9);

/** 累積回放的 filter：只顯示 days_ago >= thresh（thresh 由大遞減 = 由舊到新長出來） */
const threshFilter = (thresh: number): FilterSpecification | null =>
  thresh <= 0 ? null : ([">=", ["get", "days_ago"], thresh] as unknown as FilterSpecification);

interface CachedWindow {
  data: PlaTrack[];
  accessedAt: number;
}

function buildLayers(map: MapboxMap, opacity: number, trailDays: number): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  if (!map.getLayer(FILL_ID)) {
    map.addLayer({
      id: FILL_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["get", "kind_color"] as unknown as ExpressionSpecification,
        "fill-opacity": fillOpacityExpr(opacity, trailDays),
      },
    } as FillLayer);
  }

  if (!map.getLayer(LINE_ID)) {
    map.addLayer({
      id: LINE_ID,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "kind_color"] as unknown as ExpressionSpecification,
        "line-width": lineWidth(trailDays),
        "line-opacity": lineOpacityExpr(opacity, trailDays),
        "line-dasharray": LINE_DASH,
      },
    } as LineLayer);
  }

  return true;
}

export function usePlaActivityLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 1,
  includeReview: boolean = false,
  trailDays: number = 1,
  replay: boolean = false,
  /**
   * 視窗結束日的外部覆寫（YYYY-MM-DD）。
   * 歷史模式用 —— 那邊走 HistoricalTimeline 的 年/月/日，**不寫 timeStore**，
   * 所以不能靠 subscribeDate。傳值時改吃這個並停掉訂閱。
   */
  dateOverride: string | null = null,
) {
  const cacheRef = useRef<Map<string, CachedWindow>>(new Map());
  const activeRef = useRef<PlaTrack[] | null>(null);
  const activeKeyRef = useRef<string>("");
  const statsRef = useRef<Map<string, PlaDailyStat> | null>(null);
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const rafRef = useRef<number>(0);
  const appliedThreshRef = useRef<number>(-1);

  const writeCache = useCallback((key: string, data: PlaTrack[]) => {
    const cache = cacheRef.current;
    cache.set(key, { data, accessedAt: Date.now() });
    if (cache.size > CACHE_MAX) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of cache) {
        if (v.accessedAt < oldestTime) {
          oldestTime = v.accessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }, []);

  const ensureLayers = useCallback(
    (map: MapboxMap) => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!layersReadyRef.current || !map.getLayer(FILL_ID)) {
        layersReadyRef.current = buildLayers(map, opacity, trailDays);
      }
      return layersReadyRef.current;
    },
    [opacity, trailDays],
  );

  const refreshSource = useCallback((map: MapboxMap) => {
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(tracksToGeoJSON(activeRef.current ?? [], statsRef.current ?? undefined));
  }, []);

  const applyThresh = useCallback(
    (map: MapboxMap, thresh: number) => {
      if (thresh === appliedThreshRef.current) return;
      appliedThreshRef.current = thresh;
      const f = threshFilter(thresh);
      for (const id of [FILL_ID, LINE_ID]) {
        if (map.getLayer(id)) map.setFilter(id, f);
      }
    },
    [],
  );

  const loadWindow = useCallback(
    (endDate: string) => {
      const key = `${endDate}|${trailDays}|${includeReview ? "all" : "ok"}`;
      if (key === fetchingRef.current) return;

      const cached = cacheRef.current.get(key);
      if (cached) {
        cached.accessedAt = Date.now();
        activeRef.current = cached.data;
        activeKeyRef.current = key;
        const map = mapRef.current;
        if (map && ensureLayers(map)) refreshSource(map);
        return;
      }

      fetchingRef.current = key;
      Promise.all([
        fetchPlaTracksRange(endDate, trailDays, includeReview),
        statsRef.current ? Promise.resolve(statsRef.current) : fetchPlaDailyStats(),
      ])
        .then(([tracks, stats]) => {
          statsRef.current = stats;
          writeCache(key, tracks);
          // 換日／換視窗競態：只有仍在等這一份時才落地
          if (fetchingRef.current !== key) return;
          activeRef.current = tracks;
          activeKeyRef.current = key;
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSource(map);
            keepLoadingUntilMapIdle(
              map,
              `pla-activity-render:${key}`,
              "共機活動區 渲染中",
              SOURCE_ID,
            );
          }
        })
        .catch((err) => {
          console.warn(`[PlaActivity] load ${key} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === key) fetchingRef.current = "";
        });
    },
    [ensureLayers, refreshSource, writeCache, mapRef, includeReview, trailDays],
  );

  // ── 視窗結束日：即時模式訂閱 timeStore；歷史模式吃 dateOverride ──
  useEffect(() => {
    if (!visible) return;
    if (dateOverride) {
      loadWindow(dateOverride);
      return;
    }
    const handler = (dateStr: string) => {
      if (dateStr) loadWindow(dateStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [visible, loadWindow, dateOverride]);

  // ── 可見性 + style.load 後重建圖層 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const vis = visible ? "visible" : "none";
      for (const id of [FILL_ID, LINE_ID]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
      }
    };

    if (!visible) {
      apply();
      return;
    }
    if (!ensureLayers(map)) return;
    refreshSource(map);
    apply();

    // 換底圖會清掉 source/layer，重餵一次
    const onStyleLoad = () => {
      layersReadyRef.current = false;
      appliedThreshRef.current = -1;
      if (!ensureLayers(map)) return;
      refreshSource(map);
      apply();
    };
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [visible, ensureLayers, refreshSource, mapRef]);

  // ── 累積回放：自己的 clock，只改 filter 不重打 RPC ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const maxThresh = Math.max(trailDays - 1, 0);
    // 關閉回放（或單日）→ 還原成「全部顯示」
    if (!visible || !replay || maxThresh === 0) {
      if (layersReadyRef.current) applyThresh(map, 0);
      return;
    }

    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      if (elapsed > SWEEP_SECONDS + HOLD_SECONDS) {
        start = now; // loop
      }
      // 掃描期由舊到新遞減；停留期維持 0（完整疊圖）
      const p = Math.min(elapsed / SWEEP_SECONDS, 1);
      applyThresh(map, Math.round(maxThresh * (1 - p)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // 停止回放後不要留在半截狀態
      if (map.getLayer(FILL_ID)) applyThresh(map, 0);
    };
  }, [visible, replay, trailDays, applyThresh, mapRef]);

  // ── 透明度 / 疊加天數（新舊淡化的斜率隨 trailDays 變）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(FILL_ID)) {
      map.setPaintProperty(FILL_ID, "fill-opacity", fillOpacityExpr(o, trailDays));
    }
    if (map.getLayer(LINE_ID)) {
      map.setPaintProperty(LINE_ID, "line-opacity", lineOpacityExpr(o, trailDays));
      map.setPaintProperty(LINE_ID, "line-width", lineWidth(trailDays));
    }
  }, [opacity, trailDays, visible, mapRef]);
}
