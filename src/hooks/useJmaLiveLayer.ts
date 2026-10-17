import { useCallback, useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchJmaPointAt, invalidateJmaTimed, type JmaPointKey } from "../data/jmaLiveLoaders";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { useJmaTimeDriver } from "./useJmaTimeDriver";

/**
 * 日本氣象廳／環境省點狀圖層共用 hook，跟 Pulse 時間軸走（見 useJmaTimeDriver）。
 *
 * - visible 時依時間桶查 view／RPC → setData 餵 overlayRegistry 的 dynamicData source
 * - 停在現在時輪詢：AMeDAS 10 分、地震 2 分、火山 10 分、WBGT 10 分、季節類 30 分
 * - 未涵蓋或查詢失敗：清空 source（不留上一個時刻的資料），原因由狀態 store 給圖例顯示
 * - 火山沒有歷史 RPC：時間軸往回拉仍是當下快照（圖例明講）
 */

export const JMA_POINT_SOURCES: Record<JmaPointKey, string> = {
  jmaAmedas: "jma-amedas",
  jmaQuakes: "jma-quakes",
  jmaVolcanoes: "jma-volcanoes",
  jmaWbgt: "jma-wbgt",
  jmaSnowcap: "jma-snowcap",
  jmaAutumnLeaves: "jma-autumn-leaves",
  jmaSakura: "jma-sakura",
};

export const JMA_POINT_POLL_MS: Record<JmaPointKey, number> = {
  jmaAmedas: 10 * 60_000,
  jmaQuakes: 2 * 60_000,
  jmaVolcanoes: 10 * 60_000,
  jmaWbgt: 10 * 60_000,
  jmaSnowcap: 30 * 60_000,
  jmaAutumnLeaves: 30 * 60_000,
  jmaSakura: 30 * 60_000,
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
    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);
    feed();
    return () => { map?.off("style.load", onStyleLoad); };
  }, [visible, feed, mapRef, mapTick]);

  useJmaTimeDriver({
    visible,
    key,
    pollMs: JMA_POINT_POLL_MS[key],
    tick: mapTick,
    fetch: (req) => fetchJmaPointAt(key, req.cacheKey),
    invalidate: (req) => invalidateJmaTimed(key, req.cacheKey),
    apply: (fc) => {
      fcRef.current = fc;
      feed(fc != null);
    },
  });
}
