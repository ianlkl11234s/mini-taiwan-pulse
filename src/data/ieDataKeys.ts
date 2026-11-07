/** 愛爾蘭第 1 波起規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。海床地形是 raster，另由 useIeBathymetryLayer 畫、不在此表。 */
export const IE_DATA_KEYS = [
  "ieMaritimeBoundaries", "iePlaceNames", "ieGaeltacht", "ieActivityLocations", "ieParks", "ieGraveyards",
  // 第 2 波（2026-11-07）：房地產
  "ieCommercialValuations", "ieStateAssets",
  // 第 3a 波（2026-11-08）：水系統與洪水
  "ieHydrometricStations", "ieWaterMonitoring", "ieRiverWaterBodies", "ieLakeWaterBodies", "ieArterialDrainage", "ieRiverFloodExtents", "ieCoastalErosion",
  // 第 3b 波（2026-11-08）：海洋
  "ieBathingWaters", "ieMarineSurveyStations", "ieSeabedSurveyCoverage", "ieProtectedMarineSites", "ieOffshoreRenewables",
  // 第 4 波（2026-11-08）：交通
  "ieTransitStops", "ieDublinbikesStations", "ieRoadRailNetwork", "ieRoadMarkers", "ieTrafficCounters", "ieAirportsPorts",
  // 第 5 波（2026-11-08）：自然保護、林業、地質輻射
  "ieNationalParks", "ieWildAtlanticWay", "ieProtectedSites", "ieNationalTrails", "ieStreetTrees", "ieRadiationStations", "ieLandslideEvents", "ieLandslideExtents", "ieRadonRisk",
  // 第 6 波（2026-11-08）：能源
  "iePowerPlants", "iePowerLines", "ieSubstations", "ieWindFarms", "ieEvCharging", "ieFuelStations",
  // 第 7a 波（2026-11-08）：教育
  "ieSchools", "ieSchoolPlanningAreas", "ieChildcareServices",
  // 第 7b 波（2026-11-08）：醫療照護、消防警政、司法
  "ieHealthFacilities", "ieCareHomes", "ieFireStations", "ieGardaStations", "ieCourts",
] as const;
export type IeDataKey = (typeof IE_DATA_KEYS)[number];
