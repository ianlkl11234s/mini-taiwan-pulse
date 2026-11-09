/** 南韓第 3–8 波資料層 key（SSOT：types／registry／測試共用，不放其他相依）。 */
export const KR_DATA_KEYS = [
  "krWaterLevelStations", "krSluiceGates", "krWaterQualityStations", "krCoastalErosionFacilities", "krRiversOsm",
  "krMarinePollutionIncidents", "krMarineEnvSites", "krMarineProtectedAreas",
  "krPublicBicycleStations", "krSeoulSubwayCongestion", "krBridges", "krParkingLots", "krSpeedCameras", "krChildProtectionZones",
  "krNationalParks", "krNpLocationSigns", "krNpTrails", "krStreetTrees",
  // 第 6 波（2026-11-06）：領海線、都市公園、綜合體育設施、墓地（OSM）＋人口網格（GHSL H3）
  "krTerritorialSea", "krUrbanParks", "krSportsFacilities", "krCemeteriesOsm", "krPopulationH3",
  // 第 7 波（2026-11-07）：學校、學區、醫院藥局、消防署
  "krSchools", "krSchoolDistricts", "krHospitalsPharmacies", "krFireStations", "krCivilDefenseShelters", "krPoliceBoxes",
  // 第 8 波（2026-11-10）：圖書館、博物館美術館、公演、文化祭、國家遺產、住宿、安心宅配櫃、敬老堂
  "krLibraries", "krMuseums", "krPerformances", "krFestivals", "krHeritage", "krLodging", "krSafeDeliveryBoxes", "krSeniorCenters",
] as const;
export type KrDataKey = (typeof KR_DATA_KEYS)[number];
