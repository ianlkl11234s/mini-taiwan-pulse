import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchLibrarySeatsFC, invalidateLibrarySeatsCurrent } from "../data/librarySeatsLoader";

/**
 * 北市圖即時座位 librarySeats 圖層 — 當下快照（比照 er-hospital，不接 timeStore）。
 *
 * - visible 時載入 current（RPC）+ branch 聚合 → setData 餵 library-seats source
 * - 5min poll 重抓（資料 10min 更新；invalidate current cache）
 * - 樣式（circle-color by free_ratio / 休館灰）由 overlayRegistry 提供
 */

const SRC = "library-seats";
const RELOAD_MS = 5 * 60_000;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useLibrarySeatsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
  }, [mapRef]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = () => {
      fetchLibrarySeatsFC()
        .then((fc) => {
          if (cancelled) return;
          fcRef.current = fc;
          feed();
        })
        .catch((err) => console.warn("[librarySeats] load failed:", err));
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const id = window.setInterval(() => {
      invalidateLibrarySeatsCurrent();
      load();
    }, RELOAD_MS);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      window.clearInterval(id);
    };
  }, [visible, feed, mapRef]);
}
