import { COMPARISON_STATISTICS_KEYS } from '../../../data/comparisonStatisticsKeys';
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../../../data/layerManifest";
import { STATISTICS_TAB_CHOROPLETH_LAYER_KEYS, STATISTICS_TAB_THEMES, withoutStatisticsLayers } from "../layerCatalog";
import { MAIN_THEMES, getThemeLayerKeys } from "../../IconRailSidebar";
import { MOBILE_LAYER_PANELS, MOBILE_STATISTICS_ALL_OFF_KEYS } from "../../LayerSidebar";
import { JAPAN_THEMES, LAYER_PANELS, WORLD_THEMES } from "../layerPanels";
import { STATISTICS_DATA_THEMES, THEMES } from "../layerCatalog";
import { STATISTICS_RENDER_KEYS } from "../../../data/regionalStatisticsRecipes";
import { EDUCATION_PRESENTATION_VIEW_KEYS } from "../../../data/statisticsPresentationViews";
import { ENVIRONMENT_ENABLED_STATISTICS_KEYS } from "../../../data/environmentStatisticsRecipes";

const EXPECTED_THEME_STRUCTURE = [
  { title: "人口與教育 Population & Education", groups: ["人口動態", "教育與少子化"] },
  { title: "醫療與長照 Health & Care", groups: ["醫療與長照"] },
  { title: "犯罪與治安 Crime & Safety", groups: ["犯罪與治安"] },
  { title: "工作與所得 Work & Income", groups: ["戶籍村里／申報戶", "實際工作所在地", "居住地人力資源調查"] },
  { title: "住宅與不動產 Housing & Property", groups: ["住宅存量與使用", "不動產總市值"] },
  { title: "公共運輸 Public Transport", groups: ["建置量", "使用與營運", "自行車（臺北市，民國 110 年）", "航空運輸", "運輸補助"] },
  { title: "道路與車輛 Roads & Vehicles", groups: ["車輛登記存量", "道路安全與監測", "駕照與停車"] },
  { title: "交通用地 Transport Land", groups: ["交通用地"] },
  { title: "農林漁牧 Agriculture, Forestry & Fisheries", groups: ["農地與設施", "作物生產", "畜牧用地", "畜牧飼養", "漁業生產", "水產養殖", "森林用地"] },
  { title: "環境與資源 Environment & Resources", groups: ["用水與供水", "住宅用電", "廢棄物與回收", "水質與污水", "空氣品質", "污染與公害", "環境治理"] },
  { title: "地圖參考 Map Reference", groups: ["行政邊界"] },
];
const NON_EDUCATION_COMPARISON_KEYS = COMPARISON_STATISTICS_KEYS.filter(key => !key.startsWith('statsComparisonEducation'));
const layers = STATISTICS_TAB_THEMES.flatMap((theme) => theme.groups.flatMap((group) => group.layers));

const EXPECTED_LAYER_KEYS = [
  "statsLaborVillageIncomeMedian", "statsLaborCountyAnnualSalaryMedian", "statsLaborCountyLaborForce", "statsLaborCountyEmployment", "statsLaborCountyUnemployment", "statsLaborCountyNonLaborForce", "statsLaborCountyParticipationRate", "statsLaborCountyUnemploymentRate", "statsLaborCountyEmploymentByIndustry",
  "statsBirthsTownship",
  ...EDUCATION_PRESENTATION_VIEW_KEYS,
  "statsHealthHospitalCount", "statsHealthHospitalBedTotal", "statsHealthAcuteBedTotal", "statsHealthIcuBedTotal", "statsHealthHospiceBedTotal", "statsHealthHealthProfessionalTotal", "statsHealthWesternPhysicianCount", "statsHealthRegisteredNurseCount", "statsHealthNursingStaffListedAgeSexSum", "statsHealthCareWorkerListedSexSum", "statsHealthGeneralNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenInfantBeds", "statsHealthCareWorkerRegistration", "statsHealthMedicalInstitutionBedsPer10000Population", "statsHealthPracticingMedicalPersonnelPer10000Population",
  "statsHousingTotalCounty", "statsHousingOccupiedCounty", "statsHousingUnoccupiedCounty", "statsHousingOccasionalCounty", "statsHousingOtherUseCounty", "statsHousingUnusedCounty", "statsHousingResidenceOnlyCounty", "statsHousingMixedUseCounty", "statsHousingOccupiedPctCounty", "statsHousingUnusedPctCounty", "statsHousingTotalTownship", "statsHousingOccupiedTownship", "statsHousingUnoccupiedTownship", "statsHousingOccasionalTownship", "statsHousingOtherUseTownship", "statsHousingUnusedTownship", "statsHousingOccupiedPctTownship", "statsHousingUnusedPctTownship",
  "propertyValueAdmin",
  "crimeAreaMonthly",
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
  ...ENVIRONMENT_ENABLED_STATISTICS_KEYS,
  "countyBoundary", "townshipBoundary",
];

describe("STATISTICS_TAB_THEMES", () => {
  it("以十一個使用者主題（依 5 個大分類排序）與一致的小群組呈現", () => {
    expect(STATISTICS_TAB_THEMES.map((theme) => ({
      title: theme.title,
      groups: theme.groups.map((group) => group.title),
    }))).toEqual(EXPECTED_THEME_STRUCTURE);
  });

  it("只聚合目前已接線的行政區統計與邊界圖層，且沒有重複", () => {
    const keys = layers.map((layer) => layer.key);
    expect([...keys].sort()).toEqual([...EXPECTED_LAYER_KEYS, ...NON_EDUCATION_COMPARISON_KEYS].sort());
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
    expect(getThemeLayerKeys(STATISTICS_TAB_THEMES).sort()).toEqual([...EXPECTED_LAYER_KEYS, ...NON_EDUCATION_COMPARISON_KEYS].sort());
  });

  it("將衍生比較留在各原始主題與子群，而非另開比較清單", () => {
    const group = (themeTitle: string, groupTitle: string) => STATISTICS_TAB_THEMES
      .find(theme => theme.title === themeTitle)?.groups.find(candidate => candidate.title === groupTitle)?.layers.map(layer => layer.key) ?? [];
    expect(group("道路與車輛 Roads & Vehicles", "道路安全與監測")).toEqual(expect.arrayContaining([
      "statsComparisonA1DeathCountPer10000Residents", "statsComparisonA2AccidentCountPerKm2",
    ]));
    expect(group("道路與車輛 Roads & Vehicles", "車輛登記存量")).toContain("statsComparisonAutomobileRegisteredCountPer10000Residents");
    expect(group("道路與車輛 Roads & Vehicles", "駕照與停車")).toContain("statsComparisonOffstreetSmallCarParkingSpacesCountPer10000Residents");
    expect(group("公共運輸 Public Transport", "建置量").some(key => key.startsWith("statsComparison"))).toBe(true);
    expect(group("交通用地 Transport Land", "交通用地").some(key => key.startsWith("statsComparison"))).toBe(true);
    expect(group("醫療與長照 Health & Care", "醫療與長照").some(key => key.startsWith("statsComparison"))).toBe(true);
    expect(group("住宅與不動產 Housing & Property", "住宅存量與使用").some(key => key.startsWith("statsComparison"))).toBe(true);
    // 環境統計：raw 必在 ratio 之前（toggle 只在第一個成員渲染）。
    const pollution = group("環境與資源 Environment & Resources", "污染與公害");
    expect(pollution.indexOf("statsComplaintsCounty")).toBeLessThan(pollution.indexOf("statsComplaintsPer10kDerivedCounty"));
    expect(group("環境與資源 Environment & Resources", "環境治理")).toEqual(expect.arrayContaining(["statsEnvInspectionsCounty", "statsEnvFineRateCounty"]));
    expect(group("環境與資源 Environment & Resources", "廢棄物與回收")).toEqual(expect.arrayContaining(["statsWasteGeneratedCounty", "statsRecyclingPer10kCounty", "statsResponsibleEnterprisesCounty"]));
    expect(group("環境與資源 Environment & Resources", "廢棄物與回收")).toEqual(expect.arrayContaining([
      "statsComparisonWasteTotalVehiclesPerKm2", "statsComparisonWasteRecyclingVehiclesPer10000Residents",
    ]));
  });
});

describe("Layers 與 Statistics 分頁", () => {
  it("mobile 與桌機同一份四入口（台灣／統計／世界／日本）；四入口合起來涵蓋全部非統計主題，統計頁仍使用專屬索引", () => {
    const statisticsDataTitles = new Set(STATISTICS_DATA_THEMES.map(theme => theme.title));
    expect(MOBILE_LAYER_PANELS).toBe(LAYER_PANELS);
    expect(LAYER_PANELS.map(panel => panel.shortTitle)).toEqual(["台灣", "統計", "世界", "日本"]);
    expect(LAYER_PANELS.find(panel => panel.id === "statistics")!.themes).toBe(STATISTICS_TAB_THEMES);
    const nonStatisticsTitles = THEMES.filter(theme => !statisticsDataTitles.has(theme.title)).map(theme => theme.title).sort();
    expect([...MAIN_THEMES, ...WORLD_THEMES, ...JAPAN_THEMES].map(theme => theme.title).sort()).toEqual(nonStatisticsTitles);
    expect(new Set(MOBILE_STATISTICS_ALL_OFF_KEYS)).toEqual(new Set([...STATISTICS_RENDER_KEYS, ...getThemeLayerKeys(STATISTICS_TAB_THEMES)]));
  });

  it("中文統計主題只出現在 Statistics，原有一般圖層仍保留", () => {
    const mainKeys = getThemeLayerKeys(MAIN_THEMES);
    const statisticsKeys = getThemeLayerKeys(STATISTICS_TAB_THEMES);
    for (const key of EDUCATION_PRESENTATION_VIEW_KEYS) {
      expect(mainKeys).not.toContain(key);
      expect(statisticsKeys).toContain(key);
    }
    for (const key of COMPARISON_STATISTICS_KEYS.filter(key => key.startsWith('statsComparisonEducation'))) {
      expect(mainKeys).not.toContain(key);
      expect(statisticsKeys).not.toContain(key);
    }
    for (const key of COMPARISON_STATISTICS_KEYS) expect(mainKeys).not.toContain(key);
    expect(mainKeys).toContain("countyBoundary");
    expect(mainKeys).toContain("townshipBoundary");
    expect(mainKeys).not.toContain("crimeAreaMonthly");
    expect(mainKeys).not.toContain("propertyValueAdmin");
  });

  it("以共享 membership 從一般 Layers 排除統計面，保留行政邊界參考", () => {
    expect(STATISTICS_TAB_CHOROPLETH_LAYER_KEYS).toEqual(new Set(EXPECTED_LAYER_KEYS.filter((key) => key !== "countyBoundary" && key !== "townshipBoundary")));
    const filtered = withoutStatisticsLayers([
      { title: "混合主題", groups: [{ title: "資料", layers: layers.filter((layer) => ["statsBirthsTownship", "countyBoundary"].includes(layer.key)) }] },
    ]);
    expect(filtered).toEqual([
      { title: "混合主題", groups: [{ title: "資料", layers: [layers.find((layer) => layer.key === "countyBoundary")] }] },
    ]);
  });
});
