/**
 * 設施研究 M（站主限定）的共用型別與顏色正規化：overlayRegistry、圖例、popup 三邊共用。
 * 這裡沒有任何類別值；類別名稱、顏色與筆數都在站主私人檔裡（見 siteStudyMLoader.ts）。
 */

export type SiteStudyPart = "sites" | "overlays";

export interface SiteStudyLegendItem { key: string; label: string; color: string; count: number | null }
export interface SiteStudyMeta { title: string; built: string; note: string; legend: SiteStudyLegendItem[] }
export interface SiteStudyData { features: GeoJSON.Feature[]; meta: SiteStudyMeta }

/** 檔案沒給顏色或格式不對時用的中性灰（圖例與地圖同一個值）。 */
export const SITE_STUDY_M_NEUTRAL = "#94a3b8";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function siteStudyColor(value: unknown): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : SITE_STUDY_M_NEUTRAL;
}
