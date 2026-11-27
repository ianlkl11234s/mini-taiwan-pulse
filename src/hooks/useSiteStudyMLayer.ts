import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { clearSiteStudyMCache, loadSiteStudyPart } from "../data/siteStudyMLoader";
import { SITE_STUDY_M_PARTS, type SiteStudyPart } from "../data/siteStudyMTypes";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { ownerDataStatus } from "../lib/ownerData";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 設施研究 M（站主限定）資料供應 hook；四個圖層共用，以 part 區分資料檔與 source。
 *
 * overlayRegistry 的各圖層是 dynamicData（空 FeatureCollection 起手）；本 hook 只負責讀檔與 setData，
 * 樣式、點選與圖例走 overlayRegistry／gisClickRegistry／LegendPanel 既有路徑。
 *
 * - 圖層可見才讀自己的那支檔。
 * - 切底圖（style.load）後 source 會被重建成空的，重新餵一次。
 * - 非站主：toggle 在 App 端被鎖，visible 恆為 false，不會發請求；sidecar 端非站主一律 401／403。
 */

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useSiteStudyMLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, part: SiteStudyPart) {
  const info = SITE_STUDY_M_PARTS[part];
  const dataRef = useRef<GeoJSON.Feature[] | null>(null);
  // 撤權後若圖層仍開著（重新取得權限）要重抓：遞增觸發載入 effect
  const [reloadTick, setReloadTick] = useState(0);
  // map 在首載後才就緒時（圖層預設開啟的分享網址）要重跑餵資料的 effect
  const mapTick = useMapReadyTick(mapRef, visible);

  const feed = useCallback(() => {
    const src = mapRef.current?.getSource(info.sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(dataRef.current ? { type: "FeatureCollection", features: dataRef.current } : EMPTY_FC);
  }, [mapRef, info.sourceId]);

  useEffect(() => registerOwnerGateReset([info.layerKey], () => {
    clearSiteStudyMCache(part);
    ownerDataStatus.reset(info.asset);
    dataRef.current = null;
    setReloadTick((n) => n + 1);
  }), [info, part]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadSiteStudyPart(part)
      .then((d) => { if (cancelled) return; dataRef.current = d.features; feed(); })
      .catch((err) => { if (!cancelled && !isAccessDenied(err)) console.warn(`[${info.layerKey}] load failed:`, err); });
    feed();
    return () => { cancelled = true; };
  }, [visible, part, info.layerKey, feed, reloadTick, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    map.on("style.load", feed);
    return () => { map.off("style.load", feed); };
  }, [mapRef, visible, feed, mapTick]);
}
