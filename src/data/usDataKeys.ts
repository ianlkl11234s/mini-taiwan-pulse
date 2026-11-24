/** 美國規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const US_DATA_KEYS = [
  // 第 1 波（2026-11-25）：交通、能源
  "usStations", "usRailLines", "usHighways", "usTransportHubs", "usPowerPlants", "usPowerGrid", "usRenewables", "usOilGas", "usStateWells", "usFuelStations",
] as const;
export type UsDataKey = (typeof US_DATA_KEYS)[number];
