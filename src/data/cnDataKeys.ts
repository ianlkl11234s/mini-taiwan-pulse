/** 中國第 0–1 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口、人口網格另有專用 hook，不在此表。 */
export const CN_DATA_KEYS = [
  // 第 1 波（2026-11-13）：交通
  "cnBusStops", "cnTransportHubs", "cnMajorRoads",
  // 第 1 波（2026-11-13）：能源
  "cnPowerPlants", "cnPowerGrid", "cnPipelines",
] as const;
export type CnDataKey = (typeof CN_DATA_KEYS)[number];

/** 全部 9 個中國圖層 key（全部站主限定；與 pulse-data `_display_only.yaml`、gis-platform `public.gated_layers` 同一份）。 */
export const CN_ALL_LAYER_KEYS = ["cnAdminBoundaries", "cnPopulation", "cnPopulationGrid", ...CN_DATA_KEYS] as const;
export type CnLayerKey = (typeof CN_ALL_LAYER_KEYS)[number];
