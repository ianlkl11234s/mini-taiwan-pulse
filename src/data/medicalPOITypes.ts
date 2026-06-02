// 醫療基礎點位 5 類 — 配色 / 標籤 / med_cat 對應的單一資料源
//
// 共享給：
//   - src/map/medicalPOILayerFactory.ts — 5 個 circle layer 的 filter / 配色 / 開關
//   - src/components/LegendPanel.tsx     — MedicalLegend 圖例
//   - src/components/FeatureInfoPanel.tsx — MedicalPOIPanel 類型標籤 + 配色
//
// 資料來源：健保特約院所 + AED + 長照（scripts/preprocess/merge_medical_poi.py 合併）
// med_cat 值：hospital / clinic / other_medical / pharmacy / aed / ltc
// 注意：clinic layer 同時顯示 other_medical（NHI 衛生所/居家護理/檢驗所等），維持 5 個 layer。

import type { LayerVisibility } from "../types";

export interface MedicalPOIType {
  /** 前端 layer 識別（layer id = medical-${id}-circle） */
  id: string;
  /** LayerVisibility key */
  visKey: keyof LayerVisibility;
  /** overlayParams 前綴（${prefix}Opacity / ${prefix}Scale） */
  paramPrefix: string;
  /** 此 layer 顯示的 med_cat 值（match filter 用） */
  matchCats: string[];
  color: string;
  labelZh: string;
  labelEn: string;
}

export const MEDICAL_POI_TYPES: MedicalPOIType[] = [
  { id: "hospital", visKey: "medHospital", paramPrefix: "medHospital", matchCats: ["hospital"],              color: "#d32f2f", labelZh: "醫院",        labelEn: "Hospital" },
  { id: "clinic",   visKey: "medClinic",   paramPrefix: "medClinic",   matchCats: ["clinic", "other_medical"], color: "#1976d2", labelZh: "診所/其他醫療", labelEn: "Clinic" },
  { id: "pharmacy", visKey: "medPharmacy", paramPrefix: "medPharmacy", matchCats: ["pharmacy"],              color: "#388e3c", labelZh: "藥局",        labelEn: "Pharmacy" },
  { id: "aed",      visKey: "medAED",      paramPrefix: "medAED",      matchCats: ["aed"],                   color: "#fbc02d", labelZh: "AED",         labelEn: "AED" },
  { id: "ltc",      visKey: "medLTC",      paramPrefix: "medLTC",      matchCats: ["ltc"],                   color: "#8e24aa", labelZh: "長照機構",     labelEn: "Long-term Care" },
];

/** med_cat 值 → 顯示用配色（popup 標題點用） */
export function medicalColorByCat(medCat: string): string {
  for (const t of MEDICAL_POI_TYPES) {
    if (t.matchCats.includes(medCat)) return t.color;
  }
  return "#9e9e9e";
}
