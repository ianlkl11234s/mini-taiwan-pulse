/**
 * useAqiStationsLayer — 環境部 77 站觀測，Mapbox native circle 圖層
 *
 * 行為：
 *  - visible 開啟時依 timeStore 當前時刻抓對應觀測（replay）
 *  - subscribeThrottled(5000) 到時間變動 → refetch（粒度小時，5s 足夠）
 *  - 無資料（太舊的日期 / 當前未來）時顯示空 FeatureCollection
 *  - circle-color 用 AQI step expression；點擊走 useMapInteraction 的 queryRenderedFeatures
 *
 * **禁止**將 currentTime 放進 useEffect deps（CLAUDE.md #6）。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, CircleLayer, GeoJSONSource } from "mapbox-gl";
import { fetchAqiStationsAt, buildStationsGeoJSON } from "../data/aqiStationsLoader";
import { buildAqiStepExpression } from "../map/aqiColorScale";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import type { AqiStation } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "aqi-stations-src";
const LAYER_GLOW = "aqi-stations-glow";
const LAYER_CIRCLE = "aqi-stations-circle";

function ensureLayers(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          6, 8, 10, 14, 14, 22, 17, 32,
        ],
        "circle-color": buildAqiStepExpression("aqi"),
        "circle-blur": 1,
        "circle-opacity": isDark ? 0.35 : 0.3,
      },
    } as CircleLayer);
  }

  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          6, 3, 10, 5, 14, 8, 17, 12,
        ],
        "circle-color": buildAqiStepExpression("aqi"),
        "circle-stroke-width": 1,
        "circle-stroke-color": isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)",
        "circle-opacity": 0.95,
      },
    } as CircleLayer);
  }
}

function removeLayers(map: MapboxMap) {
  for (const id of [LAYER_CIRCLE, LAYER_GLOW]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function useAqiStationsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const stationsRef = useRef<AqiStation[]>([]);
  const fetchingKeyRef = useRef<string>("");
  const lastKeyRef = useRef<string>("");

  // ── 根據當前時刻（或最新）抓測站資料 + 寫到 Mapbox source ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!visible) {
      // 關閉不能被 isStyleLoaded() 擋掉：tile busy 時它也可能是 false，
      // 但既有 layer 仍必須立即移除；真正遇到 style transition 才等 idle 重試。
      let disposed = false;
      let retryPending = false;
      const remove = () => {
        if (disposed) return;
        retryPending = false;
        try { removeLayers(map); }
        catch {
          retryPending = true;
          map.once("idle", remove);
        }
      };
      remove();
      stationsRef.current = [];
      lastKeyRef.current = "";
      return () => {
        disposed = true;
        if (retryPending) map.off("idle", remove);
      };
    }

    let cancelled = false;

    const refresh = (currentTimeSec: number) => {
      const m = mapRef.current;
      if (!m) return;
      if (!m.isStyleLoaded()) return;
      ensureLayers(m, isDark);

      // 粒度對齊到小時（避免每分鐘 refetch）
      const hourMs = Math.floor((currentTimeSec * 1000) / 3600000) * 3600000;
      const key = String(hourMs);
      if (key === lastKeyRef.current) return;
      if (key === fetchingKeyRef.current) return;

      fetchingKeyRef.current = key;
      const targetDate = new Date(hourMs + 3600000); // 查該小時結束時刻
      fetchAqiStationsAt(targetDate)
        .then((list) => {
          if (cancelled || fetchingKeyRef.current !== key) return;
          stationsRef.current = list;
          lastKeyRef.current = key;
          const m2 = mapRef.current;
          const src = m2?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          if (src && m2) {
            src.setData(buildStationsGeoJSON(list));
            keepLoadingUntilMapIdle(m2, "aqi-stations-render", "空品測站 渲染中", SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[AQI Stations] fetch failed:`, err);
        })
        .finally(() => {
          if (fetchingKeyRef.current === key) fetchingKeyRef.current = "";
        });
    };

    const startSubscription = () => {
      refresh(timeStore.getTime());
      return timeStore.subscribeThrottled(5000, refresh);
    };

    let unsub: (() => void) | null = null;
    if (!map.isStyleLoaded()) {
      const onLoad = () => {
        unsub = startSubscription();
      };
      map.once("load", onLoad);
      return () => {
        cancelled = true;
        map.off("load", onLoad);
        if (unsub) unsub();
      };
    }

    unsub = startSubscription();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [mapRef, visible, isDark, mapTick]);

  // ── 主題變更時刷新 paint ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!map.isStyleLoaded()) return;
    if (map.getLayer(LAYER_GLOW)) {
      map.setPaintProperty(LAYER_GLOW, "circle-opacity", isDark ? 0.35 : 0.3);
    }
    if (map.getLayer(LAYER_CIRCLE)) {
      map.setPaintProperty(
        LAYER_CIRCLE,
        "circle-stroke-color",
        isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)",
      );
    }
  }, [mapRef, isDark, visible, mapTick]);
}
