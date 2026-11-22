/** 泰國規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const TH_DATA_KEYS = [
  // 第 1 波（2026-11-22）：交通
  "thTransportHubs", "thStations", "thMajorRoads",
  // 第 1 波（2026-11-22）：能源
  "thPowerPlants", "thPowerGrid", "thRenewables", "thFuelStations", "thPipelines",
  // 第 2–4 波（2026-11-22）
  "thPlaceNames", "thElectionConstituencies", "thHighlandVillages", "thProvinceSocioeconomic",
  "thFootbridges", "thRailCrossings", "thRoadAccidents",
  "thEec", "thFloodHistory", "thBasins", "thIrrigationProjects", "thLandslideSafePoints", "thLandfills",
  // 第 5–7 波（2026-11-22）
  "thSchools", "thKindergartens", "thElderlyHousing", "thHealthFacilities", "thPoliceStations", "thJailsCourts",
  "thNatureSpots", "thNationalReservedForests", "thNationalParks", "thRamsarSites", "thForestParks",
  "thMuseumsLibraries", "thArtsEvents", "thHistoricSites", "thExperiences", "thAccommodation", "thBanks", "thPlacesOfWorship", "thPostOffices",
] as const;
export type ThDataKey = (typeof TH_DATA_KEYS)[number];

/** 泰國 raster（PNG PMTiles，無 feature 屬性與 popup）：山體陰影、色別標高（Copernicus DEM GLO-90）。 */
export const TH_RASTER_KEYS = ["thTerrainHillshade", "thTerrainRelief"] as const;
export type ThRasterKey = (typeof TH_RASTER_KEYS)[number];
