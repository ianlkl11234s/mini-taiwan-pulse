// 農業 POI 三類 — 配色 / 標籤的單一資料源
//
// 共享給：
//   - src/map/agricultureLayerFactory.ts — circle-color match expression
//   - src/components/FeatureInfoPanel.tsx — AgriPOIPanel 類型標籤 + 配色
//   - src/components/LegendPanel.tsx — AgriPOILegend 圖例
//
// 來源資料集：177247 休閒農場 / 177245 田媽媽 / 177246 特色農業旅遊場域

export interface AgriPOIType {
  /** poi_type 屬性值（agriculture_pois.geojson 內） */
  id: string;
  color: string;
  labelZh: string;
  labelEn: string;
}

export const AGRI_POI_TYPES: AgriPOIType[] = [
  { id: "leisure_farm",          color: "#2e7d32", labelZh: "休閒農場",          labelEn: "Leisure Farm" },
  { id: "tian_mama",             color: "#d84315", labelZh: "田媽媽",            labelEn: "Tian Mama" },
  { id: "agritourism_certified", color: "#6a1b9a", labelZh: "特色農業旅遊場域",  labelEn: "Agritourism" },
];

/** 給 Mapbox match expression 用：[type, color, type, color, ..., fallback] */
export function agriPOIMatchColorExpr(): unknown[] {
  const expr: unknown[] = ["match", ["get", "poi_type"]];
  for (const t of AGRI_POI_TYPES) {
    expr.push(t.id, t.color);
  }
  expr.push("#616161"); // fallback grey
  return expr;
}
