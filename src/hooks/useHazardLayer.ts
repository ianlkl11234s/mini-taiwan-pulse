import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchLightningRecent, invalidateLightning, toLightningFC,
} from "../data/lightningLoader";
import {
  fetchNuclearStatus, invalidateNuclear, toNuclearFC,
} from "../data/nuclearLoader";

/**
 * HAZARD（v2 Phase B）— 落雷 + 核安
 *
 * - 落雷：visible + minutes slider 變動時重抓；cache 60s（cron 1min 寫入）
 * - 核安：visible 時拉 + 5min poll（劑量值仍可能變化）
 *
 * 樣式由 overlayRegistry 提供；本檔只做 fetch → setData。
 */

const SRC_LIGHTNING = "hazard-lightning";
const SRC_NUCLEAR = "hazard-nuclear";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const LIGHTNING_POLL_MS = 60_000;
const NUCLEAR_POLL_MS = 5 * 60_000;

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
  minutes: number,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const feed = useSourceFeed(mapRef, visible, SRC_LIGHTNING, fcRef);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = () => {
      fetchLightningRecent(minutes)
        .then((rows) => {
          if (cancelled) return;
          fcRef.current = toLightningFC(rows);
          feed();
        })
        .catch((err) => console.warn("[HAZARD/lightning] load failed:", err));
    };
    load();
    const t = window.setInterval(() => {
      invalidateLightning();
      load();
    }, LIGHTNING_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [visible, minutes, feed]);
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
    const load = () => {
      fetchNuclearStatus()
        .then((rows) => {
          if (cancelled) return;
          fcRef.current = toNuclearFC(rows);
          feed();
        })
        .catch((err) => console.warn("[HAZARD/nuclear] load failed:", err));
    };
    load();
    const t = window.setInterval(() => {
      invalidateNuclear();
      load();
    }, NUCLEAR_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [visible, feed]);
}
