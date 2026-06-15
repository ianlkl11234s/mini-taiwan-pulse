import { useEffect, useRef, useCallback, useState } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  CircleLayer,
  FillLayer,
  LineLayer,
  ExpressionSpecification,
} from "mapbox-gl";
import * as satellite from "satellite.js";
import { loadSatellites } from "../data/satelliteLoader";
import {
  SAT_LAYER_FOOTPRINT_INNER,
  SAT_LAYER_FOOTPRINT_OUTER,
  SAT_LAYER_POINT,
  SAT_LAYER_TRACK,
  SAT_SRC_FOOTPRINT,
  SAT_SRC_POINT,
  SAT_SRC_TRACK,
  SATELLITE_COLORS,
  type SatelliteCategory,
  type SatelliteRecord,
} from "../data/satelliteTypes";
import { propagate, splitAtDateline } from "../data/satelliteSGP4";
import { timeStore } from "../state/timeStore";

/**
 * 衛星圖層 — 三個 toggle（中國軍事 / 中國遙測 / 台灣），共用 SGP4 計算
 *
 * - 每 1s 訂閱 timeStore 重算所有衛星目前位置 → 更新三個 source GeoJSON
 *   (footprint 雙圈 polygon / future 軌跡 line / 即時點 circle)
 * - category 用 Mapbox match 表達式上色，不額外切多個 layer
 * - 每個 category visibility 用 layer-level filter（match category）
 * - orbit 預設 30 min，全球模式 90 min（透過 satelliteMode store 切換）
 */

const FOOTPRINT_INNER_KM = 50;
const FOOTPRINT_OUTER_KM = 1500;
const TRACK_STEP_SEC = 30;
const DEFAULT_TRACK_MIN = 30;
/** 輕量更新（即時點 + 足跡圓）— 10 Hz 讓衛星看起來順暢流動 */
const LIGHT_REFRESH_MS = 100;
/** 重量更新（未來 30 分軌跡 polyline）— 1 Hz 即可，軌跡形狀短期內變化極小 */
const HEAVY_REFRESH_MS = 1000;

const COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "cat"],
  "china_yaogan", SATELLITE_COLORS.china_yaogan,
  "china_jilin", SATELLITE_COLORS.china_jilin,
  "china_gaofen", SATELLITE_COLORS.china_gaofen,
  "china_tjs", SATELLITE_COLORS.china_tjs,
  "china_beidou", SATELLITE_COLORS.china_beidou,
  "china_shiyan", SATELLITE_COLORS.china_shiyan,
  "taiwan", SATELLITE_COLORS.taiwan,
  "#888",
];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 建一個近似圓的 polygon ring（球面投影，地球半徑為粗略均值） */
function circleRing(centerLng: number, centerLat: number, radiusKm: number, steps = 48): [number, number][] {
  const R = 6371;
  const latRad = (centerLat * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / R) * Math.cos(bearing) * (180 / Math.PI);
    const dLng = (radiusKm / R) * Math.sin(bearing) * (180 / Math.PI) / Math.max(Math.cos(latRad), 0.01);
    ring.push([centerLng + dLng, centerLat + dLat]);
  }
  return ring;
}

interface SatelliteVisibilityFlags {
  china_yaogan: boolean;
  china_jilin: boolean;
  china_gaofen: boolean;
  china_tjs: boolean;
  china_beidou: boolean;
  china_shiyan: boolean;
  taiwan: boolean;
}

interface UseSatellitesLayerOpts {
  visibility: SatelliteVisibilityFlags;
  opacity?: number;
  /** 軌跡顯示時長（分鐘）。全球模式時拉長到 90 */
  trackMinutes?: number;
  /**
   * Console 模式 — 只渲染指定 NORAD（變軌中）+ 台灣全部
   * undefined / null = 一般模式（依 visibility flags）
   */
  consoleFilter?: {
    /** 近 24h 變軌的 NORAD set */
    featuredNorads: Set<number>;
    /** 若 true，console 模式失效，全部按 visibility flags 渲染 */
    showAllOrbits: boolean;
  } | null;
}

interface PropParsed {
  rec: SatelliteRecord;
  satrec: satellite.SatRec;
}

export function useSatellitesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  opts: UseSatellitesLayerOpts,
) {
  const { visibility, opacity = 1, trackMinutes = DEFAULT_TRACK_MIN, consoleFilter = null } = opts;
  const consoleFilterRef = useRef(consoleFilter);
  consoleFilterRef.current = consoleFilter;
  const recordsRef = useRef<PropParsed[]>([]);
  const layersReadyRef = useRef(false);
  const anyVisible = visibility.china_yaogan || visibility.china_jilin
    || visibility.china_gaofen || visibility.china_tjs || visibility.china_beidou
    || visibility.china_shiyan || visibility.taiwan;
  const [dataReady, setDataReady] = useState(false);

  // visibility / trackMinutes 走 ref：recompute / 訂閱 callback 永遠讀最新值，
  // 避免 effect 因 callback identity 改變而頻繁重綁，更避免 throttle trailing
  // fire 抓到舊 closure 的「殭屍 setData」。
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;
  const trackMinutesRef = useRef(trackMinutes);
  trackMinutesRef.current = trackMinutes;

  // ── 載入 TLE（一次性，6h cache） ──
  useEffect(() => {
    let cancelled = false;
    loadSatellites().then((records) => {
      if (cancelled) return;
      const parsed: PropParsed[] = [];
      for (const r of records) {
        try {
          parsed.push({ rec: r, satrec: satellite.twoline2satrec(r.tleLine1, r.tleLine2) });
        } catch {
          // 個別 TLE 解析失敗就跳過
        }
      }
      recordsRef.current = parsed;
      setDataReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ── 建立 sources + layers ──
  const ensureLayers = useCallback((map: MapboxMap): boolean => {
    if (!map.isStyleLoaded()) return false;
    if (!map.getSource(SAT_SRC_FOOTPRINT)) {
      map.addSource(SAT_SRC_FOOTPRINT, { type: "geojson", data: EMPTY_FC });
    }
    if (!map.getSource(SAT_SRC_TRACK)) {
      map.addSource(SAT_SRC_TRACK, { type: "geojson", data: EMPTY_FC });
    }
    if (!map.getSource(SAT_SRC_POINT)) {
      map.addSource(SAT_SRC_POINT, { type: "geojson", data: EMPTY_FC });
    }

    if (!map.getLayer(SAT_LAYER_FOOTPRINT_OUTER)) {
      map.addLayer({
        id: SAT_LAYER_FOOTPRINT_OUTER,
        type: "line",
        source: SAT_SRC_FOOTPRINT,
        filter: ["==", ["get", "ring"], "outer"],
        paint: {
          "line-color": COLOR_EXPR,
          "line-width": 1,
          "line-opacity": 0.35,
          "line-dasharray": [3, 3],
        },
      } as LineLayer);
    }
    if (!map.getLayer(SAT_LAYER_FOOTPRINT_INNER)) {
      map.addLayer({
        id: SAT_LAYER_FOOTPRINT_INNER,
        type: "fill",
        source: SAT_SRC_FOOTPRINT,
        filter: ["==", ["get", "ring"], "inner"],
        paint: {
          "fill-color": COLOR_EXPR,
          "fill-opacity": 0.35,
          "fill-outline-color": COLOR_EXPR,
        },
      } as FillLayer);
    }
    if (!map.getLayer(SAT_LAYER_TRACK)) {
      map.addLayer({
        id: SAT_LAYER_TRACK,
        type: "line",
        source: SAT_SRC_TRACK,
        paint: {
          "line-color": COLOR_EXPR,
          "line-width": 1.4,
          "line-opacity": 0.5,
        },
      } as LineLayer);
    }
    if (!map.getLayer(SAT_LAYER_POINT)) {
      map.addLayer({
        id: SAT_LAYER_POINT,
        type: "circle",
        source: SAT_SRC_POINT,
        paint: {
          "circle-color": COLOR_EXPR,
          "circle-radius": [
            "case",
            ["==", ["get", "maneuver"], 1], 6,
            4,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "maneuver"], 1], "#ef4444",
            "#fff",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "maneuver"], 1], 2,
            1,
          ],
          "circle-stroke-opacity": 0.85,
        },
      } as CircleLayer);
    }
    // 變軌 pulse ring（red glow）
    const SAT_LAYER_MANEUVER_RING = "sat-maneuver-ring";
    if (!map.getLayer(SAT_LAYER_MANEUVER_RING)) {
      map.addLayer({
        id: SAT_LAYER_MANEUVER_RING,
        type: "circle",
        source: SAT_SRC_POINT,
        filter: ["==", ["get", "maneuver"], 1],
        paint: {
          "circle-color": "transparent",
          "circle-radius": 14,
          "circle-stroke-color": "#ef4444",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.65,
        },
      } as CircleLayer);
    }
    layersReadyRef.current = true;
    return true;
  }, []);

  // 計算「目前可見的 cat 清單」
  const computeVisibleCats = (): SatelliteCategory[] => {
    const vis = visibilityRef.current;
    const out: SatelliteCategory[] = [];
    if (vis.china_yaogan) out.push("china_yaogan");
    if (vis.china_jilin) out.push("china_jilin");
    if (vis.china_gaofen) out.push("china_gaofen");
    if (vis.china_tjs) out.push("china_tjs");
    if (vis.china_beidou) out.push("china_beidou");
    if (vis.china_shiyan) out.push("china_shiyan");
    if (vis.taiwan) out.push("taiwan");
    return out;
  };

  // 輕量更新：point + footprint（依當前 sub-satellite 位置）
  // 5 Hz 跑，CPU 成本 = N 顆 × 1 SGP4，~350 sat × 5 = 1750 SGP4/sec
  const recomputeLight = useCallback((map: MapboxMap, atUnixSec: number) => {
    const t = new Date(atUnixSec * 1000);
    const parsed = recordsRef.current;
    if (!parsed.length) return;
    const visibleCats = computeVisibleCats();
    if (!visibleCats.length) {
      (map.getSource(SAT_SRC_FOOTPRINT) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      (map.getSource(SAT_SRC_POINT) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      return;
    }

    const footprintFeats: GeoJSON.Feature[] = [];
    const pointFeats: GeoJSON.Feature[] = [];
    const cf = consoleFilterRef.current;
    // Console 模式只用 featuredNorads 強調變軌中衛星（紅環 + 加大）
    // 不額外砍類別 — sidebar toggle 是唯一的「顯/隱」真實來源（修 CN toggle 失效）
    const featuredNorads = cf?.featuredNorads;

    for (const { rec, satrec } of parsed) {
      if (!visibleCats.includes(rec.category)) continue;
      const now = propagate(satrec, t);
      if (!now) continue;
      const isManeuver = featuredNorads?.has(rec.noradId) ?? false;
      const props = {
        cat: rec.category,
        norad: rec.noradId,
        name: rec.name,
        altKm: Math.round(now.altKm),
        maneuver: isManeuver ? 1 : 0,
      };
      pointFeats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [now.lng, now.lat] },
        properties: props,
      });
      footprintFeats.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [circleRing(now.lng, now.lat, FOOTPRINT_INNER_KM)] },
        properties: { ...props, ring: "inner" },
      });
      footprintFeats.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [circleRing(now.lng, now.lat, FOOTPRINT_OUTER_KM)] },
        properties: { ...props, ring: "outer" },
      });
    }

    (map.getSource(SAT_SRC_FOOTPRINT) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: footprintFeats,
    });
    (map.getSource(SAT_SRC_POINT) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: pointFeats,
    });
  }, []);

  // 重量更新：未來 30 分軌跡 polyline
  // 1 Hz 跑，CPU 成本 = N × 60 step SGP4 = 350 × 60 = 21k SGP4/sec
  // 軌跡形狀 1s 內變化極微，不需高頻
  const recomputeTrack = useCallback((map: MapboxMap, atUnixSec: number) => {
    const t = new Date(atUnixSec * 1000);
    const parsed = recordsRef.current;
    if (!parsed.length) return;
    const visibleCats = computeVisibleCats();
    const trackMin = trackMinutesRef.current;
    if (!visibleCats.length) {
      (map.getSource(SAT_SRC_TRACK) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      return;
    }

    const trackFeats: GeoJSON.Feature[] = [];
    const stepCount = Math.floor((trackMin * 60) / TRACK_STEP_SEC);
    // 軌跡層不過濾 console（同上原因）
    for (const { rec, satrec } of parsed) {
      if (!visibleCats.includes(rec.category)) continue;
      const props = {
        cat: rec.category,
        norad: rec.noradId,
        name: rec.name,
      };
      const path: { lat: number; lng: number; altKm: number }[] = [];
      for (let i = 0; i <= stepCount; i++) {
        const tt = new Date(t.getTime() + i * TRACK_STEP_SEC * 1000);
        const p = propagate(satrec, tt);
        if (p) path.push(p);
      }
      const segs = splitAtDateline(path);
      for (const seg of segs) {
        if (seg.length < 2) continue;
        trackFeats.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: seg.map((p) => [p.lng, p.lat]) },
          properties: props,
        });
      }
    }

    (map.getSource(SAT_SRC_TRACK) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: trackFeats,
    });
  }, []);

  // 兩者合一給 force-refresh（toggle 變動時用）
  const recompute = useCallback((map: MapboxMap, atUnixSec: number) => {
    recomputeLight(map, atUnixSec);
    recomputeTrack(map, atUnixSec);
  }, [recomputeLight, recomputeTrack]);

  // ── 訂閱 timeStore 每秒重算 ──
  // deps 只放 [dataReady, anyVisible]，不放 recompute（已 stable）。
  // 所有 map listener 都進 cleanup，無洩漏。
  useEffect(() => {
    if (!dataReady) return;
    if (!anyVisible) return;
    const map = mapRef.current;
    if (!map) return;

    const setup = () => {
      if (!ensureLayers(map)) return false;
      recompute(map, timeStore.getTime());
      return true;
    };

    // style 尚未 ready 時的保險：監聽 style.load + idle，setup 成功就 off
    const onSetupStyleLoad = () => { setup(); };
    const onSetupIdle = () => { if (setup()) map.off("idle", onSetupIdle); };
    if (!setup()) {
      map.on("style.load", onSetupStyleLoad);
      map.on("idle", onSetupIdle);
    }

    // 兩條訂閱：點 + 足跡 5 Hz；軌跡 1 Hz（軌跡形狀變化慢，省 CPU）
    const unsubLight = timeStore.subscribeThrottled(LIGHT_REFRESH_MS, (ts) => {
      const m = mapRef.current;
      if (!m) return;
      if (!layersReadyRef.current && !ensureLayers(m)) return;
      recomputeLight(m, ts);
    });
    const unsubHeavy = timeStore.subscribeThrottled(HEAVY_REFRESH_MS, (ts) => {
      const m = mapRef.current;
      if (!m) return;
      if (!layersReadyRef.current && !ensureLayers(m)) return;
      recomputeTrack(m, ts);
    });

    // style 切換後 source/layer 會被清掉，重建
    const onMainStyleLoad = () => {
      layersReadyRef.current = false;
      if (ensureLayers(map)) recompute(map, timeStore.getTime());
    };
    map.on("style.load", onMainStyleLoad);

    return () => {
      unsubLight();
      unsubHeavy();
      map.off("style.load", onMainStyleLoad);
      // setup 用的 listener 也一律清掉（避免累積洩漏）
      map.off("style.load", onSetupStyleLoad);
      map.off("idle", onSetupIdle);
    };
  }, [dataReady, anyVisible, ensureLayers, recompute, recomputeLight, recomputeTrack, mapRef]);

  // ── toggle 變動即刻 force recompute ──
  // visibility 物件 identity 每 render 都新；用 JSON 字串穩定化 deps，
  // 真正改變才觸發。確保使用者按 toggle 後即時看到正確 features，
  // 不用等下一個 1s throttle tick。
  const visKey = `${visibility.china_yaogan ? 1 : 0}${visibility.china_jilin ? 1 : 0}${visibility.china_gaofen ? 1 : 0}${visibility.china_tjs ? 1 : 0}${visibility.china_beidou ? 1 : 0}${visibility.china_shiyan ? 1 : 0}${visibility.taiwan ? 1 : 0}`;
  useEffect(() => {
    if (!dataReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current && !ensureLayers(map)) return;
    recompute(map, timeStore.getTime());
  }, [visKey, dataReady, ensureLayers, recompute, mapRef]);

  // ── visibility toggle（用 layer visibility，避免 source 反覆重設） ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const v = anyVisible ? "visible" : "none";
    for (const id of [
      SAT_LAYER_FOOTPRINT_INNER,
      SAT_LAYER_FOOTPRINT_OUTER,
      SAT_LAYER_TRACK,
      SAT_LAYER_POINT,
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [anyVisible, mapRef, dataReady]);

  // ── opacity ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(SAT_LAYER_FOOTPRINT_INNER)) {
      map.setPaintProperty(SAT_LAYER_FOOTPRINT_INNER, "fill-opacity", 0.35 * o);
    }
    if (map.getLayer(SAT_LAYER_FOOTPRINT_OUTER)) {
      map.setPaintProperty(SAT_LAYER_FOOTPRINT_OUTER, "line-opacity", 0.35 * o);
    }
    if (map.getLayer(SAT_LAYER_TRACK)) {
      map.setPaintProperty(SAT_LAYER_TRACK, "line-opacity", 0.5 * o);
    }
    if (map.getLayer(SAT_LAYER_POINT)) {
      map.setPaintProperty(SAT_LAYER_POINT, "circle-opacity", 1 * o);
    }
  }, [opacity, mapRef, dataReady]);
}
