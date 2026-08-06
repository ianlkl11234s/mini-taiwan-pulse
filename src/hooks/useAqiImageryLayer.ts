/**
 * useAqiImageryLayer — airtw 空氣品質色階 raster 圖層
 *
 * 職責：
 *  - 依 visible + selectedProduct 載入對應 frames（切換產品 → revoke 舊 URLs + 重載）
 *  - 依 timeStore.subscribeThrottled 切換到當前時刻最近一張 frame
 *  - 關閉 / unmount 時移除 layer 並釋放 object URLs
 *
 * 複用 createCwaImageryLayer（同樣是 Mapbox image source + raster layer）。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  loadAqiImageryBatch,
  type AqiImageryBundle,
  type AqiImageryFrame,
} from "../data/aqiImageryLoader";
import {
  createCwaImageryLayer,
  type CwaImageryLayerHandle,
} from "../map/cwaImageryLayer";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import type { AqiProduct } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";

const SINCE_HOURS = 24;
const SOURCE_ID = "aqi-imagery-src";
const LAYER_ID = "aqi-imagery-layer";

interface LayerState {
  product: AqiProduct | null;
  bundle: AqiImageryBundle | null;
  handle: CwaImageryLayerHandle | null;
  loading: boolean;
  currentIso: string | null;
}

function createEmptyState(): LayerState {
  return {
    product: null,
    bundle: null,
    handle: null,
    loading: false,
    currentIso: null,
  };
}

function pickFrameForTime(frames: AqiImageryFrame[], currentMs: number): AqiImageryFrame | null {
  if (frames.length === 0) return null;
  let chosen: AqiImageryFrame | null = null;
  for (const f of frames) {
    if (f.observedAtMs <= currentMs) chosen = f;
    else break;
  }
  return chosen ?? frames[frames.length - 1]!;
}

function disposeBundle(bundle: AqiImageryBundle | null) {
  if (!bundle) return;
  for (const url of bundle.urls.values()) URL.revokeObjectURL(url);
  bundle.urls.clear();
}

interface UseAqiImageryLayerOptions {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  product: AqiProduct;
  opacity: number;
}

export function useAqiImageryLayer({
  mapRef,
  visible,
  product,
  opacity,
}: UseAqiImageryLayerOptions) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  const stateRef = useRef<LayerState>(createEmptyState());

  // ── Loader：visible 開啟 / 產品切換時觸發 ──
  useEffect(() => {
    if (!visible) return;
    const state = stateRef.current;
    if (state.product === product && state.bundle && !state.loading) return;
    if (state.loading) return;

    // 切換產品 → 清舊資料
    if (state.product !== product) {
      if (state.handle) {
        try { state.handle.remove(); } catch { /* map 可能銷毀 */ }
        state.handle = null;
      }
      disposeBundle(state.bundle);
      state.bundle = null;
      state.currentIso = null;
    }

    state.loading = true;
    let cancelled = false;

    (async () => {
      try {
        const bundle = await loadAqiImageryBatch(product, SINCE_HOURS);
        if (cancelled) {
          disposeBundle(bundle);
          return;
        }
        state.product = product;
        state.bundle = bundle;
        state.loading = false;
        console.log(`[AQI Imagery] ${product} loaded ${bundle.frames.length} frames`);
      } catch (err) {
        console.warn(`[AQI Imagery] ${product} load failed`, err);
        state.loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, product]);

  // ── Layer 生命週期 + frame 切換 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reconcile = (currentTimeSec: number) => {
      const state = stateRef.current;

      if (!visible) {
        if (state.handle) {
          try { state.handle.remove(); } catch { /* noop */ }
          state.handle = null;
        }
        state.currentIso = null;
        return;
      }
      if (!state.bundle || state.bundle.frames.length === 0) return;

      const frame = pickFrameForTime(state.bundle.frames, currentTimeSec * 1000);
      if (!frame) return;
      const url = state.bundle.urls.get(frame.observedAtIso);
      if (!url) return;

      if (!state.handle) {
        state.handle = createCwaImageryLayer(map, {
          sourceId: SOURCE_ID,
          layerId: LAYER_ID,
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
        keepLoadingUntilMapIdle(map, "aqi-imagery-render", "空品色階 渲染中", null);
      } else {
        if (state.currentIso !== frame.observedAtIso) {
          state.handle.setUrl(url);
          state.currentIso = frame.observedAtIso;
          keepLoadingUntilMapIdle(map, "aqi-imagery-render", "空品色階 渲染中", null);
        }
        state.handle.setOpacity(opacity);
      }
    };

    let unsubTime: (() => void) | null = null;
    const startSubscription = () => {
      reconcile(timeStore.getTime());
      // airtw 粒度 1 小時，5s 節流足夠
      unsubTime = timeStore.subscribeThrottled(5000, reconcile);
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
  }, [mapRef, visible, product, opacity, mapTick]);

  // ── Unmount 清理 ──
  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (state.handle) {
        try { state.handle.remove(); } catch { /* noop */ }
        state.handle = null;
      }
      disposeBundle(state.bundle);
      state.bundle = null;
    };
  }, []);
}
