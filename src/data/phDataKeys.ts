/** 菲律賓第 0–2 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const PH_DATA_KEYS = [
  // 第 1 波（2026-11-13）：交通
  "phTransportHubs", "phStations", "phMajorRoads",
  // 第 1 波（2026-11-13）：能源
  "phPowerPlants", "phPowerGrid", "phRenewables", "phFuelStations", "phPipelines",
  // 第 2 波補充（2026-11-14）：交通（OSM Geofabrik 快照）
  "phBusStops", "phUrbanRail", "phExpressways",
] as const;
export type PhDataKey = (typeof PH_DATA_KEYS)[number];
