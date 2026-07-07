import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import {
  fetchGasStationLayers,
  fetchFossilFuelLockedLayers,
  GAS_STATION_FE_KEYS,
  FOSSIL_LOCKED_FE_KEYS,
  type FossilFuelLayers,
  type FossilLayerKey,
} from "../data/fossilFuelLoader";
import { isAccessDenied } from "../lib/layerGates";

/**
 * 化石燃料圖層資料供應 hook（拆兩條路徑，coordinator owner-gated 契約）：
 * - 加油站 5 層（公開）：get_gas_station_layers（staticRpc CDN 快照）
 * - 石化 9 層（owner-gated）：get_fossil_fuel_layers（直連 supabase.rpc）
 *
 * 各自「任一 visible 才 fetch」+ module-level 30 min cache；樣式在 overlayRegistry，本 hook 只 setData。
 * 非 owner：石化 9 key 的 toggle 被 App 端 gate no-op → 不觸發 locked fetch。
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

// ── 加油站 cache（公開）──
let gasCache: FossilFuelLayers | null = null;
let gasCachedAt = 0;
let gasInflight: Promise<FossilFuelLayers> | null = null;
function loadGas(): Promise<FossilFuelLayers> {
  const now = Date.now();
  if (gasCache && now - gasCachedAt < CACHE_TTL_MS) return Promise.resolve(gasCache);
  if (gasInflight) return gasInflight;
  gasInflight = fetchGasStationLayers()
    .then((d) => { gasCache = d; gasCachedAt = Date.now(); gasInflight = null; return d; })
    .catch((err) => { gasInflight = null; throw err; });
  return gasInflight;
}

// ── 石化 cache（owner-gated）──
let lockedCache: FossilFuelLayers | null = null;
let lockedCachedAt = 0;
let lockedInflight: Promise<FossilFuelLayers> | null = null;
function loadLocked(): Promise<FossilFuelLayers> {
  const now = Date.now();
  if (lockedCache && now - lockedCachedAt < CACHE_TTL_MS) return Promise.resolve(lockedCache);
  if (lockedInflight) return lockedInflight;
  lockedInflight = fetchFossilFuelLockedLayers()
    .then((d) => { lockedCache = d; lockedCachedAt = Date.now(); lockedInflight = null; return d; })
    .catch((err) => { lockedInflight = null; throw err; });
  return lockedInflight;
}

export interface UseFossilFuelLayersOpts {
  visibility: LayerVisibility;
  mapRef: React.RefObject<MapboxMap | null>;
}

export function useFossilFuelLayers({ mapRef, visibility }: UseFossilFuelLayersOpts) {
  const gasDataRef = useRef<FossilFuelLayers | null>(null);
  const lockedDataRef = useRef<FossilFuelLayers | null>(null);

  const feed = useCallback((keys: readonly FossilLayerKey[], data: FossilFuelLayers | null) => {
    const map = mapRef.current;
    if (!map) return;
    for (const k of keys) {
      const src = map.getSource(SRC_ID[k]) as GeoJSONSource | undefined;
      if (!src) continue;
      src.setData(data ? data[k] : EMPTY_FC);
    }
  }, [mapRef]);

  const feedAll = useCallback(() => {
    feed(GAS_STATION_FE_KEYS, gasDataRef.current);
    feed(FOSSIL_LOCKED_FE_KEYS, lockedDataRef.current);
  }, [feed]);

  const anyGasVisible = GAS_STATION_FE_KEYS.some((k) => visibility[k]);
  const anyLockedVisible = FOSSIL_LOCKED_FE_KEYS.some((k) => visibility[k]);

  // 加油站：任一 visible 才拉（公開）
  useEffect(() => {
    if (!anyGasVisible) return;
    let cancelled = false;
    loadGas()
      .then((d) => { if (cancelled) return; gasDataRef.current = d; feed(GAS_STATION_FE_KEYS, d); })
      .catch((err) => console.warn("[FossilFuel] gas load failed:", err));
    return () => { cancelled = true; };
  }, [anyGasVisible, feed]);

  // 石化：任一 visible 才拉（owner-gated）
  useEffect(() => {
    if (!anyLockedVisible) return;
    let cancelled = false;
    loadLocked()
      .then((d) => { if (cancelled) return; lockedDataRef.current = d; feed(FOSSIL_LOCKED_FE_KEYS, d); })
      .catch((err) => { if (!isAccessDenied(err)) console.warn("[FossilFuel] locked load failed:", err); });
    return () => { cancelled = true; };
  }, [anyLockedVisible, feed]);

  // map style.load 後重新餵
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!anyGasVisible && !anyLockedVisible)) return;
    const onStyleLoad = () => feedAll();
    map.on("style.load", onStyleLoad);
    feedAll();
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, anyGasVisible, anyLockedVisible, feedAll]);
}
