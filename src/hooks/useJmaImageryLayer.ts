/**
 * useJmaImageryLayer — JMA 發布幀（LA 值編碼 PNG）作為 time-axis raster 圖層播放；以 product 參數化。
 *
 * - manifest：取整個 timeline 視窗（只有 metadata；依發布頻率分塊避開 PostgREST max-rows，雷達每日 288 列），切日／改視窗重取；
 *   即時模式每 5 分鐘重取，跟上最新一幀。
 * - 選幀：pickJmaImageryFrame（回放 = 最晚的 ≤ t 且不過舊；即時 = 最新一幀且不過舊）。
 *   沒有可用幀 → 隱藏圖層＋狀態 uncovered（圖例顯示「未涵蓋」），不畫成 0。
 * - 顏色：raster-color（jmaImageryRasterPaint，SSOT = data/jmaTypes.ts）。
 * - 時間不進 deps：timeStore.subscribeThrottled(1000) 驅動（development-rules §8）。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  getJmaImageryStatus,
  jmaImageryCdnBase,
  jmaImageryWindowFor,
  loadJmaImageryManifest,
  pickJmaImageryFrame,
  setJmaImageryStatus,
  type JmaImageryFrame,
} from "../data/jmaImageryLoader";
import { jmaImageryProduct, jmaImageryRasterPaint, type JmaImageryProductId } from "../data/jmaTypes";
import { createJmaImageryLayer, type JmaImageryLayerHandle } from "../map/jmaImageryLayer";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { isHistoryMode } from "./useTimeStoreTime";
import { useMapReadyTick } from "./useMapReadyTick";

const LIVE_REFRESH_MS = 5 * 60_000;
const PREFETCH_AHEAD = 2;
/** 影像載入失敗後，同一張幀至少隔這麼久才重試 */
const IMAGE_RETRY_MS = 30_000;

interface UseJmaImageryLayerOptions {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  opacity: number;
  product: JmaImageryProductId;
}

export function useJmaImageryLayer({ mapRef, visible, opacity, product }: UseJmaImageryLayerOptions) {
  const mapTick = useMapReadyTick(mapRef);
  const sourceId = `jma-imagery-${product}-src`;
  const layerId = `jma-imagery-${product}-layer`;

  const framesRef = useRef<JmaImageryFrame[] | null>(null);
  const handleRef = useRef<JmaImageryLayerHandle | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const runRef = useRef<((t: number) => void) | null>(null);
  const visRef = useRef(visible);
  visRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const prefetchedRef = useRef<Set<string>>(new Set());
  /** 已套用但影像尚未載入完成的幀：載入完成後才回報 shown */
  const pendingShownRef = useRef<JmaImageryFrame | null>(null);
  /** 影像載入失敗的 url 與時間：短時間內不重試同一張，避免每秒重打 */
  const failedRef = useRef<{ url: string; at: number } | null>(null);

  // ── manifest 載入 ──
  useEffect(() => {
    if (!visible) return;
    const spec = jmaImageryProduct(product);
    if (!jmaImageryCdnBase()) {
      setJmaImageryStatus(product, { state: "error", validTimeIso: null, message: "VITE_IMAGERY_CDN_BASE 未設定" });
      return;
    }
    let disposed = false;
    let loadedKey: string | null = null;
    /** 已送出、尚未回應的視窗 key：subscribeDate／subscribeWindowDateKeys 同時觸發時不重複打 manifest RPC */
    let inflightKey: string | null = null;
    let seq = 0;

    const load = async (force: boolean) => {
      const keys = timeStore.getWindowDateKeys();
      const today = timeStore.getDateKey();
      if (!keys.includes(today)) keys.push(today);
      const win = jmaImageryWindowFor(keys, spec, Date.now());
      const key = `${win.sinceIso}|${win.untilIso}`;
      if (!force && (key === loadedKey || key === inflightKey)) return;
      const mySeq = ++seq;
      inflightKey = key;
      if (framesRef.current == null) setJmaImageryStatus(product, { state: "loading", validTimeIso: null });
      try {
        const result = await loadJmaImageryManifest([product], win, spec.cadenceMin);
        if (disposed || mySeq !== seq) return;
        framesRef.current = result.get(product) ?? [];
        loadedKey = key;
        inflightKey = null;
        runRef.current?.(timeStore.getTime());
      } catch (err) {
        if (disposed || mySeq !== seq) return;
        inflightKey = null;
        console.warn(`[JMA Imagery] manifest load failed ${product}`, err);
        setJmaImageryStatus(product, { state: "error", validTimeIso: null, message: err instanceof Error ? err.message : String(err) });
      }
    };

    void load(false);
    const unsubDate = timeStore.subscribeDate(() => void load(false));
    const unsubWindow = timeStore.subscribeWindowDateKeys(() => void load(false));
    const timer = window.setInterval(() => {
      if (!isHistoryMode(timeStore.getTime())) void load(true);
    }, LIVE_REFRESH_MS);
    return () => {
      disposed = true;
      unsubDate();
      unsubWindow();
      window.clearInterval(timer);
    };
  }, [visible, product]);

  // ── layer 生命週期＋選幀 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const spec = jmaImageryProduct(product);

    const hide = () => { try { handleRef.current?.setVisible(false); } catch { /* style 轉換中 */ } };

    const run = (tSec: number) => {
      if (!(visible && visRef.current)) {
        hide();
        setJmaImageryStatus(product, { state: "idle", validTimeIso: null });
        return;
      }
      const frames = framesRef.current;
      if (frames == null) {
        hide();
        if (getJmaImageryStatus(product).state !== "error") setJmaImageryStatus(product, { state: "loading", validTimeIso: null });
        return;
      }
      const live = !isHistoryMode(tSec);
      const pick = pickJmaImageryFrame(frames, live ? Date.now() : tSec * 1000, spec, live);
      if (pick.kind === "uncovered") {
        hide();
        setJmaImageryStatus(product, { state: "uncovered", validTimeIso: pick.frame?.validTimeIso ?? null, reason: pick.reason });
        return;
      }
      const f = pick.frame;
      const url = f.url!;
      const failed = failedRef.current;
      if (failed && failed.url === url && Date.now() - failed.at < IMAGE_RETRY_MS) return; // 保留 error 狀態，稍後再試
      const bbox = { lonMin: f.lonMin!, lonMax: f.lonMax!, latMin: f.latMin!, latMax: f.latMax! };
      if (!handleRef.current) {
        handleRef.current = createJmaImageryLayer(map, {
          sourceId, layerId, url, bbox, opacity: opacityRef.current,
          // image source 規格沒有 attribution 欄（加了會驗證失敗、source 加不上）→ 出典只放圖例
          paint: (op) => jmaImageryRasterPaint(spec, op),
        });
        currentUrlRef.current = url;
        pendingShownRef.current = f;
        keepLoadingUntilMapIdle(map, `jma-imagery-render:${product}`, `JMA 影像 渲染中`, null);
      } else {
        handleRef.current.ensure();
        if (currentUrlRef.current !== url) {
          handleRef.current.setFrame(url, bbox);
          currentUrlRef.current = url;
          pendingShownRef.current = f;
          keepLoadingUntilMapIdle(map, `jma-imagery-render:${product}`, `JMA 影像 渲染中`, null);
        }
        handleRef.current.setVisible(true);
        handleRef.current.setOpacity(opacityRef.current);
      }
      if (pendingShownRef.current) {
        // 影像還在載入：先維持 loading，等 sourcedata／idle 才回報 shown（失敗則走 error 事件）
        setJmaImageryStatus(product, { state: "loading", validTimeIso: null });
      } else {
        setJmaImageryStatus(product, { state: "shown", validTimeIso: f.validTimeIso, frameStatus: f.status });
      }
      // 預抓後續幾幀（CDN immutable，播放時不閃）
      const idx = frames.indexOf(f);
      for (const next of frames.slice(idx + 1, idx + 1 + PREFETCH_AHEAD)) {
        if (next.url && !prefetchedRef.current.has(next.url)) {
          prefetchedRef.current.add(next.url);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = next.url;
        }
      }
    };
    runRef.current = run;

    let disposed = false;
    let retryPending = false;
    const retry = () => { retryPending = false; if (!disposed) safeRun(timeStore.getTime()); };
    const safeRun = (t: number) => {
      try { run(t); } catch {
        if (!disposed && !retryPending) { retryPending = true; map.once("idle", retry); }
      }
    };
    const onStyleLoad = () => safeRun(timeStore.getTime());
    const confirmShown = () => {
      const f = pendingShownRef.current;
      if (!f || disposed) return;
      pendingShownRef.current = null;
      setJmaImageryStatus(product, { state: "shown", validTimeIso: f.validTimeIso, frameStatus: f.status });
    };
    const onSourceData = (e: { sourceId?: string }) => {
      if (e.sourceId !== sourceId || !pendingShownRef.current) return;
      try { if (map.isSourceLoaded(sourceId)) confirmShown(); } catch { /* style 轉換中 */ }
    };
    const onMapError = (e: { sourceId?: string; error?: Error }) => {
      if (e.sourceId !== sourceId) return;
      const url = currentUrlRef.current;
      if (url) failedRef.current = { url, at: Date.now() };
      currentUrlRef.current = null; // 清掉 → 重試時會重新 setFrame
      pendingShownRef.current = null;
      setJmaImageryStatus(product, { state: "error", validTimeIso: null, message: e.error?.message ?? "影像載入失敗" });
    };
    // 保底：萬一 sourcedata 沒觸發，idle 時仍回報 shown
    const onIdle = () => { if (pendingShownRef.current && failedRef.current?.url !== currentUrlRef.current) confirmShown(); };
    map.on("sourcedata", onSourceData);
    map.on("error", onMapError);
    map.on("idle", onIdle);

    safeRun(timeStore.getTime());
    const unsubTime = visible ? timeStore.subscribeThrottled(1000, safeRun) : null;
    map.on("style.load", onStyleLoad);
    return () => {
      disposed = true;
      unsubTime?.();
      map.off("style.load", onStyleLoad);
      map.off("sourcedata", onSourceData);
      map.off("error", onMapError);
      map.off("idle", onIdle);
      if (retryPending) map.off("idle", retry);
      if (runRef.current === run) runRef.current = null;
    };
  }, [mapRef, visible, product, sourceId, layerId, mapTick]);

  // 透明度：隱藏中不寫 paint（hidden raster 寫 paint 會讓 transition 長期為真而持續重繪）
  useEffect(() => {
    if (!visible) return;
    try { handleRef.current?.setOpacity(opacity); } catch { /* 下次 run 補上 */ }
  }, [opacity, visible, mapTick]);

  // ── unmount ──
  useEffect(() => () => {
    if (handleRef.current) {
      try { handleRef.current.remove(); } catch { /* map 可能已銷毀 */ }
      handleRef.current = null;
    }
    currentUrlRef.current = null;
    setJmaImageryStatus(product, { state: "idle", validTimeIso: null });
  }, [product]);
}
