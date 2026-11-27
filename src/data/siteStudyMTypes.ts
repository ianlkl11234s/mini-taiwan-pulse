/**
 * 設施研究 M（站主限定）的共用型別與顏色正規化：overlayRegistry、圖例、popup 三邊共用。
 * 這裡沒有任何類別值；類別名稱、顏色與筆數都在站主私人檔裡（見 siteStudyMLoader.ts）。
 *
 * 四個圖層共用同一份實作，差別只在「資料檔」：part ＝ 資料檔代號，一個 part 對一個圖層、一個 source、一支私人檔。
 */
import type { OwnerDataAssetName } from "./ownerDataAssets";

export type SiteStudyPart = "sites" | "ranges" | "parcels" | "past";
export type SiteStudyLayerKey = "siteStudyM" | "siteStudyMRanges" | "siteStudyMParcels" | "siteStudyMPast";

export interface SiteStudyPartInfo {
  layerKey: SiteStudyLayerKey;
  /** Mapbox source id（子圖層 id 為 `${sourceId}-fill` 等） */
  sourceId: string;
  asset: OwnerDataAssetName;
  /** loading 任務顯示名 */
  label: string;
}

export const SITE_STUDY_M_PARTS: Readonly<Record<SiteStudyPart, SiteStudyPartInfo>> = {
  sites: { layerKey: "siteStudyM", sourceId: "site-study-m", asset: "study-m-sites", label: "設施研究 M" },
  ranges: { layerKey: "siteStudyMRanges", sourceId: "site-study-m-ranges", asset: "study-m-ranges", label: "設施研究 M・範圍" },
  parcels: { layerKey: "siteStudyMParcels", sourceId: "site-study-m-parcels", asset: "study-m-parcels", label: "設施研究 M・地塊" },
  past: { layerKey: "siteStudyMPast", sourceId: "site-study-m-past", asset: "study-m-past", label: "設施研究 M・歷史" },
};

export const SITE_STUDY_M_PART_LIST = Object.keys(SITE_STUDY_M_PARTS) as SiteStudyPart[];
export const SITE_STUDY_M_LAYER_KEYS = SITE_STUDY_M_PART_LIST.map((part) => SITE_STUDY_M_PARTS[part].layerKey);

/** 由 feature 的 `_part` 還原資料檔代號；不認得時當主資料（popup 與圖層名稱用） */
export function siteStudyPartOf(value: unknown): SiteStudyPart {
  return typeof value === "string" && value in SITE_STUDY_M_PARTS ? (value as SiteStudyPart) : "sites";
}

export interface SiteStudyLegendItem { key: string; label: string; color: string; count: number | null }
export interface SiteStudyMeta { title: string; built: string; note: string; legend: SiteStudyLegendItem[] }
export interface SiteStudyData { features: GeoJSON.Feature[]; meta: SiteStudyMeta }

/** 檔案沒給顏色或格式不對時用的中性灰（圖例與地圖同一個值）。 */
export const SITE_STUDY_M_NEUTRAL = "#94a3b8";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function siteStudyColor(value: unknown): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : SITE_STUDY_M_NEUTRAL;
}
