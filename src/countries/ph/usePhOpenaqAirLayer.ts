import { useEffect, useRef } from "react";
import type { AnyLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { pointRadius, pointStrokePaint } from "../../map/mapStyleScale";
import { paramDefault } from "../../data/layerParamsSpec";
import { keepLoadingUntilMapIdle } from "../../lib/loadingRegistry";
import { fetchPhOpenaqLatest, PH_OPENAQ_MONITOR_RING, PH_OPENAQ_POLL_MS, PH_OPENAQ_SOURCE } from "../../data/openaqLoader";
import { useMapReadyTick } from "../../hooks/useMapReadyTick";

/**
 * 菲律賓空品（OpenAQ）：RPC get_openaq_latest（mig 563）→ 自建 GeoJSON source＋circle。
 * 接線比照加拿大即時地震 useCaLiveEarthquakesLayer；配色比照 LASS 微型感測（PM2.5 五級、缺值灰）。
 * 快照錨在掛鐘現在、不跟時間軸（不訂閱 timeStore，currentTime 不進 deps）；可見時每 10 分鐘重抓並重算過舊。
 * 低價感測器：一般細縫描邊；官方監測站（is_monitor）：白色粗框、半徑大一階。過舊（>3h）點淡化。
 */
export const PH_OPENAQ_SOURCE_ID = "ph-openaq-air";
export const PH_OPENAQ_CIRCLE_ID = "ph-openaq-air-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 過舊點的透明度乘數。 */
export const PH_OPENAQ_STALE_FACTOR = 0.35;

export function phOpenaqPaint(opacity: number, scale: number, isDark: boolean, def: number): Record<string, unknown> {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / def);
  const monitor = ["==", ["get", "is_monitor"], true];
  const stale = ["==", ["get", "freshness"], "stale"];
  return {
    "circle-radius": ["case", monitor, pointRadius("L", scale), pointRadius("M", scale)],
    "circle-color": ["get", "color"],
    "circle-opacity": ["case", stale, op * PH_OPENAQ_STALE_FACTOR, op],
    "circle-stroke-color": ["case", monitor, PH_OPENAQ_MONITOR_RING, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", monitor, 2, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", stale, seam["circle-stroke-opacity"] * PH_OPENAQ_STALE_FACTOR, seam["circle-stroke-opacity"]],
  };
}

export function usePhOpenaqAirLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDark: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const def = Number(paramDefault("phOpenaqAir", "phOpenaqAirOpacity") ?? 0.9);
  const s = scale / Number(paramDefault("phOpenaqAir", "phOpenaqAirScale") ?? 1);
  const paint = phOpenaqPaint(opacity, s, isDark, def);
  const sig = JSON.stringify(paint);

  // 掛 source／layer、更新樣式；換底圖（style.load）重掛
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(PH_OPENAQ_CIRCLE_ID)) map.setLayoutProperty(PH_OPENAQ_CIRCLE_ID, "visibility", "none");
      return;
    }
    const mount = () => {
      if (!map.getSource(PH_OPENAQ_SOURCE_ID)) {
        map.addSource(PH_OPENAQ_SOURCE_ID, { type: "geojson", data: fcRef.current ?? EMPTY_FC, attribution: PH_OPENAQ_SOURCE.short });
      }
      if (!map.getLayer(PH_OPENAQ_CIRCLE_ID)) {
        map.addLayer({
          id: PH_OPENAQ_CIRCLE_ID, type: "circle", source: PH_OPENAQ_SOURCE_ID,
          // 官方站畫在上面；新鮮的畫在過舊與無資料上面
          layout: { visibility: "visible", "circle-sort-key": ["+", ["case", ["==", ["get", "is_monitor"], true], 10, 0], ["match", ["get", "freshness"], "fresh", 2, "stale", 1, 0]] },
          paint,
        } as unknown as AnyLayer);
      }
      map.setLayoutProperty(PH_OPENAQ_CIRCLE_ID, "visibility", "visible");
      for (const [k, v] of Object.entries(paint)) map.setPaintProperty(PH_OPENAQ_CIRCLE_ID, k as never, v as never);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, visible, mapTick, sig]);

  // 可見時抓一次＋每 10 分鐘輪詢；失敗清空 source（不留舊資料，原因由圖例顯示）
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const apply = (fc: GeoJSON.FeatureCollection | null, announce: boolean) => {
      fcRef.current = fc;
      const map = mapRef.current;
      const src = map?.getSource(PH_OPENAQ_SOURCE_ID) as GeoJSONSource | undefined;
      if (!map || !src) return;
      src.setData(fc ?? EMPTY_FC);
      if (announce) keepLoadingUntilMapIdle(map, "ph-openaq:render", "菲律賓空品渲染中", PH_OPENAQ_SOURCE_ID);
    };
    let first = true;
    const run = () => {
      fetchPhOpenaqLatest()
        .then((fc) => { if (!cancelled) apply(fc, first); first = false; })
        .catch((err: unknown) => {
          console.warn("[PhOpenaq] load failed:", err);
          if (!cancelled) apply(null, false);
        });
    };
    run();
    const timer = window.setInterval(run, PH_OPENAQ_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [visible, mapRef, mapTick]);
}
