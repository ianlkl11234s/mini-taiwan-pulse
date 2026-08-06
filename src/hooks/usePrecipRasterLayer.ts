import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { fetchPrecipRasterFrames, type PrecipRasterFrame } from "../data/precipRasterLoader";
import { createCwaImageryLayer, type CwaImageryLayerHandle } from "../map/cwaImageryLayer";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 累積雨量柵格 — Mapbox image source + raster layer
 *
 * Timeline 聯動（migration 160 起）：
 *  - 依 timeline 日期載入該日全部 frames
 *  - subscribeThrottled 依 currentTime 選「不晚於當前時間的最近一張」
 *  - 完全沒有更早的 frame 才隱藏。不設「過舊」門檻 — IoW 來源各產品
 *    更新頻率不規律（1h 產品約每小時、24h 產品約一天一張），設門檻會
 *    把 24h 產品永遠隱藏
 *  - subscribeDate 切日重載；今天每 60 分鐘 refresh 補新 frame
 */

const SOURCE_ID = "precip-raster";
const LAYER_ID = "precip-raster-layer";
const REFRESH_MS = 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** timeline 日期 → 載入時間窗。
 *  前推 48h margin：IoW 24h 產品約一天才一張，margin 太窄會讓當日前半天
 *  找不到「不晚於當前時間」的 frame（payload 很小，多抓幾張無妨） */
function windowForDate(dateKey: string): { sinceIso: string; untilIso: string } {
  if (dateKey === todayKey()) {
    return {
      sinceIso: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      untilIso: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }
  const start = new Date(`${dateKey}T00:00:00+08:00`).getTime();
  return {
    sinceIso: new Date(start - 48 * 3600 * 1000).toISOString(),
    untilIso: new Date(start + 24 * 3600 * 1000).toISOString(),
  };
}

export function usePrecipRasterLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  cumulativeHours: 1 | 3 | 6 | 24,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const handleRef = useRef<CwaImageryLayerHandle | null>(null);
  const framesRef = useRef<PrecipRasterFrame[]>([]);
  const currentIsoRef = useRef<string | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // opacity 即時生效，不重抓資料
  useEffect(() => {
    handleRef.current?.setOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    if (!visible) {
      handleRef.current?.setVisible(false);
      currentIsoRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let loadSeq = 0;
    let stylePollPending = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const revokeFrames = (frames: PrecipRasterFrame[]) => {
      for (const f of frames) URL.revokeObjectURL(f.url);
    };

    const draw = (frame: PrecipRasterFrame) => {
      if (!handleRef.current) {
        handleRef.current = createCwaImageryLayer(map, {
          sourceId: SOURCE_ID,
          layerId: LAYER_ID,
          bbox: {
            lonMin: frame.ulLng,
            lonMax: frame.brLng,
            latMin: frame.brLat,
            latMax: frame.ulLat,
          },
          initialUrl: frame.url,
          opacity: opacityRef.current,
        });
      } else if (currentIsoRef.current !== frame.observedAtIso) {
        handleRef.current.setUrl(frame.url);
      }
      handleRef.current.setOpacity(opacityRef.current);
      handleRef.current.setVisible(true);
      currentIsoRef.current = frame.observedAtIso;
    };

    /** 依 currentTime 選 frame；過舊或沒有 → 隱藏 */
    const pick = (tSec: number) => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) {
        if (!stylePollPending) {
          stylePollPending = true;
          setTimeout(() => {
            stylePollPending = false;
            pick(timeStore.getTime());
          }, 300);
        }
        return;
      }
      const tMs = tSec * 1000;
      let chosen: PrecipRasterFrame | null = null;
      for (const f of framesRef.current) {
        if (f.observedAtMs <= tMs) chosen = f;
        else break;
      }
      if (chosen) {
        draw(chosen);
      } else {
        handleRef.current?.setVisible(false);
        currentIsoRef.current = null;
      }
    };

    const load = async (dateKey: string) => {
      const seq = ++loadSeq;
      const { sinceIso, untilIso } = windowForDate(dateKey);
      try {
        const frames = await fetchPrecipRasterFrames(cumulativeHours, sinceIso, untilIso);
        if (cancelled || seq !== loadSeq) {
          revokeFrames(frames);
          return;
        }
        revokeFrames(framesRef.current);
        framesRef.current = frames;
        console.log(`[PrecipRaster] ${cumulativeHours}h @ ${dateKey}: ${frames.length} frames`);
        pick(timeStore.getTime());
      } catch (err) {
        console.warn("[PrecipRaster] fetch failed:", err);
      }
    };

    load(timeStore.getDateKey());
    const unsubDate = timeStore.subscribeDate((dk) => void load(dk));
    // frame 粒度 1h，60x 播放下 1 模擬小時 = 1 分鐘真實時間，5s 節流足夠
    const unsubTime = timeStore.subscribeThrottled(5000, pick);
    refreshTimer = setInterval(() => {
      // 即時模式：collector 每小時寫入，停在今天時定時補新 frame
      const dk = timeStore.getDateKey();
      if (dk === todayKey()) void load(dk);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      unsubDate();
      unsubTime();
      if (refreshTimer) clearInterval(refreshTimer);
      handleRef.current?.setVisible(false);
    };
  }, [mapRef, visible, cumulativeHours, mapTick]);

  // cleanup object URLs on full unmount
  useEffect(() => () => {
    for (const f of framesRef.current) URL.revokeObjectURL(f.url);
    framesRef.current = [];
  }, []);
}
