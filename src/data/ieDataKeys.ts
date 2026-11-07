/** 愛爾蘭第 1 波起規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。海床地形是 raster，另由 useIeBathymetryLayer 畫、不在此表。 */
export const IE_DATA_KEYS = [
  "ieMaritimeBoundaries", "iePlaceNames", "ieGaeltacht", "ieActivityLocations", "ieParks", "ieGraveyards",
  // 第 2 波（2026-11-07）：房地產
  "ieCommercialValuations", "ieStateAssets",
  // 第 3a 波（2026-11-08）：水系統與洪水
  "ieHydrometricStations", "ieWaterMonitoring", "ieRiverWaterBodies", "ieLakeWaterBodies", "ieArterialDrainage", "ieRiverFloodExtents", "ieCoastalErosion",
] as const;
export type IeDataKey = (typeof IE_DATA_KEYS)[number];
