/**
 * 醫療等時圈分級（開車到最近大醫院的時間帶）。
 * level 對應 PMTiles 屬性 "level"（le5/le10/le15/over15/unreachable）。
 * 供 factory / legend / popup 共用。
 */

export interface MedicalIsochroneBand {
  level: string;
  color: string;
  label: string;
}

export const MEDICAL_ISOCHRONE_BANDS: MedicalIsochroneBand[] = [
  { level: "le5", color: "#22c55e", label: "5 分鐘內" },
  { level: "le10", color: "#eab308", label: "10 分鐘內" },
  { level: "le15", color: "#f97316", label: "15 分鐘內" },
  { level: "over15", color: "#ef4444", label: ">15 分（醫療沙漠）" },
];

/** 圖例 / popup 備註：資料估算限制。 */
export const MEDICAL_ISOCHRONE_NOTE = "開車路網估算（OSRM），不含救護車優先路權";

/** level → 色碼，找不到回灰。 */
export function medIsochroneColor(level: string): string {
  return MEDICAL_ISOCHRONE_BANDS.find((b) => b.level === level)?.color ?? "#94a3b8";
}

/** level → 中文標籤。 */
export function medIsochroneLabel(level: string): string {
  return MEDICAL_ISOCHRONE_BANDS.find((b) => b.level === level)?.label ?? level;
}
