import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchLightningDay, invalidateLightningDay,
  toLightningFCAt,
  type LightningStrike,
} from "../data/lightningLoader";
import {
  fetchNuclearDay,
  buildNuclearFCAt,
  type NuclearDay,
} from "../data/nuclearLoader";
import { timeStore } from "../state/timeStore";
import { prefetchAroundDate } from "../lib/dayPrefetch";

/**
 * HAZARD（v2 Phase B++）— 落雷 + 核安，**day preload + scrub fade**
 *
 * 落雷：
 *   - subscribeDate → 跨日重抓整天 events（cachedByKey 10min TTL）
 *   - subscribeThrottled(200) + timeStore tick → 用 currentTs 過濾事件 + 算 alpha → setData
 *   - 視覺壽命 lifeSec 由 minutes slider 控制（slider 60 → 60 min 內事件可見）
 *   - 漸入 0.4s（閃光感）、漸出佔總壽命 40%
 *   - 60s 強制 invalidate 今日資料拿最新 events
 *
 * 核安：
 *   - subscribeDate → 整天 per-station points[]（內含前一天 24h backfill）
 *   - subscribeThrottled(2000) → binary search 每站最後 ≤ ts 一筆，
 *     依 age 算 alpha（>120 min 開始 fade、>240 min 不渲染）→ setData
 *   - 5min poll 重抓
 *
 * 樣式由 overlayRegistry 提供：circle-opacity 改吃 properties.alpha × slider。
 */

const SRC_LIGHTNING = "hazard-lightning";
const SRC_NUCLEAR = "hazard-nuclear";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const LIGHTNING_RELOAD_MS = 60_000;
const NUCLEAR_RELOAD_MS = 5 * 60_000;
const SCRUB_THROTTLE_LIGHTNING = 200;
const SCRUB_THROTTLE_NUCLEAR = 2000;

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
  /** slider 給的「視覺壽命 N min」— 每筆 strike 從擊發起持續 N 分鐘 */
  minutes: number,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const feed = useSourceFeed(mapRef, visible, SRC_LIGHTNING, fcRef);
  // 整天 events buffer，scrub / minutes 變動只在這份上 client-side filter
  const dayBufferRef = useRef<LightningStrike[]>([]);
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const recompute = (ts: number) => {
      const lifeSec = Math.max(60, minutesRef.current * 60);
      fcRef.current = toLightningFCAt(dayBufferRef.current, ts, lifeSec);
      feed();
    };

    const loadDay = (dateKey: string, alsoYesterday: boolean = true) => {
      const todayP = fetchLightningDay(dateKey);
      const yKey = alsoYesterday
        ? new Date(`${dateKey}T00:00:00+08:00`)
        : null;
      if (yKey) yKey.setDate(yKey.getDate() - 1);
      const yPromise = yKey
        ? fetchLightningDay(yKey.toISOString().slice(0, 10))
        : Promise.resolve<LightningStrike[]>([]);
      Promise.all([todayP, yPromise])
        .then(([today, yesterday]) => {
          if (cancelled) return;
          dayBufferRef.current = [...yesterday, ...today];
          recompute(timeStore.getTime());
        })
        .catch((err) => console.warn("[HAZARD/lightning] day load failed:", err));
    };

    const prefetchNeighbors = (dateKey: string) => {
      // 預載 ±days 進 fetchLightningDay 的 cache（cachedByKey 10min TTL 自動去重）
      prefetchAroundDate(dateKey, timeStore.getRangeDays(), fetchLightningDay, "[HAZARD/lightning]");
    };

    loadDay(timeStore.getDateKey());
    prefetchNeighbors(timeStore.getDateKey());

    const unsubDate = timeStore.subscribeDate((key) => { loadDay(key); prefetchNeighbors(key); });
    const unsubRange = timeStore.subscribeRangeDays(() => prefetchNeighbors(timeStore.getDateKey()));
    const unsubTime = timeStore.subscribeThrottled(SCRUB_THROTTLE_LIGHTNING, recompute);

    const id = window.setInterval(() => {
      invalidateLightningDay();
      loadDay(timeStore.getDateKey());
    }, LIGHTNING_RELOAD_MS);

    return () => {
      cancelled = true;
      unsubDate();
      unsubRange();
      unsubTime();
      window.clearInterval(id);
    };
  }, [visible, feed]);

  // minutes 變動立即重算（不靠 throttle）
  useEffect(() => {
    if (!visible) return;
    const lifeSec = Math.max(60, minutes * 60);
    fcRef.current = toLightningFCAt(dayBufferRef.current, timeStore.getTime(), lifeSec);
    feed();
  }, [minutes, visible, feed]);
}

export function useNuclearLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const feed = useSourceFeed(mapRef, visible, SRC_NUCLEAR, fcRef);
  const dayRef = useRef<NuclearDay | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const recompute = (ts: number) => {
      fcRef.current = buildNuclearFCAt(dayRef.current, ts);
      feed();
    };

    const loadDay = (dateKey: string) => {
      fetchNuclearDay(dateKey)
        .then((d) => {
          if (cancelled) return;
          dayRef.current = d;
          recompute(timeStore.getTime());
        })
        .catch((err) => console.warn("[HAZARD/nuclear] day load failed:", err));
    };

    const prefetchNeighbors = (dateKey: string) => {
      prefetchAroundDate(dateKey, timeStore.getRangeDays(), fetchNuclearDay, "[HAZARD/nuclear]");
    };

    loadDay(timeStore.getDateKey());
    prefetchNeighbors(timeStore.getDateKey());

    const unsubDate = timeStore.subscribeDate((key) => { loadDay(key); prefetchNeighbors(key); });
    const unsubRange = timeStore.subscribeRangeDays(() => prefetchNeighbors(timeStore.getDateKey()));
    const unsubTime = timeStore.subscribeThrottled(SCRUB_THROTTLE_NUCLEAR, recompute);

    const id = window.setInterval(() => {
      loadDay(timeStore.getDateKey());
    }, NUCLEAR_RELOAD_MS);

    return () => {
      cancelled = true;
      unsubDate();
      unsubRange();
      unsubTime();
      window.clearInterval(id);
    };
  }, [visible, feed]);
}
