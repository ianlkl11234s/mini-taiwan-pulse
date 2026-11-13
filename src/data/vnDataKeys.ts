/** 越南第 0–1 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const VN_DATA_KEYS = [
  // 第 1 波（2026-11-13）：交通
  "vnStations", "vnTransportHubs", "vnMajorRoads",
  // 第 1 波（2026-11-13）：能源
  "vnPowerPlants", "vnRenewables", "vnPowerGrid", "vnFuelStations", "vnOilGas",
  // 第 1 波（2026-11-13）：環境監測站位置（envisoft）、安江示範
  "vnEnvisoftStations", "vnAngiangDemo",
] as const;
export type VnDataKey = (typeof VN_DATA_KEYS)[number];
