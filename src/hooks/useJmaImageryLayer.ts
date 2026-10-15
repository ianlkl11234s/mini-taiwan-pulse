/**
 * useJmaImageryLayer — JMA 發布幀（LA 值編碼 PNG）作為 time-axis raster 圖層播放；以 product 參數化。
 *
 * - manifest：一次 RPC 取整個 timeline 視窗（只有 metadata，積雪每日 24 列），切日／改視窗重取；
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
import { JMA_IMAGERY_ATTRIBUTION, jmaImageryProduct, jmaImageryRasterPaint, type JmaImageryProductId } from "../data/jmaTypes";
import { createJmaImageryLayer, type JmaImageryLayerHandle } from "../map/jmaImageryLayer";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { isHistoryMode } from "./useTimeStoreTime";
import { useMapReadyTick } from "./useMapReadyTick";

const LIVE_REFRESH_MS = 5 * 60_000;
const PREFETCH_AHEAD = 2;

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
    let seq = 0;

    const load = async (force: boolean) => {
      const keys = timeStore.getWindowDateKeys();
      const today = timeStore.getDateKey();
      if (!keys.includes(today)) keys.push(today);
      const win = jmaImageryWindowFor(keys, spec, Date.now());
      const key = `${win.sinceIso}|${win.untilIso}`;
      if (!force && key === loadedKey) return;
      const mySeq = ++seq;
      if (framesRef.current == null) setJmaImageryStatus(product, { state: "loading", validTimeIso: null });
      try {
        const result = await loadJmaImageryManifest([product], win);
        if (disposed || mySeq !== seq) return;
        framesRef.current = result.get(product) ?? [];
        loadedKey = key;
        runRef.current?.(timeStore.getTime());
      } catch (err) {
        if (disposed || mySeq !== seq) return;
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
      const bbox = { lonMin: f.lonMin!, lonMax: f.lonMax!, latMin: f.latMin!, latMax: f.latMax! };
      if (!handleRef.current) {
        handleRef.current = createJmaImageryLayer(map, {
          sourceId, layerId, url, bbox, opacity: opacityRef.current,
          paint: (op) => jmaImageryRasterPaint(spec, op),
          attribution: JMA_IMAGERY_ATTRIBUTION,
        });
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, `jma-imagery-render:${product}`, `JMA 影像 渲染中`, null);
      } else {
        handleRef.current.ensure();
        if (currentUrlRef.current !== url) {
          handleRef.current.setFrame(url, bbox);
          currentUrlRef.current = url;
          keepLoadingUntilMapIdle(map, `jma-imagery-render:${product}`, `JMA 影像 渲染中`, null);
        }
        handleRef.current.setVisible(true);
        handleRef.current.setOpacity(opacityRef.current);
      }
      setJmaImageryStatus(product, { state: "shown", validTimeIso: f.validTimeIso });
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

    safeRun(timeStore.getTime());
    const unsubTime = visible ? timeStore.subscribeThrottled(1000, safeRun) : null;
    map.on("style.load", onStyleLoad);
    return () => {
      disposed = true;
      unsubTime?.();
      map.off("style.load", onStyleLoad);
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
