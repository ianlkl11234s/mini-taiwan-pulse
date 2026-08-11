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

import type { BusGroup, LayerVisibility } from "../types";
import { BUS_GROUP_LABELS } from "../types";
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
import { MICRO_SENSOR_MODES } from "./microSensorTypes";
import { URBAN_ZONING_CATEGORIES } from "./urbanZoningTypes";
import { NON_URBAN_ZONING_CODES } from "./nonUrbanZoningTypes";
import { CROP_SUITABILITY_CROPS } from "./cropSuitabilityCrops";
import { FARM_HIGHLIGHT_OPTIONS } from "./livestockTypes";
import { BUILDINGS_GBA_MODES } from "./buildingsGbaTypes";
import { PROPERTY_VALUE_SCALES, PROPERTY_VALUE_GRID_MODES } from "./propertyValueTypes";

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
 * ⚠️ 條件式顯示（`showWhen`）—— 三種 spec 共通的選填欄位。
 *
 * `useTransportParams` 有一種形狀是 **控件清單本身隨值伸縮**：
 * ```ts
 * ...(propertyValueGridExtruded ? [對比 slider, 高度 slider] : []),
 * ...(buildingsGbaModeIdx === 3 ? [Bloom 門檻 slider] : []),
 * ```
 * 「拉了沒反應的死控件不要常駐」——2D 時對比只驅動 extrusion 高度、
 * 夜景門檻只有夜景模式吃得到。
 *
 * ⚠️ **只影響控件渲染，不影響 `encodeParamsToOverlay`**：
 * `propertyValueGridContrast` / `buildingsGbaBloomMinHeight` 這些值
 * 在收合狀態下**照樣**進 overlayParams（手寫版就是這樣 —— 它們是無條件寫進
 * 那個 useMemo 字面的）。跟著隱藏一起不編碼的話，`overlays` section 的
 * paint 求值會少欄位 → 黃金快照立刻紅。
 *
 * ⚠️ 只准參照**同一個 key**的參數。跨 key 條件會讓「一個 key 的 spec 自足」
 * 這個前提破功，`count`/`kinds` 也不再對得回 manifest。
 */
interface ConditionalField {
  /** 只有同 key 的 `param` 等於 `equals` 時才渲染本控件；省略 = 常駐 */
  showWhen?: { param: string; equals: ParamValue };
}

/**
 * ⚠️ 第二條輸出通道（`out: null`）—— AR-22 P3-2D。
 *
 * P3-1~2C 搬的 key 有一個共同前提：**參數的唯一去處是 `overlayParams`**
 * （paint expression 吃得到的那個 `Record<string, number>`）。D 桶不是 ——
 * 它們的值走 `useTransportParams` 的 `return {}`：
 *   - `refs.xxx.current`（Three.js / CustomLayer 的 render loop 逐幀讀）
 *   - `h3Params` / `popCountParams` / `indicatorsParams` / `socioParams` /
 *     `spatialParams` / `youbikeParams` 六個獨立子物件
 *   - `daOpacity` / `satOpacity` / `eqOpacity` … 這種平鋪的單一欄位
 *   - `enabledBusCities` / `enabledWasteScheduleCities` 這種**派生**欄位
 *
 * 這些值**不該**出現在 overlayParams：多塞一個 key 進去等於改變 paint 求值的輸入面，
 * 也讓 `overlayParams` 不再是「paint 真正吃到的東西」的忠實表述。
 * 所以規格端用 `out: null` 講明「本參數不走 overlay 通道」，
 * `encodeParamsToOverlay` 直接跳過。
 *
 * ⚠️ 這一欄**不表示值可以沒有去處**：`useTransportParamsReturn.test.ts` 的
 * 完整性規則要求每個 `out: null` 的參數都必須在 `RETURN_CHANNEL` 表裡宣告
 * 至少一條回傳路徑（或列進 `INTERNAL_CONSUMERS`），否則就是「搬進 store
 * 但沒接回去」——那正是 D 桶最危險、四道舊閘全綠的失效形狀。
 */
export type OverlayOutKey = string | null;

/**
 * 數值滑桿。
 *
 * ⚠️ label 是**模板**不是字面：現行手寫 case 一律寫成
 * `` `透明度 ${x.toFixed(2)}` `` / `` `大小 ${x.toFixed(1)}` `` ——
 * 小數位數逐控件不同（透明度 2 位、大小 1 位），漏掉就會產生
 * 「編得過但字串悄悄不一樣」的漂移，正是本工程要消滅的那一類。
 */
export interface SliderParamSpec extends SharedSlotField, ConditionalField {
  kind: "slider";
  /** 參數名。慣例沿用舊 useState 變數名 —— 它同時是 overlayParams 的預設 key */
  name: string;
  /** label 前綴；實際 label = `${labelPrefix}${labelSep}${數字}${labelSuffix}` */
  labelPrefix: string;
  /**
   * 前綴與數字之間的分隔（省略 = 單一空白，這是 300+ 個手寫 case 的常態）。
   *
   * 唯一的使用者是 `facPrimary` 的 `` `大廠（即時）${x.toFixed(2)}` `` ——
   * 全形括號結尾**沒有**再空一格。`labelPrefix` 自動補空白補不掉，
   * `labelSuffix` 又在另一側，只能開這一欄。
   */
  labelSep?: string;
  /**
   * `value === 0` 時改印這個字（不印數字）。
   *
   * `powerPoles` / `osmRoadDrive` 的 `` `全台顯示 ${x === 0 ? "關" : x.toFixed(2)}` ``
   * ——「0 = 這個效果關掉」的語意，印 `0.00` 會讓人以為只是調到最小。
   * 這是**值相依**的文字，`labelPrefix` / `labelSuffix` 都是常數字串，表達不了。
   *
   * ⚠️ 仍是純字串、不是函式：只有 `=== 0` 這一個分支點，快照照樣逐位比對。
   */
  zeroLabel?: string;
  /** `toFixed` 位數 */
  digits: number;
  /**
   * 顯示倍率：label 印的是 `(value * displayScale).toFixed(digits)`（P3-2D 群2）。
   *
   * Three.js 的軌道球半徑是經緯度尺度的極小數（`0.000005`），面板直接印會變成
   * `0.00` 全都一樣 —— 手寫版一律乘一個倍率再印：
   * `` `Orb ${(orbScale * 100000).toFixed(1)}` `` ／ `` `Bus Orb ${(x * 1000000).toFixed(0)}` ``。
   *
   * ⚠️ **只影響 label**，不影響 `value` / `min` / `max` / `step`，更不影響編碼 ——
   * 那些仍是原尺度的真值（滑桿拖的是真值，paint / scene 吃的也是真值）。
   * ⚠️ 乘法與 `toFixed` 的順序與手寫版逐字相同，浮點結果因此逐位元一致。
   */
  displayScale?: number;
  /**
   * label 後綴 —— 緊接在數字之後、**不補空白**（前綴那一側才自動補）。
   *
   * 現行手寫 case 有一整批「數字後面還有字」的 label：
   * `` `Z 漂浮 ${x.toFixed(0)}px` `` ／ `` `大小 ${x.toFixed(2)}×` `` ／
   * `` `保留 ${x} min` ``。沒有本欄就只能把後綴硬塞進 `labelPrefix`，
   * 產生「編得過但字串少了 px」的漂移 —— 正是本工程要消滅的那一類。
   *
   * ⚠️ 純字串串接、不是函式：快照照樣逐位比對，等價證明不受影響。
   */
  labelSuffix?: string;
  default: number;
  min: number;
  max: number;
  step: number;
  /**
   * overlayParams 的 key（省略 = 用 `name`，這是 slider 的常態）。
   *
   * ⚠️ `null` = **不進 overlayParams**（見 `OverlayOutKey` 說明）。
   * 注意是 `=== undefined` 才回退到 `name`，不是 `??` —— `null ?? name` 會是 `name`。
   */
  out?: OverlayOutKey;
}

/**
 * 布林開關。
 *
 * ⚠️ overlayParams 的契約是 `Record<string, number>` —— boolean **必須**編成 0/1
 * 才餵得進 paint expression。編碼由 `encodeParamsToOverlay` 統一做，
 * 規格端只宣告 `out`（省略 = 用 `name`）。
 */
export interface ToggleParamSpec extends SharedSlotField, ConditionalField {
  kind: "toggle";
  name: string;
  label: string;
  default: boolean;
  /** 同 `SliderParamSpec.out`：省略 = 用 `name`；`null` = 不進 overlayParams */
  out?: OverlayOutKey;
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
interface SelectParamSpecBase extends SharedSlotField, ConditionalField {
  kind: "select";
  name: string;
  /** 控件 label；宣告了 `labelByValue` 時，本欄退化成「查無對應時的兜底」 */
  label: string;
  /**
   * label 隨**自己當下的值**變的 select（P3-2C 落地 8 層）。
   *
   * `livestockFarm*` 的 `` `品項 ${FARM_HIGHLIGHT_OPTIONS[k][idx] ?? "全部"}` `` 與
   * `agriCropSuitability` 的 `` `作物 ${current.nameZh}` `` —— 面板寬 240px，
   * 原生 select 收合時看不到選中項，所以把當前值寫進 label。
   *
   * ⚠️ 值 → 顯示文字是**整串**（含前綴），不是「前綴 ＋ 選項 label」：
   * 作物那層的 label 用 `nameZh`、選項用 `${nameZh} (${nameEn})`，
   * 兩者本來就不是同一個字串 —— 拆成「前綴 + 選項 label」會靜默改掉顯示文字，
   * 正是 P3-1 記的「顯示表 ≠ 編碼表」那類漂移的近親。
   */
  labelByValue?: Record<string, string>;
  default: string;
  options: ParamSelectOption[];
  /**
   * 某個選項在**別的參數**取特定值時不可選（`SelectConfig.disabled`）。
   * 全 repo 只有一處：`propertyValueGrid` 的「人均市值」在 150m 尺度沒有 `pop`
   * 屬性可算 —— 不自動跳尺度，而是停用該選項並在 label 講明原因。
   *
   * 為什麼不能用現有欄位：`options` 是靜態陣列，這裡的 `disabled` 與 label
   * 都取決於**另一個參數當下的值**，靜態表達不了。
   *
   * 為什麼不做成 `optionsFrom: (values) => …` 函式：規格檔至今零函式、
   * 整份是可讀可序列化的資料，這是它能被黃金快照與焊接測試當成「第二意見」
   * 的前提。真出現第二個形狀不同的 case，那才是該一般化的訊號。
   *
   * ⚠️ `enabledWhenIn` 請從上游 SSOT 推導（`PROPERTY_VALUE_SCALES.filter(hasPop)`），
   * 不要手抄 `["1","2"]` —— 上游改 `hasPop` 時才不會靜默不同步。
   */
  disableRule?: {
    /** 受規則管的選項 value */
    option: string;
    /** 依據同 key 的哪個參數 */
    param: string;
    /** `param` 的值落在這裡面時該選項可用，否則停用 */
    enabledWhenIn: string[];
    /** 停用時補在該選項 label 後面的原因 */
    reason: string;
  };
}

/** 常態：state 存的是「第幾個選項」，paint 吃 index。 */
export interface SelectIndexParamSpec extends SelectParamSpecBase {
  /** overlayParams 的 key。慣例 `${name}Idx` —— 與 `name` 多半**不同名**，故必填 */
  out: string;
  /** value → index 的編碼順序 */
  encode: string[];
  encodeNumeric?: undefined;
}

/**
 * ⚠️ 數值型 select：overlayParams 吃的是 **`Number(value)` 本身**，不是索引。
 *
 * P3-2B 的嚴格解析器把「數值型 select」切成兩種，只有存索引那種搬得動：
 * | state 存**索引**（`urbanHeatModeIdx`）| option value 是 `"0"`/`"1"`… → `encode.indexOf` 恰好等於索引 | 走 `encode` |
 * | state 存**值**（`floodMinDepth` `precipRasterHours` `policeIso*Minutes`）| option value 是 `"0.5"`/`"24"`/`"10"` | 走本欄 |
 *
 * 硬寫成 `encode` 的後果：`indexOf("0.5")` 回 1、真值是 0.5 —— 而**預設值那一格
 * 常常碰巧相等**（`floodMinDepth` 預設 "0"：`Number("0") === indexOf("0") === 0`），
 * 於是黃金快照分不出來，只有非預設值才會錯。行為測試補在
 * `layerParamsControls.test.ts`。
 */
export interface SelectNumericParamSpec extends SelectParamSpecBase {
  out: string;
  encodeNumeric: true;
  encode?: undefined;
}

/**
 * ⚠️ 第二通道 select（`out: null`，P3-2D）：值走 hook 的 `return {}`，**不進 overlayParams**
 * → 沒有「編碼」這件事，`encode` / `encodeNumeric` 兩欄型別上都不准宣告。
 *
 * 為什麼不讓它宣告一份「反正用不到」的 `encode`：留著死的編碼表正是本專案反覆記錄的
 * 那類漂移 —— 哪天有人把這個參數改成也進 overlayParams，會直接沿用那張沒人驗過的表。
 *
 * 例：`earthquakes` 的 Mode（`"timeline"` / `"history"`，hook 端還原成 boolean
 * `eqShowHistory`）、`plaActivity` 的疊加天數（hook 端 `Number(value)`）。
 */
export interface SelectNoOverlayParamSpec extends SelectParamSpecBase {
  out: null;
  encode?: undefined;
  encodeNumeric?: undefined;
}

export type SelectParamSpec =
  | SelectIndexParamSpec
  | SelectNumericParamSpec
  | SelectNoOverlayParamSpec;

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

/**
 * 「Z 漂浮 NNpx」滑桿 —— 交通/設施點層把符號抬離地面的共同控件（P3-2C 落地 7 層）。
 * 七層的 min/max/step/default 逐字相同，只有參數名不同。
 */
function zFloatSlider(name: string): SliderParamSpec {
  return {
    kind: "slider", name, labelPrefix: "Z 漂浮", digits: 0, labelSuffix: "px",
    default: 0, min: 0, max: 100, step: 2,
  };
}

/**
 * 畜牧場 7 層同構：透明度 ＋ 大小 ＋「品項」select。
 *
 * ⚠️ 品項 select 的 label 帶當前選中項（`品項 肉豬`）——面板只有 240px 寬，
 * 原生 select 收合時看不到選中值。`labelByValue` 存的是**整串**顯示文字。
 * out 吃 `Number(value)` 而非索引（overlayParams 收的是 `…HighlightIdx` 原值）——
 * 這裡 index 與值碰巧相同，正因如此才必須寫 `encodeNumeric` 講明意圖：
 * 選項表哪天前面插一項，`indexOf` 版會整組錯位且沒有任何閘會紅。
 */
function livestockFarm(key: keyof typeof FARM_HIGHLIGHT_OPTIONS): LayerParamSpec[] {
  const names = FARM_HIGHLIGHT_OPTIONS[key];
  return [
    opacitySlider(`${key}Opacity`, 0.85),
    {
      kind: "slider", name: `${key}Scale`, labelPrefix: "大小", digits: 2,
      default: 0.3, min: 0.01, max: 0.5, step: 0.01,
    },
    {
      kind: "select", name: `${key}HighlightIdx`, label: "品項 全部", default: "0",
      labelByValue: Object.fromEntries(names.map((n, i) => [String(i), `品項 ${n}`])),
      options: names.map((n, i) => ({ label: n, value: String(i) })),
      out: `${key}HighlightIdx`, encodeNumeric: true,
    },
  ];
}

/**
 * 「Opacity x.xx」滑桿 ＋ 共用 slot ＋ 第二通道（P3-2D 群1）。
 *
 * NCDR 示警 5 群組與衛星 16 層各自**共用同一份值**（原本是一個 `useState` 被
 * 5 / 16 個 `case` fall-through 共用），且值不進 overlayParams —— 兩層都是
 * Three.js / CustomLayer 直接吃 hook 回傳的欄位。
 *
 * ⚠️ 每次呼叫回**新物件**：`sharedGroup` 的成員規格必須逐欄位相同（閘 1 用 toEqual 驗），
 * 共用同一個物件 reference 反而會讓「誰改到誰」變得看不出來。
 */
function sharedReturnOpacity(name: string, group: string, def: number): SliderParamSpec {
  return {
    kind: "slider", name, labelPrefix: "Opacity", digits: 2,
    default: def, min: 0, max: 1, step: 0.05,
    sharedGroup: group, out: null,
  };
}
/** NCDR 示警 5 群組共用的 `daOpacity` */
function alertOpacity(): SliderParamSpec {
  return sharedReturnOpacity("daOpacity", "daOpacity", 1.0);
}
/** 衛星 16 層共用的 `satOpacity` */
function satelliteOpacity(): SliderParamSpec {
  return sharedReturnOpacity("satOpacity", "satOpacity", 1.0);
}

/**
 * 公車／垃圾車 8 區分組的**顯示順序**（＝控件順序，也是 `enabledBusCities` 的展開順序）。
 * 原本硬寫在 `useTransportParams` 的 case 裡；規格與 hook 兩邊都要用同一份，
 * 各寫一份必漂移（順序不同 → 傳給 RPC 的城市陣列順序不同）。
 */
export const BUS_GROUP_ORDER = [
  "TaipeiMetro", "KeelungYilan", "TaoyuanHsinchuMiaoli", "CentralTaiwan",
  "YunChiaNan", "Kaoping", "HualienTaitung", "OffshoreIslands",
] as const satisfies readonly BusGroup[];

/**
 * 8 區分組 checkbox → 8 個獨立 boolean 參數（P3-2D 群2/3）。
 *
 * 手寫版是一個 `Record<BusGroup, boolean>` 的 useState ＋ `.map()` 出 8 個 toggle。
 * 拆平成獨立參數，store 的 value 型別因此不必支援巢狀物件；
 * hook 端再聚合回 `enabledBusCities` / `enabledWasteScheduleCities`。
 */
function busGroupToggles(
  prefix: string,
  defaults: Record<BusGroup, boolean>,
): ToggleParamSpec[] {
  return BUS_GROUP_ORDER.map((g) => ({
    kind: "toggle" as const,
    name: `${prefix}${g}`,
    label: BUS_GROUP_LABELS[g],
    default: defaults[g],
    out: null,
  }));
}

/** 三種公車圖層共用的「Color」染色模式 select（路線 / 速度 / 密度；值走 Three.js ref） */
function busColorSelect(name: string): SelectNoOverlayParamSpec {
  return {
    kind: "select", name, label: "Color", default: "route",
    options: [
      { label: "路線", value: "route" },
      { label: "速度", value: "speed" },
      { label: "密度", value: "density" },
    ],
    out: null,
  };
}

/** 高鐵／台鐵／捷運三層共用的站點大小（跨 case 共用同一個 useState 的等價表達） */
function stationScaleSlider(): SliderParamSpec {
  return {
    kind: "slider", name: "stationScale", labelPrefix: "Stn", digits: 1,
    default: 1, min: 0.3, max: 3, step: 0.1,
    sharedGroup: "stationScale",
  };
}

/** 站點／碼頭／機場的月台柱高度（五處同構，只有參數名與 default 不同） */
function pillarHeightSlider(name: string, def: number): SliderParamSpec {
  return {
    kind: "slider", name, labelPrefix: "Height", digits: 1,
    default: def, min: 0.2, max: 3, step: 0.1, out: null,
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
  // ══════════ P3-2C 群1：labelSuffix ／ 整數內插 14 層 ══════════
  //
  // 這批退回 C 的唯一理由是 label 的**尾巴**：`…px` / `…×` / `… min`。
  // 加了 `labelSuffix` 之後形狀就與 A 桶純 slider 沒有差別。
  //
  // ⚠️ 「整數內插」（`粒子數 ${x}` / `保留 ${x} min` —— 原文沒有 `.toFixed`）
  //    一律寫成 `digits: 0`：這三個控件的 min/max/step/default 全是整數
  //    （粒子數 2000→50000 step 1000、保留 5→360 step 5），
  //    滑桿產不出小數，`x.toFixed(0)` 與 `${x}` 逐字等價。
  //    ——若日後有人把 step 改成小數，字串會從 "7.5" 變 "8"，屬於行為變更、
  //    黃金快照會紅（它比的是預設值下的字串），不是靜默漂移。

  // ── 交通/設施點層：大小 ＋ 透明度 ＋ Z 漂浮 ──
  cctv: [
    scaleSlider("cctvScale", 1),
    opacitySlider("cctvOpacity", 0.7),
    zFloatSlider("cctvZ"),
  ],
  fireHydrants: [
    scaleSlider("fireHydrantsScale", 1),
    opacitySlider("fireHydrantsOpacity", 0.7),
    zFloatSlider("fireHydrantsZ"),
  ],
  etcGantry: [
    scaleSlider("etcGantryScale", 1),
    opacitySlider("etcGantryOpacity", 0.8),
    zFloatSlider("etcGantryZ"),
  ],
  serviceArea: [
    scaleSlider("serviceAreaScale", 1.4),
    opacitySlider("serviceAreaOpacity", 0.85),
    zFloatSlider("serviceAreaZ"),
  ],
  taxiStand: [
    scaleSlider("taxiStandScale", 1),
    opacitySlider("taxiStandOpacity", 0.8),
    zFloatSlider("taxiStandZ"),
  ],
  agriculture: [
    opacitySlider("agricultureOpacity", 1),
    { kind: "slider", name: "agricultureOutlineWidth", labelPrefix: "邊框寬", digits: 1, default: 1, min: 0, max: 5, step: 0.1 },
    { kind: "toggle", name: "agricultureShowOutline", label: "邊框 Outline", default: true },
    zFloatSlider("agricultureZ"),
  ],
  wasteStopsStatic: [
    // ⚠️ 大小是 2 位小數（不是 scaleSlider 的 1 位）—— 同名不同形，不可複用建構子
    { kind: "slider", name: "wasteStopsStaticScale", labelPrefix: "大小", digits: 2, default: 1, min: 0.3, max: 3, step: 0.1 },
    { kind: "slider", name: "wasteStopsStaticGlow", labelPrefix: "光暈", digits: 2, default: 0.1, min: 0, max: 0.5, step: 0.02 },
    zFloatSlider("wasteStopsStaticZ"),
  ],

  // ── 能源 glow 三層：透明度 ＋ 倍率（label 尾巴是「×」）──
  powerPlantGlow: [
    opacitySlider("powerPlantGlowOpacity", 0.9),
    { kind: "slider", name: "powerPlantGlowSize", labelPrefix: "大小", digits: 2, labelSuffix: "×", default: 1, min: 0.2, max: 3, step: 0.05 },
  ],
  substationEhvGlow: [
    opacitySlider("substationEhvGlowOpacity", 0.9),
    { kind: "slider", name: "substationEhvGlowSize", labelPrefix: "大小", digits: 2, labelSuffix: "×", default: 1, min: 0.2, max: 3, step: 0.05 },
  ],
  powerLinesGlow: [
    opacitySlider("powerLinesGlowOpacity", 0.7),
    { kind: "slider", name: "powerLinesGlowWidth", labelPrefix: "寬度", digits: 1, labelSuffix: "×", default: 2, min: 0.5, max: 5, step: 0.1 },
  ],

  // ── 氣候場兩層：透明度 min 是 0（不是 opacitySlider 的 0.1）→ 寫字面 ──
  oceanCurrents: [
    { kind: "slider", name: "oceanCurrentsOpacity", labelPrefix: "透明度", digits: 2, default: 0.65, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "oceanAnimationSpeed", labelPrefix: "動畫速度", digits: 1, labelSuffix: "×", default: 1, min: 0.2, max: 3, step: 0.1 },
    { kind: "slider", name: "oceanParticleCount", labelPrefix: "粒子數", digits: 0, default: 12000, min: 2000, max: 50000, step: 1000 },
    { kind: "slider", name: "oceanLineWidth", labelPrefix: "線寬", digits: 2, labelSuffix: "px", default: 1.05, min: 0.5, max: 1.5, step: 0.05 },
  ],
  windField: [
    { kind: "slider", name: "windFieldOpacity", labelPrefix: "透明度", digits: 2, default: 0.8, min: 0, max: 1, step: 0.05 },
    { kind: "slider", name: "windAnimationSpeed", labelPrefix: "動畫速度", digits: 1, labelSuffix: "×", default: 1, min: 0.2, max: 3, step: 0.1 },
    // ⚠️ 粒子數上限 80000（海流是 50000）—— 兩層同構但不同值，別互相複製
    { kind: "slider", name: "windParticleCount", labelPrefix: "粒子數", digits: 0, default: 12000, min: 2000, max: 80000, step: 1000 },
    { kind: "slider", name: "windLineWidth", labelPrefix: "線寬", digits: 2, labelSuffix: "px", default: 1.15, min: 0.5, max: 1.5, step: 0.05 },
  ],

  // ── 落雷兩層：保留分鐘（整數內插 ＋ 後綴）在前、透明度在後 ──
  lightningCwa: [
    { kind: "slider", name: "lightningCwaMinutes", labelPrefix: "保留", digits: 0, labelSuffix: " min", default: 10, min: 5, max: 360, step: 5 },
    opacitySlider("lightningCwaOpacity", 0.85),
  ],
  lightning: [
    { kind: "slider", name: "lightningMinutes", labelPrefix: "保留", digits: 0, labelSuffix: " min", default: 10, min: 5, max: 360, step: 5 },
    opacitySlider("lightningOpacity", 0.85),
  ],
  // ══════════ P3-2C 群2：encodeNumeric ／ 條件式 label ／ 動態 select 16 層 ══════════

  // ── 數值型 select（out 吃 `Number(value)` 不是索引）──
  waterFloodExtreme: [
    opacitySlider("waterFloodOpacity", 1),
    {
      kind: "select", name: "floodMinDepth", label: "深度", default: "0",
      options: [
        { label: "全部", value: "0" },
        { label: "≥0.5m", value: "0.5" },
        { label: "≥1m", value: "1" },
        { label: "≥2m", value: "2" },
        { label: "≥3m 最嚴重", value: "3" },
      ],
      // ⚠️ paint 吃的是**公尺數**：`"0.5"` → 0.5（索引版會給 1）。
      //    預設 "0" 時兩種編碼碰巧都是 0 → 黃金快照分不出來，靠行為測試擋。
      out: "floodMinDepth", encodeNumeric: true,
    },
  ],
  precipRaster: [
    opacitySlider("precipRasterOpacity", 0.6),
    {
      kind: "select", name: "precipRasterHours", label: "累積時長", default: "24",
      options: [
        { label: "1 小時", value: "1" },
        { label: "3 小時", value: "3" },
        { label: "6 小時", value: "6" },
        { label: "24 小時", value: "24" },
      ],
      out: "precipRasterHours", encodeNumeric: true,
    },
  ],

  // ── 警察覆蓋分析 isochrone 3 層 ──
  // ⚠️ 同一個 key 裡兩種編碼並存：`Mode` 走 encode（`["walk","drive"].indexOf`
  //    與原文 `mode === "drive" ? 1 : 0` 恰好等價）、`Minutes` 走 encodeNumeric
  //    （原文是 `Number(minutes)`）。P3-2B 就是因為 spec 是 per-key 整包宣告、
  //    `Minutes` 那半搬不動，才把整個 key 退回 C。
  policeIsoSubstation: [
    {
      kind: "select", name: "policeIsoSubstationMode", label: "模式", default: "walk",
      options: [{ label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" }],
      out: "policeIsoSubstationMode_drive", encode: ["walk", "drive"],
    },
    {
      kind: "select", name: "policeIsoSubstationMinutes", label: "分鐘", default: "5",
      options: [{ label: "5 分", value: "5" }, { label: "10 分", value: "10" }],
      out: "policeIsoSubstationMinutes_num", encodeNumeric: true,
    },
    { kind: "slider", name: "policeIsoSubstationOpacity", labelPrefix: "透明度", digits: 2, default: 0.55, min: 0.1, max: 0.9, step: 0.05 },
  ],
  policeIsoPrecinct: [
    {
      kind: "select", name: "policeIsoPrecinctMode", label: "模式", default: "drive",
      options: [{ label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" }],
      out: "policeIsoPrecinctMode_drive", encode: ["walk", "drive"],
    },
    {
      kind: "select", name: "policeIsoPrecinctMinutes", label: "分鐘", default: "15",
      options: [{ label: "15 分", value: "15" }, { label: "30 分", value: "30" }],
      out: "policeIsoPrecinctMinutes_num", encodeNumeric: true,
    },
    { kind: "slider", name: "policeIsoPrecinctOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: 0.1, max: 0.9, step: 0.05 },
  ],
  policeIsoCityDept: [
    {
      kind: "select", name: "policeIsoCityDeptMode", label: "模式", default: "drive",
      options: [{ label: "步行 Walk", value: "walk" }, { label: "開車 Drive", value: "drive" }],
      out: "policeIsoCityDeptMode_drive", encode: ["walk", "drive"],
    },
    {
      kind: "select", name: "policeIsoCityDeptMinutes", label: "分鐘", default: "30",
      options: [{ label: "30 分", value: "30" }, { label: "60 分", value: "60" }],
      out: "policeIsoCityDeptMinutes_num", encodeNumeric: true,
    },
    { kind: "slider", name: "policeIsoCityDeptOpacity", labelPrefix: "透明度", digits: 2, default: 0.45, min: 0.1, max: 0.9, step: 0.05 },
  ],

  // ── 條件式 label：0 = 關（`zeroLabel`）／前綴不補空白（`labelSep`）──
  osmRoadDrive: [
    { kind: "slider", name: "osmRoadDriveZ5Reveal", labelPrefix: "全台顯示", digits: 2, zeroLabel: "關", default: 0, min: 0, max: 1, step: 0.1 },
    { kind: "slider", name: "osmRoadDriveWidth", labelPrefix: "寬度", digits: 1, default: 1, min: 0.3, max: 4, step: 0.1 },
    opacitySlider("osmRoadDriveOpacity", 0.85),
  ],
  powerPoles: [
    { kind: "slider", name: "powerPolesZ5Reveal", labelPrefix: "全台顯示", digits: 2, zeroLabel: "關", default: 0, min: 0, max: 1, step: 0.1 },
    { kind: "slider", name: "powerPolesHeat", labelPrefix: "熱區", digits: 2, zeroLabel: "關", default: 1, min: 0, max: 1, step: 0.05 },
    scaleSlider("powerPolesSize", 1),
    opacitySlider("powerPolesOpacity", 0.7),
  ],
  facPrimary: [
    { kind: "slider", name: "facPrimaryScale", labelPrefix: "總大小", digits: 1, default: 0.5, min: 0.3, max: 3, step: 0.1 },
    // ⚠️ 全形括號結尾後**沒有空白**（`大廠（即時）1.30`）→ labelSep ""
    { kind: "slider", name: "facPrimaryRtScale", labelPrefix: "大廠（即時）", labelSep: "", digits: 2, default: 1.3, min: 0.2, max: 3, step: 0.05 },
    { kind: "slider", name: "facPrimaryNoRtScale", labelPrefix: "其他廠", digits: 2, default: 0.85, min: 0.1, max: 2, step: 0.05 },
    opacitySlider("facPrimaryOpacity", 0.65),
  ],

  // ── label 隨當前值變的 select（`labelByValue`）──
  agriCropSuitability: [
    opacitySlider("agriCropSuitabilityOpacity", 1),
    {
      kind: "select", name: "agriCropSuitabilityCropId",
      // 兜底＝手寫版的 `?? CROP_SUITABILITY_CROPS[0]`（查無 id 時顯示第 0 種作物）
      label: `作物 ${CROP_SUITABILITY_CROPS[0]!.nameZh}`,
      labelByValue: Object.fromEntries(
        CROP_SUITABILITY_CROPS.map((c) => [String(c.id), `作物 ${c.nameZh}`]),
      ),
      default: "0",
      // ⚠️ 顯示表 ≠ 選項表：label 只有 nameZh、選項是 `${nameZh} (${nameEn})`
      options: CROP_SUITABILITY_CROPS.map((c) => ({
        label: `${c.nameZh} (${c.nameEn})`, value: String(c.id),
      })),
      // ⚠️ 132 種作物的 id 現況恰好是 0..131（位置＝id），所以 indexOf 版**現在**
      //    也算得出同樣的數字 —— 但 overlayParams 要的是 crop id 本身，
      //    上游哪天插一種作物就會整組錯位。宣告 encodeNumeric 把意圖釘死。
      out: "agriCropSuitabilityCropId", encodeNumeric: true,
    },
  ],
  livestockFarmPig: livestockFarm("livestockFarmPig"),
  livestockFarmChicken: livestockFarm("livestockFarmChicken"),
  livestockFarmCattle: livestockFarm("livestockFarmCattle"),
  livestockFarmDuck: livestockFarm("livestockFarmDuck"),
  livestockFarmGoose: livestockFarm("livestockFarmGoose"),
  livestockFarmSheep: livestockFarm("livestockFarmSheep"),
  livestockFarmOther: livestockFarm("livestockFarmOther"),

  // ══════════ P3-2C 群3：條件式顯示 ＋ 選項停用 2 層 ══════════
  //
  // C 桶最後兩個，也是唯二「控件清單本身隨值伸縮」的 key。
  // ⚠️ manifest 的 count 記的是**預設值下**看得到幾個（3 / 4），不是宣告數（4 / 6）——
  //    焊接測試因此改比 `visibleParamsSpec(spec, defaults)`，見該測試的說明。

  buildingsGba: [
    {
      kind: "select", name: "buildingsGbaModeIdx", label: "顯示模式", default: "0",
      options: [...BUILDINGS_GBA_MODES],
      // 存的是模式編號本身（手寫版是 `parseInt(v, 10)` 直接進 overlayParams）
      out: "buildingsGbaModeIdx", encodeNumeric: true,
    },
    { kind: "slider", name: "buildingsGbaMinHeight", labelPrefix: "高度門檻 ≥", digits: 0, labelSuffix: " m", default: 0, min: 0, max: 100, step: 5 },
    { kind: "slider", name: "buildingsGbaOpacity", labelPrefix: "透明度", digits: 2, default: 0.75, min: 0, max: 1, step: 0.05 },
    // 夜景燈光模式（第 3 個選項）專屬：其他模式下這個門檻沒有東西吃
    {
      kind: "slider", name: "buildingsGbaBloomMinHeight", labelPrefix: "Bloom 高樓門檻 ≥", digits: 0, labelSuffix: " m",
      default: 100, min: 40, max: 200, step: 10,
      showWhen: { param: "buildingsGbaModeIdx", equals: "3" },
    },
  ],

  // 控件組沿用人口網格（h3Population / popCount）：Opacity → Contrast → 3D → Height。
  // 對比／高度只在 3D 開啟時出現 —— 本層 contrast 只驅動 extrusion 高度、不影響 2D 配色，
  // 2D 時常駐會是「拉了沒反應」的死控件。
  propertyValueGrid: [
    {
      kind: "select", name: "propertyValueGridScaleIdx", label: "網格大小", default: "0",
      options: PROPERTY_VALUE_SCALES.map((sc) => ({ label: sc.label, value: sc.value })),
      out: "propertyValueGridScaleIdx", encodeNumeric: true,
    },
    {
      kind: "select", name: "propertyValueGridModeIdx", label: "上色模式", default: "0",
      options: PROPERTY_VALUE_GRID_MODES.map((m) => ({ label: m.label, value: m.value })),
      // 人均市值只有帶 pop 的 450m / 1.5km 磚算得出來（150m 沒有 pop 屬性）→ 停用而非
      // 自動跳尺度；paint／圖例那側由 resolvePropertyValueGridMode() 回退成總市值。
      // ⚠️ 可用尺度從 PROPERTY_VALUE_SCALES 的 hasPop 推導，不手抄 ["1","2"]
      disableRule: {
        option: "1",
        param: "propertyValueGridScaleIdx",
        enabledWhenIn: PROPERTY_VALUE_SCALES.filter((sc) => sc.hasPop).map((sc) => sc.value),
        reason: "（僅 450m / 1.5km 提供）",
      },
      out: "propertyValueGridModeIdx", encodeNumeric: true,
    },
    { kind: "slider", name: "propertyValueGridOpacity", labelPrefix: "填色透明度", digits: 2, default: 0.7, min: 0, max: 1, step: 0.05 },
    { kind: "toggle", name: "propertyValueGridExtruded", label: "3D 立體", default: false },
    {
      kind: "slider", name: "propertyValueGridContrast", labelPrefix: "對比 Contrast", digits: 1,
      default: 1.8, min: 0.5, max: 4, step: 0.1,
      showWhen: { param: "propertyValueGridExtruded", equals: true },
    },
    {
      kind: "slider", name: "propertyValueGridElevationScale", labelPrefix: "整體高度 Height", digits: 0,
      default: 40, min: 10, max: 400, step: 10,
      showWhen: { param: "propertyValueGridExtruded", equals: true },
    },
  ],

  // ══════════ D 桶群1：值走 hook return 的平鋪欄位（P3-2D）══════════
  // 以下 34 個 key 的參數**不進 overlayParams**（`out: null`）或同時走兩條通道；
  // 回傳路徑逐一宣告在 `hooks/__tests__/useTransportParamsReturn.test.ts`
  // 的 `RETURN_CHANNEL`，那張表就是第二通道的文件。

  // ── NCDR 示警 5 群組：單一 source、共用一支 opacity（分開調沒有意義）──
  lifelineAlerts: [alertOpacity()],
  floodAlerts: [alertOpacity()],
  weatherAlerts: [alertOpacity()],
  transitAlerts: [alertOpacity()],
  safetyAlerts: [alertOpacity()],

  // ── 衛星 16 個國別／系列層：同上，共用一支 opacity ──
  satellitesYaogan: [satelliteOpacity()],
  satellitesJilin: [satelliteOpacity()],
  satellitesGaofen: [satelliteOpacity()],
  satellitesTJS: [satelliteOpacity()],
  satellitesBeidou: [satelliteOpacity()],
  satellitesShiyan: [satelliteOpacity()],
  satellitesTaiwan: [satelliteOpacity()],
  satellitesUSA: [satelliteOpacity()],
  satellitesJapan: [satelliteOpacity()],
  satellitesRussia: [satelliteOpacity()],
  satellitesIndia: [satelliteOpacity()],
  satellitesKorea: [satelliteOpacity()],
  satellitesFrance: [satelliteOpacity()],
  satellitesGermany: [satelliteOpacity()],
  satellitesItaly: [satelliteOpacity()],
  satellitesIsrael: [satelliteOpacity()],

  earthquakes: [
    {
      kind: "slider", name: "eqOpacity", labelPrefix: "Opacity", digits: 2,
      default: 1.0, min: 0, max: 1, step: 0.05, out: null,
    },
    // ⚠️ 參數名**不**沿用舊 useState 的 `eqShowHistory` —— 那是 boolean，
    //    而控件本體是 select（`"timeline"` / `"history"`）。hook 端還原成
    //    `eqShowHistory = value === "history"` 再回傳，回傳 API 一字未動。
    {
      kind: "select", name: "eqMode", label: "Mode", default: "timeline",
      options: [{ label: "Timeline", value: "timeline" }, { label: "History", value: "history" }],
      out: null,
    },
  ],
  // 事件選擇 / 播放控制在 EarthquakeReplayPanel（清單 + scrub 塞不進 240px sidebar，鐵則 4）
  earthquakeReplay: [
    {
      kind: "slider", name: "eqReplayOpacity", labelPrefix: "透明度", digits: 2,
      default: 0.95, min: 0, max: 1, step: 0.05, out: null,
    },
  ],
  roadEvents: [
    {
      kind: "slider", name: "reOpacity", labelPrefix: "Opacity", digits: 2,
      default: 1.0, min: 0, max: 1, step: 0.05, out: null,
    },
  ],
  plaActivity: [
    // 疊加天數（1=單日）走圖層自己的 clock —— 全域時間軸最多 7 天視窗，
    // 表達不了 30~120 天的掃描。hook 端 `Number(value)` 還原成數字回傳。
    {
      kind: "select", name: "plaTrailDays", label: "疊加", default: "1",
      options: [
        { label: "單日", value: "1" },
        { label: "30 天", value: "30" },
        { label: "60 天", value: "60" },
        { label: "90 天", value: "90" },
        { label: "120 天", value: "120" },
      ],
      out: null,
    },
    // 單日沒有東西可掃 → 回放只在疊加 > 單日時有意義
    { kind: "toggle", name: "plaReplay", label: "回放", default: false, out: null },
    {
      kind: "slider", name: "plaOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.6, min: 0, max: 1, step: 0.05, out: null,
    },
    // showReview 預設 false —— 未通過守門的形狀不當成正式資料預設顯示
    { kind: "toggle", name: "plaShowReview", label: "待核實", default: false, out: null },
  ],

  // ── 影像 IMAGERY（預載 1~7d 共用 timeline rangeDays，這裡不重覆出 slider）──
  cwaCloudImagery: [
    {
      kind: "slider", name: "cwaCloudOpacity", labelPrefix: "Opacity", digits: 2,
      default: 1.0, min: 0, max: 1, step: 0.05, out: null,
    },
  ],
  cwaRadarImagery: [
    {
      kind: "slider", name: "cwaRadarOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.85, min: 0, max: 1, step: 0.05, out: null,
    },
  ],
  aqiImagery: [
    {
      kind: "slider", name: "aqiImageryOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.7, min: 0.1, max: 1, step: 0.05, out: null,
    },
  ],
  aqiMicroSensors: [
    // ⚠️ **兩條通道都走**：paint 端由 hook 的 setPaintProperty 換色欄，
    //    overlayParams 的 `aqiMicroModeIdx` 只供 LegendPanel 選對應圖例。
    //    options 直接吃 SSOT 常數（帶 colorField / legend / note 等額外欄位，
    //    手寫版也是整包丟給控件的 —— 拆成 label/value 會讓黃金快照紅）。
    {
      kind: "select", name: "aqiMicroModeIdx", label: "顯示模式", default: "0",
      options: MICRO_SENSOR_MODES,
      out: "aqiMicroModeIdx", encodeNumeric: true,
    },
    { kind: "toggle", name: "aqiMicroCluster", label: "Cluster", default: true, out: null },
  ],

  // ── 底圖 Base map：opacity 同時進 overlayParams（paint）與 hook return ──
  hillshade: [opacitySlider("hillshadeOpacity", 0.5)],
  slopeVector: [
    {
      kind: "slider", name: "slopeVectorOpacity", labelPrefix: "透明度", digits: 2,
      default: 0.6, min: 0.3, max: 1, step: 0.05,
    },
  ],
  aspectVector: [
    {
      kind: "slider", name: "aspectVectorOpacity", labelPrefix: "透明度", digits: 2,
      default: 0.6, min: 0.3, max: 1, step: 0.05,
    },
  ],
  // 溫度網格 2D（與溫度波共用資料源）——值走 hook return 餵 useTemperatureGridLayer
  temperatureGrid: [
    {
      kind: "slider", name: "tempGridOpacity", labelPrefix: "透明度", digits: 2,
      default: 0.7, min: 0.1, max: 1, step: 0.05, out: null,
    },
  ],
  // ══════════ D 桶群2：值走 refs.current（Three.js render loop）══════════
  // 這一批的 `useRef` initial 一律吃**規格常數**（`paramDefault`）而不是 store 現值 ——
  // 見 `hooks/__tests__/useTransportParamsReturn.test.ts` 的盲區說明：
  // 前者才讓「刪掉 ref 同步行」這個突變驗得出來。

  flights: [
    // Alt ×3.0：前綴自帶 `×`、與數字之間沒有空白 → labelSep ""
    {
      kind: "slider", name: "altExaggeration", labelPrefix: "Alt ×", labelSep: "", digits: 1,
      default: 3, min: 1, max: 5, step: 0.5, out: null,
    },
    {
      kind: "slider", name: "altOffset", labelPrefix: "Z +", labelSep: "", digits: 0,
      labelSuffix: "m", default: 50, min: 0, max: 200, step: 50, out: null,
    },
    {
      kind: "slider", name: "staticOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.1, min: 0.02, max: 0.5, step: 0.02, out: null,
    },
    {
      kind: "slider", name: "orbScale", labelPrefix: "Orb", digits: 1, displayScale: 100000,
      default: 0.000005, min: 0.000001, max: 0.00001, step: 0.000001, out: null,
    },
  ],
  ships: [
    {
      kind: "slider", name: "shipOrbScale", labelPrefix: "Ship Orb", digits: 1, displayScale: 100000,
      default: 0.000003, min: 0.000001, max: 0.00002, step: 0.000001, out: null,
    },
    {
      kind: "slider", name: "shipTrailOpacity", labelPrefix: "Ship Trail", digits: 2,
      default: 0.15, min: 0.05, max: 1, step: 0.05, out: null,
    },
  ],
  rail: [
    { kind: "toggle", name: "railTrainVisible", label: "Train", default: true, out: null },
    {
      kind: "select", name: "railTrackMode", label: "Track", default: "3d",
      options: [{ label: "2D", value: "2d" }, { label: "3D", value: "3d" }],
      out: null,
    },
    {
      kind: "slider", name: "railAltOffset", labelPrefix: "Rail Z +", labelSep: "", digits: 0,
      labelSuffix: "m", default: 110, min: 0, max: 500, step: 10, out: null,
    },
    {
      kind: "slider", name: "railOrbScale", labelPrefix: "Rail Orb", digits: 1, displayScale: 100000,
      default: 0.00001, min: 0.000001, max: 0.00002, step: 0.000001, out: null,
    },
    {
      kind: "slider", name: "railTrackOpacity", labelPrefix: "Rail Trk", digits: 2,
      default: 0.35, min: 0.05, max: 1, step: 0.05, out: null,
    },
  ],
  busLive: [
    // 8 區分組 checkbox：原本是一個 `Record<BusGroup, boolean>` 的 useState，
    // 拆成 8 個獨立 boolean 參數（store 的 value 不必支援巢狀物件）。
    // hook 端重新聚合成 `enabledBusCities`（BusGroup → BusCity[] 展開）。
    ...busGroupToggles("busGroup", {
      TaipeiMetro: true, KeelungYilan: false, TaoyuanHsinchuMiaoli: false, CentralTaiwan: false,
      YunChiaNan: false, Kaoping: false, HualienTaitung: false, OffshoreIslands: false,
    }),
    busColorSelect("busColorMode"),
    {
      kind: "slider", name: "busAltOffset", labelPrefix: "Bus Z +", labelSep: "", digits: 0,
      labelSuffix: "m", default: 0, min: 0, max: 500, step: 10, out: null,
    },
    {
      kind: "slider", name: "busOrbScale", labelPrefix: "Bus Orb", digits: 0, displayScale: 1000000,
      default: 0.000004, min: 0.000001, max: 0.00001, step: 0.000001, out: null,
    },
  ],
  busIntercityLive: [
    busColorSelect("busIntercityColorMode"),
    {
      kind: "slider", name: "busIntercityAltOffset", labelPrefix: "InterCity Z +", labelSep: "",
      digits: 0, labelSuffix: "m", default: 0, min: 0, max: 500, step: 10, out: null,
    },
    {
      kind: "slider", name: "busIntercityOrbScale", labelPrefix: "InterCity Orb", digits: 0,
      displayScale: 1000000,
      default: 0.000004, min: 0.000001, max: 0.00001, step: 0.000001, out: null,
    },
  ],
  touristShuttleLive: [
    busColorSelect("touristShuttleColorMode"),
    {
      kind: "slider", name: "touristShuttleOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.85, min: 0.2, max: 1, step: 0.05, out: null,
    },
    {
      kind: "slider", name: "touristShuttleAltOffset", labelPrefix: "Shuttle Z +", labelSep: "",
      digits: 0, labelSuffix: "m", default: 0, min: 0, max: 500, step: 10, out: null,
    },
    {
      kind: "slider", name: "touristShuttleOrbScale", labelPrefix: "Shuttle Orb", digits: 0,
      displayScale: 1000000,
      default: 0.000004, min: 0.000001, max: 0.00001, step: 0.000001, out: null,
    },
  ],
  lighthouses: [
    // ⚠️ 只有 lighthouseScale 走 overlayParams（paint 吃），三個光束參數全是 Three.js ref
    {
      kind: "slider", name: "lighthouseScale", labelPrefix: "LH", digits: 1,
      default: 0.6, min: 0.3, max: 3, step: 0.1,
    },
    { kind: "toggle", name: "beamVisible", label: "Beam", default: true, out: null },
    {
      kind: "slider", name: "beamDistance", labelPrefix: "Dist", digits: 1,
      default: 0.9, min: 0.2, max: 3, step: 0.1, out: null,
    },
    {
      kind: "slider", name: "beamOpacity", labelPrefix: "Opa", digits: 2,
      default: 0.1, min: 0.05, max: 0.8, step: 0.05, out: null,
    },
  ],
  // 三個系統的站點大小共用一支 slider（跨 case 共用同一個 useState 的等價表達）
  stationsTHSR: [
    stationScaleSlider(),
    { kind: "toggle", name: "thsrPillarVisible", label: "Pillar", default: true, out: null },
    pillarHeightSlider("thsrPillarHeight", 0.6),
  ],
  stationsTRA: [
    stationScaleSlider(),
    { kind: "toggle", name: "traPillarVisible", label: "Pillar", default: true, out: null },
    pillarHeightSlider("traPillarHeight", 0.5),
  ],
  stationsMetro: [
    stationScaleSlider(),
    // ⚠️ 唯一**兩條通道都走**的月台柱開關：overlayParams 的 key 是 `metroPillar3d`
    //    （與參數名不同名），Three.js 那側另外吃 ref。
    {
      kind: "toggle", name: "metroPillarVisible", label: "Pillar", default: false,
      out: "metroPillar3d",
    },
    pillarHeightSlider("metroPillarHeight", 0.2),
  ],
  ports: [
    { kind: "slider", name: "portGlow", labelPrefix: "Glow", digits: 1, default: 1, min: 0, max: 3, step: 0.1 },
    { kind: "toggle", name: "portPillarVisible", label: "Pillar", default: false, out: null },
    pillarHeightSlider("portPillarHeight", 0.3),
  ],
  airports: [
    {
      kind: "slider", name: "airportOpacity", labelPrefix: "APT", digits: 2,
      default: 0.12, min: 0, max: 0.3, step: 0.01,
    },
    {
      kind: "slider", name: "airportGlow", labelPrefix: "Glow", digits: 1,
      default: 0.8, min: 0, max: 2, step: 0.1,
    },
    { kind: "toggle", name: "airportPillarVisible", label: "Pillar", default: false, out: null },
    pillarHeightSlider("airportPillarHeight", 0.6),
  ],
  // 消防分隊：散點（Mapbox circle）與 3D 光柱（Three.js）各自開關 → 前者走 paint、後者走 ref
  fireStations: [
    { kind: "toggle", name: "fireStationsDots", label: "散點", default: true },
    { kind: "toggle", name: "fireStations3D", label: "3D 光柱波動", default: true, out: null },
    scaleSlider("fireStationsScale", 1),
    opacitySlider("fireStationsOpacity", 0.85),
    zFloatSlider("fireStationsZ"),
  ],
  temperatureWave: [
    { kind: "toggle", name: "tempExtruded", label: "3D", default: true, out: null },
    {
      kind: "slider", name: "tempHeight", labelPrefix: "Height", digits: 0,
      default: 200, min: 0, max: 400, step: 20, out: null,
    },
    {
      kind: "slider", name: "tempZOffset", labelPrefix: "Z Offset", digits: 0,
      default: 300, min: 0, max: 1000, step: 50, out: null,
    },
    {
      kind: "slider", name: "tempOpacity", labelPrefix: "Opacity", digits: 2,
      default: 0.85, min: 0.1, max: 1, step: 0.05, out: null,
    },
    { kind: "toggle", name: "tempWireframe", label: "Grid", default: false, out: null },
  ],
  // 新聞三軸 filter 照 Intel Panel 設計；三個值另有 setter 從 hook 導出
  // （IntelPanel / MonitorPanel 的 onFilterChange 直接呼叫）。
  newsEvents: [
    {
      kind: "select", name: "newsMinRelevance", label: "相關度", default: "3",
      options: [
        { label: "全部", value: "0" },
        { label: "地方+", value: "2" },
        { label: "重大", value: "3" },
      ],
      out: null,
    },
    {
      kind: "select", name: "newsMinSeverity", label: "嚴重", default: "1",
      options: [
        { label: "全部", value: "0" },
        { label: "個案+", value: "1" },
        { label: "區域+", value: "2" },
      ],
      out: null,
    },
    { kind: "toggle", name: "newsEventsOnly", label: "只看事件", default: true, out: null },
    { kind: "toggle", name: "newsTimeBased", label: "Time", default: true, out: null },
    { kind: "toggle", name: "newsRipple", label: "Ripple", default: true, out: null },
    {
      kind: "slider", name: "newsScale", labelPrefix: "Scale", digits: 1,
      default: 1, min: 0.3, max: 3, step: 0.1,
    },
  ],

  // 污染場址：opacity / scale 走 paint，「只看列管中」是 filter → hook return
  pollutionSite: [
    opacitySlider("pollutionSiteOpacity", 0.9),
    {
      kind: "slider", name: "pollutionSiteScale", labelPrefix: "大小", digits: 2,
      default: 1, min: 0.3, max: 3, step: 0.1,
    },
    {
      kind: "toggle", name: "pollutionSiteActiveOnly", label: "只看列管中 Active",
      default: true, out: null,
    },
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

/**
 * overlayParams 的 key（slider / toggle 省略 `out` 時等於 `name`）。
 * **回 `null` = 本參數不進 overlayParams**（第二通道，見 `OverlayOutKey` 說明）。
 *
 * ⚠️ 刻意用 `=== undefined` 而不是 `??`：`null ?? name` 會回 `name`，
 * 於是 `out: null` 靜默退化成「用參數名當 overlay key」——多一個 paint 輸入。
 */
export function specOutKey(spec: LayerParamSpec): OverlayOutKey {
  if (spec.kind === "select") return spec.out;
  return spec.out === undefined ? spec.name : spec.out;
}

/** 規格宣告的預設值；查無回 undefined（呼叫端要顯性處理，不要靜默兜底） */
export function paramDefault(key: string, name: string): ParamValue | undefined {
  return SPEC_BY_KEY[key]?.find((s) => s.name === name)?.default;
}

// ── 條件式顯示 ────────────────────────────────────────────────────

/** 補上 spec 的 default，讓 `showWhen` / `disableRule` 一定查得到值 */
export function resolveParamValues(
  spec: readonly LayerParamSpec[],
  values: LayerParamValues,
): LayerParamValues {
  const out: Record<string, ParamValue> = {};
  for (const s of spec) out[s.name] = values[s.name] ?? s.default;
  return out;
}

/**
 * 這份值之下，實際會渲染出來的控件。
 *
 * ⚠️ 渲染器（`buildParamControls`）與焊接測試（spec 的 count/kinds ＝ manifest）
 * **共用本函式**。manifest 的 `count` 記的是 Phase 1 抽取當下、也就是
 * **預設值下**看得到幾個控件（`propertyValueGrid` 記 4 而不是全部 6 個）——
 * 兩邊各寫一份判斷必漂移，而漂移的後果是「條件式控件永遠展不開」這種
 * 只有手動操作才看得出來的失效。
 *
 * ⚠️ **不要**拿本函式去篩 `encodeParamsToOverlay`：收合中的控件其值照樣要
 * 進 overlayParams（見 `ConditionalField` 的說明）。
 */
export function visibleParamsSpec(
  spec: readonly LayerParamSpec[],
  values: LayerParamValues,
): LayerParamSpec[] {
  const resolved = resolveParamValues(spec, values);
  return spec.filter((s) => !s.showWhen || resolved[s.showWhen.param] === s.showWhen.equals);
}

/** `disableRule` 求值後的選項表；沒宣告規則就原封不動回傳 */
export function resolveSelectOptions(
  spec: SelectParamSpec,
  resolved: LayerParamValues,
): ParamSelectOption[] {
  const rule = spec.disableRule;
  if (!rule) return spec.options;
  const enabled = rule.enabledWhenIn.includes(String(resolved[rule.param] ?? ""));
  // ⚠️ 每個選項都要帶 `disabled`（含 false）—— 手寫版是無條件 `return { …, disabled }`，
  //    只在停用時才加這個 key 會讓黃金快照的 params section 紅。
  return spec.options.map((o) => {
    const disabled = o.value === rule.option && !enabled;
    return { label: disabled ? `${o.label}${rule.reason}` : o.label, value: o.value, disabled };
  });
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
 *            或 `Number(value)`（`encodeNumeric`，見該欄說明）
 */
export function encodeParamValue(spec: LayerParamSpec, value: ParamValue): number {
  switch (spec.kind) {
    case "slider":
      return typeof value === "number" ? value : spec.default;
    case "toggle":
      return value ? 1 : 0;
    case "select":
      if (spec.encodeNumeric) return Number(value);
      if (spec.encode) return spec.encode.indexOf(String(value));
      // 第二通道 select（out: null）沒有編碼可言 —— 唯一的呼叫端
      // `encodeParamsToOverlay` 在 outKey === null 時就 continue 了，走到這裡是程式錯誤。
      throw new Error(`select "${spec.name}" 宣告 out: null（第二通道），不該被編碼`);
  }
}
