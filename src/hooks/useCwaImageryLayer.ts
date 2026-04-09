/**
 * useCwaImageryLayer — 把 CWA 雲圖 / 雷達影像作為 Mapbox raster 圖層播放。
 *
 * 職責：
 *  - 第一次開啟時載入 24h metadata + 預載所有 frame bytes（base64 → object URL）
 *  - 根據 timeline.currentTime 找「時間不晚於 currentTime 的最近一張」並切換 image source
 *  - 關閉時 remove layer/source + revoke object URLs
 *
 * 兩個 dataset：
 *   - O-C0042-004  衛星雲圖 (底層, 不透明預設 1.0)
 *   - O-A0058-005  雷達回波 (上層, 透明 0.85)
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  loadCwaImageryFrames,
  preloadCwaImageryUrls,
  type CwaImageryBundle,
  type CwaImageryFrame,
} from "../data/cwaImageryLoader";
import {
  createCwaImageryLayer,
  type CwaImageryLayerHandle,
} from "../map/cwaImageryLayer";

const CLOUD_DATASET = "O-C0042-004";
const RADAR_DATASET = "O-A0058-005";
// timeline 會回放整天，只抓過去 24h 會讓早於 24h 前的時段找不到 frame 變成空白。
// 擴到 48h 確保昨天整天都有覆蓋，配合 cwa_imagery 只保留近 7 天的清理邏輯也還安全。
const SINCE_HOURS = 48;

interface LayerState {
  bundle: CwaImageryBundle | null;
  urls: Map<string, string>; // observedAtIso → object URL
  handle: CwaImageryLayerHandle | null;
  loading: boolean;
  loaded: boolean;
  currentIso: string | null;
}

function createEmptyState(): LayerState {
  return {
    bundle: null,
    urls: new Map(),
    handle: null,
    loading: false,
    loaded: false,
    currentIso: null,
  };
}

/** 找出時間 <= currentMs 的最近一張 frame（若全部晚於 currentMs 則回傳第一張） */
function pickFrameForTime(frames: CwaImageryFrame[], currentMs: number): CwaImageryFrame | null {
  if (frames.length === 0) return null;
  // frames 已依 observedAtMs 升序
  let chosen: CwaImageryFrame | null = null;
  for (const f of frames) {
    if (f.observedAtMs <= currentMs) chosen = f;
    else break;
  }
  return chosen ?? frames[0]!;
}

interface UseCwaImageryLayerOptions {
  mapRef: React.RefObject<MapboxMap | null>;
  currentTime: number; // unix seconds
  cloudVisible: boolean;
  radarVisible: boolean;
  cloudOpacity: number;
  radarOpacity: number;
}

export function useCwaImageryLayer({
  mapRef,
  currentTime,
  cloudVisible,
  radarVisible,
  cloudOpacity,
  radarOpacity,
}: UseCwaImageryLayerOptions) {
  const cloudRef = useRef<LayerState>(createEmptyState());
  const radarRef = useRef<LayerState>(createEmptyState());

  // 最新的 currentTime（ref，讓非同步載入完成後可以直接取得最新時間）
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  // ── Loader（第一次變成可見時觸發） ──
  useEffect(() => {
    const datasetsToLoad: string[] = [];
    if (cloudVisible && !cloudRef.current.loaded && !cloudRef.current.loading) {
      cloudRef.current.loading = true;
      datasetsToLoad.push(CLOUD_DATASET);
    }
    if (radarVisible && !radarRef.current.loaded && !radarRef.current.loading) {
      radarRef.current.loading = true;
      datasetsToLoad.push(RADAR_DATASET);
    }
    if (datasetsToLoad.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const bundles = await loadCwaImageryFrames(datasetsToLoad, SINCE_HOURS);
        if (cancelled) return;

        // 各自平行預載 bytes
        await Promise.all(
          datasetsToLoad.map(async (dsId) => {
            const bundle = bundles.get(dsId);
            if (!bundle || bundle.frames.length === 0) {
              console.warn(`[CWA Imagery] no frames for ${dsId}`);
              return;
            }
            const state = dsId === CLOUD_DATASET ? cloudRef.current : radarRef.current;
            state.bundle = bundle;
            const urls = await preloadCwaImageryUrls(bundle);
            if (cancelled) {
              // 取消：清理已建立的 object URL
              for (const u of urls.values()) URL.revokeObjectURL(u);
              return;
            }
            state.urls = urls;
            state.loaded = true;
            state.loading = false;
          }),
        );
      } catch (err) {
        console.warn("[CWA Imagery] load failed", err);
        if (datasetsToLoad.includes(CLOUD_DATASET)) cloudRef.current.loading = false;
        if (datasetsToLoad.includes(RADAR_DATASET)) radarRef.current.loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudVisible, radarVisible]);

  // ── Layer 生命週期 + frame 切換 ──
  // 每次 currentTime / visibility / opacity 變動 → reconcile
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reconcile = (
      state: LayerState,
      visible: boolean,
      opacity: number,
      sourceId: string,
      layerId: string,
    ) => {
      if (!visible) {
        // 關閉：移除 layer + source，釋放 object URLs
        if (state.handle) {
          state.handle.remove();
          state.handle = null;
        }
        for (const url of state.urls.values()) URL.revokeObjectURL(url);
        state.urls = new Map();
        state.bundle = null;
        state.loaded = false;
        state.loading = false;
        state.currentIso = null;
        return;
      }
      if (!state.bundle || !state.loaded || state.urls.size === 0) return;

      const frame = pickFrameForTime(state.bundle.frames, currentTimeRef.current * 1000);
      if (!frame) return;
      const url = state.urls.get(frame.observedAtIso);
      if (!url) return;

      if (!state.handle) {
        state.handle = createCwaImageryLayer(map, {
          sourceId,
          layerId,
          bbox: {
            lonMin: frame.lonMin,
            lonMax: frame.lonMax,
            latMin: frame.latMin,
            latMax: frame.latMax,
          },
          initialUrl: url,
          opacity,
        });
        state.currentIso = frame.observedAtIso;
      } else {
        if (state.currentIso !== frame.observedAtIso) {
          state.handle.setUrl(url);
          state.currentIso = frame.observedAtIso;
        }
        state.handle.setOpacity(opacity);
      }
    };

    const run = () => {
      reconcile(cloudRef.current, cloudVisible, cloudOpacity, "cwa-cloud-src", "cwa-cloud-layer");
      reconcile(radarRef.current, radarVisible, radarOpacity, "cwa-radar-src", "cwa-radar-layer");
    };

    if (!map.isStyleLoaded()) {
      const onLoad = () => run();
      map.once("load", onLoad);
      return () => {
        map.off("load", onLoad);
      };
    }

    run();
    return undefined;
  }, [mapRef, currentTime, cloudVisible, radarVisible, cloudOpacity, radarOpacity]);

  // ── Unmount 清理 ──
  useEffect(() => {
    return () => {
      for (const state of [cloudRef.current, radarRef.current]) {
        if (state.handle) {
          try {
            state.handle.remove();
          } catch {
            /* map 可能已銷毀 */
          }
          state.handle = null;
        }
        for (const url of state.urls.values()) URL.revokeObjectURL(url);
        state.urls = new Map();
      }
    };
  }, []);
}
