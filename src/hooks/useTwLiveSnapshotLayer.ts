import { useEffect, useRef, useState } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, FilterSpecification, GeoJSONSource, LineLayer, Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { wallClock } from "../state/timeStore";
import { FILL_OPACITY, LINE_WIDTH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import {
  DENGUE_COLOR,
  NAV_KINDS,
  NAV_KIND_COLOR,
  NAV_OTHER_COLOR,
  TIDE_LEVEL_COLOR,
  TIDE_UNKNOWN_COLOR,
  TW_LIVE_POLL_MS,
  dengueCenters,
  dengueSnapshotDate,
  fetchTwLiveSnapshot,
  navActiveFeatures,
  setTwLiveSummary,
  type TwLiveKey,
  type TwLiveSnapshot,
} from "../data/twLiveSnapshots";

/**
 * 台灣即時快照三層（台灣圖層延伸 B8）：登革熱聚集區、航船布告、大潮與長浪警戒。
 *
 * 當下快照圖層：開著時定期重抓 R2 latest.geojson（TW_LIVE_POLL_MS），不接時間軸；
 * 換底圖（style.load）用快取資料重建、不重抓。色票與篩選值 SSOT 在 data/twLiveSnapshots.ts。
 */

type MapRef = React.RefObject<MapboxMap | null>;
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const cache: Partial<Record<TwLiveKey, TwLiveSnapshot>> = {};

/** 開著時抓一次並定期重抓；關掉停止輪詢、保留快取 */
function useTwLiveData(key: TwLiveKey, visible: boolean): TwLiveSnapshot | null {
  const [snap, setSnap] = useState<TwLiveSnapshot | null>(cache[key] ?? null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = () => {
      fetchTwLiveSnapshot(key)
        .then((s) => {
          if (cancelled) return;
          cache[key] = s;
          setSnap(s);
        })
        .catch((err: unknown) => { if (!cancelled) console.warn(`[twLive:${key}] load failed:`, err); });
    };
    load();
    const id = window.setInterval(load, TW_LIVE_POLL_MS[key]);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [key, visible]);
  return snap;
}

function setVisibility(map: MapboxMap, ids: readonly string[], visible: boolean) {
  for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

function setSource(map: MapboxMap, id: string, data: GeoJSON.FeatureCollection) {
  if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
  else (map.getSource(id) as GeoJSONSource).setData(data);
}

/** 建層／重設資料的共用骨架：style.load 後用快取重建 */
function useApply(mapRef: MapRef, mapTick: number, visible: boolean, deps: unknown[], apply: (map: MapboxMap) => void, ids: readonly string[]) {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) { setVisibility(map, ids, false); return; }
    const run = () => { try { applyRef.current(map); setVisibility(map, ids, true); } catch (e) { console.warn("[twLive] apply failed:", e); } };
    run();
    const onStyleLoad = () => { setTimeout(run, 0); };
    map.on("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, mapTick, visible, ...deps]);
}

// ── 登革熱聚集區 ──────────────────────────────────────────────────

const DENGUE_SRC = "tw-dengue-cluster-src";
const DENGUE_CENTER_SRC = "tw-dengue-cluster-center-src";
export const DENGUE_LAYERS = {
  fill: "tw-dengue-cluster-fill",
  line: "tw-dengue-cluster-line",
  center: "tw-dengue-cluster-center",
} as const;
const DENGUE_IDS = Object.values(DENGUE_LAYERS);
/** 一級發布區只有數百公尺：z12 以前另畫中心空心圈，全國視角才看得到（V-1） */
const DENGUE_CENTER_MAXZOOM = 12;

function dengueStyle(map: MapboxMap, opacity: number, scale: number, isDark: boolean) {
  const o = clamp01(opacity);
  map.setPaintProperty(DENGUE_LAYERS.fill, "fill-opacity", FILL_OPACITY.background * o);
  map.setPaintProperty(DENGUE_LAYERS.line, "line-opacity", o);
  map.setPaintProperty(DENGUE_LAYERS.center, "circle-radius", pointRadius("L", scale));
  map.setPaintProperty(DENGUE_LAYERS.center, "circle-stroke-opacity", o);
  map.setPaintProperty(DENGUE_LAYERS.center, "circle-opacity", 0.25 * o);
  void isDark;
}

export function useDengueClusterLayer(mapRef: MapRef, visible: boolean, opts: { opacity: number; scale: number; isDark: boolean }) {
  const { opacity, scale, isDark } = opts;
  const mapTick = useMapReadyTick(mapRef, visible);
  const snap = useTwLiveData("dengueClusters", visible);
  const styleRef = useRef(opts);
  styleRef.current = opts;

  useApply(mapRef, mapTick, visible, [snap], (map) => {
    const fc = snap?.fc ?? EMPTY;
    const first = !map.getSource(DENGUE_SRC);
    setSource(map, DENGUE_SRC, fc);
    setSource(map, DENGUE_CENTER_SRC, dengueCenters(fc));
    if (!map.getLayer(DENGUE_LAYERS.fill)) {
      map.addLayer({ id: DENGUE_LAYERS.fill, type: "fill", source: DENGUE_SRC, paint: { "fill-color": DENGUE_COLOR, "fill-opacity": FILL_OPACITY.background } } as FillLayer);
    }
    if (!map.getLayer(DENGUE_LAYERS.line)) {
      map.addLayer({ id: DENGUE_LAYERS.line, type: "line", source: DENGUE_SRC, paint: { "line-color": DENGUE_COLOR, "line-width": LINE_WIDTH.emphasis[1] } } as LineLayer);
    }
    if (!map.getLayer(DENGUE_LAYERS.center)) {
      map.addLayer({
        id: DENGUE_LAYERS.center, type: "circle", source: DENGUE_CENTER_SRC, maxzoom: DENGUE_CENTER_MAXZOOM,
        paint: { "circle-radius": pointRadius("L", 1), "circle-color": DENGUE_COLOR, "circle-opacity": 0.25, "circle-stroke-color": DENGUE_COLOR, "circle-stroke-width": 2 },
      } as CircleLayer);
    }
    const s = styleRef.current;
    dengueStyle(map, s.opacity, s.scale, s.isDark);
    if (snap) setTwLiveSummary("dengueClusters", { shown: fc.features.length, dataTime: dengueSnapshotDate(snap.status) });
    if (first && fc.features.length) keepLoadingUntilMapIdle(map, "twLive:dengue:render", "登革熱聚集區 渲染中", DENGUE_SRC);
  }, DENGUE_IDS);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(DENGUE_LAYERS.fill)) return;
    dengueStyle(map, opacity, scale, isDark);
  }, [mapRef, mapTick, visible, snap, opacity, scale, isDark]);
}

// ── 航船布告 ──────────────────────────────────────────────────────

const NAV_SRC = "tw-nav-notices-src";
export const NAV_LAYERS = {
  fill: "tw-nav-notices-fill",
  outline: "tw-nav-notices-outline",
  line: "tw-nav-notices-line",
  point: "tw-nav-notices-point",
} as const;
const NAV_IDS = Object.values(NAV_LAYERS);

const navColor = [
  "match", ["get", "notice_kind"],
  ...NAV_KINDS.flatMap((k) => [k, NAV_KIND_COLOR[k]]),
  NAV_OTHER_COLOR,
] as unknown as ExpressionSpecification;

function navFilter(kinds: readonly string[], lifetimes: readonly string[], geom: "Polygon" | "LineString" | "Point"): FilterSpecification {
  return [
    "all",
    ["==", ["geometry-type"], geom],
    ["in", ["get", "notice_kind"], ["literal", [...kinds]]],
    ["in", ["get", "lifetime"], ["literal", [...lifetimes]]],
  ] as unknown as FilterSpecification;
}

function navStyle(map: MapboxMap, opacity: number, scale: number, isDark: boolean) {
  const o = clamp01(opacity);
  map.setPaintProperty(NAV_LAYERS.fill, "fill-opacity", FILL_OPACITY.background * o);
  map.setPaintProperty(NAV_LAYERS.outline, "line-opacity", 0.85 * o);
  map.setPaintProperty(NAV_LAYERS.line, "line-opacity", 0.9 * o);
  map.setPaintProperty(NAV_LAYERS.point, "circle-radius", pointRadius("S", scale));
  map.setPaintProperty(NAV_LAYERS.point, "circle-opacity", 0.9 * o);
  for (const [k, v] of Object.entries(pointStrokePaint(isDark, o))) map.setPaintProperty(NAV_LAYERS.point, k as never, v as never);
}

export function useNavNoticesLayer(
  mapRef: MapRef,
  visible: boolean,
  opts: { opacity: number; scale: number; isDark: boolean; kinds: readonly string[]; lifetimes: readonly string[] },
) {
  const { opacity, scale, isDark, kinds, lifetimes } = opts;
  const mapTick = useMapReadyTick(mapRef, visible);
  const snap = useTwLiveData("navNotices", visible);
  const styleRef = useRef(opts);
  styleRef.current = opts;
  const [nowTick, setNowTick] = useState(0);
  // 有效期間依牆鐘每 10 分鐘重算（不接時間軸：這是「現在」的布告）
  useEffect(() => (visible ? wallClock.subscribeWallClock(10 * 60_000, () => setNowTick((n) => n + 1)) : undefined), [visible]);

  useApply(mapRef, mapTick, visible, [snap, nowTick], (map) => {
    const active = snap ? navActiveFeatures(snap.fc, wallClock.getWallNow()) : [];
    const first = !map.getSource(NAV_SRC);
    setSource(map, NAV_SRC, { type: "FeatureCollection", features: active });
    const s = styleRef.current;
    if (!map.getLayer(NAV_LAYERS.fill)) {
      map.addLayer({ id: NAV_LAYERS.fill, type: "fill", source: NAV_SRC, filter: navFilter(s.kinds, s.lifetimes, "Polygon"), paint: { "fill-color": navColor, "fill-opacity": FILL_OPACITY.background } } as FillLayer);
      map.addLayer({ id: NAV_LAYERS.outline, type: "line", source: NAV_SRC, filter: navFilter(s.kinds, s.lifetimes, "Polygon"), paint: { "line-color": navColor, "line-width": LINE_WIDTH.thin[1] } } as LineLayer);
      map.addLayer({ id: NAV_LAYERS.line, type: "line", source: NAV_SRC, filter: navFilter(s.kinds, s.lifetimes, "LineString"), paint: { "line-color": navColor, "line-width": LINE_WIDTH.standard[1], "line-dasharray": [2, 2] } } as LineLayer);
      map.addLayer({ id: NAV_LAYERS.point, type: "circle", source: NAV_SRC, filter: navFilter(s.kinds, s.lifetimes, "Point"), paint: { "circle-color": navColor, "circle-radius": pointRadius("S", 1) } } as CircleLayer);
    }
    navStyle(map, s.opacity, s.scale, s.isDark);
    if (snap) {
      const shown = active.filter((f) => s.kinds.includes(String(f.properties?.notice_kind)) && s.lifetimes.includes(String(f.properties?.lifetime))).length;
      const st = snap.status ?? {};
      setTwLiveSummary("navNotices", {
        shown,
        dataTime: typeof st.snapshot_at === "string" ? st.snapshot_at : null,
        extra: { unlocated: Number(st.unlocated_notices ?? 0) },
      });
    }
    if (first && active.length) keepLoadingUntilMapIdle(map, "twLive:nav:render", "航船布告 渲染中", NAV_SRC);
  }, NAV_IDS);

  const kindsSig = kinds.join("|");
  const lifeSig = lifetimes.join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(NAV_LAYERS.fill)) return;
    map.setFilter(NAV_LAYERS.fill, navFilter(kinds, lifetimes, "Polygon"));
    map.setFilter(NAV_LAYERS.outline, navFilter(kinds, lifetimes, "Polygon"));
    map.setFilter(NAV_LAYERS.line, navFilter(kinds, lifetimes, "LineString"));
    map.setFilter(NAV_LAYERS.point, navFilter(kinds, lifetimes, "Point"));
    navStyle(map, opacity, scale, isDark);
    if (snap) {
      const active = navActiveFeatures(snap.fc, wallClock.getWallNow());
      const shown = active.filter((f) => kinds.includes(String(f.properties?.notice_kind)) && lifetimes.includes(String(f.properties?.lifetime))).length;
      const prev = snap.status ?? {};
      setTwLiveSummary("navNotices", { shown, dataTime: typeof prev.snapshot_at === "string" ? prev.snapshot_at : null, extra: { unlocated: Number(prev.unlocated_notices ?? 0) } });
    }
    // kinds／lifetimes 以字串簽名比對，避免每次 render 新陣列重設
  }, [mapRef, mapTick, visible, snap, opacity, scale, isDark, kindsSig, lifeSig]);
}

// ── 大潮／長浪警戒 ────────────────────────────────────────────────

const TIDE_SRC = "tw-tide-swell-alerts-src";
export const TIDE_LAYERS = { pulse: "tw-tide-swell-alerts-pulse", point: "tw-tide-swell-alerts-point" } as const;
const TIDE_IDS = Object.values(TIDE_LAYERS);
const PULSE_CYCLE_MS = 2000;
const PULSE_PEAK_OPACITY = 0.6;

const tideColor = [
  "match", ["coalesce", ["get", "alert_level"], -1],
  0, TIDE_LEVEL_COLOR[0], 1, TIDE_LEVEL_COLOR[1], 2, TIDE_LEVEL_COLOR[2],
  TIDE_UNKNOWN_COLOR,
] as unknown as ExpressionSpecification;

function tideFilter(kinds: readonly string[]): FilterSpecification {
  return ["in", ["get", "kind"], ["literal", [...kinds]]] as unknown as FilterSpecification;
}
function tidePulseFilter(kinds: readonly string[]): FilterSpecification {
  return ["all", tideFilter(kinds), [">=", ["coalesce", ["get", "alert_level"], 0], 1]] as unknown as FilterSpecification;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tideStyle(map: MapboxMap, opacity: number, scale: number, isDark: boolean) {
  const o = clamp01(opacity);
  map.setPaintProperty(TIDE_LAYERS.point, "circle-radius", pointRadius("M", scale));
  map.setPaintProperty(TIDE_LAYERS.point, "circle-opacity", 0.95 * o);
  for (const [k, v] of Object.entries(pointStrokePaint(isDark, o))) map.setPaintProperty(TIDE_LAYERS.point, k as never, v as never);
}

export function useTideSwellAlertsLayer(
  mapRef: MapRef,
  visible: boolean,
  opts: { opacity: number; scale: number; isDark: boolean; kinds: readonly string[] },
) {
  const { opacity, scale, isDark, kinds } = opts;
  const mapTick = useMapReadyTick(mapRef, visible);
  const snap = useTwLiveData("tideSwellAlerts", visible);
  const styleRef = useRef(opts);
  styleRef.current = opts;

  useApply(mapRef, mapTick, visible, [snap], (map) => {
    const fc = snap?.fc ?? EMPTY;
    const first = !map.getSource(TIDE_SRC);
    setSource(map, TIDE_SRC, fc);
    const s = styleRef.current;
    if (!map.getLayer(TIDE_LAYERS.pulse)) {
      map.addLayer({
        id: TIDE_LAYERS.pulse, type: "circle", source: TIDE_SRC, filter: tidePulseFilter(s.kinds),
        paint: { "circle-radius": pointRadius("M", 1) * 1.5, "circle-color": "transparent", "circle-stroke-color": tideColor, "circle-stroke-width": 2, "circle-stroke-opacity": PULSE_PEAK_OPACITY },
      } as CircleLayer);
    }
    if (!map.getLayer(TIDE_LAYERS.point)) {
      map.addLayer({ id: TIDE_LAYERS.point, type: "circle", source: TIDE_SRC, filter: tideFilter(s.kinds), paint: { "circle-color": tideColor, "circle-radius": pointRadius("M", 1) } } as CircleLayer);
    }
    tideStyle(map, s.opacity, s.scale, s.isDark);
    if (snap) {
      const alerts = fc.features.filter((f) => Number(f.properties?.alert_level ?? 0) >= 1).length;
      const st = snap.status ?? {};
      setTwLiveSummary("tideSwellAlerts", {
        shown: fc.features.length,
        dataTime: typeof st.retrieved_at === "string" ? st.retrieved_at : null,
        extra: { alerts, unlocated: Array.isArray(st.unlocated) ? st.unlocated.length : 0 },
      });
    }
    if (first && fc.features.length) keepLoadingUntilMapIdle(map, "twLive:tide:render", "大潮與長浪警戒 渲染中", TIDE_SRC);
  }, TIDE_IDS);

  const kindsSig = kinds.join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(TIDE_LAYERS.point)) return;
    map.setFilter(TIDE_LAYERS.point, tideFilter(kinds));
    map.setFilter(TIDE_LAYERS.pulse, tidePulseFilter(kinds));
    tideStyle(map, opacity, scale, isDark);
  }, [mapRef, mapTick, visible, snap, opacity, scale, isDark, kindsSig]);

  // 脈動：有警戒（等級 ≥1）的點外環由 ×1.5 擴到 ×3、透明度遞減；prefers-reduced-motion 時靜態外環
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !snap) return;
    const hasAlert = snap.fc.features.some((f) => Number(f.properties?.alert_level ?? 0) >= 1);
    if (!hasAlert || prefersReducedMotion()) {
      if (map.getLayer(TIDE_LAYERS.pulse)) map.setPaintProperty(TIDE_LAYERS.pulse, "circle-stroke-opacity", hasAlert ? PULSE_PEAK_OPACITY * clamp01(opacity) : 0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const m = mapRef.current;
      if (m && m.getLayer(TIDE_LAYERS.pulse)) {
        const ph = ((now - t0) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
        const r = pointRadius("M", scale);
        m.setPaintProperty(TIDE_LAYERS.pulse, "circle-radius", r * (1.5 + 1.5 * ph));
        m.setPaintProperty(TIDE_LAYERS.pulse, "circle-stroke-opacity", PULSE_PEAK_OPACITY * (1 - ph) * clamp01(opacity));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mapRef, mapTick, visible, snap, scale, opacity]);
}
