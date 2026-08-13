import { useEffect, useRef, useCallback } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  LineLayer,
  ExpressionSpecification,
  GeoJSONSource,
} from "mapbox-gl";
import {
  fetchVesselWatchCurrent,
  fetchVesselWatchTrails,
  positionsToGeoJSON,
  frameToGeoJSON,
  type VesselWatchPosition,
  type VesselWatchTrail,
} from "../data/vesselWatchLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 特殊船舶（Vessel Watch）圖層 —— 海警／海巡／科研船／軍艦，隨時間軸移動
 *
 * - 資料：`live.vessel_watch_positions`（gis-platform migration 339/340）
 * - **純 Mapbox 疊層**：circle（船位）＋ line（軌跡）。兩個 source 分開餵，
 *   因為更新節奏不同（位置一次載入、軌跡隨日期／天數視窗換）。
 *
 * ⚠️ **絕不可改用 Three.js CustomLayer**：既有 `ships` 層已佔用 ShipScene，
 *    一個 Mapbox GL context 只能掛一個 Three.js CustomLayer（PRINCIPLES §L828）
 *    —— 兩個 WebGLRenderer 互踩 GL state，症狀是畫面全空但 log 全綠，極難 debug。
 *
 * ⚠️ **不做任何平滑插值**：AIS 每艘約 15 分鐘一筆、離岸即斷訊，軌跡是
 *    斷續取樣不是連續航跡。Catmull-Rom 會憑空生出船沒走過的路徑。
 *
 * ⚠️ 依鐵則（CLAUDE.md §6）**不得把 currentTime 放進 deps**：
 *    - 軌跡視窗的結束日 → `timeStore.subscribeDate`
 *    - 播放中的船位移動 → `timeStore.subscribeThrottled`（船會動就是靠這支）
 */

const CURRENT_SOURCE_ID = "vessel-watch-current";
const TRAILS_SOURCE_ID = "vessel-watch-trails";
const CIRCLE_ID = "vessel-watch-circle";
const TRAIL_LINE_ID = "vessel-watch-trail-line";

/**
 * 給 gisClickRegistry 的可點擊 layer 清單。
 * ⚠️ **circle 在前**：first-hit-wins，船點是小目標，排在自己的軌跡線之後會被線搶走。
 */
export const VESSEL_WATCH_CLICK_LAYERS = [CIRCLE_ID, TRAIL_LINE_ID];

/** 軌跡線比船點淡 —— 線是背景脈絡，當下位置才是主體 */
const TRAIL_OPACITY_RATIO = 0.45;

/**
 * 播放時每艘船身後的拖尾長度（秒）。
 * AIS 約 15 分鐘一筆，3 小時 ≈ 12 個點，足以看出航向又不會糊成一團。
 */
const TRAIL_TAIL_SEC = 3 * 3600;

/**
 * 時間軸節流間隔（毫秒）。~150 艘船每次要重算位置 + 兩次 setData，
 * 200ms（5fps）在快轉時已足夠流暢，又不會讓主執行緒忙於 GeoJSON 序列化。
 */
const TIME_THROTTLE_MS = 200;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 船點半徑隨 zoom 放大（遠看是密集小點，近看要點得到） */
const CIRCLE_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4, 2.5,
  7, 4.5,
  10, 7,
  14, 11,
] as unknown as ExpressionSpecification;

const CLASS_COLOR = ["get", "class_color"] as unknown as ExpressionSpecification;

/** stale（訊號中斷中，顯示的是最後已知位置）→ 降到三成不透明度 */
const STALE_RATIO = 0.3;

/**
 * 「疑似」（分類只有規則推測、未經查證）→ 降到四成不透明度。
 *
 * 2026-08-13 對 200 艘做網路查證後才有這個區分。實測目前海上 88 艘疑似 / 5 艘已查證
 * —— 疑似佔絕大多數，所以**預設仍顯示**（關掉畫面只剩零星幾艘，失去態勢感），
 * 只是用透明度誠實表達「這艘我們沒把握」。
 */
const PRESUMED_RATIO = 0.4;
/**
 * 不透明度依兩個維度衰減，兩者可疊加：
 *   stale    —— 訊號中斷中，畫的是最後已知位置（時間維度）
 *   presumed —— 分類未經查證（可信度維度）
 * 一艘「疑似且失聯」的船會是最淡的，這正確反映它的雙重不確定。
 */
function confidenceAware(base: number): ExpressionSpecification {
  return [
    "*",
    ["case", ["==", ["get", "stale"], 1], STALE_RATIO, 1],
    ["*", ["case", ["==", ["get", "presumed"], 1], PRESUMED_RATIO, 1], base],
  ] as unknown as ExpressionSpecification;
}

function buildLayers(map: MapboxMap, opacity: number): boolean {
  if (!map.getSource(CURRENT_SOURCE_ID) || !map.getSource(TRAILS_SOURCE_ID)) return false;

  // 軌跡線先加 → 船點壓在線之上（疊放順序 = 加入順序）
  if (!map.getLayer(TRAIL_LINE_ID)) {
    map.addLayer({
      id: TRAIL_LINE_ID,
      type: "line",
      source: TRAILS_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": CLASS_COLOR,
        "line-width": 1.4,
        "line-opacity": opacity * TRAIL_OPACITY_RATIO,
      },
    } as LineLayer);
  }

  if (!map.getLayer(CIRCLE_ID)) {
    map.addLayer({
      id: CIRCLE_ID,
      type: "circle",
      source: CURRENT_SOURCE_ID,
      paint: {
        "circle-color": CLASS_COLOR,
        "circle-radius": CIRCLE_RADIUS,
        // stale = 訊號中斷中，畫的是「最後已知位置」不是當下位置 → 淡化區隔
        "circle-opacity": confidenceAware(opacity),
        // 深色描邊讓亮色船點在亮底圖上也分得出來
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 0.8,
        "circle-stroke-opacity": confidenceAware(opacity * 0.8),
      },
    } as CircleLayer);
  }

  return true;
}

/**
 * 視窗結束時刻＝該日的**台北時間** 23:59:59.999。
 *
 * ⚠️ 偏移量必須寫 `+08:00` 不能寫 `Z`：`timeStore.getDateKey()` 是 Asia/Taipei 的
 * 日期，寫成 UTC 會讓視窗多含隔天早上 8 小時（回放歷史日期時就會拌進不屬於那天的船）。
 * 未來日期不必分支 —— RPC 只回實際存在的資料。
 */
function endOfDayIso(dateKey: string): string {
  return `${dateKey}T23:59:59.999+08:00`;
}

export function useVesselWatchLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
  trailDays: number = 3,
  /** 是否顯示「疑似」（分類僅規則推測、未經查證）的船。預設 true。 */
  showPresumed: boolean = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const positionsRef = useRef<VesselWatchPosition[] | null>(null);
  const trailsRef = useRef<VesselWatchTrail[] | null>(null);
  const layersReadyRef = useRef(false);
  /** 正在等的軌跡視窗 key —— 換日／換天數的競態靠它落地判斷 */
  const trailKeyRef = useRef<string>("");
  const currentLoadedRef = useRef(false);

  const ensureLayers = useCallback(
    (map: MapboxMap) => {
      for (const id of [CURRENT_SOURCE_ID, TRAILS_SOURCE_ID]) {
        if (!map.getSource(id)) {
          map.addSource(id, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
      }
      if (!layersReadyRef.current || !map.getLayer(CIRCLE_ID)) {
        layersReadyRef.current = buildLayers(map, opacity);
      }
      return layersReadyRef.current;
    },
    [opacity],
  );

  /**
   * 把「時間軸當下」的畫面餵給兩個 source —— 船會隨播放移動（同 ships 圖層的體感）。
   *
   * 有軌跡時一律走 `frameToGeoJSON`（依 currentTime 插值出當下位置 + 拖尾）；
   * 軌跡還沒回來時才用 `get_vessel_watch_current` 的最後已知位置墊著，
   * 避免圖層剛開啟的空窗期整片空白。
   */
  const refreshSources = useCallback((map: MapboxMap) => {
    const cur = map.getSource(CURRENT_SOURCE_ID) as GeoJSONSource | undefined;
    const tr = map.getSource(TRAILS_SOURCE_ID) as GeoJSONSource | undefined;
    const rows = trailsRef.current;

    if (rows && rows.length > 0) {
      const { points, trails } = frameToGeoJSON(rows, timeStore.getTime(), TRAIL_TAIL_SEC);
      cur?.setData(points);
      tr?.setData(trails);
      return;
    }
    cur?.setData(positionsToGeoJSON(positionsRef.current ?? []));
    tr?.setData(EMPTY_FC);
  }, []);

  // ── 最後已知位置：與時間軸無關，只在圖層開啟時載一次（loader 有 5min TTL）──
  useEffect(() => {
    if (!visible || currentLoadedRef.current) return;
    let cancelled = false;
    fetchVesselWatchCurrent()
      .then((rows) => {
        if (cancelled) return;
        currentLoadedRef.current = true;
        positionsRef.current = rows;
        const map = mapRef.current;
        if (map && ensureLayers(map)) {
          refreshSources(map);
          keepLoadingUntilMapIdle(
            map,
            "vessel-watch-render:current",
            "特殊船舶 渲染中",
            CURRENT_SOURCE_ID,
          );
        }
      })
      .catch((err) => {
        console.warn("[VesselWatch] load current failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, ensureLayers, refreshSources, mapRef, mapTick]);

  // ── 軌跡視窗載入（endDate 由 timeStore 提供，天數由 slider）──
  const loadTrails = useCallback(
    (dateKey: string) => {
      if (!dateKey) return;
      const endIso = endOfDayIso(dateKey);
      const key = `${endIso}|${trailDays}`;
      if (key === trailKeyRef.current) return;
      trailKeyRef.current = key;

      fetchVesselWatchTrails(endIso, trailDays)
        .then((rows) => {
          // 換日／換天數的競態：只有仍在等這一份時才落地
          if (trailKeyRef.current !== key) return;
          trailsRef.current = rows;
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSources(map);
            keepLoadingUntilMapIdle(
              map,
              `vessel-watch-render:${key}`,
              "特殊船舶軌跡 渲染中",
              TRAILS_SOURCE_ID,
            );
          }
        })
        .catch((err) => {
          console.warn(`[VesselWatch] load trails ${key} failed:`, err);
          if (trailKeyRef.current === key) trailKeyRef.current = "";
        });
    },
    [ensureLayers, refreshSources, mapRef, trailDays],
  );

  // ⚠️ deps 只有 visible / loadTrails（後者含 trailDays）—— **currentTime 不進 deps**，
  //    日期變動一律走 timeStore 訂閱（CLAUDE.md §6）。
  useEffect(() => {
    if (!visible) return;
    loadTrails(timeStore.getDateKey());
    return timeStore.subscribeDate(loadTrails);
  }, [visible, loadTrails]);

  // ── 時間軸播放：船隨 currentTime 移動 ──
  // ⚠️ 同樣**不把 currentTime 放進 deps**（CLAUDE.md §6），改走 timeStore 節流訂閱。
  //    這支是「船會動」的來源：每 tick 重算所有船在當下的位置與拖尾。
  useEffect(() => {
    if (!visible) return;
    const onTick = () => {
      const map = mapRef.current;
      if (!map || !layersReadyRef.current) return;
      refreshSources(map);
    };
    onTick();
    return timeStore.subscribeThrottled(TIME_THROTTLE_MS, onTick);
  }, [visible, refreshSources, mapRef, mapTick]);

  // ── 可見性 + 換底圖後重建圖層 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const vis = visible ? "visible" : "none";
      for (const id of [TRAIL_LINE_ID, CIRCLE_ID]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
      }
    };

    if (!visible) {
      apply();
      return;
    }
    if (!ensureLayers(map)) return;
    refreshSources(map);
    apply();

    // 換底圖會清掉 source/layer，重餵一次
    const onStyleLoad = () => {
      layersReadyRef.current = false;
      if (!ensureLayers(map)) return;
      refreshSources(map);
      apply();
    };
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [visible, ensureLayers, refreshSources, mapRef, mapTick]);

  // ── 「含疑似」開關：用 Mapbox filter 而非重建 source ──
  // 兩個 source 的資料不變，只切 filter —— 切換不必重打 RPC，也不用重算 frame。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const f = showPresumed ? null : (["!=", ["get", "presumed"], 1] as unknown as never);
    for (const id of [CIRCLE_ID, TRAIL_LINE_ID]) {
      if (map.getLayer(id)) map.setFilter(id, f);
    }
  }, [showPresumed, visible, mapRef, mapTick]);

  // ── 透明度 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(CIRCLE_ID)) {
      map.setPaintProperty(CIRCLE_ID, "circle-opacity", o);
      map.setPaintProperty(CIRCLE_ID, "circle-stroke-opacity", o * 0.8);
    }
    if (map.getLayer(TRAIL_LINE_ID)) {
      map.setPaintProperty(TRAIL_LINE_ID, "line-opacity", o * TRAIL_OPACITY_RATIO);
    }
  }, [opacity, visible, mapRef, mapTick]);
}
