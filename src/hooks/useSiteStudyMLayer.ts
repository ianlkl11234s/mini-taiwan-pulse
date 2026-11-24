import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { clearSiteStudyMCache, loadSiteStudyPart, SITE_STUDY_M_ASSETS } from "../data/siteStudyMLoader";
import type { SiteStudyPart } from "../data/siteStudyMTypes";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { ownerDataStatus } from "../lib/ownerData";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 設施研究 M（站主限定）資料供應 hook。
 *
 * overlayRegistry 的 `siteStudyM` 是 dynamicData（空 FeatureCollection 起手）；本 hook 只負責讀檔與 setData，
 * 樣式、點選與圖例走 overlayRegistry／gisClickRegistry／LegendPanel 既有路徑。
 *
 * - 圖層可見才讀主資料；「參考資料」開關開啟才讀第二支檔。兩者併成同一個 source，以 `_part` 區分。
 *   參考資料關閉時不餵進 source，所以點不到也不佔圖面。
 * - 切底圖（style.load）後 source 會被重建成空的，重新餵一次。
 * - 非站主：toggle 在 App 端被鎖，visible 恆為 false，不會發請求；sidecar 端非站主一律 401／403。
 */

export const SITE_STUDY_M_SOURCE = "site-study-m";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 參考資料排在前面：同一子圖層內先畫（在主資料下方）。 */
export function mergeSiteStudyFeatures(sites: GeoJSON.Feature[] | null, overlays: GeoJSON.Feature[] | null): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [...(overlays ?? []), ...(sites ?? [])] };
}

export function useSiteStudyMLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, showOverlays: boolean) {
  const dataRef = useRef<Record<SiteStudyPart, GeoJSON.Feature[] | null>>({ sites: null, overlays: null });
  const showOverlaysRef = useRef(showOverlays);
  showOverlaysRef.current = showOverlays;
  // 撤權後若圖層仍開著（重新取得權限）要重抓：遞增觸發載入 effect
  const [reloadTick, setReloadTick] = useState(0);
  // map 在首載後才就緒時（圖層預設開啟的分享網址）要重跑餵資料的 effect
  const mapTick = useMapReadyTick(mapRef, visible);

  const feed = useCallback(() => {
    const src = mapRef.current?.getSource(SITE_STUDY_M_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    const { sites, overlays } = dataRef.current;
    src.setData(sites ? mergeSiteStudyFeatures(sites, showOverlaysRef.current ? overlays : null) : EMPTY_FC);
  }, [mapRef]);

  useEffect(() => registerOwnerGateReset(["siteStudyM"], () => {
    clearSiteStudyMCache();
    ownerDataStatus.reset(SITE_STUDY_M_ASSETS.sites);
    ownerDataStatus.reset(SITE_STUDY_M_ASSETS.overlays);
    dataRef.current = { sites: null, overlays: null };
    setReloadTick((n) => n + 1);
  }), []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = (part: SiteStudyPart) => {
      loadSiteStudyPart(part)
        .then((d) => { if (cancelled) return; dataRef.current[part] = d.features; feed(); })
        .catch((err) => { if (!cancelled && !isAccessDenied(err)) console.warn(`[siteStudyM] ${part} load failed:`, err); });
    };
    load("sites");
    if (showOverlays) load("overlays");
    feed();
    return () => { cancelled = true; };
  }, [visible, showOverlays, feed, reloadTick, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    map.on("style.load", feed);
    return () => { map.off("style.load", feed); };
  }, [mapRef, visible, feed, mapTick]);
}
