import { useEffect, useRef, useCallback, useState } from "react";
import type {
  Map as MapboxMap,
  LineLayer,
  CircleLayer,
  ExpressionSpecification,
  FilterSpecification,
} from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { timeStore } from "../state/timeStore";
import {
  fetchTyphoonPoints,
  typhoonPointsToGeoJSON,
  type TyphoonPoint,
} from "../data/typhoonTracksLoader";

// 颱風軌跡 — observed 實線 + forecast 虛線 + 軌跡點 + 現在位置光圈。
//
// 跟著時間軸走（鐵則：currentTime 禁止進 effect deps，一律 timeStore 訂閱）：
//   · observed 線段：整段落在 currentTime 之前才畫（軌跡逐段長出來）
//   · forecast 線段：整段在 currentTime 之後才畫（還沒到的預報虛線）
//   · 軌跡點：observed 取 ≤ currentTime、forecast 取 > currentTime
//   · 現在位置光圈：挑 [valid_ts, valid_until) 包住 currentTime 的觀測點 → 沿軌跡移動
// 三個 source 的 feature 都在 loader 端就帶好時間欄位，這裡只 setFilter，不 setData。

const SRC_LINES = "typhoon-tracks-lines";
const SRC_POINTS = "typhoon-tracks-points";
const SRC_CURRENT = "typhoon-tracks-current";
const LAYER_LINE_OBS = "typhoon-tracks-line-observed";
const LAYER_LINE_FCST = "typhoon-tracks-line-forecast";
const LAYER_POINTS = "typhoon-tracks-points";
const LAYER_CURRENT_HALO = "typhoon-tracks-current-halo";
const LAYER_CURRENT_RING = "typhoon-tracks-current-ring";
const LAYER_CURRENT_DOT = "typhoon-tracks-current-dot";
const CURRENT_LAYER_IDS = [LAYER_CURRENT_HALO, LAYER_CURRENT_RING, LAYER_CURRENT_DOT];
const ALL_LAYER_IDS = [LAYER_LINE_OBS, LAYER_LINE_FCST, LAYER_POINTS, ...CURRENT_LAYER_IDS];

// 實際=紫 #a855f7（粗實線 / 實心點）；預測=藍 #38bdf8（細疏虛線 / 空心點）— 拉開差異
const OBS_COLOR = "#a855f7";
const FCST_COLOR = "#38bdf8";

export type TyphoonSource = "all" | "jma" | "jtwc";

export function useTyphoonTracksLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
  sourceFilter: TyphoonSource = "all",
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<TyphoonPoint[]>([]);
  const dataReadyRef = useRef(false);
  const layersReadyRef = useRef(false);
  // 資料到齊通知：map 先就緒、資料後到是常態路徑，沒有這個 tick，下方的
  // timeStore 訂閱 effect 只會在資料未到時跑一次就早退，時間軸永遠接不上。
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataReadyRef.current) return;
    let cancelled = false;
    fetchTyphoonPoints()
      .then((pts) => {
        if (cancelled) return;
        dataRef.current = pts;
        dataReadyRef.current = true;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
        setDataTick((v) => v + 1);
      })
      .catch((err) => console.warn("[TyphoonTracks] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    const { lines, points, current } = typhoonPointsToGeoJSON(dataRef.current);
    if (!map.getSource(SRC_LINES)) {
      map.addSource(SRC_LINES, { type: "geojson", data: lines });
    }
    if (!map.getSource(SRC_POINTS)) {
      map.addSource(SRC_POINTS, { type: "geojson", data: points });
    }
    if (!map.getSource(SRC_CURRENT)) {
      map.addSource(SRC_CURRENT, { type: "geojson", data: current });
    }
    if (!map.getLayer(LAYER_LINE_OBS)) {
      map.addLayer({
        id: LAYER_LINE_OBS,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "observed"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": OBS_COLOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4.5] as unknown as ExpressionSpecification,
          "line-opacity": 0.95,
        },
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_LINE_FCST)) {
      map.addLayer({
        id: LAYER_LINE_FCST,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "forecast"],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": FCST_COLOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 2] as unknown as ExpressionSpecification,
          "line-opacity": 0.8,
          "line-dasharray": [1, 2.5],
        },
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_POINTS)) {
      map.addLayer({
        id: LAYER_POINTS,
        type: "circle",
        source: SRC_POINTS,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 5] as unknown as ExpressionSpecification,
          // 預測=空心藍環（透明填色）；實際=實心紫點
          "circle-color": ["case", ["==", ["get", "point_type"], "forecast"], "rgba(0,0,0,0)", OBS_COLOR] as unknown as ExpressionSpecification,
          "circle-opacity": 0.85,
          "circle-stroke-color": ["case", ["==", ["get", "point_type"], "forecast"], FCST_COLOR, "#ffffff"] as unknown as ExpressionSpecification,
          "circle-stroke-width": ["case", ["==", ["get", "point_type"], "forecast"], 1.5, 0.5] as unknown as ExpressionSpecification,
          "circle-stroke-opacity": 0.9,
        },
      } as CircleLayer);
    }
    // 現在位置示意圈：外圈半透明光暈 + 亮環 + 中心點（醒目標出活躍颱風當下位置）
    if (!map.getLayer(LAYER_CURRENT_HALO)) {
      map.addLayer({
        id: LAYER_CURRENT_HALO,
        type: "circle",
        source: SRC_CURRENT,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 14, 8, 34] as unknown as ExpressionSpecification,
          "circle-color": "#f0abfc",
          "circle-opacity": 0.16,
          "circle-blur": 0.6,
        },
      } as CircleLayer);
    }
    if (!map.getLayer(LAYER_CURRENT_RING)) {
      map.addLayer({
        id: LAYER_CURRENT_RING,
        type: "circle",
        source: SRC_CURRENT,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 8, 20] as unknown as ExpressionSpecification,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fde047",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 3] as unknown as ExpressionSpecification,
          "circle-stroke-opacity": 0.95,
        },
      } as CircleLayer);
    }
    if (!map.getLayer(LAYER_CURRENT_DOT)) {
      map.addLayer({
        id: LAYER_CURRENT_DOT,
        type: "circle",
        source: SRC_CURRENT,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.5, 8, 5] as unknown as ExpressionSpecification,
          "circle-color": "#fde047",
          "circle-opacity": 1,
        },
      } as CircleLayer);
    }
    layersReadyRef.current = true;
    return true;
  }, []);

  // 可見性 + 時間過濾（訂閱 timeStore 節流 500ms，不走 React re-render）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;
    const v = visible ? "visible" : "none";
    for (const id of ALL_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    if (!visible) return;

    // 資料源篩選（全部 / JMA / JTWC）：與時間條件一起併進同一個 ["all", ...]
    const srcCond: unknown[] | null =
      sourceFilter === "all" ? null : ["==", ["get", "source"], sourceFilter];
    const compose = (...conds: (unknown[] | null)[]): FilterSpecification =>
      ["all", ...conds.filter(Boolean), ...(srcCond ? [srcCond] : [])] as unknown as FilterSpecification;
    const setF = (id: string, ...conds: (unknown[] | null)[]) => {
      if (map.getLayer(id)) map.setFilter(id, compose(...conds));
    };

    const applyFilter = (currentTime: number) => {
      // 線段逐段揭露：observed 段整段走完才畫；forecast 段整段還沒到才畫
      setF(
        LAYER_LINE_OBS,
        ["==", ["get", "point_type"], "observed"],
        ["<=", ["get", "seg_end_ts"], currentTime],
      );
      setF(
        LAYER_LINE_FCST,
        ["==", ["get", "point_type"], "forecast"],
        [">=", ["get", "seg_start_ts"], currentTime],
      );
      setF(LAYER_POINTS, [
        "any",
        ["all", ["==", ["get", "point_type"], "observed"], ["<=", ["get", "valid_ts"], currentTime]],
        ["all", ["==", ["get", "point_type"], "forecast"], [">", ["get", "valid_ts"], currentTime]],
      ]);
      // 現在位置光圈：有效區間包住 currentTime 的那一個觀測點（每個 storm×source 至多一點）
      // → 拉時間軸時沿軌跡移動；currentTime = now 時等價於「最後觀測還夠新」的牆鐘判活躍
      for (const id of CURRENT_LAYER_IDS) {
        setF(
          id,
          ["<=", ["get", "valid_ts"], currentTime],
          [">", ["get", "valid_until"], currentTime],
        );
      }
    };

    applyFilter(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(500, applyFilter);
  }, [visible, sourceFilter, ensureSource, mapRef, mapTick, dataTick]);

  // 套用 opacity（乘以各 layer 的 base opacity）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_LINE_OBS)) map.setPaintProperty(LAYER_LINE_OBS, "line-opacity", 0.9 * o);
    if (map.getLayer(LAYER_LINE_FCST)) map.setPaintProperty(LAYER_LINE_FCST, "line-opacity", 0.7 * o);
    if (map.getLayer(LAYER_POINTS)) map.setPaintProperty(LAYER_POINTS, "circle-opacity", 0.85 * o);
    if (map.getLayer(LAYER_CURRENT_HALO)) map.setPaintProperty(LAYER_CURRENT_HALO, "circle-opacity", 0.16 * o);
    if (map.getLayer(LAYER_CURRENT_RING)) map.setPaintProperty(LAYER_CURRENT_RING, "circle-stroke-opacity", 0.95 * o);
    if (map.getLayer(LAYER_CURRENT_DOT)) map.setPaintProperty(LAYER_CURRENT_DOT, "circle-opacity", 1 * o);
  }, [opacity, visible, mapRef, mapTick, dataTick]);
}
