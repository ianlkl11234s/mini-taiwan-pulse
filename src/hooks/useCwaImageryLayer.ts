/**
 * useCwaImageryLayer — 把 CWA 雲圖 / 雷達影像作為 Mapbox raster 圖層播放。
 *
 * 職責：
 *  - 依 timeline 日期載入該日 frames（base64 → object URL）；切日（subscribeDate）重載
 *  - 根據 timeline.currentTime 找「時間不晚於 currentTime 的最近一張」並切換 image source
 *  - 關閉時 remove handle（但保留 cache，再開啟立即可用）
 *
 * 時間窗策略（migration 160）：
 *  - 今天（即時模式）：滾動 now-24h、全解析度（10min cadence），行為與舊版相同
 *  - 歷史日：該日 00:00~24:00（Asia/Taipei）+ 30min 抽稀
 *    （雷達單日全解析度 ~90MB base64，抽稀後 ~32MB；60x 播放下動畫仍順）
 *
 * 兩個 dataset：
 *   - O-C0042-004  衛星雲圖 (底層, 不透明預設 1.0)
 *   - O-A0058-005  雷達回波 (上層, 透明 0.85)
 *
 * Per-day LRU cache（2026-06-26）：
 *  - cacheRef: dsId → dateKey → { bundle, urls }，access order 維護 LRU
 *  - preloadDays (1~7) 控制 cache 上限 + 在當前日附近背景預載 ±days
 *  - 切日命中 cache 就立即套用（不發 RPC、不 revoke）；layer 關閉只 remove handle，cache 留著
 *  - 用戶調小 preloadDays → 立刻 evict 多出的最舊日
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

/** Cache slot：單 dataset × 單日 的 frames + object URLs */
interface CacheSlot {
  bundle: CwaImageryBundle;
  urls: Map<string, string>; // observedAtIso → object URL
}

/** LayerState：只追蹤目前 active handle / 渲染中 frame，資料一律從 cache 拿 */
interface LayerState {
  handle: CwaImageryLayerHandle | null;
  currentIso: string | null;
  /** 目前 handle 對應的 cache slot 日期（YYYY-MM-DD） */
  activeDateKey: string | null;
}

function createEmptyState(): LayerState {
  return { handle: null, currentIso: null, activeDateKey: null };
}

/** Cache 管理：LRU 容量 = preloadDays */
function getOrCreate<K, V>(m: Map<K, V>, k: K, factory: () => V): V {
  let v = m.get(k);
  if (v === undefined) { v = factory(); m.set(k, v); }
  return v;
}

function touchLRU(arr: string[], dateKey: string) {
  const idx = arr.indexOf(dateKey);
  if (idx >= 0) arr.splice(idx, 1);
  arr.push(dateKey);
}

function evictExcess(
  cache: Map<string, CacheSlot>,
  order: string[],
  maxSize: number,
  protectKeys: ReadonlySet<string>,
) {
  // 從最舊開始 evict，但不動 protectKeys（當前 active + 鄰近待預載日）
  let i = 0;
  while (cache.size > maxSize && i < order.length) {
    const k = order[i]!;
    if (protectKeys.has(k)) { i++; continue; }
    const slot = cache.get(k);
    if (slot) for (const u of slot.urls.values()) URL.revokeObjectURL(u);
    cache.delete(k);
    order.splice(i, 1);
  }
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
  // 最新可見性（給 subscribeDate / 背景預載 callback 避免閉包過期）
  const visRef = useRef({ cloud: cloudVisible, radar: radarVisible });
  visRef.current = { cloud: cloudVisible, radar: radarVisible };
  // per-dataset cache：dsId → dateKey → CacheSlot；access order 維護 LRU（last = 最近用過）
  const cacheRef = useRef<Map<string, Map<string, CacheSlot>>>(new Map());
  const orderRef = useRef<Map<string, string[]>>(new Map());
  // in-flight 防併發：dsId → set of dateKey 載入中
  const inflightRef = useRef<Map<string, Set<string>>>(new Map());
  // reconcile 觸發器：載入完成後立即重算 frame，不等下一個 time tick
  const runRef = useRef<((t: number) => void) | null>(null);
  const disposedRef = useRef(false);

  // ── Loader / cache 管理 ──
  useEffect(() => {
    disposedRef.current = false;

    const stateOf = (dsId: string) =>
      dsId === CLOUD_DATASET ? cloudRef.current : radarRef.current;

    const getCache = (dsId: string) => getOrCreate(cacheRef.current, dsId, () => new Map<string, CacheSlot>());
    const getOrder = (dsId: string) => getOrCreate(orderRef.current, dsId, () => [] as string[]);
    const getInflight = (dsId: string) => getOrCreate(inflightRef.current, dsId, () => new Set<string>());

    /** 套用 cache slot 到 active state（已在 cache 內），通知 reconcile 重算 */
    const applyActive = (state: LayerState, dsId: string, dateKey: string) => {
      if (state.activeDateKey === dateKey) return;
      state.activeDateKey = dateKey;
      state.currentIso = null; // 強制 reconcile 重選 frame + setUrl
      touchLRU(getOrder(dsId), dateKey);
    };

    /** 載入單一 (dsId, dateKey) 進 cache；foreground=true 才灌 LOADING panel */
    const loadOne = async (dsId: string, dateKey: string, foreground: boolean) => {
      const cache = getCache(dsId);
      if (cache.has(dateKey)) {
        touchLRU(getOrder(dsId), dateKey);
        return;
      }
      const inflight = getInflight(dsId);
      if (inflight.has(dateKey)) return;
      inflight.add(dateKey);
      try {
        const batch = await loadCwaImageryBatch([dsId], windowForDate(dateKey), { silent: !foreground });
        const slot = batch.get(dsId);
        if (disposedRef.current) {
          if (slot) for (const u of slot.urls.values()) URL.revokeObjectURL(u);
          return;
        }
        if (!slot) return;
        cache.set(dateKey, slot);
        touchLRU(getOrder(dsId), dateKey);
        if (slot.bundle.frames.length === 0) {
          console.warn(`[CWA Imagery] no frames for ${dsId} @ ${dateKey}`);
        } else {
          console.log(`[CWA Imagery] ${dsId} ${foreground ? "loaded" : "prefetched"} ${slot.bundle.frames.length} frames @ ${dateKey}`);
        }
      } catch (err) {
        console.warn(`[CWA Imagery] load failed ${dsId}@${dateKey}`, err);
      } finally {
        inflight.delete(dateKey);
      }
    };

    /**
     * Foreground 載入當天（馬上要顯示）— 不 debounce、不排隊
     * 注意：CWA 一個 day = ~30MB base64，foreground 已經夠重，不能再外推
     */
    const ensureForeground = async () => {
      if (disposedRef.current) return;
      const dk = timeStore.getDateKey();
      const datasets: string[] = [];
      if (visRef.current.cloud) datasets.push(CLOUD_DATASET);
      if (visRef.current.radar) datasets.push(RADAR_DATASET);
      if (datasets.length === 0) return;

      const fg = datasets.map(async (dsId) => {
        await loadOne(dsId, dk, true);
        if (disposedRef.current) return;
        applyActive(stateOf(dsId), dsId, dk);
        runRef.current?.(timeStore.getTime());
      });
      await Promise.all(fg);
      if (disposedRef.current) return;
      if (timeStore.getDateKey() !== dk) void ensureForeground();
    };

    /**
     * Background prefetch 視窗其他日 + LRU 清舊
     * 串行（每次只一個 RPC）+ debounce，避免 rangeDays=7 × 2 dataset 同時打 14 個 RPC 把 Supabase 撐死
     */
    let prefetchTimer: number | null = null;
    let prefetchSeq = 0;
    const PREFETCH_DEBOUNCE_MS = 600;
    const schedulePrefetch = () => {
      if (prefetchTimer !== null) window.clearTimeout(prefetchTimer);
      prefetchTimer = window.setTimeout(async () => {
        prefetchTimer = null;
        if (disposedRef.current) return;
        const mySeq = ++prefetchSeq;
        const dk = timeStore.getDateKey();
        const datasets: string[] = [];
        if (visRef.current.cloud) datasets.push(CLOUD_DATASET);
        if (visRef.current.radar) datasets.push(RADAR_DATASET);
        if (datasets.length === 0) return;
        const allKeys = timeStore.getWindowDateKeys();
        if (!allKeys.includes(dk)) allKeys.push(dk);
        // LRU evict 先做（保護視窗 + 當前日）
        const protect = new Set(allKeys);
        for (const dsId of datasets) {
          evictExcess(getCache(dsId), getOrder(dsId), Math.max(allKeys.length, 1), protect);
        }
        // 串行 prefetch — 一次一個 RPC（CWA payload 重，並發會撐死 pooler）
        for (const k of allKeys) {
          if (k === dk) continue; // 當前日由 foreground 處理
          for (const dsId of datasets) {
            if (disposedRef.current || mySeq !== prefetchSeq) return;
            await loadOne(dsId, k, false);
          }
        }
      }, PREFETCH_DEBOUNCE_MS);
    };

    void ensureForeground();
    schedulePrefetch();
    const unsubDate = timeStore.subscribeDate(() => { void ensureForeground(); schedulePrefetch(); });
    const unsubWindow = timeStore.subscribeWindowDateKeys(() => schedulePrefetch());
    return () => {
      if (prefetchTimer !== null) window.clearTimeout(prefetchTimer);
      unsubDate();
      unsubWindow();
    };
  }, [cloudVisible, radarVisible]);

  // ── Layer 生命週期 + frame 切換 ──
  // visibility / opacity 變動 → reconcile；時間變動由 timeStore 訂閱觸發 reconcile
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reconcile = (
      state: LayerState,
      dsId: string,
      visible: boolean,
      opacity: number,
      sourceId: string,
      layerId: string,
      currentTimeSec: number,
    ) => {
      if (!visible) {
        // 軟隱藏：保留 handle + cache + activeDateKey，再開啟只要 setVisible(true)
        // (map.removeLayer/removeSource 在 in-flight 期間有時不生效，setVisible 較穩)
        state.handle?.setVisible(false);
        return;
      }
      const dsCache = cacheRef.current.get(dsId);
      const slot = state.activeDateKey ? dsCache?.get(state.activeDateKey) : undefined;
      if (!slot || slot.bundle.frames.length === 0) {
        // 沒資料：handle 仍存在但隱藏（避免顯示空白）
        state.handle?.setVisible(false);
        return;
      }

      const frame = pickFrameForTime(slot.bundle.frames, currentTimeSec * 1000);
      if (!frame) { state.handle?.setVisible(false); return; }
      const url = slot.urls.get(frame.observedAtIso);
      if (!url) { state.handle?.setVisible(false); return; }

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
        state.handle.setVisible(true); // 從軟隱藏恢復
        if (state.currentIso !== frame.observedAtIso) {
          state.handle.setUrl(url);
          state.currentIso = frame.observedAtIso;
          keepLoadingUntilMapIdle(map, `cwa-render:${sourceId}`, `CWA 影像 渲染中`, null);
        }
        state.handle.setOpacity(opacity);
      }
    };

    const run = (currentTimeSec: number) => {
      reconcile(cloudRef.current, CLOUD_DATASET, cloudVisible, cloudOpacity, "cwa-cloud-src", "cwa-cloud-layer", currentTimeSec);
      reconcile(radarRef.current, RADAR_DATASET, radarVisible, radarOpacity, "cwa-radar-src", "cwa-radar-layer", currentTimeSec);
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

  // 注：原本獨立的 preloadDays effect 已不需要 — window 變動會由 subscribeWindowDateKeys
  // 觸發 ensureFresh，evict 邏輯在那裡執行（保護視窗內所有日）。

  // ── Unmount 清理 ──
  useEffect(() => {
    disposedRef.current = false; // StrictMode remount 重置
    return () => {
      disposedRef.current = true;
      for (const state of [cloudRef.current, radarRef.current]) {
        if (state.handle) {
          try { state.handle.remove(); } catch { /* map 可能已銷毀 */ }
          state.handle = null;
        }
      }
      // 全清 cache 內的 object URLs（避免洩漏）
      for (const cache of cacheRef.current.values()) {
        for (const slot of cache.values()) {
          for (const u of slot.urls.values()) URL.revokeObjectURL(u);
        }
      }
      cacheRef.current.clear();
      orderRef.current.clear();
      inflightRef.current.clear();
    };
  }, []);
}
