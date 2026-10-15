/**
 * useGibsSnowCoverLayer — NASA GIBS 衛星雪覆蓋（NDSI）XYZ raster，瀏覽器直連上游。
 *
 * - {Time}＝時間軸時刻的 UTC 日期（即時＝今天 UTC）；日期變了才 setTiles 換磚（timeStore.subscribeThrottled(1000)，
 *   scrub 時 1 秒內只換一次，等同 debounce），時間不進 deps（development-rules §8）。
 * - 日期超出上游範圍（早於 layer 起始日、晚於今天 UTC）→ 隱藏＋狀態 uncovered（圖例「未涵蓋」），不打會 404 的請求。
 * - 上游 z0–8：source maxzoom 8，更大 zoom overzoom。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, RasterLayerSpecification, RasterTileSource } from "mapbox-gl";
import { GIBS_ATTRIBUTION, GIBS_MAX_ZOOM, gibsDateInRange, gibsSnowProduct, gibsSnowTileUrl, gibsUtcDate } from "../data/gibsSnowTypes";
import { GIBS_SNOW_STATUS_KEY } from "../data/jmaUpstreamLoaders";
import { setJmaImageryStatus } from "../data/jmaImageryLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { isHistoryMode } from "./useTimeStoreTime";
import { useMapReadyTick } from "./useMapReadyTick";

export const GIBS_SNOW_SOURCE_ID = "gibs-snow-cover-src";
export const GIBS_SNOW_LAYER_ID = "gibs-snow-cover-layer";

interface Options {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  opacity: number;
  productIdx: number;
}

export function useGibsSnowCoverLayer({ mapRef, visible, opacity, productIdx }: Options) {
  const mapTick = useMapReadyTick(mapRef);
  const currentUrlRef = useRef<string | null>(null);
  /** 最後一次建圖層用的 map（unmount 清理用；不把 mapRef 放進清理 effect 的 deps） */
  const mapInstRef = useRef<MapboxMap | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    mapInstRef.current = map;
    const product = gibsSnowProduct(productIdx);

    const hide = () => {
      if (map.getLayer(GIBS_SNOW_LAYER_ID)) map.setLayoutProperty(GIBS_SNOW_LAYER_ID, "visibility", "none");
    };

    const run = (tSec: number) => {
      if (!visible) {
        hide();
        setJmaImageryStatus(GIBS_SNOW_STATUS_KEY, { state: "idle", validTimeIso: null });
        return;
      }
      const nowMs = Date.now();
      const date = gibsUtcDate(isHistoryMode(tSec) ? tSec : nowMs / 1000);
      if (!gibsDateInRange(date, product, nowMs)) {
        hide();
        setJmaImageryStatus(GIBS_SNOW_STATUS_KEY, { state: "uncovered", validTimeIso: date, reason: "out_of_range" });
        return;
      }
      const url = gibsSnowTileUrl(product.layer, date);
      const src = map.getSource(GIBS_SNOW_SOURCE_ID) as RasterTileSource | undefined;
      if (!src) {
        map.addSource(GIBS_SNOW_SOURCE_ID, {
          type: "raster", tiles: [url], tileSize: 256, minzoom: 0, maxzoom: GIBS_MAX_ZOOM, attribution: GIBS_ATTRIBUTION,
        });
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, `${GIBS_SNOW_SOURCE_ID}:render`, "衛星雪覆蓋 載入中", GIBS_SNOW_SOURCE_ID, 8000);
      } else if (currentUrlRef.current !== url) {
        src.setTiles([url]);
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, `${GIBS_SNOW_SOURCE_ID}:render`, "衛星雪覆蓋 載入中", GIBS_SNOW_SOURCE_ID, 8000);
      }
      if (!map.getLayer(GIBS_SNOW_LAYER_ID)) {
        map.addLayer({
          id: GIBS_SNOW_LAYER_ID, type: "raster", source: GIBS_SNOW_SOURCE_ID,
          paint: { "raster-opacity": opacityRef.current, "raster-resampling": "nearest", "raster-fade-duration": 0 },
        } as RasterLayerSpecification);
      }
      map.setLayoutProperty(GIBS_SNOW_LAYER_ID, "visibility", "visible");
      setJmaImageryStatus(GIBS_SNOW_STATUS_KEY, { state: "shown", validTimeIso: date });
    };

    let disposed = false;
    let retryPending = false;
    const retry = () => { retryPending = false; if (!disposed) safeRun(timeStore.getTime()); };
    const safeRun = (t: number) => {
      try { run(t); } catch {
        if (!disposed && !retryPending) { retryPending = true; map.once("idle", retry); }
      }
    };
    const onStyleLoad = () => { currentUrlRef.current = null; safeRun(timeStore.getTime()); };

    safeRun(timeStore.getTime());
    const unsubTime = visible ? timeStore.subscribeThrottled(1000, safeRun) : null;
    map.on("style.load", onStyleLoad);
    return () => {
      disposed = true;
      unsubTime?.();
      map.off("style.load", onStyleLoad);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, visible, productIdx, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !map) return;
    try { if (map.getLayer(GIBS_SNOW_LAYER_ID)) map.setPaintProperty(GIBS_SNOW_LAYER_ID, "raster-opacity", opacity); } catch { /* style 轉換中 */ }
  }, [mapRef, opacity, visible, mapTick]);

  useEffect(() => () => {
    const map = mapInstRef.current;
    try {
      if (map?.getLayer(GIBS_SNOW_LAYER_ID)) map.removeLayer(GIBS_SNOW_LAYER_ID);
      if (map?.getSource(GIBS_SNOW_SOURCE_ID)) map.removeSource(GIBS_SNOW_SOURCE_ID);
    } catch { /* map 可能已銷毀 */ }
    currentUrlRef.current = null;
    setJmaImageryStatus(GIBS_SNOW_STATUS_KEY, { state: "idle", validTimeIso: null });
  }, []);
}
