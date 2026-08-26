/**
 * useStaticRasterLayer — 把單張 PNG（已預烤 colormap）鋪在固定 bbox 上的靜態 raster 圖層。
 *
 * 適用：地形 hillshade / slope / aspect 這類「全臺一張預烤 PNG」的視覺底圖。
 * 不適用：時序 raster（用 useCwaImageryLayer / useAqiImageryLayer）。
 *
 * 複用 createCwaImageryLayer（Mapbox image source + raster layer）。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  createCwaImageryLayer,
  type CwaImageryBBox,
  type CwaImageryLayerHandle,
} from "../map/cwaImageryLayer";

interface UseStaticRasterLayerOptions {
  mapRef: React.RefObject<MapboxMap | null>;
  sourceId: string;
  layerId: string;
  url: string;
  bbox: CwaImageryBBox;
  visible: boolean;
  opacity: number;
  /** beforeId: 放在哪個 layer 下方（未指定則置於最上層） */
  beforeId?: string;
}

export function useStaticRasterLayer({
  mapRef,
  sourceId,
  layerId,
  url,
  bbox,
  visible,
  opacity,
  beforeId,
}: UseStaticRasterLayerOptions) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  const handleRef = useRef<CwaImageryLayerHandle | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ensure = () => {
      if (!visible) {
        handleRef.current?.setVisible(false);
        return;
      }
      if (!handleRef.current) {
        handleRef.current = createCwaImageryLayer(map, {
          sourceId,
          layerId,
          bbox,
          initialUrl: url,
          opacity,
          beforeId,
        });
      } else {
        handleRef.current.ensure();
        handleRef.current.setVisible(true);
        handleRef.current.setOpacity(opacity);
      }
    };

    let disposed = false;
    let retryPending = false;
    const retry = () => {
      retryPending = false;
      if (!disposed) run();
    };
    const scheduleRetry = () => {
      if (disposed || retryPending) return;
      retryPending = true;
      map.once("idle", retry);
    };
    const run = () => {
      try { ensure(); } catch { scheduleRetry(); }
    };

    // visibility=false 不能等待下一個 load；該事件通常早已發生，且 tile busy
    // 也會讓 isStyleLoaded() 暫時為 false。先直接關，真正失敗才等 idle 重試。
    run();
    map.on("style.load", run);
    return () => {
      disposed = true;
      map.off("style.load", run);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, sourceId, layerId, url, bbox, visible, opacity, beforeId, mapTick]);

  useEffect(() => {
    return () => {
      if (handleRef.current) {
        try { handleRef.current.remove(); } catch { /* map disposed */ }
        handleRef.current = null;
      }
    };
  }, []);
}
