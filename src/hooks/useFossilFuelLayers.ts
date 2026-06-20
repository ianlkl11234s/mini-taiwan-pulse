import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import {
  fetchFossilFuelLayers,
  FOSSIL_LAYER_MAP,
  type FossilFuelLayers,
  type FossilLayerKey,
} from "../data/fossilFuelLoader";

/**
 * 化石燃料 13 圖層的資料供應 hook。
 *
 * 設計：
 * - 一次 RPC 拉全部（後端 86ms / ~7,730 rows），不分段拉
 * - 任一 visibility true 才觸發 fetch
 * - Fetched FC 用 module-level 變數 cache 30 min（重新 toggle on 不重打）
 * - 樣式（circle / line / fill）在 overlayRegistry 內定義，本 hook 只 setData
 */

/** sourceId 命名（與 overlayRegistry 對齊） */
const SRC_ID: Record<FossilLayerKey, string> = {
  gasStationCpc: "fossil-gas-station-cpc",
  gasStationFpcc: "fossil-gas-station-fpcc",
  gasStationTaisugar: "fossil-gas-station-taisugar",
  gasStationOther: "fossil-gas-station-other",
  gasStationCanonical: "fossil-gas-station-canonical",
  lpgSubpackaging: "fossil-lpg-subpackaging",
  lpgRetailers: "fossil-lpg-retailers",
  lngTerminal: "fossil-lng-terminal",
  pipelineGas: "fossil-pipeline-gas",
  pipelineOilGas: "fossil-pipeline-oilgas",
  industrialRefinery: "fossil-industrial-refinery",
  industrialStorageTank: "fossil-industrial-storage-tank",
  industrialPowerPlant: "fossil-industrial-power-plant",
  coalTerminal: "fossil-coal-terminal",
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const CACHE_TTL_MS = 30 * 60_000;

let cachedData: FossilFuelLayers | null = null;
let cachedAt = 0;
let inflight: Promise<FossilFuelLayers> | null = null;

function loadCached(): Promise<FossilFuelLayers> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return Promise.resolve(cachedData);
  }
  if (inflight) return inflight;
  inflight = fetchFossilFuelLayers()
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

export interface UseFossilFuelLayersOpts {
  visibility: LayerVisibility;
  mapRef: React.RefObject<MapboxMap | null>;
}

export function useFossilFuelLayers({ mapRef, visibility }: UseFossilFuelLayersOpts) {
  const dataRef = useRef<FossilFuelLayers | null>(null);
  const keys = Object.values(FOSSIL_LAYER_MAP) as FossilLayerKey[];

  // 把目前 data 餵進對應 source（visible 的）
  const feedAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const d = dataRef.current;
    for (const k of keys) {
      const src = map.getSource(SRC_ID[k]) as GeoJSONSource | undefined;
      if (!src) continue;
      src.setData(d ? d[k] : EMPTY_FC);
    }
  }, [mapRef, keys]);

  // 任一 visible 才 fetch
  const anyVisible = keys.some((k) => visibility[k]);

  useEffect(() => {
    if (!anyVisible) return;
    let cancelled = false;
    loadCached()
      .then((d) => {
        if (cancelled) return;
        dataRef.current = d;
        feedAll();
      })
      .catch((err) => console.warn("[FossilFuel] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [anyVisible, feedAll]);

  // map style.load 後重新餵
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyVisible) return;
    const onStyleLoad = () => feedAll();
    map.on("style.load", onStyleLoad);
    feedAll();
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, anyVisible, feedAll]);
}
