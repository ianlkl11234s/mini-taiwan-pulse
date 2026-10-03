/**
 * useMicroSensorsLayer — LASS 微型感測器
 *
 * 不聚合：~456 點全部直出，樣式照 R2 點樣式（pointRadius M × sizeScale + pointStrokePaint）。
 *
 * 顯示模式（modeIdx：0=PM2.5 / 1=溫度 / 2=濕度）：
 *  三種顏色 loader 已預烤進 properties，切模式只 setPaintProperty 換欄位，
 *  **不重建 GeoJSON、不進 layer 生命週期 deps**（否則會整層重繪閃爍）。
 *
 * 即時行為：
 *  - 圖層開啟時首次載入，之後每 5 分鐘（對齊 collector 頻率）自動 refetch 最新快照
 *  - 不跟 timeline replay（資料量大，Phase 2 會做 hourly pre-aggregate 再支援）
 */

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘，對齊 LASS collector 頻率

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, CircleLayer, GeoJSONSource } from "mapbox-gl";
import {
  fetchMicroSensorsLatest,
  buildMicroSensorsGeoJSON,
} from "../data/microSensorsLoader";
import { microSensorColorExpr } from "../data/microSensorTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import type { MicroSensor } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";
import { POINT_OPACITY, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

const OPACITY_DEFAULT = Number(paramDefault("aqiMicroSensors", "aqiMicroOpacity"));

const SOURCE_ID = "aqi-micro-src";
const LAYER_POINT = "aqi-micro-circle";

function ensureLayers(map: MapboxMap, isDark: boolean, modeIdx: number, opacity: number, sizeScale: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer(LAYER_POINT)) {
    map.addLayer({
      id: LAYER_POINT,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": pointRadius("M", sizeScale),
        "circle-color": microSensorColorExpr(modeIdx) as unknown as mapboxgl.ExpressionSpecification,
        ...pointStrokePaint(isDark, opacity / OPACITY_DEFAULT),
        // P-3：< 1k 點主體 0.85；滑桿（預設 1）為乘數
        "circle-opacity": POINT_OPACITY.base * opacity,
      },
    } as CircleLayer);
  }
}

function removeLayers(map: MapboxMap) {
  if (map.getLayer(LAYER_POINT)) map.removeLayer(LAYER_POINT);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function useMicroSensorsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  modeIdx: number,
  opacity: number,
  /** 點大小比例（pointRadius M × sizeScale）；目前無大小滑桿，預設 1 */
  sizeScale = 1,
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
  const sizeScaleRef = useRef(sizeScale);
  sizeScaleRef.current = sizeScale;
  const themeRef = useRef(isDark);
  themeRef.current = isDark;

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

  // ── Layer 生命週期（visible / 換底圖 style.load 重建） ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const m = mapRef.current;
      if (!m) return;
      // 先移除乾淨再重建
      removeLayers(m);
      if (!visible) return;
      ensureLayers(m, themeRef.current, modeIdxRef.current, opacityRef.current, sizeScaleRef.current);
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
  }, [mapRef, visible, mapTick]);

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

  // ── 透明度／主題／大小：只更新 paint，不重建 source ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.isStyleLoaded()) return;
    if (map.getLayer(LAYER_POINT)) {
      map.setPaintProperty(LAYER_POINT, "circle-opacity", POINT_OPACITY.base * opacity);
      map.setPaintProperty(LAYER_POINT, "circle-radius", pointRadius("M", sizeScale));
      const stroke = pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
      map.setPaintProperty(LAYER_POINT, "circle-stroke-color", stroke["circle-stroke-color"]);
      map.setPaintProperty(LAYER_POINT, "circle-stroke-width", stroke["circle-stroke-width"]);
      map.setPaintProperty(LAYER_POINT, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
    }
  }, [mapRef, visible, isDark, opacity, sizeScale, mapTick]);

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
