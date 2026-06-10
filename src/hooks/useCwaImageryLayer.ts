/**
 * useCwaImageryLayer — 把 CWA 雲圖 / 雷達影像作為 Mapbox raster 圖層播放。
 *
 * 職責：
 *  - 依 timeline 日期載入該日 frames（base64 → object URL）；切日（subscribeDate）重載
 *  - 根據 timeline.currentTime 找「時間不晚於 currentTime 的最近一張」並切換 image source
 *  - 關閉時 remove layer/source + revoke object URLs
 *
 * 時間窗策略（migration 160）：
 *  - 今天（即時模式）：滾動 now-24h、全解析度（10min cadence），行為與舊版相同
 *  - 歷史日：該日 00:00~24:00（Asia/Taipei）+ 30min 抽稀
 *    （雷達單日全解析度 ~90MB base64，抽稀後 ~32MB；60x 播放下動畫仍順）
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
  type CwaImageryWindow,
} from "../data/cwaImageryLoader";
import {
  createCwaImageryLayer,
  type CwaImageryLayerHandle,
} from "../map/cwaImageryLayer";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

const CLOUD_DATASET = "O-C0042-004";
const RADAR_DATASET = "O-A0058-005";
// 歷史日抽稀 cadence（分鐘）；今天維持全解析度
const HISTORY_STEP_MINUTES = 30;

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** timeline 日期 → RPC 時間窗 */
function windowForDate(dateKey: string): CwaImageryWindow {
  if (dateKey === todayKey()) {
    return {
      sinceIso: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      untilIso: new Date(Date.now() + 3600 * 1000).toISOString(),
      stepMinutes: null,
    };
  }
  const start = new Date(`${dateKey}T00:00:00+08:00`).getTime();
  return {
    sinceIso: new Date(start).toISOString(),
    untilIso: new Date(start + 24 * 3600 * 1000).toISOString(),
    stepMinutes: HISTORY_STEP_MINUTES,
  };
}

interface LayerState {
  bundle: CwaImageryBundle | null;
  urls: Map<string, string>; // observedAtIso → object URL
  handle: CwaImageryLayerHandle | null;
  loading: boolean;
  loaded: boolean;
  currentIso: string | null;
  /** 已載入 frames 所屬的 timeline 日期 key（YYYY-MM-DD） */
  dateKey: string | null;
}

function createEmptyState(): LayerState {
  return {
    bundle: null,
    urls: new Map(),
    handle: null,
    loading: false,
    loaded: false,
    currentIso: null,
    dateKey: null,
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
  // 最新可見性（給 subscribeDate callback 用，避免閉包過期）
  const visRef = useRef({ cloud: cloudVisible, radar: radarVisible });
  visRef.current = { cloud: cloudVisible, radar: radarVisible };
  // reconcile 觸發器：載入完成後立即重算 frame，不等下一個 time tick
  const runRef = useRef<((t: number) => void) | null>(null);
  const disposedRef = useRef(false);

  // ── Loader：可見性變化或 timeline 切日 → 載入該日 frames ──
  useEffect(() => {
    // StrictMode 會 mount→unmount→remount：unmount 清理設了 disposed，
    // remount 時必須重置，否則所有載入被永久擋掉
    disposedRef.current = false;

    const stateOf = (dsId: string) =>
      dsId === CLOUD_DATASET ? cloudRef.current : radarRef.current;

    const loadDatasets = async (dateKey: string, datasets: string[]) => {
      try {
        const batch = await loadCwaImageryBatch(datasets, windowForDate(dateKey));
        for (const dsId of datasets) {
          const state = stateOf(dsId);
          const slot = batch.get(dsId);
          if (disposedRef.current) {
            if (slot) for (const u of slot.urls.values()) URL.revokeObjectURL(u);
            continue;
          }
          // 換日：釋放舊日 object URLs 再接上新資料
          for (const u of state.urls.values()) URL.revokeObjectURL(u);
          state.urls = slot?.urls ?? new Map();
          state.bundle = slot?.bundle ?? { datasetId: dsId, frames: [] };
          state.dateKey = dateKey;
          state.loaded = true;
          state.loading = false;
          state.currentIso = null;
          if (state.bundle.frames.length === 0) {
            console.warn(`[CWA Imagery] no frames for ${dsId} @ ${dateKey}`);
            state.handle?.setVisible(false);
          } else {
            state.handle?.setVisible(true);
            console.log(`[CWA Imagery] ${dsId} loaded ${state.bundle.frames.length} frames @ ${dateKey}`);
          }
        }
      } catch (err) {
        console.warn("[CWA Imagery] load failed", err);
        for (const dsId of datasets) stateOf(dsId).loading = false;
        return;
      }
      runRef.current?.(timeStore.getTime());
      // 載入期間日期又變了 → 立刻補載正確日期
      if (timeStore.getDateKey() !== dateKey) ensureFresh();
    };

    const ensureFresh = () => {
      if (disposedRef.current) return;
      const dk = timeStore.getDateKey();
      const need: string[] = [];
      const check = (visible: boolean, state: LayerState, dsId: string) => {
        if (visible && !state.loading && (!state.loaded || state.dateKey !== dk)) {
          state.loading = true;
          need.push(dsId);
        }
      };
      check(visRef.current.cloud, cloudRef.current, CLOUD_DATASET);
      check(visRef.current.radar, radarRef.current, RADAR_DATASET);
      if (need.length > 0) void loadDatasets(dk, need);
    };

    ensureFresh();
    const unsubDate = timeStore.subscribeDate(() => ensureFresh());
    return () => unsubDate();
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
        state.dateKey = null;
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
        keepLoadingUntilMapIdle(map, `cwa-render:${sourceId}`, `CWA 影像 渲染中`, null);
      } else {
        if (state.currentIso !== frame.observedAtIso) {
          state.handle.setUrl(url);
          state.currentIso = frame.observedAtIso;
          keepLoadingUntilMapIdle(map, `cwa-render:${sourceId}`, `CWA 影像 渲染中`, null);
        }
        state.handle.setOpacity(opacity);
      }
    };

    const run = (currentTimeSec: number) => {
      reconcile(cloudRef.current, cloudVisible, cloudOpacity, "cwa-cloud-src", "cwa-cloud-layer", currentTimeSec);
      reconcile(radarRef.current, radarVisible, radarOpacity, "cwa-radar-src", "cwa-radar-layer", currentTimeSec);
    };
    runRef.current = run;

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
        if (runRef.current === run) runRef.current = null;
      };
    }

    startSubscription();
    return () => {
      if (unsubTime) unsubTime();
      if (runRef.current === run) runRef.current = null;
    };
  }, [mapRef, cloudVisible, radarVisible, cloudOpacity, radarOpacity]);

  // ── Unmount 清理 ──
  useEffect(() => {
    disposedRef.current = false; // StrictMode remount 重置
    return () => {
      disposedRef.current = true;
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
