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
const REFRESH_THROTTLE_MS = 1000;

const COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "cat"],
  "china_military", SATELLITE_COLORS.china_military,
  "china_earth_obs", SATELLITE_COLORS.china_earth_obs,
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
  china_military: boolean;
  china_earth_obs: boolean;
  taiwan: boolean;
}

interface UseSatellitesLayerOpts {
  visibility: SatelliteVisibilityFlags;
  opacity?: number;
  /** 軌跡顯示時長（分鐘）。全球模式時拉長到 90 */
  trackMinutes?: number;
}

interface PropParsed {
  rec: SatelliteRecord;
  satrec: satellite.SatRec;
}

export function useSatellitesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  opts: UseSatellitesLayerOpts,
) {
  const { visibility, opacity = 1, trackMinutes = DEFAULT_TRACK_MIN } = opts;
  const recordsRef = useRef<PropParsed[]>([]);
  const layersReadyRef = useRef(false);
  const anyVisible = visibility.china_military || visibility.china_earth_obs || visibility.taiwan;
  const [dataReady, setDataReady] = useState(false);

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
          "circle-radius": 4,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.6,
        },
      } as CircleLayer);
    }
    layersReadyRef.current = true;
    return true;
  }, []);

  // 重算所有 GeoJSON（footprint / track / point）並 setData
  const recompute = useCallback((map: MapboxMap, atUnixSec: number) => {
    const t = new Date(atUnixSec * 1000);
    const parsed = recordsRef.current;
    if (!parsed.length) return;

    const visibleCats: SatelliteCategory[] = [];
    if (visibility.china_military) visibleCats.push("china_military");
    if (visibility.china_earth_obs) visibleCats.push("china_earth_obs");
    if (visibility.taiwan) visibleCats.push("taiwan");
    if (!visibleCats.length) {
      // 清空
      (map.getSource(SAT_SRC_FOOTPRINT) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      (map.getSource(SAT_SRC_TRACK) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      (map.getSource(SAT_SRC_POINT) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
      return;
    }

    const footprintFeats: GeoJSON.Feature[] = [];
    const trackFeats: GeoJSON.Feature[] = [];
    const pointFeats: GeoJSON.Feature[] = [];

    for (const { rec, satrec } of parsed) {
      if (!visibleCats.includes(rec.category)) continue;
      const now = propagate(satrec, t);
      if (!now) continue;

      const props = {
        cat: rec.category,
        norad: rec.noradId,
        name: rec.name,
        altKm: Math.round(now.altKm),
      };

      // point
      pointFeats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [now.lng, now.lat] },
        properties: props,
      });

      // footprint — 內外圈
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

      // 軌跡：從現在開始往未來推
      const stepCount = Math.floor((trackMinutes * 60) / TRACK_STEP_SEC);
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
          geometry: {
            type: "LineString",
            coordinates: seg.map((p) => [p.lng, p.lat]),
          },
          properties: props,
        });
      }
    }

    (map.getSource(SAT_SRC_FOOTPRINT) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: footprintFeats,
    });
    (map.getSource(SAT_SRC_TRACK) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: trackFeats,
    });
    (map.getSource(SAT_SRC_POINT) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: pointFeats,
    });
  }, [visibility, trackMinutes]);

  // ── 訂閱 timeStore 每秒重算 ──
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

    if (!setup()) {
      const onStyleLoad = () => { setup(); };
      map.on("style.load", onStyleLoad);
      // 也監聽 idle 一次保險
      const onIdle = () => { if (setup()) map.off("idle", onIdle); };
      map.on("idle", onIdle);
    }

    const unsub = timeStore.subscribeThrottled(REFRESH_THROTTLE_MS, (ts) => {
      const m = mapRef.current;
      if (!m) return;
      if (!layersReadyRef.current && !ensureLayers(m)) return;
      recompute(m, ts);
    });

    // style 切換後 source/layer 會被清掉
    const onStyleLoad = () => {
      layersReadyRef.current = false;
      if (ensureLayers(map)) recompute(map, timeStore.getTime());
    };
    map.on("style.load", onStyleLoad);

    return () => {
      unsub();
      map.off("style.load", onStyleLoad);
    };
  }, [dataReady, anyVisible, ensureLayers, recompute, mapRef]);

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
