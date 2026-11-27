// 南韓國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";
import { KR_ECO_CLICK_LAYER_IDS, KR_WASTE_CLICK_LAYER_IDS } from "./krEcoWasteTypes";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("KR", n)。 */
export const KR_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  // 南韓第 3–5 波：點 → 線 → 面，都排在行政界（大面積背景）前面
  { layers: ["kr-street-trees-circle"], type: "krStreetTrees" },
  { layers: ["kr-water-level-stations-circle"], type: "krWaterLevelStations" },
  { layers: ["kr-sluice-gates-circle"], type: "krSluiceGates" },
  { layers: ["kr-water-quality-stations-circle"], type: "krWaterQualityStations" },
  { layers: ["kr-coastal-erosion-facilities-circle"], type: "krCoastalErosionFacilities" },
  { layers: ["kr-marine-pollution-incidents-circle"], type: "krMarinePollutionIncidents" },
  { layers: ["kr-marine-env-sites-circle"], type: "krMarineEnvSites" },
  { layers: ["kr-public-bicycle-stations-circle"], type: "krPublicBicycleStations" },
  { layers: ["kr-seoul-subway-congestion-circle"], type: "krSeoulSubwayCongestion" },
  { layers: ["kr-parking-lots-circle"], type: "krParkingLots" },
  { layers: ["kr-bridges-circle"], type: "krBridges" },
  { layers: ["kr-speed-cameras-circle"], type: "krSpeedCameras" },
  { layers: ["kr-child-protection-zones-circle"], type: "krChildProtectionZones" },
  { layers: ["kr-np-location-signs-circle"], type: "krNpLocationSigns" },
  { layers: ["kr-urban-parks-circle"], type: "krUrbanParks" },
  { layers: ["kr-sports-facilities-circle"], type: "krSportsFacilities" },
  { layers: ["kr-schools-circle"], type: "krSchools" },
  { layers: ["kr-hospitals-pharmacies-circle"], type: "krHospitalsPharmacies" },
  { layers: ["kr-fire-stations-circle"], type: "krFireStations" },
  { layers: ["kr-civil-defense-shelters-circle"], type: "krCivilDefenseShelters" },
  { layers: ["kr-police-boxes-circle"], type: "krPoliceBoxes" },
  { layers: ["kr-libraries-circle"], type: "krLibraries" },
  { layers: ["kr-museums-circle"], type: "krMuseums" },
  { layers: ["kr-performances-circle"], type: "krPerformances" },
  { layers: ["kr-festivals-circle"], type: "krFestivals" },
  { layers: ["kr-heritage-circle"], type: "krHeritage" },
  { layers: ["kr-lodging-circle"], type: "krLodging" },
  { layers: ["kr-safe-delivery-boxes-circle"], type: "krSafeDeliveryBoxes" },
  { layers: ["kr-senior-centers-circle"], type: "krSeniorCenters" },
  { layers: ["kr-noise-sites-circle"], type: "krNoiseSites" },
  { layers: ["kr-clothing-bins-circle"], type: "krClothingBins" },
  { layers: ["kr-animal-hospitals-circle"], type: "krAnimalHospitals" },
  { layers: ["kr-local-culture-centers-circle"], type: "krLocalCultureCenters" },
  { layers: ["kr-traditional-temples-circle"], type: "krTraditionalTemples" },
  { layers: ["kr-protected-trees-circle"], type: "krProtectedTrees" },
  { layers: ["kr-bicycle-parking-circle"], type: "krBicycleParking" },
  { layers: ["kr-civil-defense-water-circle"], type: "krCivilDefenseWater" },
  { layers: ["kr-emergency-bells-circle"], type: "krEmergencyBells" },
  { layers: ["kr-rural-experience-villages-circle"], type: "krRuralExperienceVillages" },
  { layers: ["kr-slaughterhouses-circle"], type: "krSlaughterhouses" },
  { layers: ["kr-np-trails-line"], type: "krNpTrails" },
  { layers: ["kr-territorial-sea-line"], type: "krTerritorialSea" },
  { layers: ["kr-rivers-osm-line", "kr-rivers-osm-major-line"], type: "krRiversOsm" },
  // 南韓第 1 波：點（機場 → 電廠 → 再生能源 → 變電所 → 燃料站 → 鐵道站 → 公車站 → 鐵塔）→ 線（電網、國道、鐵道）→ 面（油氣、港灣）
  { layers: ["kr-airports-circle"], type: "krAirports" },
  { layers: ["kr-power-plants-circle", "kr-power-plants-minor-circle"], type: "krPowerPlants" },
  { layers: ["kr-renewables-circle", "kr-renewables-minor-circle"], type: "krRenewables" },
  { layers: ["kr-substations-circle"], type: "krSubstations" },
  { layers: ["kr-fuel-stations-circle"], type: "krFuelStations" },
  { layers: ["kr-rail-stations-circle"], type: "krRailStations" },
  { layers: ["kr-oil-gas-pts-facility-circle", "kr-oil-gas-pts-pipeline-circle", "kr-oil-gas-point", "kr-oil-gas-pipelines-line", "kr-oil-gas-line", "kr-oil-gas-fill"], type: "krOilGas" },
  ],
  2: [
  { layers: ["kr-bus-stops-circle"], type: "krBusStops" },
  { layers: ["kr-power-towers-circle"], type: "krPowerTowers" },
  { layers: ["kr-power-lines-line", "kr-power-cables-line"], type: "krPowerLines" },
  { layers: ["kr-national-roads-line"], type: "krNationalRoads" },
  { layers: ["kr-rail-lines-line"], type: "krRailLines" },
  { layers: ["kr-ports-line", "kr-ports-fill"], type: "krPorts" },
  // 南韓面層（海洋保護區、國家公園、墓園、工業區、漁場、首爾分區）：排在所有點、線之後，避免吃掉點擊
  { layers: ["kr-marine-protected-areas-fill"], type: "krMarineProtectedAreas" },
  { layers: ["kr-national-parks-fill"], type: "krNationalParks" },
  { layers: ["kr-cemeteries-osm-fill"], type: "krCemeteriesOsm" },
  { layers: ["kr-industrial-complexes-fill"], type: "krIndustrialComplexes" },
  { layers: ["kr-fishing-grounds-fill"], type: "krFishingGrounds" },
  { layers: ["kr-seoul-zoning-fill"], type: "krSeoulZoning" },
  // 南韓 KRH-1：垃圾排出規則（掛行政界 sgg 面）排在行政界之前，同開時先命中規則；生態自然圖 17 個 시·도 分片＋空錨點
  { layers: [...KR_WASTE_CLICK_LAYER_IDS], type: "krWasteDisposalRules" },
  { layers: [...KR_ECO_CLICK_LAYER_IDS], type: "krEcologyNaturalness" },
  // 南韓：三層級一次只開一層
  { layers: ["kr-admin-emd-fill", "kr-admin-sgg-fill", "kr-admin-sido-fill"], type: "krAdminBoundaries" },
  ],
  3: [
  // 南韓人口 H3 格：覆蓋全國的面，排在南韓點線 entry 之前會搶走設施點擊 → 放面層段
  { layers: ["kr-population-h3-fill"], type: "krPopulationH3" },
  { layers: ["kr-school-districts-fill"], type: "krSchoolDistricts" },
  ],
  // <codemod:append KR_PACK_CLICK_SLOTS>
};
