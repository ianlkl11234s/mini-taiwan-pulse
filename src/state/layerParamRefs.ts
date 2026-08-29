// ══════════════════════════════════════════════════════════════════
//  Layer Param Refs — Three.js RAF 迴圈的 React-free 參數鏡像（AR-22 P4）
// ══════════════════════════════════════════════════════════════════
//
// Three.js 的 render loop 每幀讀 `.current`，**完全不經 React 樹**。P4 之前這 46 個
// ref 由 `useLayerParamsRuntime` 的 `useParamRef*` 在 App 的 render 期間逐幀同步 ——
// 也就是說「拖一個 slider → App re-render → 46 行 `ref.current = …` 重跑」。
// ref 的值根本不需要 render 才能更新，那個 render 純粹是同步機制的副作用。
//
// 本檔把同步機制換成**一個 store 訂閱者**：值變了就寫進模組級 ref，
// 沒有元件被喚醒。`useThreeJsLayers` 直接 import，App 不再持有、也不再傳遞它們。
//
// ── 為什麼 initial 與 current 不再需要「刻意不同源」──────────────────
// 舊檔的慣例是 `useRef(規格常數)` + 每 render `ref.current = store 現值`，理由是
// 讓等值閘（每次 capture 都是全新 mount）驗得出「同步賦值那行被刪掉」。
// 等值閘已隨 `useLayerParamsRuntime` 一起退役（owner 2026-08-12 拍板），
// 而模組級 ref **只初始化一次**、之後全靠 `sync()` —— 把 sync 刪掉，
// 所有值會永遠卡在預設值，那是 render 矩陣與肉眼都看得見的失效，
// 不再需要靠「兩者不同源」來製造可觀測性。
//
// ⚠️ 訂閱在 module load 時建立且**永不解除**：這是有意的。它跟著模組活著，
// 沒有 mount/unmount 週期，也就沒有「元件卸載後 Three.js 讀到過期值」的窗口。

import {
  BUS_GROUP_CITIES, WASTE_GROUP_CITIES,
  type BusCity, type BusGroup,
} from "../types";
import {
  BUS_GROUP_OPTIONS, BUS_GROUP_ORDER, paramDefault, resolveMultiSelectValues,
  type LayerParamValues, type ParamValue,
} from "../data/layerParamsSpec";
import { layerParamsStore, type LayerParamsSnapshot } from "./layerParamsStore";

// ── 讀取器（同 layers/layerParamsAccess.ts 的 param* 三支，快照版）────
function rNum(all: LayerParamsSnapshot, key: string, name: string): number {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "number" ? v : Number(v);
}
/** 新控件尚未註冊前也維持 renderer 的安全預設，避免 NaN 傳入 WebGL material。 */
function rFiniteNum(all: LayerParamsSnapshot, key: string, name: string, fallback: number): number {
  const value = rNum(all, key, name);
  return Number.isFinite(value) ? value : fallback;
}
function rBool(all: LayerParamsSnapshot, key: string, name: string): boolean {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "boolean" ? v : Boolean(v);
}
function rStr(all: LayerParamsSnapshot, key: string, name: string): string {
  const v = all[key]?.[name] ?? paramDefault(key, name);
  return typeof v === "string" ? v : String(v);
}
function rOneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const RAIL_TRACK_MODES = ["2d", "3d"] as const;
const BUS_COLOR_MODES = ["route", "speed", "density"] as const;

// ── 廢棄物 13 子層的巢狀 Record ────────────────────────────────────
// ⚠️ `ringSize` **只有焚化爐有這個欄位**（不是 undefined）—— 其餘 12 個子層的
//    物件裡根本不該出現這個 key。
const WASTE_SUB_KEYS = [
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal",
  "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther",
  "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
] as const;
export type WasteSubKey = typeof WASTE_SUB_KEYS[number];
export interface WasteSubParams {
  size: number;
  opacity: number;
  altitude: number;
  ringSize?: number;
}

export function buildWasteSubParams(
  all: LayerParamsSnapshot,
): Record<WasteSubKey, WasteSubParams> {
  const out = {} as Record<WasteSubKey, WasteSubParams>;
  for (const k of WASTE_SUB_KEYS) {
    const entry: WasteSubParams = {
      size: rNum(all, k, `${k}Size`),
      opacity: rNum(all, k, `${k}Opacity`),
      altitude: rNum(all, k, `${k}Altitude`),
    };
    if (k === "wfIncinerator") entry.ringSize = rNum(all, k, `${k}RingSize`);
    out[k] = entry;
  }
  return out;
}

/** 市區公車區域多選 → 城市清單（群組、城市皆保留 SSOT 順序並去重）。 */
export function enabledBusCitiesOf(values: LayerParamValues | undefined): BusCity[] {
  const raw = values?.busGroups;
  const selected = new Set(
    typeof raw === "string" ? resolveMultiSelectValues(raw, BUS_GROUP_OPTIONS) : [],
  );
  const cities: BusCity[] = [];
  const seen = new Set<BusCity>();
  for (const group of BUS_GROUP_ORDER) {
    if (!selected.has(group)) continue;
    for (const city of BUS_GROUP_CITIES[group]) {
      if (seen.has(city)) continue;
      seen.add(city);
      cities.push(city);
    }
  }
  return cities;
}

/** 表定路線的 8 區分組 checkbox → 城市清單 */
export function enabledWasteScheduleCitiesOf(values: LayerParamValues | undefined): string[] {
  return BUS_GROUP_ORDER
    .filter((g: BusGroup) => values?.[`wasteScheduleGroup${g}`] === true)
    .flatMap((g: BusGroup) => WASTE_GROUP_CITIES[g]);
}

// ── 模組級 ref 群 ─────────────────────────────────────────────────

function ref<T>(initial: T): { current: T } {
  return { current: initial };
}

/**
 * Three.js scene 逐幀讀的參數鏡像。形狀與已退役的
 * `useLayerParamsRuntime().refs` **逐欄相同**（`useThreeJsLayers` 的介面一字未動）。
 */
export const layerParamRefs = {
  altExag: ref(0), altOffset: ref(0), staticOpacity: ref(0), orbScale: ref(0),
  shipOrbScale: ref(0), shipTrailOpacity: ref(0),
  railAltOffset: ref(0), railOrbScale: ref(0), railTrackOpacity: ref(0),
  railTrainVisible: ref(false), railTrackMode: ref<string>("3d"),
  busOrbScale: ref(0), busColorMode: ref<string>("route"), busAltOffset: ref(0), busOpacity: ref(1),
  busIntercityOrbScale: ref(0), busIntercityColorMode: ref<string>("route"),
  busIntercityAltOffset: ref(0), busIntercityOpacity: ref(1),
  touristShuttleOrbScale: ref(0), touristShuttleColorMode: ref<string>("route"),
  touristShuttleAltOffset: ref(0), touristShuttleOpacity: ref(0),
  wasteOrbScale: ref(0), wasteNoteSize: ref(0), wasteNoteZOffset: ref(0),
  wasteTruckOpacity: ref(1), wasteScheduleOpacity: ref(1),
  fireStationsScale: ref(0), fireStationsOpacity: ref(0), fireStations3D: ref(false),
  wasteSubParams: ref<Record<string, WasteSubParams>>({}),
  beamVisible: ref(false), beamDistance: ref(0), beamOpacity: ref(0),
  thsrPillarVisible: ref(false), thsrPillarHeight: ref(0),
  traPillarVisible: ref(false), traPillarHeight: ref(0),
  metroPillarVisible: ref(false), metroPillarHeight: ref(0),
  airportPillarVisible: ref(false), airportPillarHeight: ref(0),
  portPillarVisible: ref(false), portPillarHeight: ref(0),
  tempHeight: ref(0), tempZOffset: ref(0), tempExtruded: ref(false),
  tempOpacity: ref(0), tempWireframe: ref(false),
};

export type LayerParamRefs = typeof layerParamRefs;

/**
 * store 快照 → 46 個 ref。每個 (key, param) 逐字照抄已退役 runtime 的
 * `useParamRef*` 呼叫（那份對照曾由等值閘 B 的逐參數擾動守著）。
 */
function sync(): void {
  const a = layerParamsStore.getAll();
  const r = layerParamRefs;

  r.altExag.current = rNum(a, "flights", "altExaggeration");
  r.altOffset.current = rNum(a, "flights", "altOffset");
  r.staticOpacity.current = rNum(a, "flights", "staticOpacity");
  r.orbScale.current = rNum(a, "flights", "orbScale");

  r.shipOrbScale.current = rNum(a, "ships", "shipOrbScale");
  r.shipTrailOpacity.current = rNum(a, "ships", "shipTrailOpacity");

  r.railAltOffset.current = rNum(a, "rail", "railAltOffset");
  r.railOrbScale.current = rNum(a, "rail", "railOrbScale");
  r.railTrackOpacity.current = rNum(a, "rail", "railTrackOpacity");
  r.railTrainVisible.current = rBool(a, "rail", "railTrainVisible");
  r.railTrackMode.current = rOneOf(rStr(a, "rail", "railTrackMode"), RAIL_TRACK_MODES, "3d");

  r.beamVisible.current = rBool(a, "lighthouses", "beamVisible");
  r.beamDistance.current = rNum(a, "lighthouses", "beamDistance");
  r.beamOpacity.current = rNum(a, "lighthouses", "beamOpacity");

  r.thsrPillarVisible.current = rBool(a, "stationsTHSR", "thsrPillarVisible");
  r.thsrPillarHeight.current = rNum(a, "stationsTHSR", "thsrPillarHeight");
  r.traPillarVisible.current = rBool(a, "stationsTRA", "traPillarVisible");
  r.traPillarHeight.current = rNum(a, "stationsTRA", "traPillarHeight");
  r.metroPillarVisible.current = rBool(a, "stationsMetro", "metroPillarVisible");
  r.metroPillarHeight.current = rNum(a, "stationsMetro", "metroPillarHeight");
  r.portPillarVisible.current = rBool(a, "ports", "portPillarVisible");
  r.portPillarHeight.current = rNum(a, "ports", "portPillarHeight");
  r.airportPillarVisible.current = rBool(a, "airports", "airportPillarVisible");
  r.airportPillarHeight.current = rNum(a, "airports", "airportPillarHeight");

  r.busOrbScale.current = rNum(a, "busLive", "busOrbScale");
  r.busAltOffset.current = rNum(a, "busLive", "busAltOffset");
  r.busOpacity.current = rFiniteNum(a, "busLive", "busOpacity", 1);
  r.busColorMode.current = rOneOf(rStr(a, "busLive", "busColorMode"), BUS_COLOR_MODES, "route");
  r.busIntercityOrbScale.current = rNum(a, "busIntercityLive", "busIntercityOrbScale");
  r.busIntercityAltOffset.current = rNum(a, "busIntercityLive", "busIntercityAltOffset");
  r.busIntercityOpacity.current = rFiniteNum(a, "busIntercityLive", "busIntercityOpacity", 1);
  r.busIntercityColorMode.current =
    rOneOf(rStr(a, "busIntercityLive", "busIntercityColorMode"), BUS_COLOR_MODES, "route");
  r.touristShuttleOrbScale.current = rNum(a, "touristShuttleLive", "touristShuttleOrbScale");
  r.touristShuttleAltOffset.current = rNum(a, "touristShuttleLive", "touristShuttleAltOffset");
  r.touristShuttleOpacity.current = rNum(a, "touristShuttleLive", "touristShuttleOpacity");
  r.touristShuttleColorMode.current =
    rOneOf(rStr(a, "touristShuttleLive", "touristShuttleColorMode"), BUS_COLOR_MODES, "route");

  r.fireStationsScale.current = rNum(a, "fireStations", "fireStationsScale");
  r.fireStationsOpacity.current = rNum(a, "fireStations", "fireStationsOpacity");
  r.fireStations3D.current = rBool(a, "fireStations", "fireStations3D");

  r.tempHeight.current = rNum(a, "temperatureWave", "tempHeight");
  r.tempZOffset.current = rNum(a, "temperatureWave", "tempZOffset");
  r.tempExtruded.current = rBool(a, "temperatureWave", "tempExtruded");
  r.tempOpacity.current = rNum(a, "temperatureWave", "tempOpacity");
  r.tempWireframe.current = rBool(a, "temperatureWave", "tempWireframe");

  r.wasteOrbScale.current = rNum(a, "wasteTruck", "wasteOrbScale");
  r.wasteNoteSize.current = rNum(a, "wasteTruck", "wasteNoteSize");
  r.wasteNoteZOffset.current = rNum(a, "wasteTruck", "wasteNoteZOffset");
  r.wasteTruckOpacity.current = rFiniteNum(a, "wasteTruck", "wasteTruckOpacity", 1);
  r.wasteScheduleOpacity.current = rFiniteNum(a, "wasteSchedule", "wasteScheduleOpacity", 1);

  r.wasteSubParams.current = buildWasteSubParams(a);
}

sync();
layerParamsStore.subscribe(sync);

/** 測試用：手動觸發一次同步（正常路徑由 store 訂閱驅動） */
export function syncLayerParamRefs(): void {
  sync();
}

/** 裁處事件歷史播放引擎會用到的型別再匯出，避免消費端多 import 一支 */
export type { ParamValue };
