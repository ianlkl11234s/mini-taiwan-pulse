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
import { startThrottledRaf } from "../utils/throttledRaf";
import {
  EARTHQUAKE_RIPPLE_LAYER_ID,
  earthquakeRippleModule,
  mountLazyCustomLayer,
  removeLazyCustomLayer,
} from "../map/lazyThreeLayers";
// 只取型別：值走 lazy import，three 不進首屏 bundle（見 lazyThreeLayers 檔頭）
import type { EarthquakeRippleSnapshot } from "../map/earthquakeRippleCustomLayer";
import type { QuakeRippleItem } from "../three/QuakeRippleScene";
import { registerLayerDataProvider, summarizeEarthquakes } from "../research/layerDataSummary";

/**
 * USGS 全球地震 — timeline 連動 + 擴散圈動畫。
 *
 * 兩個 Mapbox circle 層共用同一份 geojson source（結構照抄 `useEarthquakeLayer`（CWA 國內），
 * 欄位對應 `occurred_ts → observed_ts`、`magnitude → mag`；配色沿用全球版原色），
 * 外加一個 Three.js custom layer 畫漣漪：
 *
 * - post   : 已發生（observed <= current）→ 淡標記持續顯示，**popup 掛在這層**
 * - pre    : 即將發生（current < observed <= current + PRE_WINDOW）→ 空心預示
 * - ripple : 剛發生（current - FRESH_WINDOW < observed <= current）→ 擴散圈動畫，
 *            由 `QuakeRippleScene`（Three.js）自繪。**不可**改回 Mapbox circle 層逐幀
 *            setPaintProperty：data-driven paint 每改一次 Mapbox 就把整份 source 標成 reload，
 *            漣漪播放期間 `map.loaded()` 恆為 false、idle 不觸發（2026-10-02 修掉）。
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
 *
 * 漣漪 RAF 只在「圖層可見 ∧ 窗口內有新地震 ∧ 時間軸時鐘在走」時跑。時鐘在走 =
 * 最近 CLOCK_STALE_MS 內 timeStore 時間有變（replay 播放每幀變、live 每秒變、拖曳／跳時間也算）；
 * 時間軸暫停超過 CLOCK_STALE_MS → RAF 停、漣漪收起，只留靜態震央點。
 */

const SOURCE_ID = "earthquakes-global";
/** ⚠️ 主層 id 不可改名：`gisClickRegistry` 的 popup 綁在這個字串上 */
const LAYER_POST = "earthquakes-global-circle";
const LAYER_PRE = "earthquakes-global-pre";

/** 預示視窗：發生前多久就出現淡標記（秒） */
const PRE_WINDOW = 1800; // 30 分鐘
/** 剛發生視窗：擴散動畫持續多久（秒，timeline 時間） */
const FRESH_WINDOW = 1200; // 20 分鐘
/**
 * 時間軸多久沒動就視為暫停（ms，掛鐘）。需大於 live 模式的 1Hz tick 與 filter 訂閱的 500ms 節流，
 * 且至少涵蓋一個漣漪週期（2400ms）——跳到某個時間點時至少完整播一輪。
 */
const CLOCK_STALE_MS = 3000;

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

/**
 * 已發生標記（post 層）的顯示時間窗：僅當日 → 台北日界 00:00 起；其餘 → 游標往前 N 天。
 * filter 與 Agent 畫面摘要共用，兩邊才會對得上畫面。
 */
export function earthquakeGlobalDisplayWindow(currentTime: number, lookbackDays: number): { from: number; to: number; dayEnd: number; onlyToday: boolean } {
  const onlyToday = lookbackDays <= 1;
  const { dayStart, dayEnd } = taipeiDayBounds(currentTime);
  return { from: onlyToday ? dayStart : currentTime - lookbackDays * SEC_PER_DAY, to: currentTime, dayEnd, onlyToday };
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

/** 深度色階 SSOT：Mapbox 圓點的 COLOR_EXPR 與 Three 漣漪的 depthRgb 都由這份推導 */
const DEPTH_COLOR_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#dc2626"],
  [30, "#f97316"],
  [70, "#facc15"],
  [150, "#38bdf8"],
  [300, "#3949ab"],
];

const COLOR_EXPR = [
  "interpolate", ["linear"], ["get", "depth_km"],
  ...DEPTH_COLOR_STOPS.flat(),
] as unknown as ExpressionSpecification;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const DEPTH_RGB_STOPS = DEPTH_COLOR_STOPS.map(([d, hex]) => [d, hexRgb(hex)] as const);

/** 與 COLOR_EXPR 同一份色階、同樣的 rgb 線性插值（Mapbox interpolate 預設空間）；範圍外夾到端點 */
export function depthRgb(depthKm: number): [number, number, number] {
  const stops = DEPTH_RGB_STOPS;
  const d = Number.isFinite(depthKm) ? depthKm : stops[0]![0];
  if (d <= stops[0]![0]) return [...stops[0]![1]];
  for (let i = 1; i < stops.length; i++) {
    const [d1, c1] = stops[i]!;
    if (d <= d1) {
      const [d0, c0] = stops[i - 1]!;
      const t = (d - d0) / (d1 - d0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return [...stops[stops.length - 1]![1]];
}

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
  // Three 漣漪圖層每幀讀這些 ref（不走 React deps）
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(Math.max(0, Math.min(1, opacity)));
  opacityRef.current = Math.max(0, Math.min(1, opacity));
  const ripplesRef = useRef<EarthquakeRippleSnapshot>({ version: 0, items: [] });
  /** hook 的漣漪 RAF 正在跑（custom layer 據此決定畫不畫） */
  const animatingRef = useRef(false);
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
    // 當初主因是本圖層自己的漣漪（每幀 data-driven setPaintProperty → source 每幀 reload）；
    // 漣漪已改 Three.js 自繪，但其他圖層的 tile 載入一樣會讓 isStyleLoaded() 長時間 false，
    // 所以這裡仍只等「style 已解析」（getStyle() 解析前／換底圖中會 throw），不等 tile。
    const styleParsed = (m: MapboxMap) => { try { return !!m.getStyle(); } catch { return false; } };
    const applyData = (evs: EarthquakeGlobalEvent[], dateKey: string) => {
      if (cancelled || inflightKey !== dateKey) return; // 期間又換日／換天數 → 這批已過期
      const map = mapRef.current;
      if (!map || !styleParsed(map)) {
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

  // 卸載時移除 Three 圖層（onRemove 釋放 GPU 資源）。mapTick 只會從「map 未就緒」跳一次，
  // 那時上一輪沒有 map、不會誤刪；放在 filter effect 之前，確保不會刪掉它剛掛上的圖層。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return () => {
      try {
        removeLazyCustomLayer(map, EARTHQUAKE_RIPPLE_LAYER_ID);
      } catch {
        // map 已銷毀
      }
    };
  }, [mapRef, mapTick]);

  // 更新 filter + 漣漪（訂閱 timeStore 節流 500ms，不走 React re-render）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;

    const v = visible ? "visible" : "none";
    for (const id of [LAYER_POST, LAYER_PRE]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    if (!visible) {
      // 關閉 → 移除 Three 圖層（onRemove 釋放 geometry / material / renderer）
      animatingRef.current = false;
      removeLazyCustomLayer(map, EARTHQUAKE_RIPPLE_LAYER_ID);
      return;
    }

    const mountRipple = (m: MapboxMap) => {
      try {
        mountLazyCustomLayer(m, EARTHQUAKE_RIPPLE_LAYER_ID, earthquakeRippleModule, (mod) =>
          mod.createEarthquakeRippleLayer({
            getIsVisible: () => visibleRef.current,
            getIsAnimating: () => animatingRef.current,
            getOpacity: () => opacityRef.current,
            getRipples: () => ripplesRef.current,
          }), () => visibleRef.current);
      } catch (err) {
        console.warn("[EarthquakesGlobal] ripple layer mount failed:", err);
      }
    };

    // 漣漪 RAF：只負責「叫 Mapbox 重畫」，畫面由 Three custom layer 依掛鐘相位自繪。
    // 不碰任何 Mapbox paint / filter / source —— 這是本次重寫的重點（見檔頭）。
    let cancelRaf: (() => void) | null = null;
    let lastClockMove = -Infinity;
    const stopRipple = () => {
      if (cancelRaf) {
        cancelRaf();
        cancelRaf = null;
      }
      if (animatingRef.current) {
        animatingRef.current = false;
        mapRef.current?.triggerRepaint(); // 再畫一次把最後一幀的圈清掉
      }
    };
    const rippleTick = (now: number) => {
      const m = mapRef.current;
      if (!m) return;
      if (now - lastClockMove > CLOCK_STALE_MS) {
        // 時間軸暫停 → 停 RAF、收起漣漪（cancelRaf 先清，避免 stopRipple 取消已在結束的迴圈）
        cancelRaf = null;
        animatingRef.current = false;
        m.triggerRepaint();
        return false;
      }
      animatingRef.current = true;
      m.triggerRepaint();
    };
    const startRipple = () => {
      if (!cancelRaf) cancelRaf = startThrottledRaf(rippleTick);
    };

    let lastTime: number | null = null;
    let lastSig: string | null = null;
    let lastFilterSig: string | null = null;
    const applyFilter = (currentTime: number) => {
      // 顯示窗下界：僅當日 → 台北日界 00:00；其餘 → 游標往前 N 天
      const { from: lowerBound, dayEnd, onlyToday } = earthquakeGlobalDisplayWindow(currentTime, lookbackDays);
      // 僅當日時，預示視窗不得越過日界（否則會露出明天的地震）
      const preUpper = onlyToday
        ? Math.min(currentTime + PRE_WINDOW, dayEnd)
        : currentTime + PRE_WINDOW;

      // setFilter 也會讓 Mapbox 把 source 標成 reload：只在「篩到的集合」真的變了才呼叫。
      // 三個邊界各自數一次落在左側的事件數，數字一樣 = 兩層篩到的集合完全一樣。
      let nLow = 0, nCur = 0, nPre = 0;
      const fresh: QuakeRippleItem[] = [];
      const freshIds: string[] = [];
      const freshLo = currentTime - FRESH_WINDOW;
      for (const e of eventsRef.current) {
        const ts = e.observed_ts;
        if (ts < lowerBound) nLow++;
        if (ts <= currentTime) nCur++;
        if (ts <= preUpper) nPre++;
        // 漣漪條件與舊 rippleFilter 相同
        if (ts > freshLo && ts <= currentTime && ts >= lowerBound) {
          fresh.push({ lng: e.lng, lat: e.lat, mag: e.mag, rgb: depthRgb(e.depth_km) });
          freshIds.push(e.event_id);
        }
      }
      const filterSig = `${nLow}:${nCur}:${nPre}`;
      if (filterSig !== lastFilterSig || !map.getLayer(LAYER_POST)) {
        lastFilterSig = filterSig;
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
        if (map.getLayer(LAYER_POST))
          map.setFilter(LAYER_POST, postFilter as unknown as FilterSpecification);
        if (map.getLayer(LAYER_PRE))
          map.setFilter(LAYER_PRE, preFilter as unknown as FilterSpecification);
      }

      const sig = freshIds.join("|");
      if (sig !== lastSig) {
        lastSig = sig;
        ripplesRef.current = { version: ripplesRef.current.version + 1, items: fresh };
      }
      if (currentTime !== lastTime) {
        lastTime = currentTime;
        lastClockMove = performance.now();
      }
      if (fresh.length > 0 && performance.now() - lastClockMove <= CLOCK_STALE_MS) startRipple();
      else stopRipple();
    };

    // 換底圖（setStyle）會清掉自建 source／layer：重建並立刻套回目前的 filter 與漣漪圖層
    const onStyleLoad = () => {
      const m = mapRef.current;
      if (!m || !visibleRef.current) return;
      layersReadyRef.current = false;
      if (!ensureSource(m)) return;
      lastFilterSig = null;
      applyFilter(timeStore.getTime());
      mountRipple(m);
    };

    mountRipple(map);
    applyFilter(timeStore.getTime()); // 初始化
    const unsub = timeStore.subscribeThrottled(500, applyFilter);
    map.on("style.load", onStyleLoad);
    return () => {
      unsub();
      map.off("style.load", onStyleLoad);
      stopRipple();
    };
  }, [visible, lookbackDays, ensureSource, mapRef, mapTick, dataTick]);

  // Agent 畫面摘要（AG-1）：點位走自建 source、漣漪走 Three，rendered features 讀不到 →
  // 直接用已抓的事件 + 與 post 層相同的時間窗統計。currentTime 在呼叫當下讀 timeStore（不進 deps）。
  useEffect(() => {
    if (!visible) return;
    return registerLayerDataProvider("earthquakesGlobal", (bounds) => {
      if (!dataReadyRef.current) return { status: "data_not_loaded" };
      const window = earthquakeGlobalDisplayWindow(timeStore.getTime(), lookbackDays);
      const label = window.onlyToday ? "時間軸當日（台灣時間）至游標" : `時間軸游標往前 ${lookbackDays} 天`;
      return summarizeEarthquakes(eventsRef.current, bounds, { from: window.from, to: window.to, label });
    });
  }, [visible, lookbackDays]);

  // 套用 opacity（乘以各 layer 的 base opacity）。漣漪在 Three 端每幀讀 opacityRef。
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
}
