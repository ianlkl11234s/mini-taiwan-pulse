/** 印尼規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口、農村發展指數另有專用 hook，不在此表。 */
export const ID_DATA_KEYS = [
  // 第 1 波（2026-11-23）：交通、能源
  "idStations", "idRailLines", "idTransportHubs", "idPowerPlants", "idPowerGrid", "idRenewables", "idFuelStations",
  // 第 2 波（2026-11-23）
  "idPlaceNames", "idOuterIslands", "idFaults", "idMountainRescue", "idDibiHydromet",
  // 第 3 波（2026-11-23）
  "idBridges", "idWaterFacilities", "idWatersheds", "idSubsidence",
  // 第 4 波（2026-11-23）
  "idNatureSpots", "idConservationForest", "idCamps",
  // 第 5 波（2026-11-24）：教育、醫療、消防、警政、監所法院、移民
  "idSchools", "idHealthFacilities", "idFireStations", "idPoliceStations", "idPrisonsCourts", "idImmigrationOffices",
  // 第 6 波（2026-11-24）
  "idTransjakarta", "idSpecialEconomicZones", "idIkn", "idPostOffices", "idMarkets", "idBanks", "idCulturalFacilities", "idHeritageSites",
  "idCommTowers", "idPlacesOfWorship", "idExperiences", "idAccommodation",
  // 第 7 波（2026-11-24）
  "idWeatherStations",
  // 第 8–9 波（2026-11-24）
  "idFactories", "idSportsVenues", "idParks", "idCemeteries", "idAquaculture", "idFarmland", "idVeterinary",
] as const;
export type IdDataKey = (typeof ID_DATA_KEYS)[number];

/** 印尼 raster（PNG PMTiles，無 feature 屬性與 popup）：山體陰影、色別標高（Copernicus DEM GLO-90）、InaRISK 三張危害指數（DISPLAY_ONLY）。 */
export const ID_RASTER_KEYS = ["idTerrainHillshade", "idTerrainRelief", "idInariskLandslide", "idInariskFlood", "idInariskMulti"] as const;
export type IdRasterKey = (typeof ID_RASTER_KEYS)[number];
