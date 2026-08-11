import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ExpandableLayerKey, BusCity, BusColorMode, BusGroup } from "../types";
import { layerParamsStore, encodeParamsToOverlay } from "../state/layerParamsStore";
import { buildParamControls } from "../state/layerParamsControls";
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
// religionTypes / funeralTypes 的 select 選項常數已隨 11 個試點 key 遷出本檔
// （現由 src/data/layerParamsSpec.ts 引用）。
import { NON_URBAN_ZONING_CODES } from "../data/nonUrbanZoningTypes";
import { MOUNTAIN_RESCUE_YEARS } from "../data/mountainSafetyTypes";
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
  // 🧳 觀光 Tourism 12 層（點層 opacity 0.85 + scale 1；面層 opacity 0.5；select 存字串，overlayParams 轉 Idx）
  const [tourAttractionsOpacity, setTourAttractionsOpacity] = useState(0.85);
  const [tourAttractionsScale, setTourAttractionsScale] = useState(1);
  const [tourAttractionsMode, setTourAttractionsMode] = useState<string>("category"); // category / heat
  // 🛕 宗教 Religion 6 層 ＋ ⚰️ 殯葬 Funeral 5 層：**已遷出本檔**（AR-22 P3-1 試點）
  //    值 → src/state/layerParamsStore.ts；控件規格（含 "active" 這類非 "all" 的預設、
  //    select 的 encode 順序）→ src/data/layerParamsSpec.ts。
  const [tourEventsOpacity, setTourEventsOpacity] = useState(0.85);
  const [tourEventsScale, setTourEventsScale] = useState(1);
  const [tourEventsStatus, setTourEventsStatus] = useState<string>("all"); // all / ongoing / upcoming
  const [tourHotelsOpacity, setTourHotelsOpacity] = useState(0.85);
  const [tourHotelsScale, setTourHotelsScale] = useState(1);
  const [tourHotelsClass, setTourHotelsClass] = useState<string>("all"); // all / 1 / 2 / 3 / 4
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
  // 非都市分區：面積大 → 預設透明度 0.35（都計分區是 0.5）；篩選走 zone_code 11 碼
  const [nonUrbanZoningOpacity, setNonUrbanZoningOpacity] = useState(0.35);
  const [nonUrbanZoningCode, setNonUrbanZoningCode] = useState<string>("all");
  const [urbanZoningNewTaipeiOpacity, setUrbanZoningNewTaipeiOpacity] = useState(0.5);
  const [urbanZoningNewTaipeiCategory, setUrbanZoningNewTaipeiCategory] = useState<string>("all"); // all / 9 類 zone_category
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
  // 醫療等時圈 + 醫療沙漠（共用 opacity slider）
  const [medIsochroneOpacity, setMedIsochroneOpacity] = useState(0.5);
  // ETC Gantry（收費門架 靜態點）
  const [etcGantryScale, setEtcGantryScale] = useState(1);
  const [etcGantryOpacity, setEtcGantryOpacity] = useState(0.8);
  const [etcGantryZ, setEtcGantryZ] = useState(0);
  // Service Area（國道服務區 靜態點）
  const [serviceAreaScale, setServiceAreaScale] = useState(1.4);
  const [serviceAreaOpacity, setServiceAreaOpacity] = useState(0.85);
  const [serviceAreaZ, setServiceAreaZ] = useState(0);
  // Taxi Stand（計程車招呼站 靜態點）
  const [taxiStandScale, setTaxiStandScale] = useState(1);
  const [taxiStandOpacity, setTaxiStandOpacity] = useState(0.8);
  const [taxiStandZ, setTaxiStandZ] = useState(0);
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
  // School（🎓 教育 Education 第 38 主題）
  // schoolScale / schoolLevelColor 是原公共設施 schools 層的既有 param，
  // 搬入教育主題後 schoolScale 擴大為 6 個點層共用；schoolLevelColor 仍只作用於總覽層。
  const [schoolScale, setSchoolScale] = useState(1);
  const [schoolLevelColor, setSchoolLevelColor] = useState(false);
  const [eduSchoolsOpacity, setEduSchoolsOpacity] = useState(0.85);
  // 學區面：國小／國中兩層的面完全疊合，共用一支 slider（分開調會互相遮蓋難以對齊）；
  // 高中就學區是覆蓋全台的縣市級大面，預設更透明。
  const [eduDistrictK12Opacity, setEduDistrictK12Opacity] = useState(0.3);
  // 幼托三層（幼兒園／課後照顧／互助教保）密度相近且常疊看，共用一組 slider；
  // 補習班 17,137 點密度高一階，獨立一組（預設更透明），見 overlayRegistry 的 eduCramSchool*。
  const [eduChildcareOpacity, setEduChildcareOpacity] = useState(0.85);
  const [eduChildcareScale, setEduChildcareScale] = useState(1);
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
  // 共機活動區：showReview 預設 false —— 未通過守門的形狀不當成正式資料預設顯示
  // 0.6 = 校準過的預設亮度（見 usePlaActivityLayer BASE_*），往上還能拉亮
  const [plaOpacity, setPlaOpacity] = useState(0.6);
  const [plaShowReview, setPlaShowReview] = useState(false);
  // 疊加天數（1=單日）與累積回放。回放走圖層自己的 clock —— 全域時間軸最多
  // 7 天視窗，表達不了 30~120 天的掃描
  const [plaTrailDays, setPlaTrailDays] = useState<number>(1);
  const [plaReplay, setPlaReplay] = useState(false);
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
  // 其他水資源圖層參數
  const [waterFloodOpacity, setWaterFloodOpacity] = useState(1.0);
  // Phase 2 monitoring layers（即時雨量 / 河川水位 / 地下水井 / 水井點位）
  const [iotWraRiverScale, setIotWraRiverScale] = useState(1.0);
  const [iotWraRiverOpacity, setIotWraRiverOpacity] = useState(1.0);
  const [iotWraRiverShowMeasured, setIotWraRiverShowMeasured] = useState(true);
  const [iotWraRiverShowForecast, setIotWraRiverShowForecast] = useState(true);
  const [iotWraStructureScale, setIotWraStructureScale] = useState(1.0);
  // 北市水利處三本柱
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
  const [agriSoilFertilityOpacity, setAgriSoilFertilityOpacity] = useState(1.0);
  const [agriSoilFertilityMetric, setAgriSoilFertilityMetric] = useState<SoilFertilityMetric>("health");
  const [agriCropSuitabilityOpacity, setAgriCropSuitabilityOpacity] = useState(1.0);
  const [agriCropSuitabilityCropId, setAgriCropSuitabilityCropId] = useState(0);

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
  // 飼養場品項高亮（index into FARM_HIGHLIGHT_OPTIONS；0 = 全部，不高亮）
  const [livestockFarmPigHighlightIdx, setLivestockFarmPigHighlightIdx] = useState(0);
  const [livestockFarmChickenHighlightIdx, setLivestockFarmChickenHighlightIdx] = useState(0);
  const [livestockFarmCattleHighlightIdx, setLivestockFarmCattleHighlightIdx] = useState(0);
  const [livestockFarmDuckHighlightIdx, setLivestockFarmDuckHighlightIdx] = useState(0);
  const [livestockFarmGooseHighlightIdx, setLivestockFarmGooseHighlightIdx] = useState(0);
  const [livestockFarmSheepHighlightIdx, setLivestockFarmSheepHighlightIdx] = useState(0);
  const [livestockFarmOtherHighlightIdx, setLivestockFarmOtherHighlightIdx] = useState(0);



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
  // ENERGY MVP — 4 layer opacity + 2 scale/height
  const [powerPlantGlowOpacity, setPowerPlantGlowOpacity] = useState(0.9);
  const [powerPlantGlowSize, setPowerPlantGlowSize] = useState(1);
  const [substationEhvGlowOpacity, setSubstationEhvGlowOpacity] = useState(0.9);
  const [substationEhvGlowSize, setSubstationEhvGlowSize] = useState(1);
  const [powerLinesGlowOpacity, setPowerLinesGlowOpacity] = useState(0.7);
  const [powerLinesGlowWidth, setPowerLinesGlowWidth] = useState(2);
  // 變電所（超高壓）— EHV_SWITCH + EHV
  const [powerPolesOpacity, setPowerPolesOpacity] = useState(0.7);
  const [powerPolesSize, setPowerPolesSize] = useState(1);
  const [powerPolesHeat, setPowerPolesHeat] = useState(1); // 0=關熱區、1=全顯
  const [powerPolesZ5Reveal, setPowerPolesZ5Reveal] = useState(0); // 0=z<8 隱形（預設），1=全 zoom 顯示
  // Phase 8 SSOT facilities 6-layer
  const [facPrimaryOpacity, setFacPrimaryOpacity] = useState(0.65);
  const [facPrimaryScale, setFacPrimaryScale] = useState(0.5);
  // L1 分級：有即時出力（台電 14 大廠 + 廠級匯總）vs 其他（小廠）
  const [facPrimaryRtScale, setFacPrimaryRtScale] = useState(1.3);
  const [facPrimaryNoRtScale, setFacPrimaryNoRtScale] = useState(0.85);
  // ── 化石燃料 14 layer params（Phase B） ──
  const [industrialRefineryOpacity, setIndustrialRefineryOpacity] = useState(0.55);
  const [industrialRefineryOutline, setIndustrialRefineryOutline] = useState(true);
  const [industrialStorageTankOpacity, setIndustrialStorageTankOpacity] = useState(0.55);
  const [industrialStorageTankOutline, setIndustrialStorageTankOutline] = useState(true);
  const [industrialPowerPlantOpacity, setIndustrialPowerPlantOpacity] = useState(0.5);
  const [industrialPowerPlantOutline, setIndustrialPowerPlantOutline] = useState(true);
  // HAZARD（v2 Phase B）
  const [lightningOpacity, setLightningOpacity] = useState(0.85);
  const [lightningMinutes, setLightningMinutes] = useState(10);
  const [lightningCwaOpacity, setLightningCwaOpacity] = useState(0.85);
  const [lightningCwaMinutes, setLightningCwaMinutes] = useState(10);
  // 全球氣候 GLOBAL CLIMATE
  const [typhoonTracksOpacity, setTyphoonTracksOpacity] = useState(0.9);
  // 🌍 世界 WORLD
  const [typhoonSource, setTyphoonSource] = useState("all"); // all / jma / jtwc
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
  const [osmRoadDriveOpacity, setOsmRoadDriveOpacity] = useState(0.85);
  const [osmRoadDriveWidth, setOsmRoadDriveWidth] = useState(1.0);
  const [osmRoadDriveZ5Reveal, setOsmRoadDriveZ5Reveal] = useState(0); // 0=z<8 隱形（預設），1=全 zoom 顯示
  const [hillshadeOpacity, setHillshadeOpacity] = useState(0.5);
  // 坡度/坡向分級向量（PMTiles polygon，可點選/疊圖分析）
  const [slopeVectorOpacity, setSlopeVectorOpacity] = useState(0.6);
  const [aspectVectorOpacity, setAspectVectorOpacity] = useState(0.6);
  // 房地產（6 layer 共用一個透明度）
  const [realEstateOpacity, setRealEstateOpacity] = useState(0.7);
  // 排除雙北（taipei+newtaipei）重繪：濾掉雙北 + 色階壓縮到非雙北 domain。預設 false=包含
  const [realEstateExcludeTaipei, setRealEstateExcludeTaipei] = useState(false);
  // 登山安全：山屋（<1k 點 UX baseline 0.9）／山域事故（1k~10k baseline 0.85 + 年份三態以上篩選）
  const [mountainRescueIncidentsOpacity, setMountainRescueIncidentsOpacity] = useState(0.85);
  const [mountainRescueIncidentsScale, setMountainRescueIncidentsScale] = useState(1.0);
  const [mountainRescueIncidentsYear, setMountainRescueIncidentsYear] = useState<string>("all"); // all / 2019..2024
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

  // ══════════════════════════════════════════════════════════════════
  //  雙軌（AR-22 P3-1）：已遷移進 layerParamsStore 的 key 走規格派生，
  //  其餘維持本檔既有的 per-layer useState + switch。分岔只有兩處 ——
  //  這裡（overlayParams）與下方 getControls 的開頭。
  //
  //  ⚠️ 這一行訂閱是**行為等價的關鍵**：黃金快照只驗「預設值下的一次 render」，
  //  驗不到「拖動時畫面有沒有更新」。沒有它，遷移過去的 slider 拖了 store 有變、
  //  但本 hook 不會重跑 → overlayParams 不更新 → 畫面完全沒反應（無錯誤無警告）。
  // ══════════════════════════════════════════════════════════════════
  const migratedParams = useSyncExternalStore(
    layerParamsStore.subscribe,
    layerParamsStore.getAll,
    layerParamsStore.getAll,
  );
  const migratedOverlayParams = useMemo(
    () => encodeParamsToOverlay(migratedParams),
    [migratedParams],
  );

  const overlayParams = useMemo<Record<string, number>>(() => ({
    // 警政司法民防 17 layer
    aquacultureWaterSatelliteOpacity, aquacultureWaterSatelliteMoaOpacity, 
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
    // 🧳 觀光 Tourism：select 編成 Idx 餵 paint/filter（overlayParams 只收數字）
    tourAttractionsOpacity, tourAttractionsScale,
    tourAttractionsModeIdx: ["category", "heat"].indexOf(tourAttractionsMode),
    // 🛕 宗教 6 層 ＋ ⚰️ 殯葬 5 層的 27 個 overlayParams key（含 6 個 select 的 Idx）
    // 已遷出：由末尾 `...migratedOverlayParams` 從 layerParamsSpec 的 encode 派生。
    tourEventsOpacity, tourEventsScale,
    tourEventsStatusIdx: ["all", "ongoing", "upcoming"].indexOf(tourEventsStatus),
    tourHotelsOpacity, tourHotelsScale,
    tourHotelsClassIdx: ["all", "1", "2", "3", "4"].indexOf(tourHotelsClass),
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
    nonUrbanZoningOpacity,
    // idx 0=全部，1..11 對應 NON_URBAN_ZONING_CODES（同 urbanZoning*CategoryIdx 慣例）
    nonUrbanZoningCodeIdx: ["all", ...NON_URBAN_ZONING_CODES.map((c) => c.code)].indexOf(nonUrbanZoningCode),
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
    lighthouseScale,
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
    medIsochroneOpacity,
    etcGantryScale,
    etcGantryOpacity,
    etcGantryZ,
    serviceAreaScale,
    serviceAreaOpacity,
    serviceAreaZ,
    taxiStandScale,
    taxiStandOpacity,
    taxiStandZ,
    portGlow,
    schoolScale,
    schoolLevelColor: schoolLevelColor ? 1 : 0,
    eduSchoolsOpacity,
    eduDistrictK12Opacity,
    eduChildcareOpacity,
    eduChildcareScale,
    newsScale,
    metroPillar3d: metroPillarVisible ? 1 : 0,
    floodMinDepth,
    waterFloodOpacity,
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
    precipRasterOpacity,
    precipRasterHours,
    wasteStopsStaticScale,
    wasteStopsStaticGlow,
    wasteStopsStaticZ,
    agricultureOpacity,
    agricultureOutlineWidth,
    agricultureShowOutline: agricultureShowOutline ? 1 : 0,
    agricultureZ,
    agriSoilFertilityOpacity,
    // metric 字串轉 index 編進 overlayParams (Record<string,number>)；MapView 端再 decode 回 string
    agriSoilFertilityMetricIdx: SOIL_FERTILITY_METRIC_OPTIONS.findIndex((o) => o.value === agriSoilFertilityMetric),
    agriCropSuitabilityOpacity,
    agriCropSuitabilityCropId,
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
    livestockFarmPigHighlightIdx,
    livestockFarmChickenHighlightIdx,
    livestockFarmCattleHighlightIdx,
    livestockFarmDuckHighlightIdx,
    livestockFarmGooseHighlightIdx,
    livestockFarmSheepHighlightIdx,
    livestockFarmOtherHighlightIdx,
    // 🏟️ 運動場館 Sports
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
    mountainRescueIncidentsOpacity,
    mountainRescueIncidentsScale,
    // idx 0=全部，1..6 對應 MOUNTAIN_RESCUE_YEARS（同 urbanZoning*CategoryIdx 慣例）
    mountainRescueIncidentsYearIdx: ["all", ...MOUNTAIN_RESCUE_YEARS.map(String)].indexOf(mountainRescueIncidentsYear),
    // ENERGY
    powerPlantGlowOpacity,
    powerPlantGlowSize,
    substationEhvGlowOpacity,
    substationEhvGlowSize,
    powerLinesGlowOpacity,
    powerLinesGlowWidth,
    facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale,
    // 化石燃料 14 layer
    industrialRefineryOpacity, industrialRefineryOutline: industrialRefineryOutline ? 1 : 0,
    industrialStorageTankOpacity, industrialStorageTankOutline: industrialStorageTankOutline ? 1 : 0,
    industrialPowerPlantOpacity, industrialPowerPlantOutline: industrialPowerPlantOutline ? 1 : 0,
    // 雲林 POC 覆蓋分析
    powerPolesOpacity,
    powerPolesSize,
    powerPolesHeat,
    powerPolesZ5Reveal,
    // HAZARD
    lightningOpacity,
    lightningMinutes,
    lightningCwaOpacity,
    lightningCwaMinutes,
    // 全球氣候 GLOBAL CLIMATE
    typhoonTracksOpacity,
    typhoonSourceIdx: ["all", "jma", "jtwc"].indexOf(typhoonSource),
    oceanCurrentsOpacity,
    windFieldOpacity,
    windAnimationSpeed,
    windParticleCount,
    windLineWidth,
    oceanAnimationSpeed,
    oceanParticleCount,
    oceanLineWidth,
    // 🌍 世界 WORLD
    realEstateOpacity,
    realEstateExcludeTaipei: realEstateExcludeTaipei ? 1 : 0,
    // LASS 微感測顯示模式（只供 LegendPanel 選對應圖例；paint 端走 hook 的 setPaintProperty）
    aqiMicroModeIdx,
    // 都市熱島 raster：模式同時餵 overlayRegistry paint（raster-color-mix/range/color）與圖例
    urbanHeatModeIdx,
    urbanHeatOpacity,
    // Base map
    osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal,
    hillshadeOpacity,
    slopeVectorOpacity, aspectVectorOpacity,
    // ── 雙軌：已遷移進 layerParamsStore 的 key（規格派生，含 select 的 Idx 編碼）──
    //    刻意放在最末 spread：遷移途中若某 key 的手寫字面尚未刪除，以規格派生為準。
    ...migratedOverlayParams,
  }), [migratedOverlayParams, realEstateOpacity, realEstateExcludeTaipei, osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal, hillshadeOpacity, slopeVectorOpacity, aspectVectorOpacity, stationScale, airportOpacity, airportGlow, busScale, lighthouseScale, cctvScale, cctvOpacity, cctvZ, fireStationsScale, fireStationsOpacity, fireStationsZ, fireStationsDots, fireHydrantsScale, fireHydrantsOpacity, fireHydrantsZ, fireIsochroneOpacity, fireIsochroneCounty, medIsochroneOpacity, etcGantryScale, etcGantryOpacity, etcGantryZ, serviceAreaScale, serviceAreaOpacity, serviceAreaZ, taxiStandScale, taxiStandOpacity, taxiStandZ, portGlow, schoolScale, schoolLevelColor, eduSchoolsOpacity, eduDistrictK12Opacity, eduChildcareOpacity, eduChildcareScale, newsScale, metroPillarVisible, floodMinDepth, waterFloodOpacity, iotWraRiverScale, iotWraRiverOpacity, iotWraRiverShowMeasured, iotWraRiverShowForecast, iotWraStructureScale, iotWraStructureOpacity, iotWraStructureFlow, iotWraStructureGate, iotWraStructureDam, iotWraStructureErosion, iotWraStructureDust, precipRasterOpacity, precipRasterHours, wasteStopsStaticScale, wasteStopsStaticGlow, wasteStopsStaticZ, agricultureOpacity, agricultureOutlineWidth, agricultureShowOutline, agricultureZ, agriSoilFertilityOpacity, agriSoilFertilityMetric, agriCropSuitabilityOpacity, agriCropSuitabilityCropId, livestockFarmPigOpacity, livestockFarmPigScale, livestockFarmChickenOpacity, livestockFarmChickenScale, livestockFarmCattleOpacity, livestockFarmCattleScale, livestockFarmDuckOpacity, livestockFarmDuckScale, livestockFarmGooseOpacity, livestockFarmGooseScale, livestockFarmSheepOpacity, livestockFarmSheepScale, livestockFarmOtherOpacity, livestockFarmOtherScale, livestockFarmPigHighlightIdx, livestockFarmChickenHighlightIdx, livestockFarmCattleHighlightIdx, livestockFarmDuckHighlightIdx, livestockFarmGooseHighlightIdx, livestockFarmSheepHighlightIdx, livestockFarmOtherHighlightIdx, forestCompartmentsOpacity, forestCompartmentsOutlineWidth, forestCompartmentsShowOutline, forestReserveOpacity, forestReserveOutlineWidth, forestReserveShowOutline, forestRecreationOpacity, forestRecreationOutlineWidth, forestRecreationShowOutline, forestTreatmentWorksOpacity, forestTreatmentWorksOutlineWidth, forestTreatmentWorksShowOutline, forestFlatParksOpacity, forestFlatParksOutlineWidth, forestFlatParksShowOutline, forestDamLakesOpacity, forestDamLakesOutlineWidth, forestDamLakesShowOutline, mountainRescueIncidentsOpacity, mountainRescueIncidentsScale, mountainRescueIncidentsYear, powerPlantGlowOpacity, powerPlantGlowSize, substationEhvGlowOpacity, substationEhvGlowSize, powerLinesGlowOpacity, powerLinesGlowWidth, powerPolesOpacity, powerPolesSize, powerPolesHeat, powerPolesZ5Reveal, lightningOpacity, lightningMinutes, lightningCwaOpacity, lightningCwaMinutes, facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale, industrialRefineryOpacity, industrialRefineryOutline, industrialStorageTankOpacity, industrialStorageTankOutline, industrialPowerPlantOpacity, industrialPowerPlantOutline, typhoonTracksOpacity, typhoonSource, oceanCurrentsOpacity, windFieldOpacity, windAnimationSpeed, windParticleCount, windLineWidth, oceanAnimationSpeed, oceanParticleCount, oceanLineWidth, 
    
    
    
    
    
    aquacultureWaterSatelliteOpacity, aquacultureWaterSatelliteConfidence, aquacultureWaterSatelliteMoaOpacity, 
    aquacultureWaterSatelliteMoaShowConfirmed, aquacultureWaterSatelliteMoaShowSolar, aquacultureWaterSatelliteMoaShowOther,
    aquacultureWaterUnionOpacity, aquacultureWaterUnionShowBoth, aquacultureWaterUnionShowMoaOnly, aquacultureWaterUnionShowOsmOnly,
    streetTreesTaipeiDiffOpacity, streetTreesTaipeiDiffStatus, streetTreesTaipeiDiffRadius, streetTreesTaipeiDiffColorMode,
    protectedTreesNationalOpacity, protectedTreesNationalRadius, protectedTreesNationalColorMode, protectedTreesNationalCity,
    riversideTreesTaipeiOpacity, riversideTreesTaipeiRadius, riversideTreesTaipeiPark,
    parksTaipeiOpacity, parksTaipeiRadius, parksTaipeiCategory,
    culturalFacilitiesOpacity, culturalFacilitiesRadius, culturalFacilitiesType,
    culturalMuseumsOpacity, culturalMuseumsRadius, culturalMuseumsType,
    artsEventsOpacity, artsEventsRadius, artsEventsStatus,
    
    streetTreesTaipei3epochOpacity, streetTreesTaipei3epochRadius, streetTreesTaipei3epochColorMode, streetTreesTaipei3epochTrajFilter,
    streetTreesNationalOpacity, streetTreesNationalRadius, streetTreesNationalColorMode, streetTreesNationalCity,
    treePitsTaipeiOpacity, treePitsTaipeiType,
    buildingsGbaModeIdx, buildingsGbaMinHeight, buildingsGbaOpacity, buildingsGbaBloomMinHeight,
    urbanFormGridModeIdx, urbanFormGridOpacity,
    propertyValueGridScaleIdx, propertyValueGridModeIdx, propertyValueGridOpacity, propertyValueGridContrast, propertyValueGridExtruded, propertyValueGridElevationScale,
    urbanZoningTaipeiOpacity, urbanZoningTaipeiCategory,
    urbanZoningNewTaipeiOpacity, urbanZoningNewTaipeiCategory,
    nonUrbanZoningOpacity, nonUrbanZoningCode,
    
    
    
    
    
    policeIsoSubstationOpacity, policeIsoSubstationMode, policeIsoSubstationMinutes,
    policeIsoPrecinctOpacity, policeIsoPrecinctMode, policeIsoPrecinctMinutes,
    policeIsoCityDeptOpacity, policeIsoCityDeptMode, policeIsoCityDeptMinutes,
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    pollutionSiteOpacity, pollutionSiteScale,
    tourAttractionsOpacity, tourAttractionsScale, tourAttractionsMode,
    
    
    // 宗教 6 ＋ 殯葬 5 的 27 項 deps 已遷出 —— 整組收斂成首項的 migratedOverlayParams
    tourEventsOpacity, tourEventsScale, tourEventsStatus,
    
    
    tourHotelsOpacity, tourHotelsScale, tourHotelsClass,
    
    aqiMicroModeIdx, urbanHeatModeIdx, urbanHeatOpacity]);

  const getControls = (layer: ExpandableLayerKey): ParamControl[] => {
    // ── 雙軌分岔（AR-22 P3-1）──────────────────────────────────────
    // 已遷移的 key 由規格派生控件；未遷移回 null → fallthrough 到下方 switch。
    // 值取自本次 render 訂閱到的 snapshot（不直接 getParams()）—— 讓控件的 value
    // 與觸發本次 render 的那份快照同源，避免 useSyncExternalStore 的 tearing。
    const migrated = buildParamControls(layer, migratedParams[layer]);
    if (migrated) return migrated;

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
      // 🎓 教育 Education — 6 個點層共用 eduSchoolsOpacity / schoolScale（同一份 schools.geojson）
      // 只有總覽層 schools 額外給「分級配色」開關；5 個分級層與偏遠層本來就固定分色。
      case "schools":
      case "eduSchoolElementary":
      case "eduSchoolJunior":
      case "eduSchoolSenior":
      case "eduSchoolUniversity":
      case "eduSchoolSpecial":
      case "eduRemoteSchools": return [
        { label: `透明度 ${eduSchoolsOpacity.toFixed(2)}`, value: eduSchoolsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEduSchoolsOpacity },
        { label: `Scale ${schoolScale.toFixed(1)}`, value: schoolScale, min: 0.3, max: 3, step: 0.1, onChange: setSchoolScale },
        ...(layer === "schools"
          ? [{ type: "toggle" as const, label: "分級配色", value: schoolLevelColor, onChange: setSchoolLevelColor }]
          : []),
      ];
      // 國小／國中學區面完全疊合 → 共用一支 slider（overlayRegistry 兩層都讀 eduDistrictK12Opacity）
      case "eduDistrictElementary":
      case "eduDistrictJunior": return [
        { label: `透明度 ${eduDistrictK12Opacity.toFixed(2)}`, value: eduDistrictK12Opacity, min: 0.1, max: 1, step: 0.05, onChange: setEduDistrictK12Opacity },
      ];
      // 幼托三層共用一組 slider（overlayRegistry 三層都讀 eduChildcare*）；補習班點密度高一階，獨立一組
      case "eduKindergarten":
      case "eduAfterschoolCare":
      case "eduMutualCare": return [
        { label: `透明度 ${eduChildcareOpacity.toFixed(2)}`, value: eduChildcareOpacity, min: 0.1, max: 1, step: 0.05, onChange: setEduChildcareOpacity },
        { label: `Scale ${eduChildcareScale.toFixed(1)}`, value: eduChildcareScale, min: 0.3, max: 3, step: 0.1, onChange: setEduChildcareScale },
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
      // ── 🌍 世界 WORLD ──
      case "typhoonTracks": return [
        { type: "select" as const, label: "資料源", value: typhoonSource, options: [
          { label: "全部", value: "all" },
          { label: "JMA 日本", value: "jma" },
          { label: "JTWC 美軍", value: "jtwc" },
        ], onChange: setTyphoonSource },
        { label: `透明度 ${typhoonTracksOpacity.toFixed(2)}`, value: typhoonTracksOpacity, min: 0, max: 1, step: 0.05, onChange: setTyphoonTracksOpacity },
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
      case "plaActivity": return [
        { type: "select" as const, label: "疊加", value: String(plaTrailDays), options: [
          { label: "單日", value: "1" },
          { label: "30 天", value: "30" },
          { label: "60 天", value: "60" },
          { label: "90 天", value: "90" },
          { label: "120 天", value: "120" },
        ], onChange: (v: string) => setPlaTrailDays(Number(v)) },
        // 單日沒有東西可掃 → 回放只在疊加 > 單日時有意義
        { type: "toggle" as const, label: "回放", value: plaReplay, onChange: setPlaReplay },
        { label: `Opacity ${plaOpacity.toFixed(2)}`, value: plaOpacity, min: 0, max: 1, step: 0.05, onChange: setPlaOpacity },
        { type: "toggle" as const, label: "待核實", value: plaShowReview, onChange: setPlaShowReview },
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
      case "agriCropSuitability": return [
        { label: `透明度 ${agriCropSuitabilityOpacity.toFixed(2)}`, value: agriCropSuitabilityOpacity, min: 0.1, max: 1, step: 0.05, onChange: setAgriCropSuitabilityOpacity },
        ...buildCropSelector(agriCropSuitabilityCropId, setAgriCropSuitabilityCropId),
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
      // 🏟️ 運動場館 Sports（5 sublayer，opacity + scale；大小另由 area_sqm log 內插驅動）
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
      // ── ENERGY MVP ──
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
      // ── Phase 8 SSOT 6-layer ──
      case "facPrimary": return [
        { label: `總大小 ${facPrimaryScale.toFixed(1)}`, value: facPrimaryScale, min: 0.3, max: 3, step: 0.1, onChange: setFacPrimaryScale },
        { label: `大廠（即時）${facPrimaryRtScale.toFixed(2)}`, value: facPrimaryRtScale, min: 0.2, max: 3, step: 0.05, onChange: setFacPrimaryRtScale },
        { label: `其他廠 ${facPrimaryNoRtScale.toFixed(2)}`, value: facPrimaryNoRtScale, min: 0.1, max: 2, step: 0.05, onChange: setFacPrimaryNoRtScale },
        { label: `透明度 ${facPrimaryOpacity.toFixed(2)}`, value: facPrimaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacPrimaryOpacity },
      ];
      // ── 化石燃料 14 layer（Phase B） ──
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
      // ── 雲林 POC 覆蓋分析 ──
      case "powerPoles": return [
        { label: `全台顯示 ${powerPolesZ5Reveal === 0 ? "關" : powerPolesZ5Reveal.toFixed(2)}`, value: powerPolesZ5Reveal, min: 0, max: 1, step: 0.1, onChange: setPowerPolesZ5Reveal },
        { label: `熱區 ${powerPolesHeat === 0 ? "關" : powerPolesHeat.toFixed(2)}`, value: powerPolesHeat, min: 0, max: 1, step: 0.05, onChange: setPowerPolesHeat },
        { label: `大小 ${powerPolesSize.toFixed(1)}`, value: powerPolesSize, min: 0.3, max: 3, step: 0.1, onChange: setPowerPolesSize },
        { label: `透明度 ${powerPolesOpacity.toFixed(2)}`, value: powerPolesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerPolesOpacity },
      ];
      // ── HAZARD ──
      case "lightningCwa": return [
        { label: `保留 ${lightningCwaMinutes} min`, value: lightningCwaMinutes, min: 5, max: 360, step: 5, onChange: setLightningCwaMinutes },
        { label: `透明度 ${lightningCwaOpacity.toFixed(2)}`, value: lightningCwaOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLightningCwaOpacity },
      ];
      case "lightning": return [
        { label: `保留 ${lightningMinutes} min`, value: lightningMinutes, min: 5, max: 360, step: 5, onChange: setLightningMinutes },
        { label: `透明度 ${lightningOpacity.toFixed(2)}`, value: lightningOpacity, min: 0.1, max: 1, step: 0.05, onChange: setLightningOpacity },
      ];
      case "mountainRescueIncidents": return [
        // 7 個選項（全部 + 6 年）> 3 → 自動走原生 select（四鐵則 #4）
        { type: "select" as const, label: "年份", value: mountainRescueIncidentsYear, options: [{ label: "全部", value: "all" }, ...MOUNTAIN_RESCUE_YEARS.map((y) => ({ label: String(y), value: String(y) }))], onChange: setMountainRescueIncidentsYear },
        { label: `透明度 ${mountainRescueIncidentsOpacity.toFixed(2)}`, value: mountainRescueIncidentsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setMountainRescueIncidentsOpacity },
        { label: `大小 ${mountainRescueIncidentsScale.toFixed(2)}`, value: mountainRescueIncidentsScale, min: 0.3, max: 3, step: 0.1, onChange: setMountainRescueIncidentsScale },
      ];
      // ── Base map（6 layer：3 boundary + 2 contour + 1 road）──
      case "osmRoadDrive": return [
        { label: `全台顯示 ${osmRoadDriveZ5Reveal === 0 ? "關" : osmRoadDriveZ5Reveal.toFixed(2)}`, value: osmRoadDriveZ5Reveal, min: 0, max: 1, step: 0.1, onChange: setOsmRoadDriveZ5Reveal },
        { label: `寬度 ${osmRoadDriveWidth.toFixed(1)}`, value: osmRoadDriveWidth, min: 0.3, max: 4, step: 0.1, onChange: setOsmRoadDriveWidth },
        { label: `透明度 ${osmRoadDriveOpacity.toFixed(2)}`, value: osmRoadDriveOpacity, min: 0.1, max: 1, step: 0.05, onChange: setOsmRoadDriveOpacity },
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
      // 🧳 觀光 Tourism 12 層
      case "tourAttractions": return [
        { type: "select" as const, label: "著色模式", value: tourAttractionsMode, options: [{ label: "分類", value: "category" }, { label: "熱度", value: "heat" }], onChange: setTourAttractionsMode },
        { label: `透明度 ${tourAttractionsOpacity.toFixed(2)}`, value: tourAttractionsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourAttractionsOpacity },
        { label: `大小 ${tourAttractionsScale.toFixed(1)}`, value: tourAttractionsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourAttractionsScale },
      ];
      // 🛕 宗教 6 層 ＋ ⚰️ 殯葬 5 層的 case 已遷出（AR-22 P3-1 試點）——
      //    上方的 buildParamControls 分岔會在進到 switch 之前就接手。
      case "tourEvents": return [
        { type: "select" as const, label: "狀態", value: tourEventsStatus, options: [{ label: "全部", value: "all" }, { label: "進行中", value: "ongoing" }, { label: "未開始", value: "upcoming" }], onChange: setTourEventsStatus },
        { label: `透明度 ${tourEventsOpacity.toFixed(2)}`, value: tourEventsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourEventsOpacity },
        { label: `大小 ${tourEventsScale.toFixed(1)}`, value: tourEventsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourEventsScale },
      ];
      case "tourHotels": return [
        { type: "select" as const, label: "類別", value: tourHotelsClass, options: [{ label: "全部", value: "all" }, { label: "國際觀光旅館", value: "1" }, { label: "一般觀光旅館", value: "2" }, { label: "旅館", value: "3" }, { label: "民宿", value: "4" }], onChange: setTourHotelsClass },
        { label: `透明度 ${tourHotelsOpacity.toFixed(2)}`, value: tourHotelsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setTourHotelsOpacity },
        { label: `大小 ${tourHotelsScale.toFixed(1)}`, value: tourHotelsScale, min: 0.3, max: 3, step: 0.1, onChange: setTourHotelsScale },
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
      case "nonUrbanZoning": return [
        // 12 個選項（全部 + 11 碼）> 3 → 自動走原生 select（四鐵則 #4）
        { type: "select" as const, label: "分區", value: nonUrbanZoningCode, options: [{ label: "全部", value: "all" }, ...NON_URBAN_ZONING_CODES.map((c) => ({ label: c.label, value: c.code }))], onChange: setNonUrbanZoningCode },
        { label: `填色透明度 ${nonUrbanZoningOpacity.toFixed(2)}`, value: nonUrbanZoningOpacity, min: 0, max: 1, step: 0.05, onChange: setNonUrbanZoningOpacity },
      ];
      case "urbanZoningNewTaipei": return [
        { type: "select" as const, label: "分區", value: urbanZoningNewTaipeiCategory, options: [{ label: "全部", value: "all" }, ...URBAN_ZONING_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))], onChange: setUrbanZoningNewTaipeiCategory },
        { label: `填色透明度 ${urbanZoningNewTaipeiOpacity.toFixed(2)}`, value: urbanZoningNewTaipeiOpacity, min: 0, max: 1, step: 0.05, onChange: setUrbanZoningNewTaipeiOpacity },
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
    plaOpacity,
    plaShowReview,
    plaTrailDays,
    plaReplay,
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
