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
  loadCwaImageryBatch,
  type CwaImageryBundle,
  type CwaImageryFrame,
} from "../data/cwaImageryLoader";
import {
  createCwaImageryLayer,
  type CwaImageryLayerHandle,
} from "../map/cwaImageryLayer";
import { timeStore } from "../state/timeStore";

const CLOUD_DATASET = "O-C0042-004";
const RADAR_DATASET = "O-A0058-005";
// 改用 get_cwa_imagery_frames_batch 單次 RPC 一起回 metadata + bytes，
// 避開舊版「list + N 個並發 fetch_frame」撐爆瀏覽器網路層的問題。
// 48h 約 ~448 frames ~57MB base64 payload，1 個 HTTP，2 秒內完成。
// 降到 24h 減少 egress + DB IO 壓力
const SINCE_HOURS = 24;

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
  cloudVisible: boolean;
  radarVisible: boolean;
  cloudOpacity: number;
  radarOpacity: number;
}

export function useCwaImageryLayer({
  mapRef,
  cloudVisible,
  radarVisible,
  cloudOpacity,
  radarOpacity,
}: UseCwaImageryLayerOptions) {
  const cloudRef = useRef<LayerState>(createEmptyState());
  const radarRef = useRef<LayerState>(createEmptyState());

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
        const batch = await loadCwaImageryBatch(datasetsToLoad, SINCE_HOURS);
        if (cancelled) {
          // 取消：清理所有已建立的 object URL
          for (const slot of batch.values()) {
            for (const u of slot.urls.values()) URL.revokeObjectURL(u);
          }
          return;
        }
        for (const dsId of datasetsToLoad) {
          const slot = batch.get(dsId);
          const state = dsId === CLOUD_DATASET ? cloudRef.current : radarRef.current;
          if (!slot || slot.bundle.frames.length === 0) {
            console.warn(`[CWA Imagery] no frames for ${dsId}`);
            state.loading = false;
            continue;
          }
          state.bundle = slot.bundle;
          state.urls = slot.urls;
          state.loaded = true;
          state.loading = false;
          console.log(`[CWA Imagery] ${dsId} loaded ${slot.bundle.frames.length} frames`);
        }
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
  // visibility / opacity 變動 → reconcile；時間變動由 timeStore 訂閱觸發 reconcile
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reconcile = (
      state: LayerState,
      visible: boolean,
      opacity: number,
      sourceId: string,
      layerId: string,
      currentTimeSec: number,
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

      const frame = pickFrameForTime(state.bundle.frames, currentTimeSec * 1000);
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

    const run = (currentTimeSec: number) => {
      reconcile(cloudRef.current, cloudVisible, cloudOpacity, "cwa-cloud-src", "cwa-cloud-layer", currentTimeSec);
      reconcile(radarRef.current, radarVisible, radarOpacity, "cwa-radar-src", "cwa-radar-layer", currentTimeSec);
    };

    let unsubTime: (() => void) | null = null;
    const startSubscription = () => {
      run(timeStore.getTime()); // 初始化
      // frame 粒度約 10min，1s 節流足夠
      unsubTime = timeStore.subscribeThrottled(1000, run);
    };

    if (!map.isStyleLoaded()) {
      const onLoad = () => startSubscription();
      map.once("load", onLoad);
      return () => {
        map.off("load", onLoad);
        if (unsubTime) unsubTime();
      };
    }

    startSubscription();
    return () => {
      if (unsubTime) unsubTime();
    };
  }, [mapRef, cloudVisible, radarVisible, cloudOpacity, radarOpacity]);

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
