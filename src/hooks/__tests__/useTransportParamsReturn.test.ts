/**
 * useTransportParams 回傳物件的逐欄位等值閘（AR-22 Phase 3 / P3-2D 第 1 步）
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠️ **為什麼非有這道閘不可**：黃金快照（`layerGoldenSnapshot.test.ts`）凍結的是
 * 兩件事 —— `getControls(key)` 的輸出，與「拿 `overlayParams` 去求值 paint」的結果。
 * 它**沒有**凍結 `useTransportParams` 回傳物件的其他欄位，也沒有凍結 `overlayParams`
 * 物件本身。P3-2C 的突變 (i)（讓 `encodeParamsToOverlay` 跟著 `showWhen` 少編兩個欄位）
 * 就是實證：**快照全綠**，只有專屬斷言會紅。
 *
 * D 桶 74 個 key 整桶走的正是那條快照看不見的通道：
 *   `refs.xxx.current`（Three.js render loop）／六個獨立子物件（`h3Params` …）／
 *   平鋪欄位（`daOpacity` `satOpacity` …）／派生欄位（`enabledBusCities`）。
 * 沒有這道閘就搬，會重演 P3-2A 那種「四道閘全綠、畫面卻壞掉」。
 *
 * ── 兩組斷言 ──────────────────────────────────────────────────────
 *   A. **預設值下逐欄位等值**：回傳物件（含 refs 的當下值、六個子物件、派生陣列）
 *      對凍結字面；`overlayParams` 另以 key 集合 ＋ canonical sha256 兩條釘死。
 *      擋的是「遷移後預設值變了 ／ 欄位不見了 ／ 多冒出欄位」。
 *   B. **逐參數隔離擾動**：對**每一個**已遷移參數，reset → 只寫這一個 → 重 render →
 *      比對「回傳物件哪些路徑變了」必須**恰好等於**宣告的通道
 *      （`overlayParams.<out>` 由 spec 自動推導；第二通道由 `RETURN_CHANNEL` 宣告）。
 *      擋的是「值搬進 store 卻沒接回回傳欄位」「接錯欄位」「順手改到別人」。
 *
 * ── ⚠️ 這道閘的已知盲區（別誤以為它全包）────────────────────────────
 *   1. **未遷移的 key 拖不動**：`renderToStaticMarkup` 是一次性 mount，
 *      `useState` 的 setter 在 server render 下不會觸發重繪 —— 遷移**前**的
 *      「拖了有沒有反應」本測驗不到（那是已知良好的基準，不是要驗的對象）。
 *   2. **ref 的 `useRef(initial)` 必須吃常數**：capture 每次都是全新 mount，
 *      若寫成 `useRef(從 store 讀的值)`，即使刪掉 `ref.current = x` 那行同步，
 *      B 也會綠（initial 已經是擾動後的值）。**遷移慣例**：
 *      `useRef` 的 initial 一律吃規格常數（`paramDefault`），同步行照舊逐 render 賦值。
 *      這條慣例是 B 對 ref 通道有效的前提。
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";

import { useTransportParams } from "../useTransportParams";
import { sanitize, canonicalJson } from "../../data/__tests__/layerGoldenExtract";
import {
  BUS_GROUP_ORDER, LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, encodeParamValue,
  sharedSlotMembers, specOutKey,
  type LayerParamSpec, type ParamValue,
} from "../../data/layerParamsSpec";
import { layerParamsStore } from "../../state/layerParamsStore";
import { PENALTY_YEAR_MAX } from "../../data/pollutionTypes";
import { BUS_GROUP_CITIES, WASTE_GROUP_CITIES, type BusGroup } from "../../types";

// ══════════════════════════════════════════════════════════════════
//  第二通道宣告表（RETURN_CHANNEL）
// ══════════════════════════════════════════════════════════════════
/**
 * 「這個參數的值，除了 overlayParams 之外還會出現在回傳物件的哪些路徑」。
 *
 * - `key` / `param`：規格裡的 (layer key, 參數名)。共用 slot 只需宣告**一個代表**，
 *   其餘成員由 `sharedSlotMembers` 自動展開（同群本來就是同一份值）。
 * - `to`：擾動時要寫進去的值（必須 ≠ 預設，否則 `setParam` 是 no-op）。
 * - `paths`：擾動後**應該**改變的回傳路徑 → 期望值。路徑用 `.` 分隔，
 *   `refs.x` 指的是 `refs.x.current`（capture 已攤平）。陣列整包比對。
 *
 * ⚠️ 這張表就是「第二條輸出通道」的文件本身。`out: null` 的參數**必須**在這裡
 * 出現（或列進 `INTERNAL_CONSUMERS`），否則 B 的完整性規則會紅 ——
 * 那代表值搬進了 store 卻沒有任何消費者，是 D 桶最典型的靜默失效。
 *
 * 每一個遷移群組會往這裡加對應的條目。
 */
interface ReturnChannel {
  key: string;
  param: string;
  to: ParamValue;
  paths: Record<string, unknown>;
}
/** 13 個廢棄物子層（順序不重要，只用來展開宣告） */
const WASTE_SUB_KEYS = [
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal",
  "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther",
  "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
] as const;

const RETURN_CHANNEL: ReturnChannel[] = [
  // ── 群1：平鋪欄位（P3-2D）────────────────────────────────────────
  // 共用 slot 只宣告代表：`daOpacity` 5 個示警層、`satOpacity` 16 個衛星層，
  // 其餘成員由 sharedSlotMembers 展開後套用同一條。
  { key: "lifelineAlerts", param: "daOpacity", to: 0.55, paths: { daOpacity: 0.55 } },
  { key: "satellitesYaogan", param: "satOpacity", to: 0.55, paths: { satOpacity: 0.55 } },
  { key: "earthquakes", param: "eqOpacity", to: 0.5, paths: { eqOpacity: 0.5 } },
  // select（字串）→ 回傳仍是 boolean：這條同時驗「還原邏輯沒接反」
  { key: "earthquakes", param: "eqMode", to: "history", paths: { eqShowHistory: true } },
  { key: "earthquakeReplay", param: "eqReplayOpacity", to: 0.5, paths: { eqReplayOpacity: 0.5 } },
  { key: "roadEvents", param: "reOpacity", to: 0.5, paths: { reOpacity: 0.5 } },
  // 數值型 select（store 存 "30"）→ 回傳 number 30：驗 hook 端的 Number() 還原
  { key: "plaActivity", param: "plaTrailDays", to: "30", paths: { plaTrailDays: 30 } },
  { key: "plaActivity", param: "plaReplay", to: true, paths: { plaReplay: true } },
  { key: "plaActivity", param: "plaOpacity", to: 0.9, paths: { plaOpacity: 0.9 } },
  { key: "plaActivity", param: "plaShowReview", to: true, paths: { plaShowReview: true } },
  { key: "cwaCloudImagery", param: "cwaCloudOpacity", to: 0.5, paths: { cwaCloudOpacity: 0.5 } },
  { key: "cwaRadarImagery", param: "cwaRadarOpacity", to: 0.5, paths: { cwaRadarOpacity: 0.5 } },
  { key: "aqiImagery", param: "aqiImageryOpacity", to: 0.5, paths: { aqiImageryOpacity: 0.5 } },
  // ⚠️ 兩條通道都走：overlayParams.aqiMicroModeIdx（圖例）由 spec 的 out 自動推導，
  //    這裡宣告的是 hook return 那一條（hook 的 setPaintProperty 吃它）。
  { key: "aqiMicroSensors", param: "aqiMicroModeIdx", to: "2", paths: { aqiMicroModeIdx: 2 } },
  { key: "aqiMicroSensors", param: "aqiMicroCluster", to: false, paths: { aqiMicroCluster: false } },
  { key: "hillshade", param: "hillshadeOpacity", to: 0.8, paths: { hillshadeOpacity: 0.8 } },
  { key: "slopeVector", param: "slopeVectorOpacity", to: 0.8, paths: { slopeVectorOpacity: 0.8 } },
  { key: "aspectVector", param: "aspectVectorOpacity", to: 0.8, paths: { aspectVectorOpacity: 0.8 } },
  { key: "temperatureGrid", param: "tempGridOpacity", to: 0.5, paths: { tempGridOpacity: 0.5 } },
  {
    key: "pollutionSite", param: "pollutionSiteActiveOnly", to: false,
    paths: { pollutionSiteActiveOnly: false },
  },

  // ── 群2：refs.current（Three.js render loop）────────────────────
  // `refs.x` 指的是 `refs.x.current`（capture 已攤平）。同時走 overlayParams 的
  // 參數只宣告這裡的第二條，overlay 那條由 spec 的 out 自動推導。
  { key: "flights", param: "altExaggeration", to: 4, paths: { "refs.altExag": 4 } },
  { key: "flights", param: "altOffset", to: 100, paths: { "refs.altOffset": 100 } },
  { key: "flights", param: "staticOpacity", to: 0.3, paths: { "refs.staticOpacity": 0.3 } },
  { key: "flights", param: "orbScale", to: 0.000008, paths: { "refs.orbScale": 0.000008 } },
  { key: "ships", param: "shipOrbScale", to: 0.00001, paths: { "refs.shipOrbScale": 0.00001 } },
  { key: "ships", param: "shipTrailOpacity", to: 0.5, paths: { "refs.shipTrailOpacity": 0.5 } },
  { key: "rail", param: "railTrainVisible", to: false, paths: { "refs.railTrainVisible": false } },
  // 一個參數餵兩條回傳路徑（ref 給 Three.js、平鋪欄位給 App 的 2D/3D 切換 effect）
  {
    key: "rail", param: "railTrackMode", to: "2d",
    paths: { railTrackMode: "2d", "refs.railTrackMode": "2d" },
  },
  { key: "rail", param: "railAltOffset", to: 200, paths: { "refs.railAltOffset": 200 } },
  { key: "rail", param: "railOrbScale", to: 0.000015, paths: { "refs.railOrbScale": 0.000015 } },
  { key: "rail", param: "railTrackOpacity", to: 0.6, paths: { "refs.railTrackOpacity": 0.6 } },
  // 8 個分組 checkbox → 派生欄位 `enabledBusCities`（展開順序 = BUS_GROUP_ORDER）
  {
    key: "busLive", param: "busGroupTaipeiMetro", to: false,
    paths: { enabledBusCities: [] },
  },
  {
    key: "busLive", param: "busGroupKeelungYilan", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "KeelungYilan") },
  },
  {
    key: "busLive", param: "busGroupTaoyuanHsinchuMiaoli", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "TaoyuanHsinchuMiaoli") },
  },
  {
    key: "busLive", param: "busGroupCentralTaiwan", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "CentralTaiwan") },
  },
  {
    key: "busLive", param: "busGroupYunChiaNan", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "YunChiaNan") },
  },
  {
    key: "busLive", param: "busGroupKaoping", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "Kaoping") },
  },
  {
    key: "busLive", param: "busGroupHualienTaitung", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "HualienTaitung") },
  },
  {
    key: "busLive", param: "busGroupOffshoreIslands", to: true,
    paths: { enabledBusCities: busCitiesOf("TaipeiMetro", "OffshoreIslands") },
  },
  { key: "busLive", param: "busColorMode", to: "speed", paths: { "refs.busColorMode": "speed" } },
  { key: "busLive", param: "busAltOffset", to: 100, paths: { "refs.busAltOffset": 100 } },
  { key: "busLive", param: "busOrbScale", to: 0.000008, paths: { "refs.busOrbScale": 0.000008 } },
  {
    key: "busIntercityLive", param: "busIntercityColorMode", to: "density",
    paths: { "refs.busIntercityColorMode": "density" },
  },
  {
    key: "busIntercityLive", param: "busIntercityAltOffset", to: 50,
    paths: { "refs.busIntercityAltOffset": 50 },
  },
  {
    key: "busIntercityLive", param: "busIntercityOrbScale", to: 0.000007,
    paths: { "refs.busIntercityOrbScale": 0.000007 },
  },
  {
    key: "touristShuttleLive", param: "touristShuttleColorMode", to: "speed",
    paths: { "refs.touristShuttleColorMode": "speed" },
  },
  {
    key: "touristShuttleLive", param: "touristShuttleOpacity", to: 0.5,
    paths: { "refs.touristShuttleOpacity": 0.5 },
  },
  {
    key: "touristShuttleLive", param: "touristShuttleAltOffset", to: 60,
    paths: { "refs.touristShuttleAltOffset": 60 },
  },
  {
    key: "touristShuttleLive", param: "touristShuttleOrbScale", to: 0.000006,
    paths: { "refs.touristShuttleOrbScale": 0.000006 },
  },
  { key: "lighthouses", param: "beamVisible", to: false, paths: { "refs.beamVisible": false } },
  { key: "lighthouses", param: "beamDistance", to: 2, paths: { "refs.beamDistance": 2 } },
  { key: "lighthouses", param: "beamOpacity", to: 0.5, paths: { "refs.beamOpacity": 0.5 } },
  // stationScale 是 3 個車站層的共用 slot：宣告一次，其餘成員自動展開
  { key: "stationsTHSR", param: "stationScale", to: 2, paths: { stationScale: 2 } },
  {
    key: "stationsTHSR", param: "thsrPillarVisible", to: false,
    paths: { "refs.thsrPillarVisible": false },
  },
  {
    key: "stationsTHSR", param: "thsrPillarHeight", to: 1.5,
    paths: { "refs.thsrPillarHeight": 1.5 },
  },
  {
    key: "stationsTRA", param: "traPillarVisible", to: false,
    paths: { "refs.traPillarVisible": false },
  },
  { key: "stationsTRA", param: "traPillarHeight", to: 1.5, paths: { "refs.traPillarHeight": 1.5 } },
  // 兩條通道都走：overlayParams.metroPillar3d（paint）＋ ref（Three.js）
  {
    key: "stationsMetro", param: "metroPillarVisible", to: true,
    paths: { "refs.metroPillarVisible": true },
  },
  {
    key: "stationsMetro", param: "metroPillarHeight", to: 1.5,
    paths: { "refs.metroPillarHeight": 1.5 },
  },
  { key: "ports", param: "portPillarVisible", to: true, paths: { "refs.portPillarVisible": true } },
  { key: "ports", param: "portPillarHeight", to: 1.5, paths: { "refs.portPillarHeight": 1.5 } },
  {
    key: "airports", param: "airportPillarVisible", to: true,
    paths: { "refs.airportPillarVisible": true },
  },
  {
    key: "airports", param: "airportPillarHeight", to: 1.5,
    paths: { "refs.airportPillarHeight": 1.5 },
  },
  {
    key: "fireStations", param: "fireStations3D", to: false,
    paths: { "refs.fireStations3D": false },
  },
  {
    key: "fireStations", param: "fireStationsScale", to: 2,
    paths: { "refs.fireStationsScale": 2 },
  },
  {
    key: "fireStations", param: "fireStationsOpacity", to: 0.5,
    paths: { "refs.fireStationsOpacity": 0.5 },
  },
  {
    key: "temperatureWave", param: "tempExtruded", to: false,
    paths: { "refs.tempExtruded": false },
  },
  { key: "temperatureWave", param: "tempHeight", to: 300, paths: { "refs.tempHeight": 300 } },
  { key: "temperatureWave", param: "tempZOffset", to: 500, paths: { "refs.tempZOffset": 500 } },
  { key: "temperatureWave", param: "tempOpacity", to: 0.5, paths: { "refs.tempOpacity": 0.5 } },
  {
    key: "temperatureWave", param: "tempWireframe", to: true,
    paths: { "refs.tempWireframe": true },
  },
  // 新聞三軸：store 存字串、回傳仍是原本的 0|2|3 / 0|1|2 數字
  { key: "newsEvents", param: "newsMinRelevance", to: "0", paths: { newsMinRelevance: 0 } },
  { key: "newsEvents", param: "newsMinSeverity", to: "2", paths: { newsMinSeverity: 2 } },
  { key: "newsEvents", param: "newsEventsOnly", to: false, paths: { newsEventsOnly: false } },
  { key: "newsEvents", param: "newsTimeBased", to: false, paths: { newsTimeBased: false } },
  { key: "newsEvents", param: "newsRipple", to: false, paths: { newsRipple: false } },

  // ── 群3：廢棄物（巢狀 Record ＋ 分組 checkbox）──────────────────
  // 光點／音符三支 slider 由 GPS 與表定兩層共用（宣告代表即可）
  {
    key: "wasteTruck", param: "wasteOrbScale", to: 0.5,
    paths: { "refs.wasteOrbScale": 0.5 },
  },
  { key: "wasteTruck", param: "wasteNoteSize", to: 1.5, paths: { "refs.wasteNoteSize": 1.5 } },
  {
    key: "wasteTruck", param: "wasteNoteZOffset", to: 150,
    paths: { "refs.wasteNoteZOffset": 150 },
  },
  // 8 區分組預設**全開** → 關掉一個，剩下 7 個的城市（順序 = BUS_GROUP_ORDER）
  ...BUS_GROUP_ORDER.map((g) => ({
    key: "wasteSchedule",
    param: `wasteScheduleGroup${g}`,
    to: false,
    paths: { enabledWasteScheduleCities: wasteCitiesExcept(g) },
  })),
  // 13 個子層 × 3（焚化爐 4）—— 每個值同時出現在 `wasteSubParams` 與它的鏡像 ref
  ...WASTE_SUB_KEYS.flatMap((k) => [
    wasteSubChannel(k, "Size", 2.5),
    wasteSubChannel(k, "Opacity", 0.25),
    wasteSubChannel(k, "Altitude", 100),
  ]),
  wasteSubChannel("wfIncinerator", "RingSize", 3),
];

/** 一個廢棄物子層參數同時餵兩條路徑：`wasteSubParams` 本體與它的鏡像 ref */
function wasteSubChannel(
  key: string,
  field: "Size" | "Opacity" | "Altitude" | "RingSize",
  to: number,
): ReturnChannel {
  const prop = field.charAt(0).toLowerCase() + field.slice(1);
  return {
    key,
    param: `${key}${field}`,
    to,
    paths: {
      [`wasteSubParams.${key}.${prop}`]: to,
      [`refs.wasteSubParams.${key}.${prop}`]: to,
    },
  };
}

/** 關掉一個分組後剩下的垃圾車表定城市（順序 = BUS_GROUP_ORDER） */
function wasteCitiesExcept(off: BusGroup): string[] {
  return BUS_GROUP_ORDER.filter((g) => g !== off).flatMap((g) => WASTE_GROUP_CITIES[g]);
}

/**
 * 分組 → 城市清單（`enabledBusCities` 的期望值）。
 * 城市名取自與 hook 同一份 SSOT（`BUS_GROUP_CITIES`），但**展開順序**是本表寫死的 ——
 * 順序錯（hook 沒照 BUS_GROUP_ORDER 展開）照樣會紅。
 */
function busCitiesOf(...groups: BusGroup[]): string[] {
  return groups.flatMap((g) => BUS_GROUP_CITIES[g]);
}

/**
 * 值不進 overlayParams、也不進回傳物件，消費者在 hook **內部**的參數。
 * 每一個都要註明消費者是誰 —— 這是完整性規則唯一的例外口，不寫理由不准加。
 */
const INTERNAL_CONSUMERS: Record<string, string> = {};

// ══════════════════════════════════════════════════════════════════
//  A. 預設值下的凍結字面
// ══════════════════════════════════════════════════════════════════
/**
 * 預設值下 `useTransportParams()` 的回傳物件（扣掉 `overlayParams`，它另有兩條）。
 * 函式欄位一律 `"__FN__"`（`sanitize` 的慣例）；`refs.x` 已攤平成 `x.current` 的值。
 *
 * ⚠️ 更新這份字面 = 宣告「回傳給整個 app 的預設值有意識地改了」。遷移**不該**改到它，
 * 改到就是 P3-2A 那類「編得過但值悄悄不一樣」。
 */
const DEFAULT_RETURN = {
  aqiImageryOpacity: 0.7,
  aqiMicroCluster: true,
  aqiMicroModeIdx: 0,
  aspectVectorOpacity: 0.6,
  cwaCloudOpacity: 1,
  cwaRadarOpacity: 0.85,
  daOpacity: 1,
  enabledBusCities: ["Taipei", "NewTaipei"],
  enabledWasteScheduleCities: [
    "臺北市", "新北市", "基隆市", "宜蘭縣", "桃園市", "新竹市", "新竹縣", "苗栗縣",
    "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市",
    "屏東縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
  ],
  eqOpacity: 1,
  eqReplayOpacity: 0.95,
  eqShowHistory: false,
  getControls: "__FN__",
  h3Params: { contrast: 1.8, elevationScale: 50, extruded: false, metric: "day", opacity: 0.6 },
  hillshadeOpacity: 0.5,
  indicatorsParams: {
    category: "count", contrast: 1.8, elevationScale: 50, extruded: false,
    metric: "hh", opacity: 0.6,
  },
  newsEventsOnly: true,
  newsMinRelevance: 3,
  newsMinSeverity: 1,
  newsRipple: true,
  newsTimeBased: true,
  plaOpacity: 0.6,
  plaReplay: false,
  plaShowReview: false,
  plaTrailDays: 1,
  // ⚠️ 7 個介質但控件只有 5 個（`FACILITY_MEDIA`）—— noise / other 沒有控件、
  //    恆為 false，遷移時要記得它們是常數而不是 store 參數。
  pollutionFacilityMedia: {
    air: true, noise: false, other: false, soil: true, toxic: true, waste: true, water: true,
  },
  pollutionFacilityMinSev: 0,
  pollutionPenaltyMediumIdx: 0,
  pollutionPenaltyMode: 1,
  // ⚠️ 預設是 clamp(今年, 2010, PENALTY_YEAR_MAX) —— 被上限夾住才穩定，
  //    下方有一條 guard 專門盯這件事（同黃金快照的做法）。
  pollutionPenaltyYear: 2026,
  pollutionSiteActiveOnly: true,
  popCountParams: { contrast: 1.8, elevationScale: 50, extruded: false, opacity: 0.6 },
  railTrackMode: "3d",
  reOpacity: 1,
  refs: {
    airportPillarHeight: 0.6,
    airportPillarVisible: false,
    altExag: 3,
    altOffset: 50,
    beamDistance: 0.9,
    beamOpacity: 0.1,
    beamVisible: true,
    busAltOffset: 0,
    busColorMode: "route",
    busIntercityAltOffset: 0,
    busIntercityColorMode: "route",
    busIntercityOrbScale: 0.000004,
    busOrbScale: 0.000004,
    fireStations3D: true,
    fireStationsOpacity: 0.85,
    fireStationsScale: 1,
    metroPillarHeight: 0.2,
    metroPillarVisible: false,
    orbScale: 0.000005,
    portPillarHeight: 0.3,
    portPillarVisible: false,
    railAltOffset: 110,
    railOrbScale: 0.00001,
    railTrackMode: "3d",
    railTrackOpacity: 0.35,
    railTrainVisible: true,
    shipOrbScale: 0.000003,
    shipTrailOpacity: 0.15,
    staticOpacity: 0.1,
    tempExtruded: true,
    tempHeight: 200,
    tempOpacity: 0.85,
    tempWireframe: false,
    tempZOffset: 300,
    thsrPillarHeight: 0.6,
    thsrPillarVisible: true,
    touristShuttleAltOffset: 0,
    touristShuttleColorMode: "route",
    touristShuttleOpacity: 0.85,
    touristShuttleOrbScale: 0.000004,
    traPillarHeight: 0.5,
    traPillarVisible: true,
    wasteNoteSize: 0.7,
    wasteNoteZOffset: 70,
    wasteOrbScale: 0.15,
    wasteSubParams: wasteSubDefaults(),
  },
  satOpacity: 1,
  setNewsEventsOnly: "__FN__",
  setNewsMinRelevance: "__FN__",
  setNewsMinSeverity: "__FN__",
  slopeVectorOpacity: 0.6,
  socioParams: {
    contrast: 1.8, elevationScale: 50, extruded: false, metric: "im", opacity: 0.6,
  },
  spatialParams: {
    contrast: 1.8, elevationScale: 50, extruded: false, metric: "hp", opacity: 0.6,
  },
  stationScale: 1,
  tempGridOpacity: 0.7,
  wasteSubParams: wasteSubDefaults(),
  ybResolution: 7,
  youbikeParams: {
    contrast: 1, elevationScale: 80, extruded: true, heightMode: "mixed", opacity: 0.65,
  },
} as const;

/** 13 個廢棄物子層的 size/opacity/altitude(/ringSize)；`wasteSubParams` 與其 ref 共用同一份 */
function wasteSubDefaults() {
  return {
    wdBattery: { altitude: 0, opacity: 0.9, size: 1.5 },
    wdClothes: { altitude: 0, opacity: 0.7, size: 1 },
    wdMixed: { altitude: 0, opacity: 0.7, size: 1 },
    wdRecyclingContainer: { altitude: 0, opacity: 0.85, size: 1 },
    // ⚠️ 只有焚化爐有第 4 個參數（底圈）—— 其餘 12 個**沒有這個欄位**，
    //    不是 undefined。canonical 快照分得出兩者。
    wfIncinerator: { altitude: 0, opacity: 0.85, ringSize: 1, size: 1 },
    wfLandfill: { altitude: 0, opacity: 0.45, size: 1 },
    wfLandfillCoastal: { altitude: 0, opacity: 0.55, size: 1 },
    wfMedical: { altitude: 0, opacity: 0.85, size: 1 },
    wfMonitoring: { altitude: 0, opacity: 0.7, size: 1 },
    wfOther: { altitude: 0, opacity: 0.7, size: 1 },
    wfRecycling: { altitude: 0, opacity: 0.85, size: 1 },
    wfScrapYard: { altitude: 0, opacity: 0.85, size: 1 },
    wfTransfer: { altitude: 0, opacity: 0.85, size: 1 },
  };
}

/**
 * `overlayParams` 的 canonical sha256。
 *
 * ⚠️ 這個值在**整個 P3-2D 都不該變**：D 桶的參數要嘛沿用原本的 out key、
 * 要嘛宣告 `out: null`（本來就不在 overlayParams 裡）。變了就是多／少餵了 paint 一個輸入。
 * 它同時是 P3-2C 突變 (i)（`encodeParamsToOverlay` 跟著 `showWhen` 少編欄位）的專屬閘 ——
 * 那個突變黃金快照不紅，這條會。
 */
const OVERLAY_SHA256 = "499cc79b63daa387d9566d9f295fd3c8079a8d9a81c9f33fa195221321e356e6";
const OVERLAY_KEY_COUNT = 539;

// ══════════════════════════════════════════════════════════════════
//  capture
// ══════════════════════════════════════════════════════════════════

interface Captured {
  /** sanitize 過的全部回傳欄位（refs 已攤平成當下值），含 overlayParams */
  snapshot: Record<string, unknown>;
  overlayParams: Record<string, number>;
}

/**
 * 實跑 hook 拿回傳物件（等價 renderHook；本專案沒有 jsdom，黃金快照抽取器也是這招）。
 *
 * ⚠️ 每次都是全新 mount —— 這正是「`useRef` 的 initial 不准讀 store」那條慣例的理由。
 */
function capture(): Captured {
  let captured: unknown = null;
  function Probe() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    captured = useTransportParams();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (!captured) throw new Error("useTransportParams probe 沒有捕捉到回傳值");
  const api = captured as ReturnType<typeof useTransportParams>;
  const snapshot = sanitize(api) as Record<string, unknown>;
  // refs 攤平：`{ altExag: { current: 3 } }` → `{ altExag: 3 }`。
  // 路徑因此是 `refs.altExag`，RETURN_CHANNEL 的宣告也照這個寫法。
  const refs = snapshot["refs"] as Record<string, { current: unknown }>;
  snapshot["refs"] = Object.fromEntries(
    Object.entries(refs).map(([k, v]) => [k, v?.current]),
  );
  return { snapshot, overlayParams: api.overlayParams as Record<string, number> };
}

// ── 路徑工具 ──────────────────────────────────────────────────────

/** 巢狀物件攤平成 `a.b.c` → 值；**陣列當成葉節點**（整包比對，不逐 index 展開） */
function flatten(value: unknown, prefix = "", out: Map<string, unknown> = new Map()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out.set(prefix, value);
  return out;
}

/** 兩份快照之間「值不同 ／ 只存在於一邊」的路徑 */
function changedPaths(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const fa = flatten(a);
  const fb = flatten(b);
  const keys = new Set([...fa.keys(), ...fb.keys()]);
  const out: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(fa.get(k)) !== JSON.stringify(fb.get(k))) out.push(k);
  }
  return out.sort();
}

// ── 擾動值 ────────────────────────────────────────────────────────

/** step 的小數位數（`0.000001` → 6）—— 避免 `0.85 + 0.05` 產生 0.899999… 的浮點雜訊 */
function decimals(step: number): number {
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return s.includes(".") ? (s.split(".")[1] as string).length : 0;
}

/**
 * 給一個參數挑「與預設不同」的擾動值。
 * slider 走一個 step（撞到上限就往下走）、toggle 取反、select 取第一個非預設選項。
 * 挑不出來（select 只有一個選項）回 null → 該參數跳過（另有斷言盯著這種形狀）。
 */
function perturbFor(spec: LayerParamSpec): ParamValue | null {
  switch (spec.kind) {
    case "slider": {
      const up = spec.default + spec.step;
      const raw = up <= spec.max ? up : spec.default - spec.step;
      const v = Number(raw.toFixed(decimals(spec.step)));
      return v === spec.default || v < spec.min || v > spec.max ? null : v;
    }
    case "toggle":
      return !spec.default;
    case "select": {
      const alt = spec.options.find((o) => o.value !== spec.default);
      return alt ? alt.value : null;
    }
  }
}

// ══════════════════════════════════════════════════════════════════

const specs = MIGRATED_PARAMS_KEYS.flatMap((key) =>
  (LAYER_PARAMS_SPEC[key] as LayerParamSpec[]).map((spec) => ({ key: key as string, spec })),
);

beforeEach(() => layerParamsStore.reset());
afterAll(() => layerParamsStore.reset());

describe("A. 預設值下的回傳物件逐欄位等值", () => {
  it("非 overlayParams 的全部欄位 ＝ 凍結字面（refs 當下值／六個子物件／派生陣列）", () => {
    const { snapshot } = capture();
    const { overlayParams: _ignored, ...rest } = snapshot;
    expect(rest).toEqual(DEFAULT_RETURN);
  });

  it("overlayParams 的 key 集合 ⊇ 全部 spec 的 out key（隱藏的控件照樣要編碼）", () => {
    const { overlayParams } = capture();
    // ⚠️ `showWhen` 收合中的控件其值**仍須**進 overlayParams（手寫版是無條件寫進
    //    那個 useMemo 字面的）。P3-2C 的突變 (i) 就是讓編碼跟著 showWhen 走 ——
    //    黃金快照沒紅，這條會。
    const missing = specs
      .map(({ spec }) => specOutKey(spec))
      .filter((o): o is string => o !== null)
      .filter((o) => !(o in overlayParams))
      .sort();
    expect(missing, "spec 宣告了 out 但 overlayParams 裡沒有").toEqual([]);
    expect(Object.keys(overlayParams).length).toBe(OVERLAY_KEY_COUNT);
  });

  it("overlayParams 逐位元（canonical sha256）＝ 凍結值", () => {
    const { overlayParams } = capture();
    const hash = createHash("sha256").update(canonicalJson(sanitize(overlayParams))).digest("hex");
    expect(hash, "overlayParams 內容變了 —— paint 的輸入面改變，遷移不該做到這件事").toBe(OVERLAY_SHA256);
  });

  it("guard：pollutionPenaltyYear 的預設仍被 PENALTY_YEAR_MAX 夾住（凍結字面的穩定性前提）", () => {
    // 預設是 clamp(今年, MIN, MAX)。哪天上限被調到今年之後，這個字面就會隨年份漂移，
    // 屆時要改的是這個 guard 與字面，而不是把整條斷言拿掉。
    expect(new Date().getFullYear()).toBeGreaterThanOrEqual(PENALTY_YEAR_MAX);
    expect(DEFAULT_RETURN.pollutionPenaltyYear).toBe(PENALTY_YEAR_MAX);
  });
});

describe("B. 逐參數隔離擾動：每個已遷移參數的值都要流到宣告的通道", () => {
  /** (key, param) → 這個參數宣告的第二通道路徑（共用 slot 展開後取聯集） */
  function declaredFor(key: string, name: string): Record<string, unknown> {
    const members = sharedSlotMembers(key, name) ?? [{ key, name }];
    const out: Record<string, unknown> = {};
    for (const m of members) {
      for (const ch of RETURN_CHANNEL) {
        if (ch.key === m.key && ch.param === m.name) Object.assign(out, ch.paths);
      }
    }
    return out;
  }

  /** 宣告表指定的擾動值（沒宣告就用機械挑的） */
  function perturbValue(key: string, name: string, spec: LayerParamSpec): ParamValue | null {
    const members = sharedSlotMembers(key, name) ?? [{ key, name }];
    for (const m of members) {
      const ch = RETURN_CHANNEL.find((c) => c.key === m.key && c.param === m.name);
      if (ch) return ch.to;
    }
    return perturbFor(spec);
  }

  it("擾動任一參數後，回傳物件『恰好』只有宣告的路徑改變（含 overlayParams.<out>）", () => {
    const base = capture().snapshot;
    const failures: string[] = [];

    for (const { key, spec } of specs) {
      const to = perturbValue(key, spec.name, spec);
      if (to === null) continue;
      layerParamsStore.reset();
      layerParamsStore.setParam(key, spec.name, to);
      const { snapshot } = capture();

      const outKey = specOutKey(spec);
      const declared = declaredFor(key, spec.name);
      const expectedPaths = [
        ...(outKey === null ? [] : [`overlayParams.${outKey}`]),
        ...Object.keys(declared),
      ].sort();
      const actualPaths = changedPaths(base, snapshot);

      if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
        failures.push(
          `${key}.${spec.name} → 改變的路徑 ${JSON.stringify(actualPaths)}` +
          ` ≠ 宣告的 ${JSON.stringify(expectedPaths)}`,
        );
        continue;
      }
      // 值層：接到「別人的」欄位光看路徑集合看不出來，要逐路徑對期望值
      const flat = flatten(snapshot);
      if (outKey !== null) {
        const want = encodeParamValue(spec, to);
        const got = flat.get(`overlayParams.${outKey}`);
        if (got !== want) {
          failures.push(`${key}.${spec.name} → overlayParams.${outKey} = ${got}，期望 ${want}`);
        }
      }
      for (const [path, want] of Object.entries(declared)) {
        const got = flat.get(path);
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          failures.push(
            `${key}.${spec.name} → ${path} = ${JSON.stringify(got)}，期望 ${JSON.stringify(want)}`,
          );
        }
      }
    }

    expect(
      failures,
      "值沒有從 store 流到宣告的通道（或流到了沒宣告的地方）——" +
      "D 桶最危險的形狀：tsc 綠、黃金快照綠、畫面壞掉",
    ).toEqual([]);
  });

  it("完整性：每個參數都要有去處（overlayParams ／ RETURN_CHANNEL ／ 內部消費者）", () => {
    const orphans = specs
      .filter(({ key, spec }) => {
        if (specOutKey(spec) !== null) return false;
        if (Object.keys(declaredFor(key, spec.name)).length > 0) return false;
        return !(`${key}.${spec.name}` in INTERNAL_CONSUMERS);
      })
      .map(({ key, spec }) => `${key}.${spec.name}`)
      .sort();
    expect(
      orphans,
      "這些參數宣告了 out: null 又沒有第二通道 —— 搬進 store 卻沒接回去，" +
      "面板拖得動、值到不了任何消費者",
    ).toEqual([]);
  });

  it("宣告表本身要對得上規格（打錯 key／參數名不會靜默失效）", () => {
    for (const ch of [...RETURN_CHANNEL]) {
      const spec = (LAYER_PARAMS_SPEC[ch.key as keyof typeof LAYER_PARAMS_SPEC] as
        LayerParamSpec[] | undefined)?.find((s) => s.name === ch.param);
      expect(spec, `RETURN_CHANNEL 有 ${ch.key}.${ch.param}，但規格裡查無此參數`).toBeDefined();
      expect(
        Object.keys(ch.paths).length,
        `RETURN_CHANNEL 的 ${ch.key}.${ch.param} 沒宣告任何路徑`,
      ).toBeGreaterThan(0);
    }
    for (const id of Object.keys(INTERNAL_CONSUMERS)) {
      const [key, name] = id.split(".");
      const spec = (LAYER_PARAMS_SPEC[key as keyof typeof LAYER_PARAMS_SPEC] as
        LayerParamSpec[] | undefined)?.find((s) => s.name === name);
      expect(spec, `INTERNAL_CONSUMERS 有 ${id}，但規格裡查無此參數`).toBeDefined();
      expect(INTERNAL_CONSUMERS[id]?.length, `${id} 沒寫消費者是誰`).toBeGreaterThan(0);
    }
  });

  // 哨兵：擾動挑不出值（select 只有一個選項）的參數若變多，上面那條會悄悄少驗一批。
  it("哨兵：擾動值挑得出來的參數數量（挑不出來的會被整個跳過）", () => {
    const skipped = specs
      .filter(({ spec }) => perturbFor(spec) === null)
      .map(({ key, spec }) => `${key}.${spec.name}`);
    expect(skipped, "這些參數挑不出擾動值 → B 完全沒驗到它們").toEqual([]);
    // 現況 262 key / 547 參數；D 桶搬完只會更多。門檻只防「規格表被清空／載入失敗」。
    expect(specs.length).toBeGreaterThan(500);
  });
});
