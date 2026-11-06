/** 南韓第 3–6 波資料層 key（SSOT：types／registry／測試共用，不放其他相依）。 */
export const KR_DATA_KEYS = [
  "krWaterLevelStations", "krSluiceGates", "krWaterQualityStations", "krCoastalErosionFacilities", "krRiversOsm",
  "krMarinePollutionIncidents", "krMarineEnvSites", "krMarineProtectedAreas",
  "krPublicBicycleStations", "krSeoulSubwayCongestion", "krBridges", "krParkingLots", "krSpeedCameras", "krChildProtectionZones",
  "krNationalParks", "krNpLocationSigns", "krNpTrails", "krStreetTrees",
  // 第 6 波（2026-11-06）：領海線、都市公園、綜合體育設施、墓地（OSM）＋人口網格（GHSL H3）
  "krTerritorialSea", "krUrbanParks", "krSportsFacilities", "krCemeteriesOsm", "krPopulationH3",
] as const;
export type KrDataKey = (typeof KR_DATA_KEYS)[number];
