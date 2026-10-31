/** 南韓第 3–5 波資料層 key（SSOT：types／registry／測試共用，不放其他相依）。 */
export const KR_DATA_KEYS = [
  "krWaterLevelStations", "krSluiceGates", "krWaterQualityStations", "krCoastalErosionFacilities", "krRiversOsm",
  "krMarinePollutionIncidents", "krMarineEnvSites", "krMarineProtectedAreas",
  "krPublicBicycleStations", "krSeoulSubwayCongestion", "krBridges", "krParkingLots", "krSpeedCameras", "krChildProtectionZones",
  "krNationalParks", "krNpLocationSigns", "krNpTrails", "krStreetTrees",
] as const;
export type KrDataKey = (typeof KR_DATA_KEYS)[number];
