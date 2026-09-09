import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../../../data/layerManifest";
import { STATISTICS_TAB_THEMES } from "../layerCatalog";
import { getThemeLayerKeys } from "../../IconRailSidebar";

const EXPECTED_THEME_STRUCTURE = [
  { title: "人口與社會 People & Society", groups: ["人口動態", "犯罪與治安"] },
  { title: "交通與運輸 Transport", groups: ["大眾運輸", "自行車（臺北市，民國 110 年）", "道路安全與監測", "車輛與停車", "航空運輸", "運輸補助", "交通用地"] },
  { title: "農林漁牧 Agriculture, Forestry & Fisheries", groups: ["農地與設施", "作物生產", "畜牧用地", "畜牧飼養", "漁業生產", "水產養殖", "森林用地"] },
  { title: "環境與資源 Environment & Resources", groups: ["用水與供水", "住宅用電", "廢棄物與回收"] },
  { title: "地圖參考 Map Reference", groups: ["行政邊界"] },
];

const EXPECTED_LAYER_KEYS = [
  "statsBirthsTownship", "crimeAreaMonthly",
  "statsBusOperatingRouteLengthKm", "statsBusApprovedRouteCount", "statsUrbanBusOperatorCount", "statsBusOperatingVehicleCount", "statsBusAccessibleVehicleCount", "statsBusElectricVehicleCount", "statsBusOperatingTripCount", "statsBusOperatingVehicleKm", "statsTmrtStationOutboundCounty",
  "statsTaipeiUrbanRentalStations", "statsTaipeiUrbanRentalTrips", "statsTaipeiRiversideRentalStations", "statsTaipeiRiversideBicycles", "statsTaipeiRiversideRentalTrips",
  "statsA1AccidentCount", "statsA1DeathCount", "statsA1InjuryCount", "statsTaipeiTrafficViolationCitations", "statsTaichungRoadNoiseMonitoringStations",
  "statsOffstreetSmallCarParkingSpacesCount", "statsOnstreetSmallCarParkingSpacesCount", "statsMotorcycleRegisteredCount", "statsAutomobileRegisteredCount", "statsAutomobileLicenseHoldersCount", "statsMotorcycleLicenseHoldersCount",
  "statsAirportTakeoffsLandings", "statsAirportPassengerMovements", "statsAirportCargoTonnes", "statsTaoyuanAirportArrivals", "statsTaoyuanAirportDepartures", "statsTaoyuanAirportTransit", "statsTaoyuanAirportPassengerMovements",
  "statsMaritimeSubsidyCounty", "statsCivilAeronauticsSubsidyCounty",
  "statsRoadLandAreaTownship", "statsRailLandAreaTownship", "statsAirportLandAreaTownship", "statsPortLandAreaTownship",
  "statsPaddyLandAreaTownship", "statsDryFieldAreaTownship", "statsOrchardAreaTownship", "statsAgriculturalFacilityAreaTownship",
  "statsRiceHarvest", "statsCropPlantedAreaTownship", "statsCropHarvestedAreaTownship", "statsCropProductionTownship", "statsCropYieldTownship",
  "statsLivestockBuildingAreaTownship", "statsPastureAreaTownship", "statsLivestockFarmCountTownship", "statsLivestockHeadCountTownship",
  "statsFisheryProductionCounty", "statsFisheryProductionValueCounty", "statsAquacultureLandAreaTownship", "statsAquacultureAreaCounty",
  "statsConiferForestAreaTownship", "statsBroadleafForestAreaTownship", "statsBambooForestAreaTownship", "statsMixedForestAreaTownship",
  "statsPigWaterCounty", "statsWaterSupplyHistorical", "statsResidentialElectricity",
  "statsWasteCounty", "statsRecyclingCounty", "statsWasteRecyclingRate",
  "countyBoundary", "townshipBoundary",
];

describe("STATISTICS_TAB_THEMES", () => {
  const layers = STATISTICS_TAB_THEMES.flatMap((theme) => theme.groups.flatMap((group) => group.layers));

  it("以五個使用者主題與一致的小群組呈現", () => {
    expect(STATISTICS_TAB_THEMES.map((theme) => ({
      title: theme.title,
      groups: theme.groups.map((group) => group.title),
    }))).toEqual(EXPECTED_THEME_STRUCTURE);
  });

  it("只聚合目前已接線的行政區統計與邊界圖層，且沒有重複", () => {
    const keys = layers.map((layer) => layer.key);
    expect(keys).toEqual(EXPECTED_LAYER_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("顯示文字仍由既有 manifest 派生", () => {
    for (const layer of layers) {
      const manifest = LAYER_MANIFEST[layer.key];
      expect(manifest.section).not.toBeNull();
      if (manifest.section !== null) expect(layer.label).toBe(manifest.label);
    }
  });

  it("All Off scope 只包含統計入口的圖層", () => {
    expect(getThemeLayerKeys(STATISTICS_TAB_THEMES)).toEqual(EXPECTED_LAYER_KEYS);
  });
});
