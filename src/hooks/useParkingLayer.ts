import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchParkingSegmentsFC, invalidateParkingSegments,
  fetchParkingLotsFC, invalidateParkingLots,
} from "../data/parkingLoader";

/**
 * 停車 parking 圖層 — 當下快照（比照急診 er_hospital LIVE，不接 timeStore）。
 *
 * 路邊 (parking-onstreet) + 場外 (parking-offstreet) 兩個 dynamicData source，
 * 各自 visible 時載入 + 5min poll 重抓。樣式由 overlayRegistry 提供
 * （路邊：fill 台北中性 polygon + circle 新北台中點；場外：circle 空位率點）。
 */

const RELOAD_MS = 5 * 60_000;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function useSnapshotSource(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  sourceId: string,
  fetchFC: () => Promise<GeoJSON.FeatureCollection>,
  invalidate: () => void,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
  }, [mapRef, sourceId]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = () => {
      fetchFC()
        .then((fc) => {
          if (cancelled) return;
          fcRef.current = fc;
          feed();
        })
        .catch((err) => console.warn(`[parking] load ${sourceId} failed:`, err));
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const id = window.setInterval(() => {
      invalidate();
      load();
    }, RELOAD_MS);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      window.clearInterval(id);
    };
  }, [visible, feed, mapRef, sourceId, fetchFC, invalidate]);
}

export function useParkingLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  onstreetVisible: boolean,
  offstreetVisible: boolean,
) {
  useSnapshotSource(mapRef, onstreetVisible, "parking-onstreet", fetchParkingSegmentsFC, invalidateParkingSegments);
  useSnapshotSource(mapRef, offstreetVisible, "parking-offstreet", fetchParkingLotsFC, invalidateParkingLots);
}
