import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import { fetchCoverageLayer, type CoverageKey } from "../data/coverageLoader";

/**
 * 雲林 POC 覆蓋分析 5 圖層的資料供應 hook。
 *
 * 設計：每個 key 各自 lazy fetch（visible 才打）、各自 cache、
 * 樣式（fill / line）寫在 overlayRegistry，本 hook 只 setData。
 */

const SRC_ID: Record<CoverageKey, string> = {
  gasCoverageAll: "coverage-gas-all",
  gasCoverageCpc: "coverage-gas-cpc",
  gasCoverageFpcc: "coverage-gas-fpcc",
  gasCoverageTaisugar: "coverage-gas-taisugar",
  evIsland: "coverage-ev-island",
};

const KEYS: CoverageKey[] = [
  "gasCoverageAll", "gasCoverageCpc", "gasCoverageFpcc", "gasCoverageTaisugar", "evIsland",
];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface UseCoverageLayersOpts {
  visibility: LayerVisibility;
  mapRef: React.RefObject<MapboxMap | null>;
}

export function useCoverageLayers({ mapRef, visibility }: UseCoverageLayersOpts) {
  const dataRef = useRef<Partial<Record<CoverageKey, GeoJSON.FeatureCollection>>>({});

  const feedOne = useCallback((key: CoverageKey) => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SRC_ID[key]) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(dataRef.current[key] ?? EMPTY_FC);
  }, [mapRef]);

  // 各 key 各自 effect — visible 才 fetch
  useEffect(() => {
    let cancelled = false;
    for (const key of KEYS) {
      if (!visibility[key]) continue;
      if (dataRef.current[key]) {
        feedOne(key);
        continue;
      }
      fetchCoverageLayer(key).then((fc) => {
        if (cancelled) return;
        dataRef.current[key] = fc;
        feedOne(key);
      }).catch((err) => console.warn(`[Coverage] ${key} fetch failed:`, err));
    }
    return () => { cancelled = true; };
  }, [
    visibility.gasCoverageAll, visibility.gasCoverageCpc, visibility.gasCoverageFpcc,
    visibility.gasCoverageTaisugar, visibility.evIsland,
    feedOne,
    visibility,
  ]);

  // style.load 後重餵
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onStyleLoad = () => {
      for (const key of KEYS) {
        if (visibility[key] && dataRef.current[key]) feedOne(key);
      }
    };
    map.on("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, visibility, feedOne]);
}
