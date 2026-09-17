import type { LayerVisibility } from "../types";
import { COMPARISON_STATISTICS_KEYS, COMPARISON_UI_RECIPES } from './comparisonStatisticsRecipes';

export interface StatisticsToggleOption { key: keyof LayerVisibility; label: string; dimensionLabel?: string; }
export interface StatisticsToggleGroup { key: string; label: string; optionLabel?: string; options: readonly StatisticsToggleOption[]; }
const option = (key: string, label: string): StatisticsToggleOption => ({ key: key as keyof LayerVisibility, label });
const comparisonOptions = (indicator: string) => COMPARISON_UI_RECIPES
 .filter(recipe => recipe.indicator_id === indicator)
 .map(recipe => option(recipe.layer_key, recipe.optionLabel));
const metricGroup = (key: string, label: string, raw: string, indicator: string, extraIndicators: readonly string[] = []): StatisticsToggleGroup => ({
 key, label, optionLabel: '口徑', options: [option(raw, '原始數'), ...comparisonOptions(indicator), ...extraIndicators.flatMap(comparisonOptions)],
});

export const MEDICAL_STATISTICS_GROUPS = [
  metricGroup('hospitalCount', '醫院家數', 'statsHealthHospitalCount', 'hospital_count_per_10000_population_township', ['hospital_count_per_km2_township']),
  { key: "hospitalBeds", label: "醫院病床", optionLabel: '指標', options: [option("statsHealthHospitalBedTotal", "全部：原始數"), option("statsHealthAcuteBedTotal", "急性：原始數"), option("statsHealthIcuBedTotal", "加護：原始數"), option("statsHealthHospiceBedTotal", "安寧：原始數"), ...COMPARISON_UI_RECIPES.filter(r => /(?:hospital|acute|icu|hospice)_bed_total_per_(?:10000_population|km2)_township/.test(r.indicator_id)).map(r => option(r.layer_key, r.optionLabel))] },
  { key: "hospitalWorkforce", label: "醫院人力", optionLabel: '指標', options: [option("statsHealthHealthProfessionalTotal", "醫事人員總計：原始數"), option("statsHealthWesternPhysicianCount", "西醫師：原始數"), option("statsHealthRegisteredNurseCount", "護理師：原始數"), ...COMPARISON_UI_RECIPES.filter(r => /(?:health_professional_total|western_physician_count|registered_nurse_count)_per_(?:10000_population|km2)_township/.test(r.indicator_id)).map(r => option(r.layer_key, r.optionLabel))] },
  { key: 'nursingBeds65plus', label: '一般護理之家床位', optionLabel: '口徑', options: [option('statsHealthGeneralNursingHomeOpenBeds','開放床數'), ...COMPARISON_UI_RECIPES.filter(r => r.indicator_id==='general_nursing_home_open_beds_per_65plus_1000_county').map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))] },
  { key: 'careWorker65plus', label: '照顧服務員登錄', optionLabel: '口徑', options: [option('statsHealthCareWorkerRegistration','登錄數'), ...COMPARISON_UI_RECIPES.filter(r => r.indicator_id==='care_worker_registration_count_per_65plus_1000_county').map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))] },
  { key: 'postpartumBedsBirths', label: '產後護理床', optionLabel: '口徑', options: [option('statsHealthPostpartumNursingHomeOpenBeds','開放護理床數'), ...COMPARISON_UI_RECIPES.filter(r => r.indicator_id==='postpartum_nursing_home_open_beds_per_births_1000_county').map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))] },
  { key: 'postpartumInfantBedsBirths', label: '產後護理嬰兒床', optionLabel: '口徑', options: [option('statsHealthPostpartumNursingHomeOpenInfantBeds','開放嬰兒床數'), ...COMPARISON_UI_RECIPES.filter(r => r.indicator_id==='postpartum_nursing_home_open_infant_beds_per_births_1000_county').map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))] },
] as const satisfies readonly StatisticsToggleGroup[];

const HOUSING = [
 ['total','總住宅','statsHousingTotalCounty','statsHousingTotalTownship'], ['occupied','有人經常居住','statsHousingOccupiedCounty','statsHousingOccupiedTownship'], ['unoccupied','無人經常居住','statsHousingUnoccupiedCounty','statsHousingUnoccupiedTownship'], ['occasional','偶爾自住','statsHousingOccasionalCounty','statsHousingOccasionalTownship'], ['other_use','其他使用','statsHousingOtherUseCounty','statsHousingOtherUseTownship'], ['unused','閒置','statsHousingUnusedCounty','statsHousingUnusedTownship'],
] as const;
export const HOUSING_STATISTICS_GROUPS: StatisticsToggleGroup[] = HOUSING.map(([id,label,county,township]) => ({ key:`housing${id}`,label:`住宅：${label}`,optionLabel:'地理層級／口徑',options:[option(county,'縣市：原始數'),option(township,'鄉鎮：原始數'),...(id === 'occupied' ? [option('statsHousingOccupiedPctCounty','縣市：占總住宅比'),option('statsHousingOccupiedPctTownship','鄉鎮：占總住宅比')] : id === 'unused' ? [option('statsHousingUnusedPctCounty','縣市：占總住宅比'),option('statsHousingUnusedPctTownship','鄉鎮：占總住宅比')] : []),...COMPARISON_UI_RECIPES.filter(r=>r.indicator_id===`housing_${id}_share_pct_county`||r.indicator_id===`housing_${id}_share_pct_township`).map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))]}));
export const HOUSING_MIXED_STATISTICS_GROUP: StatisticsToggleGroup = { key:'housingMixedUse',label:'有人居住住宅用途',optionLabel:'指標',options:[option('statsHousingResidenceOnlyCounty','住宅專用（縣市原始數）'),option('statsHousingMixedUseCounty','兼農工服務業用（縣市原始數）'),...COMPARISON_UI_RECIPES.filter(r=>r.indicator_id==='housing_mixed_share_of_residential_or_mixed_pct_county').map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))] };

const LAND = [['AgriculturalFacility','農業生產設施','statsAgriculturalFacilityAreaTownship'],['AirportLand','機場','statsAirportLandAreaTownship'],['AquacultureLand','水產養殖','statsAquacultureLandAreaTownship'],['BambooForest','竹林','statsBambooForestAreaTownship'],['BroadleafForest','闊葉林','statsBroadleafForestAreaTownship'],['ConiferForest','針葉林','statsConiferForestAreaTownship'],['DryField','旱田','statsDryFieldAreaTownship'],['LivestockBuilding','畜禽舍','statsLivestockBuildingAreaTownship'],['MixedForest','混合林','statsMixedForestAreaTownship'],['Orchard','果園','statsOrchardAreaTownship'],['PaddyLand','水田','statsPaddyLandAreaTownship'],['Pasture','牧場','statsPastureAreaTownship'],['PortLand','港口','statsPortLandAreaTownship'],['RailLand','鐵路','statsRailLandAreaTownship'],['RoadLand','道路','statsRoadLandAreaTownship']] as const;
export const LAND_STATISTICS_GROUPS: StatisticsToggleGroup[] = LAND.map(([stem,label,raw])=>({key:`land${stem}`,label:`土地：${label}用地`,optionLabel:'地理層級／比較口徑',options:[option(raw,'鄉鎮：原始面積'),...COMPARISON_UI_RECIPES.filter(r=>r.layer_key.startsWith(`statsComparison${stem}`)).map(r=>option(r.layer_key, `${r.level === 'county' ? '縣市' : '鄉鎮'}：${r.optionLabel}`))]}));
export const BUS_STATISTICS_GROUPS: StatisticsToggleGroup[] = [
 metricGroup('busRouteLength', '期末營業里程', 'statsBusOperatingRouteLengthKm', 'bus_operating_route_length_km_per_10000_residents', ['bus_operating_route_length_km_per_km2']),
 metricGroup('busApprovedRoutes', '核定路線數', 'statsBusApprovedRouteCount', 'bus_approved_route_count_per_10000_residents', ['bus_approved_route_count_per_km2']),
 metricGroup('busOperators', '市區客運業家數', 'statsUrbanBusOperatorCount', 'urban_bus_operator_count_per_10000_residents', ['urban_bus_operator_count_per_km2']),
 metricGroup('busOperatingVehicles', '期末營業車輛', 'statsBusOperatingVehicleCount', 'bus_operating_vehicle_count_per_10000_residents', ['bus_operating_vehicle_count_per_km2']),
 metricGroup('busAccessible', '無障礙公車', 'statsBusAccessibleVehicleCount', 'bus_accessible_vehicle_count_per_10000_residents', ['bus_accessible_vehicle_count_per_km2', 'bus_accessible_share_pct']),
 metricGroup('busElectric', '電動公車', 'statsBusElectricVehicleCount', 'bus_electric_vehicle_count_per_10000_residents', ['bus_electric_vehicle_count_per_km2', 'bus_electric_share_pct']),
 metricGroup('busTrips', '營業行車次數', 'statsBusOperatingTripCount', 'bus_operating_trip_count_per_10000_residents', ['bus_operating_trip_count_per_km2']),
 metricGroup('busVehicleKm', '營業行車里程', 'statsBusOperatingVehicleKm', 'bus_operating_vehicle_km_per_10000_residents', ['bus_operating_vehicle_km_per_km2']),
];
export const TRANSPORT_STATISTICS_GROUPS: readonly StatisticsToggleGroup[] = [
 metricGroup('a1AccidentCount', 'A1 交通事故件數', 'statsA1AccidentCount', 'a1_accident_count_per_10000_residents', ['a1_accident_count_per_km2']),
 metricGroup('a1DeathCount', 'A1 交通事故死亡人數', 'statsA1DeathCount', 'a1_death_count_per_10000_residents', ['a1_death_count_per_km2']),
 metricGroup('a1InjuryCount', 'A1 交通事故受傷人數', 'statsA1InjuryCount', 'a1_injury_count_per_10000_residents', ['a1_injury_count_per_km2']),
 metricGroup('a2AccidentCount', 'A2 事故件數', 'statsComparisonA2AccidentCount', 'a2_accident_count_per_10000_residents', ['a2_accident_count_per_km2']),
 metricGroup('a2InjuryCount', 'A2 事故受傷人數', 'statsComparisonA2InjuryCount', 'a2_injury_count_per_10000_residents', ['a2_injury_count_per_km2']),
 metricGroup('a1a2AccidentCount', 'A1＋A2 事故件數', 'statsComparisonA1A2AccidentCount', 'a1_a2_accident_count_per_10000_residents', ['a1_a2_accident_count_per_km2']),
 metricGroup('offstreetParking', '小型汽車路外停車位', 'statsOffstreetSmallCarParkingSpacesCount', 'offstreet_small_car_parking_spaces_count_per_10000_residents'),
 metricGroup('onstreetParking', '小型汽車路邊停車位', 'statsOnstreetSmallCarParkingSpacesCount', 'onstreet_small_car_parking_spaces_count_per_10000_residents'),
 metricGroup('motorcycleRegistered', '機車登記數', 'statsMotorcycleRegisteredCount', 'motorcycle_registered_count_per_10000_residents'),
 metricGroup('automobileRegistered', '汽車登記數', 'statsAutomobileRegisteredCount', 'automobile_registered_count_per_10000_residents'),
 metricGroup('automobileLicenseHolders', '汽車駕照持有人數', 'statsAutomobileLicenseHoldersCount', 'automobile_license_holders_count_per_10000_residents'),
 metricGroup('motorcycleLicenseHolders', '機車駕照持有人數', 'statsMotorcycleLicenseHoldersCount', 'motorcycle_license_holders_count_per_10000_residents'),
];
export const WASTE_STATISTICS_GROUPS: readonly StatisticsToggleGroup[] = [
 metricGroup('wasteTotalVehicles', '垃圾清運車輛總數', 'statsWasteCounty', 'waste_total_vehicles_per_10000_residents', ['waste_total_vehicles_per_km2']),
 metricGroup('wasteRecyclingVehicles', '資源（含廚餘）回收車輛數', 'statsRecyclingCounty', 'waste_recycling_vehicles_per_10000_residents', ['waste_recycling_vehicles_per_km2']),
];
export const PRIMARY_STATISTICS_GROUPS: readonly StatisticsToggleGroup[] = [
 { key: 'livestockHeadAndFarm', label: '畜禽在養與場數', optionLabel: '指標', options: [option('statsLivestockHeadCountTownship', '在養數量'), option('statsLivestockFarmCountTownship', '飼養場數'), ...comparisonOptions('livestock_heads_per_farm_township')] },
 metricGroup('fisheryProduction', '漁業生產量', 'statsFisheryProductionCounty', 'fishery_production_tonnes_national_share_pct_county'),
 metricGroup('fisheryProductionValue', '漁業生產值', 'statsFisheryProductionValueCounty', 'fishery_value_thousand_national_share_pct_county'),
];
const COMPARISON_STATISTICS_KEY_SET = new Set<string>(COMPARISON_STATISTICS_KEYS);
const COMPARISON_UI_KEY_SET = new Set<string>(COMPARISON_UI_RECIPES.map(recipe => recipe.layer_key));
export const STATISTICS_TOGGLE_GROUPS: readonly StatisticsToggleGroup[] = [...MEDICAL_STATISTICS_GROUPS,...HOUSING_STATISTICS_GROUPS,HOUSING_MIXED_STATISTICS_GROUP,...LAND_STATISTICS_GROUPS,...BUS_STATISTICS_GROUPS,...TRANSPORT_STATISTICS_GROUPS,...WASTE_STATISTICS_GROUPS,...PRIMARY_STATISTICS_GROUPS]
 .map(group => ({ ...group, options: group.options.filter(option => !COMPARISON_STATISTICS_KEY_SET.has(String(option.key)) || COMPARISON_UI_KEY_SET.has(String(option.key))) }))
 .filter(group => group.options.length > 0);
export type MedicalStatisticsGroup = (typeof MEDICAL_STATISTICS_GROUPS)[number];
export type MedicalStatisticsGroupKey = MedicalStatisticsGroup['key'];
export type MedicalStatisticsOptionKey = keyof LayerVisibility;
export function getMedicalStatisticsGroup(key: string): StatisticsToggleGroup | undefined { return STATISTICS_TOGGLE_GROUPS.find(group=>group.key===key||group.options.some(option=>option.key===key)); }
export function resolveMedicalStatisticsGroupKey(group: StatisticsToggleGroup | string | undefined, visibility: Partial<LayerVisibility>, expandedKey?: string, preferredKey?: string): keyof LayerVisibility | null { const resolved=typeof group==='string'?getMedicalStatisticsGroup(group):group;if(!resolved)return null;const active=resolved.options.map(x=>x.key).filter(key=>visibility[key]);return (expandedKey&&active.includes(expandedKey as keyof LayerVisibility)?expandedKey as keyof LayerVisibility:preferredKey&&active.includes(preferredKey as keyof LayerVisibility)?preferredKey as keyof LayerVisibility:active[0])??null; }
