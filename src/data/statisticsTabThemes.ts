// 台灣統計圖層的分類正本（TWL-12 第 1 題甲案，2026-11-08）。
//
// 統計入口（`STATISTICS_TAB_THEMES`）與完整目錄（`THEMES`，資料來源總覽、圖層搜尋、Agent 與 manifest
// `section` 都讀它）原本是兩套分類；現在兩邊都從本檔的同一份清單派生：
//   - `TW_STATISTICS_PLACEMENT`：每個台灣統計 key 的 (主題, 群組)，manifest `section` 的來源。
//   - `twStatisticsThemeSpecs()`：依顯示順序排好的主題 → 群組 → key；layerCatalog 再換成 LayerDef。
// 本檔是資料層，不可 import layerManifest／layerCatalog（manifest 會 import 本檔）。
//
// 新增台灣統計層：把 key 放進下方對應群組（或讓 recipe 帶 tab_theme／tab_group），manifest 與兩份目錄會一起跟上。
// 舊的「資料主題」名稱（例「交通統計」「財稅與消費統計」）仍保留在 recipe 的 group／data_theme，作資料家族名、
// 搜尋詞（manifest topics）與資料來源標籤使用，不再是分類。
import { ATLAS_TAB_THEME_TITLES, atlasTabThemeGroups } from "./atlasStatisticsRecipes";
import { ENVIRONMENT_ENABLED_STATISTICS_RECIPES } from "./environmentStatisticsRecipes";
import { DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, demographicsTabGroupTitle } from "./demographicsStatisticsRecipes";
import { ADDICTION_ENABLED_STATISTICS_RECIPES, ADDICTION_STATISTICS_SUBGROUPS, ADDICTION_STATISTICS_TAB_THEME_TITLE } from "./addictionStatisticsRecipes";
import { LANDSLIDE_ENABLED_STATISTICS_RECIPES, LANDSLIDE_STATISTICS_SUBGROUPS, LANDSLIDE_STATISTICS_TAB_THEME_TITLE } from "./landslideStatisticsRecipes";
import { COMPARISON_ENABLED_RECIPES, COMPARISON_UI_RECIPES } from "./comparisonStatisticsRecipes";
import { EDUCATION_PRESENTATION_VIEW_KEYS } from "./statisticsPresentationViews";

export interface StatisticsGroupSpec { title: string; keys: string[] }
export interface StatisticsThemeSpec { title: string; groups: StatisticsGroupSpec[] }

/**
 * 統計「海洋」主題的識別字。台灣圖層另有 GIS 主題「海洋 Marine」，主題身分是 (country, title)，
 * 所以統計這邊用不同識別字，顯示名仍是「海洋」（layerCatalog `THEME_NAMES`、en／ja themes.json）。
 * 海洋 atlas recipe 的 `tab_theme` 仍寫「海洋 Marine」，由下方 `atlasTheme` 對應過來。
 */
export const MARINE_STATISTICS_THEME_TITLE = "海洋統計 Marine Statistics";

/** 教育 12 個固定學制 view 背後切換的指標：在完整目錄有位置（搜尋、Agent、資料來源總覽找得到），統計入口不列。 */
export const EDUCATION_METRIC_KEYS: readonly string[] = [
  "statsEducationCountyInstitutionCount", "statsEducationCountyTeacherCount", "statsEducationCountyStaffCount",
  "statsEducationCountyStudentCount", "statsEducationCountyClassCount", "statsEducationCountySmallSchoolCount",
  "statsEducationCountySmallSchoolSharePct", "statsEducationCountyStudentTeacherRatio", "statsEducationCountyStudentsPerClass",
  "statsEducationCountyStudentYearChange", "statsEducationCountyStudentYearChangePct",
];

type ComparisonRecipeLike = { layer_key: string; indicator_id: string; groupLabel: string };

/** 統計比較（衍生指標）跟著來源主題放；教育類比較是教育 view 的指標。 */
function comparisonGroupTitle(recipe: ComparisonRecipeLike): string {
  const id = recipe.indicator_id;
  if (id.startsWith("education_")) return "教育與少子化";
  return recipe.groupLabel === "醫療與長照" ? "醫療與長照"
    : id.startsWith("housing_") ? "住宅存量與使用"
    : /^(bus_operating_route_length|bus_approved_route)_/.test(id) ? "建置量"
    : /^(bus_operating_vehicle|bus_accessible_vehicle|bus_electric_vehicle)_/.test(id) ? "車輛登記存量"
    : /^(bus_|urban_bus_)/.test(id) ? "使用與營運"
    : /^(a1_|a2_|a1_a2_)/.test(id) ? "道路安全與監測"
    : /^(motorcycle_registered_count|automobile_registered_count)_/.test(id) ? "車輛登記存量"
    : /^(offstreet_small_car_parking_spaces_count|onstreet_small_car_parking_spaces_count|automobile_license_holders_count|motorcycle_license_holders_count)_/.test(id) ? "駕照與停車"
    : /^(waste_|recycling_)/.test(id) ? "廢棄物與回收"
    : /^(road_land|rail_land|airport_land|port_land)_/.test(id) ? "交通用地"
    : /^(conifer_forest|broadleaf_forest|bamboo_forest|mixed_forest)_/.test(id) ? "森林用地"
    : /^(livestock_building|pasture)_/.test(id) ? "畜牧用地"
    : id.startsWith("livestock_heads_") ? "畜牧飼養"
    : id.startsWith("fishery_") ? "漁業生產"
    : id.startsWith("aquaculture_") ? "水產養殖" : "農地與設施";
}

const atlasGroups = (tabTheme: string): StatisticsGroupSpec[] => atlasTabThemeGroups(tabTheme).map(({ title, keys }) => ({ title, keys: [...keys] }));
const atlasTheme = (tabTheme: string, title = tabTheme): StatisticsThemeSpec => ({ title, groups: atlasGroups(tabTheme) });

/** 同標題併入既有群組末尾，沒有同標題才新增（環境與資源用）。 */
function mergeGroups(base: StatisticsGroupSpec[], extra: StatisticsGroupSpec[]): StatisticsGroupSpec[] {
  const merged = base.map((group) => ({ ...group, keys: [...group.keys] }));
  for (const group of extra) {
    const host = merged.find((candidate) => candidate.title === group.title);
    if (host) host.keys.push(...group.keys);
    else merged.push({ ...group, keys: [...group.keys] });
  }
  return merged;
}

/** 戶籍人口→年齡結構→人口動態→遷徙→原住民→外來人口；「每月出生數（歷史快照）」併入「人口動態」末尾。 */
function demographicsGroups(): StatisticsGroupSpec[] {
  const titles = [...new Set(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map(demographicsTabGroupTitle))];
  const groups = titles.map((title) => ({ title, keys: DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((recipe) => demographicsTabGroupTitle(recipe) === title).map((recipe) => recipe.layer_key) }));
  const dynamics = groups.find((group) => group.title === "人口動態");
  if (dynamics) dynamics.keys.push("statsBirthsTownship");
  else groups.push({ title: "人口動態", keys: ["statsBirthsTownship"] });
  return groups;
}

const environmentKeys = (tabGroup: string) => ENVIRONMENT_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.tab_group === tabGroup).map((recipe) => recipe.layer_key);

/**
 * 台灣統計主題（顯示順序＝統計入口順序；「地圖參考」不在這裡，由 layerCatalog 只加在統計入口）。
 * @param comparisons 要放進來的統計比較 recipe（統計入口只放已發布的，manifest 放全部）。
 * @param includeEducationMetrics 是否把教育 view 背後的指標（含教育類統計比較）放進「教育與少子化」。
 */
function buildThemeSpecs(comparisons: readonly ComparisonRecipeLike[], includeEducationMetrics: boolean): StatisticsThemeSpec[] {
  const themes: StatisticsThemeSpec[] = [
    { title: "人口與教育 Population & Education", groups: [
      ...demographicsGroups(),
      { title: "教育與少子化", keys: [...EDUCATION_PRESENTATION_VIEW_KEYS, ...(includeEducationMetrics ? EDUCATION_METRIC_KEYS : [])] },
      ...atlasGroups("人口與教育 Population & Education"),
    ] },
    { title: "醫療與長照 Health & Care", groups: [
      { title: "醫療與長照", keys: [
        "statsHealthHospitalCount", "statsHealthHospitalBedTotal", "statsHealthAcuteBedTotal", "statsHealthIcuBedTotal", "statsHealthHospiceBedTotal", "statsHealthHealthProfessionalTotal", "statsHealthWesternPhysicianCount", "statsHealthRegisteredNurseCount", "statsHealthNursingStaffListedAgeSexSum", "statsHealthCareWorkerListedSexSum", "statsHealthGeneralNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenBeds", "statsHealthPostpartumNursingHomeOpenInfantBeds", "statsHealthCareWorkerRegistration", "statsHealthMedicalInstitutionBedsPer10000Population", "statsHealthPracticingMedicalPersonnelPer10000Population",
      ] },
      ...atlasGroups("醫療與長照 Health & Care"),
    ] },
    { title: ADDICTION_STATISTICS_TAB_THEME_TITLE, groups: ADDICTION_STATISTICS_SUBGROUPS.map((title) => ({ title, keys: ADDICTION_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.subgroup === title).map((recipe) => recipe.layer_key) })) },
    atlasTheme(ATLAS_TAB_THEME_TITLES.crime),
    atlasTheme(ATLAS_TAB_THEME_TITLES.sports),
    atlasTheme(ATLAS_TAB_THEME_TITLES.culture),
    { title: "工作與所得 Work & Income", groups: [
      { title: "戶籍村里／申報戶", keys: ["statsLaborVillageIncomeMedian"] },
      { title: "實際工作所在地", keys: ["statsLaborCountyAnnualSalaryMedian"] },
      { title: "居住地人力資源調查", keys: [
        "statsLaborCountyLaborForce", "statsLaborCountyEmployment", "statsLaborCountyUnemployment", "statsLaborCountyNonLaborForce",
        "statsLaborCountyParticipationRate", "statsLaborCountyUnemploymentRate", "statsLaborCountyEmploymentByIndustry",
      ] },
      ...atlasGroups("工作與所得 Work & Income"),
    ] },
    { title: "住宅與不動產 Housing & Property", groups: [
      { title: "住宅存量與使用", keys: [
        "statsHousingTotalCounty", "statsHousingOccupiedCounty", "statsHousingUnoccupiedCounty", "statsHousingOccasionalCounty", "statsHousingOtherUseCounty", "statsHousingUnusedCounty", "statsHousingResidenceOnlyCounty", "statsHousingMixedUseCounty", "statsHousingOccupiedPctCounty", "statsHousingUnusedPctCounty",
        "statsHousingTotalTownship", "statsHousingOccupiedTownship", "statsHousingUnoccupiedTownship", "statsHousingOccasionalTownship", "statsHousingOtherUseTownship", "statsHousingUnusedTownship", "statsHousingOccupiedPctTownship", "statsHousingUnusedPctTownship",
      ] },
      { title: "不動產總市值", keys: ["propertyValueAdmin"] },
      ...atlasGroups("住宅與不動產 Housing & Property"),
    ] },
    atlasTheme(ATLAS_TAB_THEME_TITLES.fiscal),
    { title: "公共運輸 Public Transport", groups: [
      { title: "建置量", keys: ["statsBusOperatingRouteLengthKm", "statsBusApprovedRouteCount"] },
      { title: "使用與營運", keys: ["statsUrbanBusOperatorCount", "statsBusOperatingTripCount", "statsBusOperatingVehicleKm", "statsTmrtStationOutboundCounty"] },
      { title: "自行車（臺北市，民國 110 年）", keys: [
        "statsTaipeiUrbanRentalStations", "statsTaipeiUrbanRentalTrips", "statsTaipeiRiversideRentalStations", "statsTaipeiRiversideBicycles", "statsTaipeiRiversideRentalTrips",
      ] },
      { title: "航空運輸", keys: [
        "statsAirportTakeoffsLandings", "statsAirportPassengerMovements", "statsAirportCargoTonnes",
        "statsTaoyuanAirportArrivals", "statsTaoyuanAirportDepartures", "statsTaoyuanAirportTransit", "statsTaoyuanAirportPassengerMovements",
      ] },
      { title: "運輸補助", keys: ["statsMaritimeSubsidyCounty", "statsCivilAeronauticsSubsidyCounty"] },
    ] },
    { title: "道路與車輛 Roads & Vehicles", groups: [
      { title: "車輛登記存量", keys: ["statsBusOperatingVehicleCount", "statsBusAccessibleVehicleCount", "statsBusElectricVehicleCount", "statsMotorcycleRegisteredCount", "statsAutomobileRegisteredCount"] },
      { title: "道路安全與監測", keys: ["statsA1AccidentCount", "statsA1DeathCount", "statsA1InjuryCount", "statsTaipeiTrafficViolationCitations", "statsTaichungRoadNoiseMonitoringStations"] },
      { title: "駕照與停車", keys: ["statsOffstreetSmallCarParkingSpacesCount", "statsOnstreetSmallCarParkingSpacesCount", "statsAutomobileLicenseHoldersCount", "statsMotorcycleLicenseHoldersCount"] },
    ] },
    { title: "交通用地 Transport Land", groups: [
      { title: "交通用地", keys: ["statsRoadLandAreaTownship", "statsRailLandAreaTownship", "statsAirportLandAreaTownship", "statsPortLandAreaTownship"] },
    ] },
    { title: "農林漁牧 Agriculture, Forestry & Fisheries", groups: [
      { title: "農地與設施", keys: ["statsPaddyLandAreaTownship", "statsDryFieldAreaTownship", "statsOrchardAreaTownship", "statsAgriculturalFacilityAreaTownship"] },
      { title: "作物生產", keys: ["statsRiceHarvest", "statsCropPlantedAreaTownship", "statsCropHarvestedAreaTownship", "statsCropProductionTownship", "statsCropYieldTownship"] },
      { title: "畜牧用地", keys: ["statsLivestockBuildingAreaTownship", "statsPastureAreaTownship"] },
      { title: "畜牧飼養", keys: ["statsLivestockFarmCountTownship", "statsLivestockHeadCountTownship"] },
      { title: "漁業生產", keys: ["statsFisheryProductionCounty", "statsFisheryProductionValueCounty"] },
      { title: "水產養殖", keys: ["statsAquacultureLandAreaTownship", "statsAquacultureAreaCounty"] },
      { title: "森林用地", keys: ["statsConiferForestAreaTownship", "statsBroadleafForestAreaTownship", "statsBambooForestAreaTownship", "statsMixedForestAreaTownship"] },
      ...atlasGroups("農林漁牧 Agriculture, Forestry & Fisheries"),
    ] },
    { title: "環境與資源 Environment & Resources", groups: mergeGroups([
      { title: "用水與供水", keys: ["statsPigWaterCounty", "statsWaterSupplyHistorical"] },
      { title: "住宅用電", keys: ["statsResidentialElectricity"] },
      { title: "廢棄物與回收", keys: ["statsWasteCounty", "statsRecyclingCounty", "statsWasteRecyclingRate", ...environmentKeys("廢棄物與回收")] },
      ...["水質與污水", "空氣品質", "污染與公害", "環境治理"].map((title) => ({ title, keys: environmentKeys(title) })),
    ], atlasGroups("環境與資源 Environment & Resources")) },
    { title: LANDSLIDE_STATISTICS_TAB_THEME_TITLE, groups: LANDSLIDE_STATISTICS_SUBGROUPS.map((title) => ({ title, keys: LANDSLIDE_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.subgroup === title).map((recipe) => recipe.layer_key) })) },
    atlasTheme(ATLAS_TAB_THEME_TITLES.hazard),
    atlasTheme(ATLAS_TAB_THEME_TITLES.marine, MARINE_STATISTICS_THEME_TITLE),
  ];
  // 衍生指標跟著來源主題：放進第一個同名群組末尾。教育類比較只在列出教育指標時放。
  for (const recipe of comparisons) {
    if (recipe.indicator_id.startsWith("education_") && !includeEducationMetrics) continue;
    const title = comparisonGroupTitle(recipe);
    const group = themes.flatMap((theme) => theme.groups).find((candidate) => candidate.title === title);
    if (!group) throw new Error(`[statisticsTabThemes] 統計比較 ${recipe.layer_key} 找不到群組「${title}」`);
    group.keys.push(recipe.layer_key);
  }
  return themes;
}

/** 統計入口：只列已發布的統計比較，不列教育 view 背後的指標。 */
export function twStatisticsTabThemeSpecs(): StatisticsThemeSpec[] {
  return buildThemeSpecs(COMPARISON_UI_RECIPES, false);
}

/** 完整目錄（THEMES）：已發布的統計比較＋教育 view 背後的指標。 */
export function twStatisticsCatalogThemeSpecs(): StatisticsThemeSpec[] {
  return buildThemeSpecs(COMPARISON_UI_RECIPES, true);
}

/** 台灣統計主題 title（`THEME_SCOPE.TW` 與 `MAIN_THEMES` 排除用）。 */
export const TW_STATISTICS_THEME_TITLES: readonly string[] = buildThemeSpecs([], true).map((theme) => theme.title);

/** key → (主題, 群組)：manifest `section` 的來源。含全部統計比較（不論是否發布）。 */
export const TW_STATISTICS_PLACEMENT: Readonly<Record<string, { theme: string; group: string }>> = (() => {
  const out: Record<string, { theme: string; group: string }> = {};
  for (const theme of buildThemeSpecs(COMPARISON_ENABLED_RECIPES, true)) {
    for (const group of theme.groups) {
      for (const key of group.keys) {
        if (out[key]) throw new Error(`[statisticsTabThemes] ${key} 出現在兩個位置`);
        out[key] = { theme: theme.title, group: group.title };
      }
    }
  }
  return out;
})();

/** 台灣統計層的 manifest section；沒登記就報錯（新統計層必須先在本檔找到位置）。 */
export function twStatisticsSection(key: string): { theme: string; group: string } {
  const placement = TW_STATISTICS_PLACEMENT[key];
  if (!placement) throw new Error(`[statisticsTabThemes] ${key} 沒有統計分類位置`);
  return placement;
}
