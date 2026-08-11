import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ExpandableLayerKey, BusCity, BusGroup } from "../types";
import {
  layerParamsStore, encodeParamsToOverlay, type LayerParamsSnapshot,
} from "../state/layerParamsStore";
import { BUS_GROUP_ORDER, paramDefault } from "../data/layerParamsSpec";
import { buildParamControls } from "../state/layerParamsControls";
import { BUS_GROUP_CITIES, BUS_GROUP_LABELS, WASTE_GROUP_CITIES } from "../types";
import {
  FACILITY_MEDIA, PENALTY_MEDIA, POLLUTION_MEDIUM_LABELS, SEVERITY_BANDS,
  pollutionYearOptions, PENALTY_MODE_OPTIONS, PENALTY_YEAR_MIN, PENALTY_YEAR_MAX,
  type PollutionMedium,
} from "../data/pollutionTypes";
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

// ══════════════════════════════════════════════════════════════════
//  第二輸出通道的讀取器（AR-22 P3-2D）
// ══════════════════════════════════════════════════════════════════
//
//  D 桶的參數搬進 `layerParamsStore` 之後，值仍必須回到本 hook 的 `return {}`
//  —— 消費端（App.tsx、各 layer hook、Three.js scene）的介面**一字未動**，
//  它們完全不知道底下換了軌。下面三支就是「store 快照 → 原本那個回傳欄位」的橋。
//
//  ⚠️ 查無值時退回規格 `default`：正常路徑上不會發生（store 的 slot 就是規格宣告的），
//  但這條路徑在 render 期間，throw 等於整頁白畫面 —— 回退比炸掉安全，
//  而「值真的有流過來」由 `__tests__/useTransportParamsReturn.test.ts` 的
//  逐參數隔離擾動直接驗（回退兜底不會讓那道閘變綠：它比的是擾動後的值）。

/** slider ／ 數值型 select（store 存字串、消費端要數字，等價手寫版 onChange 的 `Number(v)`） */
function pNum(all: LayerParamsSnapshot, key: string, name: string): number {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "number" ? v : Number(v);
}

/** toggle */
function pBool(all: LayerParamsSnapshot, key: string, name: string): boolean {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "boolean" ? v : Boolean(v);
}

/** select（字串原值；要窄化成字面聯集時在呼叫端比對，不做無憑據的 `as`） */
function pStr(all: LayerParamsSnapshot, key: string, name: string): string {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "string" ? v : String(v);
}

/** 規格宣告的預設值（**不看 store**）—— 鏡像 ref 的 initial 專用，見下方說明 */
function dNum(key: string, name: string): number {
  const v = paramDefault(key, name);
  return typeof v === "number" ? v : Number(v);
}
function dBool(key: string, name: string): boolean {
  return paramDefault(key, name) === true;
}

/** 從允許清單窄化字串（不在清單內回 fallback）—— 不做無憑據的 `as` */
function oneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
/** 同上，數值版（新聞三軸的 `0 | 2 | 3` 這種字面聯集） */
function oneOfNum<T extends number>(v: number, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly number[]).includes(v) ? (v as T) : fallback;
}

const RAIL_TRACK_MODES = ["2d", "3d"] as const;
const BUS_COLOR_MODES = ["route", "speed", "density"] as const;
const NEWS_RELEVANCE_LEVELS = [0, 2, 3] as const;
const NEWS_SEVERITY_LEVELS = [0, 1, 2] as const;

// ── 鏡像 ref（Three.js render loop 逐幀讀 `.current`，不走 React 樹）─────
//
// ⚠️ **initial 吃規格常數、current 吃 store 現值** —— 兩者刻意不同源。
// initial 若也讀 store，等值閘（每次 capture 都是全新 mount）就再也驗不出
// 「同步賦值那一行被刪掉」：mount 當下 `useRef(現值)` 已經是對的。
// 這條慣例是 ref 通道有閘可守的前提，改動前先看
// `__tests__/useTransportParamsReturn.test.ts` 的盲區說明。

function useParamRefNum(all: LayerParamsSnapshot, key: string, name: string) {
  const ref = useRef(dNum(key, name));
  ref.current = pNum(all, key, name);
  return ref;
}
function useParamRefBool(all: LayerParamsSnapshot, key: string, name: string) {
  const ref = useRef(dBool(key, name));
  ref.current = pBool(all, key, name);
  return ref;
}
function useParamRefEnum<T extends string>(
  all: LayerParamsSnapshot, key: string, name: string,
  allowed: readonly T[], fallback: T,
) {
  const ref = useRef(oneOf(String(paramDefault(key, name) ?? fallback), allowed, fallback));
  ref.current = oneOf(pStr(all, key, name), allowed, fallback);
  return ref;
}

export function useTransportParams() {
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
  // School（🎓 教育 Education 第 38 主題）
  // schoolScale / schoolLevelColor 是原公共設施 schools 層的既有 param，
  // 搬入教育主題後 schoolScale 擴大為 6 個點層共用；schoolLevelColor 仍只作用於總覽層。
  // 學區面：國小／國中兩層的面完全疊合，共用一支 slider（分開調會互相遮蓋難以對齊）；
  // 高中就學區是覆蓋全台的縣市級大面，預設更透明。
  // 幼托三層（幼兒園／課後照顧／互助教保）密度相近且常疊看，共用一組 slider；
  // 補習班 17,137 點密度高一階，獨立一組（預設更透明），見 overlayRegistry 的 eduCramSchool*。
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
  // YouBike Fullness (H3)
  const [ybOpacity, setYbOpacity] = useState(0.65);
  const [ybContrast, setYbContrast] = useState(1);
  const [ybExtruded, setYbExtruded] = useState(true);
  const [ybElevationScale, setYbElevationScale] = useState(80);
  const [ybHeightMode, setYbHeightMode] = useState<"mixed" | "fullness" | "capacity">("mixed");
  const [ybResolution, setYbResolution] = useState(7);
  // Waste（垃圾車光點 + 音符）
  const [wasteOrbScale, setWasteOrbScale] = useState(0.15);
  const [wasteNoteSize, setWasteNoteSize] = useState(0.7);
  const [wasteNoteZOffset, setWasteNoteZOffset] = useState(70);




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

  // ── 群3 尚未遷移的鏡像 ref（廢棄物；仍由本檔 useState 供值）──────────
  const wasteOrbScaleRef = useRef(wasteOrbScale);
  const wasteNoteSizeRef = useRef(wasteNoteSize);
  const wasteNoteZOffsetRef = useRef(wasteNoteZOffset);
  wasteOrbScaleRef.current = wasteOrbScale;
  wasteNoteSizeRef.current = wasteNoteSize;
  wasteNoteZOffsetRef.current = wasteNoteZOffset;

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

  // ── 第二通道：已遷移參數 → 本 hook 的 return {}（P3-2D 群1）────────
  //    只是把值從 store 快照讀出來、原樣塞回原本那個回傳欄位；
  //    回傳 API 與消費端一字未動。逐條的等值證明見 RETURN_CHANNEL。
  const daOpacity = pNum(migratedParams, "lifelineAlerts", "daOpacity");
  const satOpacity = pNum(migratedParams, "satellitesYaogan", "satOpacity");
  const eqOpacity = pNum(migratedParams, "earthquakes", "eqOpacity");
  // 控件是 select（timeline / history），回傳仍是原本的 boolean
  const eqShowHistory = pStr(migratedParams, "earthquakes", "eqMode") === "history";
  const eqReplayOpacity = pNum(migratedParams, "earthquakeReplay", "eqReplayOpacity");
  const reOpacity = pNum(migratedParams, "roadEvents", "reOpacity");
  const plaTrailDays = pNum(migratedParams, "plaActivity", "plaTrailDays");
  const plaReplay = pBool(migratedParams, "plaActivity", "plaReplay");
  const plaOpacity = pNum(migratedParams, "plaActivity", "plaOpacity");
  const plaShowReview = pBool(migratedParams, "plaActivity", "plaShowReview");
  const cwaCloudOpacity = pNum(migratedParams, "cwaCloudImagery", "cwaCloudOpacity");
  const cwaRadarOpacity = pNum(migratedParams, "cwaRadarImagery", "cwaRadarOpacity");
  const aqiImageryOpacity = pNum(migratedParams, "aqiImagery", "aqiImageryOpacity");
  const aqiMicroModeIdx = pNum(migratedParams, "aqiMicroSensors", "aqiMicroModeIdx");
  const aqiMicroCluster = pBool(migratedParams, "aqiMicroSensors", "aqiMicroCluster");
  const hillshadeOpacity = pNum(migratedParams, "hillshade", "hillshadeOpacity");
  const slopeVectorOpacity = pNum(migratedParams, "slopeVector", "slopeVectorOpacity");
  const aspectVectorOpacity = pNum(migratedParams, "aspectVector", "aspectVectorOpacity");
  const tempGridOpacity = pNum(migratedParams, "temperatureGrid", "tempGridOpacity");
  const pollutionSiteActiveOnly = pBool(migratedParams, "pollutionSite", "pollutionSiteActiveOnly");

  // ── 第二通道：已遷移參數 → refs.current（P3-2D 群2）────────────────
  //    Three.js / CustomLayer 的 render loop 逐幀讀 `.current`，不走 React 樹。
  //    ⚠️ `useParamRef*` 的 initial 吃**規格常數**、current 吃 store 現值 ——
  //    兩者刻意不同源：initial 若也讀 store，「刪掉同步賦值」這個突變在測試
  //    （每次 capture 都是全新 mount）裡會驗不出來。見等值閘的盲區說明。
  const altExagRef = useParamRefNum(migratedParams, "flights", "altExaggeration");
  const altOffsetRef = useParamRefNum(migratedParams, "flights", "altOffset");
  const staticOpacityRef = useParamRefNum(migratedParams, "flights", "staticOpacity");
  const orbScaleRef = useParamRefNum(migratedParams, "flights", "orbScale");
  const shipOrbScaleRef = useParamRefNum(migratedParams, "ships", "shipOrbScale");
  const shipTrailOpacityRef = useParamRefNum(migratedParams, "ships", "shipTrailOpacity");
  const railAltOffsetRef = useParamRefNum(migratedParams, "rail", "railAltOffset");
  const railOrbScaleRef = useParamRefNum(migratedParams, "rail", "railOrbScale");
  const railTrackOpacityRef = useParamRefNum(migratedParams, "rail", "railTrackOpacity");
  const railTrainVisibleRef = useParamRefBool(migratedParams, "rail", "railTrainVisible");
  const railTrackModeRef = useParamRefEnum(migratedParams, "rail", "railTrackMode", RAIL_TRACK_MODES, "3d");
  const beamVisibleRef = useParamRefBool(migratedParams, "lighthouses", "beamVisible");
  const beamDistanceRef = useParamRefNum(migratedParams, "lighthouses", "beamDistance");
  const beamOpacityRef = useParamRefNum(migratedParams, "lighthouses", "beamOpacity");
  const thsrPillarVisibleRef = useParamRefBool(migratedParams, "stationsTHSR", "thsrPillarVisible");
  const thsrPillarHeightRef = useParamRefNum(migratedParams, "stationsTHSR", "thsrPillarHeight");
  const traPillarVisibleRef = useParamRefBool(migratedParams, "stationsTRA", "traPillarVisible");
  const traPillarHeightRef = useParamRefNum(migratedParams, "stationsTRA", "traPillarHeight");
  const metroPillarVisibleRef = useParamRefBool(migratedParams, "stationsMetro", "metroPillarVisible");
  const metroPillarHeightRef = useParamRefNum(migratedParams, "stationsMetro", "metroPillarHeight");
  const portPillarVisibleRef = useParamRefBool(migratedParams, "ports", "portPillarVisible");
  const portPillarHeightRef = useParamRefNum(migratedParams, "ports", "portPillarHeight");
  const airportPillarVisibleRef = useParamRefBool(migratedParams, "airports", "airportPillarVisible");
  const airportPillarHeightRef = useParamRefNum(migratedParams, "airports", "airportPillarHeight");
  const busOrbScaleRef = useParamRefNum(migratedParams, "busLive", "busOrbScale");
  const busAltOffsetRef = useParamRefNum(migratedParams, "busLive", "busAltOffset");
  const busColorModeRef = useParamRefEnum(migratedParams, "busLive", "busColorMode", BUS_COLOR_MODES, "route");
  const busIntercityOrbScaleRef = useParamRefNum(migratedParams, "busIntercityLive", "busIntercityOrbScale");
  const busIntercityAltOffsetRef = useParamRefNum(migratedParams, "busIntercityLive", "busIntercityAltOffset");
  const busIntercityColorModeRef = useParamRefEnum(migratedParams, "busIntercityLive", "busIntercityColorMode", BUS_COLOR_MODES, "route");
  const touristShuttleOrbScaleRef = useParamRefNum(migratedParams, "touristShuttleLive", "touristShuttleOrbScale");
  const touristShuttleAltOffsetRef = useParamRefNum(migratedParams, "touristShuttleLive", "touristShuttleAltOffset");
  const touristShuttleOpacityRef = useParamRefNum(migratedParams, "touristShuttleLive", "touristShuttleOpacity");
  const touristShuttleColorModeRef = useParamRefEnum(migratedParams, "touristShuttleLive", "touristShuttleColorMode", BUS_COLOR_MODES, "route");
  const fireStationsScaleRef = useParamRefNum(migratedParams, "fireStations", "fireStationsScale");
  const fireStationsOpacityRef = useParamRefNum(migratedParams, "fireStations", "fireStationsOpacity");
  const fireStations3DRef = useParamRefBool(migratedParams, "fireStations", "fireStations3D");
  const tempHeightRef = useParamRefNum(migratedParams, "temperatureWave", "tempHeight");
  const tempZOffsetRef = useParamRefNum(migratedParams, "temperatureWave", "tempZOffset");
  const tempExtrudedRef = useParamRefBool(migratedParams, "temperatureWave", "tempExtruded");
  const tempOpacityRef = useParamRefNum(migratedParams, "temperatureWave", "tempOpacity");
  const tempWireframeRef = useParamRefBool(migratedParams, "temperatureWave", "tempWireframe");

  // ── 第二通道：群2 裡另外還要回傳純值的三處 ───────────────────────
  const stationScale = pNum(migratedParams, "stationsTHSR", "stationScale");
  const railTrackMode = oneOf(pStr(migratedParams, "rail", "railTrackMode"), RAIL_TRACK_MODES, "3d");
  const newsTimeBased = pBool(migratedParams, "newsEvents", "newsTimeBased");
  const newsRipple = pBool(migratedParams, "newsEvents", "newsRipple");
  const newsMinRelevance = oneOfNum(
    pNum(migratedParams, "newsEvents", "newsMinRelevance"), NEWS_RELEVANCE_LEVELS, 3,
  );
  const newsMinSeverity = oneOfNum(
    pNum(migratedParams, "newsEvents", "newsMinSeverity"), NEWS_SEVERITY_LEVELS, 1,
  );
  const newsEventsOnly = pBool(migratedParams, "newsEvents", "newsEventsOnly");
  // 三個 setter 是 IntelPanel / MonitorPanel 的 onFilterChange 直接呼叫的 ——
  // 換軌後改寫 store（identity 由 useCallback 釘住，與原本 useState setter 同樣穩定）。
  const setNewsMinRelevance = useCallback(
    (v: 0 | 2 | 3) => layerParamsStore.setParam("newsEvents", "newsMinRelevance", String(v)),
    [],
  );
  const setNewsMinSeverity = useCallback(
    (v: 0 | 1 | 2) => layerParamsStore.setParam("newsEvents", "newsMinSeverity", String(v)),
    [],
  );
  const setNewsEventsOnly = useCallback(
    (v: boolean) => layerParamsStore.setParam("newsEvents", "newsEventsOnly", v),
    [],
  );

  // busCities 實際傳給 RPC 的展開值（BusGroup → BusCity[]）。
  // 8 個分組 checkbox 已拆成 8 個獨立 boolean 參數 → 這裡照 BUS_GROUP_ORDER 重新聚合，
  // 展開順序與手寫版（硬寫在 case 裡的那個陣列）逐字相同。
  const busLiveParams = migratedParams["busLive"];
  const enabledBusCities = useMemo<BusCity[]>(
    () => BUS_GROUP_ORDER
      .filter((g) => busLiveParams?.[`busGroup${g}`] === true)
      .flatMap((g) => BUS_GROUP_CITIES[g]),
    [busLiveParams],
  );

  const overlayParams = useMemo<Record<string, number>>(() => ({
    // 警察覆蓋分析（數字化 mode/minutes 餵 paint expression）
    // 環境污染（paint 用；filter 值另由 return 物件傳給 usePollutionLayers）
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    // ENERGY
    // 雲林 POC 覆蓋分析
    // HAZARD
    // ── 雙軌：已遷移進 layerParamsStore 的 key（規格派生，含 select 的 Idx 編碼）──
    //    刻意放在最末 spread：遷移途中若某 key 的手寫字面尚未刪除，以規格派生為準。
    ...migratedOverlayParams,
  }), [migratedOverlayParams,
    
    
    
    
    
    pollutionFacilityOpacity, pollutionFacilityScale,
    pollutionPenaltyOpacity, pollutionPenaltyScale,
    ]);

  const getControls = (layer: ExpandableLayerKey): ParamControl[] => {
    // ── 雙軌分岔（AR-22 P3-1）──────────────────────────────────────
    // 已遷移的 key 由規格派生控件；未遷移回 null → fallthrough 到下方 switch。
    // 值取自本次 render 訂閱到的 snapshot（不直接 getParams()）—— 讓控件的 value
    // 與觸發本次 render 的那份快照同源，避免 useSyncExternalStore 的 tearing。
    const migrated = buildParamControls(layer, migratedParams[layer]);
    if (migrated) return migrated;

    switch (layer) {
      // 都市熱島：2 選項 → ExpandedControls 會渲染成 button row（≥4 才轉原生 dropdown）
      case "windPlan": return [];
      // 🎓 教育 Education — 6 個點層共用 eduSchoolsOpacity / schoolScale（同一份 schools.geojson）
      // 只有總覽層 schools 額外給「分級配色」開關；5 個分級層與偏遠層本來就固定分色。
      case "submarineCables": return [];
      case "landingStations": return [];
      case "activeFaults": return [];
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
      case "youbikeFullness": return [
        { type: "select" as const, label: "Grid", value: String(ybResolution), options: [{ label: "大", value: "7" }, { label: "中", value: "8" }, { label: "小", value: "9" }], onChange: (v: string) => setYbResolution(Number(v)) },
        { type: "select" as const, label: "Height", value: ybHeightMode, options: [{ label: "有車×容量", value: "mixed" }, { label: "有車率", value: "fullness" }, { label: "容量", value: "capacity" }], onChange: (v: string) => setYbHeightMode(v as "mixed" | "fullness" | "capacity") },
        { label: `Opacity ${ybOpacity.toFixed(1)}`, value: ybOpacity, min: 0.1, max: 1, step: 0.1, onChange: setYbOpacity },
        { label: `Contrast ${ybContrast.toFixed(1)}`, value: ybContrast, min: 0.3, max: 3, step: 0.1, onChange: setYbContrast },
        { type: "toggle" as const, label: "3D", value: ybExtruded, onChange: setYbExtruded },
        { label: `Height ${ybElevationScale}`, value: ybElevationScale, min: 10, max: 200, step: 10, onChange: setYbElevationScale },
      ];
      case "aqiStations": return [];
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
