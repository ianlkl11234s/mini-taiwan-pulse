/** 泰國第 0–1 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const TH_DATA_KEYS = [
  // 第 1 波（2026-11-22）：交通
  "thTransportHubs", "thStations", "thMajorRoads",
  // 第 1 波（2026-11-22）：能源
  "thPowerPlants", "thPowerGrid", "thRenewables", "thFuelStations", "thPipelines",
] as const;
export type ThDataKey = (typeof TH_DATA_KEYS)[number];
