/**
 * useMicroSensorsLayer — LASS 微型感測器
 *
 * 模式：
 *  - cluster=true（預設）：低縮放聚合圓 + 高縮放個別點
 *  - cluster=false：永遠全部 ~500 點直出（Mapbox 原生，仍輕量）
 *
 * 切換 cluster 時 Mapbox source 必須重建，故 effect 的 deps 帶 cluster。
 *
 * 顯示模式（modeIdx：0=PM2.5 / 1=溫度 / 2=濕度）：
 *  三種顏色 loader 已預烤進 properties，切模式只 setPaintProperty 換欄位，
 *  **不重建 GeoJSON、不進 layer 生命週期 deps**（否則會整層重繪閃爍）。
 *  聚合圓（cluster 模式的 point_count 圓）維持紫色不受模式影響。
 *
 * 即時行為：
 *  - 圖層開啟時首次載入，之後每 5 分鐘（對齊 collector 頻率）自動 refetch 最新快照
 *  - 不跟 timeline replay（資料量大，Phase 2 會做 hourly pre-aggregate 再支援）
 */

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘，對齊 LASS collector 頻率

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, CircleLayer, SymbolLayer, GeoJSONSource } from "mapbox-gl";
import {
  fetchMicroSensorsLatest,
  buildMicroSensorsGeoJSON,
} from "../data/microSensorsLoader";
import { microSensorColorExpr } from "../data/microSensorTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import type { MicroSensor } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "aqi-micro-src";
const LAYER_CLUSTER = "aqi-micro-cluster";
const LAYER_CLUSTER_COUNT = "aqi-micro-cluster-count";
const LAYER_POINT = "aqi-micro-circle";

function ensureLayers(map: MapboxMap, isDark: boolean, cluster: boolean, modeIdx: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster,
      clusterRadius: 45,
      clusterMaxZoom: 11,
    });
  }

  if (cluster) {
    if (!map.getLayer(LAYER_CLUSTER)) {
      map.addLayer({
        id: LAYER_CLUSTER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": isDark ? "rgba(126, 87, 194, 0.85)" : "rgba(126, 87, 194, 0.75)",
          "circle-radius": [
            "step", ["get", "point_count"],
            10, 10, 14, 50, 18, 200, 24,
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.3)",
          "circle-opacity": opacity,
          "circle-stroke-opacity": opacity,
        },
      } as CircleLayer);
    }
    if (!map.getLayer(LAYER_CLUSTER_COUNT)) {
      map.addLayer({
        id: LAYER_CLUSTER_COUNT,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 11,
          "text-font": ["literal", ["Open Sans Regular", "Arial Unicode MS Regular"]],
        },
        paint: { "text-color": "#ffffff", "text-opacity": opacity },
      } as SymbolLayer);
    }
  }

  if (!map.getLayer(LAYER_POINT)) {
    map.addLayer({
      id: LAYER_POINT,
      type: "circle",
      source: SOURCE_ID,
      // cluster 模式下只顯示非聚合的點；全顯模式不套 filter
      filter: cluster ? ["!", ["has", "point_count"]] : (["has", "deviceId"] as unknown as mapboxgl.FilterSpecification),
      paint: {
        "circle-radius": cluster
          ? ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 4, 15, 6, 18, 10]
          : ["interpolate", ["linear"], ["zoom"], 5, 1.5, 8, 2.5, 11, 4, 15, 7, 18, 11],
        "circle-color": microSensorColorExpr(modeIdx) as unknown as mapboxgl.ExpressionSpecification,
        "circle-stroke-width": cluster ? 0.5 : 0.3,
        "circle-stroke-color": isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.3)",
        "circle-opacity": (cluster ? 0.9 : 0.85) * opacity,
        "circle-stroke-opacity": opacity,
      },
    } as CircleLayer);
  }
}

function removeLayers(map: MapboxMap) {
  for (const id of [LAYER_POINT, LAYER_CLUSTER_COUNT, LAYER_CLUSTER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function useMicroSensorsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  cluster: boolean,
  modeIdx: number,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const loadedRef = useRef(false);
  const dataRef = useRef<MicroSensor[]>([]);
  const loadingRef = useRef(false);
  // modeIdx 走 ref 餵 ensureLayers：不進 layer 生命週期 deps，避免切模式重建整層
  const modeIdxRef = useRef(modeIdx);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // ── Loader：首次開啟時載入 + 每 5 分鐘自動 refetch 最新快照 ──
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let intervalId: number | null = null;

    const refresh = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const list = await fetchMicroSensorsLatest();
        if (cancelled) return;
        dataRef.current = list;
        loadedRef.current = true;
        console.log(`[LASS] refreshed ${list.length} sensors @ ${new Date().toLocaleTimeString()}`);
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) {
          const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          if (src) {
            src.setData(buildMicroSensorsGeoJSON(list));
            keepLoadingUntilMapIdle(map, "aqi-micro-render", "LASS 渲染中", SOURCE_ID);
          }
        }
      } catch (err) {
        console.warn("[LASS] refresh failed", err);
      } finally {
        loadingRef.current = false;
      }
    };

    // 首次立刻跑；之後每 5 分鐘一次
    refresh();
    intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [visible, mapRef, mapTick]);

  // ── Layer 生命週期（visible / cluster 模式變動都會重建 source） ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const m = mapRef.current;
      if (!m) return;
      // 不管是關閉或切 cluster 模式都先移除乾淨再重建（Mapbox cluster 設定不能動態改）
      removeLayers(m);
      if (!visible) return;
      ensureLayers(m, isDark, cluster, modeIdxRef.current, opacityRef.current);
      if (loadedRef.current && dataRef.current.length > 0) {
        const src = m.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (src) {
          src.setData(buildMicroSensorsGeoJSON(dataRef.current));
          keepLoadingUntilMapIdle(m, "aqi-micro-render", "LASS 渲染中", SOURCE_ID);
        }
      }
    };

    // 關閉先直接 remove，不能被 isStyleLoaded() 擋住；tile busy 時它也可能 false。
    if (!visible) {
      apply();
      return;
    }
    if (!map.isStyleLoaded()) {
      const onLoad = () => apply();
      map.once("load", onLoad);
      return () => {
        map.off("load", onLoad);
      };
    }
    apply();
  }, [mapRef, visible, isDark, cluster, mapTick]);

  // ── 顯示模式切換：只換 circle-color 欄位，不動 source / 不重建 layer ──
  useEffect(() => {
    // ref 先更新（layer 尚未建立時 ensureLayers 之後才讀得到正確模式）
    modeIdxRef.current = modeIdx;
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!map.isStyleLoaded() || !map.getLayer(LAYER_POINT)) return;
    map.setPaintProperty(
      LAYER_POINT,
      "circle-color",
      microSensorColorExpr(modeIdx) as unknown as mapboxgl.ExpressionSpecification,
    );
  }, [mapRef, visible, modeIdx, mapTick]);

  // ── 透明度：只更新 paint，不重建 source / cluster ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.isStyleLoaded()) return;
    if (map.getLayer(LAYER_CLUSTER)) {
      map.setPaintProperty(LAYER_CLUSTER, "circle-opacity", opacity);
      map.setPaintProperty(LAYER_CLUSTER, "circle-stroke-opacity", opacity);
    }
    if (map.getLayer(LAYER_CLUSTER_COUNT)) map.setPaintProperty(LAYER_CLUSTER_COUNT, "text-opacity", opacity);
    if (map.getLayer(LAYER_POINT)) {
      map.setPaintProperty(LAYER_POINT, "circle-opacity", (cluster ? 0.9 : 0.85) * opacity);
      map.setPaintProperty(LAYER_POINT, "circle-stroke-opacity", opacity);
    }
  }, [mapRef, visible, cluster, opacity, mapTick]);

  // ── Unmount 清理 ──
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map && map.isStyleLoaded()) {
        try { removeLayers(map); } catch { /* map 已銷毀 */ }
      }
    };
  }, [mapRef, mapTick]);
}
