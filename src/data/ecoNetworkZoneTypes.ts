/**
 * 國土綠網 12 地理分區 → 顏色 / 標籤的單一真實來源。
 * 給 overlayRegistry 配色、LegendPanel 圖例、FeatureInfoPanel popup 三處共用。
 * Zone 值來自 全國國土綠網分區圖.geojson 的 properties.Zone。
 */

export interface EcoNetworkZoneType {
  zone: string;
  color: string;
  label: string;
}

export const ECO_NETWORK_ZONE_TYPES: EcoNetworkZoneType[] = [
  { zone: "北部", color: "#1e88e5", label: "北部" },
  { zone: "西北部", color: "#42a5f5", label: "西北部" },
  { zone: "東北部", color: "#26c6da", label: "東北部" },
  { zone: "西部", color: "#66bb6a", label: "西部" },
  { zone: "西南部", color: "#9ccc65", label: "西南部" },
  { zone: "南部及恆春半島", color: "#ffa726", label: "南部及恆春半島" },
  { zone: "東部", color: "#ab47bc", label: "東部" },
  { zone: "澎湖", color: "#ec407a", label: "澎湖" },
  { zone: "金門", color: "#ffca28", label: "金門" },
  { zone: "馬祖", color: "#8d6e63", label: "馬祖" },
  { zone: "綠島", color: "#26a69a", label: "綠島" },
  { zone: "蘭嶼", color: "#ef5350", label: "蘭嶼" },
];

/** overlayRegistry fill-color match 用：[zone, color, zone, color, ...] 攤平 */
export const ECO_NETWORK_ZONE_MATCH: string[] = ECO_NETWORK_ZONE_TYPES.flatMap(
  (z) => [z.zone, z.color],
);
