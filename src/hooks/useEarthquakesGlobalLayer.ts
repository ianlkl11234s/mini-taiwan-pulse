import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Map as MapboxMap, ExpressionSpecification, FilterSpecification, CircleLayer, GeoJSONSource,
} from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  fetchEarthquakesGlobal,
  earthquakesGlobalToGeoJSON,
  EARTHQUAKE_GLOBAL_DAYS_DEFAULT,
  type EarthquakeGlobalEvent,
} from "../data/earthquakesGlobalLoader";

/**
 * USGS 全球地震 — timeline 連動 + 擴散圈動畫。
 *
 * 三窗共用同一份 geojson source（結構照抄 `useEarthquakeLayer`（CWA 國內），
 * 欄位對應 `occurred_ts → observed_ts`、`magnitude → mag`；配色沿用全球版原色）：
 *
 * - post   : 已發生（observed <= current）→ 淡標記持續顯示，**popup 掛在這層**
 * - pre    : 即將發生（current < observed <= current + PRE_WINDOW）→ 空心預示
 * - ripple : 剛發生（current - FRESH_WINDOW < observed <= current）→ 擴散圈動畫
 *
 * 「回溯天數」（lookbackDays）同時決定 loader 查詢窗與顯示窗下界：
 *   - 1  → 僅顯示當日（台北日界；timeline 日期選擇器也是台北日，兩者對齊）
 *   - >1 → timeline 游標往前 N 天的滾動視窗
 *
 * 兩個窗都錨在 **timeline 選定日**（`subscribeDate` 換日重抓），所以把日期往回拉時
 * 整段窗一起往前移；錨在掛鐘現在的話最舊那幾天會靜默空掉。
 *
 * ⚠️ currentTime **不在** deps（專案鐵則 §6）—— filter 走 timeStore 訂閱，
 * 擴散圈走 RAF；React 只負責 visible / opacity / lookbackDays 這類真依賴。
 */

const SOURCE_ID = "earthquakes-global";
/** ⚠️ 主層 id 不可改名：`gisClickRegistry` 的 popup 綁在這個字串上 */
const LAYER_POST = "earthquakes-global-circle";
const LAYER_PRE = "earthquakes-global-pre";
const RIPPLE_COUNT = 2;
const RIPPLE_IDS = Array.from({ length: RIPPLE_COUNT }, (_, i) => `earthquakes-global-ripple-${i}`);

/** 預示視窗：發生前多久就出現淡標記（秒） */
const PRE_WINDOW = 1800; // 30 分鐘
/** 剛發生視窗：擴散動畫持續多久（秒，timeline 時間） */
const FRESH_WINDOW = 1200; // 20 分鐘
const RIPPLE_CYCLE_MS = 2400;
const FRAME_INTERVAL = 33;

const SEC_PER_DAY = 86400;
const POST_OPACITY = 0.55;
const POST_STROKE_OPACITY = 0.8;
const PRE_STROKE_OPACITY = 0.25;

/** 給定 unix 秒，回傳「該時間在台灣時區所屬日」的 [00:00, 隔日 00:00) unix 秒區間 */
function taipeiDayBounds(ts: number): { dayStart: number; dayEnd: number } {
  const tzOffset = 8 * 3600;
  const dayStart = Math.floor((ts + tzOffset) / SEC_PER_DAY) * SEC_PER_DAY - tzOffset;
  return { dayStart, dayEnd: dayStart + SEC_PER_DAY };
}

const RADIUS_EXPR = [
  "interpolate", ["linear"], ["get", "mag"],
  2, 2,
  4, 5,
  5, 9,
  6, 15,
  7, 22,
  8, 30,
] as unknown as ExpressionSpecification;

const COLOR_EXPR = [
  "interpolate", ["linear"], ["get", "depth_km"],
  0, "#dc2626",
  30, "#f97316",
  70, "#facc15",
  150, "#38bdf8",
  300, "#3949ab",
] as unknown as ExpressionSpecification;

function buildLayers(map: MapboxMap) {
  if (!map.getSource(SOURCE_ID)) return false;

  // post：已發生的持續標記（popup 目標層）
  if (!map.getLayer(LAYER_POST)) {
    map.addLayer({
      id: LAYER_POST,
      type: "circle",
      source: SOURCE_ID,
      filter: ["literal", false] as unknown as FilterSpecification,
      paint: {
        "circle-radius": RADIUS_EXPR,
        "circle-color": COLOR_EXPR,
        "circle-opacity": POST_OPACITY,
        "circle-stroke-color": COLOR_EXPR,
        "circle-stroke-width": 1,
        "circle-stroke-opacity": POST_STROKE_OPACITY,
      },
    } as CircleLayer);
  }

  // pre：即將發生的預示（空心）
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
        "circle-stroke-opacity": PRE_STROKE_OPACITY,
      },
    } as CircleLayer);
  }

  // ripple：半徑／透明度由 RAF 每幀改寫（見下方動畫 effect）
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

export function useEarthquakesGlobalLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
  lookbackDays: number = EARTHQUAKE_GLOBAL_DAYS_DEFAULT,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const eventsRef = useRef<EarthquakeGlobalEvent[]>([]);
  const dataReadyRef = useRef(false);
  const layersReadyRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  /**
   * 資料到位／換天數重抓後 +1。filter effect 必須靠它重跑 ——
   * mapTick 只在「map 從 null 變 ready」時跳，抓到資料本身不會通知 React。
   */
  const [dataTick, setDataTick] = useState(0);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: earthquakesGlobalToGeoJSON(eventsRef.current),
      });
    }
    if (!layersReadyRef.current || !map.getLayer(LAYER_POST)) {
      layersReadyRef.current = buildLayers(map);
    }
    return layersReadyRef.current;
  }, []);

  // 載入（lazy：visible 才抓）。查詢窗錨在 **timeline 選定日**，所以換日要重抓 ——
  // 訂閱 `subscribeDate`（日粒度）而非 subscribeThrottled：同一天內移動游標只改 filter，
  // 不該打 DB。currentTime 一樣不進 deps（鐵則 §6）。換回溯天數則靠 effect 重跑。
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let inflightKey: string | null = null;
    let applyTimer: number | null = null;

    // 世界視野下幾千顆點時 map.isStyleLoaded() 可能長時間為 false（實測連續 9 秒不動）；
    // 當下沒套上就靜默放棄的話，source 資料會卡在舊的一份不再更新。改成有界重試：
    // 每 150ms 檢查一次，直到 style 就緒、或本次載入已過期／effect 被清理才停止
    // （照抄 useClimateParticleLineLayer.ts applyRaster 的重試精神）。
    const applyData = (evs: EarthquakeGlobalEvent[], dateKey: string) => {
      if (cancelled || inflightKey !== dateKey) return; // 期間又換日／換天數 → 這批已過期
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) {
        if (applyTimer === null) {
          applyTimer = window.setTimeout(() => {
            applyTimer = null;
            applyData(evs, dateKey);
          }, 150);
        }
        return;
      }
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(earthquakesGlobalToGeoJSON(evs));
      else ensureSource(map);
    };

    const load = (dateKey: string) => {
      if (cancelled || dateKey === inflightKey) return; // 同日重複通知 → 不動作
      inflightKey = dateKey;
      fetchEarthquakesGlobal(lookbackDays, dateKey)
        .then((evs) => {
          // 期間又換日／換天數 → 丟掉這批過期結果
          if (cancelled || inflightKey !== dateKey) return;
          eventsRef.current = evs;
          dataReadyRef.current = true;
          applyData(evs, dateKey);
          setDataTick((v) => v + 1);
        })
        .catch((err) => {
          if (inflightKey === dateKey) inflightKey = null; // 允許同日重試
          console.warn("[EarthquakesGlobal] load failed:", err);
        });
    };

    load(timeStore.getDateKey()); // 初始
    const unsubDate = timeStore.subscribeDate(load);
    return () => {
      cancelled = true;
      unsubDate();
      if (applyTimer !== null) window.clearTimeout(applyTimer);
    };
    // mapTick 必須在（ratchet mapReadyTickCoverage）：資料先到、map 後就緒時，
    // 上面那段 `mapRef.current` 分支會整個跳過 —— 靠 mapTick 重跑補建 source。
    // 重跑走 keyedThunkCache 命中，不會多打一次 DB。
    // dataTick 則**不**在此（它由本 effect 自己遞增，放進來會無限迴圈）。
  }, [visible, lookbackDays, ensureSource, mapRef, mapTick]);

  // 更新 filter（訂閱 timeStore 節流 500ms，不走 React re-render）
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

    const applyFilter = (currentTime: number) => {
      // 顯示窗下界：僅當日 → 台北日界 00:00；其餘 → 游標往前 N 天
      const onlyToday = lookbackDays <= 1;
      const { dayStart, dayEnd } = taipeiDayBounds(currentTime);
      const lowerBound = onlyToday ? dayStart : currentTime - lookbackDays * SEC_PER_DAY;
      // 僅當日時，預示視窗不得越過日界（否則會露出明天的地震）
      const preUpper = onlyToday
        ? Math.min(currentTime + PRE_WINDOW, dayEnd)
        : currentTime + PRE_WINDOW;

      const postFilter = [
        "all",
        [">=", ["get", "observed_ts"], lowerBound],
        ["<=", ["get", "observed_ts"], currentTime],
      ];
      const preFilter = [
        "all",
        [">", ["get", "observed_ts"], currentTime],
        ["<=", ["get", "observed_ts"], preUpper],
      ];
      const rippleFilter = [
        "all",
        [">=", ["get", "observed_ts"], lowerBound],
        [">", ["get", "observed_ts"], currentTime - FRESH_WINDOW],
        ["<=", ["get", "observed_ts"], currentTime],
      ];

      if (map.getLayer(LAYER_POST))
        map.setFilter(LAYER_POST, postFilter as unknown as FilterSpecification);
      if (map.getLayer(LAYER_PRE))
        map.setFilter(LAYER_PRE, preFilter as unknown as FilterSpecification);
      for (const id of RIPPLE_IDS) {
        if (map.getLayer(id))
          map.setFilter(id, rippleFilter as unknown as FilterSpecification);
      }
    };

    applyFilter(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(500, applyFilter);
  }, [visible, lookbackDays, ensureSource, mapRef, mapTick, dataTick]);

  // 套用 opacity（乘以各 layer 的 base opacity；ripple 由 RAF 全權改寫，不在此列）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_POST)) {
      map.setPaintProperty(LAYER_POST, "circle-opacity", POST_OPACITY * o);
      map.setPaintProperty(LAYER_POST, "circle-stroke-opacity", POST_STROKE_OPACITY * o);
    }
    if (map.getLayer(LAYER_PRE)) {
      map.setPaintProperty(LAYER_PRE, "circle-stroke-opacity", PRE_STROKE_OPACITY * o);
    }
  }, [opacity, visible, mapRef, mapTick, dataTick]);

  // ripple 動畫：半徑用 data-driven expression，一次 setPaintProperty 服務全部震央
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

      // style 切換後 layers 可能消失 → 自癒重建
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
            ["*", ["get", "mag"], 2],
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
  }, [visible, ensureSource, mapRef, mapTick]);
}
