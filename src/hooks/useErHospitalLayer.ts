import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchErHospitalFC, invalidateErHospitalLatest } from "../data/erHospitalLoader";

/**
 * 急診壅塞 er_hospital 圖層 — 當下快照（比照核安 LIVE，不接 timeStore）。
 *
 * - visible 時載入 latest（RPC）+ 座標 join → setData 餵 er-hospital source
 * - 5min poll 重抓（invalidate latest cache）
 * - 樣式（circle-color by level / icu ring）由 overlayRegistry 提供
 */

const SRC = "er-hospital";
const RELOAD_MS = 5 * 60_000;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useErHospitalLayer(
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
      fetchErHospitalFC()
        .then((fc) => {
          if (cancelled) return;
          fcRef.current = fc;
          feed();
        })
        .catch((err) => console.warn("[erHospital] load failed:", err));
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const id = window.setInterval(() => {
      invalidateErHospitalLatest();
      load();
    }, RELOAD_MS);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      window.clearInterval(id);
    };
  }, [visible, feed, mapRef]);
}
