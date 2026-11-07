import { useEffect, useRef } from "react";
import type { AnyLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { CA_QUAKE_LIVE_TYPE_COLORS, CA_QUAKE_LIVE_SOURCE, CA_QUAKE_LIVE_TYPES } from "../data/caEnvTypes";
import { fetchCaQuakesLive } from "../data/caLiveQuakesLoader";
import { caCatFilter } from "./useCaTransportLayers";
import { caQuakeRadius } from "./useCaEnvLayers";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 加拿大即時地震（NRCan FDSN，近 30 天）：瀏覽器直連上游（同 JMA 上游直連層，DISPLAY_ONLY）。
 * 快照錨在掛鐘現在、不跟時間軸（不訂閱 timeStore，currentTime 不進 deps）；可見時每 5 分鐘重抓。
 * 約 300 筆／30 天 → 各縮放直接畫點（V-1 加拿大全覽 z3.5 有點），不做熱區。V-4：事件類型多選。
 */
export const CA_QUAKE_LIVE_SOURCE_ID = "ca-earthquakes-live";
export const CA_QUAKE_LIVE_CIRCLE_ID = "ca-earthquakes-live-circle";
export const CA_QUAKE_LIVE_POLL_MS = 5 * 60_000;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const caQuakeLiveTypeFilter = (mask: number | undefined) => caCatFilter("event_type", CA_QUAKE_LIVE_TYPES, mask);

export function useCaLiveEarthquakesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDark: boolean,
  typeMask?: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const def = Number(paramDefault("caEarthquakesLive", "caEarthquakesLiveOpacity") ?? 0.85);
  const s = scale / Number(paramDefault("caEarthquakesLive", "caEarthquakesLiveScale") ?? 1);
  const filter = caQuakeLiveTypeFilter(typeMask);
  const op = clamp01(opacity);
  const paint = {
    "circle-radius": caQuakeRadius(s), "circle-color": ["match", ["get", "event_type"],
      "industry", CA_QUAKE_LIVE_TYPE_COLORS.industry, "mining", CA_QUAKE_LIVE_TYPE_COLORS.mining, "blast", CA_QUAKE_LIVE_TYPE_COLORS.blast,
      CA_QUAKE_LIVE_TYPE_COLORS.earthquake], "circle-opacity": op,
    ...pointStrokePaint(isDark, op / def),
  };
  const sig = JSON.stringify([paint, filter]);

  // 掛 source／layer、更新樣式；換底圖（style.load）重掛
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(CA_QUAKE_LIVE_CIRCLE_ID)) map.setLayoutProperty(CA_QUAKE_LIVE_CIRCLE_ID, "visibility", "none");
      return;
    }
    const mount = () => {
      if (!map.getSource(CA_QUAKE_LIVE_SOURCE_ID)) {
        map.addSource(CA_QUAKE_LIVE_SOURCE_ID, { type: "geojson", data: fcRef.current ?? EMPTY_FC, attribution: CA_QUAKE_LIVE_SOURCE.short });
      }
      if (!map.getLayer(CA_QUAKE_LIVE_CIRCLE_ID)) {
        map.addLayer({
          id: CA_QUAKE_LIVE_CIRCLE_ID, type: "circle", source: CA_QUAKE_LIVE_SOURCE_ID,
          layout: { visibility: "visible", "circle-sort-key": ["to-number", ["coalesce", ["get", "magnitude"], 0], 0] },
          paint,
        } as unknown as AnyLayer);
      }
      map.setLayoutProperty(CA_QUAKE_LIVE_CIRCLE_ID, "visibility", "visible");
      map.setFilter(CA_QUAKE_LIVE_CIRCLE_ID, (filter ?? null) as any);
      for (const [k, v] of Object.entries(paint)) map.setPaintProperty(CA_QUAKE_LIVE_CIRCLE_ID, k as any, v as any);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, visible, mapTick, sig]);

  // 可見時抓一次＋每 5 分鐘輪詢；失敗清空 source（不留舊資料，原因由圖例顯示）
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const apply = (fc: GeoJSON.FeatureCollection | null, announce: boolean) => {
      fcRef.current = fc;
      const map = mapRef.current;
      const src = map?.getSource(CA_QUAKE_LIVE_SOURCE_ID) as GeoJSONSource | undefined;
      if (!map || !src) return;
      src.setData(fc ?? EMPTY_FC);
      if (announce) keepLoadingUntilMapIdle(map, "ca-earthquakes-live:render", "加拿大即時地震渲染中", CA_QUAKE_LIVE_SOURCE_ID);
    };
    let first = true;
    const run = () => {
      fetchCaQuakesLive()
        .then((fc) => { if (!cancelled) apply(fc, first); first = false; })
        .catch(() => { if (!cancelled) apply(null, false); });
    };
    run();
    const timer = window.setInterval(run, CA_QUAKE_LIVE_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [visible, mapRef, mapTick]);
}
