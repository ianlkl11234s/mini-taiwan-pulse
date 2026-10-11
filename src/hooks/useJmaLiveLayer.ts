import { useCallback, useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchJmaPointFC, invalidateJmaPoint, type JmaPointKey } from "../data/jmaLiveLoaders";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 日本氣象廳點狀即時 3 層共用 hook（AMeDAS／地震／火山）— 當下快照，不接 timeStore。
 *
 * - visible 時查 public view → setData 餵 overlayRegistry 的 dynamicData source
 * - 輪詢：AMeDAS 10 分、地震 2 分、火山 10 分
 * - 查詢失敗：清空 source（不留舊資料），錯誤由 loader 狀態 store 給圖例顯示
 */

export const JMA_POINT_SOURCES: Record<JmaPointKey, string> = {
  jmaAmedas: "jma-amedas",
  jmaQuakes: "jma-quakes",
  jmaVolcanoes: "jma-volcanoes",
};

export const JMA_POINT_POLL_MS: Record<JmaPointKey, number> = {
  jmaAmedas: 10 * 60_000,
  jmaQuakes: 2 * 60_000,
  jmaVolcanoes: 10 * 60_000,
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useJmaLiveLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  key: JmaPointKey,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const sourceId = JMA_POINT_SOURCES[key];

  const feed = useCallback((announce = false) => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
    if (announce) keepLoadingUntilMapIdle(map, `jma-live-render:${key}`, "日本氣象圖層渲染中", sourceId);
  }, [mapRef, sourceId, key, mapTick]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = () => {
      fetchJmaPointFC(key)
        .then((fc) => {
          if (cancelled) return;
          fcRef.current = fc;
          feed(true);
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn(`[jmaLive/${key}] load failed:`, err);
          fcRef.current = null;
          feed();
        });
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const id = window.setInterval(() => {
      invalidateJmaPoint(key);
      load();
    }, JMA_POINT_POLL_MS[key]);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      window.clearInterval(id);
    };
  }, [visible, feed, mapRef, mapTick, key]);
}
