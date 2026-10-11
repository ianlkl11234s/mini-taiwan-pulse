import { useCallback, useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchEnvLiveFC, invalidateEnvLive, type EnvLiveKey } from "../data/environmentLiveLoaders";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 環境即時 4 層共用 hook — 當下快照（比照 erHospital／核安 LIVE，不接 timeStore）。
 *
 * - visible 時呼叫 public RPC → setData 餵 overlayRegistry 的 dynamicData source
 * - 依資料更新頻率輪詢（輻射 15 分、放流水／CEMS 1 小時、UV 6 小時）；pollMs=null 不輪詢
 * - RPC 失敗：清空 source（不留舊資料、不畫假資料），錯誤狀態由 loader 的狀態 store 給圖例顯示
 */

export const ENV_LIVE_SOURCES: Record<EnvLiveKey, string> = {
  nuscGammaRadiation: "nusc-gamma-radiation",
  waterEffluentLive: "water-effluent-live",
  cemsStackLive: "cems-stack-live",
  cwaUvDaily: "cwa-uv-daily",
};

export const ENV_LIVE_POLL_MS: Record<EnvLiveKey, number | null> = {
  nuscGammaRadiation: 15 * 60_000,
  waterEffluentLive: 60 * 60_000,
  cemsStackLive: 60 * 60_000,
  cwaUvDaily: 6 * 60 * 60_000,
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useEnvironmentLiveLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  key: EnvLiveKey,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const sourceId = ENV_LIVE_SOURCES[key];

  const feed = useCallback((announce = false) => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
    if (announce) keepLoadingUntilMapIdle(map, `env-live-render:${key}`, "環境即時圖層渲染中", sourceId);
  }, [mapRef, sourceId, key, mapTick]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    // 每次 load 一個世代號：輪詢重疊時，較舊的請求即使較晚回來也不可覆寫較新的結果
    let generation = 0;
    const load = () => {
      const mine = ++generation;
      fetchEnvLiveFC(key)
        .then((fc) => {
          if (cancelled || mine !== generation) return;
          fcRef.current = fc;
          feed(true);
        })
        .catch((err) => {
          if (cancelled || mine !== generation) return;
          console.warn(`[envLive/${key}] load failed:`, err);
          fcRef.current = null;
          feed();
        });
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const pollMs = ENV_LIVE_POLL_MS[key];
    const id = pollMs == null ? null : window.setInterval(() => {
      invalidateEnvLive(key);
      load();
    }, pollMs);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      if (id != null) window.clearInterval(id);
    };
  }, [visible, feed, mapRef, mapTick, key]);
}
