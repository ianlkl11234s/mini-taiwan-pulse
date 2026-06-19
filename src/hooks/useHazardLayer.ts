import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchLightningWindow, invalidateLightningWindow,
  toLightningFC,
} from "../data/lightningLoader";
import {
  fetchNuclearAt, invalidateNuclearAt, toNuclearFC,
} from "../data/nuclearLoader";
import { timeStore } from "../state/timeStore";

/**
 * HAZARD（v2 Phase B+）— 落雷 + 核安，**接 timeline**
 *
 * 落雷：以 timeStore 當前時間為中心，抓 ±halfMin 分鐘窗
 *   - timeStore.subscribeThrottled(1000) → scrub 即時更新
 *   - 量化 ts (60s) + cachedByKey 自動 dedup
 *   - LIVE 模式 timeStore.getTime() ≈ now，未來半邊自然空 → 視覺等同「過去 halfMin」
 *   - 額外 60s poll：抓最新資料 + LIVE 視窗滾動
 *
 * 核安：以 timeStore 當前時間為 target，抓每站最後一筆 measurement ≤ target
 *   - timeStore.subscribeThrottled(5000) → scrub 更新（劑量變化慢、不需高頻）
 *   - 量化 ts (300s) + cachedByKey 自動 dedup
 *   - 額外 5min poll
 *
 * 樣式由 overlayRegistry 提供；本檔只做 fetch → setData。
 */

const SRC_LIGHTNING = "hazard-lightning";
const SRC_NUCLEAR = "hazard-nuclear";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const LIGHTNING_POLL_MS = 60_000;
const NUCLEAR_POLL_MS = 5 * 60_000;
const LIGHTNING_SCRUB_THROTTLE = 1000;
const NUCLEAR_SCRUB_THROTTLE = 5000;

function useSourceFeed(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  sourceId: string,
  fcRef: React.MutableRefObject<GeoJSON.FeatureCollection | null>,
) {
  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
  }, [mapRef, sourceId, fcRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const onStyleLoad = () => feed();
    map.on("style.load", onStyleLoad);
    feed();
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, visible, feed]);

  return feed;
}

export function useLightningLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  /** slider 給的「視窗總大小 min」— hook 內 ÷2 當 half radius */
  minutes: number,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const feed = useSourceFeed(mapRef, visible, SRC_LIGHTNING, fcRef);
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = (centerTs: number) => {
      const half = Math.max(1, Math.round(minutesRef.current / 2));
      fetchLightningWindow(centerTs, half)
        .then((rows) => {
          if (cancelled) return;
          fcRef.current = toLightningFC(rows);
          feed();
        })
        .catch((err) => console.warn("[HAZARD/lightning] load failed:", err));
    };

    load(timeStore.getTime());

    const unsubTime = timeStore.subscribeThrottled(LIGHTNING_SCRUB_THROTTLE, (t) => {
      load(t);
    });

    const id = window.setInterval(() => {
      invalidateLightningWindow();
      load(timeStore.getTime());
    }, LIGHTNING_POLL_MS);

    return () => {
      cancelled = true;
      unsubTime();
      window.clearInterval(id);
    };
  }, [visible, feed]);

  // minutes slider 變動立刻重抓
  useEffect(() => {
    if (!visible) return;
    const half = Math.max(1, Math.round(minutes / 2));
    fetchLightningWindow(timeStore.getTime(), half)
      .then((rows) => {
        fcRef.current = toLightningFC(rows);
        feed();
      })
      .catch((err) => console.warn("[HAZARD/lightning] minutes change reload:", err));
  }, [minutes, visible, feed]);
}

export function useNuclearLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const feed = useSourceFeed(mapRef, visible, SRC_NUCLEAR, fcRef);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = (targetTs: number) => {
      fetchNuclearAt(targetTs)
        .then((rows) => {
          if (cancelled) return;
          fcRef.current = toNuclearFC(rows);
          feed();
        })
        .catch((err) => console.warn("[HAZARD/nuclear] load failed:", err));
    };

    load(timeStore.getTime());

    const unsubTime = timeStore.subscribeThrottled(NUCLEAR_SCRUB_THROTTLE, (t) => {
      load(t);
    });

    const id = window.setInterval(() => {
      invalidateNuclearAt();
      load(timeStore.getTime());
    }, NUCLEAR_POLL_MS);

    return () => {
      cancelled = true;
      unsubTime();
      window.clearInterval(id);
    };
  }, [visible, feed]);
}
