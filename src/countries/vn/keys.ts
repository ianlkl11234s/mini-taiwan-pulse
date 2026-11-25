/** 越南第 0–1 波規格驅動資料層 key（SSOT：types／registry／測試共用，不放其他相依）。行政邊界、人口另有專用 hook，不在此表。 */
export const VN_DATA_KEYS = [
  // 第 1 波（2026-11-13）：交通
  "vnStations", "vnTransportHubs", "vnMajorRoads",
  // 第 1 波（2026-11-13）：能源
  "vnPowerPlants", "vnRenewables", "vnPowerGrid", "vnFuelStations", "vnOilGas",
  // 第 1 波（2026-11-13）：環境監測站位置（envisoft）、安江示範
  "vnEnvisoftStations", "vnAngiangDemo",
  // 觀光波（2026-11-17，analytics #397）
  "vnTourAttractions", "vnTourNature", "vnTourServices", "vnNationalTouristAreas",
  // 第 2–7 波（2026-11-17，analytics #397）
  "vnPlaceNames", "vnBicycleRental", "vnBridges", "vnParking",
  "vnGlideEvents", "vnDams", "vnRivers", "vnWaterSupply", "vnWaterStructures", "vnRiverbankErosion",
  "vnSchools", "vnSchoolCampuses", "vnKindergartens", "vnHealthFacilities", "vnPolice", "vnCourtsPrisons",
  "vnPostalServices", "vnPublicAmenities", "vnFinancialServices", "vnPlacesOfWorship",
  "vnParks", "vnProtectedAreasOdm",
  "vnAngiangAquaculture", "vnFieldBoundaries", "vnSoil", "vnFarmTracks", "vnCoalMines",
] as const;
export type VnDataKey = (typeof VN_DATA_KEYS)[number];

/** 越南第 2、3、6 波 raster（無 feature 屬性與 popup）：山體陰影、色別標高（PNG PMTiles）、崩塌潛勢（外部 WMS）、WDPCA 保護區（站主限定 PNG PMTiles）。 */
export const VN_RASTER_KEYS = ["vnTerrainHillshade", "vnTerrainRelief", "vnLandslideSusceptibility", "vnWdpca"] as const;
export type VnRasterKey = (typeof VN_RASTER_KEYS)[number];

/** 越南全部圖層 key（B1 P5；索引裡這國的 key）。型別給 LayerVisibility、packKeys 用。 */
export const VN_LAYER_KEYS = [
  "vnAdminBoundaries",
  "vnAngiangAquaculture",
  "vnAngiangDemo",
  "vnBicycleRental",
  "vnBridges",
  "vnCoalMines",
  "vnCourtsPrisons",
  "vnDams",
  "vnEnvisoftStations",
  "vnFarmTracks",
  "vnFieldBoundaries",
  "vnFinancialServices",
  "vnFuelStations",
  "vnGlideEvents",
  "vnHealthFacilities",
  "vnKindergartens",
  "vnLandslideSusceptibility",
  "vnMajorRoads",
  "vnNationalTouristAreas",
  "vnOilGas",
  "vnParking",
  "vnParks",
  "vnPlaceNames",
  "vnPlacesOfWorship",
  "vnPolice",
  "vnPopulation",
  "vnPostalServices",
  "vnPowerGrid",
  "vnPowerPlants",
  "vnProtectedAreasOdm",
  "vnPublicAmenities",
  "vnRenewables",
  "vnRiverbankErosion",
  "vnRivers",
  "vnSchoolCampuses",
  "vnSchools",
  "vnSoil",
  "vnStations",
  "vnTerrainHillshade",
  "vnTerrainRelief",
  "vnTourAttractions",
  "vnTourNature",
  "vnTourServices",
  "vnTransportHubs",
  "vnWaterStructures",
  "vnWaterSupply",
  "vnWdpca",
] as const;
export type VnLayerKey = (typeof VN_LAYER_KEYS)[number];
