import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ExpandableLayerKey, BusCity, BusColorMode, BusGroup } from "../types";
import { layerParamsStore, encodeParamsToOverlay } from "../state/layerParamsStore";
import { buildParamControls } from "../state/layerParamsControls";
import { BUS_GROUP_CITIES, BUS_GROUP_LABELS, WASTE_GROUP_CITIES } from "../types";
import { CROP_SUITABILITY_CROPS } from "../data/cropSuitabilityCrops";
import { FARM_HIGHLIGHT_OPTIONS } from "../data/livestockTypes";
import {
  FACILITY_MEDIA, PENALTY_MEDIA, POLLUTION_MEDIUM_LABELS, SEVERITY_BANDS,
  pollutionYearOptions, PENALTY_MODE_OPTIONS, PENALTY_YEAR_MIN, PENALTY_YEAR_MAX,
  type PollutionMedium,
} from "../data/pollutionTypes";
import { BUILDINGS_GBA_MODES } from "../data/buildingsGbaTypes";
import { MICRO_SENSOR_MODES } from "../data/microSensorTypes";
import { PROPERTY_VALUE_SCALES, PROPERTY_VALUE_GRID_MODES } from "../data/propertyValueTypes";
// religionTypes / funeralTypes 的 select 選項常數已隨 11 個試點 key 遷出本檔
// （現由 src/data/layerParamsSpec.ts 引用）。

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
  // 消防分隊（靜態點）
  const [fireStationsScale, setFireStationsScale] = useState(1);
  const [fireStationsOpacity, setFireStationsOpacity] = useState(0.85);
  const [fireStationsZ, setFireStationsZ] = useState(0);
  // 消防分隊兩種呈現各自開關：散點 (Mapbox circle) / 3D 光柱+漣漪 (Three.js)
  const [fireStationsDots, setFireStationsDots] = useState(true);
  const [fireStations3D, setFireStations3D] = useState(true);
  // ── 警政司法民防 17 layer（每個 opacity + scale；polygon/line 走 fill/line-width）──
  // display_class 三組類別篩選 checkbox：確認 / 漁電共生 / 其他（unverified+ambiguous+mountain_suspect）。預設全開。
  // union_class 三組類別篩選 checkbox：兩版都有 / 只官方 MOA / 只舊版 OSM。預設全開。
  // 都市開放空間三層（受保護樹木 / 河濱喬木 / 台北公園）
  // 🎭 文化 Culture 四層
  // 🧳 觀光 Tourism 12 層（點層 opacity 0.85 + scale 1；面層 opacity 0.5；select 存字串，overlayParams 轉 Idx）
  // 🛕 宗教 Religion 6 層 ＋ ⚰️ 殯葬 Funeral 5 層：**已遷出本檔**（AR-22 P3-1 試點）
  //    值 → src/state/layerParamsStore.ts；控件規格（含 "active" 這類非 "all" 的預設、
  //    select 的 encode 順序）→ src/data/layerParamsSpec.ts。
  // 行道樹三時點（traj 7 類/樹種/胸徑/樹高四染色模式 + 軌跡篩選）
  // 行道樹全國（樹種/胸徑/樹高/城市四染色模式 + 城市篩選）
  // 台北人行道樹穴（pit_type 樹穴/花圃二色 fill + 類型篩選）
  // GBA 全台建物輪廓（0=高度分級 1=資料來源 2=3D 立體 3=夜景燈光 4=估值；高度門檻篩選 + 透明度）
  const [buildingsGbaModeIdx, setBuildingsGbaModeIdx] = useState(0);
  const [buildingsGbaMinHeight, setBuildingsGbaMinHeight] = useState(0);
  const [buildingsGbaOpacity, setBuildingsGbaOpacity] = useState(0.75);
  // 夜景燈光 mode 3 專用：≥N m 高樓額外給 Three.js additive bloom 光暈（視野內取最高前 4096 棟）
  const [buildingsGbaBloomMinHeight, setBuildingsGbaBloomMinHeight] = useState(100);
  // 都市紋理網格（0-5：棟數/平均高度/總量體/建蔽率/樹冠覆蓋/灰綠指數；預設 5=灰綠指數）
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
  // 非都市分區：面積大 → 預設透明度 0.35（都計分區是 0.5）；篩選走 zone_code 11 碼
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
  // 學區面：國小／國中兩層的面完全疊合，共用一支 slider（分開調會互相遮蓋難以對齊）；
  // 高中就學區是覆蓋全台的縣市級大面，預設更透明。
  // 幼托三層（幼兒園／課後照顧／互助教保）密度相近且常疊看，共用一組 slider；
  // 補習班 17,137 點密度高一階，獨立一組（預設更透明），見 overlayRegistry 的 eduCramSchool*。
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
  // 淹水最小深度篩選：0 = 全部, 0.5 / 1 / 2 / 3 = 只顯示大於等於該深度的分級
  const [floodMinDepth, setFloodMinDepth] = useState<0 | 0.5 | 1 | 2 | 3>(0);
  // 其他水資源圖層參數
  const [waterFloodOpacity, setWaterFloodOpacity] = useState(1.0);
  // Phase 2 monitoring layers（即時雨量 / 河川水位 / 地下水井 / 水井點位）
  // 北市水利處三本柱
  const [precipRasterOpacity, setPrecipRasterOpacity] = useState(0.6);
  const [precipRasterHours, setPrecipRasterHours] = useState<1 | 3 | 6 | 24>(24);
  // Waste（垃圾車光點 + 音符）
  const [wasteOrbScale, setWasteOrbScale] = useState(0.15);
  const [wasteNoteSize, setWasteNoteSize] = useState(0.7);
  const [wasteNoteZOffset, setWasteNoteZOffset] = useState(70);
  // AQI 色階圖透明度
  const [aqiImageryOpacity, setAqiImageryOpacity] = useState(0.7);
  // Agriculture Phase 3 Batch 1 (5 PMTiles + 1 GeoJSON POI)
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
  // Base map（行政邊界 + 等高線 + OSM 路網）
  const [osmRoadDriveOpacity, setOsmRoadDriveOpacity] = useState(0.85);
  const [osmRoadDriveWidth, setOsmRoadDriveWidth] = useState(1.0);
  const [osmRoadDriveZ5Reveal, setOsmRoadDriveZ5Reveal] = useState(0); // 0=z<8 隱形（預設），1=全 zoom 顯示
  const [hillshadeOpacity, setHillshadeOpacity] = useState(0.5);
  // 坡度/坡向分級向量（PMTiles polygon，可點選/疊圖分析）
  const [slopeVectorOpacity, setSlopeVectorOpacity] = useState(0.6);
  const [aspectVectorOpacity, setAspectVectorOpacity] = useState(0.6);
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
    buildingsGbaModeIdx, buildingsGbaMinHeight, buildingsGbaOpacity, buildingsGbaBloomMinHeight,
    propertyValueGridScaleIdx, propertyValueGridModeIdx,
    propertyValueGridOpacity, propertyValueGridContrast, propertyValueGridElevationScale,
    propertyValueGridExtruded: propertyValueGridExtruded ? 1 : 0,
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
    lighthouseScale,
    fireStationsScale,
    fireStationsOpacity,
    fireStationsZ,
    fireStationsDots: fireStationsDots ? 1 : 0,
    portGlow,
    newsScale,
    metroPillar3d: metroPillarVisible ? 1 : 0,
    floodMinDepth,
    waterFloodOpacity,
    precipRasterOpacity,
    precipRasterHours,
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
    // ENERGY
    facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale,
    // 雲林 POC 覆蓋分析
    powerPolesOpacity,
    powerPolesSize,
    powerPolesHeat,
    powerPolesZ5Reveal,
    // HAZARD
    // LASS 微感測顯示模式（只供 LegendPanel 選對應圖例；paint 端走 hook 的 setPaintProperty）
    aqiMicroModeIdx,
    // Base map
    osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal,
    hillshadeOpacity,
    slopeVectorOpacity, aspectVectorOpacity,
    // ── 雙軌：已遷移進 layerParamsStore 的 key（規格派生，含 select 的 Idx 編碼）──
    //    刻意放在最末 spread：遷移途中若某 key 的手寫字面尚未刪除，以規格派生為準。
    ...migratedOverlayParams,
  }), [migratedOverlayParams, osmRoadDriveOpacity, osmRoadDriveWidth, osmRoadDriveZ5Reveal, hillshadeOpacity, slopeVectorOpacity, aspectVectorOpacity, stationScale, airportOpacity, airportGlow, lighthouseScale, fireStationsScale, fireStationsOpacity, fireStationsZ, fireStationsDots, portGlow, newsScale, metroPillarVisible, floodMinDepth, waterFloodOpacity, precipRasterOpacity, precipRasterHours, agriCropSuitabilityOpacity, agriCropSuitabilityCropId, livestockFarmPigOpacity, livestockFarmPigScale, livestockFarmChickenOpacity, livestockFarmChickenScale, livestockFarmCattleOpacity, livestockFarmCattleScale, livestockFarmDuckOpacity, livestockFarmDuckScale, livestockFarmGooseOpacity, livestockFarmGooseScale, livestockFarmSheepOpacity, livestockFarmSheepScale, livestockFarmOtherOpacity, livestockFarmOtherScale, livestockFarmPigHighlightIdx, livestockFarmChickenHighlightIdx, livestockFarmCattleHighlightIdx, livestockFarmDuckHighlightIdx, livestockFarmGooseHighlightIdx, livestockFarmSheepHighlightIdx, livestockFarmOtherHighlightIdx, powerPolesOpacity, powerPolesSize, powerPolesHeat, powerPolesZ5Reveal, facPrimaryOpacity, facPrimaryScale, facPrimaryRtScale, facPrimaryNoRtScale,
    buildingsGbaModeIdx, buildingsGbaMinHeight, buildingsGbaOpacity, buildingsGbaBloomMinHeight,
    propertyValueGridScaleIdx, propertyValueGridModeIdx, propertyValueGridOpacity, propertyValueGridContrast, propertyValueGridExtruded, propertyValueGridElevationScale,
    
    
    
    
    
    policeIsoSubstationOpacity, policeIsoSubstationMode, policeIsoSubstationMinutes,
    policeIsoPrecinctOpacity, policeIsoPrecinctMode, policeIsoPrecinctMinutes,
    policeIsoCityDeptOpacity, policeIsoCityDeptMode, policeIsoCityDeptMinutes,
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    pollutionSiteOpacity, pollutionSiteScale,
    
    aqiMicroModeIdx,]);

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
      case "fireStations": return [
        { type: "toggle" as const, label: "散點", value: fireStationsDots, onChange: setFireStationsDots },
        { type: "toggle" as const, label: "3D 光柱波動", value: fireStations3D, onChange: setFireStations3D },
        { label: `大小 ${fireStationsScale.toFixed(1)}`, value: fireStationsScale, min: 0.3, max: 3, step: 0.1, onChange: setFireStationsScale },
        { label: `透明度 ${fireStationsOpacity.toFixed(2)}`, value: fireStationsOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFireStationsOpacity },
        { label: `Z 漂浮 ${fireStationsZ.toFixed(0)}px`, value: fireStationsZ, min: 0, max: 100, step: 2, onChange: setFireStationsZ },
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
      case "windPlan": return [];
      // 🎓 教育 Education — 6 個點層共用 eduSchoolsOpacity / schoolScale（同一份 schools.geojson）
      // 只有總覽層 schools 額外給「分級配色」開關；5 個分級層與偏遠層本來就固定分色。
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
      // ── Phase 8 SSOT 6-layer ──
      case "facPrimary": return [
        { label: `總大小 ${facPrimaryScale.toFixed(1)}`, value: facPrimaryScale, min: 0.3, max: 3, step: 0.1, onChange: setFacPrimaryScale },
        { label: `大廠（即時）${facPrimaryRtScale.toFixed(2)}`, value: facPrimaryRtScale, min: 0.2, max: 3, step: 0.05, onChange: setFacPrimaryRtScale },
        { label: `其他廠 ${facPrimaryNoRtScale.toFixed(2)}`, value: facPrimaryNoRtScale, min: 0.1, max: 2, step: 0.05, onChange: setFacPrimaryNoRtScale },
        { label: `透明度 ${facPrimaryOpacity.toFixed(2)}`, value: facPrimaryOpacity, min: 0.1, max: 1, step: 0.05, onChange: setFacPrimaryOpacity },
      ];
      // ── 化石燃料 14 layer（Phase B） ──
      // ── 雲林 POC 覆蓋分析 ──
      case "powerPoles": return [
        { label: `全台顯示 ${powerPolesZ5Reveal === 0 ? "關" : powerPolesZ5Reveal.toFixed(2)}`, value: powerPolesZ5Reveal, min: 0, max: 1, step: 0.1, onChange: setPowerPolesZ5Reveal },
        { label: `熱區 ${powerPolesHeat === 0 ? "關" : powerPolesHeat.toFixed(2)}`, value: powerPolesHeat, min: 0, max: 1, step: 0.05, onChange: setPowerPolesHeat },
        { label: `大小 ${powerPolesSize.toFixed(1)}`, value: powerPolesSize, min: 0.3, max: 3, step: 0.1, onChange: setPowerPolesSize },
        { label: `透明度 ${powerPolesOpacity.toFixed(2)}`, value: powerPolesOpacity, min: 0.1, max: 1, step: 0.05, onChange: setPowerPolesOpacity },
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
      // ── 警政司法民防 17 layer ──
      // 🧳 觀光 Tourism 12 層
      // 🛕 宗教 6 層 ＋ ⚰️ 殯葬 5 層的 case 已遷出（AR-22 P3-1 試點）——
      //    上方的 buildParamControls 分岔會在進到 switch 之前就接手。
      case "buildingsGba": return [
        { type: "select" as const, label: "顯示模式", value: String(buildingsGbaModeIdx), options: [...BUILDINGS_GBA_MODES], onChange: (v: string) => setBuildingsGbaModeIdx(parseInt(v, 10)) },
        { label: `高度門檻 ≥ ${buildingsGbaMinHeight} m`, value: buildingsGbaMinHeight, min: 0, max: 100, step: 5, onChange: setBuildingsGbaMinHeight },
        { label: `透明度 ${buildingsGbaOpacity.toFixed(2)}`, value: buildingsGbaOpacity, min: 0, max: 1, step: 0.05, onChange: setBuildingsGbaOpacity },
        ...(buildingsGbaModeIdx === 3
          ? [{ label: `Bloom 高樓門檻 ≥ ${buildingsGbaBloomMinHeight} m`, value: buildingsGbaBloomMinHeight, min: 40, max: 200, step: 10, onChange: setBuildingsGbaBloomMinHeight }]
          : []),
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
