// 越南國家包：hosts.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LayerHookEntry } from "../../layers/layerHookRegistry";
import { VnAdminHost, VnAngiangAquacultureHost, VnAngiangDemoHost, VnBicycleRentalHost, VnBridgesHost, VnCoalMinesHost, VnCourtsPrisonsHost, VnDamsHost, VnEnvisoftStationsHost, VnFarmTracksHost, VnFieldBoundariesHost, VnFinancialServicesHost, VnFuelStationsHost, VnGlideEventsHost, VnHealthFacilitiesHost, VnKindergartensHost, VnLandslideSusceptibilityHost, VnMajorRoadsHost, VnNationalTouristAreasHost, VnOilGasHost, VnParkingHost, VnParksHost, VnPlaceNamesHost, VnPlacesOfWorshipHost, VnPoliceHost, VnPopulationHost, VnPostalServicesHost, VnPowerGridHost, VnPowerPlantsHost, VnProtectedAreasOdmHost, VnPublicAmenitiesHost, VnRenewablesHost, VnRiverbankErosionHost, VnRiversHost, VnSchoolCampusesHost, VnSchoolsHost, VnSoilHost, VnStationsHost, VnTerrainHillshadeHost, VnTerrainReliefHost, VnTourAttractionsHost, VnTourNatureHost, VnTourServicesHost, VnTransportHubsHost, VnWaterStructuresHost, VnWaterSupplyHost, VnWdpcaHost } from "./vietnamHosts";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("VN", n)。 */
export const VN_PACK_HOST_SLOTS: Readonly<Record<number, readonly LayerHookEntry[]>> = {
  1: [
  // 越南（2026-11-13 第 0–1 波：行政邊界、人口、交通 3 層、能源 5 層、環境監測站、安江示範）
  { id: "useVnAdminLayers", keys: ["vnAdminBoundaries"], Host: VnAdminHost },
  { id: "useVnPopulationLayers", keys: ["vnPopulation"], Host: VnPopulationHost },
  { id: "useVnStationsLayer", keys: ["vnStations"], Host: VnStationsHost },
  { id: "useVnTransportHubsLayer", keys: ["vnTransportHubs"], Host: VnTransportHubsHost },
  { id: "useVnMajorRoadsLayer", keys: ["vnMajorRoads"], Host: VnMajorRoadsHost },
  { id: "useVnPowerPlantsLayer", keys: ["vnPowerPlants"], Host: VnPowerPlantsHost },
  { id: "useVnRenewablesLayer", keys: ["vnRenewables"], Host: VnRenewablesHost },
  { id: "useVnPowerGridLayer", keys: ["vnPowerGrid"], Host: VnPowerGridHost },
  { id: "useVnFuelStationsLayer", keys: ["vnFuelStations"], Host: VnFuelStationsHost },
  { id: "useVnOilGasLayer", keys: ["vnOilGas"], Host: VnOilGasHost },
  { id: "useVnEnvisoftStationsLayer", keys: ["vnEnvisoftStations"], Host: VnEnvisoftStationsHost },
  { id: "useVnAngiangDemoLayer", keys: ["vnAngiangDemo"], Host: VnAngiangDemoHost },
  // 越南觀光波與第 2–7 波＋raster 4 層（2026-11-17）
  { id: "useVnTourAttractionsLayer", keys: ["vnTourAttractions"], Host: VnTourAttractionsHost },
  { id: "useVnTourNatureLayer", keys: ["vnTourNature"], Host: VnTourNatureHost },
  { id: "useVnTourServicesLayer", keys: ["vnTourServices"], Host: VnTourServicesHost },
  { id: "useVnNationalTouristAreasLayer", keys: ["vnNationalTouristAreas"], Host: VnNationalTouristAreasHost },
  { id: "useVnPlaceNamesLayer", keys: ["vnPlaceNames"], Host: VnPlaceNamesHost },
  { id: "useVnBicycleRentalLayer", keys: ["vnBicycleRental"], Host: VnBicycleRentalHost },
  { id: "useVnBridgesLayer", keys: ["vnBridges"], Host: VnBridgesHost },
  { id: "useVnParkingLayer", keys: ["vnParking"], Host: VnParkingHost },
  { id: "useVnGlideEventsLayer", keys: ["vnGlideEvents"], Host: VnGlideEventsHost },
  { id: "useVnDamsLayer", keys: ["vnDams"], Host: VnDamsHost },
  { id: "useVnRiversLayer", keys: ["vnRivers"], Host: VnRiversHost },
  { id: "useVnWaterSupplyLayer", keys: ["vnWaterSupply"], Host: VnWaterSupplyHost },
  { id: "useVnWaterStructuresLayer", keys: ["vnWaterStructures"], Host: VnWaterStructuresHost },
  { id: "useVnRiverbankErosionLayer", keys: ["vnRiverbankErosion"], Host: VnRiverbankErosionHost },
  { id: "useVnSchoolsLayer", keys: ["vnSchools"], Host: VnSchoolsHost },
  { id: "useVnSchoolCampusesLayer", keys: ["vnSchoolCampuses"], Host: VnSchoolCampusesHost },
  { id: "useVnKindergartensLayer", keys: ["vnKindergartens"], Host: VnKindergartensHost },
  { id: "useVnHealthFacilitiesLayer", keys: ["vnHealthFacilities"], Host: VnHealthFacilitiesHost },
  { id: "useVnPoliceLayer", keys: ["vnPolice"], Host: VnPoliceHost },
  { id: "useVnCourtsPrisonsLayer", keys: ["vnCourtsPrisons"], Host: VnCourtsPrisonsHost },
  { id: "useVnPostalServicesLayer", keys: ["vnPostalServices"], Host: VnPostalServicesHost },
  { id: "useVnPublicAmenitiesLayer", keys: ["vnPublicAmenities"], Host: VnPublicAmenitiesHost },
  { id: "useVnFinancialServicesLayer", keys: ["vnFinancialServices"], Host: VnFinancialServicesHost },
  { id: "useVnPlacesOfWorshipLayer", keys: ["vnPlacesOfWorship"], Host: VnPlacesOfWorshipHost },
  { id: "useVnParksLayer", keys: ["vnParks"], Host: VnParksHost },
  { id: "useVnProtectedAreasOdmLayer", keys: ["vnProtectedAreasOdm"], Host: VnProtectedAreasOdmHost },
  { id: "useVnAngiangAquacultureLayer", keys: ["vnAngiangAquaculture"], Host: VnAngiangAquacultureHost },
  { id: "useVnFieldBoundariesLayer", keys: ["vnFieldBoundaries"], Host: VnFieldBoundariesHost },
  { id: "useVnSoilLayer", keys: ["vnSoil"], Host: VnSoilHost },
  { id: "useVnFarmTracksLayer", keys: ["vnFarmTracks"], Host: VnFarmTracksHost },
  { id: "useVnCoalMinesLayer", keys: ["vnCoalMines"], Host: VnCoalMinesHost },
  { id: "useVnTerrainHillshadeLayer", keys: ["vnTerrainHillshade"], Host: VnTerrainHillshadeHost },
  { id: "useVnTerrainReliefLayer", keys: ["vnTerrainRelief"], Host: VnTerrainReliefHost },
  { id: "useVnLandslideSusceptibilityLayer", keys: ["vnLandslideSusceptibility"], Host: VnLandslideSusceptibilityHost },
  { id: "useVnWdpcaLayer", keys: ["vnWdpca"], Host: VnWdpcaHost },
  ],
  // <codemod:append VN_PACK_HOST_SLOTS>
};
