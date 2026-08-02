import { useEffect, useMemo, useRef, useState } from "react";
import type { ExpandableLayerKey, BusCity, BusColorMode, BusGroup } from "../types";
import { BUS_GROUP_CITIES, BUS_GROUP_LABELS, WASTE_GROUP_CITIES } from "../types";
import { CROP_SUITABILITY_CROPS } from "../data/cropSuitabilityCrops";
import { FARM_HIGHLIGHT_OPTIONS } from "../data/livestockTypes";
import { FIRE_ISOCHRONE_COUNTY_OPTIONS } from "../data/fireIsochroneCounties";
import {
  SOIL_FERTILITY_METRIC_OPTIONS,
  type SoilFertilityMetric,
} from "../data/agriSoilFertilityMetrics";
import {
  FACILITY_MEDIA, PENALTY_MEDIA, POLLUTION_MEDIUM_LABELS, SEVERITY_BANDS,
  pollutionYearOptions, PENALTY_MODE_OPTIONS, PENALTY_YEAR_MIN, PENALTY_YEAR_MAX,
  type PollutionMedium,
} from "../data/pollutionTypes";
import {
  PROTECTED_TREE_CITIES, RIVERSIDE_PARKS, TAIPEI_PARK_CATEGORIES,
  STREET_TREE_3EPOCH_TRAJ_FILTERS,
  STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES,
} from "../data/urbanOpenSpaceTypes";
import { BUILDINGS_GBA_MODES } from "../data/buildingsGbaTypes";
import { URBAN_FORM_GRID_MODES } from "../data/urbanFormGridTypes";
import { MICRO_SENSOR_MODES } from "../data/microSensorTypes";
import { URBAN_HEAT_MODES } from "../data/urbanHeatTypes";
import { PROPERTY_VALUE_SCALES, PROPERTY_VALUE_GRID_MODES } from "../data/propertyValueTypes";
import { URBAN_ZONING_CATEGORIES } from "../data/urbanZoningTypes";
import { DEITY_FAMILIES, REGISTRY_MODES, REGISTRY_MODES_ANCESTRAL } from "../data/religionTypes";
import { CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES } from "../data/cultureTypes";

export interface SliderConfig {
  type?: "slider";
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

export interface ToggleConfig {
  type: "toggle";
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export interface SelectConfig {
  type: "select";
  label: string;
  value: string;
  /** disabled：該選項當下不可選（如 propertyValueGrid 人均模式在 150m 尺度）；label 自帶原因說明 */
  options: { label: string; value: string; disabled?: boolean }[];
  onChange: (v: string) => void;
}

export type ParamControl = SliderConfig | ToggleConfig | SelectConfig;

// 132 種作物 dropdown helper（給 agriCropSuitability layer 用）
function buildCropSelector(currentId: number, setId: (v: number) => void): ParamControl[] {
  const fallback = CROP_SUITABILITY_CROPS[0];
  if (!fallback) return [];
  const current = CROP_SUITABILITY_CROPS.find((c) => c.id === currentId) ?? fallback;
  return [
    {
      type: "select" as const,
      label: `作物 ${current.nameZh}`,
      value: String(currentId),
      options: CROP_SUITABILITY_CROPS.map((c) => ({
        label: `${c.nameZh} (${c.nameEn})`,
        value: String(c.id),
      })),
      onChange: (v: string) => setId(parseInt(v, 10)),
    },
  ];
}

export function useTransportParams() {
  // Flight
  const [altExaggeration, setAltExaggeration] = useState(3);
  const [altOffset, setAltOffset] = useState(50);
  const [staticOpacity, setStaticOpacity] = useState(0.1);
  const [orbScale, setOrbScale] = useState(0.000005);
  const [airportOpacity, setAirportOpacity] = useState(0.12);
  const [airportGlow, setAirportGlow] = useState(0.8);
  // Ship
  const [shipOrbScale, setShipOrbScale] = useState(0.000003);
  const [shipTrailOpacity, setShipTrailOpacity] = useState(0.15);
  // Rail
  const [railAltOffset, setRailAltOffset] = useState(110);
  const [railOrbScale, setRailOrbScale] = useState(0.00001);
  const [railTrackOpacity, setRailTrackOpacity] = useState(0.35);
  const [railTrainVisible, setRailTrainVisible] = useState(true);
  const [railTrackMode, setRailTrackMode] = useState<"2d" | "3d">("3d");
  const [stationScale, setStationScale] = useState(1);
  // Bus
  const [busScale, setBusScale] = useState(0.4);
  const [busOrbScale, setBusOrbScale] = useState(0.000004);
  // Bus groups（UI 層的 8 區域分組，全台）
  const [busGroups, setBusGroups] = useState<Record<BusGroup, boolean>>({
    TaipeiMetro:          true,
    KeelungYilan:         false,
    TaoyuanHsinchuMiaoli: false,
    CentralTaiwan:        false,
    YunChiaNan:           false,
    Kaoping:              false,
    HualienTaitung:       false,
    OffshoreIslands:      false,
  });
  // busCities 實際傳給 RPC 的展開值（BusGroup → BusCity[]）
  const enabledBusCities = useMemo<BusCity[]>(
    () => (Object.entries(busGroups) as [BusGroup, boolean][])
      .filter(([, v]) => v)
      .flatMap(([g]) => BUS_GROUP_CITIES[g]),
    [busGroups],
  );
  const setBusGroup = (group: BusGroup, v: boolean) =>
    setBusGroups((p) => ({ ...p, [group]: v }));

  // 垃圾車表定 schedule groups（8 區，預設全 ON = 22 城）
  const [wasteScheduleGroups, setWasteScheduleGroups] = useState<Record<BusGroup, boolean>>({
    TaipeiMetro:          true,
    KeelungYilan:         true,
    TaoyuanHsinchuMiaoli: true,
    CentralTaiwan:        true,
    YunChiaNan:           true,
    Kaoping:              true,
    HualienTaitung:       true,
    OffshoreIslands:      true,
  });
  const enabledWasteScheduleCities = useMemo<string[]>(
    () => (Object.entries(wasteScheduleGroups) as [BusGroup, boolean][])
      .filter(([, v]) => v)
      .flatMap(([g]) => WASTE_GROUP_CITIES[g]),
    [wasteScheduleGroups],
  );
  const setWasteScheduleGroup = (group: BusGroup, v: boolean) =>
    setWasteScheduleGroups((p) => ({ ...p, [group]: v }));
  const [busColorMode, setBusColorMode] = useState<BusColorMode>("route");
  const [busAltOffset, setBusAltOffset] = useState(0);
  // Bus InterCity（獨立參數，預設沿用市區公車初值）
  const [busIntercityOrbScale, setBusIntercityOrbScale] = useState(0.000004);
  const [busIntercityColorMode, setBusIntercityColorMode] = useState<BusColorMode>("route");
  const [busIntercityAltOffset, setBusIntercityAltOffset] = useState(0);
  // 台灣好行 Tourist Shuttle（獨立參數，含 opacity slider）
  const [touristShuttleOrbScale, setTouristShuttleOrbScale] = useState(0.000004);
  const [touristShuttleColorMode, setTouristShuttleColorMode] = useState<BusColorMode>("route");
  const [touristShuttleAltOffset, setTouristShuttleAltOffset] = useState(0);
  const [touristShuttleOpacity, setTouristShuttleOpacity] = useState(0.85);
  // Bike
  const [bikeScale, setBikeScale] = useState(1);
  // Cycling
  const [cyclingWidth, setCyclingWidth] = useState(1);
  // Freeway
  const [freewayWidth, setFreewayWidth] = useState(1);
  // 省道路況 v1（PMTiles + feature-state 染色）
  const [roadCongestionWidth, setRoadCongestionWidth] = useState(1);
  const [roadCongestionOpacity, setRoadCongestionOpacity] = useState(0.85);
  // CCTV（道路攝影機 靜態點）
  const [cctvScale, setCctvScale] = useState(1);
  const [cctvOpacity, setCctvOpacity] = useState(0.7);
  const [cctvZ, setCctvZ] = useState(0);
  // 消防分隊（靜態點）
  const [fireStationsScale, setFireStationsScale] = useState(1);
  const [fireStationsOpacity, setFireStationsOpacity] = useState(0.85);
  const [fireStationsZ, setFireStationsZ] = useState(0);
  // 消防分隊兩種呈現各自開關：散點 (Mapbox circle) / 3D 光柱+漣漪 (Three.js)
  const [fireStationsDots, setFireStationsDots] = useState(true);
  const [fireStations3D, setFireStations3D] = useState(true);
  // 消防栓（靜態點）
  const [fireHydrantsScale, setFireHydrantsScale] = useState(1);
  const [fireHydrantsOpacity, setFireHydrantsOpacity] = useState(0.7);
  const [fireHydrantsZ, setFireHydrantsZ] = useState(0);
  // ── 警政司法民防 17 layer（每個 opacity + scale；polygon/line 走 fill/line-width）──
  const [policeStationOpacity, setPoliceStationOpacity] = useState(0.85);
  const [policeStationScale, setPoliceStationScale] = useState(1);
  const [womenChildWarningOpacity, setWomenChildWarningOpacity] = useState(0.9);
  const [womenChildWarningScale, setWomenChildWarningScale] = useState(1);
  const [speedCameraOpacity, setSpeedCameraOpacity] = useState(0.85);
  const [speedCameraScale, setSpeedCameraScale] = useState(1);
  const [speedZoneSegmentOpacity, setSpeedZoneSegmentOpacity] = useState(0.85);
  const [speedZoneSegmentWidth, setSpeedZoneSegmentWidth] = useState(1);
  const [courtOpacity, setCourtOpacity] = useState(0.9);
  const [courtScale, setCourtScale] = useState(1);
  const [prosecutorsOfficeOpacity, setProsecutorsOfficeOpacity] = useState(0.9);
  const [prosecutorsOfficeScale, setProsecutorsOfficeScale] = useState(1);
  const [correctionalFacilityOpacity, setCorrectionalFacilityOpacity] = useState(0.9);
  const [correctionalFacilityScale, setCorrectionalFacilityScale] = useState(1);
  const [courtJurisdictionOpacity, setCourtJurisdictionOpacity] = useState(0.18);
  const [aquaculturePondsOpacity, setAquaculturePondsOpacity] = useState(0.5);
  const [aquacultureZoneOpacity, setAquacultureZoneOpacity] = useState(0.35);
  const [aquacultureCageNetOpacity, setAquacultureCageNetOpacity] = useState(0.4);
  const [aquacultureWaterSatelliteOpacity, setAquacultureWaterSatelliteOpacity] = useState(0.5);
  const [aquacultureWaterSatelliteConfidence, setAquacultureWaterSatelliteConfidence] = useState<string>("all"); // all / reservoir / certain（累積式信心篩選）
  const [aquacultureWaterSatelliteMoaOpacity, setAquacultureWaterSatelliteMoaOpacity] = useState(0.55);
  // display_class 三組類別篩選 checkbox：確認 / 漁電共生 / 其他（unverified+ambiguous+mountain_suspect）。預設全開。
  const [aquacultureWaterSatelliteMoaShowConfirmed, setAquacultureWaterSatelliteMoaShowConfirmed] = useState(true);
  const [aquacultureWaterSatelliteMoaShowSolar, setAquacultureWaterSatelliteMoaShowSolar] = useState(true);
  const [aquacultureWaterSatelliteMoaShowOther, setAquacultureWaterSatelliteMoaShowOther] = useState(true);
  const [aquacultureWaterUnionOpacity, setAquacultureWaterUnionOpacity] = useState(0.55);
  // union_class 三組類別篩選 checkbox：兩版都有 / 只官方 MOA / 只舊版 OSM。預設全開。
  const [aquacultureWaterUnionShowBoth, setAquacultureWaterUnionShowBoth] = useState(true);
  const [aquacultureWaterUnionShowMoaOnly, setAquacultureWaterUnionShowMoaOnly] = useState(true);
  const [aquacultureWaterUnionShowOsmOnly, setAquacultureWaterUnionShowOsmOnly] = useState(true);
  const [aquacultureIntegratedOpacity, setAquacultureIntegratedOpacity] = useState(0.6);
  const [streetTreesTaipeiDiffOpacity, setStreetTreesTaipeiDiffOpacity] = useState(0.7);
  const [streetTreesTaipeiDiffStatus, setStreetTreesTaipeiDiffStatus] = useState<string>("all"); // all / disappeared / changed
  const [streetTreesTaipeiDiffRadius, setStreetTreesTaipeiDiffRadius] = useState(0.5); // 點位大小縮放倍率
  const [streetTreesTaipeiDiffColorMode, setStreetTreesTaipeiDiffColorMode] = useState<string>("status"); // status / species / diameter / height
  // 都市開放空間三層（受保護樹木 / 河濱喬木 / 台北公園）
  const [protectedTreesNationalOpacity, setProtectedTreesNationalOpacity] = useState(0.85);
  const [protectedTreesNationalRadius, setProtectedTreesNationalRadius] = useState(1);
  const [protectedTreesNationalColorMode, setProtectedTreesNationalColorMode] = useState<string>("age"); // age / city
  const [protectedTreesNationalCity, setProtectedTreesNationalCity] = useState<string>("all"); // all / 8 城市名
  const [riversideTreesTaipeiOpacity, setRiversideTreesTaipeiOpacity] = useState(0.85);
  const [riversideTreesTaipeiRadius, setRiversideTreesTaipeiRadius] = useState(1);
  const [riversideTreesTaipeiPark, setRiversideTreesTaipeiPark] = useState<string>("all"); // all / 30 座河濱公園名
  const [parksTaipeiOpacity, setParksTaipeiOpacity] = useState(0.85);
  const [parksTaipeiRadius, setParksTaipeiRadius] = useState(1);
  const [parksTaipeiCategory, setParksTaipeiCategory] = useState<string>("all"); // all / 7 種分類
  // 🎭 文化 Culture 四層
  const [culturalFacilitiesOpacity, setCulturalFacilitiesOpacity] = useState(0.9);
  const [culturalFacilitiesRadius, setCulturalFacilitiesRadius] = useState(1);
  const [culturalFacilitiesType, setCulturalFacilitiesType] = useState<string>("all"); // all / 6 類 facility_type
  const [culturalMuseumsOpacity, setCulturalMuseumsOpacity] = useState(0.9);
  const [culturalMuseumsRadius, setCulturalMuseumsRadius] = useState(1);
  const [culturalMuseumsType, setCulturalMuseumsType] = useState<string>("all"); // all / 5 類 type
  const [artsEventsOpacity, setArtsEventsOpacity] = useState(0.85);
  const [artsEventsRadius, setArtsEventsRadius] = useState(1);
  const [artsEventsStatus, setArtsEventsStatus] = useState<string>("all"); // all / ongoing / upcoming
  const [performingVenuesOpacity, setPerformingVenuesOpacity] = useState(0.85);
  const [performingVenuesRadius, setPerformingVenuesRadius] = useState(1);
  // 🧳 觀光 Tourism 12 層（點層 opacity 0.85 + scale 1；面層 opacity 0.5；select 存字串，overlayParams 轉 Idx）
  const [tourAttractionsOpacity, setTourAttractionsOpacity] = useState(0.85);
  const [tourAttractionsScale, setTourAttractionsScale] = useState(1);
  const [tourAttractionsMode, setTourAttractionsMode] = useState<string>("category"); // category / heat
  const [tourHotSpringsOpacity, setTourHotSpringsOpacity] = useState(0.85);
  const [tourHotSpringsScale, setTourHotSpringsScale] = useState(1);
  const [tourHotSpringZonesOpacity, setTourHotSpringZonesOpacity] = useState(0.5);
  const [tourScenicAreasOpacity, setTourScenicAreasOpacity] = useState(0.5);
  const [tourHeritageOpacity, setTourHeritageOpacity] = useState(0.85);
  const [tourHeritageScale, setTourHeritageScale] = useState(1);
  // 🛕 宗教 Religion 6 層（百景由 tourReligion 更名而來，預設值沿用）
  const [religionTemplesOpacity, setReligionTemplesOpacity] = useState(0.8);
  const [religionTemplesScale, setReligionTemplesScale] = useState(1);
  const [religionTemplesRegistry, setReligionTemplesRegistry] = useState<string>("all");
  const [religionTemplesDeity, setReligionTemplesDeity] = useState<string>("all");
  const [religionChurchesOpacity, setReligionChurchesOpacity] = useState(0.85);
  const [religionChurchesScale, setReligionChurchesScale] = useState(1);
  const [religionChurchesRegistry, setReligionChurchesRegistry] = useState<string>("all");
  const [religionAncestralHallsOpacity, setReligionAncestralHallsOpacity] = useState(0.9);
  const [religionAncestralHallsScale, setReligionAncestralHallsScale] = useState(1);
  const [religionAncestralHallsRegistry, setReligionAncestralHallsRegistry] = useState<string>("all");
  const [religionFoundationsOpacity, setReligionFoundationsOpacity] = useState(0.9);
  const [religionFoundationsScale, setReligionFoundationsScale] = useState(1);
  const [religionOtherWorshipOpacity, setReligionOtherWorshipOpacity] = useState(0.85);
  const [religionOtherWorshipScale, setReligionOtherWorshipScale] = useState(1);
  const [religionTop100Opacity, setReligionTop100Opacity] = useState(0.85);
  const [religionTop100Scale, setReligionTop100Scale] = useState(1);
  const [tourEventsOpacity, setTourEventsOpacity] = useState(0.85);
  const [tourEventsScale, setTourEventsScale] = useState(1);
  const [tourEventsStatus, setTourEventsStatus] = useState<string>("all"); // all / ongoing / upcoming
  const [tourFactoriesOpacity, setTourFactoriesOpacity] = useState(0.85);
  const [tourFactoriesScale, setTourFactoriesScale] = useState(1);
  const [tourAmusementParksOpacity, setTourAmusementParksOpacity] = useState(0.85);
  const [tourAmusementParksScale, setTourAmusementParksScale] = useState(1);
  const [tourCampingOpacity, setTourCampingOpacity] = useState(0.85);
  const [tourCampingScale, setTourCampingScale] = useState(1);
  const [tourHotelsOpacity, setTourHotelsOpacity] = useState(0.85);
  const [tourHotelsScale, setTourHotelsScale] = useState(1);
  const [tourHotelsClass, setTourHotelsClass] = useState<string>("all"); // all / 1 / 2 / 3 / 4
  const [tourRestaurantsOpacity, setTourRestaurantsOpacity] = useState(0.85);
  const [tourRestaurantsScale, setTourRestaurantsScale] = useState(1);
  // 行道樹三時點（traj 7 類/樹種/胸徑/樹高四染色模式 + 軌跡篩選）
  const [streetTreesTaipei3epochOpacity, setStreetTreesTaipei3epochOpacity] = useState(0.7);
  const [streetTreesTaipei3epochRadius, setStreetTreesTaipei3epochRadius] = useState(0.5); // 點位大小縮放倍率
  const [streetTreesTaipei3epochColorMode, setStreetTreesTaipei3epochColorMode] = useState<string>("traj"); // traj / species / diameter / height
  const [streetTreesTaipei3epochTrajFilter, setStreetTreesTaipei3epochTrajFilter] = useState<string>("all"); // STREET_TREE_3EPOCH_TRAJ_FILTERS values
  // 行道樹全國（樹種/胸徑/樹高/城市四染色模式 + 城市篩選）
  const [streetTreesNationalOpacity, setStreetTreesNationalOpacity] = useState(0.7);
  const [streetTreesNationalRadius, setStreetTreesNationalRadius] = useState(0.5); // 點位大小縮放倍率
  const [streetTreesNationalColorMode, setStreetTreesNationalColorMode] = useState<string>("species"); // species / diameter / height / city
  const [streetTreesNationalCity, setStreetTreesNationalCity] = useState<string>("all"); // all / taipei / taichung
  // 台北人行道樹穴（pit_type 樹穴/花圃二色 fill + 類型篩選）
  const [treePitsTaipeiOpacity, setTreePitsTaipeiOpacity] = useState(0.55);
  const [treePitsTaipeiType, setTreePitsTaipeiType] = useState<string>("all"); // all / 樹穴 / 花圃
  // GBA 全台建物輪廓（0=高度分級 1=資料來源 2=3D 立體 3=夜景燈光 4=估值；高度門檻篩選 + 透明度）
  const [buildingsGbaModeIdx, setBuildingsGbaModeIdx] = useState(0);
  const [buildingsGbaMinHeight, setBuildingsGbaMinHeight] = useState(0);
  const [buildingsGbaOpacity, setBuildingsGbaOpacity] = useState(0.75);
  // 夜景燈光 mode 3 專用：≥N m 高樓額外給 Three.js additive bloom 光暈（視野內取最高前 4096 棟）
  const [buildingsGbaBloomMinHeight, setBuildingsGbaBloomMinHeight] = useState(100);
  // 都市紋理網格（0-5：棟數/平均高度/總量體/建蔽率/樹冠覆蓋/灰綠指數；預設 5=灰綠指數）
  const [urbanFormGridModeIdx, setUrbanFormGridModeIdx] = useState(5);
  const [urbanFormGridOpacity, setUrbanFormGridOpacity] = useState(0.55);
  // 🏢 房地產總市值網格（150m 格，v_mkt 總市值 6 級染色）
  // 控件組照人口網格（h3Population / popCount）慣例：Opacity → Contrast → 3D → Height。
  // Contrast 0.5–4 預設 1.8 完全沿用；Height step 10 沿用但上限 200 → **400**
  // （2026-07-27 高度映射改用資料真實 max 當上錨、不再 100 億封頂後，對數範圍變寬 42%，
  //   同一 scale 下整體變矮 → 拉高上限讓「要誇張可以更誇張」）。
  // Height 預設 40（滿格 4,000m）：新映射下 p50 ≈ 245m、p99 ≈ 2,040m、max 4,000m，
  // 中段觀感與舊版（CAP 封頂 / scale 20）相當，但頂端不再撞平頂。
  // 尺度：0=150m 細格 / 1=450m 中格 / 2=1.5km 粗格（**手動選，不隨 zoom 自動切**）。
  // 三份 PMTiles 各自的斷點與 3D 高度錨見 PROPERTY_VALUE_SCALES；
  // 切尺度不重置 Contrast/Height（正規化各吃各的錨，滑桿語意跨尺度一致）。
  const [propertyValueGridScaleIdx, setPropertyValueGridScaleIdx] = useState(0);
  // 上色模式：0=總市值（預設）/ 1=人均市值。人均只在帶 pop 的 450m/1.5km 有效；
  // 150m 時選項 disabled（**不自動跳尺度**），有效模式由 resolvePropertyValueGridMode() 回退。
  const [propertyValueGridModeIdx, setPropertyValueGridModeIdx] = useState(0);
  const [propertyValueGridOpacity, setPropertyValueGridOpacity] = useState(0.7);
  const [propertyValueGridContrast, setPropertyValueGridContrast] = useState(1.8);
  const [propertyValueGridExtruded, setPropertyValueGridExtruded] = useState(false);
  const [propertyValueGridElevationScale, setPropertyValueGridElevationScale] = useState(40);
  // 🗺️ 都市計畫土地使用分區（北市 + 新北）：category select（all / 9 類）+ 透明度
  const [urbanZoningTaipeiOpacity, setUrbanZoningTaipeiOpacity] = useState(0.5);
  const [urbanZoningTaipeiCategory, setUrbanZoningTaipeiCategory] = useState<string>("all"); // all / 9 類 zone_category
  const [urbanZoningNewTaipeiOpacity, setUrbanZoningNewTaipeiOpacity] = useState(0.5);
  const [urbanZoningNewTaipeiCategory, setUrbanZoningNewTaipeiCategory] = useState<string>("all"); // all / 9 類 zone_category
  const [lakesPondsOsmOpacity, setLakesPondsOsmOpacity] = useState(0.5);
  const [crimeAreaMonthlyOpacity, setCrimeAreaMonthlyOpacity] = useState(0.55);
  const [theftTaoyuanOpacity, setTheftTaoyuanOpacity] = useState(0.8);
  const [theftTaoyuanScale, setTheftTaoyuanScale] = useState(1);
  const [trafficAccidentYearlyOpacity, setTrafficAccidentYearlyOpacity] = useState(0.85);
  const [trafficAccidentYearlyScale, setTrafficAccidentYearlyScale] = useState(1);
  const [accidentTaipeiOpacity, setAccidentTaipeiOpacity] = useState(0.7);
  const [accidentTaipeiScale, setAccidentTaipeiScale] = useState(1);
  const [a1AccidentRealtimeOpacity, setA1AccidentRealtimeOpacity] = useState(0.95);
  const [a1AccidentRealtimeScale, setA1AccidentRealtimeScale] = useState(1);
  const [investigationBureauOpacity, setInvestigationBureauOpacity] = useState(0.9);
  const [investigationBureauScale, setInvestigationBureauScale] = useState(1);
  const [antiCorruptionOfficeOpacity, setAntiCorruptionOfficeOpacity] = useState(0.9);
  const [antiCorruptionOfficeScale, setAntiCorruptionOfficeScale] = useState(1);
  const [immigrationOfficeOpacity, setImmigrationOfficeOpacity] = useState(0.9);
  const [immigrationOfficeScale, setImmigrationOfficeScale] = useState(1);
  const [coastGuardStationOpacity, setCoastGuardStationOpacity] = useState(0.85);
  const [coastGuardStationScale, setCoastGuardStationScale] = useState(1);
  const [civilDefenseShelterOpacity, setCivilDefenseShelterOpacity] = useState(0.7);
  const [civilDefenseShelterScale, setCivilDefenseShelterScale] = useState(1);
  // 警察覆蓋分析 isochrone × 3 layer（每 layer 含 mode + minutes select）
  const [policeIsoSubstationOpacity, setPoliceIsoSubstationOpacity] = useState(0.55);
  const [policeIsoSubstationMode, setPoliceIsoSubstationMode] = useState<"walk" | "drive">("walk");
  const [policeIsoSubstationMinutes, setPoliceIsoSubstationMinutes] = useState<"5" | "10">("5");
  const [policeIsoPrecinctOpacity, setPoliceIsoPrecinctOpacity] = useState(0.5);
  const [policeIsoPrecinctMode, setPoliceIsoPrecinctMode] = useState<"walk" | "drive">("drive");
  const [policeIsoPrecinctMinutes, setPoliceIsoPrecinctMinutes] = useState<"15" | "30">("15");
  const [policeIsoCityDeptOpacity, setPoliceIsoCityDeptOpacity] = useState(0.45);
  const [policeIsoCityDeptMode, setPoliceIsoCityDeptMode] = useState<"walk" | "drive">("drive");
  const [policeIsoCityDeptMinutes, setPoliceIsoCityDeptMinutes] = useState<"30" | "60">("30");
  // ── 環境污染 POLLUTION ──
  // 設施：opacity + scale + 5 介質 filter（勾選 → 只顯示登記該介質的設施）+ 最低嚴重度門檻
  const [pollutionFacilityOpacity, setPollutionFacilityOpacity] = useState(0.8);
  const [pollutionFacilityScale, setPollutionFacilityScale] = useState(1);
  const [pollutionFacilityMedia, setPollutionFacilityMedia] = useState<Record<PollutionMedium, boolean>>({
    air: true, water: true, waste: true, toxic: true, soil: true, noise: false, other: false,
  });
  const [pollutionFacilityMinSev, setPollutionFacilityMinSev] = useState(0);
  // 裁處事件：opacity + scale + medium select + 年份 + 模式（累積/單年）+ 播放
  const [pollutionPenaltyOpacity, setPollutionPenaltyOpacity] = useState(0.75);
  const [pollutionPenaltyScale, setPollutionPenaltyScale] = useState(1);
  const [pollutionPenaltyMediumIdx, setPollutionPenaltyMediumIdx] = useState(0); // 0 = 全部
  // 預設「只有今年」：今年（clamp 到資料年份範圍）+ 僅該年模式。
  const [pollutionPenaltyYear, setPollutionPenaltyYear] = useState(
    Math.min(PENALTY_YEAR_MAX, Math.max(PENALTY_YEAR_MIN, new Date().getFullYear())),
  );
  const [pollutionPenaltyMode, setPollutionPenaltyMode] = useState(1);           // 0 = 累積、1 = 僅該年（預設僅今年）
  const [pollutionPenaltyPlaying, setPollutionPenaltyPlaying] = useState(false);
  // 場址：opacity + scale + 只看列管中
  const [pollutionSiteOpacity, setPollutionSiteOpacity] = useState(0.9);
  const [pollutionSiteScale, setPollutionSiteScale] = useState(1);
  const [pollutionSiteActiveOnly, setPollutionSiteActiveOnly] = useState(true);

  const setPollutionFacilityMedium = (m: PollutionMedium, v: boolean) =>
    setPollutionFacilityMedia((p) => ({ ...p, [m]: v }));

  // 裁處事件歷史播放引擎：從起始年逐年推進到 2026 後停（比照火災事件的自動播放）。
  useEffect(() => {
    if (!pollutionPenaltyPlaying) return;
    const id = setInterval(() => {
      setPollutionPenaltyYear((y) => {
        const cur = y === 0 ? PENALTY_YEAR_MIN : y;
        if (cur >= PENALTY_YEAR_MAX) {
          setPollutionPenaltyPlaying(false);
          return PENALTY_YEAR_MAX;
        }
        return cur + 1;
      });
    }, 1100);
    return () => clearInterval(id);
  }, [pollutionPenaltyPlaying]);
  // 救援等時圈（覆蓋聯集填色透明度 + 縣市篩選，"all" = 全台）
  const [fireIsochroneOpacity, setFireIsochroneOpacity] = useState(0.5);
  const [fireIsochroneCounty, setFireIsochroneCounty] = useState("all");
  // 火災事件點位（歷史 / 最新年度）
  const [fireEventsOpacity, setFireEventsOpacity] = useState(1);
  const [fireLatestOpacity, setFireLatestOpacity] = useState(1);
  // 醫療基礎點位 5 類（PMTiles 散點，各自 opacity + scale）
  const [medHospitalOpacity, setMedHospitalOpacity] = useState(0.9);
  const [medHospitalScale, setMedHospitalScale] = useState(1.0);
  const [medClinicOpacity, setMedClinicOpacity] = useState(0.85);
  const [medClinicScale, setMedClinicScale] = useState(1.0);
  const [medPharmacyOpacity, setMedPharmacyOpacity] = useState(0.85);
  const [medPharmacyScale, setMedPharmacyScale] = useState(1.0);
  const [medAEDOpacity, setMedAEDOpacity] = useState(0.9);
  const [medAEDScale, setMedAEDScale] = useState(1.0);
  const [medLTCOpacity, setMedLTCOpacity] = useState(0.85);
  const [medLTCScale, setMedLTCScale] = useState(1.0);
  // 醫療等時圈 + 醫療沙漠（共用 opacity slider）
  const [medIsochroneOpacity, setMedIsochroneOpacity] = useState(0.5);
  // 急診壅塞（當下快照，僅 opacity slider）
  const [erHospitalOpacity, setErHospitalOpacity] = useState(0.85);
  // 北市圖即時座位（當下快照，僅 opacity slider）
  const [librarySeatsOpacity, setLibrarySeatsOpacity] = useState(0.9);
  // 停車 Parking（當下快照，各自 opacity slider）
  const [parkingOnstreetOpacity, setParkingOnstreetOpacity] = useState(0.6);
  const [parkingOffstreetOpacity, setParkingOffstreetOpacity] = useState(0.9);
  // ETC Gantry（收費門架 靜態點）
  const [etcGantryScale, setEtcGantryScale] = useState(1);
  const [etcGantryOpacity, setEtcGantryOpacity] = useState(0.8);
  const [etcGantryZ, setEtcGantryZ] = useState(0);
  // Service Area（國道服務區 靜態點）
  const [serviceAreaScale, setServiceAreaScale] = useState(1.4);
  const [serviceAreaOpacity, setServiceAreaOpacity] = useState(0.85);
  const [serviceAreaZ, setServiceAreaZ] = useState(0);
  // Service Area Polygon（國道服務區範圍 面）
  const [serviceAreaPolygonOpacity, setServiceAreaPolygonOpacity] = useState(0.2);
  const [serviceAreaPolygonLineWidth, setServiceAreaPolygonLineWidth] = useState(1.5);
  // Taxi Stand（計程車招呼站 靜態點）
  const [taxiStandScale, setTaxiStandScale] = useState(1);
  const [taxiStandOpacity, setTaxiStandOpacity] = useState(0.8);
  const [taxiStandZ, setTaxiStandZ] = useState(0);
  // Weather
  const [weatherScale, setWeatherScale] = useState(1);
  // Population Flow (H3)
  const [h3Opacity, setH3Opacity] = useState(0.6);
  const [h3Extruded, setH3Extruded] = useState(false);
  const [h3ElevationScale, setH3ElevationScale] = useState(50);
  const [h3Metric, setH3Metric] = useState<"day" | "night">("day");
  const [h3Contrast, setH3Contrast] = useState(1.8);
  // Population Count (SEGIS)
  const [pcOpacity, setPcOpacity] = useState(0.6);
  const [pcContrast, setPcContrast] = useState(1.8);
  const [pcExtruded, setPcExtruded] = useState(false);
  const [pcElevationScale, setPcElevationScale] = useState(50);
  // Population Indicators (SEGIS)
  const [indCategory, setIndCategory] = useState("count");
  const [indMetric, setIndMetric] = useState("hh");
  const [indOpacity, setIndOpacity] = useState(0.6);
  const [indContrast, setIndContrast] = useState(1.8);
  const [indExtruded, setIndExtruded] = useState(false);
  const [indElevationScale, setIndElevationScale] = useState(50);
  // Lighthouse
  const [lighthouseScale, setLighthouseScale] = useState(0.6);
  const [beamVisible, setBeamVisible] = useState(true);
  const [beamDistance, setBeamDistance] = useState(0.9);
  const [beamOpacity, setBeamOpacity] = useState(0.1);
  // Station pillar — 3 systems
  const [thsrPillarVisible, setThsrPillarVisible] = useState(true);
  const [thsrPillarHeight, setThsrPillarHeight] = useState(0.6);
  const [traPillarVisible, setTraPillarVisible] = useState(true);
  const [traPillarHeight, setTraPillarHeight] = useState(0.5);
  const [metroPillarVisible, setMetroPillarVisible] = useState(false);
  const [metroPillarHeight, setMetroPillarHeight] = useState(0.2);
  // Highway (國道)
  const [highwayWidth, setHighwayWidth] = useState(0.6);
  const [highwayGlow, setHighwayGlow] = useState(0.3);
  // Provincial Road (省道)
  const [provincialWidth, setProvincialWidth] = useState(0.6);
  const [provincialGlow, setProvincialGlow] = useState(0.2);
  // Port pillar (碼頭)
  const [portGlow, setPortGlow] = useState(1);
  const [portPillarVisible, setPortPillarVisible] = useState(false);
  const [portPillarHeight, setPortPillarHeight] = useState(0.3);
  // Airport pillar (機場)
  const [airportPillarVisible, setAirportPillarVisible] = useState(false);
  const [airportPillarHeight, setAirportPillarHeight] = useState(0.6);
  // Temperature Wave (溫度波浪)
  const [tempHeight, setTempHeight] = useState(200);
  const [tempZOffset, setTempZOffset] = useState(300);
  const [tempExtruded, setTempExtruded] = useState(true);
  const [tempOpacity, setTempOpacity] = useState(0.85);
  const [tempWireframe, setTempWireframe] = useState(false);
  // Temperature Grid (溫度網格 2D，與溫度波共用資料源)
  const [tempGridOpacity, setTempGridOpacity] = useState(0.7);
  // School
  const [schoolScale, setSchoolScale] = useState(1);
  const [schoolLevelColor, setSchoolLevelColor] = useState(false);
  // Convenience Store
  const [convenienceScale, setConvenienceScale] = useState(1);
  // Civic Facilities（公共設施 4 層）
  const [postOfficesOpacity, setPostOfficesOpacity] = useState(0.85);
  const [postOfficesScale, setPostOfficesScale] = useState(1);
  const [iPostBoxesOpacity, setIPostBoxesOpacity] = useState(0.85);
  const [iPostBoxesScale, setIPostBoxesScale] = useState(1);
  const [communityCentersOpacity, setCommunityCentersOpacity] = useState(0.85);
  const [communityCentersScale, setCommunityCentersScale] = useState(1);
  const [govServiceOfficesOpacity, setGovServiceOfficesOpacity] = useState(0.9);
  const [govServiceOfficesScale, setGovServiceOfficesScale] = useState(1);
  // Civic Facilities Batch 2（圖書館 / 社福 / 市場 / 公廁）
  const [publicLibrariesOpacity, setPublicLibrariesOpacity] = useState(0.9);
  const [publicLibrariesScale, setPublicLibrariesScale] = useState(1);
  const [welfareCentersOpacity, setWelfareCentersOpacity] = useState(0.9);
  const [welfareCentersScale, setWelfareCentersScale] = useState(1);
  const [retailMarketsOpacity, setRetailMarketsOpacity] = useState(0.9);
  const [retailMarketsScale, setRetailMarketsScale] = useState(1);
  const [publicToiletsOpacity, setPublicToiletsOpacity] = useState(0.75);
  const [publicToiletsScale, setPublicToiletsScale] = useState(1);
  // News Events
  const [newsScale, setNewsScale] = useState(1);
  const [newsTimeBased, setNewsTimeBased] = useState(true);
  const [newsRipple, setNewsRipple] = useState(true);
  // 新聞 filter（三軸，照 Intel Panel 設計）
  //   minRelevance: 0 全部 / 2 地方+ / 3 重大（對應 RPC p_min_gis_relevance）
  //   eventsOnly:   true 只看事件（對應 RPC p_require_event）
  //   minSeverity:  0 全部 / 1 個案+ / 2 區域+（對應 RPC p_min_severity）
  // 預設 (3, true, 1) ≈「重大」級 — 新聞 / 全部 tab 進來只看重大
  const [newsMinRelevance, setNewsMinRelevance] = useState<0 | 2 | 3>(3);
  const [newsEventsOnly, setNewsEventsOnly] = useState<boolean>(true);
  const [newsMinSeverity, setNewsMinSeverity] = useState<0 | 1 | 2>(1);
  // Socioeconomic (村里社經)
  const [socioCat, setSocioCat] = useState("income");
  const [socioMetric, setSocioMetric] = useState("im");
  const [socioOpacity, setSocioOpacity] = useState(0.6);
  const [socioContrast, setSocioContrast] = useState(1.8);
  const [socioExtruded, setSocioExtruded] = useState(false);
  const [socioElevation, setSocioElevation] = useState(50);
  // Spatial Economy (空間經濟)
  const [spatialCat, setSpatialCat] = useState("housing");
  const [spatialMetric, setSpatialMetric] = useState("hp");
  const [spatialOpacity, setSpatialOpacity] = useState(0.6);
  const [spatialContrast, setSpatialContrast] = useState(1.8);
  const [spatialExtruded, setSpatialExtruded] = useState(false);
  const [spatialElevation, setSpatialElevation] = useState(50);
  // CWA Imagery (衛星雲圖 / 雷達)
  const [cwaCloudOpacity, setCwaCloudOpacity] = useState(1.0);
  const [cwaRadarOpacity, setCwaRadarOpacity] = useState(0.85);
  // Earthquake
  const [eqOpacity, setEqOpacity] = useState(1.0);
  const [eqShowHistory, setEqShowHistory] = useState(false);
  // 地震回放（earthquakeReplay）
  const [eqReplayOpacity, setEqReplayOpacity] = useState(0.95);
  // Disaster Alerts
  const [daOpacity, setDaOpacity] = useState(1.0);
  // Road Events
  const [reOpacity, setReOpacity] = useState(1.0);
  // Satellites (3 cats share one opacity)
  const [satOpacity, setSatOpacity] = useState(1.0);
  // YouBike Fullness (H3)
  const [ybOpacity, setYbOpacity] = useState(0.65);
  const [ybContrast, setYbContrast] = useState(1);
  const [ybExtruded, setYbExtruded] = useState(true);
  const [ybElevationScale, setYbElevationScale] = useState(80);
  const [ybHeightMode, setYbHeightMode] = useState<"mixed" | "fullness" | "capacity">("mixed");
  const [ybResolution, setYbResolution] = useState(7);
  // LASS 微型感測器：cluster on/off
  const [aqiMicroCluster, setAqiMicroCluster] = useState(true);
  // LASS 微型感測器：點位上色依據（0=PM2.5 / 1=溫度 / 2=濕度，見 microSensorTypes）
  const [aqiMicroModeIdx, setAqiMicroModeIdx] = useState(0);
  // 都市熱島 raster：顯示模式（0=熱島強度 ΔT / 1=絕對地表溫度，見 urbanHeatTypes）+ 透明度
  const [urbanHeatModeIdx, setUrbanHeatModeIdx] = useState(0);
  const [urbanHeatOpacity, setUrbanHeatOpacity] = useState(0.75);
  // 淹水最小深度篩選：0 = 全部, 0.5 / 1 / 2 / 3 = 只顯示大於等於該深度的分級
  const [floodMinDepth, setFloodMinDepth] = useState<0 | 0.5 | 1 | 2 | 3>(0);
  // 水庫：僅保留 Three.js 水位計的高度縮放（2026-04-22 砍掉光球 + 靜態 pillar
  // 相關 slider：球透明度 / 光暈 / 大小）
  const [reservoirPillarHeight, setReservoirPillarHeight] = useState(1.0);
  // 其他水資源圖層參數
  const [waterBasinOpacity, setWaterBasinOpacity] = useState(1.0);
  const [waterRiverWidth, setWaterRiverWidth] = useState(1.0);
  const [waterRiverOpacity, setWaterRiverOpacity] = useState(1.0);
  const [waterCanalWidth, setWaterCanalWidth] = useState(1.0);
  const [waterCanalOpacity, setWaterCanalOpacity] = useState(1.0);
  const [waterLeveeWidth, setWaterLeveeWidth] = useState(1.0);
  const [waterLeveeOpacity, setWaterLeveeOpacity] = useState(1.0);
  const [waterProtectionZoneOpacity, setWaterProtectionZoneOpacity] = useState(1.0);
  const [waterFacilityScale, setWaterFacilityScale] = useState(1.0);
  const [waterFacilityOpacity, setWaterFacilityOpacity] = useState(1.0);
  const [waterMonitorScale, setWaterMonitorScale] = useState(1.0);
  const [waterMonitorOpacity, setWaterMonitorOpacity] = useState(1.0);
  const [detentionBasinScale, setDetentionBasinScale] = useState(1.0);
  const [detentionBasinOpacity, setDetentionBasinOpacity] = useState(1.0);
  const [waterFloodOpacity, setWaterFloodOpacity] = useState(1.0);
  // Phase 2 monitoring layers（即時雨量 / 河川水位 / 地下水井 / 水井點位）
  const [rainGaugeScale, setRainGaugeScale] = useState(1.0);
  const [rainGaugeOpacity, setRainGaugeOpacity] = useState(1.0);
  const [riverLevelScale, setRiverLevelScale] = useState(1.0);
  const [riverLevelOpacity, setRiverLevelOpacity] = useState(1.0);
  const [groundwaterScale, setGroundwaterScale] = useState(1.0);
  const [groundwaterOpacity, setGroundwaterOpacity] = useState(1.0);
  const [groundwaterWellsScale, setGroundwaterWellsScale] = useState(1.0);
  const [groundwaterWellsOpacity, setGroundwaterWellsOpacity] = useState(1.0);
  const [iotWraRiverScale, setIotWraRiverScale] = useState(1.0);
  const [iotWraRiverOpacity, setIotWraRiverOpacity] = useState(1.0);
  const [iotWraRiverShowMeasured, setIotWraRiverShowMeasured] = useState(true);
  const [iotWraRiverShowForecast, setIotWraRiverShowForecast] = useState(true);
  const [iotWraStructureScale, setIotWraStructureScale] = useState(1.0);
  // USWG 都市淹水感測器 + 累積雨量柵格
  const [floodSensorScale, setFloodSensorScale] = useState(1.0);
  const [floodSensorOpacity, setFloodSensorOpacity] = useState(1.0);
  const [floodSensorIsochroneOpacity, setFloodSensorIsochroneOpacity] = useState(0.55);
  // 北市水利處三本柱
  const [taipeiSewerScale, setTaipeiSewerScale] = useState(1.0);
  const [taipeiSewerOpacity, setTaipeiSewerOpacity] = useState(0.85);
  const [taipeiEvacuateScale, setTaipeiEvacuateScale] = useState(1.0);
  const [taipeiEvacuateOpacity, setTaipeiEvacuateOpacity] = useState(0.9);
  const [taipeiPumbScale, setTaipeiPumbScale] = useState(1.0);
  const [taipeiPumbOpacity, setTaipeiPumbOpacity] = useState(0.9);
  const [precipRasterOpacity, setPrecipRasterOpacity] = useState(0.6);
  const [precipRasterHours, setPrecipRasterHours] = useState<1 | 3 | 6 | 24>(24);
  // Waste（垃圾車光點 + 音符）
  const [wasteOrbScale, setWasteOrbScale] = useState(0.15);
  const [wasteNoteSize, setWasteNoteSize] = useState(0.7);
  const [wasteNoteZOffset, setWasteNoteZOffset] = useState(70);
  // wasteStopsStatic（全台清運點位 靜態散點）
  const [wasteStopsStaticScale, setWasteStopsStaticScale] = useState(1.0);
  const [wasteStopsStaticGlow, setWasteStopsStaticGlow] = useState(0.10);
  const [wasteStopsStaticZ, setWasteStopsStaticZ] = useState(0);
  const [iotWraStructureOpacity, setIotWraStructureOpacity] = useState(1.0);
  const [iotWraStructureFlow, setIotWraStructureFlow] = useState(true);
  const [iotWraStructureGate, setIotWraStructureGate] = useState(true);
  const [iotWraStructureDam, setIotWraStructureDam] = useState(true);
  const [iotWraStructureErosion, setIotWraStructureErosion] = useState(true);
  const [iotWraStructureDust, setIotWraStructureDust] = useState(true);
  // AQI 色階圖透明度
  const [aqiImageryOpacity, setAqiImageryOpacity] = useState(0.7);
  // Agriculture FTW 農田 (PMTiles)
  const [agricultureOpacity, setAgricultureOpacity] = useState(1.0);
  const [agricultureOutlineWidth, setAgricultureOutlineWidth] = useState(1.0);
  const [agricultureShowOutline, setAgricultureShowOutline] = useState(true);
  const [agricultureZ, setAgricultureZ] = useState(0);
  // Agriculture Phase 3 Batch 1 (5 PMTiles + 1 GeoJSON POI)
  const [agriSoilOpacity, setAgriSoilOpacity] = useState(1.0);
  const [agriSoilFertilityOpacity, setAgriSoilFertilityOpacity] = useState(1.0);
  const [agriSoilFertilityMetric, setAgriSoilFertilityMetric] = useState<SoilFertilityMetric>("health");
  const [agriLeisureFarmZonesOpacity, setAgriLeisureFarmZonesOpacity] = useState(1.0);
  const [agriRuralRegenOpacity, setAgriRuralRegenOpacity] = useState(1.0);
  const [agriCropSuitabilityOpacity, setAgriCropSuitabilityOpacity] = useState(1.0);
  const [agriCropSuitabilityCropId, setAgriCropSuitabilityCropId] = useState(0);
  const [agriPOIOpacity, setAgriPOIOpacity] = useState(1.0);
  const [agriPOIScale, setAgriPOIScale] = useState(1.0);
  // 農企業登記 3 類（GeoJSON 散點，opacity + scale）
  const [agriRetailOpacity, setAgriRetailOpacity] = useState(0.85);
  const [agriRetailScale, setAgriRetailScale] = useState(1.0);
  const [agriProduceWholesaleOpacity, setAgriProduceWholesaleOpacity] = useState(0.85);
  const [agriProduceWholesaleScale, setAgriProduceWholesaleScale] = useState(1.0);
  const [agriWholesaleMarketOpacity, setAgriWholesaleMarketOpacity] = useState(0.9);
  const [agriWholesaleMarketScale, setAgriWholesaleMarketScale] = useState(1.0);

  // 🐷 畜牧 Livestock（散點，opacity + scale；預設 scale 0.3 = 小點）
  const [livestockFarmPigOpacity, setLivestockFarmPigOpacity] = useState(0.85);
  const [livestockFarmPigScale, setLivestockFarmPigScale] = useState(0.3);
  const [livestockFarmChickenOpacity, setLivestockFarmChickenOpacity] = useState(0.85);
  const [livestockFarmChickenScale, setLivestockFarmChickenScale] = useState(0.3);
  const [livestockFarmCattleOpacity, setLivestockFarmCattleOpacity] = useState(0.85);
  const [livestockFarmCattleScale, setLivestockFarmCattleScale] = useState(0.3);
  const [livestockFarmDuckOpacity, setLivestockFarmDuckOpacity] = useState(0.85);
  const [livestockFarmDuckScale, setLivestockFarmDuckScale] = useState(0.3);
  const [livestockFarmGooseOpacity, setLivestockFarmGooseOpacity] = useState(0.85);
  const [livestockFarmGooseScale, setLivestockFarmGooseScale] = useState(0.3);
  const [livestockFarmSheepOpacity, setLivestockFarmSheepOpacity] = useState(0.85);
  const [livestockFarmSheepScale, setLivestockFarmSheepScale] = useState(0.3);
  const [livestockFarmOtherOpacity, setLivestockFarmOtherOpacity] = useState(0.85);
  const [livestockFarmOtherScale, setLivestockFarmOtherScale] = useState(0.3);
  const [livestockSlaughterOpacity, setLivestockSlaughterOpacity] = useState(0.9);
  const [livestockSlaughterScale, setLivestockSlaughterScale] = useState(1.0);
  const [livestockFeedOpacity, setLivestockFeedOpacity] = useState(0.9);
  const [livestockFeedScale, setLivestockFeedScale] = useState(1.0);
  const [livestockMarketOpacity, setLivestockMarketOpacity] = useState(0.95);
  const [livestockMarketScale, setLivestockMarketScale] = useState(1.0); // 21 家全國拍賣樞紐，醒目大點
  // 飼養場品項高亮（index into FARM_HIGHLIGHT_OPTIONS；0 = 全部，不高亮）
  const [livestockFarmPigHighlightIdx, setLivestockFarmPigHighlightIdx] = useState(0);
  const [livestockFarmChickenHighlightIdx, setLivestockFarmChickenHighlightIdx] = useState(0);
  const [livestockFarmCattleHighlightIdx, setLivestockFarmCattleHighlightIdx] = useState(0);
  const [livestockFarmDuckHighlightIdx, setLivestockFarmDuckHighlightIdx] = useState(0);
  const [livestockFarmGooseHighlightIdx, setLivestockFarmGooseHighlightIdx] = useState(0);
  const [livestockFarmSheepHighlightIdx, setLivestockFarmSheepHighlightIdx] = useState(0);
  const [livestockFarmOtherHighlightIdx, setLivestockFarmOtherHighlightIdx] = useState(0);

  // 🏟️ 運動場館 Sports（5 sublayer 散點，opacity + scale；預設 scale 0.5 = 小點，15,000 點）
  const [sportsSchoolOpacity, setSportsSchoolOpacity] = useState(0.8);
  const [sportsSchoolScale, setSportsSchoolScale] = useState(0.5);
  const [sportsPublicOtherOpacity, setSportsPublicOtherOpacity] = useState(0.8);
  const [sportsPublicOtherScale, setSportsPublicOtherScale] = useState(0.5);
  const [sportsPrivateOpacity, setSportsPrivateOpacity] = useState(0.8);
  const [sportsPrivateScale, setSportsPrivateScale] = useState(0.5);
  const [sportsParkOpacity, setSportsParkOpacity] = useState(0.8);
  const [sportsParkScale, setSportsParkScale] = useState(0.7); // 運動公園面積大，略放大
  const [sportsCenterOpacity, setSportsCenterOpacity] = useState(0.85);
  const [sportsCenterScale, setSportsCenterScale] = useState(0.9); // 357 家國民運動中心，醒目

  // 農路（線，width + opacity）+ 國土綠網分區（面，opacity）
  const [farmRoadsWidth, setFarmRoadsWidth] = useState(1.0);
  const [farmRoadsOpacity, setFarmRoadsOpacity] = useState(0.8);
  const [ecoNetworkZonesOpacity, setEcoNetworkZonesOpacity] = useState(0.5);

  // ── FORESTRY（12 base + 3 衍生）──
  // polygon：opacity + outlineWidth + showOutline
  const [forestCompartmentsOpacity, setForestCompartmentsOpacity] = useState(0.45);
  const [forestCompartmentsOutlineWidth, setForestCompartmentsOutlineWidth] = useState(0.5);
  const [forestCompartmentsShowOutline, setForestCompartmentsShowOutline] = useState(true);
  const [forestReserveOpacity, setForestReserveOpacity] = useState(0.5);
  const [forestReserveOutlineWidth, setForestReserveOutlineWidth] = useState(0.5);
  const [forestReserveShowOutline, setForestReserveShowOutline] = useState(true);
  const [forestRecreationOpacity, setForestRecreationOpacity] = useState(0.6);
  const [forestRecreationOutlineWidth, setForestRecreationOutlineWidth] = useState(0.5);
  const [forestRecreationShowOutline, setForestRecreationShowOutline] = useState(true);
  const [forestTreatmentWorksOpacity, setForestTreatmentWorksOpacity] = useState(0.7);
  const [forestTreatmentWorksOutlineWidth, setForestTreatmentWorksOutlineWidth] = useState(0.5);
  const [forestTreatmentWorksShowOutline, setForestTreatmentWorksShowOutline] = useState(true);
  const [forestFlatParksOpacity, setForestFlatParksOpacity] = useState(0.6);
  const [forestFlatParksOutlineWidth, setForestFlatParksOutlineWidth] = useState(0.5);
  const [forestFlatParksShowOutline, setForestFlatParksShowOutline] = useState(true);
  const [forestDamLakesOpacity, setForestDamLakesOpacity] = useState(0.7);
  const [forestDamLakesOutlineWidth, setForestDamLakesOutlineWidth] = useState(0.5);
  const [forestDamLakesShowOutline, setForestDamLakesShowOutline] = useState(true);
  // line：opacity + width
  const [forestRoadsOpacity, setForestRoadsOpacity] = useState(0.8);
  const [forestRoadsWidth, setForestRoadsWidth] = useState(1.0);
  const [forestAlishanRailOpacity, setForestAlishanRailOpacity] = useState(0.9);
  const [forestAlishanRailWidth, setForestAlishanRailWidth] = useState(1.5);
  const [hikingTrailsOpacity, setHikingTrailsOpacity] = useState(0.85);
  const [hikingTrailsWidth, setHikingTrailsWidth] = useState(1.2);
  // raster：樹冠高度（PNG 預烤色帶，僅 opacity）
  const [canopyHeightOpacity, setCanopyHeightOpacity] = useState(0.7);
  const [canopyGiantsOpacity, setCanopyGiantsOpacity] = useState(0.85);
  // ENERGY MVP — 4 layer opacity + 2 scale/height
  const [powerPlantsOpacity, setPowerPlantsOpacity] = useState(0.95);
  const [powerPlantsScale, setPowerPlantsScale] = useState(0.5);
  const [powerGenerationOpacity, setPowerGenerationOpacity] = useState(0.7);
  const [powerGenerationHeight, setPowerGenerationHeight] = useState(1);
  const [powerPlantGlowOpacity, setPowerPlantGlowOpacity] = useState(0.9);
  const [powerPlantGlowSize, setPowerPlantGlowSize] = useState(1);
  const [substationEhvGlowOpacity, setSubstationEhvGlowOpacity] = useState(0.9);
  const [substationEhvGlowSize, setSubstationEhvGlowSize] = useState(1);
  const [powerLinesGlowOpacity, setPowerLinesGlowOpacity] = useState(0.7);
  const [powerLinesGlowWidth, setPowerLinesGlowWidth] = useState(2);
  const [aviationRestrictedGlowOpacity, setAviationRestrictedGlowOpacity] = useState(0.85);
  // 變電所（區域）— PS/DPS/SS/TRACTION/OTHER
  const [osmSubstationsOpacity, setOsmSubstationsOpacity] = useState(0.85);
  const [osmSubstationsSize, setOsmSubstationsSize] = useState(0.3);
  // 變電所（超高壓）— EHV_SWITCH + EHV
  const [osmSubstationsEhvOpacity, setOsmSubstationsEhvOpacity] = useState(0.85);
  const [osmSubstationsEhvSize, setOsmSubstationsEhvSize] = useState(0.5);
  const [osmPowerLinesOpacity, setOsmPowerLinesOpacity] = useState(0.4);
  const [osmPowerLinesWidth, setOsmPowerLinesWidth] = useState(0.7);
  const [osmPowerTowersOpacity, setOsmPowerTowersOpacity] = useState(0.75);
  const [osmPowerTowersSize, setOsmPowerTowersSize] = useState(1);
  const [aviationControlOpacity, setAviationControlOpacity] = useState(0.7);
  const [aviationRestrictedOpacity, setAviationRestrictedOpacity] = useState(0.7);
  const [droneNfzOpacity, setDroneNfzOpacity] = useState(0.45);
  const [droneRestrictedOpacity, setDroneRestrictedOpacity] = useState(0.45);
  const [powerPolesOpacity, setPowerPolesOpacity] = useState(0.7);
  const [powerPolesSize, setPowerPolesSize] = useState(1);
  const [powerPolesHeat, setPowerPolesHeat] = useState(1); // 0=關熱區、1=全顯
  const [powerPolesZ5Reveal, setPowerPolesZ5Reveal] = useState(0); // 0=z<8 隱形（預設），1=全 zoom 顯示
  const [osmWindTurbinesOpacity, setOsmWindTurbinesOpacity] = useState(0.85);
  const [osmWindTurbinesSize, setOsmWindTurbinesSize] = useState(1);
  const [osmSolarFarmsOpacity, setOsmSolarFarmsOpacity] = useState(0.85);
  const [osmSolarFarmsSize, setOsmSolarFarmsSize] = useState(1);
  const [osmPowerPlantsStaticOpacity, setOsmPowerPlantsStaticOpacity] = useState(0.85);
  const [osmPowerPlantsStaticSize, setOsmPowerPlantsStaticSize] = useState(1);
  const [offshoreWindZonesOpacity, setOffshoreWindZonesOpacity] = useState(0.35);
  const [islandPowerGridOpacity, setIslandPowerGridOpacity] = useState(0.9);
  const [islandPowerGridSize, setIslandPowerGridSize] = useState(1);
  const [fossilFuelInfraOpacity, setFossilFuelInfraOpacity] = useState(0.85);
  const [fossilFuelInfraSize, setFossilFuelInfraSize] = useState(1.2);
  const [geothermalWellsOpacity, setGeothermalWellsOpacity] = useState(0.85);
  const [geothermalWellsSize, setGeothermalWellsSize] = useState(1);
  const [renewablePermitsTaipeiOpacity, setRenewablePermitsTaipeiOpacity] = useState(0.85);
  const [renewablePermitsTaipeiSize, setRenewablePermitsTaipeiSize] = useState(1);
  const [evChargingOpacity, setEvChargingOpacity] = useState(0.8);
  // Phase 8 SSOT facilities 6-layer
  const [facPrimaryOpacity, setFacPrimaryOpacity] = useState(0.65);
  const [facPrimaryScale, setFacPrimaryScale] = useState(0.5);
  // L1 分級：有即時出力（台電 14 大廠 + 廠級匯總）vs 其他（小廠）
  const [facPrimaryRtScale, setFacPrimaryRtScale] = useState(1.3);
  const [facPrimaryNoRtScale, setFacPrimaryNoRtScale] = useState(0.85);
  const [facOffshoreOpacity, setFacOffshoreOpacity] = useState(0.45);
  const [facPlannedOpacity, setFacPlannedOpacity] = useState(0.7);
  const [facPlannedScale, setFacPlannedScale] = useState(0.5);
  const [facHistoricalOpacity, setFacHistoricalOpacity] = useState(0.5);
  const [facHistoricalScale, setFacHistoricalScale] = useState(0.5);
  const [facSecondaryOpacity, setFacSecondaryOpacity] = useState(0.85);
  const [facSecondaryScale, setFacSecondaryScale] = useState(0.5);
  const [facOsmSupplementOpacity, setFacOsmSupplementOpacity] = useState(0.7);
  const [facOsmSupplementScale, setFacOsmSupplementScale] = useState(0.5);
  // ── 化石燃料 14 layer params（Phase B） ──
  const [gasStationCpcOpacity, setGasStationCpcOpacity] = useState(0.85);
  const [gasStationCpcScale, setGasStationCpcScale] = useState(1.7);
  const [gasStationFpccOpacity, setGasStationFpccOpacity] = useState(0.85);
  const [gasStationFpccScale, setGasStationFpccScale] = useState(1.7);
  const [gasStationTaisugarOpacity, setGasStationTaisugarOpacity] = useState(0.85);
  const [gasStationTaisugarScale, setGasStationTaisugarScale] = useState(1.7);
  const [gasStationOtherOpacity, setGasStationOtherOpacity] = useState(0.7);
  const [gasStationOtherScale, setGasStationOtherScale] = useState(2.2);
  const [gasStationCanonicalOpacity, setGasStationCanonicalOpacity] = useState(0.9);
  const [gasStationCanonicalScale, setGasStationCanonicalScale] = useState(1.7);
  const [lpgSubpackagingOpacity, setLpgSubpackagingOpacity] = useState(0.85);
  const [lpgSubpackagingScale, setLpgSubpackagingScale] = useState(1.1);
  const [lpgRetailersOpacity, setLpgRetailersOpacity] = useState(0.75);
  const [lpgRetailersScale, setLpgRetailersScale] = useState(1.3);
  const [lngTerminalOpacity, setLngTerminalOpacity] = useState(0.95);
  const [lngTerminalScale, setLngTerminalScale] = useState(1.6);
  const [pipelineGasOpacity, setPipelineGasOpacity] = useState(0.8);
  const [pipelineGasWidth, setPipelineGasWidth] = useState(2.0);
  const [pipelineOilGasOpacity, setPipelineOilGasOpacity] = useState(0.7);
  const [pipelineOilGasWidth, setPipelineOilGasWidth] = useState(1.5);
  const [industrialRefineryOpacity, setIndustrialRefineryOpacity] = useState(0.55);
  const [industrialRefineryOutline, setIndustrialRefineryOutline] = useState(true);
  const [industrialStorageTankOpacity, setIndustrialStorageTankOpacity] = useState(0.55);
  const [industrialStorageTankOutline, setIndustrialStorageTankOutline] = useState(true);
  const [industrialPowerPlantOpacity, setIndustrialPowerPlantOpacity] = useState(0.5);
  const [industrialPowerPlantOutline, setIndustrialPowerPlantOutline] = useState(true);
  const [coalTerminalOpacity, setCoalTerminalOpacity] = useState(0.95);
  const [coalTerminalScale, setCoalTerminalScale] = useState(1.4);
  // ── 雲林 POC 覆蓋分析 5 layer params（PMTiles 沿 OSM edge nearest distance 染色）──
  const [gasCoverageAllOpacity, setGasCoverageAllOpacity] = useState(0.85);
  const [gasCoverageAllLineWidth, setGasCoverageAllLineWidth] = useState(0.5);
  const [gasCoverageCpcOpacity, setGasCoverageCpcOpacity] = useState(0.85);
  const [gasCoverageCpcLineWidth, setGasCoverageCpcLineWidth] = useState(0.5);
  const [gasCoverageFpccOpacity, setGasCoverageFpccOpacity] = useState(0.85);
  const [gasCoverageFpccLineWidth, setGasCoverageFpccLineWidth] = useState(0.5);
  const [gasCoverageTaisugarOpacity, setGasCoverageTaisugarOpacity] = useState(0.85);
  const [gasCoverageTaisugarLineWidth, setGasCoverageTaisugarLineWidth] = useState(0.5);
  const [evIslandOpacity, setEvIslandOpacity] = useState(0.6);
  const [evIslandLineWidth, setEvIslandLineWidth] = useState(0.5);
  // HAZARD（v2 Phase B）
  const [lightningOpacity, setLightningOpacity] = useState(0.85);
  const [lightningMinutes, setLightningMinutes] = useState(10);
  const [nuclearOpacity, setNuclearOpacity] = useState(0.9);
  const [nuclearScale, setNuclearScale] = useState(1.0);
  // 全球氣候 GLOBAL CLIMATE
  const [earthquakesGlobalOpacity, setEarthquakesGlobalOpacity] = useState(0.9);
  const [typhoonTracksOpacity, setTyphoonTracksOpacity] = useState(0.9);
  // 🌍 世界 WORLD
  const [worldTrashDebrisOpacity, setWorldTrashDebrisOpacity] = useState(0.85);
  const [typhoonSource, setTyphoonSource] = useState("all"); // all / jma / jtwc
  const [dustForecastOpacity, setDustForecastOpacity] = useState(0.7);
  const [oceanCurrentsOpacity, setOceanCurrentsOpacity] = useState(0.65);
  const [windFieldOpacity, setWindFieldOpacity] = useState(0.8);
  // 全球氣候粒子：風場 / 海流尺度不同，參數分開避免互相污染。
  const [windAnimationSpeed, setWindAnimationSpeed] = useState(1.0);
  const [windParticleCount, setWindParticleCount] = useState(12000);
  const [windLineWidth, setWindLineWidth] = useState(1.15);
  const [oceanAnimationSpeed, setOceanAnimationSpeed] = useState(1.0);
  const [oceanParticleCount, setOceanParticleCount] = useState(12000);
  const [oceanLineWidth, setOceanLineWidth] = useState(1.05);
  // Base map（行政邊界 + 等高線 + OSM 路網）
  const [countyBoundaryOpacity, setCountyBoundaryOpacity] = useState(0.85);
  const [countyBoundaryWidth, setCountyBoundaryWidth] = useState(1.0);
  const [townshipBoundaryOpacity, setTownshipBoundaryOpacity] = useState(0.75);
  const [townshipBoundaryWidth, setTownshipBoundaryWidth] = useState(1.0);
  const [villageBoundaryOpacity, setVillageBoundaryOpacity] = useState(0.65);
  const [villageBoundaryWidth, setVillageBoundaryWidth] = useState(1.0);
  const [contour25kOpacity, setContour25kOpacity] = useState(0.7);
  const [contour25kWidth, setContour25kWidth] = useState(1.0);
  const [contourDtm20Opacity, setContourDtm20Opacity] = useState(0.55);
  const [contourDtm20Width, setContourDtm20Width] = useState(1.0);
  const [osmRoadDriveOpacity, setOsmRoadDriveOpacity] = useState(0.85);
  const [osmRoadDriveWidth, setOsmRoadDriveWidth] = useState(1.0);
  const [osmRoadDriveZ5Reveal, setOsmRoadDriveZ5Reveal] = useState(0); // 0=z<8 隱形（預設），1=全 zoom 顯示
  const [osmExpresswayOpacity, setOsmExpresswayOpacity] = useState(0.9);
  const [osmExpresswayWidth, setOsmExpresswayWidth] = useState(1.0);
  const [hillshadeOpacity, setHillshadeOpacity] = useState(0.5);
  // 坡度/坡向分級向量（PMTiles polygon，可點選/疊圖分析）
  const [slopeVectorOpacity, setSlopeVectorOpacity] = useState(0.6);
  const [aspectVectorOpacity, setAspectVectorOpacity] = useState(0.6);
  // 房地產（6 layer 共用一個透明度）
  const [realEstateOpacity, setRealEstateOpacity] = useState(0.7);
  // 排除雙北（taipei+newtaipei）重繪：濾掉雙北 + 色階壓縮到非雙北 domain。預設 false=包含
  const [realEstateExcludeTaipei, setRealEstateExcludeTaipei] = useState(false);
  // point：opacity + scale
  const [forestTrailSignsOpacity, setForestTrailSignsOpacity] = useState(0.85);
  const [forestTrailSignsScale, setForestTrailSignsScale] = useState(1.0);
  const [forestSignalPointsOpacity, setForestSignalPointsOpacity] = useState(0.85);
  const [forestSignalPointsScale, setForestSignalPointsScale] = useState(1.0);
  const [forestEducationCentersOpacity, setForestEducationCentersOpacity] = useState(0.9);
  const [forestEducationCentersScale, setForestEducationCentersScale] = useState(1.2);
  const [forestWildlifeOpacity, setForestWildlifeOpacity] = useState(0.85);
  const [forestWildlifeScale, setForestWildlifeScale] = useState(1.0);
  // 衍生（H3 / polygon）：opacity + outlineWidth + showOutline

  // ── Waste sub-toggle params (12 種子 toggle，每種 size/opacity/altitude 三 slider) ──
  const WASTE_SUB_KEYS = [
    "wfIncinerator", "wfLandfill", "wfLandfillCoastal",
    "wfTransfer", "wfMedical", "wfMonitoring",
    "wfRecycling", "wfScrapYard", "wfOther",
    "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
  ] as const;
  type WasteSubKey = typeof WASTE_SUB_KEYS[number];
  interface WasteSubParams { size: number; opacity: number; altitude: number; ringSize?: number; }
  const DEFAULT_WASTE_SUB: Record<WasteSubKey, WasteSubParams> = {
    wfIncinerator: { size: 1.0, opacity: 0.85, altitude: 0, ringSize: 1.0 },
    wfLandfill:    { size: 1.0, opacity: 0.45, altitude: 0 },
    wfLandfillCoastal: { size: 1.0, opacity: 0.55, altitude: 0 },
    wfTransfer:    { size: 1.0, opacity: 0.85, altitude: 0 },
    wfMedical:     { size: 1.0, opacity: 0.85, altitude: 0 },
    wfMonitoring:  { size: 1.0, opacity: 0.7,  altitude: 0 },
    wfRecycling:   { size: 1.0, opacity: 0.85, altitude: 0 },
    wfScrapYard:   { size: 1.0, opacity: 0.85, altitude: 0 },
    wfOther:       { size: 1.0, opacity: 0.7,  altitude: 0 },
    wdClothes:     { size: 1.0, opacity: 0.7,  altitude: 0 },
    wdMixed:       { size: 1.0, opacity: 0.7,  altitude: 0 },
    wdRecyclingContainer: { size: 1.0, opacity: 0.85, altitude: 0 },
    wdBattery:     { size: 1.5, opacity: 0.9,  altitude: 0 },
  };
  const [wasteSubParams, setWasteSubParams] = useState<Record<WasteSubKey, WasteSubParams>>(DEFAULT_WASTE_SUB);
  const wasteSubParamsRef = useRef(wasteSubParams);
  wasteSubParamsRef.current = wasteSubParams;
  const setWasteSubParam = (key: WasteSubKey, field: keyof WasteSubParams, v: number) =>
    setWasteSubParams((prev) => ({ ...prev, [key]: { ...prev[key], [field]: v } }));

  // Mirror refs for Three.js render loops
  const altExagRef = useRef(altExaggeration);
  const altOffsetRef = useRef(altOffset);
  const staticOpacityRef = useRef(staticOpacity);
  const orbScaleRef = useRef(orbScale);
  const shipOrbScaleRef = useRef(shipOrbScale);
  const shipTrailOpacityRef = useRef(shipTrailOpacity);
  const railAltOffsetRef = useRef(railAltOffset);
  const railOrbScaleRef = useRef(railOrbScale);
  const railTrackOpacityRef = useRef(railTrackOpacity);
  const railTrainVisibleRef = useRef(railTrainVisible);
  const railTrackModeRef = useRef(railTrackMode);
  const beamVisibleRef = useRef(beamVisible);
  const beamDistanceRef = useRef(beamDistance);
  const beamOpacityRef = useRef(beamOpacity);
  const thsrPillarVisibleRef = useRef(thsrPillarVisible);
  const thsrPillarHeightRef = useRef(thsrPillarHeight);
  const traPillarVisibleRef = useRef(traPillarVisible);
  const traPillarHeightRef = useRef(traPillarHeight);
  const metroPillarVisibleRef = useRef(metroPillarVisible);
  const metroPillarHeightRef = useRef(metroPillarHeight);
  const portPillarVisibleRef = useRef(portPillarVisible);
  const portPillarHeightRef = useRef(portPillarHeight);
  const airportPillarVisibleRef = useRef(airportPillarVisible);
  const airportPillarHeightRef = useRef(airportPillarHeight);
  const busOrbScaleRef = useRef(busOrbScale);
  const tempHeightRef = useRef(tempHeight);
  const tempZOffsetRef = useRef(tempZOffset);
  const tempExtrudedRef = useRef(tempExtruded);
  const tempOpacityRef = useRef(tempOpacity);
  const tempWireframeRef = useRef(tempWireframe);
  const busColorModeRef = useRef(busColorMode);
  const busAltOffsetRef = useRef(busAltOffset);
  const busIntercityOrbScaleRef = useRef(busIntercityOrbScale);
  const busIntercityColorModeRef = useRef(busIntercityColorMode);
  const busIntercityAltOffsetRef = useRef(busIntercityAltOffset);
  const touristShuttleOrbScaleRef = useRef(touristShuttleOrbScale);
  const touristShuttleColorModeRef = useRef(touristShuttleColorMode);
  const touristShuttleAltOffsetRef = useRef(touristShuttleAltOffset);
  const touristShuttleOpacityRef = useRef(touristShuttleOpacity);
  const wasteOrbScaleRef = useRef(wasteOrbScale);
  const wasteNoteSizeRef = useRef(wasteNoteSize);
  const wasteNoteZOffsetRef = useRef(wasteNoteZOffset);
  const fireStationsScaleRef = useRef(fireStationsScale);
  const fireStationsOpacityRef = useRef(fireStationsOpacity);
  const fireStations3DRef = useRef(fireStations3D);

  busColorModeRef.current = busColorMode;
  busAltOffsetRef.current = busAltOffset;
  busOrbScaleRef.current = busOrbScale;
  busIntercityOrbScaleRef.current = busIntercityOrbScale;
  busIntercityColorModeRef.current = busIntercityColorMode;
  busIntercityAltOffsetRef.current = busIntercityAltOffset;
  touristShuttleOrbScaleRef.current = touristShuttleOrbScale;
  touristShuttleColorModeRef.current = touristShuttleColorMode;
  touristShuttleAltOffsetRef.current = touristShuttleAltOffset;
  touristShuttleOpacityRef.current = touristShuttleOpacity;
  wasteOrbScaleRef.current = wasteOrbScale;
  wasteNoteSizeRef.current = wasteNoteSize;
  wasteNoteZOffsetRef.current = wasteNoteZOffset;
  fireStationsScaleRef.current = fireStationsScale;
  fireStationsOpacityRef.current = fireStationsOpacity;
  fireStations3DRef.current = fireStations3D;
  altExagRef.current = altExaggeration;
  altOffsetRef.current = altOffset;
  staticOpacityRef.current = staticOpacity;
  orbScaleRef.current = orbScale;
  shipOrbScaleRef.current = shipOrbScale;
  shipTrailOpacityRef.current = shipTrailOpacity;
  railAltOffsetRef.current = railAltOffset;
  railOrbScaleRef.current = railOrbScale;
  railTrackOpacityRef.current = railTrackOpacity;
  railTrainVisibleRef.current = railTrainVisible;
  railTrackModeRef.current = railTrackMode;
  beamVisibleRef.current = beamVisible;
  beamDistanceRef.current = beamDistance;
  beamOpacityRef.current = beamOpacity;
  thsrPillarVisibleRef.current = thsrPillarVisible;
  thsrPillarHeightRef.current = thsrPillarHeight;
  traPillarVisibleRef.current = traPillarVisible;
  traPillarHeightRef.current = traPillarHeight;
  metroPillarVisibleRef.current = metroPillarVisible;
  metroPillarHeightRef.current = metroPillarHeight;
  portPillarVisibleRef.current = portPillarVisible;
  portPillarHeightRef.current = portPillarHeight;
  airportPillarVisibleRef.current = airportPillarVisible;
  airportPillarHeightRef.current = airportPillarHeight;
  tempHeightRef.current = tempHeight;
  tempZOffsetRef.current = tempZOffset;
  tempExtrudedRef.current = tempExtruded;
  tempOpacityRef.current = tempOpacity;
  tempWireframeRef.current = tempWireframe;

  const overlayParams = useMemo<Record<string, number>>(() => ({
    // 警政司法民防 17 layer
    policeStationOpacity, policeStationScale,
    womenChildWarningOpacity, womenChildWarningScale,
    speedCameraOpacity, speedCameraScale,
    speedZoneSegmentOpacity, speedZoneSegmentWidth,
    courtOpacity, courtScale,
    prosecutorsOfficeOpacity, prosecutorsOfficeScale,
    correctionalFacilityOpacity, correctionalFacilityScale,
    courtJurisdictionOpacity,
    aquaculturePondsOpacity, aquacultureZoneOpacity, aquacultureCageNetOpacity,
    aquacultureWaterSatelliteOpacity, aquacultureWaterSatelliteMoaOpacity, aquacultureIntegratedOpacity, lakesPondsOsmOpacity,
    aquacultureWaterUnionOpacity,
    // 信心層級 select（all/reservoir/certain）編成 idx（0/1/2）；paint 端 decode 做 opacity 篩選
    aquacultureWaterSatelliteConfidenceIdx: ["all", "reservoir", "certain"].indexOf(aquacultureWaterSatelliteConfidence),
    // 三組類別篩選 checkbox 編成 0/1；overlayRegistry 的 filter 函式讀取組成 in-list
    aquacultureWaterSatelliteMoaShowConfirmed: aquacultureWaterSatelliteMoaShowConfirmed ? 1 : 0,
    aquacultureWaterSatelliteMoaShowSolar: aquacultureWaterSatelliteMoaShowSolar ? 1 : 0,
    aquacultureWaterSatelliteMoaShowOther: aquacultureWaterSatelliteMoaShowOther ? 1 : 0,
    aquacultureWaterUnionShowBoth: aquacultureWaterUnionShowBoth ? 1 : 0,
    aquacultureWaterUnionShowMoaOnly: aquacultureWaterUnionShowMoaOnly ? 1 : 0,
    aquacultureWaterUnionShowOsmOnly: aquacultureWaterUnionShowOsmOnly ? 1 : 0,
    streetTreesTaipeiDiffOpacity,
    // status 篩選 select（all/disappeared/changed）編成 idx（0/1/2）；paint 端 decode 做 opacity 篩選
    streetTreesTaipeiDiffStatusIdx: ["all", "disappeared", "changed"].indexOf(streetTreesTaipeiDiffStatus),
    streetTreesTaipeiDiffRadius,
    // 染色模式 select（status/species/diameter/height）編成 idx（0-3）；paint 端 switch 分支
    streetTreesTaipeiDiffColorModeIdx: ["status", "species", "diameter", "height"].indexOf(streetTreesTaipeiDiffColorMode),
    // 都市開放空間三層：select 一律編成 Idx 餵 paint（overlayParams 只收數字）
    protectedTreesNationalOpacity, protectedTreesNationalRadius,
    protectedTreesNationalColorModeIdx: ["age", "city"].indexOf(protectedTreesNationalColorMode),
    protectedTreesNationalCityIdx: ["all", ...PROTECTED_TREE_CITIES.map((c) => c.name)].indexOf(protectedTreesNationalCity),
    riversideTreesTaipeiOpacity, riversideTreesTaipeiRadius,
    riversideTreesTaipeiParkIdx: ["all", ...RIVERSIDE_PARKS].indexOf(riversideTreesTaipeiPark),
    parksTaipeiOpacity, parksTaipeiRadius,
    parksTaipeiCategoryIdx: ["all", ...TAIPEI_PARK_CATEGORIES.map((c) => c.name)].indexOf(parksTaipeiCategory),
    // 🎭 文化 Culture：select 編成 Idx 餵 paint/filter（overlayParams 只收數字）
    culturalFacilitiesOpacity, culturalFacilitiesRadius,
    culturalFacilitiesTypeIdx: ["all", ...CULTURAL_FACILITY_TYPES.map((c) => c.name)].indexOf(culturalFacilitiesType),
    culturalMuseumsOpacity, culturalMuseumsRadius,
    culturalMuseumsTypeIdx: ["all", ...CULTURAL_MUSEUM_TYPES.map((c) => c.name)].indexOf(culturalMuseumsType),
    artsEventsOpacity, artsEventsRadius,
    artsEventsStatusIdx: ["all", "ongoing", "upcoming"].indexOf(artsEventsStatus),
    performingVenuesOpacity, performingVenuesRadius,
    // 🧳 觀光 Tourism：select 編成 Idx 餵 paint/filter（overlayParams 只收數字）
    tourAttractionsOpacity, tourAttractionsScale,
    tourAttractionsModeIdx: ["category", "heat"].indexOf(tourAttractionsMode),
    tourHotSpringsOpacity, tourHotSpringsScale,
    tourHotSpringZonesOpacity,
    tourScenicAreasOpacity,
    tourHeritageOpacity, tourHeritageScale,
    religionTemplesOpacity, religionTemplesScale,
    religionTemplesRegistryIdx: REGISTRY_MODES.map((m) => m.value).indexOf(religionTemplesRegistry),
    religionTemplesDeityIdx: ["all", ...DEITY_FAMILIES.map((d) => d.value)].indexOf(religionTemplesDeity),
    religionChurchesOpacity, religionChurchesScale,
    religionChurchesRegistryIdx: REGISTRY_MODES.map((m) => m.value).indexOf(religionChurchesRegistry),
    religionAncestralHallsOpacity, religionAncestralHallsScale,
    religionAncestralHallsRegistryIdx: REGISTRY_MODES.map((m) => m.value).indexOf(religionAncestralHallsRegistry),
    religionFoundationsOpacity, religionFoundationsScale,
    religionOtherWorshipOpacity, religionOtherWorshipScale,
    religionTop100Opacity, religionTop100Scale,
    tourEventsOpacity, tourEventsScale,
    tourEventsStatusIdx: ["all", "ongoing", "upcoming"].indexOf(tourEventsStatus),
    tourFactoriesOpacity, tourFactoriesScale,
    tourAmusementParksOpacity, tourAmusementParksScale,
    tourCampingOpacity, tourCampingScale,
    tourHotelsOpacity, tourHotelsScale,
    tourHotelsClassIdx: ["all", "1", "2", "3", "4"].indexOf(tourHotelsClass),
    tourRestaurantsOpacity, tourRestaurantsScale,
    streetTreesTaipei3epochOpacity, streetTreesTaipei3epochRadius,
    streetTreesTaipei3epochColorModeIdx: ["traj", "species", "diameter", "height"].indexOf(streetTreesTaipei3epochColorMode),
    streetTreesTaipei3epochTrajFilterIdx: STREET_TREE_3EPOCH_TRAJ_FILTERS.findIndex((f) => f.value === streetTreesTaipei3epochTrajFilter),
    streetTreesNationalOpacity, streetTreesNationalRadius,
    streetTreesNationalColorModeIdx: ["species", "diameter", "height", "city"].indexOf(streetTreesNationalColorMode),
    streetTreesNationalCityIdx: ["all", ...STREET_TREE_NATIONAL_CITIES.map((c) => c.value)].indexOf(streetTreesNationalCity),
    treePitsTaipeiOpacity,
    treePitsTaipeiTypeIdx: ["all", ...TREE_PIT_TYPES.map((t) => t.name)].indexOf(treePitsTaipeiType),
    buildingsGbaModeIdx, buildingsGbaMinHeight, buildingsGbaOpacity, buildingsGbaBloomMinHeight,
    urbanFormGridModeIdx, urbanFormGridOpacity,
    propertyValueGridScaleIdx, propertyValueGridModeIdx,
    propertyValueGridOpacity, propertyValueGridContrast, propertyValueGridElevationScale,
    propertyValueGridExtruded: propertyValueGridExtruded ? 1 : 0,
    // 🗺️ 土地使用分區：category select 編成 Idx 餵 filter（overlayParams 只收數字，0=全部 1..9 單類）
    urbanZoningTaipeiOpacity,
    urbanZoningTaipeiCategoryIdx: ["all", ...URBAN_ZONING_CATEGORIES.map((c) => c.value)].indexOf(urbanZoningTaipeiCategory),
    urbanZoningNewTaipeiOpacity,
    urbanZoningNewTaipeiCategoryIdx: ["all", ...URBAN_ZONING_CATEGORIES.map((c) => c.value)].indexOf(urbanZoningNewTaipeiCategory),
    crimeAreaMonthlyOpacity,
    theftTaoyuanOpacity, theftTaoyuanScale,
    trafficAccidentYearlyOpacity, trafficAccidentYearlyScale,
    accidentTaipeiOpacity, accidentTaipeiScale,
    a1AccidentRealtimeOpacity, a1AccidentRealtimeScale,
    investigationBureauOpacity, investigationBureauScale,
    antiCorruptionOfficeOpacity, antiCorruptionOfficeScale,
    immigrationOfficeOpacity, immigrationOfficeScale,
    coastGuardStationOpacity, coastGuardStationScale,
    civilDefenseShelterOpacity, civilDefenseShelterScale,
    // 警察覆蓋分析（數字化 mode/minutes 餵 paint expression）
    policeIsoSubstationOpacity,
    policeIsoSubstationMode_drive: policeIsoSubstationMode === "drive" ? 1 : 0,
    policeIsoSubstationMinutes_num: Number(policeIsoSubstationMinutes),
    policeIsoPrecinctOpacity,
    policeIsoPrecinctMode_drive: policeIsoPrecinctMode === "drive" ? 1 : 0,
    policeIsoPrecinctMinutes_num: Number(policeIsoPrecinctMinutes),
    policeIsoCityDeptOpacity,
    policeIsoCityDeptMode_drive: policeIsoCityDeptMode === "drive" ? 1 : 0,
    policeIsoCityDeptMinutes_num: Number(policeIsoCityDeptMinutes),
    // 環境污染（paint 用；filter 值另由 return 物件傳給 usePollutionLayers）
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    pollutionSiteOpacity, pollutionSiteScale,
    stationScale,
    airportOpacity,
    airportGlow,
    busScale,
    bikeScale,
    lighthouseScale,
    cyclingWidth,
    freewayWidth,
    roadCongestionWidth,
    roadCongestionOpacity,
    cctvScale,
    cctvOpacity,
    cctvZ,
    fireStationsScale,
    fireStationsOpacity,
    fireStationsZ,
    fireStationsDots: fireStationsDots ? 1 : 0,
    fireHydrantsScale,
    fireHydrantsOpacity,
    fireHydrantsZ,
    fireIsochroneOpacity,
    fireIsochroneCountyIdx: FIRE_ISOCHRONE_COUNTY_OPTIONS.findIndex((o) => o.value === fireIsochroneCounty),
    medHospitalOpacity,
    medHospitalScale,
    medClinicOpacity,
    medClinicScale,
    medPharmacyOpacity,
    medPharmacyScale,
    medAEDOpacity,
    medAEDScale,
    medLTCOpacity,
    medLTCScale,
    medIsochroneOpacity,
    erHospitalOpacity,
    librarySeatsOpacity,
    parkingOnstreetOpacity,
    parkingOffstreetOpacity,
    fireEventsOpacity,
    fireLatestOpacity,
    etcGantryScale,
    etcGantryOpacity,
    etcGantryZ,
    serviceAreaScale,
    serviceAreaOpacity,
    serviceAreaZ,
    serviceAreaPolygonOpacity,
    serviceAreaPolygonLineWidth,
    taxiStandScale,
    taxiStandOpacity,
    taxiStandZ,
    weatherScale,
    highwayWidth,
    highwayGlow,
    provincialWidth,
    provincialGlow,
    portGlow,
    schoolScale,
    convenienceScale,
    postOfficesOpacity, postOfficesScale,
    iPostBoxesOpacity, iPostBoxesScale,
    communityCentersOpacity, communityCentersScale,
    govServiceOfficesOpacity, govServiceOfficesScale,
    publicLibrariesOpacity, publicLibrariesScale,
    welfareCentersOpacity, welfareCentersScale,
    retailMarketsOpacity, retailMarketsScale,
    publicToiletsOpacity, publicToiletsScale,
    schoolLevelColor: schoolLevelColor ? 1 : 0,
    newsScale,
    metroPillar3d: metroPillarVisible ? 1 : 0,
    floodMinDepth,
    reservoirPillarHeight,
    waterBasinOpacity,
    waterRiverWidth,
    waterRiverOpacity,
    waterCanalWidth,
    waterCanalOpacity,
    waterLeveeWidth,
    waterLeveeOpacity,
    waterProtectionZoneOpacity,
    waterFacilityScale,
    waterFacilityOpacity,
    waterMonitorScale,
    waterMonitorOpacity,
    detentionBasinScale,
    detentionBasinOpacity,
    waterFloodOpacity,
    rainGaugeScale,
    rainGaugeOpacity,
    riverLevelScale,
    riverLevelOpacity,
    groundwaterScale,
    groundwaterOpacity,
    groundwaterWellsScale,
    groundwaterWellsOpacity,
    iotWraRiverScale,
    iotWraRiverOpacity,
    iotWraRiverShowMeasured: iotWraRiverShowMeasured ? 1 : 0,
    iotWraRiverShowForecast: iotWraRiverShowForecast ? 1 : 0,
    iotWraStructureScale,
    iotWraStructureOpacity,
    iotWraStructureFlow: iotWraStructureFlow ? 1 : 0,
    iotWraStructureGate: iotWraStructureGate ? 1 : 0,
    iotWraStructureDam: iotWraStructureDam ? 1 : 0,
    iotWraStructureErosion: iotWraStructureErosion ? 1 : 0,
    iotWraStructureDust: iotWraStructureDust ? 1 : 0,
    floodSensorScale,
    floodSensorOpacity,
    floodSensorIsochroneOpacity,
    taipeiSewerScale,
    taipeiSewerOpacity,
    taipeiEvacuateScale,
    taipeiEvacuateOpacity,
    taipeiPumbScale,
    taipeiPumbOpacity,
    precipRasterOpacity,
    precipRasterHours,
    wasteStopsStaticScale,
    wasteStopsStaticGlow,
    wasteStopsStaticZ,
    agricultureOpacity,
    agricultureOutlineWidth,
    agricultureShowOutline: agricultureShowOutline ? 1 : 0,
    agricultureZ,
    agriSoilOpacity,
    agriSoilFertilityOpacity,
    // metric 字串轉 index 編進 overlayParams (Record<string,number>)；MapView 端再 decode 回 string
    agriSoilFertilityMetricIdx: SOIL_FERTILITY_METRIC_OPTIONS.findIndex((o) => o.value === agriSoilFertilityMetric),
    agriLeisureFarmZonesOpacity,
    agriRuralRegenOpacity,
    agriCropSuitabilityOpacity,
    agriCropSuitabilityCropId,
    agriPOIOpacity,
    agriPOIScale,
    agriRetailOpacity,
    agriRetailScale,
    agriProduceWholesaleOpacity,
    agriProduceWholesaleScale,
    agriWholesaleMarketOpacity,
    agriWholesaleMarketScale,
    livestockFarmPigOpacity,
    livestockFarmPigScale,
    livestockFarmChickenOpacity,
    livestockFarmChickenScale,
    livestockFarmCattleOpacity,
    livestockFarmCattleScale,
    livestockFarmDuckOpacity,
    livestockFarmDuckScale,
    livestockFarmGooseOpacity,
    livestockFarmGooseScale,
    livestockFarmSheepOpacity,
    livestockFarmSheepScale,
    livestockFarmOtherOpacity,
    livestockFarmOtherScale,
    livestockSlaughterOpacity,
    livestockSlaughterScale,
    livestockFeedOpacity,
    livestockFeedScale,
    livestockMarketOpacity,
    livestockMarketScale,
    livestockFarmPigHighlightIdx,
    livestockFarmChickenHighlightIdx,
    livestockFarmCattleHighlightIdx,
    livestockFarmDuckHighlightIdx,
    livestockFarmGooseHighlightIdx,
    livestockFarmSheepHighlightIdx,
    livestockFarmOtherHighlightIdx,
    // 🏟️ 運動場館 Sports
    sportsSchoolOpacity,
    sportsSchoolScale,
    sportsPublicOtherOpacity,
    sportsPublicOtherScale,
    sportsPrivateOpacity,
    sportsPrivateScale,
    sportsParkOpacity,
    sportsParkScale,
    sportsCenterOpacity,
    sportsCenterScale,
    farmRoadsWidth,
    farmRoadsOpacity,
    ecoNetworkZonesOpacity,
    // FORESTRY
    forestCompartmentsOpacity,
    forestCompartmentsOutlineWidth,
    forestCompartmentsShowOutline: forestCompartmentsShowOutline ? 1 : 0,
    forestReserveOpacity,
    forestReserveOutlineWidth,
    forestReserveShowOutline: forestReserveShowOutline ? 1 : 0,
    forestRecreationOpacity,
    forestRecreationOutlineWidth,
    forestRecreationShowOutline: forestRecreationShowOutline ? 1 : 0,
    forestTreatmentWorksOpacity,
    forestTreatmentWorksOutlineWidth,
    forestTreatmentWorksShowOutline: forestTreatmentWorksShowOutline ? 1 : 0,
    forestFlatParksOpacity,
    forestFlatParksOutlineWidth,
    forestFlatParksShowOutline: forestFlatParksShowOutline ? 1 : 0,
    forestDamLakesOpacity,
    forestDamLakesOutlineWidth,
    forestDamLakesShowOutline: forestDamLakesShowOutline ? 1 : 0,
    forestRoadsOpacity,
    forestRoadsWidth,
    forestAlishanRailOpacity,
    forestAlishanRailWidth,
    forestTrailSignsOpacity,
    forestTrailSignsScale,
    forestSignalPointsOpacity,
    forestSignalPointsScale,
    forestEducationCentersOpacity,
    forestEducationCentersScale,
    forestWildlifeOpacity,
    forestWildlifeScale,
    hikingTrailsOpacity,
    hikingTrailsWidth,
    canopyHeightOpacity,
    canopyGiantsOpacity,
    // ENERGY
    powerPlantsOpacity,
    powerPlantsScale,
    powerPlantGlowOpacity,
    powerPlantGlowSize,
    substationEhvGlowOpacity,
    substationEhvGlowSize,
    powerLinesGlowOpacity,
    powerLinesGlowWidth,
    aviationRestrictedGlowOpacity,
    facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale,
    facOffshoreOpacity,
    facPlannedOpacity, facPlannedScale,
    facHistoricalOpacity, facHistoricalScale,
    facSecondaryOpacity, facSecondaryScale,
    facOsmSupplementOpacity, facOsmSupplementScale,
    // 化石燃料 14 layer
    gasStationCpcOpacity, gasStationCpcScale,
    gasStationFpccOpacity, gasStationFpccScale,
    gasStationTaisugarOpacity, gasStationTaisugarScale,
    gasStationOtherOpacity, gasStationOtherScale,
    gasStationCanonicalOpacity, gasStationCanonicalScale,
    lpgSubpackagingOpacity, lpgSubpackagingScale,
    lpgRetailersOpacity, lpgRetailersScale,
    lngTerminalOpacity, lngTerminalScale,
    pipelineGasOpacity, pipelineGasWidth,
    pipelineOilGasOpacity, pipelineOilGasWidth,
    industrialRefineryOpacity, industrialRefineryOutline: industrialRefineryOutline ? 1 : 0,
    industrialStorageTankOpacity, industrialStorageTankOutline: industrialStorageTankOutline ? 1 : 0,
    industrialPowerPlantOpacity, industrialPowerPlantOutline: industrialPowerPlantOutline ? 1 : 0,
    coalTerminalOpacity, coalTerminalScale,
    // 雲林 POC 覆蓋分析
    gasCoverageAllOpacity, gasCoverageAllLineWidth,
    gasCoverageCpcOpacity, gasCoverageCpcLineWidth,
    gasCoverageFpccOpacity, gasCoverageFpccLineWidth,
    gasCoverageTaisugarOpacity, gasCoverageTaisugarLineWidth,
    evIslandOpacity, evIslandLineWidth,
    powerGenerationOpacity,
    powerGenerationHeight,
    osmSubstationsOpacity,
    osmSubstationsSize,
    osmSubstationsEhvOpacity,
    osmSubstationsEhvSize,
    osmPowerLinesOpacity,
    osmPowerLinesWidth,
    osmPowerTowersOpacity,
    osmPowerTowersSize,
    aviationControlOpacity,
    aviationRestrictedOpacity,
    droneNfzOpacity,
    droneRestrictedOpacity,
    powerPolesOpacity,
    powerPolesSize,
    powerPolesHeat,
    powerPolesZ5Reveal,
    osmWindTurbinesOpacity,
    osmWindTurbinesSize,
    osmSolarFarmsOpacity,
    osmSolarFarmsSize,
    osmPowerPlantsStaticOpacity,
    osmPowerPlantsStaticSize,
    offshoreWindZonesOpacity,
    islandPowerGridOpacity,
    islandPowerGridSize,
    fossilFuelInfraOpacity,
    fossilFuelInfraSize,
    geothermalWellsOpacity,
    geothermalWellsSize,
    renewablePermitsTaipeiOpacity,
    renewablePermitsTaipeiSize,
    evChargingOpacity,
    // HAZARD
    lightningOpacity,
    lightningMinutes,
    nuclearOpacity,
    nuclearScale,
    // 全球氣候 GLOBAL CLIMATE
    earthquakesGlobalOpacity,
    typhoonTracksOpacity,
    typhoonSourceIdx: ["all", "jma", "jtwc"].indexOf(typhoonSource),
    dustForecastOpacity,
    oceanCurrentsOpacity,
    windFieldOpacity,
    windAnimationSpeed,
    windParticleCount,
    windLineWidth,
    oceanAnimationSpeed,
    oceanParticleCount,
    oceanLineWidth,
    // 🌍 世界 WORLD
    worldTrashDebrisOpacity,
    realEstateOpacity,
    realEstateExcludeTaipei: realEstateExcludeTaipei ? 1 : 0,
    // LASS 微感測顯示模式（只供 LegendPanel 選對應圖例；paint 端走 hook 的 setPaintProperty）
    aqiMicroModeIdx,
    // 都市熱島 raster：模式同時餵 overlayRegistry paint（raster-color-mix/range/color）與圖例
    urbanHeatModeIdx,
    urbanHeatOpacity,
    // Base map
    countyBoundaryOpacity, countyBoundaryWidth,
    townshipBoundaryOpacity, townshipBoundaryWidth,
    villageBoundaryOpacity, villageBoundaryWidth,
    contour25kOpacity, contour25kWidth,
    contourDtm20Opacity, contourDtm20Width,
    osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal,
    osmExpresswayOpacity, osmExpresswayWidth,
    hillshadeOpacity,
    slopeVectorOpacity, aspectVectorOpacity,
  }), [realEstateOpacity, realEstateExcludeTaipei, countyBoundaryOpacity, countyBoundaryWidth, townshipBoundaryOpacity, townshipBoundaryWidth, villageBoundaryOpacity, villageBoundaryWidth, contour25kOpacity, contour25kWidth, contourDtm20Opacity, contourDtm20Width, osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal, osmExpresswayOpacity, osmExpresswayWidth, hillshadeOpacity, slopeVectorOpacity, aspectVectorOpacity, stationScale, airportOpacity, airportGlow, busScale, bikeScale, lighthouseScale, cyclingWidth, freewayWidth, roadCongestionWidth, roadCongestionOpacity, cctvScale, cctvOpacity, cctvZ, fireStationsScale, fireStationsOpacity, fireStationsZ, fireStationsDots, fireHydrantsScale, fireHydrantsOpacity, fireHydrantsZ, fireIsochroneOpacity, fireIsochroneCounty, medHospitalOpacity, medHospitalScale, medClinicOpacity, medClinicScale, medPharmacyOpacity, medPharmacyScale, medAEDOpacity, medAEDScale, medLTCOpacity, medLTCScale, medIsochroneOpacity, erHospitalOpacity, librarySeatsOpacity, parkingOnstreetOpacity, parkingOffstreetOpacity, fireEventsOpacity, fireLatestOpacity, etcGantryScale, etcGantryOpacity, etcGantryZ, serviceAreaScale, serviceAreaOpacity, serviceAreaZ, serviceAreaPolygonOpacity, serviceAreaPolygonLineWidth, taxiStandScale, taxiStandOpacity, taxiStandZ, weatherScale, highwayWidth, highwayGlow, provincialWidth, provincialGlow, portGlow, schoolScale, convenienceScale, postOfficesOpacity, postOfficesScale, iPostBoxesOpacity, iPostBoxesScale, communityCentersOpacity, communityCentersScale, govServiceOfficesOpacity, govServiceOfficesScale, publicLibrariesOpacity, publicLibrariesScale, welfareCentersOpacity, welfareCentersScale, retailMarketsOpacity, retailMarketsScale, publicToiletsOpacity, publicToiletsScale, schoolLevelColor, newsScale, metroPillarVisible, floodMinDepth, reservoirPillarHeight, waterBasinOpacity, waterRiverWidth, waterRiverOpacity, waterCanalWidth, waterCanalOpacity, waterLeveeWidth, waterLeveeOpacity, waterProtectionZoneOpacity, waterFacilityScale, waterFacilityOpacity, waterMonitorScale, waterMonitorOpacity, detentionBasinScale, detentionBasinOpacity, waterFloodOpacity, rainGaugeScale, rainGaugeOpacity, riverLevelScale, riverLevelOpacity, groundwaterScale, groundwaterOpacity, groundwaterWellsScale, groundwaterWellsOpacity, iotWraRiverScale, iotWraRiverOpacity, iotWraRiverShowMeasured, iotWraRiverShowForecast, iotWraStructureScale, iotWraStructureOpacity, iotWraStructureFlow, iotWraStructureGate, iotWraStructureDam, iotWraStructureErosion, iotWraStructureDust, floodSensorScale, floodSensorOpacity, floodSensorIsochroneOpacity, taipeiSewerScale, taipeiSewerOpacity, taipeiEvacuateScale, taipeiEvacuateOpacity, taipeiPumbScale, taipeiPumbOpacity, precipRasterOpacity, precipRasterHours, wasteStopsStaticScale, wasteStopsStaticGlow, wasteStopsStaticZ, agricultureOpacity, agricultureOutlineWidth, agricultureShowOutline, agricultureZ, agriSoilOpacity, agriSoilFertilityOpacity, agriSoilFertilityMetric, agriLeisureFarmZonesOpacity, agriRuralRegenOpacity, agriCropSuitabilityOpacity, agriCropSuitabilityCropId, agriPOIOpacity, agriPOIScale, agriRetailOpacity, agriRetailScale, agriProduceWholesaleOpacity, agriProduceWholesaleScale, agriWholesaleMarketOpacity, agriWholesaleMarketScale, livestockFarmPigOpacity, livestockFarmPigScale, livestockFarmChickenOpacity, livestockFarmChickenScale, livestockFarmCattleOpacity, livestockFarmCattleScale, livestockFarmDuckOpacity, livestockFarmDuckScale, livestockFarmGooseOpacity, livestockFarmGooseScale, livestockFarmSheepOpacity, livestockFarmSheepScale, livestockFarmOtherOpacity, livestockFarmOtherScale, livestockSlaughterOpacity, livestockSlaughterScale, livestockFeedOpacity, livestockFeedScale, livestockMarketOpacity, livestockMarketScale, livestockFarmPigHighlightIdx, livestockFarmChickenHighlightIdx, livestockFarmCattleHighlightIdx, livestockFarmDuckHighlightIdx, livestockFarmGooseHighlightIdx, livestockFarmSheepHighlightIdx, livestockFarmOtherHighlightIdx, sportsSchoolOpacity, sportsSchoolScale, sportsPublicOtherOpacity, sportsPublicOtherScale, sportsPrivateOpacity, sportsPrivateScale, sportsParkOpacity, sportsParkScale, sportsCenterOpacity, sportsCenterScale, farmRoadsWidth, farmRoadsOpacity, ecoNetworkZonesOpacity, forestCompartmentsOpacity, forestCompartmentsOutlineWidth, forestCompartmentsShowOutline, forestReserveOpacity, forestReserveOutlineWidth, forestReserveShowOutline, forestRecreationOpacity, forestRecreationOutlineWidth, forestRecreationShowOutline, forestTreatmentWorksOpacity, forestTreatmentWorksOutlineWidth, forestTreatmentWorksShowOutline, forestFlatParksOpacity, forestFlatParksOutlineWidth, forestFlatParksShowOutline, forestDamLakesOpacity, forestDamLakesOutlineWidth, forestDamLakesShowOutline, forestRoadsOpacity, forestRoadsWidth, forestAlishanRailOpacity, forestAlishanRailWidth, forestTrailSignsOpacity, forestTrailSignsScale, forestSignalPointsOpacity, forestSignalPointsScale, forestEducationCentersOpacity, forestEducationCentersScale, forestWildlifeOpacity, forestWildlifeScale, hikingTrailsOpacity, hikingTrailsWidth, canopyHeightOpacity, canopyGiantsOpacity, powerPlantsOpacity, powerPlantsScale, powerPlantGlowOpacity, powerPlantGlowSize, substationEhvGlowOpacity, substationEhvGlowSize, powerLinesGlowOpacity, powerLinesGlowWidth, aviationRestrictedGlowOpacity, powerGenerationOpacity, powerGenerationHeight, osmSubstationsOpacity, osmSubstationsSize, osmSubstationsEhvOpacity, osmSubstationsEhvSize, osmPowerLinesOpacity, osmPowerLinesWidth, osmPowerTowersOpacity, osmPowerTowersSize, aviationControlOpacity, aviationRestrictedOpacity, droneNfzOpacity, droneRestrictedOpacity, powerPolesOpacity, powerPolesSize, powerPolesHeat, powerPolesZ5Reveal, osmWindTurbinesOpacity, osmWindTurbinesSize, osmSolarFarmsOpacity, osmSolarFarmsSize, osmPowerPlantsStaticOpacity, osmPowerPlantsStaticSize, offshoreWindZonesOpacity, islandPowerGridOpacity, islandPowerGridSize, fossilFuelInfraOpacity, fossilFuelInfraSize, geothermalWellsOpacity, geothermalWellsSize, renewablePermitsTaipeiOpacity, renewablePermitsTaipeiSize, evChargingOpacity, lightningOpacity, lightningMinutes, nuclearOpacity, nuclearScale, facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale, facOffshoreOpacity, facPlannedOpacity, facPlannedScale, facHistoricalOpacity, facHistoricalScale, facSecondaryOpacity, facSecondaryScale, facOsmSupplementOpacity, facOsmSupplementScale, gasStationCpcOpacity, gasStationCpcScale, gasStationFpccOpacity, gasStationFpccScale, gasStationTaisugarOpacity, gasStationTaisugarScale, gasStationOtherOpacity, gasStationOtherScale, gasStationCanonicalOpacity, gasStationCanonicalScale, lpgSubpackagingOpacity, lpgSubpackagingScale, lpgRetailersOpacity, lpgRetailersScale, lngTerminalOpacity, lngTerminalScale, pipelineGasOpacity, pipelineGasWidth, pipelineOilGasOpacity, pipelineOilGasWidth, industrialRefineryOpacity, industrialRefineryOutline, industrialStorageTankOpacity, industrialStorageTankOutline, industrialPowerPlantOpacity, industrialPowerPlantOutline, coalTerminalOpacity, coalTerminalScale, gasCoverageAllOpacity, gasCoverageAllLineWidth, gasCoverageCpcOpacity, gasCoverageCpcLineWidth, gasCoverageFpccOpacity, gasCoverageFpccLineWidth, gasCoverageTaisugarOpacity, gasCoverageTaisugarLineWidth, evIslandOpacity, evIslandLineWidth, earthquakesGlobalOpacity, typhoonTracksOpacity, typhoonSource, dustForecastOpacity, oceanCurrentsOpacity, windFieldOpacity, windAnimationSpeed, windParticleCount, windLineWidth, oceanAnimationSpeed, oceanParticleCount, oceanLineWidth, worldTrashDebrisOpacity,
    policeStationOpacity, policeStationScale, womenChildWarningOpacity, womenChildWarningScale,
    speedCameraOpacity, speedCameraScale, speedZoneSegmentOpacity, speedZoneSegmentWidth,
    courtOpacity, courtScale, prosecutorsOfficeOpacity, prosecutorsOfficeScale,
    correctionalFacilityOpacity, correctionalFacilityScale, courtJurisdictionOpacity,
    aquaculturePondsOpacity, aquacultureZoneOpacity, aquacultureCageNetOpacity,
    aquacultureWaterSatelliteOpacity, aquacultureWaterSatelliteConfidence, aquacultureWaterSatelliteMoaOpacity, aquacultureIntegratedOpacity, lakesPondsOsmOpacity,
    aquacultureWaterSatelliteMoaShowConfirmed, aquacultureWaterSatelliteMoaShowSolar, aquacultureWaterSatelliteMoaShowOther,
    aquacultureWaterUnionOpacity, aquacultureWaterUnionShowBoth, aquacultureWaterUnionShowMoaOnly, aquacultureWaterUnionShowOsmOnly,
    streetTreesTaipeiDiffOpacity, streetTreesTaipeiDiffStatus, streetTreesTaipeiDiffRadius, streetTreesTaipeiDiffColorMode,
    protectedTreesNationalOpacity, protectedTreesNationalRadius, protectedTreesNationalColorMode, protectedTreesNationalCity,
    riversideTreesTaipeiOpacity, riversideTreesTaipeiRadius, riversideTreesTaipeiPark,
    parksTaipeiOpacity, parksTaipeiRadius, parksTaipeiCategory,
    culturalFacilitiesOpacity, culturalFacilitiesRadius, culturalFacilitiesType,
    culturalMuseumsOpacity, culturalMuseumsRadius, culturalMuseumsType,
    artsEventsOpacity, artsEventsRadius, artsEventsStatus,
    performingVenuesOpacity, performingVenuesRadius,
    streetTreesTaipei3epochOpacity, streetTreesTaipei3epochRadius, streetTreesTaipei3epochColorMode, streetTreesTaipei3epochTrajFilter,
    streetTreesNationalOpacity, streetTreesNationalRadius, streetTreesNationalColorMode, streetTreesNationalCity,
    treePitsTaipeiOpacity, treePitsTaipeiType,
    buildingsGbaModeIdx, buildingsGbaMinHeight, buildingsGbaOpacity, buildingsGbaBloomMinHeight,
    urbanFormGridModeIdx, urbanFormGridOpacity,
    propertyValueGridScaleIdx, propertyValueGridModeIdx, propertyValueGridOpacity, propertyValueGridContrast, propertyValueGridExtruded, propertyValueGridElevationScale,
    urbanZoningTaipeiOpacity, urbanZoningTaipeiCategory,
    urbanZoningNewTaipeiOpacity, urbanZoningNewTaipeiCategory,
    crimeAreaMonthlyOpacity, theftTaoyuanOpacity, theftTaoyuanScale,
    trafficAccidentYearlyOpacity, trafficAccidentYearlyScale, accidentTaipeiOpacity, accidentTaipeiScale,
    a1AccidentRealtimeOpacity, a1AccidentRealtimeScale, investigationBureauOpacity, investigationBureauScale,
    antiCorruptionOfficeOpacity, antiCorruptionOfficeScale, immigrationOfficeOpacity, immigrationOfficeScale,
    coastGuardStationOpacity, coastGuardStationScale, civilDefenseShelterOpacity, civilDefenseShelterScale,
    policeIsoSubstationOpacity, policeIsoSubstationMode, policeIsoSubstationMinutes,
    policeIsoPrecinctOpacity, policeIsoPrecinctMode, policeIsoPrecinctMinutes,
    policeIsoCityDeptOpacity, policeIsoCityDeptMode, policeIsoCityDeptMinutes,
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    pollutionSiteOpacity, pollutionSiteScale,
    tourAttractionsOpacity, tourAttractionsScale, tourAttractionsMode,
    tourHotSpringsOpacity, tourHotSpringsScale, tourHotSpringZonesOpacity, tourScenicAreasOpacity,
    tourHeritageOpacity, tourHeritageScale,
    religionTemplesOpacity, religionTemplesScale, religionTemplesRegistry, religionTemplesDeity,
    religionChurchesOpacity, religionChurchesScale, religionChurchesRegistry,
    religionAncestralHallsOpacity, religionAncestralHallsScale, religionAncestralHallsRegistry,
    religionFoundationsOpacity, religionFoundationsScale,
    religionOtherWorshipOpacity, religionOtherWorshipScale,
    religionTop100Opacity, religionTop100Scale,
    tourEventsOpacity, tourEventsScale, tourEventsStatus,
    tourFactoriesOpacity, tourFactoriesScale, tourAmusementParksOpacity, tourAmusementParksScale,
    tourCampingOpacity, tourCampingScale,
    tourHotelsOpacity, tourHotelsScale, tourHotelsClass,
    tourRestaurantsOpacity, tourRestaurantsScale,
    aqiMicroModeIdx, urbanHeatModeIdx, urbanHeatOpacity]);

  const getControls = (layer: ExpandableLayerKey): ParamControl[] => {
    switch (layer) {
      case "flights": return [
        { label: `Alt ×${altExaggeration.toFixed(1)}`, value: altExaggeration, min: 1, max: 5, step: 0.5, onChange: setAltExaggeration },
        { label: `Z +${altOffset}m`, value: altOffset, min: 0, max: 200, step: 50, onChange: setAltOffset },
        { label: `Opacity ${staticOpacity.toFixed(2)}`, value: staticOpacity, min: 0.02, max: 0.5, step: 0.02, onChange: setStaticOpacity },
        { label: `Orb ${(orbScale * 100000).toFixed(1)}`, value: orbScale, min: 0.000001, max: 0.00001, step: 0.000001, onChange: setOrbScale },
      ];
      case "ships": return [
        { label: `Ship Orb ${(shipOrbScale * 100000).toFixed(1)}`, value: shipOrbScale, min: 0.000001, max: 0.00002, step: 0.000001, onChange: setShipOrbScale },
        { label: `Ship Trail ${shipTrailOpacity.toFixed(2)}`, value: shipTrailOpacity, min: 0.05, max: 1, step: 0.05, onChange: setShipTrailOpacity },
      ];
      case "rail": return [
        { type: "toggle" as const, label: "Train", value: railTrainVisible, onChange: setRailTrainVisible },
        { type: "select" as const, label: "Track", value: railTrackMode, options: [{ label: "2D", value: "2d" }, { label: "3D", value: "3d" }], onChange: (v: string) => setRailTrackMode(v as "2d" | "3d") },
        { label: `Rail Z +${railAltOffset}m`, value: railAltOffset, min: 0, max: 500, step: 10, onChange: setRailAltOffset },
        { label: `Rail Orb ${(railOrbScale * 100000).toFixed(1)}`, value: railOrbScale, min: 0.000001, max: 0.00002, step: 0.000001, onChange: setRailOrbScale },
        { label: `Rail Trk ${railTrackOpacity.toFixed(2)}`, value: railTrackOpacity, min: 0.05, max: 1, step: 0.05, onChange: setRailTrackOpacity },
      ];
      case "busLive": return [
        ...([
          "TaipeiMetro",
          "KeelungYilan",
          "TaoyuanHsinchuMiaoli",
          "CentralTaiwan",
          "YunChiaNan",
          "Kaoping",
          "HualienTaitung",
          "OffshoreIslands",
        ] as BusGroup[]).map((g) => ({
          type: "toggle" as const,
          label: BUS_GROUP_LABELS[g],
          value: busGroups[g],
          onChange: (v: boolean) => setBusGroup(g, v),
        })),
        { type: "select" as const, label: "Color", value: busColorMode, options: [{ label: "路線", value: "route" }, { label: "速度", value: "speed" }, { label: "密度", value: "density" }], onChange: (v: string) => setBusColorMode(v as BusColorMode) },
        { label: `Bus Z +${busAltOffset}m`, value: busAltOffset, min: 0, max: 500, step: 10, onChange: setBusAltOffset },
        { label: `Bus Orb ${(busOrbScale * 1000000).toFixed(0)}`, value: busOrbScale, min: 0.000001, max: 0.00001, step: 0.000001, onChange: setBusOrbScale },
      ];
      case "busIntercityLive": return [
        { type: "select" as const, label: "Color", value: busIntercityColorMode, options: [{ label: "路線", value: "route" }, { label: "速度", value: "speed" }, { label: "密度", value: "density" }], onChange: (v: string) => setBusIntercityColorMode(v as BusColorMode) },
        { label: `InterCity Z +${busIntercityAltOffset}m`, value: busIntercityAltOffset, min: 0, max: 500, step: 10, onChange: setBusIntercityAltOffset },
        { label: `InterCity Orb ${(busIntercityOrbScale * 1000000).toFixed(0)}`, value: busIntercityOrbScale, min: 0.000001, max: 0.00001, step: 0.000001, onChange: setBusIntercityOrbScale },
      ];
      case "touristShuttleLive": return [
        { type: "select" as const, label: "Color", value: touristShuttleColorMode, options: [{ label: "路線", value: "route" }, { label: "速度", value: "speed" }, { label: "密度", value: "density" }], onChange: (v: string) => setTouristShuttleColorMode(v as BusColorMode) },
        { label: `Opacity ${touristShuttleOpacity.toFixed(2)}`, value: touristShuttleOpacity, min: 0.2, max: 1, step: 0.05, onChange: setTouristShuttleOpacity },
        { label: `Shuttle Z +${touristShuttleAltOffset}m`, value: touristShuttleAltOffset, min: 0, max: 500, step: 10, onChange: setTouristShuttleAltOffset },
        { label: `Shuttle Orb ${(touristShuttleOrbScale * 1000000).toFixed(0)}`, value: touristShuttleOrbScale, min: 0.000001, max: 0.00001, step: 0.000001, onChange: setTouristShuttleOrbScale },
      ];
      case "busStationsCity":
      case "busStationsIntercity": return [
        { label: `Bus ${busScale.toFixed(1)}`, value: busScale, min: 0.3, max: 3, step: 0.1, onChange: setBusScale },
      ];
      case "bikeStations": return [
        { label: `Bike ${bikeScale.toFixed(1)}`, value: bikeScale, min: 0.3, max: 3, step: 0.1, onChange: setBikeScale },
      ];
      case "lighthouses": return [
        { label: `LH ${lighthouseScale.toFixed(1)}`, value: lighthouseScale, min: 0.3, max: 3, step: 0.1, onChange: setLighthouseScale },
        { type: "toggle", label: "Beam", value: beamVisible, onChange: setBeamVisible },
        { label: `Dist ${beamDistance.toFixed(1)}`, value: beamDistance, min: 0.2, max: 3, step: 0.1, onChange: setBeamDistance },
        { label: `Opa ${beamOpacity.toFixed(2)}`, value: beamOpacity, min: 0.05, max: 0.8, step: 0.05, onChange: setBeamOpacity },
      ];
      case "stationsTHSR": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: thsrPillarVisible, onChange: setThsrPillarVisible },
        { label: `Height ${thsrPillarHeight.toFixed(1)}`, value: thsrPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setThsrPillarHeight },
      ];
      case "stationsTRA": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: traPillarVisible, onChange: setTraPillarVisible },
        { label: `Height ${traPillarHeight.toFixed(1)}`, value: traPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setTraPillarHeight },
      ];
      case "stationsMetro": return [
        { label: `Stn ${stationScale.toFixed(1)}`, value: stationScale, min: 0.3, max: 3, step: 0.1, onChange: setStationScale },
        { type: "toggle" as const, label: "Pillar", value: metroPillarVisible, onChange: setMetroPillarVisible },
        { label: `Height ${metroPillarHeight.toFixed(1)}`, value: metroPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setMetroPillarHeight },
      ];
      case "highways": return [
        { label: `Width ${highwayWidth.toFixed(1)}`, value: highwayWidth, min: 0.3, max: 3, step: 0.1, onChange: setHighwayWidth },
        { label: `Glow ${highwayGlow.toFixed(1)}`, value: highwayGlow, min: 0, max: 3, step: 0.1, onChange: setHighwayGlow },
      ];
      case "provincialRoads": return [
        { label: `Width ${provincialWidth.toFixed(1)}`, value: provincialWidth, min: 0.3, max: 3, step: 0.1, onChange: setProvincialWidth },
        { label: `Glow ${provincialGlow.toFixed(1)}`, value: provincialGlow, min: 0, max: 3, step: 0.1, onChange: setProvincialGlow },
      ];
      case "ports": return [
        { label: `Glow ${portGlow.toFixed(1)}`, value: portGlow, min: 0, max: 3, step: 0.1, onChange: setPortGlow },
        { type: "toggle" as const, label: "Pillar", value: portPillarVisible, onChange: setPortPillarVisible },
        { label: `Height ${portPillarHeight.toFixed(1)}`, value: portPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setPortPillarHeight },
      ];
      case "airports": return [
        { label: `APT ${airportOpacity.toFixed(2)}`, value: airportOpacity, min: 0, max: 0.3, step: 0.01, onChange: setAirportOpacity },
        { label: `Glow ${airportGlow.toFixed(1)}`, value: airportGlow, min: 0, max: 2, step: 0.1, onChange: setAirportGlow },
        { type: "toggle" as const, label: "Pillar", value: airportPillarVisible, onChange: setAirportPillarVisible },
        { label: `Height ${airportPillarHeight.toFixed(1)}`, value: airportPillarHeight, min: 0.2, max: 3, step: 0.1, onChange: setAirportPillarHeight },
      ];
      case "cyclingRoutes": return [
        { label: `Cycling ${cyclingWidth.toFixed(1)}`, value: cyclingWidth, min: 0.3, max: 3, step: 0.1, onChange: setCyclingWidth },
      ];
      case "freewayCongestion": return [
        { label: `Freeway ${freewayWidth.toFixed(1)}`, value: freewayWidth, min: 0.3, max: 3, step: 0.1, onChange: setFreewayWidth },
      ];
      case "roadCongestion": return [
        { label: `寬度 ${roadCongestionWidth.toFixed(1)}`, value: roadCongestionWidth, min: 0.3, max: 3, step: 0.1, onChange: setRoadCongestionWidth },
        { label: `透明度 ${roadCongestionOpacity.toFixed(2)}`, value: roadCongestionOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRoadCongestionOpacity },
      ];
      case "weatherStations": return [
        { label: `Weather ${weatherScale.toFixed(1)}`, value: weatherScale, min: 0.3, max: 3, step: 0.1, onChange: setWeatherScale },
      ];
      case "cctv": return [
        { label: `大小 ${cctvScale.toFixed(1)}`, value: cctvScale, min: 0.3, max: 3, step: 0.1, onChange: setCctvScale },
        { label: `透明度 ${cctvOpacity.toFixed(2)}`, value: cctvOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCctvOpacity },
        { label: `Z 漂浮 ${cctvZ.toFixed(0)}px`, value: cctvZ, min: 0, max: 100, step: 2, onChange: setCctvZ },
      ];
      case "fireStations": return [
        { type: "toggle" as const, label: "散點", value: fireStationsDots, onChange: setFireStationsDots },
        { type: "toggle" as const, label: "3D 光柱波動", value: fireStations3D, onChange: setFireStations3D },
        { label: `大小 ${fireStationsScale.toFixed(1)}`, value: fireStationsScale, min: 0.3, max: 3, step: 0.1, onChange: setFireStationsScale },
        { label: `透明度 ${fireStationsOpacity.toFixed(2)}`, value: fireStationsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFireStationsOpacity },
        { label: `Z 漂浮 ${fireStationsZ.toFixed(0)}px`, value: fireStationsZ, min: 0, max: 100, step: 2, onChange: setFireStationsZ },
      ];
      case "fireHydrants": return [
        { label: `大小 ${fireHydrantsScale.toFixed(1)}`, value: fireHydrantsScale, min: 0.3, max: 3, step: 0.1, onChange: setFireHydrantsScale },
        { label: `透明度 ${fireHydrantsOpacity.toFixed(2)}`, value: fireHydrantsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFireHydrantsOpacity },
        { label: `Z 漂浮 ${fireHydrantsZ.toFixed(0)}px`, value: fireHydrantsZ, min: 0, max: 100, step: 2, onChange: setFireHydrantsZ },
      ];
      case "fireIsochrone": return [
        { type: "select" as const, label: "縣市", value: fireIsochroneCounty, options: FIRE_ISOCHRONE_COUNTY_OPTIONS, onChange: setFireIsochroneCounty },
        { label: `透明度 ${fireIsochroneOpacity.toFixed(2)}`, value: fireIsochroneOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setFireIsochroneOpacity },
      ];
      case "fireEvents": return [
        { label: `透明度 ${fireEventsOpacity.toFixed(2)}`, value: fireEventsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFireEventsOpacity },
      ];
      case "fireLatest": return [
        { label: `透明度 ${fireLatestOpacity.toFixed(2)}`, value: fireLatestOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFireLatestOpacity },
      ];
      case "erHospital": return [
        { label: `透明度 ${erHospitalOpacity.toFixed(2)}`, value: erHospitalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setErHospitalOpacity },
      ];
      case "librarySeats": return [
        { label: `透明度 ${librarySeatsOpacity.toFixed(2)}`, value: librarySeatsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLibrarySeatsOpacity },
      ];
      case "parkingOnstreet": return [
        { label: `透明度 ${parkingOnstreetOpacity.toFixed(2)}`, value: parkingOnstreetOpacity, min: 0.1, max: 1, step: 0.05, onChange: setParkingOnstreetOpacity },
      ];
      case "parkingOffstreet": return [
        { label: `透明度 ${parkingOffstreetOpacity.toFixed(2)}`, value: parkingOffstreetOpacity, min: 0.1, max: 1, step: 0.05, onChange: setParkingOffstreetOpacity },
      ];
      case "medHospital": return [
        { label: `透明度 ${medHospitalOpacity.toFixed(2)}`, value: medHospitalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMedHospitalOpacity },
        { label: `大小 ${medHospitalScale.toFixed(1)}`, value: medHospitalScale, min: 0.3, max: 3, step: 0.1, onChange: setMedHospitalScale },
      ];
      case "medClinic": return [
        { label: `透明度 ${medClinicOpacity.toFixed(2)}`, value: medClinicOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMedClinicOpacity },
        { label: `大小 ${medClinicScale.toFixed(1)}`, value: medClinicScale, min: 0.3, max: 3, step: 0.1, onChange: setMedClinicScale },
      ];
      case "medPharmacy": return [
        { label: `透明度 ${medPharmacyOpacity.toFixed(2)}`, value: medPharmacyOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMedPharmacyOpacity },
        { label: `大小 ${medPharmacyScale.toFixed(1)}`, value: medPharmacyScale, min: 0.3, max: 3, step: 0.1, onChange: setMedPharmacyScale },
      ];
      case "medAED": return [
        { label: `透明度 ${medAEDOpacity.toFixed(2)}`, value: medAEDOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMedAEDOpacity },
        { label: `大小 ${medAEDScale.toFixed(1)}`, value: medAEDScale, min: 0.3, max: 3, step: 0.1, onChange: setMedAEDScale },
      ];
      case "medLTC": return [
        { label: `透明度 ${medLTCOpacity.toFixed(2)}`, value: medLTCOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMedLTCOpacity },
        { label: `大小 ${medLTCScale.toFixed(1)}`, value: medLTCScale, min: 0.3, max: 3, step: 0.1, onChange: setMedLTCScale },
      ];
      case "medIsochrone": return [
        { label: `透明度 ${medIsochroneOpacity.toFixed(2)}`, value: medIsochroneOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setMedIsochroneOpacity },
      ];
      // medDesert 與 medIsochrone 共用同一個 fill layer → 透明度 slider 綁同一個 state
      case "medDesert": return [
        { label: `透明度 ${medIsochroneOpacity.toFixed(2)}`, value: medIsochroneOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setMedIsochroneOpacity },
      ];
      case "etcGantry": return [
        { label: `大小 ${etcGantryScale.toFixed(1)}`, value: etcGantryScale, min: 0.3, max: 3, step: 0.1, onChange: setEtcGantryScale },
        { label: `透明度 ${etcGantryOpacity.toFixed(2)}`, value: etcGantryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEtcGantryOpacity },
        { label: `Z 漂浮 ${etcGantryZ.toFixed(0)}px`, value: etcGantryZ, min: 0, max: 100, step: 2, onChange: setEtcGantryZ },
      ];
      case "serviceArea": return [
        { label: `大小 ${serviceAreaScale.toFixed(1)}`, value: serviceAreaScale, min: 0.3, max: 3, step: 0.1, onChange: setServiceAreaScale },
        { label: `透明度 ${serviceAreaOpacity.toFixed(2)}`, value: serviceAreaOpacity, min: 0.1, max: 1, step: 0.05, onChange: setServiceAreaOpacity },
        { label: `Z 漂浮 ${serviceAreaZ.toFixed(0)}px`, value: serviceAreaZ, min: 0, max: 100, step: 2, onChange: setServiceAreaZ },
      ];
      case "serviceAreaPolygon": return [
        { label: `填色透明度 ${serviceAreaPolygonOpacity.toFixed(2)}`, value: serviceAreaPolygonOpacity, min: 0, max: 0.6, step: 0.02, onChange: setServiceAreaPolygonOpacity },
        { label: `邊框寬 ${serviceAreaPolygonLineWidth.toFixed(1)}`, value: serviceAreaPolygonLineWidth, min: 0, max: 4, step: 0.5, onChange: setServiceAreaPolygonLineWidth },
      ];
      case "taxiStand": return [
        { label: `大小 ${taxiStandScale.toFixed(1)}`, value: taxiStandScale, min: 0.3, max: 3, step: 0.1, onChange: setTaxiStandScale },
        { label: `透明度 ${taxiStandOpacity.toFixed(2)}`, value: taxiStandOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTaxiStandOpacity },
        { label: `Z 漂浮 ${taxiStandZ.toFixed(0)}px`, value: taxiStandZ, min: 0, max: 100, step: 2, onChange: setTaxiStandZ },
      ];
      case "temperatureWave": return [
        { type: "toggle" as const, label: "3D", value: tempExtruded, onChange: setTempExtruded },
        { label: `Height ${tempHeight}`, value: tempHeight, min: 0, max: 400, step: 20, onChange: setTempHeight },
        { label: `Z Offset ${tempZOffset}`, value: tempZOffset, min: 0, max: 1000, step: 50, onChange: setTempZOffset },
        { label: `Opacity ${tempOpacity.toFixed(2)}`, value: tempOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTempOpacity },
        { type: "toggle" as const, label: "Grid", value: tempWireframe, onChange: setTempWireframe },
      ];
      case "temperatureGrid": return [
        { label: `透明度 ${tempGridOpacity.toFixed(2)}`, value: tempGridOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTempGridOpacity },
      ];
      // 都市熱島：2 選項 → ExpandedControls 會渲染成 button row（≥4 才轉原生 dropdown）
      case "urbanHeat": return [
        { type: "select" as const, label: "顯示", value: String(urbanHeatModeIdx), options: URBAN_HEAT_MODES.map((m) => ({ label: m.label, value: m.value })), onChange: (v: string) => setUrbanHeatModeIdx(parseInt(v, 10)) },
        { label: `透明度 ${urbanHeatOpacity.toFixed(2)}`, value: urbanHeatOpacity, min: 0.2, max: 1, step: 0.05, onChange: setUrbanHeatOpacity },
      ];
      case "windPlan": return [];
      case "schools": return [
        { label: `Scale ${schoolScale.toFixed(1)}`, value: schoolScale, min: 0.3, max: 3, step: 0.1, onChange: setSchoolScale },
        { type: "toggle" as const, label: "分級配色", value: schoolLevelColor, onChange: setSchoolLevelColor },
      ];
      case "convenienceStores": return [
        { label: `Scale ${convenienceScale.toFixed(1)}`, value: convenienceScale, min: 0.3, max: 3, step: 0.1, onChange: setConvenienceScale },
      ];
      case "postOffices": return [
        { label: `透明度 ${postOfficesOpacity.toFixed(2)}`, value: postOfficesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPostOfficesOpacity },
        { label: `大小 ${postOfficesScale.toFixed(1)}`, value: postOfficesScale, min: 0.3, max: 3, step: 0.1, onChange: setPostOfficesScale },
      ];
      case "iPostBoxes": return [
        { label: `透明度 ${iPostBoxesOpacity.toFixed(2)}`, value: iPostBoxesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIPostBoxesOpacity },
        { label: `大小 ${iPostBoxesScale.toFixed(1)}`, value: iPostBoxesScale, min: 0.3, max: 3, step: 0.1, onChange: setIPostBoxesScale },
      ];
      case "communityCenters": return [
        { label: `透明度 ${communityCentersOpacity.toFixed(2)}`, value: communityCentersOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCommunityCentersOpacity },
        { label: `大小 ${communityCentersScale.toFixed(1)}`, value: communityCentersScale, min: 0.3, max: 3, step: 0.1, onChange: setCommunityCentersScale },
      ];
      case "govServiceOffices": return [
        { label: `透明度 ${govServiceOfficesOpacity.toFixed(2)}`, value: govServiceOfficesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGovServiceOfficesOpacity },
        { label: `大小 ${govServiceOfficesScale.toFixed(1)}`, value: govServiceOfficesScale, min: 0.3, max: 3, step: 0.1, onChange: setGovServiceOfficesScale },
      ];
      case "publicLibraries": return [
        { label: `透明度 ${publicLibrariesOpacity.toFixed(2)}`, value: publicLibrariesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPublicLibrariesOpacity },
        { label: `大小 ${publicLibrariesScale.toFixed(1)}`, value: publicLibrariesScale, min: 0.3, max: 3, step: 0.1, onChange: setPublicLibrariesScale },
      ];
      case "welfareCenters": return [
        { label: `透明度 ${welfareCentersOpacity.toFixed(2)}`, value: welfareCentersOpacity, min: 0.1, max: 1, step: 0.05, onChange: setWelfareCentersOpacity },
        { label: `大小 ${welfareCentersScale.toFixed(1)}`, value: welfareCentersScale, min: 0.3, max: 3, step: 0.1, onChange: setWelfareCentersScale },
      ];
      case "retailMarkets": return [
        { label: `透明度 ${retailMarketsOpacity.toFixed(2)}`, value: retailMarketsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRetailMarketsOpacity },
        { label: `大小 ${retailMarketsScale.toFixed(1)}`, value: retailMarketsScale, min: 0.3, max: 3, step: 0.1, onChange: setRetailMarketsScale },
      ];
      case "publicToilets": return [
        { label: `透明度 ${publicToiletsOpacity.toFixed(2)}`, value: publicToiletsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPublicToiletsOpacity },
        { label: `大小 ${publicToiletsScale.toFixed(1)}`, value: publicToiletsScale, min: 0.3, max: 3, step: 0.1, onChange: setPublicToiletsScale },
      ];
      case "submarineCables": return [];
      case "landingStations": return [];
      case "activeFaults": return [];
      case "newsEvents": return [
        { type: "select" as const, label: "相關度", value: String(newsMinRelevance), options: [
          { label: "全部", value: "0" },
          { label: "地方+", value: "2" },
          { label: "重大", value: "3" },
        ], onChange: (v: string) => setNewsMinRelevance(Number(v) as 0 | 2 | 3) },
        { type: "select" as const, label: "嚴重", value: String(newsMinSeverity), options: [
          { label: "全部", value: "0" },
          { label: "個案+", value: "1" },
          { label: "區域+", value: "2" },
        ], onChange: (v: string) => setNewsMinSeverity(Number(v) as 0 | 1 | 2) },
        { type: "toggle" as const, label: "只看事件", value: newsEventsOnly, onChange: setNewsEventsOnly },
        { type: "toggle" as const, label: "Time", value: newsTimeBased, onChange: setNewsTimeBased },
        { type: "toggle" as const, label: "Ripple", value: newsRipple, onChange: setNewsRipple },
        { label: `Scale ${newsScale.toFixed(1)}`, value: newsScale, min: 0.3, max: 3, step: 0.1, onChange: setNewsScale },
      ];
      case "h3Population": return [
        { label: `Opacity ${h3Opacity.toFixed(1)}`, value: h3Opacity, min: 0.1, max: 1, step: 0.1, onChange: setH3Opacity },
        { label: `Contrast ${h3Contrast.toFixed(1)}`, value: h3Contrast, min: 0.5, max: 4, step: 0.1, onChange: setH3Contrast },
        { type: "toggle" as const, label: "3D", value: h3Extruded, onChange: setH3Extruded },
        { label: `Height ${h3ElevationScale}`, value: h3ElevationScale, min: 10, max: 200, step: 10, onChange: setH3ElevationScale },
        { type: "select" as const, label: "Metric", value: h3Metric, options: [{ label: "Day", value: "day" }, { label: "Night", value: "night" }], onChange: (v: string) => setH3Metric(v as "day" | "night") },
      ];
      case "popCount": return [
        { label: `Opacity ${pcOpacity.toFixed(1)}`, value: pcOpacity, min: 0.1, max: 1, step: 0.1, onChange: setPcOpacity },
        { label: `Contrast ${pcContrast.toFixed(1)}`, value: pcContrast, min: 0.5, max: 4, step: 0.1, onChange: setPcContrast },
        { type: "toggle" as const, label: "3D", value: pcExtruded, onChange: setPcExtruded },
        { label: `Height ${pcElevationScale}`, value: pcElevationScale, min: 10, max: 200, step: 10, onChange: setPcElevationScale },
      ];
      case "indicators": {
        const categoryOptions = [
          { label: "Count", value: "count" },
          { label: "Struct", value: "struct" },
          { label: "Burden", value: "burden" },
        ];
        const metricMap: Record<string, { label: string; value: string }[]> = {
          count: [{ label: "HH", value: "hh" }, { label: "M", value: "m" }, { label: "F", value: "f" }],
          struct: [{ label: "Sex", value: "sr" }, { label: "PPH", value: "pph" }],
          burden: [{ label: "Dep", value: "dr" }, { label: "Child", value: "cd" }, { label: "Elder", value: "ed" }, { label: "Aging", value: "ai" }],
        };
        const currentMetrics = metricMap[indCategory] ?? metricMap.count!;
        return [
          { type: "select" as const, label: "Category", value: indCategory, options: categoryOptions, onChange: (v: string) => { setIndCategory(v); const first = (metricMap[v] ?? metricMap.count!)[0]!; setIndMetric(first.value); } },
          { type: "select" as const, label: "Metric", value: indMetric, options: currentMetrics, onChange: setIndMetric },
          { label: `Opacity ${indOpacity.toFixed(1)}`, value: indOpacity, min: 0.1, max: 1, step: 0.1, onChange: setIndOpacity },
          { label: `Contrast ${indContrast.toFixed(1)}`, value: indContrast, min: 0.5, max: 4, step: 0.1, onChange: setIndContrast },
          { type: "toggle" as const, label: "3D", value: indExtruded, onChange: setIndExtruded },
          { label: `Height ${indElevationScale}`, value: indElevationScale, min: 10, max: 200, step: 10, onChange: setIndElevationScale },
        ];
      }
      case "socioeconomic": {
        const socioCatOpts = [
          { label: "Income", value: "income" },
          { label: "Social", value: "social" },
        ];
        const socioMetricMap: Record<string, { label: string; value: string }[]> = {
          income: [{ label: "Med", value: "im" }, { label: "IQR", value: "iq" }, { label: "Sal%", value: "sr" }],
          social: [{ label: "Vital", value: "vs" }, { label: "Vuln", value: "vl" }],
        };
        const socioMetrics = socioMetricMap[socioCat] ?? socioMetricMap.income!;
        return [
          { type: "select" as const, label: "Category", value: socioCat, options: socioCatOpts, onChange: (v: string) => { setSocioCat(v); const first = (socioMetricMap[v] ?? socioMetricMap.income!)[0]!; setSocioMetric(first.value); } },
          { type: "select" as const, label: "Metric", value: socioMetric, options: socioMetrics, onChange: setSocioMetric },
          { label: `Opacity ${socioOpacity.toFixed(1)}`, value: socioOpacity, min: 0.1, max: 1, step: 0.1, onChange: setSocioOpacity },
          { label: `Contrast ${socioContrast.toFixed(1)}`, value: socioContrast, min: 0.5, max: 4, step: 0.1, onChange: setSocioContrast },
          { type: "toggle" as const, label: "3D", value: socioExtruded, onChange: setSocioExtruded },
          { label: `Height ${socioElevation}`, value: socioElevation, min: 10, max: 200, step: 10, onChange: setSocioElevation },
        ];
      }
      case "spatialEconomy": {
        const spatialCatOpts = [
          { label: "Housing", value: "housing" },
          { label: "Land", value: "land" },
        ];
        const spatialMetricMap: Record<string, { label: string; value: string }[]> = {
          housing: [{ label: "Price", value: "hp" }, { label: "Unit", value: "hu" }, { label: "P/I", value: "hpr" }],
          land: [{ label: "Amty", value: "ad" }, { label: "Mix", value: "lm" }],
        };
        const spatialMetrics = spatialMetricMap[spatialCat] ?? spatialMetricMap.housing!;
        return [
          { type: "select" as const, label: "Category", value: spatialCat, options: spatialCatOpts, onChange: (v: string) => { setSpatialCat(v); const first = (spatialMetricMap[v] ?? spatialMetricMap.housing!)[0]!; setSpatialMetric(first.value); } },
          { type: "select" as const, label: "Metric", value: spatialMetric, options: spatialMetrics, onChange: setSpatialMetric },
          { label: `Opacity ${spatialOpacity.toFixed(1)}`, value: spatialOpacity, min: 0.1, max: 1, step: 0.1, onChange: setSpatialOpacity },
          { label: `Contrast ${spatialContrast.toFixed(1)}`, value: spatialContrast, min: 0.5, max: 4, step: 0.1, onChange: setSpatialContrast },
          { type: "toggle" as const, label: "3D", value: spatialExtruded, onChange: setSpatialExtruded },
          { label: `Height ${spatialElevation}`, value: spatialElevation, min: 10, max: 200, step: 10, onChange: setSpatialElevation },
        ];
      }
      case "earthquakes": return [
        { label: `Opacity ${eqOpacity.toFixed(2)}`, value: eqOpacity, min: 0, max: 1, step: 0.05, onChange: setEqOpacity },
        { type: "select" as const, label: "Mode", value: eqShowHistory ? "history" : "timeline", options: [{ label: "Timeline", value: "timeline" }, { label: "History", value: "history" }], onChange: (v: string) => setEqShowHistory(v === "history") },
      ];
      // 事件選擇 / 播放控制在 EarthquakeReplayPanel（清單 + scrub 塞不進 240px sidebar，鐵則 4）
      case "earthquakeReplay": return [
        { label: `透明度 ${eqReplayOpacity.toFixed(2)}`, value: eqReplayOpacity, min: 0, max: 1, step: 0.05, onChange: setEqReplayOpacity },
      ];
      // ── 全球氣候 GLOBAL CLIMATE ──
      case "earthquakesGlobal": return [
        { label: `透明度 ${earthquakesGlobalOpacity.toFixed(2)}`, value: earthquakesGlobalOpacity, min: 0, max: 1, step: 0.05, onChange: setEarthquakesGlobalOpacity },
      ];
      // ── 🌍 世界 WORLD ──
      case "worldTrashDebris": return [
        { label: `透明度 ${worldTrashDebrisOpacity.toFixed(2)}`, value: worldTrashDebrisOpacity, min: 0, max: 1, step: 0.05, onChange: setWorldTrashDebrisOpacity },
      ];
      case "typhoonTracks": return [
        { type: "select" as const, label: "資料源", value: typhoonSource, options: [
          { label: "全部", value: "all" },
          { label: "JMA 日本", value: "jma" },
          { label: "JTWC 美軍", value: "jtwc" },
        ], onChange: setTyphoonSource },
        { label: `透明度 ${typhoonTracksOpacity.toFixed(2)}`, value: typhoonTracksOpacity, min: 0, max: 1, step: 0.05, onChange: setTyphoonTracksOpacity },
      ];
      case "dustForecast": return [
        { label: `透明度 ${dustForecastOpacity.toFixed(2)}`, value: dustForecastOpacity, min: 0, max: 1, step: 0.05, onChange: setDustForecastOpacity },
      ];
      case "oceanCurrents": return [
        { label: `透明度 ${oceanCurrentsOpacity.toFixed(2)}`, value: oceanCurrentsOpacity, min: 0, max: 1, step: 0.05, onChange: setOceanCurrentsOpacity },
        { label: `動畫速度 ${oceanAnimationSpeed.toFixed(1)}×`, value: oceanAnimationSpeed, min: 0.2, max: 3, step: 0.1, onChange: setOceanAnimationSpeed },
        { label: `粒子數 ${oceanParticleCount}`, value: oceanParticleCount, min: 2000, max: 50000, step: 1000, onChange: setOceanParticleCount },
        { label: `線寬 ${oceanLineWidth.toFixed(2)}px`, value: oceanLineWidth, min: 0.5, max: 1.5, step: 0.05, onChange: setOceanLineWidth },
      ];
      case "windField": return [
        { label: `透明度 ${windFieldOpacity.toFixed(2)}`, value: windFieldOpacity, min: 0, max: 1, step: 0.05, onChange: setWindFieldOpacity },
        { label: `動畫速度 ${windAnimationSpeed.toFixed(1)}×`, value: windAnimationSpeed, min: 0.2, max: 3, step: 0.1, onChange: setWindAnimationSpeed },
        { label: `粒子數 ${windParticleCount}`, value: windParticleCount, min: 2000, max: 80000, step: 1000, onChange: setWindParticleCount },
        { label: `線寬 ${windLineWidth.toFixed(2)}px`, value: windLineWidth, min: 0.5, max: 1.5, step: 0.05, onChange: setWindLineWidth },
      ];
      // NCDR 示警 5 群組共用同一個 opacity（單一 source）
      case "lifelineAlerts":
      case "floodAlerts":
      case "weatherAlerts":
      case "transitAlerts":
      case "safetyAlerts": return [
        { label: `Opacity ${daOpacity.toFixed(2)}`, value: daOpacity, min: 0, max: 1, step: 0.05, onChange: setDaOpacity },
      ];
      case "roadEvents": return [
        { label: `Opacity ${reOpacity.toFixed(2)}`, value: reOpacity, min: 0, max: 1, step: 0.05, onChange: setReOpacity },
      ];
      case "satellitesYaogan":
      case "satellitesJilin":
      case "satellitesGaofen":
      case "satellitesTJS":
      case "satellitesBeidou":
      case "satellitesShiyan":
      case "satellitesTaiwan":
      case "satellitesUSA":
      case "satellitesJapan":
      case "satellitesRussia":
      case "satellitesIndia":
      case "satellitesKorea":
      case "satellitesFrance":
      case "satellitesGermany":
      case "satellitesItaly":
      case "satellitesIsrael": return [
        { label: `Opacity ${satOpacity.toFixed(2)}`, value: satOpacity, min: 0, max: 1, step: 0.05, onChange: setSatOpacity },
      ];
      // 預載 1~7d 共用 timeline rangeDays（TimelineControls 下拉），這裡不重覆出 slider
      case "cwaCloudImagery": return [
        { label: `Opacity ${cwaCloudOpacity.toFixed(2)}`, value: cwaCloudOpacity, min: 0, max: 1, step: 0.05, onChange: setCwaCloudOpacity },
      ];
      case "cwaRadarImagery": return [
        { label: `Opacity ${cwaRadarOpacity.toFixed(2)}`, value: cwaRadarOpacity, min: 0, max: 1, step: 0.05, onChange: setCwaRadarOpacity },
      ];
      case "youbikeFullness": return [
        { type: "select" as const, label: "Grid", value: String(ybResolution), options: [{ label: "大", value: "7" }, { label: "中", value: "8" }, { label: "小", value: "9" }], onChange: (v: string) => setYbResolution(Number(v)) },
        { type: "select" as const, label: "Height", value: ybHeightMode, options: [{ label: "有車×容量", value: "mixed" }, { label: "有車率", value: "fullness" }, { label: "容量", value: "capacity" }], onChange: (v: string) => setYbHeightMode(v as "mixed" | "fullness" | "capacity") },
        { label: `Opacity ${ybOpacity.toFixed(1)}`, value: ybOpacity, min: 0.1, max: 1, step: 0.1, onChange: setYbOpacity },
        { label: `Contrast ${ybContrast.toFixed(1)}`, value: ybContrast, min: 0.3, max: 3, step: 0.1, onChange: setYbContrast },
        { type: "toggle" as const, label: "3D", value: ybExtruded, onChange: setYbExtruded },
        { label: `Height ${ybElevationScale}`, value: ybElevationScale, min: 10, max: 200, step: 10, onChange: setYbElevationScale },
      ];
      case "aqiImagery": return [
        { label: `Opacity ${aqiImageryOpacity.toFixed(2)}`, value: aqiImageryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAqiImageryOpacity },
      ];
      case "aqiStations": return [];
      case "aqiMicroSensors": return [
        { type: "select" as const, label: "顯示模式", value: String(aqiMicroModeIdx), options: [...MICRO_SENSOR_MODES], onChange: (v: string) => setAqiMicroModeIdx(parseInt(v, 10)) },
        { type: "toggle" as const, label: "Cluster", value: aqiMicroCluster, onChange: setAqiMicroCluster },
      ];
      case "waterBasins": return [
        { label: `透明度 ${waterBasinOpacity.toFixed(2)}`, value: waterBasinOpacity, min: 0, max: 1, step: 0.05, onChange: setWaterBasinOpacity },
      ];
      case "waterRivers": return [
        { label: `寬度 ${waterRiverWidth.toFixed(2)}`, value: waterRiverWidth, min: 0.3, max: 3, step: 0.1, onChange: setWaterRiverWidth },
        { label: `透明度 ${waterRiverOpacity.toFixed(2)}`, value: waterRiverOpacity, min: 0, max: 1, step: 0.05, onChange: setWaterRiverOpacity },
      ];
      case "waterCanals": return [
        { label: `寬度 ${waterCanalWidth.toFixed(2)}`, value: waterCanalWidth, min: 0.3, max: 3, step: 0.1, onChange: setWaterCanalWidth },
        { label: `透明度 ${waterCanalOpacity.toFixed(2)}`, value: waterCanalOpacity, min: 0, max: 1, step: 0.05, onChange: setWaterCanalOpacity },
      ];
      case "waterLevees": return [
        { label: `寬度 ${waterLeveeWidth.toFixed(2)}`, value: waterLeveeWidth, min: 0.3, max: 3, step: 0.1, onChange: setWaterLeveeWidth },
        { label: `透明度 ${waterLeveeOpacity.toFixed(2)}`, value: waterLeveeOpacity, min: 0, max: 1, step: 0.05, onChange: setWaterLeveeOpacity },
      ];
      case "waterProtectionZones": return [
        { label: `透明度 ${waterProtectionZoneOpacity.toFixed(2)}`, value: waterProtectionZoneOpacity, min: 0, max: 1, step: 0.05, onChange: setWaterProtectionZoneOpacity },
      ];
      case "waterReservoirs": return [
        { label: `水位計高度 ${reservoirPillarHeight.toFixed(2)}`, value: reservoirPillarHeight, min: 0, max: 3, step: 0.1, onChange: setReservoirPillarHeight },
      ];
      case "waterFacilities": return [
        { label: `大小 ${waterFacilityScale.toFixed(2)}`, value: waterFacilityScale, min: 0.3, max: 3, step: 0.1, onChange: setWaterFacilityScale },
        { label: `透明度 ${waterFacilityOpacity.toFixed(2)}`, value: waterFacilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setWaterFacilityOpacity },
      ];
      case "waterMonitorStations": return [
        { label: `大小 ${waterMonitorScale.toFixed(2)}`, value: waterMonitorScale, min: 0.3, max: 3, step: 0.1, onChange: setWaterMonitorScale },
        { label: `透明度 ${waterMonitorOpacity.toFixed(2)}`, value: waterMonitorOpacity, min: 0.1, max: 1, step: 0.05, onChange: setWaterMonitorOpacity },
      ];
      case "waterDetentionBasins": return [
        { label: `大小 ${detentionBasinScale.toFixed(2)}`, value: detentionBasinScale, min: 0.3, max: 3, step: 0.1, onChange: setDetentionBasinScale },
        { label: `透明度 ${detentionBasinOpacity.toFixed(2)}`, value: detentionBasinOpacity, min: 0.1, max: 1, step: 0.05, onChange: setDetentionBasinOpacity },
      ];
      case "lakesPondsOsm": return [
        { label: `填色透明度 ${lakesPondsOsmOpacity.toFixed(2)}`, value: lakesPondsOsmOpacity, min: 0, max: 0.85, step: 0.05, onChange: setLakesPondsOsmOpacity },
      ];
      case "waterFloodExtreme": return [
        { label: `透明度 ${waterFloodOpacity.toFixed(2)}`, value: waterFloodOpacity, min: 0.1, max: 1, step: 0.05, onChange: setWaterFloodOpacity },
        {
          type: "select" as const,
          label: "深度",
          value: String(floodMinDepth),
          options: [
            { label: "全部", value: "0" },
            { label: "≥0.5m", value: "0.5" },
            { label: "≥1m", value: "1" },
            { label: "≥2m", value: "2" },
            { label: "≥3m 最嚴重", value: "3" },
          ],
          onChange: (v: string) => setFloodMinDepth(Number(v) as 0 | 0.5 | 1 | 2 | 3),
        },
      ];
      case "rainGauge": return [
        { label: `大小 ${rainGaugeScale.toFixed(2)}`, value: rainGaugeScale, min: 0.5, max: 3, step: 0.1, onChange: setRainGaugeScale },
        { label: `透明度 ${rainGaugeOpacity.toFixed(2)}`, value: rainGaugeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRainGaugeOpacity },
      ];
      case "riverLevel": return [
        { label: `大小 ${riverLevelScale.toFixed(2)}`, value: riverLevelScale, min: 0.5, max: 3, step: 0.1, onChange: setRiverLevelScale },
        { label: `透明度 ${riverLevelOpacity.toFixed(2)}`, value: riverLevelOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRiverLevelOpacity },
      ];
      case "groundwater": return [
        { label: `大小 ${groundwaterScale.toFixed(2)}`, value: groundwaterScale, min: 0.5, max: 3, step: 0.1, onChange: setGroundwaterScale },
        { label: `透明度 ${groundwaterOpacity.toFixed(2)}`, value: groundwaterOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGroundwaterOpacity },
      ];
      case "groundwaterWells": return [
        { label: `大小 ${groundwaterWellsScale.toFixed(2)}`, value: groundwaterWellsScale, min: 0.5, max: 3, step: 0.1, onChange: setGroundwaterWellsScale },
        { label: `透明度 ${groundwaterWellsOpacity.toFixed(2)}`, value: groundwaterWellsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGroundwaterWellsOpacity },
      ];
      case "iotWraRiver": return [
        { label: `大小 ${iotWraRiverScale.toFixed(2)}`, value: iotWraRiverScale, min: 0.5, max: 3, step: 0.1, onChange: setIotWraRiverScale },
        { label: `透明度 ${iotWraRiverOpacity.toFixed(2)}`, value: iotWraRiverOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIotWraRiverOpacity },
        { type: "toggle", label: "即時水位", value: iotWraRiverShowMeasured, onChange: setIotWraRiverShowMeasured },
        { type: "toggle", label: "預測水位 (12-19h)", value: iotWraRiverShowForecast, onChange: setIotWraRiverShowForecast },
      ];
      case "iotWraStructure": return [
        { label: `大小 ${iotWraStructureScale.toFixed(2)}`, value: iotWraStructureScale, min: 0.5, max: 3, step: 0.1, onChange: setIotWraStructureScale },
        { label: `透明度 ${iotWraStructureOpacity.toFixed(2)}`, value: iotWraStructureOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIotWraStructureOpacity },
        { type: "toggle", label: "累計流量 Flow", value: iotWraStructureFlow, onChange: setIotWraStructureFlow },
        { type: "toggle", label: "閘門 Watergate", value: iotWraStructureGate, onChange: setIotWraStructureGate },
        { type: "toggle", label: "堤防安全 Dam", value: iotWraStructureDam, onChange: setIotWraStructureDam },
        { type: "toggle", label: "河床沖刷 Erosion", value: iotWraStructureErosion, onChange: setIotWraStructureErosion },
        { type: "toggle", label: "揚塵 Dust", value: iotWraStructureDust, onChange: setIotWraStructureDust },
      ];
      case "floodSensor": return [
        { label: `大小 ${floodSensorScale.toFixed(2)}`, value: floodSensorScale, min: 0.5, max: 3, step: 0.1, onChange: setFloodSensorScale },
        { label: `透明度 ${floodSensorOpacity.toFixed(2)}`, value: floodSensorOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFloodSensorOpacity },
      ];
      case "floodSensorIsochrone": return [
        { label: `透明度 ${floodSensorIsochroneOpacity.toFixed(2)}`, value: floodSensorIsochroneOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFloodSensorIsochroneOpacity },
      ];
      case "taipeiSewer": return [
        { label: `大小 ${taipeiSewerScale.toFixed(2)}`, value: taipeiSewerScale, min: 0.5, max: 3, step: 0.1, onChange: setTaipeiSewerScale },
        { label: `透明度 ${taipeiSewerOpacity.toFixed(2)}`, value: taipeiSewerOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTaipeiSewerOpacity },
      ];
      case "taipeiEvacuate": return [
        { label: `大小 ${taipeiEvacuateScale.toFixed(2)}`, value: taipeiEvacuateScale, min: 0.5, max: 3, step: 0.1, onChange: setTaipeiEvacuateScale },
        { label: `透明度 ${taipeiEvacuateOpacity.toFixed(2)}`, value: taipeiEvacuateOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTaipeiEvacuateOpacity },
      ];
      case "taipeiPumb": return [
        { label: `大小 ${taipeiPumbScale.toFixed(2)}`, value: taipeiPumbScale, min: 0.5, max: 3, step: 0.1, onChange: setTaipeiPumbScale },
        { label: `透明度 ${taipeiPumbOpacity.toFixed(2)}`, value: taipeiPumbOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTaipeiPumbOpacity },
      ];
      case "precipRaster": return [
        { label: `透明度 ${precipRasterOpacity.toFixed(2)}`, value: precipRasterOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPrecipRasterOpacity },
        {
          type: "select" as const,
          label: "累積時長",
          value: String(precipRasterHours),
          options: [
            { label: "1 小時", value: "1" },
            { label: "3 小時", value: "3" },
            { label: "6 小時", value: "6" },
            { label: "24 小時", value: "24" },
          ],
          onChange: (v: string) => setPrecipRasterHours(Number(v) as 1 | 3 | 6 | 24),
        },
      ];
      case "wasteTruck":
      case "wasteSchedule": return [
        // 8 區分組 toggle（只有 wasteSchedule 用；wasteTruck GPS 固定高雄+台南）
        ...(layer === "wasteSchedule" ? ([
          "TaipeiMetro",
          "KeelungYilan",
          "TaoyuanHsinchuMiaoli",
          "CentralTaiwan",
          "YunChiaNan",
          "Kaoping",
          "HualienTaitung",
          "OffshoreIslands",
        ] as BusGroup[]).map((g) => ({
          type: "toggle" as const,
          label: BUS_GROUP_LABELS[g],
          value: wasteScheduleGroups[g],
          onChange: (v: boolean) => setWasteScheduleGroup(g, v),
        })) : []),
        // wasteTruck (GPS) 跟 wasteSchedule (表定) 共用同 3 個 slider，視覺風格統一
        { label: `光點大小 ${wasteOrbScale.toFixed(2)}`, value: wasteOrbScale, min: 0.01, max: 0.8, step: 0.01, onChange: setWasteOrbScale },
        { label: `音符大小 ${wasteNoteSize.toFixed(2)}`, value: wasteNoteSize, min: 0.1, max: 2, step: 0.05, onChange: setWasteNoteSize },
        { label: `音符高度 ${wasteNoteZOffset.toFixed(0)}m`, value: wasteNoteZOffset, min: 0, max: 250, step: 5, onChange: setWasteNoteZOffset },
      ];
      case "wasteStopsStatic": return [
        { label: `大小 ${wasteStopsStaticScale.toFixed(2)}`, value: wasteStopsStaticScale, min: 0.3, max: 3, step: 0.1, onChange: setWasteStopsStaticScale },
        { label: `光暈 ${wasteStopsStaticGlow.toFixed(2)}`, value: wasteStopsStaticGlow, min: 0, max: 0.5, step: 0.02, onChange: setWasteStopsStaticGlow },
        { label: `Z 漂浮 ${wasteStopsStaticZ.toFixed(0)}px`, value: wasteStopsStaticZ, min: 0, max: 100, step: 2, onChange: setWasteStopsStaticZ },
      ];
      case "agriculture": return [
        { label: `透明度 ${agricultureOpacity.toFixed(2)}`, value: agricultureOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgricultureOpacity },
        { label: `邊框寬 ${agricultureOutlineWidth.toFixed(1)}`, value: agricultureOutlineWidth, min: 0, max: 5, step: 0.1, onChange: setAgricultureOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: agricultureShowOutline, onChange: setAgricultureShowOutline },
        { label: `Z 漂浮 ${agricultureZ.toFixed(0)}px`, value: agricultureZ, min: 0, max: 100, step: 2, onChange: setAgricultureZ },
      ];
      case "agriSoil": return [
        { label: `透明度 ${agriSoilOpacity.toFixed(2)}`, value: agriSoilOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriSoilOpacity },
      ];
      case "agriSoilFertility": return [
        { label: `透明度 ${agriSoilFertilityOpacity.toFixed(2)}`, value: agriSoilFertilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriSoilFertilityOpacity },
        {
          type: "select" as const,
          label: "著色",
          value: agriSoilFertilityMetric,
          options: SOIL_FERTILITY_METRIC_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          onChange: (v: string) => setAgriSoilFertilityMetric(v as SoilFertilityMetric),
        },
      ];
      case "agriLeisureFarmZones": return [
        { label: `透明度 ${agriLeisureFarmZonesOpacity.toFixed(2)}`, value: agriLeisureFarmZonesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriLeisureFarmZonesOpacity },
      ];
      case "agriRuralRegen": return [
        { label: `透明度 ${agriRuralRegenOpacity.toFixed(2)}`, value: agriRuralRegenOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriRuralRegenOpacity },
      ];
      case "agriCropSuitability": return [
        { label: `透明度 ${agriCropSuitabilityOpacity.toFixed(2)}`, value: agriCropSuitabilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriCropSuitabilityOpacity },
        ...buildCropSelector(agriCropSuitabilityCropId, setAgriCropSuitabilityCropId),
      ];
      case "agriPOI": return [
        { label: `透明度 ${agriPOIOpacity.toFixed(2)}`, value: agriPOIOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriPOIOpacity },
        { label: `大小 ${agriPOIScale.toFixed(2)}`, value: agriPOIScale, min: 0.3, max: 3, step: 0.1, onChange: setAgriPOIScale },
      ];
      case "agriRetail": return [
        { label: `透明度 ${agriRetailOpacity.toFixed(2)}`, value: agriRetailOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriRetailOpacity },
        { label: `大小 ${agriRetailScale.toFixed(2)}`, value: agriRetailScale, min: 0.3, max: 3, step: 0.1, onChange: setAgriRetailScale },
      ];
      case "agriProduceWholesale": return [
        { label: `透明度 ${agriProduceWholesaleOpacity.toFixed(2)}`, value: agriProduceWholesaleOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriProduceWholesaleOpacity },
        { label: `大小 ${agriProduceWholesaleScale.toFixed(2)}`, value: agriProduceWholesaleScale, min: 0.3, max: 3, step: 0.1, onChange: setAgriProduceWholesaleScale },
      ];
      case "agriWholesaleMarket": return [
        { label: `透明度 ${agriWholesaleMarketOpacity.toFixed(2)}`, value: agriWholesaleMarketOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriWholesaleMarketOpacity },
        { label: `大小 ${agriWholesaleMarketScale.toFixed(2)}`, value: agriWholesaleMarketScale, min: 0.3, max: 3, step: 0.1, onChange: setAgriWholesaleMarketScale },
      ];
      case "livestockFarmPig": return [
        { label: `透明度 ${livestockFarmPigOpacity.toFixed(2)}`, value: livestockFarmPigOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmPigOpacity },
        { label: `大小 ${livestockFarmPigScale.toFixed(2)}`, value: livestockFarmPigScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmPigScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmPig[livestockFarmPigHighlightIdx] ?? "全部"}`, value: String(livestockFarmPigHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmPig.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmPigHighlightIdx(Number(v)) },
      ];
      case "livestockFarmChicken": return [
        { label: `透明度 ${livestockFarmChickenOpacity.toFixed(2)}`, value: livestockFarmChickenOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmChickenOpacity },
        { label: `大小 ${livestockFarmChickenScale.toFixed(2)}`, value: livestockFarmChickenScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmChickenScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmChicken[livestockFarmChickenHighlightIdx] ?? "全部"}`, value: String(livestockFarmChickenHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmChicken.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmChickenHighlightIdx(Number(v)) },
      ];
      case "livestockFarmCattle": return [
        { label: `透明度 ${livestockFarmCattleOpacity.toFixed(2)}`, value: livestockFarmCattleOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmCattleOpacity },
        { label: `大小 ${livestockFarmCattleScale.toFixed(2)}`, value: livestockFarmCattleScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmCattleScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmCattle[livestockFarmCattleHighlightIdx] ?? "全部"}`, value: String(livestockFarmCattleHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmCattle.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmCattleHighlightIdx(Number(v)) },
      ];
      case "livestockFarmDuck": return [
        { label: `透明度 ${livestockFarmDuckOpacity.toFixed(2)}`, value: livestockFarmDuckOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmDuckOpacity },
        { label: `大小 ${livestockFarmDuckScale.toFixed(2)}`, value: livestockFarmDuckScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmDuckScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmDuck[livestockFarmDuckHighlightIdx] ?? "全部"}`, value: String(livestockFarmDuckHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmDuck.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmDuckHighlightIdx(Number(v)) },
      ];
      case "livestockFarmGoose": return [
        { label: `透明度 ${livestockFarmGooseOpacity.toFixed(2)}`, value: livestockFarmGooseOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmGooseOpacity },
        { label: `大小 ${livestockFarmGooseScale.toFixed(2)}`, value: livestockFarmGooseScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmGooseScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmGoose[livestockFarmGooseHighlightIdx] ?? "全部"}`, value: String(livestockFarmGooseHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmGoose.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmGooseHighlightIdx(Number(v)) },
      ];
      case "livestockFarmSheep": return [
        { label: `透明度 ${livestockFarmSheepOpacity.toFixed(2)}`, value: livestockFarmSheepOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmSheepOpacity },
        { label: `大小 ${livestockFarmSheepScale.toFixed(2)}`, value: livestockFarmSheepScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmSheepScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmSheep[livestockFarmSheepHighlightIdx] ?? "全部"}`, value: String(livestockFarmSheepHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmSheep.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmSheepHighlightIdx(Number(v)) },
      ];
      case "livestockFarmOther": return [
        { label: `透明度 ${livestockFarmOtherOpacity.toFixed(2)}`, value: livestockFarmOtherOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFarmOtherOpacity },
        { label: `大小 ${livestockFarmOtherScale.toFixed(2)}`, value: livestockFarmOtherScale, min: 0.01, max: 0.5, step: 0.01, onChange: setLivestockFarmOtherScale },
        { type: "select" as const, label: `品項 ${FARM_HIGHLIGHT_OPTIONS.livestockFarmOther[livestockFarmOtherHighlightIdx] ?? "全部"}`, value: String(livestockFarmOtherHighlightIdx), options: FARM_HIGHLIGHT_OPTIONS.livestockFarmOther.map((name, i) => ({ label: name, value: String(i) })), onChange: (v: string) => setLivestockFarmOtherHighlightIdx(Number(v)) },
      ];
      case "livestockSlaughter": return [
        { label: `透明度 ${livestockSlaughterOpacity.toFixed(2)}`, value: livestockSlaughterOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockSlaughterOpacity },
        { label: `大小 ${livestockSlaughterScale.toFixed(2)}`, value: livestockSlaughterScale, min: 0.3, max: 3, step: 0.1, onChange: setLivestockSlaughterScale },
      ];
      case "livestockFeed": return [
        { label: `透明度 ${livestockFeedOpacity.toFixed(2)}`, value: livestockFeedOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockFeedOpacity },
        { label: `大小 ${livestockFeedScale.toFixed(2)}`, value: livestockFeedScale, min: 0.3, max: 3, step: 0.1, onChange: setLivestockFeedScale },
      ];
      case "livestockMarket": return [
        { label: `透明度 ${livestockMarketOpacity.toFixed(2)}`, value: livestockMarketOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLivestockMarketOpacity },
        { label: `大小 ${livestockMarketScale.toFixed(2)}`, value: livestockMarketScale, min: 0.3, max: 3, step: 0.1, onChange: setLivestockMarketScale },
      ];
      // 🏟️ 運動場館 Sports（5 sublayer，opacity + scale；大小另由 area_sqm log 內插驅動）
      case "sportsSchool": return [
        { label: `透明度 ${sportsSchoolOpacity.toFixed(2)}`, value: sportsSchoolOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSportsSchoolOpacity },
        { label: `大小 ${sportsSchoolScale.toFixed(2)}`, value: sportsSchoolScale, min: 0.3, max: 3, step: 0.1, onChange: setSportsSchoolScale },
      ];
      case "sportsPublicOther": return [
        { label: `透明度 ${sportsPublicOtherOpacity.toFixed(2)}`, value: sportsPublicOtherOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSportsPublicOtherOpacity },
        { label: `大小 ${sportsPublicOtherScale.toFixed(2)}`, value: sportsPublicOtherScale, min: 0.3, max: 3, step: 0.1, onChange: setSportsPublicOtherScale },
      ];
      case "sportsPrivate": return [
        { label: `透明度 ${sportsPrivateOpacity.toFixed(2)}`, value: sportsPrivateOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSportsPrivateOpacity },
        { label: `大小 ${sportsPrivateScale.toFixed(2)}`, value: sportsPrivateScale, min: 0.3, max: 3, step: 0.1, onChange: setSportsPrivateScale },
      ];
      case "sportsPark": return [
        { label: `透明度 ${sportsParkOpacity.toFixed(2)}`, value: sportsParkOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSportsParkOpacity },
        { label: `大小 ${sportsParkScale.toFixed(2)}`, value: sportsParkScale, min: 0.3, max: 3, step: 0.1, onChange: setSportsParkScale },
      ];
      case "sportsCenter": return [
        { label: `透明度 ${sportsCenterOpacity.toFixed(2)}`, value: sportsCenterOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSportsCenterOpacity },
        { label: `大小 ${sportsCenterScale.toFixed(2)}`, value: sportsCenterScale, min: 0.3, max: 3, step: 0.1, onChange: setSportsCenterScale },
      ];
      case "farmRoads": return [
        { label: `寬度 ${farmRoadsWidth.toFixed(1)}`, value: farmRoadsWidth, min: 0.3, max: 3, step: 0.1, onChange: setFarmRoadsWidth },
        { label: `透明度 ${farmRoadsOpacity.toFixed(2)}`, value: farmRoadsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFarmRoadsOpacity },
      ];
      case "ecoNetworkZones": return [
        { label: `透明度 ${ecoNetworkZonesOpacity.toFixed(2)}`, value: ecoNetworkZonesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEcoNetworkZonesOpacity },
      ];
      case "wfIncinerator":
      case "wfLandfill":
      case "wfLandfillCoastal":
      case "wfTransfer":
      case "wfMedical":
      case "wfMonitoring":
      case "wfRecycling":
      case "wfScrapYard":
      case "wfOther":
      case "wdClothes":
      case "wdMixed":
      case "wdRecyclingContainer":
      case "wdBattery": {
        const k = layer as WasteSubKey;
        const p = wasteSubParams[k];
        const base: ParamControl[] = [
          { label: `大小 ${p.size.toFixed(2)}`, value: p.size, min: 0.3, max: 3, step: 0.05,
            onChange: (v: number) => setWasteSubParam(k, "size", v) },
          { label: `透明度 ${p.opacity.toFixed(2)}`, value: p.opacity, min: 0.1, max: 1, step: 0.05,
            onChange: (v: number) => setWasteSubParam(k, "opacity", v) },
          { label: `Z 軸 ${p.altitude.toFixed(0)}m`, value: p.altitude, min: 0, max: 500, step: 10,
            onChange: (v: number) => setWasteSubParam(k, "altitude", v) },
        ];
        // 焚化爐專屬：底圈大小（拉遠也可見的地面標示）
        if (k === "wfIncinerator") {
          const ringSize = p.ringSize ?? 1.0;
          base.push({
            label: `底圈 ${ringSize.toFixed(2)}`, value: ringSize, min: 0, max: 4, step: 0.1,
            onChange: (v: number) => setWasteSubParam(k, "ringSize" as keyof WasteSubParams, v),
          });
        }
        return base;
      }
      // ── FORESTRY ─────────────────────────────────────────
      case "forestCompartments": return [
        { label: `透明度 ${forestCompartmentsOpacity.toFixed(2)}`, value: forestCompartmentsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestCompartmentsOpacity },
        { label: `邊框寬 ${forestCompartmentsOutlineWidth.toFixed(1)}`, value: forestCompartmentsOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestCompartmentsOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestCompartmentsShowOutline, onChange: setForestCompartmentsShowOutline },
      ];
      case "forestReserve": return [
        { label: `透明度 ${forestReserveOpacity.toFixed(2)}`, value: forestReserveOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestReserveOpacity },
        { label: `邊框寬 ${forestReserveOutlineWidth.toFixed(1)}`, value: forestReserveOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestReserveOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestReserveShowOutline, onChange: setForestReserveShowOutline },
      ];
      case "forestRecreation": return [
        { label: `透明度 ${forestRecreationOpacity.toFixed(2)}`, value: forestRecreationOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestRecreationOpacity },
        { label: `邊框寬 ${forestRecreationOutlineWidth.toFixed(1)}`, value: forestRecreationOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestRecreationOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestRecreationShowOutline, onChange: setForestRecreationShowOutline },
      ];
      case "forestTreatmentWorks": return [
        { label: `透明度 ${forestTreatmentWorksOpacity.toFixed(2)}`, value: forestTreatmentWorksOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestTreatmentWorksOpacity },
        { label: `邊框寬 ${forestTreatmentWorksOutlineWidth.toFixed(1)}`, value: forestTreatmentWorksOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestTreatmentWorksOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestTreatmentWorksShowOutline, onChange: setForestTreatmentWorksShowOutline },
      ];
      case "forestFlatParks": return [
        { label: `透明度 ${forestFlatParksOpacity.toFixed(2)}`, value: forestFlatParksOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestFlatParksOpacity },
        { label: `邊框寬 ${forestFlatParksOutlineWidth.toFixed(1)}`, value: forestFlatParksOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestFlatParksOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestFlatParksShowOutline, onChange: setForestFlatParksShowOutline },
      ];
      case "forestDamLakes": return [
        { label: `透明度 ${forestDamLakesOpacity.toFixed(2)}`, value: forestDamLakesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestDamLakesOpacity },
        { label: `邊框寬 ${forestDamLakesOutlineWidth.toFixed(1)}`, value: forestDamLakesOutlineWidth, min: 0, max: 3, step: 0.1, onChange: setForestDamLakesOutlineWidth },
        { type: "toggle" as const, label: "邊框 Outline", value: forestDamLakesShowOutline, onChange: setForestDamLakesShowOutline },
      ];
      case "forestRoads": return [
        { label: `寬度 ${forestRoadsWidth.toFixed(1)}`, value: forestRoadsWidth, min: 0.3, max: 4, step: 0.1, onChange: setForestRoadsWidth },
        { label: `透明度 ${forestRoadsOpacity.toFixed(2)}`, value: forestRoadsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestRoadsOpacity },
      ];
      case "forestAlishanRail": return [
        { label: `寬度 ${forestAlishanRailWidth.toFixed(1)}`, value: forestAlishanRailWidth, min: 0.5, max: 5, step: 0.1, onChange: setForestAlishanRailWidth },
        { label: `透明度 ${forestAlishanRailOpacity.toFixed(2)}`, value: forestAlishanRailOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestAlishanRailOpacity },
      ];
      case "hikingTrails": return [
        { label: `寬度 ${hikingTrailsWidth.toFixed(1)}`, value: hikingTrailsWidth, min: 0.3, max: 4, step: 0.1, onChange: setHikingTrailsWidth },
        { label: `透明度 ${hikingTrailsOpacity.toFixed(2)}`, value: hikingTrailsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setHikingTrailsOpacity },
      ];
      case "canopyHeight": return [
        { label: `透明度 ${canopyHeightOpacity.toFixed(2)}`, value: canopyHeightOpacity, min: 0.3, max: 1, step: 0.05, onChange: setCanopyHeightOpacity },
      ];
      case "canopyGiants": return [
        { label: `透明度 ${canopyGiantsOpacity.toFixed(2)}`, value: canopyGiantsOpacity, min: 0.3, max: 1, step: 0.05, onChange: setCanopyGiantsOpacity },
      ];
      // ── ENERGY MVP ──
      case "powerPlants": return [
        { label: `大小 ${powerPlantsScale.toFixed(1)}`, value: powerPlantsScale, min: 0.3, max: 3, step: 0.1, onChange: setPowerPlantsScale },
        { label: `透明度 ${powerPlantsOpacity.toFixed(2)}`, value: powerPlantsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerPlantsOpacity },
      ];
      case "powerPlantGlow": return [
        { label: `透明度 ${powerPlantGlowOpacity.toFixed(2)}`, value: powerPlantGlowOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerPlantGlowOpacity },
        { label: `大小 ${powerPlantGlowSize.toFixed(2)}×`, value: powerPlantGlowSize, min: 0.2, max: 3, step: 0.05, onChange: setPowerPlantGlowSize },
      ];
      case "substationEhvGlow": return [
        { label: `透明度 ${substationEhvGlowOpacity.toFixed(2)}`, value: substationEhvGlowOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSubstationEhvGlowOpacity },
        { label: `大小 ${substationEhvGlowSize.toFixed(2)}×`, value: substationEhvGlowSize, min: 0.2, max: 3, step: 0.05, onChange: setSubstationEhvGlowSize },
      ];
      case "powerLinesGlow": return [
        { label: `透明度 ${powerLinesGlowOpacity.toFixed(2)}`, value: powerLinesGlowOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerLinesGlowOpacity },
        { label: `寬度 ${powerLinesGlowWidth.toFixed(1)}×`, value: powerLinesGlowWidth, min: 0.5, max: 5, step: 0.1, onChange: setPowerLinesGlowWidth },
      ];
      case "aviationRestrictedGlow": return [
        { label: `透明度 ${aviationRestrictedGlowOpacity.toFixed(2)}`, value: aviationRestrictedGlowOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAviationRestrictedGlowOpacity },
      ];
      // ── Phase 8 SSOT 6-layer ──
      case "facPrimary": return [
        { label: `總大小 ${facPrimaryScale.toFixed(1)}`, value: facPrimaryScale, min: 0.3, max: 3, step: 0.1, onChange: setFacPrimaryScale },
        { label: `大廠（即時）${facPrimaryRtScale.toFixed(2)}`, value: facPrimaryRtScale, min: 0.2, max: 3, step: 0.05, onChange: setFacPrimaryRtScale },
        { label: `其他廠 ${facPrimaryNoRtScale.toFixed(2)}`, value: facPrimaryNoRtScale, min: 0.1, max: 2, step: 0.05, onChange: setFacPrimaryNoRtScale },
        { label: `透明度 ${facPrimaryOpacity.toFixed(2)}`, value: facPrimaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacPrimaryOpacity },
      ];
      case "facOffshore": return [
        { label: `透明度 ${facOffshoreOpacity.toFixed(2)}`, value: facOffshoreOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacOffshoreOpacity },
      ];
      case "facPlanned": return [
        { label: `大小 ${facPlannedScale.toFixed(1)}`, value: facPlannedScale, min: 0.3, max: 3, step: 0.1, onChange: setFacPlannedScale },
        { label: `透明度 ${facPlannedOpacity.toFixed(2)}`, value: facPlannedOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacPlannedOpacity },
      ];
      case "facHistorical": return [
        { label: `大小 ${facHistoricalScale.toFixed(1)}`, value: facHistoricalScale, min: 0.3, max: 3, step: 0.1, onChange: setFacHistoricalScale },
        { label: `透明度 ${facHistoricalOpacity.toFixed(2)}`, value: facHistoricalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacHistoricalOpacity },
      ];
      case "facSecondary": return [
        { label: `大小 ${facSecondaryScale.toFixed(1)}`, value: facSecondaryScale, min: 0.3, max: 3, step: 0.1, onChange: setFacSecondaryScale },
        { label: `透明度 ${facSecondaryOpacity.toFixed(2)}`, value: facSecondaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacSecondaryOpacity },
      ];
      case "facOsmSupplement": return [
        { label: `大小 ${facOsmSupplementScale.toFixed(1)}`, value: facOsmSupplementScale, min: 0.3, max: 3, step: 0.1, onChange: setFacOsmSupplementScale },
        { label: `透明度 ${facOsmSupplementOpacity.toFixed(2)}`, value: facOsmSupplementOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacOsmSupplementOpacity },
      ];
      // ── 化石燃料 14 layer（Phase B） ──
      case "gasStationCpc": return [
        { label: `大小 ${gasStationCpcScale.toFixed(1)}`, value: gasStationCpcScale, min: 0.3, max: 3, step: 0.1, onChange: setGasStationCpcScale },
        { label: `透明度 ${gasStationCpcOpacity.toFixed(2)}`, value: gasStationCpcOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasStationCpcOpacity },
      ];
      case "gasStationFpcc": return [
        { label: `大小 ${gasStationFpccScale.toFixed(1)}`, value: gasStationFpccScale, min: 0.3, max: 3, step: 0.1, onChange: setGasStationFpccScale },
        { label: `透明度 ${gasStationFpccOpacity.toFixed(2)}`, value: gasStationFpccOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasStationFpccOpacity },
      ];
      case "gasStationTaisugar": return [
        { label: `大小 ${gasStationTaisugarScale.toFixed(1)}`, value: gasStationTaisugarScale, min: 0.3, max: 3, step: 0.1, onChange: setGasStationTaisugarScale },
        { label: `透明度 ${gasStationTaisugarOpacity.toFixed(2)}`, value: gasStationTaisugarOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasStationTaisugarOpacity },
      ];
      case "gasStationOther": return [
        { label: `大小 ${gasStationOtherScale.toFixed(1)}`, value: gasStationOtherScale, min: 0.3, max: 3, step: 0.1, onChange: setGasStationOtherScale },
        { label: `透明度 ${gasStationOtherOpacity.toFixed(2)}`, value: gasStationOtherOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasStationOtherOpacity },
      ];
      case "gasStationCanonical": return [
        { label: `大小 ${gasStationCanonicalScale.toFixed(1)}`, value: gasStationCanonicalScale, min: 0.3, max: 3, step: 0.1, onChange: setGasStationCanonicalScale },
        { label: `透明度 ${gasStationCanonicalOpacity.toFixed(2)}`, value: gasStationCanonicalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasStationCanonicalOpacity },
      ];
      case "lpgSubpackaging": return [
        { label: `大小 ${lpgSubpackagingScale.toFixed(1)}`, value: lpgSubpackagingScale, min: 0.3, max: 3, step: 0.1, onChange: setLpgSubpackagingScale },
        { label: `透明度 ${lpgSubpackagingOpacity.toFixed(2)}`, value: lpgSubpackagingOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLpgSubpackagingOpacity },
      ];
      case "lpgRetailers": return [
        { label: `大小 ${lpgRetailersScale.toFixed(1)}`, value: lpgRetailersScale, min: 0.3, max: 3, step: 0.1, onChange: setLpgRetailersScale },
        { label: `透明度 ${lpgRetailersOpacity.toFixed(2)}`, value: lpgRetailersOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLpgRetailersOpacity },
      ];
      case "lngTerminal": return [
        { label: `大小 ${lngTerminalScale.toFixed(1)}`, value: lngTerminalScale, min: 0.5, max: 4, step: 0.1, onChange: setLngTerminalScale },
        { label: `透明度 ${lngTerminalOpacity.toFixed(2)}`, value: lngTerminalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLngTerminalOpacity },
      ];
      case "pipelineGas": return [
        { label: `寬度 ${pipelineGasWidth.toFixed(1)}`, value: pipelineGasWidth, min: 0.5, max: 5, step: 0.1, onChange: setPipelineGasWidth },
        { label: `透明度 ${pipelineGasOpacity.toFixed(2)}`, value: pipelineGasOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPipelineGasOpacity },
      ];
      case "pipelineOilGas": return [
        { label: `寬度 ${pipelineOilGasWidth.toFixed(1)}`, value: pipelineOilGasWidth, min: 0.5, max: 5, step: 0.1, onChange: setPipelineOilGasWidth },
        { label: `透明度 ${pipelineOilGasOpacity.toFixed(2)}`, value: pipelineOilGasOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPipelineOilGasOpacity },
      ];
      case "industrialRefinery": return [
        { label: `透明度 ${industrialRefineryOpacity.toFixed(2)}`, value: industrialRefineryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIndustrialRefineryOpacity },
        { type: "toggle" as const, label: "顯示外框線", value: industrialRefineryOutline, onChange: setIndustrialRefineryOutline },
      ];
      case "industrialStorageTank": return [
        { label: `透明度 ${industrialStorageTankOpacity.toFixed(2)}`, value: industrialStorageTankOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIndustrialStorageTankOpacity },
        { type: "toggle" as const, label: "顯示外框線", value: industrialStorageTankOutline, onChange: setIndustrialStorageTankOutline },
      ];
      case "industrialPowerPlant": return [
        { label: `透明度 ${industrialPowerPlantOpacity.toFixed(2)}`, value: industrialPowerPlantOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIndustrialPowerPlantOpacity },
        { type: "toggle" as const, label: "顯示外框線", value: industrialPowerPlantOutline, onChange: setIndustrialPowerPlantOutline },
      ];
      case "coalTerminal": return [
        { label: `大小 ${coalTerminalScale.toFixed(1)}`, value: coalTerminalScale, min: 0.5, max: 4, step: 0.1, onChange: setCoalTerminalScale },
        { label: `透明度 ${coalTerminalOpacity.toFixed(2)}`, value: coalTerminalOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCoalTerminalOpacity },
      ];
      // ── 雲林 POC 覆蓋分析 ──
      case "gasCoverageAll": return [
        { label: `透明度 ${gasCoverageAllOpacity.toFixed(2)}`, value: gasCoverageAllOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasCoverageAllOpacity },
        { label: `線寬 ${gasCoverageAllLineWidth.toFixed(2)}`, value: gasCoverageAllLineWidth, min: 0.1, max: 2, step: 0.1, onChange: setGasCoverageAllLineWidth },
      ];
      case "gasCoverageCpc": return [
        { label: `透明度 ${gasCoverageCpcOpacity.toFixed(2)}`, value: gasCoverageCpcOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasCoverageCpcOpacity },
        { label: `線寬 ${gasCoverageCpcLineWidth.toFixed(2)}`, value: gasCoverageCpcLineWidth, min: 0.1, max: 2, step: 0.1, onChange: setGasCoverageCpcLineWidth },
      ];
      case "gasCoverageFpcc": return [
        { label: `透明度 ${gasCoverageFpccOpacity.toFixed(2)}`, value: gasCoverageFpccOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasCoverageFpccOpacity },
        { label: `線寬 ${gasCoverageFpccLineWidth.toFixed(2)}`, value: gasCoverageFpccLineWidth, min: 0.1, max: 2, step: 0.1, onChange: setGasCoverageFpccLineWidth },
      ];
      case "gasCoverageTaisugar": return [
        { label: `透明度 ${gasCoverageTaisugarOpacity.toFixed(2)}`, value: gasCoverageTaisugarOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGasCoverageTaisugarOpacity },
        { label: `線寬 ${gasCoverageTaisugarLineWidth.toFixed(2)}`, value: gasCoverageTaisugarLineWidth, min: 0.1, max: 2, step: 0.1, onChange: setGasCoverageTaisugarLineWidth },
      ];
      case "evIsland": return [
        { label: `透明度 ${evIslandOpacity.toFixed(2)}`, value: evIslandOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEvIslandOpacity },
        { label: `線寬 ${evIslandLineWidth.toFixed(2)}`, value: evIslandLineWidth, min: 0.1, max: 2, step: 0.1, onChange: setEvIslandLineWidth },
      ];
      case "powerGenerationUnit": return [
        { label: `柱高 ${powerGenerationHeight.toFixed(1)}`, value: powerGenerationHeight, min: 0.3, max: 3, step: 0.1, onChange: setPowerGenerationHeight },
        { label: `透明度 ${powerGenerationOpacity.toFixed(2)}`, value: powerGenerationOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerGenerationOpacity },
      ];
      case "osmSubstationsEhv": return [
        { label: `大小 ${osmSubstationsEhvSize.toFixed(2)}`, value: osmSubstationsEhvSize, min: 0.2, max: 3, step: 0.05, onChange: setOsmSubstationsEhvSize },
        { label: `透明度 ${osmSubstationsEhvOpacity.toFixed(2)}`, value: osmSubstationsEhvOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmSubstationsEhvOpacity },
      ];
      case "osmSubstations": return [
        { label: `大小 ${osmSubstationsSize.toFixed(2)}`, value: osmSubstationsSize, min: 0.1, max: 3, step: 0.05, onChange: setOsmSubstationsSize },
        { label: `透明度 ${osmSubstationsOpacity.toFixed(2)}`, value: osmSubstationsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmSubstationsOpacity },
      ];
      case "osmPowerLines": return [
        { label: `寬度 ${osmPowerLinesWidth.toFixed(1)}`, value: osmPowerLinesWidth, min: 0.3, max: 3, step: 0.1, onChange: setOsmPowerLinesWidth },
        { label: `透明度 ${osmPowerLinesOpacity.toFixed(2)}`, value: osmPowerLinesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmPowerLinesOpacity },
      ];
      case "osmPowerTowers": return [
        { label: `大小 ${osmPowerTowersSize.toFixed(1)}`, value: osmPowerTowersSize, min: 0.3, max: 3, step: 0.1, onChange: setOsmPowerTowersSize },
        { label: `透明度 ${osmPowerTowersOpacity.toFixed(2)}`, value: osmPowerTowersOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmPowerTowersOpacity },
      ];
      case "aviationControl": return [
        { label: `透明度 ${aviationControlOpacity.toFixed(2)}`, value: aviationControlOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAviationControlOpacity },
      ];
      case "aviationRestricted": return [
        { label: `透明度 ${aviationRestrictedOpacity.toFixed(2)}`, value: aviationRestrictedOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAviationRestrictedOpacity },
      ];
      case "droneNoFlyZone": return [
        { label: `透明度 ${droneNfzOpacity.toFixed(2)}`, value: droneNfzOpacity, min: 0.05, max: 1, step: 0.05, onChange: setDroneNfzOpacity },
      ];
      case "droneRestrictedZone": return [
        { label: `透明度 ${droneRestrictedOpacity.toFixed(2)}`, value: droneRestrictedOpacity, min: 0.05, max: 1, step: 0.05, onChange: setDroneRestrictedOpacity },
      ];
      case "powerPoles": return [
        { label: `全台顯示 ${powerPolesZ5Reveal === 0 ? "關" : powerPolesZ5Reveal.toFixed(2)}`, value: powerPolesZ5Reveal, min: 0, max: 1, step: 0.1, onChange: setPowerPolesZ5Reveal },
        { label: `熱區 ${powerPolesHeat === 0 ? "關" : powerPolesHeat.toFixed(2)}`, value: powerPolesHeat, min: 0, max: 1, step: 0.05, onChange: setPowerPolesHeat },
        { label: `大小 ${powerPolesSize.toFixed(1)}`, value: powerPolesSize, min: 0.3, max: 3, step: 0.1, onChange: setPowerPolesSize },
        { label: `透明度 ${powerPolesOpacity.toFixed(2)}`, value: powerPolesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerPolesOpacity },
      ];
      case "osmWindTurbines": return [
        { label: `大小 ${osmWindTurbinesSize.toFixed(1)}`, value: osmWindTurbinesSize, min: 0.3, max: 3, step: 0.1, onChange: setOsmWindTurbinesSize },
        { label: `透明度 ${osmWindTurbinesOpacity.toFixed(2)}`, value: osmWindTurbinesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmWindTurbinesOpacity },
      ];
      case "osmSolarFarms": return [
        { label: `大小 ${osmSolarFarmsSize.toFixed(1)}`, value: osmSolarFarmsSize, min: 0.3, max: 3, step: 0.1, onChange: setOsmSolarFarmsSize },
        { label: `透明度 ${osmSolarFarmsOpacity.toFixed(2)}`, value: osmSolarFarmsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmSolarFarmsOpacity },
      ];
      case "osmPowerPlantsStatic": return [
        { label: `大小 ${osmPowerPlantsStaticSize.toFixed(1)}`, value: osmPowerPlantsStaticSize, min: 0.3, max: 3, step: 0.1, onChange: setOsmPowerPlantsStaticSize },
        { label: `透明度 ${osmPowerPlantsStaticOpacity.toFixed(2)}`, value: osmPowerPlantsStaticOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmPowerPlantsStaticOpacity },
      ];
      case "offshoreWindZones": return [
        { label: `透明度 ${offshoreWindZonesOpacity.toFixed(2)}`, value: offshoreWindZonesOpacity, min: 0.05, max: 1, step: 0.05, onChange: setOffshoreWindZonesOpacity },
      ];
      case "islandPowerGrid": return [
        { label: `大小 ${islandPowerGridSize.toFixed(1)}`, value: islandPowerGridSize, min: 0.3, max: 3, step: 0.1, onChange: setIslandPowerGridSize },
        { label: `透明度 ${islandPowerGridOpacity.toFixed(2)}`, value: islandPowerGridOpacity, min: 0.1, max: 1, step: 0.05, onChange: setIslandPowerGridOpacity },
      ];
      case "fossilFuelInfra": return [
        { label: `大小 ${fossilFuelInfraSize.toFixed(1)}`, value: fossilFuelInfraSize, min: 0.3, max: 3, step: 0.1, onChange: setFossilFuelInfraSize },
        { label: `透明度 ${fossilFuelInfraOpacity.toFixed(2)}`, value: fossilFuelInfraOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFossilFuelInfraOpacity },
      ];
      case "geothermalWells": return [
        { label: `大小 ${geothermalWellsSize.toFixed(1)}`, value: geothermalWellsSize, min: 0.3, max: 3, step: 0.1, onChange: setGeothermalWellsSize },
        { label: `透明度 ${geothermalWellsOpacity.toFixed(2)}`, value: geothermalWellsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setGeothermalWellsOpacity },
      ];
      case "renewablePermitsTaipei": return [
        { label: `大小 ${renewablePermitsTaipeiSize.toFixed(1)}`, value: renewablePermitsTaipeiSize, min: 0.3, max: 3, step: 0.1, onChange: setRenewablePermitsTaipeiSize },
        { label: `透明度 ${renewablePermitsTaipeiOpacity.toFixed(2)}`, value: renewablePermitsTaipeiOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRenewablePermitsTaipeiOpacity },
      ];
      case "evChargingStations": return [
        { label: `透明度 ${evChargingOpacity.toFixed(2)}`, value: evChargingOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEvChargingOpacity },
      ];
      // ── HAZARD ──
      case "lightning": return [
        { label: `保留 ${lightningMinutes} min`, value: lightningMinutes, min: 5, max: 360, step: 5, onChange: setLightningMinutes },
        { label: `透明度 ${lightningOpacity.toFixed(2)}`, value: lightningOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLightningOpacity },
      ];
      case "nuclearRadiation": return [
        { label: `大小 ${nuclearScale.toFixed(1)}`, value: nuclearScale, min: 0.3, max: 3, step: 0.1, onChange: setNuclearScale },
        { label: `透明度 ${nuclearOpacity.toFixed(2)}`, value: nuclearOpacity, min: 0.1, max: 1, step: 0.05, onChange: setNuclearOpacity },
      ];
      case "forestTrailSigns": return [
        { label: `透明度 ${forestTrailSignsOpacity.toFixed(2)}`, value: forestTrailSignsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestTrailSignsOpacity },
        { label: `大小 ${forestTrailSignsScale.toFixed(2)}`, value: forestTrailSignsScale, min: 0.3, max: 3, step: 0.1, onChange: setForestTrailSignsScale },
      ];
      case "forestSignalPoints": return [
        { label: `透明度 ${forestSignalPointsOpacity.toFixed(2)}`, value: forestSignalPointsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestSignalPointsOpacity },
        { label: `大小 ${forestSignalPointsScale.toFixed(2)}`, value: forestSignalPointsScale, min: 0.3, max: 3, step: 0.1, onChange: setForestSignalPointsScale },
      ];
      case "forestEducationCenters": return [
        { label: `透明度 ${forestEducationCentersOpacity.toFixed(2)}`, value: forestEducationCentersOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestEducationCentersOpacity },
        { label: `大小 ${forestEducationCentersScale.toFixed(2)}`, value: forestEducationCentersScale, min: 0.3, max: 3, step: 0.1, onChange: setForestEducationCentersScale },
      ];
      case "forestWildlife": return [
        { label: `透明度 ${forestWildlifeOpacity.toFixed(2)}`, value: forestWildlifeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setForestWildlifeOpacity },
        { label: `大小 ${forestWildlifeScale.toFixed(2)}`, value: forestWildlifeScale, min: 0.3, max: 3, step: 0.1, onChange: setForestWildlifeScale },
      ];
      // ── Base map（6 layer：3 boundary + 2 contour + 1 road）──
      case "countyBoundary": return [
        { label: `寬度 ${countyBoundaryWidth.toFixed(1)}`, value: countyBoundaryWidth, min: 0.3, max: 4, step: 0.1, onChange: setCountyBoundaryWidth },
        { label: `透明度 ${countyBoundaryOpacity.toFixed(2)}`, value: countyBoundaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCountyBoundaryOpacity },
      ];
      case "townshipBoundary": return [
        { label: `寬度 ${townshipBoundaryWidth.toFixed(1)}`, value: townshipBoundaryWidth, min: 0.3, max: 4, step: 0.1, onChange: setTownshipBoundaryWidth },
        { label: `透明度 ${townshipBoundaryOpacity.toFixed(2)}`, value: townshipBoundaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTownshipBoundaryOpacity },
      ];
      case "villageBoundary": return [
        { label: `寬度 ${villageBoundaryWidth.toFixed(1)}`, value: villageBoundaryWidth, min: 0.3, max: 4, step: 0.1, onChange: setVillageBoundaryWidth },
        { label: `透明度 ${villageBoundaryOpacity.toFixed(2)}`, value: villageBoundaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setVillageBoundaryOpacity },
      ];
      case "contour25k": return [
        { label: `寬度 ${contour25kWidth.toFixed(1)}`, value: contour25kWidth, min: 0.3, max: 3, step: 0.1, onChange: setContour25kWidth },
        { label: `透明度 ${contour25kOpacity.toFixed(2)}`, value: contour25kOpacity, min: 0.1, max: 1, step: 0.05, onChange: setContour25kOpacity },
      ];
      case "contourDtm20": return [
        { label: `寬度 ${contourDtm20Width.toFixed(1)}`, value: contourDtm20Width, min: 0.3, max: 3, step: 0.1, onChange: setContourDtm20Width },
        { label: `透明度 ${contourDtm20Opacity.toFixed(2)}`, value: contourDtm20Opacity, min: 0.1, max: 1, step: 0.05, onChange: setContourDtm20Opacity },
      ];
      case "osmRoadDrive": return [
        { label: `全台顯示 ${osmRoadDriveZ5Reveal === 0 ? "關" : osmRoadDriveZ5Reveal.toFixed(2)}`, value: osmRoadDriveZ5Reveal, min: 0, max: 1, step: 0.1, onChange: setOsmRoadDriveZ5Reveal },
        { label: `寬度 ${osmRoadDriveWidth.toFixed(1)}`, value: osmRoadDriveWidth, min: 0.3, max: 4, step: 0.1, onChange: setOsmRoadDriveWidth },
        { label: `透明度 ${osmRoadDriveOpacity.toFixed(2)}`, value: osmRoadDriveOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmRoadDriveOpacity },
      ];
      case "osmExpressway": return [
        { label: `寬度 ${osmExpresswayWidth.toFixed(1)}`, value: osmExpresswayWidth, min: 0.5, max: 5, step: 0.1, onChange: setOsmExpresswayWidth },
        { label: `透明度 ${osmExpresswayOpacity.toFixed(2)}`, value: osmExpresswayOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmExpresswayOpacity },
      ];
      case "hillshade": return [
        { label: `透明度 ${hillshadeOpacity.toFixed(2)}`, value: hillshadeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setHillshadeOpacity },
      ];
      case "slopeVector": return [
        { label: `透明度 ${slopeVectorOpacity.toFixed(2)}`, value: slopeVectorOpacity, min: 0.3, max: 1, step: 0.05, onChange: setSlopeVectorOpacity },
      ];
      case "aspectVector": return [
        { label: `透明度 ${aspectVectorOpacity.toFixed(2)}`, value: aspectVectorOpacity, min: 0.3, max: 1, step: 0.05, onChange: setAspectVectorOpacity },
      ];
      // ── 房地產（6 layer 共用透明度）──
      case "realEstateRentalGrid":
      case "realEstateRentalPoint":
      case "realEstateSaleGrid":
      case "realEstateSalePoint":
      case "realEstatePresaleGrid":
      case "realEstatePresalePoint": return [
        { label: `透明度 ${realEstateOpacity.toFixed(2)}`, value: realEstateOpacity, min: 0.1, max: 1, step: 0.05, onChange: setRealEstateOpacity },
        { type: "toggle" as const, label: "排除雙北重繪", value: realEstateExcludeTaipei, onChange: setRealEstateExcludeTaipei },
      ];
      // ── 警政司法民防 17 layer ──
      case "policeStation": return [
        { label: `大小 ${policeStationScale.toFixed(1)}`, value: policeStationScale, min: 0.3, max: 3, step: 0.1, onChange: setPoliceStationScale },
        { label: `透明度 ${policeStationOpacity.toFixed(2)}`, value: policeStationOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPoliceStationOpacity },
      ];
      case "womenChildWarning": return [
        { label: `大小 ${womenChildWarningScale.toFixed(1)}`, value: womenChildWarningScale, min: 0.3, max: 3, step: 0.1, onChange: setWomenChildWarningScale },
        { label: `透明度 ${womenChildWarningOpacity.toFixed(2)}`, value: womenChildWarningOpacity, min: 0.1, max: 1, step: 0.05, onChange: setWomenChildWarningOpacity },
      ];
      case "speedCamera": return [
        { label: `大小 ${speedCameraScale.toFixed(1)}`, value: speedCameraScale, min: 0.3, max: 3, step: 0.1, onChange: setSpeedCameraScale },
        { label: `透明度 ${speedCameraOpacity.toFixed(2)}`, value: speedCameraOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSpeedCameraOpacity },
      ];
      case "speedZoneSegment": return [
        { label: `線寬 ${speedZoneSegmentWidth.toFixed(1)}`, value: speedZoneSegmentWidth, min: 0.3, max: 5, step: 0.1, onChange: setSpeedZoneSegmentWidth },
        { label: `透明度 ${speedZoneSegmentOpacity.toFixed(2)}`, value: speedZoneSegmentOpacity, min: 0.1, max: 1, step: 0.05, onChange: setSpeedZoneSegmentOpacity },
      ];
      case "court": return [
        { label: `大小 ${courtScale.toFixed(1)}`, value: courtScale, min: 0.3, max: 3, step: 0.1, onChange: setCourtScale },
        { label: `透明度 ${courtOpacity.toFixed(2)}`, value: courtOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCourtOpacity },
      ];
      case "prosecutorsOffice": return [
        { label: `大小 ${prosecutorsOfficeScale.toFixed(1)}`, value: prosecutorsOfficeScale, min: 0.3, max: 3, step: 0.1, onChange: setProsecutorsOfficeScale },
        { label: `透明度 ${prosecutorsOfficeOpacity.toFixed(2)}`, value: prosecutorsOfficeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setProsecutorsOfficeOpacity },
      ];
      case "correctionalFacility": return [
        { label: `大小 ${correctionalFacilityScale.toFixed(1)}`, value: correctionalFacilityScale, min: 0.3, max: 3, step: 0.1, onChange: setCorrectionalFacilityScale },
        { label: `透明度 ${correctionalFacilityOpacity.toFixed(2)}`, value: correctionalFacilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCorrectionalFacilityOpacity },
      ];
      case "courtJurisdiction": return [
        { label: `填色透明度 ${courtJurisdictionOpacity.toFixed(2)}`, value: courtJurisdictionOpacity, min: 0, max: 0.6, step: 0.02, onChange: setCourtJurisdictionOpacity },
      ];
      case "aquaculturePonds": return [
        { label: `填色透明度 ${aquaculturePondsOpacity.toFixed(2)}`, value: aquaculturePondsOpacity, min: 0, max: 0.85, step: 0.05, onChange: setAquaculturePondsOpacity },
      ];
      case "aquacultureZone": return [
        { label: `填色透明度 ${aquacultureZoneOpacity.toFixed(2)}`, value: aquacultureZoneOpacity, min: 0, max: 0.7, step: 0.05, onChange: setAquacultureZoneOpacity },
      ];
      case "aquacultureCageNet": return [
        { label: `填色透明度 ${aquacultureCageNetOpacity.toFixed(2)}`, value: aquacultureCageNetOpacity, min: 0, max: 0.7, step: 0.05, onChange: setAquacultureCageNetOpacity },
      ];
      case "aquacultureWaterSatellite": return [
        { type: "select" as const, label: "信心", value: aquacultureWaterSatelliteConfidence, options: [{ label: "全部", value: "all" }, { label: "含蓄水池", value: "reservoir" }, { label: "只確定", value: "certain" }], onChange: setAquacultureWaterSatelliteConfidence },
        { label: `填色透明度 ${aquacultureWaterSatelliteOpacity.toFixed(2)}`, value: aquacultureWaterSatelliteOpacity, min: 0, max: 0.85, step: 0.05, onChange: setAquacultureWaterSatelliteOpacity },
      ];
      case "aquacultureWaterSatelliteMoa": return [
        { label: `填色透明度 ${aquacultureWaterSatelliteMoaOpacity.toFixed(2)}`, value: aquacultureWaterSatelliteMoaOpacity, min: 0, max: 0.85, step: 0.05, onChange: setAquacultureWaterSatelliteMoaOpacity },
        { type: "toggle" as const, label: "確認 Confirmed", value: aquacultureWaterSatelliteMoaShowConfirmed, onChange: setAquacultureWaterSatelliteMoaShowConfirmed },
        { type: "toggle" as const, label: "漁電共生 Solar", value: aquacultureWaterSatelliteMoaShowSolar, onChange: setAquacultureWaterSatelliteMoaShowSolar },
        { type: "toggle" as const, label: "其他 Other", value: aquacultureWaterSatelliteMoaShowOther, onChange: setAquacultureWaterSatelliteMoaShowOther },
      ];
      case "aquacultureWaterUnion": return [
        { label: `填色透明度 ${aquacultureWaterUnionOpacity.toFixed(2)}`, value: aquacultureWaterUnionOpacity, min: 0, max: 0.85, step: 0.05, onChange: setAquacultureWaterUnionOpacity },
        { type: "toggle" as const, label: "兩版都有 Both", value: aquacultureWaterUnionShowBoth, onChange: setAquacultureWaterUnionShowBoth },
        { type: "toggle" as const, label: "只官方 MOA", value: aquacultureWaterUnionShowMoaOnly, onChange: setAquacultureWaterUnionShowMoaOnly },
        { type: "toggle" as const, label: "只舊版 OSM", value: aquacultureWaterUnionShowOsmOnly, onChange: setAquacultureWaterUnionShowOsmOnly },
      ];
      case "aquacultureIntegrated": return [
        { label: `填色透明度 ${aquacultureIntegratedOpacity.toFixed(2)}`, value: aquacultureIntegratedOpacity, min: 0, max: 0.85, step: 0.05, onChange: setAquacultureIntegratedOpacity },
      ];
      case "streetTreesTaipeiDiff": return [
        { type: "select" as const, label: "染色模式", value: streetTreesTaipeiDiffColorMode, options: [{ label: "依狀態", value: "status" }, { label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }], onChange: setStreetTreesTaipeiDiffColorMode },
        { type: "select" as const, label: "狀態", value: streetTreesTaipeiDiffStatus, options: [{ label: "全部", value: "all" }, { label: "只看消失", value: "disappeared" }, { label: "只看變動", value: "changed" }], onChange: setStreetTreesTaipeiDiffStatus },
        { label: `透明度 ${streetTreesTaipeiDiffOpacity.toFixed(2)}`, value: streetTreesTaipeiDiffOpacity, min: 0, max: 1, step: 0.05, onChange: setStreetTreesTaipeiDiffOpacity },
        { label: `點位大小 ${streetTreesTaipeiDiffRadius.toFixed(2)}`, value: streetTreesTaipeiDiffRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setStreetTreesTaipeiDiffRadius },
      ];
      case "protectedTreesNational": return [
        { type: "select" as const, label: "染色模式", value: protectedTreesNationalColorMode, options: [{ label: "依樹齡", value: "age" }, { label: "依城市", value: "city" }], onChange: setProtectedTreesNationalColorMode },
        { type: "select" as const, label: "城市", value: protectedTreesNationalCity, options: [{ label: "全部", value: "all" }, ...PROTECTED_TREE_CITIES.map((c) => ({ label: c.name, value: c.name }))], onChange: setProtectedTreesNationalCity },
        { label: `透明度 ${protectedTreesNationalOpacity.toFixed(2)}`, value: protectedTreesNationalOpacity, min: 0, max: 1, step: 0.05, onChange: setProtectedTreesNationalOpacity },
        { label: `點位大小 ${protectedTreesNationalRadius.toFixed(2)}`, value: protectedTreesNationalRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setProtectedTreesNationalRadius },
      ];
      case "riversideTreesTaipei": return [
        { type: "select" as const, label: "河濱公園", value: riversideTreesTaipeiPark, options: [{ label: "全部", value: "all" }, ...RIVERSIDE_PARKS.map((n) => ({ label: n, value: n }))], onChange: setRiversideTreesTaipeiPark },
        { label: `透明度 ${riversideTreesTaipeiOpacity.toFixed(2)}`, value: riversideTreesTaipeiOpacity, min: 0, max: 1, step: 0.05, onChange: setRiversideTreesTaipeiOpacity },
        { label: `點位大小 ${riversideTreesTaipeiRadius.toFixed(2)}`, value: riversideTreesTaipeiRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setRiversideTreesTaipeiRadius },
      ];
      case "parksTaipei": return [
        { type: "select" as const, label: "分類", value: parksTaipeiCategory, options: [{ label: "全部", value: "all" }, ...TAIPEI_PARK_CATEGORIES.map((c) => ({ label: c.name, value: c.name }))], onChange: setParksTaipeiCategory },
        { label: `透明度 ${parksTaipeiOpacity.toFixed(2)}`, value: parksTaipeiOpacity, min: 0, max: 1, step: 0.05, onChange: setParksTaipeiOpacity },
        { label: `點位大小 ${parksTaipeiRadius.toFixed(2)}`, value: parksTaipeiRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setParksTaipeiRadius },
      ];
      case "culturalFacilities": return [
        { type: "select" as const, label: "類型", value: culturalFacilitiesType, options: [{ label: "全部", value: "all" }, ...CULTURAL_FACILITY_TYPES.map((c) => ({ label: c.name, value: c.name }))], onChange: setCulturalFacilitiesType },
        { label: `透明度 ${culturalFacilitiesOpacity.toFixed(2)}`, value: culturalFacilitiesOpacity, min: 0, max: 1, step: 0.05, onChange: setCulturalFacilitiesOpacity },
        { label: `點位大小 ${culturalFacilitiesRadius.toFixed(2)}`, value: culturalFacilitiesRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setCulturalFacilitiesRadius },
      ];
      case "culturalMuseums": return [
        { type: "select" as const, label: "類型", value: culturalMuseumsType, options: [{ label: "全部", value: "all" }, ...CULTURAL_MUSEUM_TYPES.map((c) => ({ label: c.name, value: c.name }))], onChange: setCulturalMuseumsType },
        { label: `透明度 ${culturalMuseumsOpacity.toFixed(2)}`, value: culturalMuseumsOpacity, min: 0, max: 1, step: 0.05, onChange: setCulturalMuseumsOpacity },
        { label: `點位大小 ${culturalMuseumsRadius.toFixed(2)}`, value: culturalMuseumsRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setCulturalMuseumsRadius },
      ];
      case "artsEvents": return [
        { type: "select" as const, label: "狀態", value: artsEventsStatus, options: [{ label: "全部", value: "all" }, { label: "進行中", value: "ongoing" }, { label: "未開始", value: "upcoming" }], onChange: setArtsEventsStatus },
        { label: `透明度 ${artsEventsOpacity.toFixed(2)}`, value: artsEventsOpacity, min: 0, max: 1, step: 0.05, onChange: setArtsEventsOpacity },
        { label: `點位大小 ${artsEventsRadius.toFixed(2)}`, value: artsEventsRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setArtsEventsRadius },
      ];
      case "performingVenues": return [
        { label: `透明度 ${performingVenuesOpacity.toFixed(2)}`, value: performingVenuesOpacity, min: 0, max: 1, step: 0.05, onChange: setPerformingVenuesOpacity },
        { label: `點位大小 ${performingVenuesRadius.toFixed(2)}`, value: performingVenuesRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setPerformingVenuesRadius },
      ];
      // 🧳 觀光 Tourism 12 層
      case "tourAttractions": return [
        { type: "select" as const, label: "著色模式", value: tourAttractionsMode, options: [{ label: "分類", value: "category" }, { label: "熱度", value: "heat" }], onChange: setTourAttractionsMode },
        { label: `透明度 ${tourAttractionsOpacity.toFixed(2)}`, value: tourAttractionsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourAttractionsOpacity },
        { label: `大小 ${tourAttractionsScale.toFixed(1)}`, value: tourAttractionsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourAttractionsScale },
      ];
      case "tourHotSprings": return [
        { label: `透明度 ${tourHotSpringsOpacity.toFixed(2)}`, value: tourHotSpringsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourHotSpringsOpacity },
        { label: `大小 ${tourHotSpringsScale.toFixed(1)}`, value: tourHotSpringsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourHotSpringsScale },
      ];
      case "tourHotSpringZones": return [
        { label: `透明度 ${tourHotSpringZonesOpacity.toFixed(2)}`, value: tourHotSpringZonesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourHotSpringZonesOpacity },
      ];
      case "tourScenicAreas": return [
        { label: `透明度 ${tourScenicAreasOpacity.toFixed(2)}`, value: tourScenicAreasOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourScenicAreasOpacity },
      ];
      case "tourHeritage": return [
        { label: `透明度 ${tourHeritageOpacity.toFixed(2)}`, value: tourHeritageOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourHeritageOpacity },
        { label: `大小 ${tourHeritageScale.toFixed(1)}`, value: tourHeritageScale, min: 0.3, max: 3, step: 0.1, onChange: setTourHeritageScale },
      ];
      case "religionTemples": return [
        // 10 選項（全部 + 9 族）與 3 選項登記態；前者 > 3 自動走原生 select（四鐵則 #4）
        { type: "select" as const, label: "主祀", value: religionTemplesDeity, options: [{ label: "全部", value: "all" }, ...DEITY_FAMILIES.map((d) => ({ label: d.label, value: d.value }))], onChange: setReligionTemplesDeity },
        { type: "select" as const, label: "登記", value: religionTemplesRegistry, options: REGISTRY_MODES, onChange: setReligionTemplesRegistry },
        { label: `透明度 ${religionTemplesOpacity.toFixed(2)}`, value: religionTemplesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionTemplesOpacity },
        { label: `大小 ${religionTemplesScale.toFixed(1)}`, value: religionTemplesScale, min: 0.3, max: 3, step: 0.1, onChange: setReligionTemplesScale },
      ];
      case "religionChurches": return [
        { type: "select" as const, label: "登記", value: religionChurchesRegistry, options: REGISTRY_MODES, onChange: setReligionChurchesRegistry },
        { label: `透明度 ${religionChurchesOpacity.toFixed(2)}`, value: religionChurchesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionChurchesOpacity },
        { label: `大小 ${religionChurchesScale.toFixed(1)}`, value: religionChurchesScale, min: 0.3, max: 3, step: 0.1, onChange: setReligionChurchesScale },
      ];
      case "religionAncestralHalls": return [
        // ⚠️ 本層 false 是「文資祠堂」不是 OSM，故用 REGISTRY_MODES_ANCESTRAL 的標籤
        { type: "select" as const, label: "類型", value: religionAncestralHallsRegistry, options: REGISTRY_MODES_ANCESTRAL, onChange: setReligionAncestralHallsRegistry },
        { label: `透明度 ${religionAncestralHallsOpacity.toFixed(2)}`, value: religionAncestralHallsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionAncestralHallsOpacity },
        { label: `大小 ${religionAncestralHallsScale.toFixed(1)}`, value: religionAncestralHallsScale, min: 0.3, max: 3, step: 0.1, onChange: setReligionAncestralHallsScale },
      ];
      case "religionFoundations": return [
        { label: `透明度 ${religionFoundationsOpacity.toFixed(2)}`, value: religionFoundationsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionFoundationsOpacity },
        { label: `大小 ${religionFoundationsScale.toFixed(1)}`, value: religionFoundationsScale, min: 0.3, max: 3, step: 0.1, onChange: setReligionFoundationsScale },
      ];
      case "religionOtherWorship": return [
        { label: `透明度 ${religionOtherWorshipOpacity.toFixed(2)}`, value: religionOtherWorshipOpacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionOtherWorshipOpacity },
        { label: `大小 ${religionOtherWorshipScale.toFixed(1)}`, value: religionOtherWorshipScale, min: 0.3, max: 3, step: 0.1, onChange: setReligionOtherWorshipScale },
      ];
      case "religionTop100": return [
        { label: `透明度 ${religionTop100Opacity.toFixed(2)}`, value: religionTop100Opacity, min: 0.1, max: 1, step: 0.05, onChange: setReligionTop100Opacity },
        { label: `大小 ${religionTop100Scale.toFixed(1)}`, value: religionTop100Scale, min: 0.3, max: 3, step: 0.1, onChange: setReligionTop100Scale },
      ];
      case "tourEvents": return [
        { type: "select" as const, label: "狀態", value: tourEventsStatus, options: [{ label: "全部", value: "all" }, { label: "進行中", value: "ongoing" }, { label: "未開始", value: "upcoming" }], onChange: setTourEventsStatus },
        { label: `透明度 ${tourEventsOpacity.toFixed(2)}`, value: tourEventsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourEventsOpacity },
        { label: `大小 ${tourEventsScale.toFixed(1)}`, value: tourEventsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourEventsScale },
      ];
      case "tourFactories": return [
        { label: `透明度 ${tourFactoriesOpacity.toFixed(2)}`, value: tourFactoriesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourFactoriesOpacity },
        { label: `大小 ${tourFactoriesScale.toFixed(1)}`, value: tourFactoriesScale, min: 0.3, max: 3, step: 0.1, onChange: setTourFactoriesScale },
      ];
      case "tourAmusementParks": return [
        { label: `透明度 ${tourAmusementParksOpacity.toFixed(2)}`, value: tourAmusementParksOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourAmusementParksOpacity },
        { label: `大小 ${tourAmusementParksScale.toFixed(1)}`, value: tourAmusementParksScale, min: 0.3, max: 3, step: 0.1, onChange: setTourAmusementParksScale },
      ];
      case "tourCamping": return [
        { label: `透明度 ${tourCampingOpacity.toFixed(2)}`, value: tourCampingOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourCampingOpacity },
        { label: `大小 ${tourCampingScale.toFixed(1)}`, value: tourCampingScale, min: 0.3, max: 3, step: 0.1, onChange: setTourCampingScale },
      ];
      case "tourHotels": return [
        { type: "select" as const, label: "類別", value: tourHotelsClass, options: [{ label: "全部", value: "all" }, { label: "國際觀光旅館", value: "1" }, { label: "一般觀光旅館", value: "2" }, { label: "旅館", value: "3" }, { label: "民宿", value: "4" }], onChange: setTourHotelsClass },
        { label: `透明度 ${tourHotelsOpacity.toFixed(2)}`, value: tourHotelsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourHotelsOpacity },
        { label: `大小 ${tourHotelsScale.toFixed(1)}`, value: tourHotelsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourHotelsScale },
      ];
      case "tourRestaurants": return [
        { label: `透明度 ${tourRestaurantsOpacity.toFixed(2)}`, value: tourRestaurantsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourRestaurantsOpacity },
        { label: `大小 ${tourRestaurantsScale.toFixed(1)}`, value: tourRestaurantsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourRestaurantsScale },
      ];
      case "streetTreesTaipei3epoch": return [
        { type: "select" as const, label: "染色模式", value: streetTreesTaipei3epochColorMode, options: [{ label: "依軌跡", value: "traj" }, { label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }], onChange: setStreetTreesTaipei3epochColorMode },
        { type: "select" as const, label: "軌跡篩選", value: streetTreesTaipei3epochTrajFilter, options: STREET_TREE_3EPOCH_TRAJ_FILTERS.map((f) => ({ label: f.label, value: f.value })), onChange: setStreetTreesTaipei3epochTrajFilter },
        { label: `透明度 ${streetTreesTaipei3epochOpacity.toFixed(2)}`, value: streetTreesTaipei3epochOpacity, min: 0, max: 1, step: 0.05, onChange: setStreetTreesTaipei3epochOpacity },
        { label: `點位大小 ${streetTreesTaipei3epochRadius.toFixed(2)}`, value: streetTreesTaipei3epochRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setStreetTreesTaipei3epochRadius },
      ];
      case "streetTreesNational": return [
        { type: "select" as const, label: "染色模式", value: streetTreesNationalColorMode, options: [{ label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }, { label: "依城市", value: "city" }], onChange: setStreetTreesNationalColorMode },
        { type: "select" as const, label: "城市", value: streetTreesNationalCity, options: [{ label: "全部", value: "all" }, ...STREET_TREE_NATIONAL_CITIES.map((c) => ({ label: c.label, value: c.value }))], onChange: setStreetTreesNationalCity },
        { label: `透明度 ${streetTreesNationalOpacity.toFixed(2)}`, value: streetTreesNationalOpacity, min: 0, max: 1, step: 0.05, onChange: setStreetTreesNationalOpacity },
        { label: `點位大小 ${streetTreesNationalRadius.toFixed(2)}`, value: streetTreesNationalRadius, min: 0.5, max: 3.0, step: 0.25, onChange: setStreetTreesNationalRadius },
      ];
      case "treePitsTaipei": return [
        { type: "select" as const, label: "類型", value: treePitsTaipeiType, options: [{ label: "全部", value: "all" }, ...TREE_PIT_TYPES.map((t) => ({ label: t.name, value: t.name }))], onChange: setTreePitsTaipeiType },
        { label: `填色透明度 ${treePitsTaipeiOpacity.toFixed(2)}`, value: treePitsTaipeiOpacity, min: 0, max: 0.85, step: 0.05, onChange: setTreePitsTaipeiOpacity },
      ];
      case "buildingsGba": return [
        { type: "select" as const, label: "顯示模式", value: String(buildingsGbaModeIdx), options: [...BUILDINGS_GBA_MODES], onChange: (v: string) => setBuildingsGbaModeIdx(parseInt(v, 10)) },
        { label: `高度門檻 ≥ ${buildingsGbaMinHeight} m`, value: buildingsGbaMinHeight, min: 0, max: 100, step: 5, onChange: setBuildingsGbaMinHeight },
        { label: `透明度 ${buildingsGbaOpacity.toFixed(2)}`, value: buildingsGbaOpacity, min: 0, max: 1, step: 0.05, onChange: setBuildingsGbaOpacity },
        ...(buildingsGbaModeIdx === 3
          ? [{ label: `Bloom 高樓門檻 ≥ ${buildingsGbaBloomMinHeight} m`, value: buildingsGbaBloomMinHeight, min: 40, max: 200, step: 10, onChange: setBuildingsGbaBloomMinHeight }]
          : []),
      ];
      case "urbanFormGrid": return [
        { type: "select" as const, label: "顯示模式", value: String(urbanFormGridModeIdx), options: [...URBAN_FORM_GRID_MODES], onChange: (v: string) => setUrbanFormGridModeIdx(parseInt(v, 10)) },
        { label: `填色透明度 ${urbanFormGridOpacity.toFixed(2)}`, value: urbanFormGridOpacity, min: 0, max: 1, step: 0.05, onChange: setUrbanFormGridOpacity },
      ];
      // 控件組沿用人口網格（h3Population / popCount）：Opacity → Contrast → 3D → Height，
      // 滑桿範圍與 step 完全相同。對比/高度只在 3D 開啟時出現（同 buildingsGba 的
      // Bloom 門檻只在夜景模式出現）—— 本層 contrast 只驅動 extrusion 高度、不影響 2D 配色，
      // 2D 時常駐會是「拉了沒反應」的死控件。
      case "propertyValueGrid": return [
        { type: "select" as const, label: "網格大小", value: String(propertyValueGridScaleIdx), options: PROPERTY_VALUE_SCALES.map((sc) => ({ label: sc.label, value: sc.value })), onChange: (v: string) => setPropertyValueGridScaleIdx(parseInt(v, 10)) },
        // 人均市值只有 450m/1.5km 磚帶 pop（150m 沒有）→ 150m 時 disabled 並在 label 講明，
        // 不自動跳尺度；此時 paint/圖例已由 resolvePropertyValueGridMode() 回退成總市值
        { type: "select" as const, label: "上色模式", value: String(propertyValueGridModeIdx), options: PROPERTY_VALUE_GRID_MODES.map((m) => {
          const disabled = m.value === "1" && !(PROPERTY_VALUE_SCALES[propertyValueGridScaleIdx]?.hasPop ?? false);
          return { label: disabled ? `${m.label}（僅 450m / 1.5km 提供）` : m.label, value: m.value, disabled };
        }), onChange: (v: string) => setPropertyValueGridModeIdx(parseInt(v, 10)) },
        { label: `填色透明度 ${propertyValueGridOpacity.toFixed(2)}`, value: propertyValueGridOpacity, min: 0, max: 1, step: 0.05, onChange: setPropertyValueGridOpacity },
        { type: "toggle" as const, label: "3D 立體", value: propertyValueGridExtruded, onChange: setPropertyValueGridExtruded },
        ...(propertyValueGridExtruded
          ? [
              { label: `對比 Contrast ${propertyValueGridContrast.toFixed(1)}`, value: propertyValueGridContrast, min: 0.5, max: 4, step: 0.1, onChange: setPropertyValueGridContrast },
              { label: `整體高度 Height ${propertyValueGridElevationScale}`, value: propertyValueGridElevationScale, min: 10, max: 400, step: 10, onChange: setPropertyValueGridElevationScale },
            ]
          : []),
      ];
      case "urbanZoningTaipei": return [
        { type: "select" as const, label: "分區", value: urbanZoningTaipeiCategory, options: [{ label: "全部", value: "all" }, ...URBAN_ZONING_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))], onChange: setUrbanZoningTaipeiCategory },
        { label: `填色透明度 ${urbanZoningTaipeiOpacity.toFixed(2)}`, value: urbanZoningTaipeiOpacity, min: 0, max: 1, step: 0.05, onChange: setUrbanZoningTaipeiOpacity },
      ];
      case "urbanZoningNewTaipei": return [
        { type: "select" as const, label: "分區", value: urbanZoningNewTaipeiCategory, options: [{ label: "全部", value: "all" }, ...URBAN_ZONING_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))], onChange: setUrbanZoningNewTaipeiCategory },
        { label: `填色透明度 ${urbanZoningNewTaipeiOpacity.toFixed(2)}`, value: urbanZoningNewTaipeiOpacity, min: 0, max: 1, step: 0.05, onChange: setUrbanZoningNewTaipeiOpacity },
      ];
      case "crimeAreaMonthly": return [
        { label: `填色透明度 ${crimeAreaMonthlyOpacity.toFixed(2)}`, value: crimeAreaMonthlyOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setCrimeAreaMonthlyOpacity },
      ];
      case "theftTaoyuan": return [
        { label: `大小 ${theftTaoyuanScale.toFixed(1)}`, value: theftTaoyuanScale, min: 0.3, max: 3, step: 0.1, onChange: setTheftTaoyuanScale },
        { label: `透明度 ${theftTaoyuanOpacity.toFixed(2)}`, value: theftTaoyuanOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTheftTaoyuanOpacity },
      ];
      case "trafficAccidentYearly": return [
        { label: `大小 ${trafficAccidentYearlyScale.toFixed(1)}`, value: trafficAccidentYearlyScale, min: 0.3, max: 3, step: 0.1, onChange: setTrafficAccidentYearlyScale },
        { label: `透明度 ${trafficAccidentYearlyOpacity.toFixed(2)}`, value: trafficAccidentYearlyOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTrafficAccidentYearlyOpacity },
      ];
      case "accidentTaipei": return [
        { label: `大小 ${accidentTaipeiScale.toFixed(1)}`, value: accidentTaipeiScale, min: 0.3, max: 3, step: 0.1, onChange: setAccidentTaipeiScale },
        { label: `透明度 ${accidentTaipeiOpacity.toFixed(2)}`, value: accidentTaipeiOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAccidentTaipeiOpacity },
      ];
      case "a1AccidentRealtime": return [
        { label: `大小 ${a1AccidentRealtimeScale.toFixed(1)}`, value: a1AccidentRealtimeScale, min: 0.3, max: 3, step: 0.1, onChange: setA1AccidentRealtimeScale },
        { label: `透明度 ${a1AccidentRealtimeOpacity.toFixed(2)}`, value: a1AccidentRealtimeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setA1AccidentRealtimeOpacity },
      ];
      case "investigationBureau": return [
        { label: `大小 ${investigationBureauScale.toFixed(1)}`, value: investigationBureauScale, min: 0.3, max: 3, step: 0.1, onChange: setInvestigationBureauScale },
        { label: `透明度 ${investigationBureauOpacity.toFixed(2)}`, value: investigationBureauOpacity, min: 0.1, max: 1, step: 0.05, onChange: setInvestigationBureauOpacity },
      ];
      case "antiCorruptionOffice": return [
        { label: `大小 ${antiCorruptionOfficeScale.toFixed(1)}`, value: antiCorruptionOfficeScale, min: 0.3, max: 3, step: 0.1, onChange: setAntiCorruptionOfficeScale },
        { label: `透明度 ${antiCorruptionOfficeOpacity.toFixed(2)}`, value: antiCorruptionOfficeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAntiCorruptionOfficeOpacity },
      ];
      case "immigrationOffice": return [
        { label: `大小 ${immigrationOfficeScale.toFixed(1)}`, value: immigrationOfficeScale, min: 0.3, max: 3, step: 0.1, onChange: setImmigrationOfficeScale },
        { label: `透明度 ${immigrationOfficeOpacity.toFixed(2)}`, value: immigrationOfficeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setImmigrationOfficeOpacity },
      ];
      case "coastGuardStation": return [
        { label: `大小 ${coastGuardStationScale.toFixed(1)}`, value: coastGuardStationScale, min: 0.3, max: 3, step: 0.1, onChange: setCoastGuardStationScale },
        { label: `透明度 ${coastGuardStationOpacity.toFixed(2)}`, value: coastGuardStationOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCoastGuardStationOpacity },
      ];
      case "civilDefenseShelter": return [
        { label: `大小 ${civilDefenseShelterScale.toFixed(1)}`, value: civilDefenseShelterScale, min: 0.3, max: 3, step: 0.1, onChange: setCivilDefenseShelterScale },
        { label: `透明度 ${civilDefenseShelterOpacity.toFixed(2)}`, value: civilDefenseShelterOpacity, min: 0.1, max: 1, step: 0.05, onChange: setCivilDefenseShelterOpacity },
      ];
      // ── 警察覆蓋分析 isochrone（每 layer 含 mode + minutes select）──
      case "policeIsoSubstation": return [
        { type: "select" as const, label: "模式", value: policeIsoSubstationMode, options: [
          { label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" },
        ], onChange: (v: string) => setPoliceIsoSubstationMode(v as "walk" | "drive") },
        { type: "select" as const, label: "分鐘", value: policeIsoSubstationMinutes, options: [
          { label: "5 分", value: "5" }, { label: "10 分", value: "10" },
        ], onChange: (v: string) => setPoliceIsoSubstationMinutes(v as "5" | "10") },
        { label: `透明度 ${policeIsoSubstationOpacity.toFixed(2)}`, value: policeIsoSubstationOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setPoliceIsoSubstationOpacity },
      ];
      case "policeIsoPrecinct": return [
        { type: "select" as const, label: "模式", value: policeIsoPrecinctMode, options: [
          { label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" },
        ], onChange: (v: string) => setPoliceIsoPrecinctMode(v as "walk" | "drive") },
        { type: "select" as const, label: "分鐘", value: policeIsoPrecinctMinutes, options: [
          { label: "15 分", value: "15" }, { label: "30 分", value: "30" },
        ], onChange: (v: string) => setPoliceIsoPrecinctMinutes(v as "15" | "30") },
        { label: `透明度 ${policeIsoPrecinctOpacity.toFixed(2)}`, value: policeIsoPrecinctOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setPoliceIsoPrecinctOpacity },
      ];
      case "policeIsoCityDept": return [
        { type: "select" as const, label: "模式", value: policeIsoCityDeptMode, options: [
          { label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" },
        ], onChange: (v: string) => setPoliceIsoCityDeptMode(v as "walk" | "drive") },
        { type: "select" as const, label: "分鐘", value: policeIsoCityDeptMinutes, options: [
          { label: "30 分", value: "30" }, { label: "60 分", value: "60" },
        ], onChange: (v: string) => setPoliceIsoCityDeptMinutes(v as "30" | "60") },
        { label: `透明度 ${policeIsoCityDeptOpacity.toFixed(2)}`, value: policeIsoCityDeptOpacity, min: 0.1, max: 0.9, step: 0.05, onChange: setPoliceIsoCityDeptOpacity },
      ];
      // ── 環境污染 POLLUTION ──
      case "pollutionFacility": return [
        { label: `透明度 ${pollutionFacilityOpacity.toFixed(2)}`, value: pollutionFacilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPollutionFacilityOpacity },
        { label: `大小 ${pollutionFacilityScale.toFixed(2)}`, value: pollutionFacilityScale, min: 0.3, max: 3, step: 0.1, onChange: setPollutionFacilityScale },
        { type: "select" as const, label: "最低嚴重度", value: String(pollutionFacilityMinSev), options: SEVERITY_BANDS.slice(0, 4).map((b) => ({ label: `S${b.sev}+`, value: String(b.sev) })), onChange: (v: string) => setPollutionFacilityMinSev(Number(v)) },
        ...FACILITY_MEDIA.map((m) => ({
          type: "toggle" as const,
          label: POLLUTION_MEDIUM_LABELS[m],
          value: pollutionFacilityMedia[m],
          onChange: (v: boolean) => setPollutionFacilityMedium(m, v),
        })),
      ];
      case "pollutionPenaltyCritical":
      case "pollutionPenaltyGeneral":
      case "pollutionPenaltyMobile": {
        const medOpts = [{ label: "全部介質", value: "0" }, ...PENALTY_MEDIA.map((m, i) => ({ label: POLLUTION_MEDIUM_LABELS[m], value: String(i + 1) }))];
        return [
          { label: `透明度 ${pollutionPenaltyOpacity.toFixed(2)}`, value: pollutionPenaltyOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPollutionPenaltyOpacity },
          { label: `大小 ${pollutionPenaltyScale.toFixed(2)}`, value: pollutionPenaltyScale, min: 0.3, max: 3, step: 0.1, onChange: setPollutionPenaltyScale },
          { type: "select" as const, label: "介質", value: String(pollutionPenaltyMediumIdx), options: medOpts, onChange: (v: string) => setPollutionPenaltyMediumIdx(Number(v)) },
          { type: "select" as const, label: "年份", value: String(pollutionPenaltyYear), options: pollutionYearOptions(), onChange: (v: string) => { setPollutionPenaltyYear(Number(v)); setPollutionPenaltyPlaying(false); } },
          { type: "select" as const, label: "模式", value: String(pollutionPenaltyMode), options: PENALTY_MODE_OPTIONS, onChange: (v: string) => setPollutionPenaltyMode(Number(v)) },
          { type: "toggle" as const, label: pollutionPenaltyPlaying ? "⏸ 停止播放" : "▶ 歷史播放", value: pollutionPenaltyPlaying, onChange: (v: boolean) => { if (v && (pollutionPenaltyYear === 0 || pollutionPenaltyYear >= PENALTY_YEAR_MAX)) setPollutionPenaltyYear(PENALTY_YEAR_MIN); setPollutionPenaltyPlaying(v); } },
        ];
      }
      case "pollutionSite": return [
        { label: `透明度 ${pollutionSiteOpacity.toFixed(2)}`, value: pollutionSiteOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPollutionSiteOpacity },
        { label: `大小 ${pollutionSiteScale.toFixed(2)}`, value: pollutionSiteScale, min: 0.3, max: 3, step: 0.1, onChange: setPollutionSiteScale },
        { type: "toggle" as const, label: "只看列管中 Active", value: pollutionSiteActiveOnly, onChange: setPollutionSiteActiveOnly },
      ];
      default: return [];
    }
  };

  return {
    stationScale,
    railTrackMode,
    newsTimeBased,
    newsRipple,
    newsMinRelevance,
    setNewsMinRelevance,
    newsEventsOnly,
    setNewsEventsOnly,
    newsMinSeverity,
    setNewsMinSeverity,
    enabledBusCities,
    enabledWasteScheduleCities,
    refs: {
      altExag: altExagRef,
      altOffset: altOffsetRef,
      staticOpacity: staticOpacityRef,
      orbScale: orbScaleRef,
      shipOrbScale: shipOrbScaleRef,
      shipTrailOpacity: shipTrailOpacityRef,
      railAltOffset: railAltOffsetRef,
      railOrbScale: railOrbScaleRef,
      railTrackOpacity: railTrackOpacityRef,
      railTrainVisible: railTrainVisibleRef,
      railTrackMode: railTrackModeRef,
      busOrbScale: busOrbScaleRef,
      busColorMode: busColorModeRef,
      busAltOffset: busAltOffsetRef,
      busIntercityOrbScale: busIntercityOrbScaleRef,
      wasteOrbScale: wasteOrbScaleRef,
      wasteNoteSize: wasteNoteSizeRef,
      wasteNoteZOffset: wasteNoteZOffsetRef,
      fireStationsScale: fireStationsScaleRef,
      fireStationsOpacity: fireStationsOpacityRef,
      fireStations3D: fireStations3DRef,
      wasteSubParams: wasteSubParamsRef,
      busIntercityColorMode: busIntercityColorModeRef,
      busIntercityAltOffset: busIntercityAltOffsetRef,
      touristShuttleOrbScale: touristShuttleOrbScaleRef,
      touristShuttleColorMode: touristShuttleColorModeRef,
      touristShuttleAltOffset: touristShuttleAltOffsetRef,
      touristShuttleOpacity: touristShuttleOpacityRef,
      beamVisible: beamVisibleRef,
      beamDistance: beamDistanceRef,
      beamOpacity: beamOpacityRef,
      thsrPillarVisible: thsrPillarVisibleRef,
      thsrPillarHeight: thsrPillarHeightRef,
      traPillarVisible: traPillarVisibleRef,
      traPillarHeight: traPillarHeightRef,
      metroPillarVisible: metroPillarVisibleRef,
      metroPillarHeight: metroPillarHeightRef,
      portPillarVisible: portPillarVisibleRef,
      portPillarHeight: portPillarHeightRef,
      airportPillarVisible: airportPillarVisibleRef,
      airportPillarHeight: airportPillarHeightRef,
      tempHeight: tempHeightRef,
      tempZOffset: tempZOffsetRef,
      tempExtruded: tempExtrudedRef,
      tempOpacity: tempOpacityRef,
      tempWireframe: tempWireframeRef,
    },
    overlayParams,
    getControls,
    wasteSubParams,
    h3Params: useMemo(() => ({ opacity: h3Opacity, extruded: h3Extruded, elevationScale: h3ElevationScale, metric: h3Metric, contrast: h3Contrast }), [h3Opacity, h3Extruded, h3ElevationScale, h3Metric, h3Contrast]),
    popCountParams: useMemo(() => ({ opacity: pcOpacity, contrast: pcContrast, extruded: pcExtruded, elevationScale: pcElevationScale }), [pcOpacity, pcContrast, pcExtruded, pcElevationScale]),
    indicatorsParams: useMemo(() => ({ category: indCategory, metric: indMetric, opacity: indOpacity, contrast: indContrast, extruded: indExtruded, elevationScale: indElevationScale }), [indCategory, indMetric, indOpacity, indContrast, indExtruded, indElevationScale]),
    socioParams: useMemo(() => ({ metric: socioMetric, opacity: socioOpacity, contrast: socioContrast, extruded: socioExtruded, elevationScale: socioElevation }), [socioMetric, socioOpacity, socioContrast, socioExtruded, socioElevation]),
    spatialParams: useMemo(() => ({ metric: spatialMetric, opacity: spatialOpacity, contrast: spatialContrast, extruded: spatialExtruded, elevationScale: spatialElevation }), [spatialMetric, spatialOpacity, spatialContrast, spatialExtruded, spatialElevation]),
    ybResolution,
    youbikeParams: useMemo(() => ({ opacity: ybOpacity, contrast: ybContrast, extruded: ybExtruded, elevationScale: ybElevationScale, heightMode: ybHeightMode }), [ybOpacity, ybContrast, ybExtruded, ybElevationScale, ybHeightMode]),
    cwaCloudOpacity,
    cwaRadarOpacity,
    tempGridOpacity,
    eqOpacity,
    eqShowHistory,
    eqReplayOpacity,
    daOpacity,
    reOpacity,
    satOpacity,
    aqiMicroCluster,
    aqiMicroModeIdx,
    aqiImageryOpacity,
    hillshadeOpacity,
    slopeVectorOpacity,
    aspectVectorOpacity,
    // 環境污染 filter 狀態（餵 usePollutionLayers 的 setFilter）
    pollutionFacilityMedia,
    pollutionFacilityMinSev,
    pollutionPenaltyMediumIdx,
    pollutionPenaltyYear,
    pollutionPenaltyMode,
    pollutionSiteActiveOnly,
  };
}
