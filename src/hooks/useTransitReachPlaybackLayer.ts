/**
 * 交通可及性「單一起點播放」圖層 hook（模擬面板，公開）。
 *
 * - 格面：自訂 WebGL 圖層（`transitReachCustomLayer.ts`），每幀只更新時間 uniform；時間來自 scoped 時鐘
 *   `transitReachClock`（不訂閱全站 currentTime，development-rules §8）。播放時本 hook 跑 RAF 只做 `triggerRepaint`。
 * - 等時線：切起點／模式／車速時算一次（d3-contour 延遲載入）；播放只在跨整點時改 filter（≤12 次）。
 * - 航班／船班：虛線（推估，map-layers L-2）；起點：圓點。
 * - 點擊讀值：自訂圖層不能 queryRenderedFeatures，`useMapInteraction` 用 h3 latLngToCell 查 `transitReachPlaybackState`。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { loadH3 } from "../map/h3Runtime";
import { withLoading } from "../lib/loadingRegistry";
import { createTransitReachLayer, TRANSIT_REACH_CUSTOM_LAYER_ID, type TransitReachCustomLayer } from "../map/transitReachCustomLayer";
import {
  cellIndexOf, loadTransitReachBase, loadTransitReachOd, setTransitReachPlaybackState, setTransitReachNotice,
  type TransitReachBase,
} from "../data/transitReachStore";
import { computeIsochrones, isoGridCells } from "../data/transitReachIsochrones";
import {
  TRANSIT_REACH_FIXED_RANGE_H, TRANSIT_REACH_ROUTE_COLORS, autoRangeHours, isCompareMode, maxReachedMinutes, modeFiles,
  type TransitReachMode, type TransitReachRange, type TransitReachSpeed,
} from "../data/transitReachTypes";
import { reportSimBundleError } from "../data/simBundle";
import { TRANSIT_REACH_SLUG } from "../data/transitReachTypes";
import { transitReachClock } from "../state/transitReachClock";
import { subscribeTransitReachOrigin, transitReachSelectedOrigin } from "../state/transitReachOriginSelect";
import { useMapReadyTick } from "./useMapReadyTick";

export const TRANSIT_REACH_PLAYBACK_IDS = {
  routes: "transit-reach-routes-line",
  isoCasing: "transit-reach-iso-casing",
  isoLine: "transit-reach-iso-line",
  isoLabel: "transit-reach-iso-label",
  origin: "transit-reach-origin-circle",
} as const;
const SRC = { routes: "transit-reach-routes-src", iso: "transit-reach-iso-src", origin: "transit-reach-origin-src" } as const;
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LAYER_IDS = [TRANSIT_REACH_PLAYBACK_IDS.isoLabel, TRANSIT_REACH_PLAYBACK_IDS.isoLine, TRANSIT_REACH_PLAYBACK_IDS.isoCasing, TRANSIT_REACH_PLAYBACK_IDS.origin, TRANSIT_REACH_PLAYBACK_IDS.routes, TRANSIT_REACH_CUSTOM_LAYER_ID];

export interface TransitReachPlaybackControls {
  mode: TransitReachMode;
  speed: TransitReachSpeed;
  range: TransitReachRange;
  isochrones: boolean;
}

/** 效能量測（DEV 掛到 window.__transitReachPerf，驗收用） */
export interface TransitReachPerf { frames: number; frameMsSum: number; frameMsMax: number; renderMsSum: number; renders: number; isoMs: number; setTimesMs: number; gridCellMs: number }
const perf: TransitReachPerf = { frames: 0, frameMsSum: 0, frameMsMax: 0, renderMsSum: 0, renders: 0, isoMs: 0, setTimesMs: 0, gridCellMs: 0 };
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __transitReachPerf: TransitReachPerf }).__transitReachPerf = perf;

function removeAll(map: MapboxMap) {
  for (const id of LAYER_IDS) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  for (const id of Object.values(SRC)) { try { if (map.getSource(id)) map.removeSource(id); } catch { /* style replaced */ } }
}

/** 航班／船班虛線 GeoJSON */
function routesGeoJSON(base: TransitReachBase): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: base.routes.map((r) => ({
      type: "Feature", properties: { kind: r.kind },
      geometry: { type: "LineString", coordinates: [r.from_xy, r.to_xy] },
    })),
  };
}

/** 等時線只畫到目前時間的整點（filter，跨整點才改） */
const isoFilter = (hour: number, rangeH: number) => ["all", ["<=", ["get", "h"], hour], ["<=", ["get", "h"], rangeH]];

export function useTransitReachPlaybackLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: TransitReachPlaybackControls,
  isDark = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [base, setBase] = useState<TransitReachBase | null>(null);
  const [rangeH, setRangeH] = useState(TRANSIT_REACH_FIXED_RANGE_H);
  const [iso, setIso] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const origin = useSyncExternalStore(subscribeTransitReachOrigin, transitReachSelectedOrigin);
  const layerRef = useRef<TransitReachCustomLayer | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const geometryReady = useRef(false);
  const timesRef = useRef<Uint16Array | null>(null);

  if (!layerRef.current) {
    layerRef.current = createTransitReachLayer({
      getTimeMin: () => transitReachClock.get() / 60,
      getOpacity: () => opacityRef.current,
      onRenderMs: (ms) => { perf.renderMsSum += ms; perf.renders++; },
    });
  }

  // 基本檔（cells、origins、routes）：第一次開圖層才抓
  useEffect(() => {
    if (!visible || base) return;
    let cancelled = false;
    loadTransitReachBase().then((b) => { if (!cancelled) setBase(b); }).catch(() => { /* simBundle 已記錄狀態，圖例顯示錯誤 */ });
    return () => { cancelled = true; };
  }, [visible, base]);

  // 靜態幾何：h3 延遲載入後建一次
  useEffect(() => {
    if (!visible || !base || geometryReady.current) return;
    let cancelled = false;
    withLoading("transit-reach-geometry", "交通可及性網格幾何", loadH3().then((h3) => {
      if (cancelled) return;
      const rings = base.cells.ids.map((id) => h3.cellToBoundary(id));
      const centers = base.cells.ids.map((id) => h3.cellToLatLng(id));
      layerRef.current!.setGeometry({ rings, centers, u: base.cells.u });
      geometryReady.current = true;
    })).catch((error: unknown) => { if (!cancelled) reportSimBundleError(TRANSIT_REACH_SLUG, "h3 geometry", error); });
    return () => { cancelled = true; };
  }, [visible, base]);

  // 起點／模式／車速：載入到達時間 → 上傳 GPU、算色階範圍、等時線
  useEffect(() => {
    if (!visible || !base || !origin) return;
    const { main, base: baseMode } = modeFiles(controls.mode);
    const available = origin.modes_available;
    if (!available.includes(main) || (baseMode && !available.includes(baseMode))) {
      layerRef.current!.setTimes(null, null, false);
      setTransitReachPlaybackState(null);
      setTransitReachNotice({ kind: "noMode", originName: origin.name, mode: controls.mode, stationKind: origin.mode });
      setIso(null);
      return;
    }
    setTransitReachNotice(null);
    let cancelled = false;
    Promise.all([
      loadTransitReachOd(base.bundle, controls.speed, main, origin),
      baseMode ? loadTransitReachOd(base.bundle, controls.speed, baseMode, origin) : Promise.resolve(null),
    ]).then(async ([mainTimes, baseTimes]) => {
      if (cancelled) return;
      if (mainTimes.length !== base.cells.ids.length || (baseTimes && baseTimes.length !== base.cells.ids.length)) throw new Error("起點檔長度與 cells.json 不符");
      const t0 = performance.now();
      layerRef.current!.setTimes(mainTimes, baseTimes, isCompareMode(controls.mode));
      perf.setTimesMs = performance.now() - t0;
      timesRef.current = mainTimes;
      const hours = controls.range === "auto" ? autoRangeHours(maxReachedMinutes(mainTimes, base.cells.u)) : TRANSIT_REACH_FIXED_RANGE_H;
      layerRef.current!.setRangeHours(hours);
      setRangeH(hours);
      setTransitReachPlaybackState({ origin, mode: controls.mode, speed: controls.speed, main: mainTimes, base: baseTimes, cells: base.cells, cellIndex: cellIndexOf(base.cells), rangeHours: hours });
      // 等時線：h3 與 d3-contour 都延遲載入
      const [h3, d3] = await Promise.all([loadH3(), import("d3-contour")]);
      if (cancelled) return;
      const g0 = performance.now();
      const gridCell = isoGridCells(base.cells, cellIndexOf(base.cells), h3.latLngToCell);
      const i0 = performance.now();
      perf.gridCellMs = Math.max(perf.gridCellMs, i0 - g0);
      const contourGen = d3.contours().size([440, 485]);
      const fc = computeIsochrones(mainTimes, base.cells, gridCell, hours, (values, thresholds) => contourGen.thresholds(thresholds)(Array.from(values)));
      perf.isoMs = performance.now() - i0;
      setIso(fc);
    }).catch((error: unknown) => {
      if (cancelled) return;
      layerRef.current!.setTimes(null, null, false);
      setTransitReachPlaybackState(null);
      setIso(null);
      reportSimBundleError(TRANSIT_REACH_SLUG, "od", error);
    });
    return () => { cancelled = true; };
  }, [visible, base, origin, controls.mode, controls.speed, controls.range]);

  // 關圖層：清掉 popup 用的狀態
  useEffect(() => {
    if (visible) return;
    setTransitReachPlaybackState(null);
    setTransitReachNotice(null);
  }, [visible]);

  // source／layer：關閉就拆，換底圖（style.load）重建
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!visible || !base) { removeAll(map); return; }
      if (!map.getLayer(TRANSIT_REACH_CUSTOM_LAYER_ID)) map.addLayer(layerRef.current!);
      if (!map.getSource(SRC.routes)) map.addSource(SRC.routes, { type: "geojson", data: routesGeoJSON(base) });
      if (!map.getSource(SRC.iso)) map.addSource(SRC.iso, { type: "geojson", data: EMPTY });
      if (!map.getSource(SRC.origin)) map.addSource(SRC.origin, { type: "geojson", data: EMPTY });
      if (!map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.routes)) map.addLayer({
        id: TRANSIT_REACH_PLAYBACK_IDS.routes, type: "line", source: SRC.routes,
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "kind"], "air", TRANSIT_REACH_ROUTE_COLORS.air, TRANSIT_REACH_ROUTE_COLORS.ship],
          "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.85,
        },
      });
      if (!map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.isoCasing)) map.addLayer({
        id: TRANSIT_REACH_PLAYBACK_IDS.isoCasing, type: "line", source: SRC.iso, filter: isoFilter(-1, 0) as never,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 3.5, "line-opacity": 0.85 },
      });
      if (!map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.isoLine)) map.addLayer({
        id: TRANSIT_REACH_PLAYBACK_IDS.isoLine, type: "line", source: SRC.iso, filter: isoFilter(-1, 0) as never,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#111827", "line-width": 1.5, "line-opacity": 0.9 },
      });
      if (!map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.isoLabel)) map.addLayer({
        id: TRANSIT_REACH_PLAYBACK_IDS.isoLabel, type: "symbol", source: SRC.iso, filter: isoFilter(-1, 0) as never,
        layout: {
          "symbol-placement": "line", "text-field": ["get", "label"], "text-size": 11,
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "symbol-spacing": 320,
        },
        paint: { "text-color": "#111827", "text-halo-color": "#ffffff", "text-halo-width": 1.25 },
      });
      if (!map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.origin)) map.addLayer({
        id: TRANSIT_REACH_PLAYBACK_IDS.origin, type: "circle", source: SRC.origin,
        paint: { "circle-radius": 6, "circle-color": "#ef4444", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, base, mapTick]);

  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 起點圓點、等時線資料
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible) return;
    (map.getSource(SRC.origin) as GeoJSONSource | undefined)?.setData(origin
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [origin.lng, origin.lat] } }] }
      : EMPTY);
    (map.getSource(SRC.iso) as GeoJSONSource | undefined)?.setData(iso ?? EMPTY);
  }, [mapRef, visible, origin, iso, mountRevision, mapTick]);

  // 等時線開關、透明度（航線、等時線跟著滑桿）；明暗底圖換等時線配色
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.isoLine)) return;
    const vis = controls.isochrones ? "visible" : "none";
    for (const id of [TRANSIT_REACH_PLAYBACK_IDS.isoCasing, TRANSIT_REACH_PLAYBACK_IDS.isoLine, TRANSIT_REACH_PLAYBACK_IDS.isoLabel]) map.setLayoutProperty(id, "visibility", vis);
    const ink = isDark ? "#f9fafb" : "#111827", halo = isDark ? "#0f172a" : "#ffffff";
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoLine, "line-color", ink);
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoCasing, "line-color", halo);
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoLabel, "text-color", ink);
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoLabel, "text-halo-color", halo);
    const o = Math.max(0, Math.min(1, opacity));
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.routes, "line-opacity", 0.85 * o);
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoLine, "line-opacity", 0.9 * o);
    map.setPaintProperty(TRANSIT_REACH_PLAYBACK_IDS.isoCasing, "line-opacity", 0.85 * o);
    map.triggerRepaint();
  }, [mapRef, visible, controls.isochrones, opacity, isDark, mountRevision, mapTick]);

  // 時鐘：拖曳／暫停時重繪一次；播放時 RAF 每幀只 triggerRepaint（uniform 在 render 內讀時鐘）；跨整點才改等時線 filter
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible) return;
    let raf: number | null = null;
    let lastHour = Number.NaN;
    let lastFrame = 0;
    const syncIso = () => {
      const hour = Math.floor(transitReachClock.get() / 3600);
      if (hour === lastHour || !map.getLayer(TRANSIT_REACH_PLAYBACK_IDS.isoLine)) return;
      lastHour = hour;
      const filter = isoFilter(hour, rangeH) as never;
      for (const id of [TRANSIT_REACH_PLAYBACK_IDS.isoCasing, TRANSIT_REACH_PLAYBACK_IDS.isoLine, TRANSIT_REACH_PLAYBACK_IDS.isoLabel]) map.setFilter(id, filter);
    };
    const frame = (now: number) => {
      raf = null;
      if (lastFrame) { const dt = now - lastFrame; perf.frames++; perf.frameMsSum += dt; perf.frameMsMax = Math.max(perf.frameMsMax, dt); }
      lastFrame = now;
      map.triggerRepaint();
      syncIso();
      if (transitReachClock.getSnapshot().playing) raf = requestAnimationFrame(frame);
    };
    const onClock = () => {
      syncIso();
      if (transitReachClock.getSnapshot().playing) {
        if (raf === null) { lastFrame = 0; raf = requestAnimationFrame(frame); }
      } else {
        map.triggerRepaint();
      }
    };
    onClock();
    const off = transitReachClock.subscribe(onClock);
    return () => { off(); if (raf !== null) cancelAnimationFrame(raf); };
  }, [mapRef, visible, rangeH, iso, mountRevision, mapTick]);
}

/** 驗收用：重設效能計數 */
export function resetTransitReachPerf(): void {
  Object.assign(perf, { frames: 0, frameMsSum: 0, frameMsMax: 0, renderMsSum: 0, renders: 0 });
}
