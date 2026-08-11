// ══════════════════════════════════════════════════════════════════
//  Layer Params Runtime — store 快照 → 消費端既有回傳 API 的轉接層
//  （AR-22 Phase 3 / P3-3；P3-2D 之前叫 `useTransportParams.ts`）
// ══════════════════════════════════════════════════════════════════
//
// 本檔**不再持有任何參數**：348 個 layer 的 336 個 key 全部宣告在
// `data/layerParamsSpec.ts`、值全部住在 `state/layerParamsStore.ts`
// （`useState` 645 → 0）。剩下的是純機制 ——
//
//   讀取器（`pNum`/`pBool`/`pStr`）· 窄化（`oneOf`/`oneOfNum`）·
//   鏡像 ref 三支（Three.js render loop 逐幀讀 `.current`）·
//   `buildWasteSubParams`（巢狀 Record 組裝）· `advancePenaltyYear`（播放引擎）·
//   `getControls` 的雙軌 dispatcher ＋ 5 個 `emptyByDesign` case ·
//   `overlayParams` 薄 memo · 46 個 ref ／ 6 個子物件的 `return {}` 組裝
//
// ⚠️ **舊檔名 `useTransportParams` 已完全退場，沒有相容薄殼**：
// 一個模組兩個名字正是本專案在獵殺的那類漂移。P3-3 之前的 changelog 與
// docs/features/* 仍寫舊名（歷史紀錄不回改），對照點就是本段。
//
// ⚠️ **回傳形狀是 348 個圖層真正的耦合面**：改任何欄位都要同步
// `__tests__/useLayerParamsRuntimeReturn.test.ts` 的 `RETURN_CHANNEL`（活文件），
// 否則等值閘 B 立刻紅。整支退役（消費端改吃 `useLayerParams(key)`）是 AR-22
// 的終點，**不是等價重構**，要另立驗收標準。
//
// ⚠️ 下方 5 個 `emptyByDesign` 分支（windPlan / submarineCables / landingStations
// / activeFaults / aqiStations）**不能順手刪**：`paramsCaseKeys()` 靠「分支字面
// 直接 return 空陣列」判定「有意沒有控件」，刪了會被 `layerConsistency` 的覆蓋
// 斷言誤判成漏接。要刪得先給 manifest 一個等價的表達。
//
// ⚠️ 同理，本檔的**註解也會被文字解析器掃到**（`paramsCaseKeys` 不剝註解）——
// 註解裡不要出現 `case` 加雙引號 key 的字面，會憑空多出一個幽靈 key。

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ExpandableLayerKey, BusCity } from "../types";
import {
  layerParamsStore, encodeParamsToOverlay, buildDefaultParams,
  type LayerParamsSnapshot,
} from "../state/layerParamsStore";
import { BUS_GROUP_ORDER, paramDefault } from "../data/layerParamsSpec";
import { buildParamControls, type ParamControl } from "../state/layerParamsControls";
import { BUS_GROUP_CITIES, WASTE_GROUP_CITIES } from "../types";
import {
  FACILITY_MEDIA, PENALTY_YEAR_MIN, PENALTY_YEAR_MAX, type PollutionMedium,
} from "../data/pollutionTypes";
// religionTypes / funeralTypes / buildingsGbaTypes / propertyValueTypes 等
// select 選項常數已隨對應的 key 遷出本檔（現由 src/data/layerParamsSpec.ts 引用）。

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
//  而「值真的有流過來」由 `__tests__/useLayerParamsRuntimeReturn.test.ts` 的
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
const H3_METRICS = ["day", "night"] as const;
const YB_HEIGHT_MODES = ["mixed", "fullness", "capacity"] as const;

/**
 * 裁處事件三層 fall-through 共用同一份值 —— 讀寫取第一個成員當代表
 * （`sharedGroup` 保證三者恆等）。
 */
const PENALTY_KEY = "pollutionPenaltyCritical";

/**
 * 裁處事件歷史播放的**一次推進**（純函式：吃 store、寫 store，不碰 React）。
 *
 * 抽出來的理由：`useEffect` 在 `renderToStaticMarkup` 下根本不執行，
 * 播放引擎在等值閘的 harness 裡不可測 —— 純函式才驗得到三條分支
 * （逐年推進 ／ 到最後一年停 ／「全部年份」起手跳到起始年）。
 *
 * ⚠️ 一律走 `setParamDirect`（不觸發 cascade）：年份的 cascade 是「一動就停播放」，
 * 那是**控件 onChange** 的語意；引擎自己推進若也觸發，播放推進一年就會自己關掉。
 * ⚠️ 年份是 select、store 存**字串** —— 寫回去要 `String(...)`，寫數字會讓控件
 * 讀不到型別相符的值而退回預設（靜默壞掉，且 effect 不執行的閘都看不到）。
 */
export function advancePenaltyYear(): void {
  const raw = Number(layerParamsStore.getParam(PENALTY_KEY, "pollutionPenaltyYear"));
  const cur = raw === 0 ? PENALTY_YEAR_MIN : raw;
  if (cur >= PENALTY_YEAR_MAX) {
    layerParamsStore.setParamDirect(PENALTY_KEY, "pollutionPenaltyPlaying", false);
    layerParamsStore.setParamDirect(PENALTY_KEY, "pollutionPenaltyYear", String(PENALTY_YEAR_MAX));
    return;
  }
  layerParamsStore.setParamDirect(PENALTY_KEY, "pollutionPenaltyYear", String(cur + 1));
}

// ── 鏡像 ref（Three.js render loop 逐幀讀 `.current`，不走 React 樹）─────
//
// ⚠️ **initial 吃規格常數、current 吃 store 現值** —— 兩者刻意不同源。
// initial 若也讀 store，等值閘（每次 capture 都是全新 mount）就再也驗不出
// 「同步賦值那一行被刪掉」：mount 當下 `useRef(現值)` 已經是對的。
// 這條慣例是 ref 通道有閘可守的前提，改動前先看
// `__tests__/useLayerParamsRuntimeReturn.test.ts` 的盲區說明。

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
// ── 廢棄物 13 子層的巢狀 Record（`wasteSubParams`）────────────────────
// 手寫版是單一 useState 存 `Record<key, {size,opacity,altitude,ringSize?}>`；
// 拆平成 per-key 獨立參數後由本函式組回原形狀。
// ⚠️ `ringSize` **只有焚化爐有這個欄位**（不是 undefined）—— 其餘 12 個子層的物件
// 裡根本不該出現這個 key，等值閘的 canonical 快照分得出兩者。

const WASTE_SUB_KEYS = [
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal",
  "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther",
  "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
] as const;
type WasteSubKey = typeof WASTE_SUB_KEYS[number];
interface WasteSubParams { size: number; opacity: number; altitude: number; ringSize?: number }

function buildWasteSubParams(all: LayerParamsSnapshot): Record<WasteSubKey, WasteSubParams> {
  const out = {} as Record<WasteSubKey, WasteSubParams>;
  for (const k of WASTE_SUB_KEYS) {
    const entry: WasteSubParams = {
      size: pNum(all, k, `${k}Size`),
      opacity: pNum(all, k, `${k}Opacity`),
      altitude: pNum(all, k, `${k}Altitude`),
    };
    if (k === "wfIncinerator") entry.ringSize = pNum(all, k, `${k}RingSize`);
    out[k] = entry;
  }
  return out;
}

/** 規格常數版（鏡像 ref 的 initial 專用 —— 同樣不准讀 store 現值） */
const WASTE_SUB_DEFAULTS = buildWasteSubParams(buildDefaultParams());

function useParamRefEnum<T extends string>(
  all: LayerParamsSnapshot, key: string, name: string,
  allowed: readonly T[], fallback: T,
) {
  const ref = useRef(oneOf(String(paramDefault(key, name) ?? fallback), allowed, fallback));
  ref.current = oneOf(pStr(all, key, name), allowed, fallback);
  return ref;
}

export function useLayerParamsRuntime() {
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
  const wasteOrbScaleRef = useParamRefNum(migratedParams, "wasteTruck", "wasteOrbScale");
  const wasteNoteSizeRef = useParamRefNum(migratedParams, "wasteTruck", "wasteNoteSize");
  const wasteNoteZOffsetRef = useParamRefNum(migratedParams, "wasteTruck", "wasteNoteZOffset");

  // ── 第二通道：13 個廢棄物子層 → `wasteSubParams` 巢狀 Record（P3-2D 群3）──
  //    手寫版是一個 `Record<key, {size,opacity,altitude,ringSize?}>` 的 useState；
  //    拆平成 per-key 的三（四）個獨立參數後，這裡重新組回原本的形狀。
  //    identity 用 useMemo 釘住（原本是 useState 值，消費端會放進 deps）。
  const wasteSubParams = useMemo<Record<WasteSubKey, WasteSubParams>>(
    () => buildWasteSubParams(migratedParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    WASTE_SUB_KEYS.map((k) => migratedParams[k]),
  );
  // ⚠️ initial 吃規格常數（同其他鏡像 ref 的慣例，見上方說明）
  const wasteSubParamsRef = useRef(WASTE_SUB_DEFAULTS);
  wasteSubParamsRef.current = wasteSubParams;

  // 表定路線的 8 區分組 checkbox → 展開成城市清單（順序 = BUS_GROUP_ORDER）
  const wasteScheduleParams = migratedParams["wasteSchedule"];
  const enabledWasteScheduleCities = useMemo<string[]>(
    () => BUS_GROUP_ORDER
      .filter((g) => wasteScheduleParams?.[`wasteScheduleGroup${g}`] === true)
      .flatMap((g) => WASTE_GROUP_CITIES[g]),
    [wasteScheduleParams],
  );

  // ── 第二通道：已遷移參數 → 六個獨立子物件（P3-2D 群4）──────────────
  //    identity 用 useMemo 釘住，deps 取該 key 的整包參數物件 ——
  //    store 保證「只有這個 key 真的變動時才換 identity」，與手寫版逐項列 deps 等價。
  const h3Values = migratedParams["h3Population"];
  const h3Params = useMemo(() => ({
    opacity: pNum(migratedParams, "h3Population", "h3Opacity"),
    extruded: pBool(migratedParams, "h3Population", "h3Extruded"),
    elevationScale: pNum(migratedParams, "h3Population", "h3ElevationScale"),
    metric: oneOf(pStr(migratedParams, "h3Population", "h3Metric"), H3_METRICS, "day"),
    contrast: pNum(migratedParams, "h3Population", "h3Contrast"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [h3Values]);

  const pcValues = migratedParams["popCount"];
  const popCountParams = useMemo(() => ({
    opacity: pNum(migratedParams, "popCount", "pcOpacity"),
    contrast: pNum(migratedParams, "popCount", "pcContrast"),
    extruded: pBool(migratedParams, "popCount", "pcExtruded"),
    elevationScale: pNum(migratedParams, "popCount", "pcElevationScale"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pcValues]);

  const indValues = migratedParams["indicators"];
  const indicatorsParams = useMemo(() => ({
    category: pStr(migratedParams, "indicators", "indCategory"),
    metric: pStr(migratedParams, "indicators", "indMetric"),
    opacity: pNum(migratedParams, "indicators", "indOpacity"),
    contrast: pNum(migratedParams, "indicators", "indContrast"),
    extruded: pBool(migratedParams, "indicators", "indExtruded"),
    elevationScale: pNum(migratedParams, "indicators", "indElevationScale"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [indValues]);

  const socioValues = migratedParams["socioeconomic"];
  const socioParams = useMemo(() => ({
    metric: pStr(migratedParams, "socioeconomic", "socioMetric"),
    opacity: pNum(migratedParams, "socioeconomic", "socioOpacity"),
    contrast: pNum(migratedParams, "socioeconomic", "socioContrast"),
    extruded: pBool(migratedParams, "socioeconomic", "socioExtruded"),
    elevationScale: pNum(migratedParams, "socioeconomic", "socioElevation"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [socioValues]);

  const spatialValues = migratedParams["spatialEconomy"];
  const spatialParams = useMemo(() => ({
    metric: pStr(migratedParams, "spatialEconomy", "spatialMetric"),
    opacity: pNum(migratedParams, "spatialEconomy", "spatialOpacity"),
    contrast: pNum(migratedParams, "spatialEconomy", "spatialContrast"),
    extruded: pBool(migratedParams, "spatialEconomy", "spatialExtruded"),
    elevationScale: pNum(migratedParams, "spatialEconomy", "spatialElevation"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [spatialValues]);

  const ybValues = migratedParams["youbikeFullness"];
  const youbikeParams = useMemo(() => ({
    opacity: pNum(migratedParams, "youbikeFullness", "ybOpacity"),
    contrast: pNum(migratedParams, "youbikeFullness", "ybContrast"),
    extruded: pBool(migratedParams, "youbikeFullness", "ybExtruded"),
    elevationScale: pNum(migratedParams, "youbikeFullness", "ybElevationScale"),
    heightMode: oneOf(pStr(migratedParams, "youbikeFullness", "ybHeightMode"), YB_HEIGHT_MODES, "mixed"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ybValues]);
  const ybResolution = pNum(migratedParams, "youbikeFullness", "ybResolution");

  // ── 第二通道：環境污染的 filter 狀態（餵 usePollutionLayers 的 setFilter）──
  //    ⚠️ media 是 **7 個 key** 的 Record，但只有 5 個有控件（`FACILITY_MEDIA`）——
  //    noise / other 沒有控件、恆為 false，這裡補常數。
  const facilityValues = migratedParams["pollutionFacility"];
  const pollutionFacilityMedia = useMemo<Record<PollutionMedium, boolean>>(() => {
    const out = { noise: false, other: false } as Record<PollutionMedium, boolean>;
    for (const m of FACILITY_MEDIA) {
      out[m] = pBool(migratedParams, "pollutionFacility", `pollutionFacilityMedia_${m}`);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityValues]);
  const pollutionFacilityMinSev = pNum(migratedParams, "pollutionFacility", "pollutionFacilityMinSev");
  const pollutionPenaltyMediumIdx = pNum(migratedParams, PENALTY_KEY, "pollutionPenaltyMediumIdx");
  const pollutionPenaltyYear = pNum(migratedParams, PENALTY_KEY, "pollutionPenaltyYear");
  const pollutionPenaltyMode = pNum(migratedParams, PENALTY_KEY, "pollutionPenaltyMode");

  // 裁處事件歷史播放引擎：從起始年逐年推進到最後一年後停（比照火災事件的自動播放）。
  // 推進邏輯抽成純函式（`advancePenaltyYear`）—— effect 在 server render 下不執行，
  // 測試碰不到它；純函式才驗得到「推進 / 到頂停 / 全部年份起手」三條分支。
  const pollutionPenaltyPlaying = pBool(migratedParams, PENALTY_KEY, "pollutionPenaltyPlaying");
  useEffect(() => {
    if (!pollutionPenaltyPlaying) return;
    const id = setInterval(advancePenaltyYear, 1100);
    return () => clearInterval(id);
  }, [pollutionPenaltyPlaying]);

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
    // ENERGY
    // 雲林 POC 覆蓋分析
    // HAZARD
    // ── 雙軌：已遷移進 layerParamsStore 的 key（規格派生，含 select 的 Idx 編碼）──
    //    刻意放在最末 spread：遷移途中若某 key 的手寫字面尚未刪除，以規格派生為準。
    ...migratedOverlayParams,
  }), [migratedOverlayParams]);

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
      case "aqiStations": return [];
      // 🏟️ 運動場館 Sports（5 sublayer，opacity + scale；大小另由 area_sqm log 內插驅動）
      // ── 環境污染 POLLUTION ──
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
    h3Params,
    popCountParams,
    indicatorsParams,
    socioParams,
    spatialParams,
    ybResolution,
    youbikeParams,
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
