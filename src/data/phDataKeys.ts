/** 菲律賓第 0–2 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const PH_DATA_KEYS = [
  // 第 1 波（2026-11-13）：交通
  "phTransportHubs", "phStations", "phMajorRoads",
  // 第 1 波（2026-11-13）：能源
  "phPowerPlants", "phPowerGrid", "phRenewables", "phFuelStations", "phPipelines",
  // 第 2 波補充（2026-11-14）：交通（OSM Geofabrik 快照）
  "phBusStops", "phUrbanRail", "phExpressways",
  // 觀光波（2026-11-16，analytics #394）
  "phTouristAttractions", "phCoastIslands", "phNatureSpots", "phTourismServices", "phTourismDevelopmentAreas",
  // 第 2–9 波（2026-11-16，analytics #396；HOLD 6 層與餐飲不接）
  "phPlaceNames", "phPoverty",
  "phEarthquakes", "phNoahFlood100yr", "phNoahLandslide", "phWaterPermits", "phLakes", "phDams",
  "phBridges", "phParking", "phKmPosts", "phEcozones", "phReclamation",
  "phSchools", "phSchoolCampuses", "phHealthFacilities", "phFireStations", "phNcrSafeOpenSpaces", "phPoliceStations", "phJails",
  "phTrees", "phTrails", "phKba", "phWetlands", "phForestryPrograms",
  "phCoastalResources", "phMarineStations", "phWdpca", "phWasteFacilities", "phPollutionSources",
  "phArtsVenues", "phPostOffices", "phPublicFacilities", "phFinancialServices", "phPlacesOfWorship",
  "phSportsVenues", "phParks", "phCemeteries", "phFishPorts", "phAquaculture",
] as const;
export type PhDataKey = (typeof PH_DATA_KEYS)[number];

/** 菲律賓第 2、6 波 raster（PNG PMTiles，無 feature 屬性與 popup）：山體陰影、色別標高、建成面積、樹冠流失。 */
export const PH_RASTER_KEYS = ["phTerrainHillshade", "phTerrainRelief", "phBuiltSurface", "phForestLoss"] as const;
export type PhRasterKey = (typeof PH_RASTER_KEYS)[number];
