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
  // 第 8–9 波（2026-11-23）
  "thAirQualityStations", "thWeatherStations", "thMarineHabitats", "thMarineProtectedAreas", "thSeaLevelStations", "thCoastalChange",
  "thSportsVenues", "thParks", "thFactories", "thFarmMarkets", "thCrops", "thVeterinary",
] as const;
export type ThDataKey = (typeof TH_DATA_KEYS)[number];

/** 泰國 raster（PNG PMTiles，無 feature 屬性與 popup）：山體陰影、色別標高（Copernicus DEM GLO-90）。 */
export const TH_RASTER_KEYS = ["thTerrainHillshade", "thTerrainRelief", "thSoilPh", "thSoilOrganicCarbon"] as const;
export type ThRasterKey = (typeof TH_RASTER_KEYS)[number];

/** 泰國全部圖層 key（B1 P5；索引裡這國的 key）。型別給 LayerVisibility、packKeys 用。 */
export const TH_LAYER_KEYS = [
  "thAccommodation",
  "thAdminBoundaries",
  "thAirQualityStations",
  "thArtsEvents",
  "thBanks",
  "thBasins",
  "thCoastalChange",
  "thCrops",
  "thEec",
  "thElderlyHousing",
  "thElectionConstituencies",
  "thExperiences",
  "thFactories",
  "thFarmMarkets",
  "thFloodHistory",
  "thFootbridges",
  "thForestParks",
  "thFuelStations",
  "thHealthFacilities",
  "thHighlandVillages",
  "thHistoricSites",
  "thIrrigationProjects",
  "thJailsCourts",
  "thKindergartens",
  "thLandfills",
  "thLandslideSafePoints",
  "thMajorRoads",
  "thMarineHabitats",
  "thMarineProtectedAreas",
  "thMuseumsLibraries",
  "thNationalParks",
  "thNationalReservedForests",
  "thNatureSpots",
  "thParks",
  "thPipelines",
  "thPlaceNames",
  "thPlacesOfWorship",
  "thPoliceStations",
  "thPopulation",
  "thPostOffices",
  "thPowerGrid",
  "thPowerPlants",
  "thProvinceSocioeconomic",
  "thRailCrossings",
  "thRamsarSites",
  "thRenewables",
  "thRoadAccidents",
  "thSchools",
  "thSeaLevelStations",
  "thSoilOrganicCarbon",
  "thSoilPh",
  "thSportsVenues",
  "thStations",
  "thTerrainHillshade",
  "thTerrainRelief",
  "thTransportHubs",
  "thVeterinary",
  "thWeatherStations",
] as const;
export type ThLayerKey = (typeof TH_LAYER_KEYS)[number];
