import type { LayerVisibility } from "../types";

/**
 * 農企業登記三類（同一張 spatial.agri_business_registrations，靠 business_type 區分）。
 * 顏色 / 標籤的單一真實來源 —— overlayRegistry paint、LegendPanel、FeatureInfoPanel 共用。
 */
export interface AgriCompanyType {
  /** GeoJSON properties.business_type 值 */
  id: string;
  /** 對應的 LayerVisibility key（各自獨立 toggle） */
  key: Extract<keyof LayerVisibility, "agriRetail" | "agriProduceWholesale" | "agriWholesaleMarket">;
  color: string;
  labelZh: string;
  labelEn: string;
}

export const AGRI_COMPANY_TYPES: AgriCompanyType[] = [
  { id: "retail",            key: "agriRetail",           color: "#e91e63", labelZh: "農產零售商", labelEn: "Retail" },
  { id: "produce_wholesale", key: "agriProduceWholesale", color: "#3f51b5", labelZh: "蔬果批發商", labelEn: "Produce Wholesale" },
  { id: "wholesale_market",  key: "agriWholesaleMarket",  color: "#ffd600", labelZh: "農產批發市場", labelEn: "Wholesale Market" },
];
