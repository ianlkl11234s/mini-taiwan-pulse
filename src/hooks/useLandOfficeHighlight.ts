import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureInfo } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 點「機關便民據點」的地政事務所點 → 高亮「地政事務所轄區」圖層裡對應的那一面（台灣圖層延伸 B3，2026-11-20）。
 *
 * 臨時高亮，不受側欄開關控制：轄區圖層沒開（沒有 highlight 子圖層）就什麼都不做。
 * 對應鍵＝點的機關名稱與轄區面的 `office_title_7620`：站上便民據點 GeoJSON 的點沒有機關代碼欄，
 * 只能以名稱對；高雄的點叫「高雄市政府地政局○○地政事務所」，轄區叫「高雄市○○地政事務所」，去掉「政府地政局」即可。
 * 108 點 ↔ 110 面：108 點全部對得上，金門縣地政局、連江縣地政局兩面沒有點。
 */
export const LAND_OFFICE_HIGHLIGHT_LAYERS = ["land-office-jurisdiction-highlight-fill", "land-office-jurisdiction-highlight-line"] as const;
export const LAND_OFFICE_HIGHLIGHT_NONE = "__none__";

/** 便民據點的地政事務所名稱 → 轄區面的機關名稱 */
export function landOfficeJurisdictionTitle(name: string): string {
  return name.replace("政府地政局", "").trim();
}

/** 這筆點擊要高亮哪個轄區（不是地政事務所點回 null） */
export function landOfficeHighlightTitle(featureInfo: Pick<FeatureInfo, "layerType" | "properties"> | null): string | null {
  if (!featureInfo || featureInfo.layerType !== "govServiceOffice") return null;
  if (featureInfo.properties.type !== "land_office") return null;
  const name = String(featureInfo.properties.name ?? "");
  return name ? landOfficeJurisdictionTitle(name) : null;
}

export function useLandOfficeHighlight(mapRef: React.RefObject<MapboxMap | null>, featureInfo: FeatureInfo | null): void {
  const mapTick = useMapReadyTick(mapRef, true);
  const title = landOfficeHighlightTitle(featureInfo);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filter = ["==", ["get", "office_title_7620"], title ?? LAND_OFFICE_HIGHLIGHT_NONE];
    const apply = () => {
      for (const id of LAND_OFFICE_HIGHLIGHT_LAYERS) {
        if (!map.getLayer(id)) continue;
        if (JSON.stringify(map.getFilter(id)) !== JSON.stringify(filter)) map.setFilter(id, filter as never);
      }
    };
    apply();
    if (!title) return;
    // 轄區圖層之後才開、或調透明度等讓 overlay 重建時，filter 會被還原：idle 時補套（相同就不動，不會互相觸發）
    map.on("idle", apply);
    return () => { map.off("idle", apply); };
  }, [mapRef, mapTick, title]);
}
