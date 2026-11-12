import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import { fetchLivestockFarms, fetchLivestockSlaughterhouses } from "../data/livestockLoader";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { ownerDataStatus } from "../lib/ownerData";

/**
 * 畜牧 owner-only 動態圖層資料供應 hook（見 docs/features/owner-gated-layers；資料走 owner-data 私人檔）。
 *
 * overlayRegistry 已把 7 個飼養場 layer（共用 sourceId "livestock-farms"）+ 屠宰場
 * （"livestock-slaughter"）改為 dynamicData（空 FC 起手）；本 hook 只負責 fetch + setData。
 * 樣式 / filter / popup / legend 全在 overlayRegistry / featureInfo 既有路徑，維持不變。
 *
 * 設計比照 useFossilFuelLayers：
 * - 任一飼養場 layer visible 才拉 farms；livestockSlaughter visible 才拉屠宰場
 * - module-level cache 30 min（重新 toggle on 不重打）
 * - map style.load 後重新餵（切底圖 source 會被重建為空 FC）
 * - 非 owner：這些 key 的 toggle 被 App 端 gate no-op → visibility 恆 false → 不觸發 fetch
 */

const SRC_FARMS = "livestock-farms";
const SRC_SLAUGHTER = "livestock-slaughter";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const CACHE_TTL_MS = 30 * 60_000;

const FARM_KEYS: (keyof LayerVisibility)[] = [
  "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck",
  "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther",
];

// ── module-level cache（fossilFuel 同款）──
let farmsCache: GeoJSON.FeatureCollection | null = null;
let farmsCachedAt = 0;
let farmsInflight: Promise<GeoJSON.FeatureCollection> | null = null;
let slaughterCache: GeoJSON.FeatureCollection | null = null;
let slaughterCachedAt = 0;
let slaughterInflight: Promise<GeoJSON.FeatureCollection> | null = null;

/** 撤權時遞增（飼養場／屠宰場各自一個）：撤權前發出、撤權後才回來的請求不得寫回 cache */
let farmsGeneration = 0;
let slaughterGeneration = 0;

/** 撤權（登出／失去站主權限，review F088）：清 module cache；可只清其中一個資料集（review F004） */
export function clearLivestockCache(which: { farms?: boolean; slaughter?: boolean } = { farms: true, slaughter: true }): void {
  if (which.farms) {
    farmsGeneration += 1;
    farmsCache = null; farmsCachedAt = 0; farmsInflight = null;
  }
  if (which.slaughter) {
    slaughterGeneration += 1;
    slaughterCache = null; slaughterCachedAt = 0; slaughterInflight = null;
  }
}

function loadCached(
  getCache: () => GeoJSON.FeatureCollection | null,
  getAt: () => number,
  getInflight: () => Promise<GeoJSON.FeatureCollection> | null,
  setCache: (d: GeoJSON.FeatureCollection) => void,
  setInflight: (p: Promise<GeoJSON.FeatureCollection> | null) => void,
  fetcher: () => Promise<GeoJSON.FeatureCollection>,
  getGeneration: () => number,
): Promise<GeoJSON.FeatureCollection> {
  const now = Date.now();
  const cached = getCache();
  if (cached && now - getAt() < CACHE_TTL_MS) return Promise.resolve(cached);
  const inflight = getInflight();
  if (inflight) return inflight;
  const gen = getGeneration();
  const p = fetcher()
    .then((d) => {
      if (gen !== getGeneration()) throw new Error("[Livestock] access revoked");
      setCache(d);
      setInflight(null);
      return d;
    })
    .catch((err) => {
      if (gen === getGeneration()) setInflight(null);
      throw err;
    });
  setInflight(p);
  return p;
}

const loadFarms = () =>
  loadCached(
    () => farmsCache, () => farmsCachedAt, () => farmsInflight,
    (d) => { farmsCache = d; farmsCachedAt = Date.now(); },
    (p) => { farmsInflight = p; },
    fetchLivestockFarms,
    () => farmsGeneration,
  );
const loadSlaughter = () =>
  loadCached(
    () => slaughterCache, () => slaughterCachedAt, () => slaughterInflight,
    (d) => { slaughterCache = d; slaughterCachedAt = Date.now(); },
    (p) => { slaughterInflight = p; },
    fetchLivestockSlaughterhouses,
    () => slaughterGeneration,
  );

export interface UseLivestockLayersOpts {
  mapRef: React.RefObject<MapboxMap | null>;
  visibility: LayerVisibility;
}

export function useLivestockLayers({ mapRef, visibility }: UseLivestockLayersOpts) {
  const farmsDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const slaughterDataRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;
  // 撤權後仍授權且開著的飼養場 layer（7 個共用同一份資料）要重抓：遞增觸發 farms effect
  const [farmsReloadTick, setFarmsReloadTick] = useState(0);

  // 只清被撤權的資料集（review F004；POLICIES G3）
  useEffect(() => registerOwnerGateReset([...FARM_KEYS, "livestockSlaughter"], (revoked) => {
    const farmsRevoked = FARM_KEYS.some((k) => revoked.has(k));
    const slaughterRevoked = revoked.has("livestockSlaughter");
    clearLivestockCache({ farms: farmsRevoked, slaughter: slaughterRevoked });
    if (farmsRevoked) {
      ownerDataStatus.reset("livestock-farms");
      farmsDataRef.current = null;
      if (FARM_KEYS.some((k) => !revoked.has(k) && visibilityRef.current[k])) setFarmsReloadTick((n) => n + 1);
    }
    if (slaughterRevoked) {
      ownerDataStatus.reset("livestock-slaughterhouses");
      slaughterDataRef.current = null;
    }
  }), []);

  const anyFarmVisible = FARM_KEYS.some((k) => visibility[k]);
  const slaughterVisible = visibility.livestockSlaughter;

  const feedAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const farmsSrc = map.getSource(SRC_FARMS) as GeoJSONSource | undefined;
    if (farmsSrc) farmsSrc.setData(farmsDataRef.current ?? EMPTY_FC);
    const slaughterSrc = map.getSource(SRC_SLAUGHTER) as GeoJSONSource | undefined;
    if (slaughterSrc) slaughterSrc.setData(slaughterDataRef.current ?? EMPTY_FC);
  }, [mapRef]);

  // farms：任一飼養場 layer visible 才拉
  useEffect(() => {
    if (!anyFarmVisible) return;
    let cancelled = false;
    loadFarms()
      .then((d) => { if (cancelled) return; farmsDataRef.current = d; feedAll(); })
      .catch((err) => { if (!cancelled && !isAccessDenied(err)) console.warn("[Livestock] farms load failed:", err); });
    return () => { cancelled = true; };
  }, [anyFarmVisible, feedAll, farmsReloadTick]);

  // slaughterhouses：livestockSlaughter visible 才拉
  useEffect(() => {
    if (!slaughterVisible) return;
    let cancelled = false;
    loadSlaughter()
      .then((d) => { if (cancelled) return; slaughterDataRef.current = d; feedAll(); })
      .catch((err) => { if (!cancelled && !isAccessDenied(err)) console.warn("[Livestock] slaughter load failed:", err); });
    return () => { cancelled = true; };
  }, [slaughterVisible, feedAll]);

  // map style.load 後重新餵（切底圖 source 被重建為空 FC）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!anyFarmVisible && !slaughterVisible)) return;
    const onStyleLoad = () => feedAll();
    map.on("style.load", onStyleLoad);
    feedAll();
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, anyFarmVisible, slaughterVisible, feedAll]);
}
