import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ExpandableLayerKey, BusCity, BusColorMode, BusGroup } from "../types";
import { layerParamsStore, encodeParamsToOverlay } from "../state/layerParamsStore";
import { buildParamControls } from "../state/layerParamsControls";
import { BUS_GROUP_CITIES, BUS_GROUP_LABELS, WASTE_GROUP_CITIES } from "../types";
import {
  FACILITY_MEDIA, PENALTY_MEDIA, POLLUTION_MEDIUM_LABELS, SEVERITY_BANDS,
  pollutionYearOptions, PENALTY_MODE_OPTIONS, PENALTY_YEAR_MIN, PENALTY_YEAR_MAX,
  type PollutionMedium,
} from "../data/pollutionTypes";
import { MICRO_SENSOR_MODES } from "../data/microSensorTypes";
// religionTypes / funeralTypes / buildingsGbaTypes / propertyValueTypes 等
// select 選項常數已隨對應的 key 遷出本檔（現由 src/data/layerParamsSpec.ts 引用）。

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
  // Waste（垃圾車光點 + 音符）
  const [wasteOrbScale, setWasteOrbScale] = useState(0.15);
  const [wasteNoteSize, setWasteNoteSize] = useState(0.7);
  const [wasteNoteZOffset, setWasteNoteZOffset] = useState(70);
  // AQI 色階圖透明度
  const [aqiImageryOpacity, setAqiImageryOpacity] = useState(0.7);




  // Base map（行政邊界 + 等高線 + OSM 路網）
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
    // 警察覆蓋分析（數字化 mode/minutes 餵 paint expression）
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
    // ENERGY
    // 雲林 POC 覆蓋分析
    // HAZARD
    // LASS 微感測顯示模式（只供 LegendPanel 選對應圖例；paint 端走 hook 的 setPaintProperty）
    aqiMicroModeIdx,
    // Base map
    hillshadeOpacity,
    slopeVectorOpacity, aspectVectorOpacity,
    // ── 雙軌：已遷移進 layerParamsStore 的 key（規格派生，含 select 的 Idx 編碼）──
    //    刻意放在最末 spread：遷移途中若某 key 的手寫字面尚未刪除，以規格派生為準。
    ...migratedOverlayParams,
  }), [migratedOverlayParams, hillshadeOpacity, slopeVectorOpacity, aspectVectorOpacity, stationScale, airportOpacity, airportGlow, lighthouseScale, fireStationsScale, fireStationsOpacity, fireStationsZ, fireStationsDots, portGlow, newsScale, metroPillarVisible,
    
    
    
    
    
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
      // ── Base map（6 layer：3 boundary + 2 contour + 1 road）──
      case "hillshade": return [
        { label: `透明度 ${hillshadeOpacity.toFixed(2)}`, value: hillshadeOpacity, min: 0.1, max: 1, step: 0.05, onChange: setHillshadeOpacity },
      ];
      case "slopeVector": return [
        { label: `透明度 ${slopeVectorOpacity.toFixed(2)}`, value: slopeVectorOpacity, min: 0.3, max: 1, step: 0.05, onChange: setSlopeVectorOpacity },
      ];
      case "aspectVector": return [
        { label: `透明度 ${aspectVectorOpacity.toFixed(2)}`, value: aspectVectorOpacity, min: 0.3, max: 1, step: 0.05, onChange: setAspectVectorOpacity },
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
