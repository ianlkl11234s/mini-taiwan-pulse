/** 美國屬地（波多黎各 PR、關島 GU）規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const UST_DATA_KEYS = [
  // 波多黎各第 1 波（2026-11-25）：交通、能源
  "prTransitStops", "prTransportHubs", "prMajorRoads", "prPowerPlants", "prPowerGrid", "prRenewables", "prFuelStations", "prPetroleum",
  // 關島第 1 波（2026-11-25）
  "guTransitStops", "guTransportHubs", "guMajorRoads", "guPowerPlants", "guPowerGrid", "guRenewables", "guFuelStations", "guPetroleum",
] as const;
export type UstDataKey = (typeof UST_DATA_KEYS)[number];

/** 行政邊界、人口（專用 hook）。 */
export const UST_AREA_KEYS = ["prAdminBoundaries", "prPopulation", "guAdminBoundaries", "guPopulation"] as const;
export type UstAreaKey = (typeof UST_AREA_KEYS)[number];
