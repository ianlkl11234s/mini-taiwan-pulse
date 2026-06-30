import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchA1AccidentsRealtime } from "../data/a1AccidentRealtimeLoader";
import { wallClock } from "../state/timeStore";

const SRC_ID = "a1-accident-realtime";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const CACHE_TTL_MS = 10 * 60_000; // 10 min（資料每 12h 才更新）
const DEFAULT_DAYS = 30;
const REPAINT_INTERVAL_MS = 60_000; // 每 60s 重算 age + ripple phase

let cachedData: GeoJSON.FeatureCollection | null = null;
let cachedAt = 0;
let inflight: Promise<GeoJSON.FeatureCollection> | null = null;

function loadCached(): Promise<GeoJSON.FeatureCollection> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) return Promise.resolve(cachedData);
  if (inflight) return inflight;
  inflight = fetchA1AccidentsRealtime(DEFAULT_DAYS)
    .then((d) => {
      cachedData = d;
      cachedAt = Date.now();
      inflight = null;
      return d;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/**
 * 每個 feature 加 age_hours + ripple_phase（0~1，週期 3s）寫進 properties。
 * paint expression 讀這兩個值決定大小 / blur / opacity。
 */
function annotateAge(fc: GeoJSON.FeatureCollection, nowSec: number): GeoJSON.FeatureCollection {
  const ripplePhase = ((Date.now() % 3000) / 3000); // 0~1 週期 3s
  const features = fc.features.map((f) => {
    const ts = Number((f.properties as Record<string, unknown>)?.occurred_ts ?? 0);
    const ageHours = ts > 0 ? (nowSec - ts) / 3600 : 999999;
    return {
      ...f,
      properties: {
        ...(f.properties ?? {}),
        age_hours: ageHours,
        ripple_phase: ripplePhase,
      },
    };
  });
  return { type: "FeatureCollection", features };
}

export function useA1AccidentRealtimeLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SRC_ID) as GeoJSONSource | undefined;
    if (!src) return;
    const fc = dataRef.current;
    if (!fc) { src.setData(EMPTY_FC); return; }
    const nowSec = Math.floor(Date.now() / 1000);
    src.setData(annotateAge(fc, nowSec));
  }, [mapRef]);

  // 拉資料
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadCached()
      .then((d) => {
        if (cancelled) return;
        dataRef.current = d;
        feed();
      })
      .catch((err) => console.warn("[A1Realtime] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [visible, feed]);

  // 60s 重算 age（讓「當天 → 一週 → 30 天」分桶隨時間滾動）
  useEffect(() => {
    if (!visible) return;
    return wallClock.subscribeWallClock(REPAINT_INTERVAL_MS, () => feed());
  }, [visible, feed]);

  // map style.load 後重餵
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
}
