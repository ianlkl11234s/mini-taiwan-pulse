import { useEffect, useRef, useState } from "react";
import type {
  CircleLayer,
  ExpressionSpecification,
  FillLayer,
  FilterSpecification,
  GeoJSONSource,
  LineLayer,
  Map as MapboxMap,
  SymbolLayer,
} from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { wallClock } from "../state/timeStore";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import {
  buildFire119Display,
  fetchFire119Live,
  isMissingRpc,
  normalizeFire119,
  setFire119Snapshot,
  type Fire119Display,
  type Fire119Raw,
} from "../data/liveIncidentsLoader";
import {
  FIRE119_CATEGORY_COLOR,
  FIRE119_DISTRICT_BREAKS,
  FIRE119_DISTRICT_COLORS,
  FIRE119_HOSPITAL_COLOR,
  FIRE119_RETURNED_COLOR,
  LIVE_INCIDENT_POLL_MS,
} from "../data/liveIncidentsTypes";
import type { FeatureInfo } from "../types";

/**
 * 即時 119 案件（fire119Live，站主限定）。
 *
 * - 當下快照圖層（同 librarySeats／er-hospital）：開著時每分鐘重抓 RPC，不接時間軸（currentTime 不進 deps）；
 *   返隊淡出依掌鐘每 30 秒重算一次（wallClock，不是 timeStore）。
 * - 依位置精度分四種畫法（站主 2026-11-16 決策，analytics realtime_incidents/decision-log.md）：
 *   exact／fuzzy／road → 點（road 是路段中點，滑過／點開時用 road_key 從路段圖磚高亮整條路）；
 *   district → 不畫點，鄉鎮面量＋件數徽章；none（新北）→ 目的醫院「送醫中 N」徽章，不畫事發地、不畫軌跡。
 * - 顏色依類別；狀態：受理／出動／到達脈動（最多 20 個）、送醫中空心、返隊灰化後 60 分鐘淡出。
 * - 撤權（登出）清快取、移除 source（registerOwnerGateReset）。
 */

const PT_SRC = "fire119-live-points";
const BADGE_SRC = "fire119-live-badges";
const TOWN_SRC = "fire119-live-towns";
const ROAD_SRC = "fire119-live-roads";
const TOWN_SOURCE_LAYER = "township_boundary";
const TOWN_URL = "./base_map/township_boundary.pmtiles";
const ROAD_SOURCE_LAYER = "road_lines";
/** 路段線（analytics road_gazetteer，OSM ODbL；屬性 road_key、name、length_m；z10–14） */
export const FIRE119_ROAD_LINES_URL = "./base_map/road_lines_20261116.pmtiles";

export const FIRE119_LAYERS = {
  districtFill: "fire119-live-district-fill",
  districtLine: "fire119-live-district-line",
  road: "fire119-live-road",
  pulse: "fire119-live-pulse",
  point: "fire119-live-point",
  badge: "fire119-live-badge",
  badgeText: "fire119-live-badge-text",
} as const;
const ALL_LAYERS = Object.values(FIRE119_LAYERS);

const FADE_TICK_MS = 30_000;
const PULSE_CYCLE_MS = 2000;
const PULSE_PEAK_OPACITY = 0.35;
const DISTRICT_FILL_OPACITY = 0.45;
const ROAD_OPACITY = 0.55;

let cache: Fire119Raw | null = null;
let generation = 0;
let missingRpcLogged = false;

function clearCache() {
  generation += 1;
  cache = null;
  setFire119Snapshot(null);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const NONE_FILTER = ["==", ["get", "road_key"], "__none__"] as unknown as FilterSpecification;

const categoryColor = [
  "match", ["get", "category"],
  "fire", FIRE119_CATEGORY_COLOR.fire,
  "ems", FIRE119_CATEGORY_COLOR.ems,
  "rescue", FIRE119_CATEGORY_COLOR.rescue,
  FIRE119_CATEGORY_COLOR.other,
] as unknown as ExpressionSpecification;
/** 返隊灰化 */
const pointColor = ["case", ["==", ["get", "_mark"], "faded"], FIRE119_RETURNED_COLOR, categoryColor] as unknown as ExpressionSpecification;

/** 件數 → 面量色（1、2–4、5 以上） */
function districtColorExpr(counts: Map<string, number>): ExpressionSpecification {
  if (counts.size === 0) return FIRE119_DISTRICT_COLORS[0] as unknown as ExpressionSpecification;
  const pairs: (string | number)[] = [];
  for (const [code, n] of counts) pairs.push(code, n);
  return [
    "step", ["match", ["get", "TOWNCODE"], ...pairs, 0],
    FIRE119_DISTRICT_COLORS[0], FIRE119_DISTRICT_BREAKS[0], FIRE119_DISTRICT_COLORS[1], FIRE119_DISTRICT_BREAKS[1], FIRE119_DISTRICT_COLORS[2],
  ] as unknown as ExpressionSpecification;
}

/** 鄉鎮代表點（analytics road_gazetteer towns 表 representative_point；lazy 載入，只有開這層才下載） */
let townPoints: Record<string, [number, number, string]> | null = null;
let townPointsPromise: Promise<Record<string, [number, number, string]>> | null = null;
function loadTownPoints() {
  if (townPoints) return Promise.resolve(townPoints);
  townPointsPromise ??= import("../data/townRepresentativePoints.json").then((m) => {
    townPoints = (m.default ?? m) as unknown as Record<string, [number, number, string]>;
    return townPoints;
  });
  return townPointsPromise;
}

/** 徽章：鄉鎮（件數）＋醫院（送醫中 N） */
function badgeFeatures(d: Fire119Display, towns: Record<string, [number, number, string]> | null): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];
  if (towns) {
    for (const [code, list] of d.districts) {
      const t = towns[code];
      if (!t) continue;
      out.push({ type: "Feature", geometry: { type: "Point", coordinates: [t[0], t[1]] },
        properties: { _kind: "district", _key: code, town_name: t[2], n: list.length, label: String(list.length) } });
    }
  }
  for (const [k, h] of d.hospitals) {
    out.push({ type: "Feature", geometry: { type: "Point", coordinates: h.coord },
      properties: { _kind: "hospital", _key: k, hospital: h.name, n: h.cases.length, label: `送醫中 ${h.cases.length}` } });
  }
  return out;
}

/** 點／徽章／區填色／路段的透明度與主題 paint（建層後與滑桿、換底圖共用）。 */
function applyFire119Opacity(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getLayer(FIRE119_LAYERS.point)) return;
  const o = Math.max(0, Math.min(1, opacity));
    for (const [k, v] of Object.entries(pointPaint(isDark, scale, o))) map.setPaintProperty(FIRE119_LAYERS.point, k as never, v as never);
    for (const [k, v] of Object.entries(badgePaint(isDark, o))) map.setPaintProperty(FIRE119_LAYERS.badge, k as never, v as never);
    map.setPaintProperty(FIRE119_LAYERS.badgeText, "text-opacity", o);
    map.setPaintProperty(FIRE119_LAYERS.districtFill, "fill-opacity", hookFillOpacity("fire119Live", FIRE119_LAYERS.districtFill, DISTRICT_FILL_OPACITY * o, DISTRICT_FILL_OPACITY));
    map.setPaintProperty(FIRE119_LAYERS.districtLine, "line-opacity", hookLineOpacity("fire119Live", FIRE119_LAYERS.districtLine, 0.7 * o, 0.7, isDark));
    map.setPaintProperty(FIRE119_LAYERS.road, "line-opacity", hookLineOpacity("fire119Live", FIRE119_LAYERS.road, ROAD_OPACITY * o, ROAD_OPACITY, isDark));
    map.setPaintProperty(FIRE119_LAYERS.road, "line-color", isDark ? "#fde68a" : "#b45309");
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity = 1): boolean {
  registerPmtilesSourceTypeOnce();
  if (!map.getSource(TOWN_SRC)) {
    map.addSource(TOWN_SRC, { type: PMTILES_SOURCE_TYPE, url: TOWN_URL, minzoom: 6, maxzoom: 14 } as never);
  }
  if (!map.getSource(ROAD_SRC)) {
    map.addSource(ROAD_SRC, { type: PMTILES_SOURCE_TYPE, url: FIRE119_ROAD_LINES_URL, minzoom: 10, maxzoom: 14 } as never);
  }
  if (!map.getSource(PT_SRC)) map.addSource(PT_SRC, { type: "geojson", data: EMPTY });
  if (!map.getSource(BADGE_SRC)) map.addSource(BADGE_SRC, { type: "geojson", data: EMPTY });

  if (!map.getLayer(FIRE119_LAYERS.districtFill)) {
    map.addLayer({
      id: FIRE119_LAYERS.districtFill, type: "fill", source: TOWN_SRC, "source-layer": TOWN_SOURCE_LAYER,
      filter: ["in", ["get", "TOWNCODE"], ["literal", []]] as unknown as FilterSpecification,
      paint: hookFillPaint("fire119Live", FIRE119_LAYERS.districtFill,
        { "fill-color": FIRE119_DISTRICT_COLORS[0], "fill-opacity": DISTRICT_FILL_OPACITY },
        { "fill-color": FIRE119_DISTRICT_COLORS[0], "fill-opacity": DISTRICT_FILL_OPACITY }, isDark),
    } as FillLayer);
  }
  if (!map.getLayer(FIRE119_LAYERS.districtLine)) {
    map.addLayer({
      id: FIRE119_LAYERS.districtLine, type: "line", source: TOWN_SRC, "source-layer": TOWN_SOURCE_LAYER,
      filter: ["in", ["get", "TOWNCODE"], ["literal", []]] as unknown as FilterSpecification,
      layout: hookLineLayout("fire119Live", FIRE119_LAYERS.districtLine),
      paint: hookLinePaint("fire119Live", FIRE119_LAYERS.districtLine,
        { "line-color": FIRE119_DISTRICT_COLORS[2], "line-width": 1, "line-opacity": 0.7 },
        { "line-color": FIRE119_DISTRICT_COLORS[2], "line-width": 1, "line-opacity": 0.7 }, isDark),
    } as LineLayer);
  }
  if (!map.getLayer(FIRE119_LAYERS.road)) {
    map.addLayer({
      id: FIRE119_LAYERS.road, type: "line", source: ROAD_SRC, "source-layer": ROAD_SOURCE_LAYER, minzoom: 10,
      filter: NONE_FILTER,
      layout: hookLineLayout("fire119Live", FIRE119_LAYERS.road),
      paint: hookLinePaint("fire119Live", FIRE119_LAYERS.road,
        { "line-color": isDark ? "#fde68a" : "#b45309", "line-width": 4, "line-opacity": ROAD_OPACITY },
        { "line-color": isDark ? "#fde68a" : "#b45309", "line-width": 4, "line-opacity": ROAD_OPACITY }, isDark),
    } as LineLayer);
  }
  const r = pointRadius("M", scale);
  if (!map.getLayer(FIRE119_LAYERS.pulse)) {
    map.addLayer({
      id: FIRE119_LAYERS.pulse, type: "circle", source: PT_SRC,
      filter: ["==", ["get", "_pulse"], 1] as unknown as FilterSpecification,
      paint: {
        "circle-radius": r * 1.4,
        "circle-color": "transparent",
        "circle-stroke-color": categoryColor,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": PULSE_PEAK_OPACITY,
        "circle-blur": 0.6,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(FIRE119_LAYERS.point)) {
    map.addLayer({
      id: FIRE119_LAYERS.point, type: "circle", source: PT_SRC,
      paint: pointPaint(isDark, scale, Math.max(0, Math.min(1, opacity))),
    } as CircleLayer);
  }
  if (!map.getLayer(FIRE119_LAYERS.badge)) {
    map.addLayer({
      id: FIRE119_LAYERS.badge, type: "circle", source: BADGE_SRC,
      paint: badgePaint(isDark, Math.max(0, Math.min(1, opacity))),
    } as CircleLayer);
  }
  if (!map.getLayer(FIRE119_LAYERS.badgeText)) {
    map.addLayer({
      id: FIRE119_LAYERS.badgeText, type: "symbol", source: BADGE_SRC,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-size": 11,
        "text-offset": ["case", ["==", ["get", "_kind"], "hospital"], ["literal", [0, -1.6]], ["literal", [0, 0]]],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": ["case", ["==", ["get", "_kind"], "hospital"], isDark ? "#bfdbfe" : "#1e3a8a", "#ffffff"],
        "text-halo-color": isDark ? "#0a0a14" : "#ffffff",
        "text-halo-width": ["case", ["==", ["get", "_kind"], "hospital"], 1.2, 0],
      },
    } as SymbolLayer);
  }
  return !!map.getLayer(FIRE119_LAYERS.point);
}

/** 點的 paint：實心（受理／出動／到達／不明）、空心（送醫中）、灰（返隊，淡出係數 _fade） */
function pointPaint(isDark: boolean, scale: number, o: number) {
  const stroke = pointStrokePaint(isDark, o);
  return {
    "circle-radius": pointRadius("M", scale),
    "circle-color": pointColor,
    "circle-opacity": ["case",
      ["==", ["get", "_mark"], "hollow"], 0,
      ["==", ["get", "_mark"], "faded"], ["*", 0.7 * o, ["get", "_fade"]],
      0.9 * o] as unknown as ExpressionSpecification,
    "circle-stroke-color": ["case", ["==", ["get", "_mark"], "hollow"], categoryColor, stroke["circle-stroke-color"]] as unknown as ExpressionSpecification,
    "circle-stroke-width": ["case", ["==", ["get", "_mark"], "hollow"], 2, stroke["circle-stroke-width"]] as unknown as ExpressionSpecification,
    "circle-stroke-opacity": ["case",
      ["==", ["get", "_mark"], "hollow"], 0.95 * o,
      ["==", ["get", "_mark"], "faded"], ["*", stroke["circle-stroke-opacity"], ["get", "_fade"]],
      stroke["circle-stroke-opacity"]] as unknown as ExpressionSpecification,
  };
}

/** 徽章：鄉鎮＝深紅實心圓（中間件數）；醫院＝救護色空心圓（上方「送醫中 N」） */
function badgePaint(isDark: boolean, o: number) {
  const stroke = pointStrokePaint(isDark, o);
  return {
    "circle-radius": ["case", ["==", ["get", "_kind"], "hospital"], pointRadius("L"), pointRadius("L") * 1.4] as unknown as ExpressionSpecification,
    "circle-color": ["case", ["==", ["get", "_kind"], "hospital"], FIRE119_HOSPITAL_COLOR, FIRE119_DISTRICT_COLORS[2]] as unknown as ExpressionSpecification,
    "circle-opacity": ["case", ["==", ["get", "_kind"], "hospital"], 0.25 * o, 0.9 * o] as unknown as ExpressionSpecification,
    "circle-stroke-color": ["case", ["==", ["get", "_kind"], "hospital"], FIRE119_HOSPITAL_COLOR, stroke["circle-stroke-color"]] as unknown as ExpressionSpecification,
    "circle-stroke-width": ["case", ["==", ["get", "_kind"], "hospital"], 2, stroke["circle-stroke-width"]] as unknown as ExpressionSpecification,
    "circle-stroke-opacity": ["case", ["==", ["get", "_kind"], "hospital"], 0.95 * o, stroke["circle-stroke-opacity"]] as unknown as ExpressionSpecification,
  };
}

function setVisible(map: MapboxMap, on: boolean) {
  for (const id of ALL_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

/** 從路段圖磚查 road_key 的路名與長度（取最大 length_m；跨圖磚切開的同一條路屬性相同） */
function queryRoad(map: MapboxMap, roadKey: string): { name: string | null; lengthM: number | null } | null {
  if (!map.getSource(ROAD_SRC)) return null;
  const feats = map.querySourceFeatures(ROAD_SRC, {
    sourceLayer: ROAD_SOURCE_LAYER,
    filter: ["==", ["get", "road_key"], roadKey] as unknown as FilterSpecification,
  });
  if (feats.length === 0) return null;
  let name: string | null = null;
  let len: number | null = null;
  for (const f of feats) {
    const p = f.properties ?? {};
    if (!name && typeof p.name === "string" && p.name) name = p.name;
    const l = Number(p.length_m);
    if (Number.isFinite(l) && (len === null || l > len)) len = l;
  }
  return { name, lengthM: len };
}

export interface Fire119LiveOptions {
  opacity: number;
  scale: number;
  windowMin: number;
  isDark: boolean;
  featureInfo: FeatureInfo | null;
}

export function useFire119LiveLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opts: Fire119LiveOptions) {
  const { opacity, scale, windowMin, isDark, featureInfo } = opts;
  const mapTick = useMapReadyTick(mapRef, visible);
  const [raw, setRaw] = useState<Fire119Raw | null>(cache);
  const [towns, setTowns] = useState(townPoints);
  const displayRef = useRef<Fire119Display | null>(null);
  const roadsRef = useRef(new Map<string, { name: string | null; lengthM: number | null }>());
  const hoverKeyRef = useRef<string | null>(null);
  const selectedRoadKey = featureInfo?.layerType === "fire119Live" && typeof featureInfo.properties?.road_key === "string"
    ? featureInfo.properties.road_key as string : null;
  const selectedRef = useRef(selectedRoadKey);
  selectedRef.current = selectedRoadKey;
  const styleRef = useRef({ isDark, scale, opacity });
  styleRef.current = { isDark, scale, opacity };

  useEffect(() => registerOwnerGateReset(["fire119Live"], () => {
    clearCache();
    setRaw(null);
    const map = mapRef.current;
    if (!map) return;
    for (const id of ALL_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    for (const s of [PT_SRC, BADGE_SRC, TOWN_SRC, ROAD_SRC]) if (map.getSource(s)) map.removeSource(s);
  }), [mapRef, mapTick]);

  // ── 開著時每分鐘重抓 ──
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const gen = generation;
    const load = () => {
      fetchFire119Live()
        .then((d) => {
          if (cancelled || gen !== generation) return;
          cache = normalizeFire119(d);
          setRaw(cache);
        })
        .catch((err: unknown) => {
          if (cancelled || isAccessDenied(err)) return;
          if (isMissingRpc(err)) {
            if (!missingRpcLogged) console.info("[Fire119Live] get_fire119_live 尚未部署，圖層暫無資料");
            missingRpcLogged = true;
            return;
          }
          console.warn("[Fire119Live] load failed:", err);
        });
    };
    load();
    loadTownPoints().then((t) => { if (!cancelled) setTowns(t); }).catch((err) => console.warn("[Fire119Live] town points:", err));
    const id = window.setInterval(load, LIVE_INCIDENT_POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [visible]);

  // ── 建層＋餵資料（掛鐘每 30 秒重算返隊淡出）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) { setVisible(map, false); return; }
    if (!raw) return;
    let lastSig = "";
    let firstRender = true;
    const apply = () => {
      const { isDark: dark, scale: s, opacity: op } = styleRef.current;
      if (!ensureLayers(map, dark, s, op)) return;
      setVisible(map, true);
      const d = buildFire119Display(raw, wallClock.getWallNow(), windowMin);
      displayRef.current = d;
      setFire119Snapshot({ total: d.total, unmapped: d.unmapped, truncated: raw.truncated, districts: d.districts, hospitals: d.hospitals, roads: new Map(roadsRef.current) });
      const sig = `${d.signature}|${towns ? 1 : 0}`;
      if (sig === lastSig) return;
      lastSig = sig;
      (map.getSource(PT_SRC) as GeoJSONSource | undefined)?.setData(d.points);
      (map.getSource(BADGE_SRC) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: badgeFeatures(d, towns) });
      const counts = new Map([...d.districts].map(([k, v]) => [k, v.length] as [string, number]));
      const townFilter = ["in", ["get", "TOWNCODE"], ["literal", [...counts.keys()]]] as unknown as FilterSpecification;
      map.setFilter(FIRE119_LAYERS.districtFill, townFilter);
      map.setFilter(FIRE119_LAYERS.districtLine, townFilter);
      map.setPaintProperty(FIRE119_LAYERS.districtFill, "fill-color", districtColorExpr(counts));
      if (firstRender) {
        firstRender = false;
        keepLoadingUntilMapIdle(map, "fire119:render", "即時 119 案件 渲染中", PT_SRC);
      }
    };
    apply();
    // 換底圖重建後：用目前選定的透明度重套整組 paint（透明度 effect 不跟 style.load）
    const onStyleLoad = () => { lastSig = ""; setTimeout(() => { apply(); applyFire119Opacity(map, styleRef.current.isDark, styleRef.current.scale, styleRef.current.opacity); }, 0); };
    map.on("style.load", onStyleLoad);
    const unsub = wallClock.subscribeWallClock(FADE_TICK_MS, apply);
    return () => { unsub(); map.off("style.load", onStyleLoad); };
  }, [mapRef, mapTick, visible, raw, towns, windowMin]);

  // ── 透明度／大小／主題 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(FIRE119_LAYERS.point)) return;
    applyFire119Opacity(map, isDark, scale, opacity);
  }, [mapRef, mapTick, visible, raw, opacity, scale, isDark]);

  // ── 脈動（受理／出動／到達，最多 20 個；prefers-reduced-motion 時靜態外環）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !raw) return;
    const hasPulse = (displayRef.current?.points.features ?? []).some((f) => f.properties?._pulse === 1);
    if (!hasPulse || prefersReducedMotion()) {
      if (map.getLayer(FIRE119_LAYERS.pulse)) map.setPaintProperty(FIRE119_LAYERS.pulse, "circle-stroke-opacity", hasPulse ? PULSE_PEAK_OPACITY * opacity : 0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const m = mapRef.current;
      if (m && m.getLayer(FIRE119_LAYERS.pulse)) {
        const ph = ((now - t0) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
        const r = pointRadius("M", scale);
        // 半徑主體 ×1 → ×2（LIVE_DECORATION_CAP）、不透明度 ≤ 0.35 隨擴散遞減
        m.setPaintProperty(FIRE119_LAYERS.pulse, "circle-radius", r * (1 + ph));
        m.setPaintProperty(FIRE119_LAYERS.pulse, "circle-stroke-opacity", PULSE_PEAK_OPACITY * (1 - ph) * opacity);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mapRef, mapTick, visible, raw, scale, opacity]);

  // ── 路段高亮：滑過的點優先，否則點開的那件；同時把路名與長度記進快照給 popup ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !raw) return;
    const applyRoad = () => {
      if (!map.getLayer(FIRE119_LAYERS.road)) return;
      const key = hoverKeyRef.current ?? selectedRef.current;
      map.setFilter(FIRE119_LAYERS.road, key ? ["==", ["get", "road_key"], key] as unknown as FilterSpecification : NONE_FILTER);
      const sel = selectedRef.current;
      if (sel && !roadsRef.current.has(sel)) {
        const info = queryRoad(map, sel);
        if (info) {
          roadsRef.current.set(sel, info);
          const d = displayRef.current;
          if (d) setFire119Snapshot({ total: d.total, unmapped: d.unmapped, truncated: raw.truncated, districts: d.districts, hospitals: d.hospitals, roads: new Map(roadsRef.current) });
        }
      }
    };
    const onMove = (e: { features?: { properties?: Record<string, unknown> | null }[] }) => {
      const k = e.features?.[0]?.properties?.road_key;
      const next = typeof k === "string" && k ? k : null;
      if (next === hoverKeyRef.current) return;
      hoverKeyRef.current = next;
      applyRoad();
    };
    const onLeave = () => { hoverKeyRef.current = null; applyRoad(); };
    const onData = (e: { sourceId?: string }) => { if (e.sourceId === ROAD_SRC && selectedRef.current) applyRoad(); };
    applyRoad();
    map.on("mousemove", FIRE119_LAYERS.point, onMove as never);
    map.on("mouseleave", FIRE119_LAYERS.point, onLeave);
    map.on("sourcedata", onData as never);
    return () => {
      map.off("mousemove", FIRE119_LAYERS.point, onMove as never);
      map.off("mouseleave", FIRE119_LAYERS.point, onLeave);
      map.off("sourcedata", onData as never);
    };
  }, [mapRef, mapTick, visible, raw, selectedRoadKey]);
}
