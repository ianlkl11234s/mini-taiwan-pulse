// ══════════════════════════════════════════════════════════════════
//  Layer Params Spec — 參數控件的宣告式規格（AR-22 Phase 3 / P3-1）
// ══════════════════════════════════════════════════════════════════
//
// `useTransportParams.ts` 是本專案唯一認定的大型結構債：單一函式 3,079 行、
// 644 個 useState、539 項手寫 deps。它把三件事焊死在一起：
//
//   (1) 參數的**值**（per-layer useState）
//   (2) 參數的**控件長相**（getControls 的巨型 switch）
//   (3) 參數餵給 paint 的**編碼**（overlayParams useMemo + 手寫 deps）
//
// 三者其實是同一份事實的三種投影。本檔把那份事實宣告成資料，讓
// `state/layerParamsStore.ts` 從 (1) 派生值、`buildParamControls` 從 (2) 派生控件、
// `encodeParamsToOverlay` 從 (3) 派生 overlayParams 分片。
//
// ── 為什麼不寫進 `layerManifest.ts` ────────────────────────────────
// manifest 的 `params` 欄位是 `{ count, kinds }` 佔位（Phase 1 定的），只記形狀
// 不記內容 —— 它**沒有** default / min / max / step / label / options，
// 所以「從 manifest 的 default 起手」在現況是做不到的。
//
// 而把完整規格塞進 manifest 會直接撞上它自己的 import 鐵則
// （「只能 import ../types、lucide-react、零 import 的純色票常數檔」）：
// select 的 options 來自 `pollutionTypes` / `cropSuitabilityCrops` /
// `fireIsochroneCounties` 等一二十個資料模組，其中有些自帶函式與相依，
// 全拉進 manifest 會製造 import cycle，也讓一個 9,330 行的檔繼續膨脹。
//
// 因此規格獨立成本檔，並用契約測試**焊回 manifest**：
// `layerParamsSpec.test.ts` 斷言「spec 派生的 count / kinds ＝ manifest 宣告的
// count / kinds」。manifest 仍是形狀的 SSOT，本檔是內容的 SSOT，兩者對不上會紅。
//
// ── 等價證明 ───────────────────────────────────────────────────────
// 黃金快照的 `params` section（348 key × getControls 輸出，onChange 已剔除）
// 是這份規格的機械等價目標。搬一個 key 進本檔、從 switch 刪掉它的 case，
// fixture 必須**一位元不變**。

import type { LayerVisibility } from "../types";
import {
  DEITY_FAMILIES, REGISTRY_MODES, REGISTRY_MODES_ANCESTRAL,
} from "./religionTypes";
import {
  FUNERAL_FACILITY_TYPES, OPERATOR_STATUS_MODES, PRECISION_MODES,
} from "./funeralTypes";
import { FIRE_ISOCHRONE_COUNTY_OPTIONS } from "./fireIsochroneCounties";
import { URBAN_HEAT_MODES } from "./urbanHeatTypes";
import { SOIL_FERTILITY_METRIC_OPTIONS } from "./agriSoilFertilityMetrics";
import { MOUNTAIN_RESCUE_YEARS } from "./mountainSafetyTypes";
import {
  PROTECTED_TREE_CITIES, RIVERSIDE_PARKS, TAIPEI_PARK_CATEGORIES,
  STREET_TREE_3EPOCH_TRAJ_FILTERS, STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES,
} from "./urbanOpenSpaceTypes";
import { CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES } from "./cultureTypes";
import { URBAN_FORM_GRID_MODES } from "./urbanFormGridTypes";
import { URBAN_ZONING_CATEGORIES } from "./urbanZoningTypes";
import { NON_URBAN_ZONING_CODES } from "./nonUrbanZoningTypes";

/** select 的選項；形狀與 `SelectConfig["options"]` 相同（disabled 由控件端消費） */
export interface ParamSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/**
 * ⚠️ 共用 slot（`sharedGroup`）—— 三種 spec 共通的選填欄位。
 *
 * `useTransportParams` 有一種形狀是 **多個 layer key 共用同一個 `useState`**：
 * ```ts
 * case "eduKindergarten":
 * case "eduAfterschoolCare":
 * case "eduMutualCare": return [ slider(eduChildcareOpacity) ];   // 一份值、三個面板
 * ```
 * （另有非 fall-through 的變體：`medIsochrone` / `medDesert` 各自 `case`
 * 但讀寫同一個 `medIsochroneOpacity`。）
 *
 * 這種形狀**不能**用 per-key spec 直接搬：三個 key 各存一份值、卻都宣告同一個
 * `out`，`encodeParamsToOverlay` 後寫者覆蓋前寫者 → **拖其中一個面板，paint 不動、
 * 其他面板也不動**，而黃金快照（比的是預設值，三份天生相等）與 tsc 都不會紅。
 *
 * 表達方式：三個 key 的該參數填**同一個 `sharedGroup` id**（慣例取共用的參數名）。
 * store 的 `setParam` 會把同群成員一起寫、一起通知 —— 行為與共用一個 `useState`
 * 逐字等價。護欄見 `state/__tests__/layerParamsSharedState.test.ts`。
 */
interface SharedSlotField {
  /** 共用 slot 的群組 id；省略 = 本 key 獨佔這份值 */
  sharedGroup?: string;
}

/**
 * 數值滑桿。
 *
 * ⚠️ label 是**模板**不是字面：現行手寫 case 一律寫成
 * `` `透明度 ${x.toFixed(2)}` `` / `` `大小 ${x.toFixed(1)}` `` ——
 * 小數位數逐控件不同（透明度 2 位、大小 1 位），漏掉就會產生
 * 「編得過但字串悄悄不一樣」的漂移，正是本工程要消滅的那一類。
 */
export interface SliderParamSpec extends SharedSlotField {
  kind: "slider";
  /** 參數名。慣例沿用舊 useState 變數名 —— 它同時是 overlayParams 的預設 key */
  name: string;
  /** label 前綴；實際 label = `${labelPrefix} ${value.toFixed(digits)}` */
  labelPrefix: string;
  /** `toFixed` 位數 */
  digits: number;
  default: number;
  min: number;
  max: number;
  step: number;
  /** overlayParams 的 key（省略 = 用 `name`，這是 slider 的常態） */
  out?: string;
}

/**
 * 布林開關。
 *
 * ⚠️ overlayParams 的契約是 `Record<string, number>` —— boolean **必須**編成 0/1
 * 才餵得進 paint expression。編碼由 `encodeParamsToOverlay` 統一做，
 * 規格端只宣告 `out`（省略 = 用 `name`）。
 */
export interface ToggleParamSpec extends SharedSlotField {
  kind: "toggle";
  name: string;
  label: string;
  default: boolean;
  out?: string;
}

/**
 * 下拉選單。**值是字串、餵進 paint 的是 index** —— 這是全檔最容易漂移的一環。
 *
 * `encode` 必須與現行 overlayParams 裡那條 `.indexOf(...)` 的陣列**逐位相同**。
 * 常見兩種形狀：
 *   - `OPTIONS.map((o) => o.value)`（選項陣列自己就含「全部」）
 *   - `["all", ...OPTIONS.map((o) => o.value)]`（「全部」是控件端才 prepend 的）
 * 兩者的 idx 會整體位移 1，抄錯不會編譯錯、只會讓篩選整個錯位。
 */
export interface SelectParamSpec extends SharedSlotField {
  kind: "select";
  name: string;
  label: string;
  default: string;
  options: ParamSelectOption[];
  /** overlayParams 的 key。慣例 `${name}Idx` —— 與 `name` **不同名**，故必填 */
  out: string;
  /** value → index 的編碼順序 */
  encode: string[];
}

export type LayerParamSpec = SliderParamSpec | ToggleParamSpec | SelectParamSpec;

/** 控件值的三種形狀（與三種 spec 一一對應） */
export type ParamValue = number | string | boolean;

/** 單一 layer 的全部參數值 */
export type LayerParamValues = Readonly<Record<string, ParamValue>>;

// ── 共用建構子：同構家族避免逐層複製字面 ──────────────────────────

/** 「透明度 x.xx」滑桿 —— 宗教／殯葬兩組全部都有，只有 default 不同 */
function opacitySlider(name: string, def: number): SliderParamSpec {
  return {
    kind: "slider", name, labelPrefix: "透明度", digits: 2,
    default: def, min: 0.1, max: 1, step: 0.05,
  };
}

/** 「大小 x.x」滑桿 —— 點層專用（面層沒有） */
function scaleSlider(name: string, def: number): SliderParamSpec {
  return {
    kind: "slider", name, labelPrefix: "大小", digits: 1,
    default: def, min: 0.3, max: 3, step: 0.1,
  };
}

const REGISTRY_ENCODE = REGISTRY_MODES.map((m) => m.value);
const PRECISION_ENCODE = PRECISION_MODES.map((m) => m.value);

// ── 規格表 ────────────────────────────────────────────────────────

/**
 * 已遷移到 store 的 key。**沒列在這裡的 key 一律走 `useTransportParams` 既有的
 * switch/useState**（雙軌）—— 這張表就是雙軌的判別式。
 *
 * ⚠️ 陣列順序 = 控件在面板上的顯示順序，也是黃金快照比對的順序。
 */
export const LAYER_PARAMS_SPEC = {
  // ══════════ 宗教 Religion 6 層 ══════════
  religionTemples: [
    // 10 選項（全部 + 9 族）與 3 選項登記態；前者 > 3 自動走原生 select（四鐵則 #4）
    {
      kind: "select", name: "religionTemplesDeity", label: "主祀", default: "all",
      options: [
        { label: "全部", value: "all" },
        ...DEITY_FAMILIES.map((d) => ({ label: d.label, value: d.value })),
      ],
      out: "religionTemplesDeityIdx",
      encode: ["all", ...DEITY_FAMILIES.map((d) => d.value)],
    },
    {
      kind: "select", name: "religionTemplesRegistry", label: "登記", default: "all",
      options: REGISTRY_MODES,
      out: "religionTemplesRegistryIdx", encode: REGISTRY_ENCODE,
    },
    opacitySlider("religionTemplesOpacity", 0.8),
    scaleSlider("religionTemplesScale", 1),
  ],
  religionChurches: [
    {
      kind: "select", name: "religionChurchesRegistry", label: "登記", default: "all",
      options: REGISTRY_MODES,
      out: "religionChurchesRegistryIdx", encode: REGISTRY_ENCODE,
    },
    opacitySlider("religionChurchesOpacity", 0.85),
    scaleSlider("religionChurchesScale", 1),
  ],
  religionAncestralHalls: [
    // ⚠️ 本層 false 是「文資祠堂」不是 OSM，故**顯示**用 REGISTRY_MODES_ANCESTRAL 的標籤；
    //    但 **編碼**沿用 REGISTRY_MODES（現行 overlayParams 就是這樣寫的）。
    //    兩張表的 value 序列相同（all/registered/unregistered），差別只在 label —— 但
    //    「顯示表」與「編碼表」是兩件事，寫成同一個會在其中一張改動時靜默錯位。
    {
      kind: "select", name: "religionAncestralHallsRegistry", label: "類型", default: "all",
      options: REGISTRY_MODES_ANCESTRAL,
      out: "religionAncestralHallsRegistryIdx", encode: REGISTRY_ENCODE,
    },
    opacitySlider("religionAncestralHallsOpacity", 0.9),
    scaleSlider("religionAncestralHallsScale", 1),
  ],
  religionFoundations: [
    opacitySlider("religionFoundationsOpacity", 0.9),
    scaleSlider("religionFoundationsScale", 1),
  ],
  religionOtherWorship: [
    opacitySlider("religionOtherWorshipOpacity", 0.85),
    scaleSlider("religionOtherWorshipScale", 1),
  ],
  religionTop100: [
    opacitySlider("religionTop100Opacity", 0.85),
    scaleSlider("religionTop100Scale", 1),
  ],

  // ══════════ 殯葬 Funeral 5 層 ══════════
  funeralFacilities: [
    {
      kind: "select", name: "funeralFacilitiesType", label: "類型", default: "all",
      options: [
        { label: "全部", value: "all" },
        ...FUNERAL_FACILITY_TYPES.map((t) => ({
          label: `${t.label} (${t.count.toLocaleString()})`, value: t.value,
        })),
      ],
      out: "funeralFacilitiesTypeIdx",
      encode: ["all", ...FUNERAL_FACILITY_TYPES.map((t) => t.value)],
    },
    // ⚠️ 42% 是地籍/鄉鎮中心的概略座標 → 做距離分析前先切「僅精確定位」（handoff §3.5）
    {
      kind: "select", name: "funeralFacilitiesPrecision", label: "定位精度", default: "all",
      options: PRECISION_MODES,
      out: "funeralFacilitiesPrecisionIdx", encode: PRECISION_ENCODE,
    },
    opacitySlider("funeralFacilitiesOpacity", 0.85),
    scaleSlider("funeralFacilitiesScale", 1),
  ],
  funeralOperators: [
    // ⚠️ 預設「仍營業」—— 切到「全部」會多出 1,664 個已失效業者（產業消長分析用）
    {
      kind: "select", name: "funeralOperatorsStatus", label: "營業狀態", default: "active",
      options: OPERATOR_STATUS_MODES,
      out: "funeralOperatorsStatusIdx",
      encode: OPERATOR_STATUS_MODES.map((m) => m.value),
    },
    {
      kind: "select", name: "funeralOperatorsPrecision", label: "定位精度", default: "all",
      options: PRECISION_MODES,
      out: "funeralOperatorsPrecisionIdx", encode: PRECISION_ENCODE,
    },
    opacitySlider("funeralOperatorsOpacity", 0.8),
    scaleSlider("funeralOperatorsScale", 1),
  ],
  funeralOperatorDensity: [opacitySlider("funeralOperatorDensityOpacity", 0.6)],
  cemeteryOsm: [opacitySlider("cemeteryOsmOpacity", 0.45)],
  cemeteryZoning: [opacitySlider("cemeteryZoningOpacity", 0.55)],

  // ══════════ 交通・醫療・公共設施・教育 ══════════
  bikeStations: [
    { kind: "slider", name: "bikeScale", labelPrefix: "Bike", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  highways: [
    { kind: "slider", name: "highwayWidth", labelPrefix: "Width", digits: 1, default: 0.6, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "highwayGlow", labelPrefix: "Glow", digits: 1, default: 0.3, min: 0, max: 3, step: 0.1 },
  ],
  provincialRoads: [
    { kind: "slider", name: "provincialWidth", labelPrefix: "Width", digits: 1, default: 0.6, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "provincialGlow", labelPrefix: "Glow", digits: 1, default: 0.2, min: 0, max: 3, step: 0.1 },
  ],
  cyclingRoutes: [
    { kind: "slider", name: "cyclingWidth", labelPrefix: "Cycling", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  freewayCongestion: [
    { kind: "slider", name: "freewayWidth", labelPrefix: "Freeway", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  roadCongestion: [
    { kind: "slider", name: "roadCongestionWidth", labelPrefix: "寬度", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("roadCongestionOpacity", 0.85),
  ],
  weatherStations: [
    { kind: "slider", name: "weatherScale", labelPrefix: "Weather", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  fireEvents: [opacitySlider("fireEventsOpacity", 1)],
  fireLatest: [opacitySlider("fireLatestOpacity", 1)],
  erHospital: [opacitySlider("erHospitalOpacity", 0.85)],
  librarySeats: [opacitySlider("librarySeatsOpacity", 0.9)],
  parkingOnstreet: [opacitySlider("parkingOnstreetOpacity", 0.6)],
  parkingOffstreet: [opacitySlider("parkingOffstreetOpacity", 0.9)],
  medHospital: [opacitySlider("medHospitalOpacity", 0.9), scaleSlider("medHospitalScale", 1.0)],
  medClinic: [opacitySlider("medClinicOpacity", 0.85), scaleSlider("medClinicScale", 1.0)],
  medPharmacy: [opacitySlider("medPharmacyOpacity", 0.85), scaleSlider("medPharmacyScale", 1.0)],
  medAED: [opacitySlider("medAEDOpacity", 0.9), scaleSlider("medAEDScale", 1.0)],
  medLTC: [opacitySlider("medLTCOpacity", 0.85), scaleSlider("medLTCScale", 1.0)],
  serviceAreaPolygon: [
    { kind: "slider", name: "serviceAreaPolygonOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.2, min: 0, max: 0.6, step: 0.02 },
    { kind: "slider", name: "serviceAreaPolygonLineWidth", labelPrefix: "邊框寬", digits: 1, default: 1.5, min: 0, max: 4, step: 0.5 },
  ],
  eduCampusPolygon: [opacitySlider("eduCampusPolygonOpacity", 0.35)],
  eduCampusArea: [opacitySlider("eduCampusAreaOpacity", 0.55)],
  eduDistrictSenior: [opacitySlider("eduDistrictSeniorOpacity", 0.18)],
  eduCramSchool: [
    opacitySlider("eduCramSchoolOpacity", 0.75),
    { kind: "slider", name: "eduCramSchoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  eduUniversityStudents: [
    opacitySlider("eduUniversityStudentsOpacity", 0.6),
    { kind: "slider", name: "eduUniversityStudentsScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  convenienceStores: [
    { kind: "slider", name: "convenienceScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  postOffices: [opacitySlider("postOfficesOpacity", 0.85), scaleSlider("postOfficesScale", 1)],
  iPostBoxes: [opacitySlider("iPostBoxesOpacity", 0.85), scaleSlider("iPostBoxesScale", 1)],
  communityCenters: [
    opacitySlider("communityCentersOpacity", 0.85),
    scaleSlider("communityCentersScale", 1),
  ],
  govServiceOffices: [
    opacitySlider("govServiceOfficesOpacity", 0.9),
    scaleSlider("govServiceOfficesScale", 1),
  ],
  publicLibraries: [
    opacitySlider("publicLibrariesOpacity", 0.9),
    scaleSlider("publicLibrariesScale", 1),
  ],
  welfareCenters: [
    opacitySlider("welfareCentersOpacity", 0.9),
    scaleSlider("welfareCentersScale", 1),
  ],
  retailMarkets: [opacitySlider("retailMarketsOpacity", 0.9), scaleSlider("retailMarketsScale", 1)],
  publicToilets: [
    opacitySlider("publicToiletsOpacity", 0.75),
    scaleSlider("publicToiletsScale", 1),
  ],

  // ══════════ 天災・水利・農業・運動生態 ══════════
  earthquakesGlobal: [
    { kind: "slider", name: "earthquakesGlobalOpacity", labelPrefix: "透明度", digits: 2, default: 0.9, min: 0, max: 1, step: 0.05 },
  ],
  worldTrashDebris: [
    { kind: "slider", name: "worldTrashDebrisOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
  ],
  dustForecast: [
    { kind: "slider", name: "dustForecastOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0, max: 1, step: 0.05 },
  ],
  waterBasins: [
    { kind: "slider", name: "waterBasinOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0, max: 1, step: 0.05 },
  ],
  waterRivers: [
    { kind: "slider", name: "waterRiverWidth", labelPrefix: "寬度", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "waterRiverOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0, max: 1, step: 0.05 },
  ],
  waterCanals: [
    { kind: "slider", name: "waterCanalWidth", labelPrefix: "寬度", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "waterCanalOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0, max: 1, step: 0.05 },
  ],
  waterLevees: [
    { kind: "slider", name: "waterLeveeWidth", labelPrefix: "寬度", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "waterLeveeOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0, max: 1, step: 0.05 },
  ],
  waterProtectionZones: [
    { kind: "slider", name: "waterProtectionZoneOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0, max: 1, step: 0.05 },
  ],
  waterReservoirs: [
    { kind: "slider", name: "reservoirPillarHeight", labelPrefix: "水位計高度", digits: 2, default: 1.0, min: 0, max: 3, step: 0.1 },
  ],
  waterFacilities: [
    { kind: "slider", name: "waterFacilityScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("waterFacilityOpacity", 1.0),
  ],
  waterMonitorStations: [
    { kind: "slider", name: "waterMonitorScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("waterMonitorOpacity", 1.0),
  ],
  waterDetentionBasins: [
    { kind: "slider", name: "detentionBasinScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("detentionBasinOpacity", 1.0),
  ],
  lakesPondsOsm: [
    { kind: "slider", name: "lakesPondsOsmOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.5, min: 0, max: 0.85, step: 0.05 },
  ],
  rainGauge: [
    { kind: "slider", name: "rainGaugeScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("rainGaugeOpacity", 1.0),
  ],
  riverLevel: [
    { kind: "slider", name: "riverLevelScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("riverLevelOpacity", 1.0),
  ],
  groundwater: [
    { kind: "slider", name: "groundwaterScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("groundwaterOpacity", 1.0),
  ],
  groundwaterWells: [
    { kind: "slider", name: "groundwaterWellsScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("groundwaterWellsOpacity", 1.0),
  ],
  floodSensor: [
    { kind: "slider", name: "floodSensorScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("floodSensorOpacity", 1.0),
  ],
  floodSensorIsochrone: [opacitySlider("floodSensorIsochroneOpacity", 0.55)],
  taipeiSewer: [
    { kind: "slider", name: "taipeiSewerScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("taipeiSewerOpacity", 0.85),
  ],
  taipeiEvacuate: [
    { kind: "slider", name: "taipeiEvacuateScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("taipeiEvacuateOpacity", 0.9),
  ],
  taipeiPumb: [
    { kind: "slider", name: "taipeiPumbScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    opacitySlider("taipeiPumbOpacity", 0.9),
  ],
  agriSoil: [opacitySlider("agriSoilOpacity", 1.0)],
  agriLeisureFarmZones: [opacitySlider("agriLeisureFarmZonesOpacity", 1.0)],
  agriRuralRegen: [opacitySlider("agriRuralRegenOpacity", 1.0)],
  agriPOI: [
    opacitySlider("agriPOIOpacity", 1.0),
    { kind: "slider", name: "agriPOIScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  agriRetail: [
    opacitySlider("agriRetailOpacity", 0.85),
    { kind: "slider", name: "agriRetailScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  agriProduceWholesale: [
    opacitySlider("agriProduceWholesaleOpacity", 0.85),
    { kind: "slider", name: "agriProduceWholesaleScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  agriWholesaleMarket: [
    opacitySlider("agriWholesaleMarketOpacity", 0.9),
    { kind: "slider", name: "agriWholesaleMarketScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  livestockSlaughter: [
    opacitySlider("livestockSlaughterOpacity", 0.9),
    { kind: "slider", name: "livestockSlaughterScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  livestockFeed: [
    opacitySlider("livestockFeedOpacity", 0.9),
    { kind: "slider", name: "livestockFeedScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  livestockMarket: [
    opacitySlider("livestockMarketOpacity", 0.95),
    { kind: "slider", name: "livestockMarketScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  sportsSchool: [
    opacitySlider("sportsSchoolOpacity", 0.8),
    { kind: "slider", name: "sportsSchoolScale", labelPrefix: "大小", digits: 2, default: 0.5, min: 0.3, max: 3, step: 0.1 },
  ],
  sportsPublicOther: [
    opacitySlider("sportsPublicOtherOpacity", 0.8),
    { kind: "slider", name: "sportsPublicOtherScale", labelPrefix: "大小", digits: 2, default: 0.5, min: 0.3, max: 3, step: 0.1 },
  ],
  sportsPrivate: [
    opacitySlider("sportsPrivateOpacity", 0.8),
    { kind: "slider", name: "sportsPrivateScale", labelPrefix: "大小", digits: 2, default: 0.5, min: 0.3, max: 3, step: 0.1 },
  ],
  sportsPark: [
    opacitySlider("sportsParkOpacity", 0.8),
    { kind: "slider", name: "sportsParkScale", labelPrefix: "大小", digits: 2, default: 0.7, min: 0.3, max: 3, step: 0.1 },
  ],
  sportsCenter: [
    opacitySlider("sportsCenterOpacity", 0.85),
    { kind: "slider", name: "sportsCenterScale", labelPrefix: "大小", digits: 2, default: 0.9, min: 0.3, max: 3, step: 0.1 },
  ],
  farmRoads: [
    { kind: "slider", name: "farmRoadsWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("farmRoadsOpacity", 0.8),
  ],
  ecoNetworkZones: [opacitySlider("ecoNetworkZonesOpacity", 0.5)],

  // ══════════ 森林山域・能源電力航空 ══════════
  forestRoads: [
    { kind: "slider", name: "forestRoadsWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("forestRoadsOpacity", 0.8),
  ],
  forestAlishanRail: [
    { kind: "slider", name: "forestAlishanRailWidth", labelPrefix: "寬度", digits: 1, default: 1.5, min: 0.5, max: 5, step: 0.1 },
    opacitySlider("forestAlishanRailOpacity", 0.9),
  ],
  hikingTrails: [
    { kind: "slider", name: "hikingTrailsWidth", labelPrefix: "寬度", digits: 1, default: 1.2, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("hikingTrailsOpacity", 0.85),
  ],
  canopyHeight: [
    { kind: "slider", name: "canopyHeightOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.3, max: 1, step: 0.05 },
  ],
  canopyGiants: [
    { kind: "slider", name: "canopyGiantsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.3, max: 1, step: 0.05 },
  ],
  forestTrailSigns: [
    opacitySlider("forestTrailSignsOpacity", 0.85),
    { kind: "slider", name: "forestTrailSignsScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  mountainHuts: [
    opacitySlider("mountainHutsOpacity", 0.9),
    { kind: "slider", name: "mountainHutsScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  forestSignalPoints: [
    opacitySlider("forestSignalPointsOpacity", 0.85),
    { kind: "slider", name: "forestSignalPointsScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  forestEducationCenters: [
    opacitySlider("forestEducationCentersOpacity", 0.9),
    { kind: "slider", name: "forestEducationCentersScale", labelPrefix: "大小", digits: 2, default: 1.2, min: 0.3, max: 3, step: 0.1 },
  ],
  forestWildlife: [
    opacitySlider("forestWildlifeOpacity", 0.85),
    { kind: "slider", name: "forestWildlifeScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  powerPlants: [scaleSlider("powerPlantsScale", 0.5), opacitySlider("powerPlantsOpacity", 0.95)],
  aviationRestrictedGlow: [opacitySlider("aviationRestrictedGlowOpacity", 0.85)],
  powerGenerationUnit: [
    { kind: "slider", name: "powerGenerationHeight", labelPrefix: "柱高", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("powerGenerationOpacity", 0.7),
  ],
  facOffshore: [opacitySlider("facOffshoreOpacity", 0.45)],
  facPlanned: [scaleSlider("facPlannedScale", 0.5), opacitySlider("facPlannedOpacity", 0.7)],
  facHistorical: [
    scaleSlider("facHistoricalScale", 0.5),
    opacitySlider("facHistoricalOpacity", 0.5),
  ],
  facSecondary: [scaleSlider("facSecondaryScale", 0.5), opacitySlider("facSecondaryOpacity", 0.85)],
  facOsmSupplement: [
    scaleSlider("facOsmSupplementScale", 0.5),
    opacitySlider("facOsmSupplementOpacity", 0.7),
  ],
  gasStationCpc: [
    scaleSlider("gasStationCpcScale", 1.7),
    opacitySlider("gasStationCpcOpacity", 0.85),
  ],
  gasStationFpcc: [
    scaleSlider("gasStationFpccScale", 1.7),
    opacitySlider("gasStationFpccOpacity", 0.85),
  ],
  gasStationTaisugar: [
    scaleSlider("gasStationTaisugarScale", 1.7),
    opacitySlider("gasStationTaisugarOpacity", 0.85),
  ],
  gasStationOther: [
    scaleSlider("gasStationOtherScale", 2.2),
    opacitySlider("gasStationOtherOpacity", 0.7),
  ],
  gasStationCanonical: [
    scaleSlider("gasStationCanonicalScale", 1.7),
    opacitySlider("gasStationCanonicalOpacity", 0.9),
  ],
  lpgSubpackaging: [
    scaleSlider("lpgSubpackagingScale", 1.1),
    opacitySlider("lpgSubpackagingOpacity", 0.85),
  ],
  lpgRetailers: [scaleSlider("lpgRetailersScale", 1.3), opacitySlider("lpgRetailersOpacity", 0.75)],
  lngTerminal: [
    { kind: "slider", name: "lngTerminalScale", labelPrefix: "大小", digits: 1, default: 1.6, min: 0.5, max: 4, step: 0.1 },
    opacitySlider("lngTerminalOpacity", 0.95),
  ],
  pipelineGas: [
    { kind: "slider", name: "pipelineGasWidth", labelPrefix: "寬度", digits: 1, default: 2.0, min: 0.5, max: 5, step: 0.1 },
    opacitySlider("pipelineGasOpacity", 0.8),
  ],
  pipelineOilGas: [
    { kind: "slider", name: "pipelineOilGasWidth", labelPrefix: "寬度", digits: 1, default: 1.5, min: 0.5, max: 5, step: 0.1 },
    opacitySlider("pipelineOilGasOpacity", 0.7),
  ],
  coalTerminal: [
    { kind: "slider", name: "coalTerminalScale", labelPrefix: "大小", digits: 1, default: 1.4, min: 0.5, max: 4, step: 0.1 },
    opacitySlider("coalTerminalOpacity", 0.95),
  ],
  gasCoverageAll: [
    opacitySlider("gasCoverageAllOpacity", 0.85),
    { kind: "slider", name: "gasCoverageAllLineWidth", labelPrefix: "線寬", digits: 2, default: 0.5, min: 0.1, max: 2, step: 0.1 },
  ],
  gasCoverageCpc: [
    opacitySlider("gasCoverageCpcOpacity", 0.85),
    { kind: "slider", name: "gasCoverageCpcLineWidth", labelPrefix: "線寬", digits: 2, default: 0.5, min: 0.1, max: 2, step: 0.1 },
  ],
  gasCoverageFpcc: [
    opacitySlider("gasCoverageFpccOpacity", 0.85),
    { kind: "slider", name: "gasCoverageFpccLineWidth", labelPrefix: "線寬", digits: 2, default: 0.5, min: 0.1, max: 2, step: 0.1 },
  ],
  gasCoverageTaisugar: [
    opacitySlider("gasCoverageTaisugarOpacity", 0.85),
    { kind: "slider", name: "gasCoverageTaisugarLineWidth", labelPrefix: "線寬", digits: 2, default: 0.5, min: 0.1, max: 2, step: 0.1 },
  ],
  evIsland: [
    opacitySlider("evIslandOpacity", 0.6),
    { kind: "slider", name: "evIslandLineWidth", labelPrefix: "線寬", digits: 2, default: 0.5, min: 0.1, max: 2, step: 0.1 },
  ],
  osmSubstationsEhv: [
    { kind: "slider", name: "osmSubstationsEhvSize", labelPrefix: "大小", digits: 2, default: 0.5, min: 0.2, max: 3, step: 0.05 },
    opacitySlider("osmSubstationsEhvOpacity", 0.85),
  ],
  osmSubstations: [
    { kind: "slider", name: "osmSubstationsSize", labelPrefix: "大小", digits: 2, default: 0.3, min: 0.1, max: 3, step: 0.05 },
    opacitySlider("osmSubstationsOpacity", 0.85),
  ],
  osmPowerLines: [
    { kind: "slider", name: "osmPowerLinesWidth", labelPrefix: "寬度", digits: 1, default: 0.7, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("osmPowerLinesOpacity", 0.4),
  ],
  osmPowerTowers: [
    scaleSlider("osmPowerTowersSize", 1),
    opacitySlider("osmPowerTowersOpacity", 0.75),
  ],
  aviationControl: [opacitySlider("aviationControlOpacity", 0.7)],
  aviationRestricted: [opacitySlider("aviationRestrictedOpacity", 0.7)],
  droneNoFlyZone: [
    { kind: "slider", name: "droneNfzOpacity", labelPrefix: "透明度", digits: 2, default: 0.45, min: 0.05, max: 1, step: 0.05 },
  ],
  droneRestrictedZone: [
    { kind: "slider", name: "droneRestrictedOpacity", labelPrefix: "透明度", digits: 2, default: 0.45, min: 0.05, max: 1, step: 0.05 },
  ],
  osmWindTurbines: [
    scaleSlider("osmWindTurbinesSize", 1),
    opacitySlider("osmWindTurbinesOpacity", 0.85),
  ],
  osmSolarFarms: [scaleSlider("osmSolarFarmsSize", 1), opacitySlider("osmSolarFarmsOpacity", 0.85)],
  osmPowerPlantsStatic: [
    scaleSlider("osmPowerPlantsStaticSize", 1),
    opacitySlider("osmPowerPlantsStaticOpacity", 0.85),
  ],
  offshoreWindZones: [
    { kind: "slider", name: "offshoreWindZonesOpacity", labelPrefix: "透明度", digits: 2, default: 0.35, min: 0.05, max: 1, step: 0.05 },
  ],
  islandPowerGrid: [
    scaleSlider("islandPowerGridSize", 1),
    opacitySlider("islandPowerGridOpacity", 0.9),
  ],
  fossilFuelInfra: [
    scaleSlider("fossilFuelInfraSize", 1.2),
    opacitySlider("fossilFuelInfraOpacity", 0.85),
  ],
  geothermalWells: [
    scaleSlider("geothermalWellsSize", 1),
    opacitySlider("geothermalWellsOpacity", 0.85),
  ],
  renewablePermitsTaipei: [
    scaleSlider("renewablePermitsTaipeiSize", 1),
    opacitySlider("renewablePermitsTaipeiOpacity", 0.85),
  ],
  evChargingStations: [opacitySlider("evChargingOpacity", 0.8)],
  nuclearRadiation: [scaleSlider("nuclearScale", 1.0), opacitySlider("nuclearOpacity", 0.9)],

  // ══════════ 邊界地形・執法治安・養殖・觀光 ══════════
  countyBoundary: [
    { kind: "slider", name: "countyBoundaryWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("countyBoundaryOpacity", 0.85),
  ],
  townshipBoundary: [
    { kind: "slider", name: "townshipBoundaryWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("townshipBoundaryOpacity", 0.75),
  ],
  villageBoundary: [
    { kind: "slider", name: "villageBoundaryWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("villageBoundaryOpacity", 0.65),
  ],
  contour25k: [
    { kind: "slider", name: "contour25kWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("contour25kOpacity", 0.7),
  ],
  contourDtm20: [
    { kind: "slider", name: "contourDtm20Width", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.3, max: 3, step: 0.1 },
    opacitySlider("contourDtm20Opacity", 0.55),
  ],
  osmExpressway: [
    { kind: "slider", name: "osmExpresswayWidth", labelPrefix: "寬度", digits: 1, default: 1.0, min: 0.5, max: 5, step: 0.1 },
    opacitySlider("osmExpresswayOpacity", 0.9),
  ],
  policeStation: [
    scaleSlider("policeStationScale", 1),
    opacitySlider("policeStationOpacity", 0.85),
  ],
  womenChildWarning: [
    scaleSlider("womenChildWarningScale", 1),
    opacitySlider("womenChildWarningOpacity", 0.9),
  ],
  speedCamera: [scaleSlider("speedCameraScale", 1), opacitySlider("speedCameraOpacity", 0.85)],
  speedZoneSegment: [
    { kind: "slider", name: "speedZoneSegmentWidth", labelPrefix: "線寬", digits: 1, default: 1, min: 0.3, max: 5, step: 0.1 },
    opacitySlider("speedZoneSegmentOpacity", 0.85),
  ],
  court: [scaleSlider("courtScale", 1), opacitySlider("courtOpacity", 0.9)],
  prosecutorsOffice: [
    scaleSlider("prosecutorsOfficeScale", 1),
    opacitySlider("prosecutorsOfficeOpacity", 0.9),
  ],
  correctionalFacility: [
    scaleSlider("correctionalFacilityScale", 1),
    opacitySlider("correctionalFacilityOpacity", 0.9),
  ],
  courtJurisdiction: [
    { kind: "slider", name: "courtJurisdictionOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.18, min: 0, max: 0.6, step: 0.02 },
  ],
  crimeAreaMonthly: [
    { kind: "slider", name: "crimeAreaMonthlyOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.55, min: 0.1, max: 0.9, step: 0.05 },
  ],
  theftTaoyuan: [scaleSlider("theftTaoyuanScale", 1), opacitySlider("theftTaoyuanOpacity", 0.8)],
  trafficAccidentYearly: [
    scaleSlider("trafficAccidentYearlyScale", 1),
    opacitySlider("trafficAccidentYearlyOpacity", 0.85),
  ],
  accidentTaipei: [
    scaleSlider("accidentTaipeiScale", 1),
    opacitySlider("accidentTaipeiOpacity", 0.7),
  ],
  a1AccidentRealtime: [
    scaleSlider("a1AccidentRealtimeScale", 1),
    opacitySlider("a1AccidentRealtimeOpacity", 0.95),
  ],
  investigationBureau: [
    scaleSlider("investigationBureauScale", 1),
    opacitySlider("investigationBureauOpacity", 0.9),
  ],
  antiCorruptionOffice: [
    scaleSlider("antiCorruptionOfficeScale", 1),
    opacitySlider("antiCorruptionOfficeOpacity", 0.9),
  ],
  immigrationOffice: [
    scaleSlider("immigrationOfficeScale", 1),
    opacitySlider("immigrationOfficeOpacity", 0.9),
  ],
  coastGuardStation: [
    scaleSlider("coastGuardStationScale", 1),
    opacitySlider("coastGuardStationOpacity", 0.85),
  ],
  civilDefenseShelter: [
    scaleSlider("civilDefenseShelterScale", 1),
    opacitySlider("civilDefenseShelterOpacity", 0.7),
  ],
  aquaculturePonds: [
    { kind: "slider", name: "aquaculturePondsOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.5, min: 0, max: 0.85, step: 0.05 },
  ],
  aquacultureZone: [
    { kind: "slider", name: "aquacultureZoneOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.35, min: 0, max: 0.7, step: 0.05 },
  ],
  aquacultureCageNet: [
    { kind: "slider", name: "aquacultureCageNetOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.4, min: 0, max: 0.7, step: 0.05 },
  ],
  aquacultureIntegrated: [
    { kind: "slider", name: "aquacultureIntegratedOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.6, min: 0, max: 0.85, step: 0.05 },
  ],
  performingVenues: [
    { kind: "slider", name: "performingVenuesOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "performingVenuesRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  tourHotSprings: [
    opacitySlider("tourHotSpringsOpacity", 0.85),
    scaleSlider("tourHotSpringsScale", 1),
  ],
  tourHotSpringZones: [opacitySlider("tourHotSpringZonesOpacity", 0.5)],
  tourScenicAreas: [opacitySlider("tourScenicAreasOpacity", 0.5)],
  tourHeritage: [opacitySlider("tourHeritageOpacity", 0.85), scaleSlider("tourHeritageScale", 1)],
  tourFactories: [
    opacitySlider("tourFactoriesOpacity", 0.85),
    scaleSlider("tourFactoriesScale", 1),
  ],
  tourAmusementParks: [
    opacitySlider("tourAmusementParksOpacity", 0.85),
    scaleSlider("tourAmusementParksScale", 1),
  ],
  tourCamping: [opacitySlider("tourCampingOpacity", 0.85), scaleSlider("tourCampingScale", 1)],
  tourRestaurants: [
    opacitySlider("tourRestaurantsOpacity", 0.85),
    scaleSlider("tourRestaurantsScale", 1),
  ],

  // ══════════ 交通站點・等時圈・都市熱島・教育 18 層（fall-through 共用 slot 首批） ══════════
  busStationsCity: [
    { kind: "slider", name: "busScale", labelPrefix: "Bus", digits: 1, default: 0.4, min: 0.3, max: 3, step: 0.1, sharedGroup: "busScale" },
  ],
  busStationsIntercity: [
    { kind: "slider", name: "busScale", labelPrefix: "Bus", digits: 1, default: 0.4, min: 0.3, max: 3, step: 0.1, sharedGroup: "busScale" },
  ],
  fireIsochrone: [
    {
      kind: "select", name: "fireIsochroneCounty", label: "縣市", default: "all",
      options: FIRE_ISOCHRONE_COUNTY_OPTIONS,
      out: "fireIsochroneCountyIdx", encode: FIRE_ISOCHRONE_COUNTY_OPTIONS.map((o) => o.value),
    },
    { kind: "slider", name: "fireIsochroneOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 0.9, step: 0.05 },
  ],
  medIsochrone: [
    { kind: "slider", name: "medIsochroneOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 0.9, step: 0.05, sharedGroup: "medIsochroneOpacity" },
  ],
  medDesert: [
    { kind: "slider", name: "medIsochroneOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 0.9, step: 0.05, sharedGroup: "medIsochroneOpacity" },
  ],
  urbanHeat: [
    {
      kind: "select", name: "urbanHeatModeIdx", label: "顯示", default: "0",
      options: URBAN_HEAT_MODES.map((m) => ({ label: m.label, value: m.value })),
      out: "urbanHeatModeIdx", encode: URBAN_HEAT_MODES.map((o) => o.value),
    },
    { kind: "slider", name: "urbanHeatOpacity", labelPrefix: "透明度", digits: 2, default: 0.75, min: 0.2, max: 1, step: 0.05 },
  ],
  schools: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
    { kind: "toggle", name: "schoolLevelColor", label: "分級配色", default: false },
  ],
  eduSchoolElementary: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduSchoolJunior: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduSchoolSenior: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduSchoolUniversity: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduSchoolSpecial: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduRemoteSchools: [
    { kind: "slider", name: "eduSchoolsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduSchoolsOpacity" },
    { kind: "slider", name: "schoolScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "schoolScale" },
  ],
  eduDistrictElementary: [
    { kind: "slider", name: "eduDistrictK12Opacity", labelPrefix: "透明度", digits: 2, default: 0.3, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduDistrictK12Opacity" },
  ],
  eduDistrictJunior: [
    { kind: "slider", name: "eduDistrictK12Opacity", labelPrefix: "透明度", digits: 2, default: 0.3, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduDistrictK12Opacity" },
  ],
  eduKindergarten: [
    { kind: "slider", name: "eduChildcareOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduChildcareOpacity" },
    { kind: "slider", name: "eduChildcareScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "eduChildcareScale" },
  ],
  eduAfterschoolCare: [
    { kind: "slider", name: "eduChildcareOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduChildcareOpacity" },
    { kind: "slider", name: "eduChildcareScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "eduChildcareScale" },
  ],
  eduMutualCare: [
    { kind: "slider", name: "eduChildcareOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05, sharedGroup: "eduChildcareOpacity" },
    { kind: "slider", name: "eduChildcareScale", labelPrefix: "Scale", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1, sharedGroup: "eduChildcareScale" },
  ],

  // ══════════ 天災水利・農林・工業・不動產 20 層 ══════════
  typhoonTracks: [
    {
      kind: "select", name: "typhoonSource", label: "資料源", default: "all",
      options: [ { label: "全部", value: "all" }, { label: "JMA 日本", value: "jma" }, { label: "JTWC 美軍", value: "jtwc" }, ],
      out: "typhoonSourceIdx", encode: ["all", "jma", "jtwc"],
    },
    { kind: "slider", name: "typhoonTracksOpacity", labelPrefix: "透明度", digits: 2, default: 0.9, min: 0, max: 1, step: 0.05 },
  ],
  iotWraRiver: [
    { kind: "slider", name: "iotWraRiverScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    { kind: "slider", name: "iotWraRiverOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0.1, max: 1, step: 0.05 },
    { kind: "toggle", name: "iotWraRiverShowMeasured", label: "即時水位", default: true },
    { kind: "toggle", name: "iotWraRiverShowForecast", label: "預測水位 (12-19h)", default: true },
  ],
  iotWraStructure: [
    { kind: "slider", name: "iotWraStructureScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.5, max: 3, step: 0.1 },
    { kind: "slider", name: "iotWraStructureOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0.1, max: 1, step: 0.05 },
    { kind: "toggle", name: "iotWraStructureFlow", label: "累計流量 Flow", default: true },
    { kind: "toggle", name: "iotWraStructureGate", label: "閘門 Watergate", default: true },
    { kind: "toggle", name: "iotWraStructureDam", label: "堤防安全 Dam", default: true },
    { kind: "toggle", name: "iotWraStructureErosion", label: "河床沖刷 Erosion", default: true },
    { kind: "toggle", name: "iotWraStructureDust", label: "揚塵 Dust", default: true },
  ],
  agriSoilFertility: [
    { kind: "slider", name: "agriSoilFertilityOpacity", labelPrefix: "透明度", digits: 2, default: 1.0, min: 0.1, max: 1, step: 0.05 },
    {
      kind: "select", name: "agriSoilFertilityMetric", label: "著色", default: "health",
      options: SOIL_FERTILITY_METRIC_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      out: "agriSoilFertilityMetricIdx", encode: SOIL_FERTILITY_METRIC_OPTIONS.map((o) => o.value),
    },
  ],
  forestCompartments: [
    { kind: "slider", name: "forestCompartmentsOpacity", labelPrefix: "透明度", digits: 2, default: 0.45, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestCompartmentsOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestCompartmentsShowOutline", label: "邊框 Outline", default: true },
  ],
  forestReserve: [
    { kind: "slider", name: "forestReserveOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestReserveOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestReserveShowOutline", label: "邊框 Outline", default: true },
  ],
  forestRecreation: [
    { kind: "slider", name: "forestRecreationOpacity", labelPrefix: "透明度", digits: 2, default: 0.6, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestRecreationOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestRecreationShowOutline", label: "邊框 Outline", default: true },
  ],
  forestTreatmentWorks: [
    { kind: "slider", name: "forestTreatmentWorksOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestTreatmentWorksOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestTreatmentWorksShowOutline", label: "邊框 Outline", default: true },
  ],
  forestFlatParks: [
    { kind: "slider", name: "forestFlatParksOpacity", labelPrefix: "透明度", digits: 2, default: 0.6, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestFlatParksOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestFlatParksShowOutline", label: "邊框 Outline", default: true },
  ],
  forestDamLakes: [
    { kind: "slider", name: "forestDamLakesOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "forestDamLakesOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 0.5, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "forestDamLakesShowOutline", label: "邊框 Outline", default: true },
  ],
  industrialRefinery: [
    { kind: "slider", name: "industrialRefineryOpacity", labelPrefix: "透明度", digits: 2, default: 0.55, min: 0.1, max: 1, step: 0.05 },
    { kind: "toggle", name: "industrialRefineryOutline", label: "顯示外框線", default: true },
  ],
  industrialStorageTank: [
    { kind: "slider", name: "industrialStorageTankOpacity", labelPrefix: "透明度", digits: 2, default: 0.55, min: 0.1, max: 1, step: 0.05 },
    { kind: "toggle", name: "industrialStorageTankOutline", label: "顯示外框線", default: true },
  ],
  industrialPowerPlant: [
    { kind: "slider", name: "industrialPowerPlantOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 1, step: 0.05 },
    { kind: "toggle", name: "industrialPowerPlantOutline", label: "顯示外框線", default: true },
  ],
  mountainRescueIncidents: [
    {
      kind: "select", name: "mountainRescueIncidentsYear", label: "年份", default: "all",
      options: [{ label: "全部", value: "all" }, ...MOUNTAIN_RESCUE_YEARS.map((y) => ({ label: String(y), value: String(y) }))],
      out: "mountainRescueIncidentsYearIdx", encode: ["all", ...MOUNTAIN_RESCUE_YEARS.map(String)],
    },
    { kind: "slider", name: "mountainRescueIncidentsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "mountainRescueIncidentsScale", labelPrefix: "大小", digits: 2, default: 1.0, min: 0.3, max: 3, step: 0.1 },
  ],
  realEstateRentalGrid: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],
  realEstateRentalPoint: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],
  realEstateSaleGrid: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],
  realEstateSalePoint: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],
  realEstatePresaleGrid: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],
  realEstatePresalePoint: [
    { kind: "slider", name: "realEstateOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0.1, max: 1, step: 0.05, sharedGroup: "realEstateOpacity" },
    { kind: "toggle", name: "realEstateExcludeTaipei", label: "排除雙北重繪", default: false, sharedGroup: "realEstateExcludeTaipei" },
  ],

  // ══════════ 養殖水域・樹木公園・文化觀光・都市分區 20 層 ══════════
  aquacultureWaterSatellite: [
    {
      kind: "select", name: "aquacultureWaterSatelliteConfidence", label: "信心", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "含蓄水池", value: "reservoir" }, { label: "只確定", value: "certain" }],
      out: "aquacultureWaterSatelliteConfidenceIdx", encode: ["all", "reservoir", "certain"],
    },
    { kind: "slider", name: "aquacultureWaterSatelliteOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.5, min: 0, max: 0.85, step: 0.05 },
  ],
  aquacultureWaterSatelliteMoa: [
    { kind: "slider", name: "aquacultureWaterSatelliteMoaOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.55, min: 0, max: 0.85, step: 0.05 },
    { kind: "toggle", name: "aquacultureWaterSatelliteMoaShowConfirmed", label: "確認 Confirmed", default: true },
    { kind: "toggle", name: "aquacultureWaterSatelliteMoaShowSolar", label: "漁電共生 Solar", default: true },
    { kind: "toggle", name: "aquacultureWaterSatelliteMoaShowOther", label: "其他 Other", default: true },
  ],
  aquacultureWaterUnion: [
    { kind: "slider", name: "aquacultureWaterUnionOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.55, min: 0, max: 0.85, step: 0.05 },
    { kind: "toggle", name: "aquacultureWaterUnionShowBoth", label: "兩版都有 Both", default: true },
    { kind: "toggle", name: "aquacultureWaterUnionShowMoaOnly", label: "只官方 MOA", default: true },
    { kind: "toggle", name: "aquacultureWaterUnionShowOsmOnly", label: "只舊版 OSM", default: true },
  ],
  streetTreesTaipeiDiff: [
    {
      kind: "select", name: "streetTreesTaipeiDiffColorMode", label: "染色模式", default: "status",
      options: [{ label: "依狀態", value: "status" }, { label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }],
      out: "streetTreesTaipeiDiffColorModeIdx", encode: ["status", "species", "diameter", "height"],
    },
    {
      kind: "select", name: "streetTreesTaipeiDiffStatus", label: "狀態", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "只看消失", value: "disappeared" }, { label: "只看變動", value: "changed" }],
      out: "streetTreesTaipeiDiffStatusIdx", encode: ["all", "disappeared", "changed"],
    },
    { kind: "slider", name: "streetTreesTaipeiDiffOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "streetTreesTaipeiDiffRadius", labelPrefix: "點位大小", digits: 2, default: 0.5, min: 0.5, max: 3.0, step: 0.25 },
  ],
  protectedTreesNational: [
    {
      kind: "select", name: "protectedTreesNationalColorMode", label: "染色模式", default: "age",
      options: [{ label: "依樹齡", value: "age" }, { label: "依城市", value: "city" }],
      out: "protectedTreesNationalColorModeIdx", encode: ["age", "city"],
    },
    {
      kind: "select", name: "protectedTreesNationalCity", label: "城市", default: "all",
      options: [{ label: "全部", value: "all" }, ...PROTECTED_TREE_CITIES.map((c) => ({ label: c.name, value: c.name }))],
      out: "protectedTreesNationalCityIdx", encode: ["all", ...PROTECTED_TREE_CITIES.map((c) => c.name)],
    },
    { kind: "slider", name: "protectedTreesNationalOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "protectedTreesNationalRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  riversideTreesTaipei: [
    {
      kind: "select", name: "riversideTreesTaipeiPark", label: "河濱公園", default: "all",
      options: [{ label: "全部", value: "all" }, ...RIVERSIDE_PARKS.map((n) => ({ label: n, value: n }))],
      out: "riversideTreesTaipeiParkIdx", encode: ["all", ...RIVERSIDE_PARKS],
    },
    { kind: "slider", name: "riversideTreesTaipeiOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "riversideTreesTaipeiRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  parksTaipei: [
    {
      kind: "select", name: "parksTaipeiCategory", label: "分類", default: "all",
      options: [{ label: "全部", value: "all" }, ...TAIPEI_PARK_CATEGORIES.map((c) => ({ label: c.name, value: c.name }))],
      out: "parksTaipeiCategoryIdx", encode: ["all", ...TAIPEI_PARK_CATEGORIES.map((c) => c.name)],
    },
    { kind: "slider", name: "parksTaipeiOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "parksTaipeiRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  culturalFacilities: [
    {
      kind: "select", name: "culturalFacilitiesType", label: "類型", default: "all",
      options: [{ label: "全部", value: "all" }, ...CULTURAL_FACILITY_TYPES.map((c) => ({ label: c.name, value: c.name }))],
      out: "culturalFacilitiesTypeIdx", encode: ["all", ...CULTURAL_FACILITY_TYPES.map((c) => c.name)],
    },
    { kind: "slider", name: "culturalFacilitiesOpacity", labelPrefix: "透明度", digits: 2, default: 0.9, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "culturalFacilitiesRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  culturalMuseums: [
    {
      kind: "select", name: "culturalMuseumsType", label: "類型", default: "all",
      options: [{ label: "全部", value: "all" }, ...CULTURAL_MUSEUM_TYPES.map((c) => ({ label: c.name, value: c.name }))],
      out: "culturalMuseumsTypeIdx", encode: ["all", ...CULTURAL_MUSEUM_TYPES.map((c) => c.name)],
    },
    { kind: "slider", name: "culturalMuseumsOpacity", labelPrefix: "透明度", digits: 2, default: 0.9, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "culturalMuseumsRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  artsEvents: [
    {
      kind: "select", name: "artsEventsStatus", label: "狀態", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "進行中", value: "ongoing" }, { label: "未開始", value: "upcoming" }],
      out: "artsEventsStatusIdx", encode: ["all", "ongoing", "upcoming"],
    },
    { kind: "slider", name: "artsEventsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "artsEventsRadius", labelPrefix: "點位大小", digits: 2, default: 1, min: 0.5, max: 3.0, step: 0.25 },
  ],
  tourAttractions: [
    {
      kind: "select", name: "tourAttractionsMode", label: "著色模式", default: "category",
      options: [{ label: "分類", value: "category" }, { label: "熱度", value: "heat" }],
      out: "tourAttractionsModeIdx", encode: ["category", "heat"],
    },
    { kind: "slider", name: "tourAttractionsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "tourAttractionsScale", labelPrefix: "大小", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  tourEvents: [
    {
      kind: "select", name: "tourEventsStatus", label: "狀態", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "進行中", value: "ongoing" }, { label: "未開始", value: "upcoming" }],
      out: "tourEventsStatusIdx", encode: ["all", "ongoing", "upcoming"],
    },
    { kind: "slider", name: "tourEventsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "tourEventsScale", labelPrefix: "大小", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  tourHotels: [
    {
      kind: "select", name: "tourHotelsClass", label: "類別", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "國際觀光旅館", value: "1" }, { label: "一般觀光旅館", value: "2" }, { label: "旅館", value: "3" }, { label: "民宿", value: "4" }],
      out: "tourHotelsClassIdx", encode: ["all", "1", "2", "3", "4"],
    },
    { kind: "slider", name: "tourHotelsOpacity", labelPrefix: "透明度", digits: 2, default: 0.85, min: 0.1, max: 1, step: 0.05 },
    { kind: "slider", name: "tourHotelsScale", labelPrefix: "大小", digits: 1, default: 1, min: 0.3, max: 3, step: 0.1 },
  ],
  streetTreesTaipei3epoch: [
    {
      kind: "select", name: "streetTreesTaipei3epochColorMode", label: "染色模式", default: "traj",
      options: [{ label: "依軌跡", value: "traj" }, { label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }],
      out: "streetTreesTaipei3epochColorModeIdx", encode: ["traj", "species", "diameter", "height"],
    },
    {
      kind: "select", name: "streetTreesTaipei3epochTrajFilter", label: "軌跡篩選", default: "all",
      options: STREET_TREE_3EPOCH_TRAJ_FILTERS.map((f) => ({ label: f.label, value: f.value })),
      out: "streetTreesTaipei3epochTrajFilterIdx", encode: STREET_TREE_3EPOCH_TRAJ_FILTERS.map((o) => o.value),
    },
    { kind: "slider", name: "streetTreesTaipei3epochOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "streetTreesTaipei3epochRadius", labelPrefix: "點位大小", digits: 2, default: 0.5, min: 0.5, max: 3.0, step: 0.25 },
  ],
  streetTreesNational: [
    {
      kind: "select", name: "streetTreesNationalColorMode", label: "染色模式", default: "species",
      options: [{ label: "依樹種", value: "species" }, { label: "依胸徑", value: "diameter" }, { label: "依樹高", value: "height" }, { label: "依城市", value: "city" }],
      out: "streetTreesNationalColorModeIdx", encode: ["species", "diameter", "height", "city"],
    },
    {
      kind: "select", name: "streetTreesNationalCity", label: "城市", default: "all",
      options: [{ label: "全部", value: "all" }, ...STREET_TREE_NATIONAL_CITIES.map((c) => ({ label: c.label, value: c.value }))],
      out: "streetTreesNationalCityIdx", encode: ["all", ...STREET_TREE_NATIONAL_CITIES.map((c) => c.value)],
    },
    { kind: "slider", name: "streetTreesNationalOpacity", labelPrefix: "透明度", digits: 2, default: 0.7, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "streetTreesNationalRadius", labelPrefix: "點位大小", digits: 2, default: 0.5, min: 0.5, max: 3.0, step: 0.25 },
  ],
  treePitsTaipei: [
    {
      kind: "select", name: "treePitsTaipeiType", label: "類型", default: "all",
      options: [{ label: "全部", value: "all" }, ...TREE_PIT_TYPES.map((t) => ({ label: t.name, value: t.name }))],
      out: "treePitsTaipeiTypeIdx", encode: ["all", ...TREE_PIT_TYPES.map((t) => t.name)],
    },
    { kind: "slider", name: "treePitsTaipeiOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.55, min: 0, max: 0.85, step: 0.05 },
  ],
  urbanFormGrid: [
    {
      kind: "select", name: "urbanFormGridModeIdx", label: "顯示模式", default: "5",
      options: [...URBAN_FORM_GRID_MODES],
      out: "urbanFormGridModeIdx", encode: URBAN_FORM_GRID_MODES.map((o) => o.value),
    },
    { kind: "slider", name: "urbanFormGridOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.55, min: 0, max: 1, step: 0.05 },
  ],
  urbanZoningTaipei: [
    {
      kind: "select", name: "urbanZoningTaipeiCategory", label: "分區", default: "all",
      options: [{ label: "全部", value: "all" }, ...URBAN_ZONING_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))],
      out: "urbanZoningTaipeiCategoryIdx", encode: ["all", ...URBAN_ZONING_CATEGORIES.map((c) => c.value)],
    },
    { kind: "slider", name: "urbanZoningTaipeiOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.5, min: 0, max: 1, step: 0.05 },
  ],
  nonUrbanZoning: [
    {
      kind: "select", name: "nonUrbanZoningCode", label: "分區", default: "all",
      options: [{ label: "全部", value: "all" }, ...NON_URBAN_ZONING_CODES.map((c) => ({ label: c.label, value: c.code }))],
      out: "nonUrbanZoningCodeIdx", encode: ["all", ...NON_URBAN_ZONING_CODES.map((c) => c.code)],
    },
    { kind: "slider", name: "nonUrbanZoningOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.35, min: 0, max: 1, step: 0.05 },
  ],
  urbanZoningNewTaipei: [
    {
      kind: "select", name: "urbanZoningNewTaipeiCategory", label: "分區", default: "all",
      options: [{ label: "全部", value: "all" }, ...URBAN_ZONING_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))],
      out: "urbanZoningNewTaipeiCategoryIdx", encode: ["all", ...URBAN_ZONING_CATEGORIES.map((c) => c.value)],
    },
    { kind: "slider", name: "urbanZoningNewTaipeiOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.5, min: 0, max: 1, step: 0.05 },
  ],
} satisfies Partial<Record<keyof LayerVisibility, LayerParamSpec[]>>;

/**
 * 已遷移的 key 集合。
 * 用 `satisfies` 而非型別標註 —— 標註會把 key 的 literal 型別打平成
 * `keyof LayerVisibility` 全集，`MigratedParamsKey` 就退化成 348 key，
 * 雙軌判別式跟著失效（同 `LAYER_MANIFEST` 的 `ManifestKey` 那道護欄）。
 */
export type MigratedParamsKey = keyof typeof LAYER_PARAMS_SPEC;

export const MIGRATED_PARAMS_KEYS = Object.keys(LAYER_PARAMS_SPEC) as MigratedParamsKey[];

const SPEC_BY_KEY: Record<string, LayerParamSpec[]> = LAYER_PARAMS_SPEC;

/** 這個 key 的參數是否已經走 store（＝雙軌的那道分岔） */
export function isMigratedParamsKey(key: string): key is MigratedParamsKey {
  return key in SPEC_BY_KEY;
}

/** 取單一 key 的規格；未遷移回 null（呼叫端據此走既有 switch） */
export function getParamsSpec(key: string): readonly LayerParamSpec[] | null {
  return SPEC_BY_KEY[key] ?? null;
}

/** overlayParams 的 key（slider / toggle 省略 `out` 時等於 `name`） */
export function specOutKey(spec: LayerParamSpec): string {
  return spec.kind === "select" ? spec.out : (spec.out ?? spec.name);
}

// ── 共用 slot ─────────────────────────────────────────────────────

/** 共用 slot 的一個成員：某個 layer key 的某個參數 */
export interface SharedSlotMember {
  key: MigratedParamsKey;
  name: string;
}

/**
 * `sharedGroup` id → 參與的 (key, name) 成員。模組載入時掃一次規格建好。
 *
 * 消費者只有一個：`layerParamsStore.setParam` —— 寫入時把同群成員一起改、一起通知，
 * 讓 N 個 store slot 的行為與「共用一個 useState」逐字等價。
 */
export const SHARED_PARAM_GROUPS: ReadonlyMap<string, readonly SharedSlotMember[]> = (() => {
  const groups = new Map<string, SharedSlotMember[]>();
  for (const key of Object.keys(LAYER_PARAMS_SPEC) as MigratedParamsKey[]) {
    for (const spec of LAYER_PARAMS_SPEC[key] as LayerParamSpec[]) {
      if (!spec.sharedGroup) continue;
      const list = groups.get(spec.sharedGroup) ?? [];
      list.push({ key, name: spec.name });
      groups.set(spec.sharedGroup, list);
    }
  }
  return groups;
})();

/** (key, name) → 反查所屬共用群組的 id；獨佔回 null */
const SHARED_GROUP_OF = (() => {
  const m = new Map<string, string>();
  for (const [id, members] of SHARED_PARAM_GROUPS) {
    for (const mem of members) m.set(`${mem.key} ${mem.name}`, id);
  }
  return m;
})();

/**
 * 與 (key, name) 共用同一份值的全部成員（含自己）。獨佔參數回 null，
 * 呼叫端據此走「只寫自己」的快路徑。
 */
export function sharedSlotMembers(key: string, name: string): readonly SharedSlotMember[] | null {
  const id = SHARED_GROUP_OF.get(`${key} ${name}`);
  return id ? (SHARED_PARAM_GROUPS.get(id) ?? null) : null;
}

/**
 * 把一個值編成 overlayParams 收得下的數字。
 *   slider → 原值
 *   toggle → 0/1
 *   select → `encode.indexOf(value)`（找不到回 -1，與現行 `.indexOf` 同語意）
 */
export function encodeParamValue(spec: LayerParamSpec, value: ParamValue): number {
  switch (spec.kind) {
    case "slider":
      return typeof value === "number" ? value : spec.default;
    case "toggle":
      return value ? 1 : 0;
    case "select":
      return spec.encode.indexOf(String(value));
  }
}
