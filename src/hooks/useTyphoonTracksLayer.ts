import { useEffect, useRef, useCallback, useState } from "react";
import type {
  Map as MapboxMap,
  LineLayer,
  FillLayer,
  CircleLayer,
  ExpressionSpecification,
  FilterSpecification,
} from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { timeStore } from "../state/timeStore";
import {
  fetchTyphoonPoints,
  typhoonPointsToGeoJSON,
  type TyphoonPoint,
} from "../data/typhoonTracksLoader";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { registerLayerDataProvider, summarizeTyphoons } from "../research/layerDataSummary";
import { TYPHOON_GALE_COLOR, TYPHOON_STORM_COLOR } from "../data/typhoonTypes";

// 颱風軌跡 — observed 實線 + forecast 虛線 + 軌跡點 + 現在位置光圈。
//
// 跟著時間軸走（鐵則：currentTime 禁止進 effect deps，一律 timeStore 訂閱）：
//   · observed 線段：整段落在 currentTime 之前才畫（軌跡逐段長出來）
//   · forecast 線段：整段在 currentTime 之後才畫（還沒到的預報虛線）
//   · 軌跡點：observed 取 ≤ currentTime、forecast 取 > currentTime
//   · 現在位置光圈：挑 [valid_ts, valid_until) 包住 currentTime 的觀測點 → 沿軌跡移動
//   · 7／10 級風圈（mig 476，目前只有 CWA 給）：與光圈同一個 [valid_ts, valid_until) 區間
//   · 70% 機率圈：最新一版預報點，只畫 currentTime 之後的
// 「全部」模式：同 storm_key 只畫優先序最高的一家（feature 帶 primary 旗標，見 loader
//  TYPHOON_SOURCE_PRIORITY）；風圈不受 primary 限制（只有 CWA 有，主軌跡換來源也照畫）。
// 所有 source 的 feature 都在 loader 端就帶好時間欄位，這裡只 setFilter，不 setData。

const SRC_LINES = "typhoon-tracks-lines";
const SRC_POINTS = "typhoon-tracks-points";
const SRC_CURRENT = "typhoon-tracks-current";
const SRC_RADII = "typhoon-tracks-radii";
const SRC_PROB70 = "typhoon-tracks-prob70";
const LAYER_RADII_FILL = "typhoon-tracks-radii-fill";
const LAYER_RADII_LINE = "typhoon-tracks-radii-line";
const LAYER_PROB70 = "typhoon-tracks-prob70-line";
const LAYER_LINE_OBS = "typhoon-tracks-line-observed";
const LAYER_LINE_FCST = "typhoon-tracks-line-forecast";
const LAYER_POINTS = "typhoon-tracks-points";
const LAYER_CURRENT_HALO = "typhoon-tracks-current-halo";
const LAYER_CURRENT_RING = "typhoon-tracks-current-ring";
const LAYER_CURRENT_DOT = "typhoon-tracks-current-dot";
const CURRENT_LAYER_IDS = [LAYER_CURRENT_HALO, LAYER_CURRENT_RING, LAYER_CURRENT_DOT];
const ALL_LAYER_IDS = [LAYER_RADII_FILL, LAYER_RADII_LINE, LAYER_PROB70, LAYER_LINE_OBS, LAYER_LINE_FCST, LAYER_POINTS, ...CURRENT_LAYER_IDS];

// 實際=紫 #a855f7（粗實線 / 實心點）；預測=藍 #38bdf8（細疏虛線 / 空心點）— 拉開差異
const OBS_COLOR = "#a855f7";
const FCST_COLOR = "#38bdf8";
const RADII_COLOR: ExpressionSpecification = ["match", ["get", "radius_kind"], "storm", TYPHOON_STORM_COLOR, TYPHOON_GALE_COLOR];
const RADII_FILL_OPACITY: ExpressionSpecification = ["match", ["get", "radius_kind"], "storm", 0.22, 0.12];

const OPACITY_DEFAULT = Number(paramDefault("typhoonTracks", "typhoonTracksOpacity"));
const IS_FORECAST: ExpressionSpecification = ["==", ["get", "point_type"], "forecast"];

/**
 * 點描邊：預測點（point_type=forecast）＝透明填色＋藍色外框的空心環，外框是圖形（資料編碼）、維持原色原寬；
 * 實際觀測點才用底圖色細縫。建圖層與主題／透明度更新共用，避免任一處把值寫回。
 */
function typhoonPointStroke(isDark: boolean, opacityFactor: number) {
  const seam = pointStrokePaint(isDark, opacityFactor);
  return {
    "circle-stroke-color": ["case", IS_FORECAST, FCST_COLOR, seam["circle-stroke-color"]] as unknown as ExpressionSpecification,
    "circle-stroke-width": ["case", IS_FORECAST, 1.5, seam["circle-stroke-width"]] as unknown as ExpressionSpecification,
    "circle-stroke-opacity": seam["circle-stroke-opacity"],
  };
}

export type TyphoonSource = "all" | "jma" | "jtwc" | "cwa";

export function useTyphoonTracksLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
  sourceFilter: TyphoonSource = "all",
  isDark: boolean = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  // 建圖層時讀最新主題；主題／透明度變動只走下方 setPaintProperty，不重建 ensureSource／timeStore 訂閱
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
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
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    const { lines, points, current, radii, prob70 } = typhoonPointsToGeoJSON(dataRef.current);
    if (!map.getSource(SRC_LINES)) {
      map.addSource(SRC_LINES, { type: "geojson", data: lines });
    }
    if (!map.getSource(SRC_POINTS)) {
      map.addSource(SRC_POINTS, { type: "geojson", data: points });
    }
    if (!map.getSource(SRC_CURRENT)) {
      map.addSource(SRC_CURRENT, { type: "geojson", data: current });
    }
    if (!map.getSource(SRC_RADII)) {
      map.addSource(SRC_RADII, { type: "geojson", data: radii });
    }
    if (!map.getSource(SRC_PROB70)) {
      map.addSource(SRC_PROB70, { type: "geojson", data: prob70 });
    }
    // 風圈與機率圈先加（壓在軌跡線下）；10 級在 7 級之上靠 feature 順序（loader 先 gale 後 storm）
    if (!map.getLayer(LAYER_RADII_FILL)) {
      map.addLayer({
        id: LAYER_RADII_FILL,
        type: "fill",
        source: SRC_RADII,
        paint: hookFillPaint("typhoonTracks", LAYER_RADII_FILL, {
          "fill-color": RADII_COLOR,
          "fill-opacity": RADII_FILL_OPACITY,
        }, { "fill-color": RADII_COLOR, "fill-opacity": RADII_FILL_OPACITY }),
      } as FillLayer);
    }
    if (!map.getLayer(LAYER_RADII_LINE)) {
      map.addLayer({
        id: LAYER_RADII_LINE,
        type: "line",
        source: SRC_RADII,
        layout: hookLineLayout("typhoonTracks", LAYER_RADII_LINE),
        paint: hookLinePaint("typhoonTracks", LAYER_RADII_LINE, {
          "line-color": RADII_COLOR,
          "line-width": 1.5,
          "line-opacity": 0.85,
        }, { "line-color": RADII_COLOR, "line-width": 1.5, "line-opacity": 0.85 }),
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_PROB70)) {
      map.addLayer({
        id: LAYER_PROB70,
        type: "line",
        source: SRC_PROB70,
        layout: { ...hookLineLayout("typhoonTracks", LAYER_PROB70), "line-cap": "butt" },
        paint: hookLinePaint("typhoonTracks", LAYER_PROB70, {
          "line-color": FCST_COLOR,
          "line-width": 1,
          "line-opacity": 0.6,
          "line-dasharray": [3, 3],
        }, { "line-color": FCST_COLOR, "line-width": 1, "line-opacity": 0.6, "line-dasharray": [3, 3] }),
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_LINE_OBS)) {
      map.addLayer({
        id: LAYER_LINE_OBS,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "observed"],
        layout: hookLineLayout("typhoonTracks", LAYER_LINE_OBS),
        paint: hookLinePaint("typhoonTracks", LAYER_LINE_OBS, {
          "line-color": OBS_COLOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4.5] as unknown as ExpressionSpecification,
          "line-opacity": 0.95,
        }, { "line-color": OBS_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4.5] as unknown as ExpressionSpecification, "line-opacity": 0.95 }),
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_LINE_FCST)) {
      map.addLayer({
        id: LAYER_LINE_FCST,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "forecast"],
        // 預測線是點狀虛線 [1, 2.5]，圓頭會把點拉長、間隔變短 → 維持平頭（L-3 例外）
        layout: { ...hookLineLayout("typhoonTracks", LAYER_LINE_FCST), "line-cap": "butt" },
        paint: hookLinePaint("typhoonTracks", LAYER_LINE_FCST, {
          "line-color": FCST_COLOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 2] as unknown as ExpressionSpecification,
          "line-opacity": 0.8,
          "line-dasharray": [1, 2.5],
        }, { "line-color": FCST_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 2] as unknown as ExpressionSpecification, "line-opacity": 0.8, "line-dasharray": [1, 2.5] }),
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_POINTS)) {
      map.addLayer({
        id: LAYER_POINTS,
        type: "circle",
        source: SRC_POINTS,
        paint: {
          "circle-radius": pointRadius("M"),
          // 預測=空心藍環（透明填色）；實際=實心紫點
          "circle-color": ["case", ["==", ["get", "point_type"], "forecast"], "rgba(0,0,0,0)", OBS_COLOR] as unknown as ExpressionSpecification,
          "circle-opacity": 0.85,
          ...typhoonPointStroke(isDarkRef.current, 1),
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
          "circle-radius": pointRadius("M") * 2,
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
          "circle-radius": pointRadius("M") * 2,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fde047",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 3] as unknown as ExpressionSpecification,
          "circle-stroke-opacity": 0.35,
          "circle-blur": 0.6,
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

    // 資料源篩選（全部 / JMA / JTWC / CWA）：與時間條件一起併進同一個 ["all", ...]
    // 「全部」＝同 storm_key 只畫 primary 那家（同一颱風畫成一個）
    const srcCond: unknown[] =
      sourceFilter === "all" ? ["==", ["get", "primary"], true] : ["==", ["get", "source"], sourceFilter];
    const radiiSrcCond: unknown[] | null =
      sourceFilter === "all" ? null : ["==", ["get", "source"], sourceFilter];
    const compose = (...conds: (unknown[] | null)[]): FilterSpecification =>
      ["all", ...conds.filter(Boolean), srcCond] as unknown as FilterSpecification;
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
      // 風圈：同光圈的區間；不套 primary（主軌跡換來源時風圈仍畫）
      const radiiFilter = [
        "all",
        ["<=", ["get", "valid_ts"], currentTime],
        [">", ["get", "valid_until"], currentTime],
        ...(radiiSrcCond ? [radiiSrcCond] : []),
      ] as unknown as FilterSpecification;
      for (const id of [LAYER_RADII_FILL, LAYER_RADII_LINE]) {
        if (map.getLayer(id)) map.setFilter(id, radiiFilter);
      }
      setF(LAYER_PROB70, [">", ["get", "valid_ts"], currentTime]);
    };

    applyFilter(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(500, applyFilter);
  }, [visible, sourceFilter, ensureSource, mapRef, mapTick, dataTick]);

  // Agent 畫面摘要（AG-1）：自建 source，改用已載入的軌跡點算「此刻活動中的颱風」（同黃色光圈的判定）
  useEffect(() => {
    if (!visible) return;
    return registerLayerDataProvider("typhoonTracks", (bounds) =>
      summarizeTyphoons(dataRef.current, bounds, timeStore.getTime(), sourceFilter, dataReadyRef.current));
  }, [visible, sourceFilter]);

  // 套用 opacity（乘以各 layer 的 base opacity）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_LINE_OBS)) map.setPaintProperty(LAYER_LINE_OBS, "line-opacity", hookLineOpacity("typhoonTracks", LAYER_LINE_OBS, 0.9 * o, 0.9 * 0.9));
    if (map.getLayer(LAYER_LINE_FCST)) map.setPaintProperty(LAYER_LINE_FCST, "line-opacity", hookLineOpacity("typhoonTracks", LAYER_LINE_FCST, 0.7 * o, 0.7 * 0.9));
    if (map.getLayer(LAYER_POINTS)) {
      map.setPaintProperty(LAYER_POINTS, "circle-opacity", 0.85 * o);
      for (const [k, v] of Object.entries(typhoonPointStroke(isDark, o / OPACITY_DEFAULT))) {
        map.setPaintProperty(LAYER_POINTS, k as "circle-stroke-color", v as never);
      }
    }
    if (map.getLayer(LAYER_CURRENT_HALO)) map.setPaintProperty(LAYER_CURRENT_HALO, "circle-opacity", 0.16 * o);
    if (map.getLayer(LAYER_CURRENT_RING)) map.setPaintProperty(LAYER_CURRENT_RING, "circle-stroke-opacity", 0.35 * Math.min(1, o / 0.9));
    if (map.getLayer(LAYER_CURRENT_DOT)) map.setPaintProperty(LAYER_CURRENT_DOT, "circle-opacity", 1 * o);
    const radiiFillO = ["match", ["get", "radius_kind"], "storm", 0.22 * o, 0.12 * o] as unknown as ExpressionSpecification;
    if (map.getLayer(LAYER_RADII_FILL)) map.setPaintProperty(LAYER_RADII_FILL, "fill-opacity", hookFillOpacity("typhoonTracks", LAYER_RADII_FILL, radiiFillO, RADII_FILL_OPACITY));
    if (map.getLayer(LAYER_RADII_LINE)) map.setPaintProperty(LAYER_RADII_LINE, "line-opacity", hookLineOpacity("typhoonTracks", LAYER_RADII_LINE, 0.85 * o, 0.85 * 0.9));
    if (map.getLayer(LAYER_PROB70)) map.setPaintProperty(LAYER_PROB70, "line-opacity", hookLineOpacity("typhoonTracks", LAYER_PROB70, 0.6 * o, 0.6 * 0.9));
  }, [opacity, isDark, visible, mapRef, mapTick, dataTick]);
}
