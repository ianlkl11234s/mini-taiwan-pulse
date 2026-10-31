import { COMPARISON_UI_RECIPES } from '../../data/comparisonStatisticsRecipes';
// ══════════════════════════════════════════════════════════════════
//  Layer Catalog — Sidebar 圖層目錄「單一真實來源」
// ══════════════════════════════════════════════════════════════════
//
// LayerSidebar（手機版）與 IconRailSidebar（桌機版）共用此檔。
//
// 結構（2026-07 現況，PR #72 後）：
// - 32 主題（Theme） → 多子群（SubGroup） → 多 Layer
// - SECTIONS 為 derived flat list，每筆 SectionDef = 一個 SubGroup，
//   title 格式：`主題中文 English · 子群中文`，視覺上連續行構成主題分組。
//   下一階段 sidebar 升級後可直接消費 THEMES。
//
// 規則：
// - LAYER_COLORS：型別強制 Record<keyof LayerVisibility, string>，
//   缺 key 會 tsc 報錯 → 新增 layer 必補色。
// - THEMES：新 SSOT；新增 layer 把 key 放進對應 theme.groups[].layers。
// - 命名格式：一般圖層用 `中文 English`；日本 tab 內圖層用 `中文 日本語`。
// - 預設開關由 useLayerVisibility 控制；動態 RPC 原則上預設關閉。
//
// 排序原則：
// 1. BASE 頂置（不算主題、純底圖）
// 2. 主題順序沿七段敘事帶推進：
//    基準/脈動 → 人與城市 → 公共服務 → 安全緊急 → 環境資源 → 產業 → 情報
// 3. 每主題內子群順序：點位 → 線/面 → 即時 → 分析

import type { LayerVisibility, TransportType } from "../../types";
import { EDUCATION_PRESENTATION_VIEW_KEYS } from "../../data/statisticsPresentationViews";
import { getMedicalStatisticsGroup } from "../../data/medicalStatisticsGroups";
import { ENVIRONMENT_ENABLED_STATISTICS_RECIPES, ENVIRONMENT_STATISTICS_THEME_TITLES, type EnvironmentRecipe } from "../../data/environmentStatisticsRecipes";
import { DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, demographicsTabGroupTitle } from "../../data/demographicsStatisticsRecipes";
import { ADDICTION_ENABLED_STATISTICS_RECIPES, ADDICTION_STATISTICS_SUBGROUPS, ADDICTION_STATISTICS_TAB_THEME_TITLE, ADDICTION_STATISTICS_THEME_TITLE } from "../../data/addictionStatisticsRecipes";
import { LANDSLIDE_ENABLED_STATISTICS_RECIPES, LANDSLIDE_STATISTICS_SUBGROUPS, LANDSLIDE_STATISTICS_TAB_THEME_TITLE, LANDSLIDE_STATISTICS_THEME_TITLE } from "../../data/landslideStatisticsRecipes";
import { ATLAS_DATA_THEME_TITLES, ATLAS_TAB_THEME_TITLES, GB_STATISTICS_DATA_THEME_TITLES, GB_STATISTICS_TAB_THEME_TITLES, atlasDataThemeGroups, atlasTabThemeGroups } from "../../data/atlasStatisticsRecipes";

// ── Color Config ──

import {
  LAYER_MANIFEST, manifestColors,
  type ManifestKey, type LayerManifestEntry, type LayerName, type LayerCountry,
} from "../../data/layerManifest";

/**
 * 手寫色票殘量 —— **AR-22 Phase 2 完成後為空**（348/348 全部由 layerManifest 派生）。
 *
 * 型別 `Omit<Record<全集>, ManifestKey>` 的 tsc 雙向護欄維持不變：
 *   - 漏掉任一「還沒搬」的 key → TS2739 缺屬性
 *   - 已搬進 manifest 的 key 還留在這裡 → excess property 報錯
 * `ManifestKey` 現在涵蓋全部 348 key，`Omit<…>` 因此退化成 `{}` ——
 * 空物件字面**仍然合法**（實測 tsc 0 error），護欄語意也還在：
 * 從 manifest 刪掉任何 key 會立刻讓下方 LAYER_COLORS 的 Record 缺屬性而報錯。
 *
 * ⚠️ 保留本表而非直接刪掉，是為了 Phase 3-4：新 key 若一時無法進 manifest
 * （例如 section 尚未決定），這裡是唯一的合法暫放處。
 *
 * ⚠️ **唯一沒有機械護欄的漏法**（批 1 起記在案，Phase 3 仍適用）：
 * 若這裡放的是 `...SOME_LAYER_COLORS` 這種 spread，**不觸發 excess property check**
 * —— 搬走 key 後忘了刪 spread 會 tsc 綠、黃金快照綠、契約測試綠，
 * 但登記沒真搬走，留下「改 manifest 畫面沒反應」的暗雷。
 * 驗證只能靠 `grep -nE '^\s*\.\.\.'` 限行首（說明註解裡也會出現該字串）。
 * 目前本表無 spread。
 *
 * 各主題的色票判準（哪個常數該引用、哪些只是撞色）逐批記在
 * docs/features/layer-manifest/changelog.md，不在此重複。
 */
const HANDWRITTEN_LAYER_COLORS: Omit<Record<keyof LayerVisibility, string>, ManifestKey> = {
  // （空 —— Phase 2 全數搬完）
};

/**
 * 色票全集 —— 手寫殘量 + manifest 派生。
 * 型別維持 `Record<keyof LayerVisibility, string>`（tsc 護欄不因引入 manifest 而弱化）。
 */
export const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  ...HANDWRITTEN_LAYER_COLORS,
  ...manifestColors(),
};

// ── Transport Labels ──

/**
 * 運具 6 層的顯示文字 —— **值自 P3-3 起直讀 manifest，字串字面已消滅**。
 *
 * 收編前這 6 個值與 manifest 的 `label` 逐字重複（`rail` 自 Phase 1 試點起、
 * 其餘 5 個自批 8 起），改一邊忘另一邊 sidebar 文字就靜默分岔。
 * 動手前機械比對過 6/6 一位元相同（見 P3-3 changelog）。
 *
 * ⚠️ **只收編值、不改 key 空間**：兩個 sidebar 用 `key in TRANSPORT_LABELS`
 * 當**集合測試**（`isTransport`），key 空間是 `TransportType` 而非
 * `keyof LayerVisibility` —— 硬套 `Omit<…, ManifestKey>` 會把型別意義弄壞，
 * 也會讓那個集合測試多出 340 個成員。這張表因此不是「第五張待派生的手寫表」，
 * 而是 `TransportType → manifest` 的**最小 keyed 對照**。
 *
 * 兩道 tsc 護欄（不需要額外測試）：
 * - 漏掉任一 `TransportType` → `Record<TransportType, string>` 缺屬性（TS2739）
 * - 某 key 從 THEMES 掉出去、退化成沒有 `label` 的 orphan entry → 該行立刻紅
 */
export const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: LAYER_MANIFEST.flights.label,
  ships: LAYER_MANIFEST.ships.label,
  rail: LAYER_MANIFEST.rail.label,
  busLive: LAYER_MANIFEST.busLive.label,
  busIntercityLive: LAYER_MANIFEST.busIntercityLive.label,
  touristShuttleLive: LAYER_MANIFEST.touristShuttleLive.label,
};

// ── Type Defs ──

export interface LayerDef {
  key: keyof LayerVisibility;
  /** 結構化名稱（P2）：面板列讀這個，同一行顯示中文＋外文小字＋來源標籤 */
  name: LayerName;
  /** 由 `name` 組出的整串名稱：搜尋、無障礙名稱、Agent 等只要一個字串的地方用 */
  label: string;
  expandable?: boolean;
  /**
   * owner-only 私人圖層：非 owner 帳號顯示鎖頭、禁 toggle。
   * runtime SSOT 為下方 GATED_LAYERS（兩個 sidebar + App toggle gate 共用）。
   */
  gated?: boolean;
  /**
   * 群組變體（圖層面板統一 C 段）：一列對應多個 key 的統計群組（醫療、住宅、土地…）。
   * 面板只在 `lead` 成員的位置畫一列群組列；切換成員走展開區的共用「指標／口徑」連動選單
   * （`${key}Variant`，`state/statisticsLinkedSelect.ts`），不再是列外的手寫 select。
   */
  variant?: { group: string; lead: boolean };
}

export interface SubGroupDef {
  /** 子群顯示名（中文） */
  title: string;
  layers: LayerDef[];
}

export interface ThemeDef {
  /**
   * 主題識別字串（台灣 `中文 English`、日本／法國為台灣主題中文短名）。只在同一 `country` 內唯一：
   * 主題的身分是 (country, title)，不同國家可以同名（例：日本「交通」與之後英國「交通」）。
   * 畫面不直接顯示這串，顯示名稱查 `themeName(theme)`。
   */
  title: string;
  /** 主題屬於哪個國家主體（或世界、模擬）。與 `THEME_SCOPE[country]` 一致（layerConsistency 測試擋漏）。 */
  country: ThemeScope;
  /** 預設是否摺疊 */
  defaultCollapsed?: boolean;
  groups: SubGroupDef[];
}

/** 只帶身分的主題參照（查顯示名稱、大分類用；`ThemeDef` 本身也符合）。 */
export type ThemeRef = Pick<ThemeDef, "country" | "title">;

/** 主題身分的單一字串（React key、摺疊狀態等需要一個字串鍵的地方）。 */
export function themeKey(theme: ThemeRef): string {
  return `${theme.country}:${theme.title}`;
}

/** 尚未標國家的主題（台灣統計兩套目錄先組好，再由 `taiwanThemes` 一次補上 country）。 */
type CatalogTheme = Omit<ThemeDef, "country">;

/** 台灣統計目錄（`STATISTICS_DATA_THEMES`／`STATISTICS_TAB_THEMES`）都屬台灣。 */
function taiwanThemes(themes: readonly CatalogTheme[]): ThemeDef[] {
  return themes.map((theme) => ({ ...theme, country: "TW" }));
}

// 舊型別保留 — 用於 SECTIONS derived flat 結構（兩個 sidebar 元件目前消費此型）
export interface SectionDef {
  title: string;
  layers: LayerDef[];
}

/**
 * 從 layerManifest 取出一筆 LayerDef（AR-22 雙軌過渡）。
 *
 * ⚠️ 用法是**就地替換**：把原本 `{ key: "cctv", label: "…", expandable: true }`
 * 這一行換成 `fromManifest("cctv")`，**位置不動**。THEMES 是有序巢狀結構，
 * 順序就是 UI 顯示順序 —— 若改成「派生的 append 在最後」，圖層會整批換位置，
 * 黃金快照的 themes/sidebarSections section 立刻紅。
 *
 * 選填欄位用條件展開而非 `gated: m.gated`：後者會產生一個值為
 * undefined 的**存在的 key**，跟「這個 key 不存在」在序列化/比對上是兩回事。
 */
function fromManifest(key: ManifestKey): LayerDef {
  // 顯式標成 LayerManifestEntry：LAYER_MANIFEST 走 `satisfies`，逐筆型別只含
  // 該筆真的寫了的欄位 —— 直接讀 m.gated 會被 TS 判成不存在。這裡要的是
  // 「介面上宣告過的選填欄位」語意，widen 到介面才對。
  const m: LayerManifestEntry = LAYER_MANIFEST[key];
  // orphan（section: null）沒有 LayerDef 可派生 —— 連 label 都不存在（型別是 never）。
  // 走到這裡代表有人把 orphan key 寫進了 THEMES，那是接線錯誤不是資料錯誤，
  // 早炸勝過渲染出一顆沒有文字的 toggle。同時也把 union 收斂成 themed 變體。
  if (m.section === null) {
    throw new Error(`[layerManifest] ${key} 是 orphan（不在 THEMES），不該被 fromManifest 引用`);
  }
  const def: LayerDef = { key: m.key, name: m.name, label: m.label };
  if (m.expandable !== undefined) def.expandable = m.expandable;
  if (m.gated !== undefined) def.gated = m.gated;
  return def;
}

/** Japan research / unreleased pilot layers exist in local DEV only. */
const IS_PRODUCTION = import.meta.env?.PROD ?? true;
function localResearchGroup(title: string, keys: ManifestKey[]): SubGroupDef[] {
  return IS_PRODUCTION
    ? []
    : [{ title, layers: keys.map((key) => fromManifest(key)) }];
}

// ── THEMES（新 SSOT）──

/**
 * 世界 rail tab 只放語意明確的全球主題；不再用泛稱「世界 World」包住事件與環境。
 * 桌機主 Layers panel 用 WORLD_TAB_THEME_TITLES 把這些主題濾掉，世界 tab 依大分類排序顯示。
 */
export const GLOBAL_SITUATION_THEME_TITLE = "全球情勢 Global Situation";
export const GLOBAL_ENVIRONMENT_THEME_TITLE = "全球環境 Global Environment";
export const COMMUNICATIONS_THEME_TITLE = "全球通訊 Global Communications";
/** 台灣「通訊」主題（Ookla 台灣細格）。title 只需在國家內唯一；台灣沿用 `中文 English` 格式。 */
export const TAIWAN_TELECOM_THEME_TITLE = "通訊 Telecom";
/** 法國「通訊」主題（ANFR）。照日本主題做法用中文短名。 */
export const FRANCE_TELECOM_THEME_TITLE = "通訊";

/** 主題屬於哪個國家主體（或世界、模擬）。見 `THEME_SCOPE`。 */
export type ThemeScope = LayerCountry;

/**
 * 國家主體 → 主題 title 登記（議題 1「國家主體化」，2026-10-28；2026-10-29 改成以國家分組）。
 * 每個主題都要登記，且與 `ThemeDef.country` 一致（layerConsistency 測試擋漏）。
 * 用主題而非 layer key 前綴判斷，因為日本主題有大量 `jma*` 等非 `jp` 前綴的圖層。
 * 主題身分是 (country, title)：title 只需在同一國家內唯一，不同國家可同名。
 * 陣列順序有意義：同一 scope 內的先後＝世界、日本、法國面板在同一大分類內的順序（`scopeThemes`）。
 * 新增國家：`CountryCode` 加碼後這裡、`THEME_NAMES`、`THEME_MACRO_GROUPS` 都會因缺鍵報 tsc 錯。
 */
export const THEME_SCOPE: Readonly<Record<ThemeScope, readonly string[]>> = {
  TW: [
    // 台灣：一般主題
    "底圖 Base Map",
    "交通 Move",
    "原民與農村 Indigenous & Rural",
    "人口社經 People",
    "都市分析 Urban Analysis",
    "房地產 Real Estate",
    "工商登記 Business Registry",
    "基礎建設 Infrastructure",
    "教育 Education",
    "社福長照 Welfare",
    "運動休閒 Sports & Leisure",
    "文化 Culture",
    "宗教 Religion",
    "殯葬 Funeral",
    "觀光 Tourism",
    "醫療 Medical",
    "消防 Fire & Rescue",
    "災害 Hazard",
    "民防避難 Civil Defense",
    "執法治安 Law & Order",
    "能源 Energy",
    "廢棄物 Waste",
    "環境氣候 Environment",
    "海洋 Marine",
    "水資源 Water",
    "農業 Agriculture",
    "動物福利 Animal Welfare",
    "林業 Forestry",
    "太空 Space",
    "情勢 Situation",
    TAIWAN_TELECOM_THEME_TITLE,
    // 台灣：統計資料主題（統計面在統計入口，其餘設施仍在台灣入口）
    "工作與所得 Work & Income",
    "房地產統計 Real Estate Statistics",
    "交通統計 Transport Statistics",
    "人口統計 Population Statistics",
    "財稅與消費統計 Fiscal & Consumption Statistics",
    "原民與農村統計 Indigenous & Rural Statistics",
    "國有資產統計 State Assets Statistics",
    "住宅存量與使用",
    "統計比較",
    ADDICTION_STATISTICS_THEME_TITLE,
    "疾病與健康統計 Disease & Health Statistics",
    "體育統計 Sports Statistics",
    "文化統計 Culture Statistics",
    "教育與少子化統計",
    "醫療與長照統計",
    "治安統計 Crime Statistics",
    "水資源統計 Water Statistics",
    "廢棄物統計 Waste Statistics",
    "資源回收統計 Recycling Statistics",
    "水質與污水統計 Water Quality & Sewage Statistics",
    "空氣品質統計 Air Quality Statistics",
    "污染與公害統計 Pollution & Nuisance Statistics",
    "環境治理統計 Environmental Enforcement Statistics",
    "能源統計 Energy Statistics",
    "農業統計 Agriculture Statistics",
    "農業統計",
    "畜牧統計",
    "漁業統計",
    "林業統計",
    LANDSLIDE_STATISTICS_THEME_TITLE,
    "災害風險統計 Disaster Risk Statistics",
    "海洋統計 Marine Statistics",
  ],
  JP: [
    // 日本（2026-10-26 改用台灣主題系統：title＝台灣主題中文短名，與台灣主題是不同字串）
    "底圖",
    "交通",
    "人口社經",
    "基礎建設",
    "教育",
    "社福長照",
    "宗教",
    "觀光",
    "醫療",
    "災害",
    "執法治安",
    "環境氣候",
    "海洋",
    "水資源",
    "林業",
  ],
  FR: [
    // 法國（2026-10-28）
    FRANCE_TELECOM_THEME_TITLE,
  ],
  KR: [
    // 南韓（2026-10-31 南韓第 0 波；title 沿用台灣主題中文短名，比照英國、日本）
    "底圖",
  ],
  GB: [
    // 英國（2026-10-29 英國第 0b 波；title 沿用台灣主題中文短名，與日本同名不衝突）
    "底圖",
    // 第 3 波：災害（海岸侵蝕）、水資源（河川、測站、防洪設施）
    "災害",
    "海洋",
    "水資源",
    // 第 4 波：交通（樞紐、站客流、倫敦軌道、單車、攝影機、收費區）
    "交通",
    // 第 5 波：環境氣候（保護區、樹木保護）、林業（林地、森林遊憩、步道、開放進入地）
    "環境氣候",
    "林業",
    // 第 6 波：能源（電廠、電網、再生能源、加油站、離岸油氣田；比照台灣「能源 Energy」）
    "能源",
    // 第 7 波：公共服務（學校、醫療、照護、消防站、法院；比照台灣主題位置）
    "教育",
    "社福長照",
    "醫療",
    "消防",
    "執法治安",
    // 第 8 波：文化（文化設施、藝文場館）、觀光（觀光體驗；比照台灣主題位置）
    "文化",
    "觀光",
    // 第 11 波：廢棄物（回收點、廢棄物許可；比照台灣「廢棄物 Waste」）
    "廢棄物",
    // C028 公有地標售（比照台灣「房地產 Real Estate」）
    "房地產",
    // 第 12 波：工商登記（公司、製造業）、殯葬（火葬場、葬儀社）、農業（養殖、土壤；比照台灣同名主題）
    "工商登記",
    "殯葬",
    "農業",
    // 英國統計（完整目錄；統計分頁另有「人口／社經／住宅」，見 GB_STATISTICS_TAB_THEMES）
    ...GB_STATISTICS_DATA_THEME_TITLES,
  ],
  WORLD: [
    // 世界（只放語意明確的全球主題；面板順序由 `THEME_MACRO_GROUPS` 的大分類決定）
    GLOBAL_SITUATION_THEME_TITLE,
    "全球海事 Global Maritime",
    "全球氣候 Global Climate",
    GLOBAL_ENVIRONMENT_THEME_TITLE,
    COMMUNICATIONS_THEME_TITLE,
  ],
  SIM: [
    // 模擬（站主限定入口）
    "雙北跨河橋梁中斷",
    "臺北 307 走廊公車擁擠",
  ],
};

/** 某 scope 的主題 title（依 `THEME_SCOPE` 登記順序）。`table` 只給測試換 fixture 用。 */
export function themeTitlesForScope(scope: ThemeScope, table: Readonly<Partial<Record<ThemeScope, readonly string[]>>> = THEME_SCOPE): string[] {
  return [...(table[scope] ?? [])];
}

/** 劃入「世界」入口的主題清單（`THEME_SCOPE` 派生；只決定 membership 與同一大分類內的先後）。 */
export const WORLD_TAB_THEME_TITLES: string[] = themeTitlesForScope("WORLD");

/** 劃入「日本」的主題清單（`THEME_SCOPE` 派生；順序依全站大分類排，同類內照登記順序）。 */
export const JAPAN_TAB_THEME_TITLES: string[] = themeTitlesForScope("JP");

/**
 * 「模擬 Simulation」入口的主題清單（`THEME_SCOPE` 派生）。只有站主看得到入口（D-1，layerPanels.ts `visibleLayerPanels`）。
 * 主題 title 是識別字串，顯示名稱查 `THEME_NAMES`。
 */
export const SIMULATION_TAB_THEME_TITLES: string[] = themeTitlesForScope("SIM");

/** 環境統計依 recipe 的中分類／小分組派生；raw 在 ratio 前，toggle 群組只在第一個成員渲染。 */
function environmentLayers(match: (recipe: EnvironmentRecipe) => boolean): LayerDef[] {
  return ENVIRONMENT_ENABLED_STATISTICS_RECIPES.filter(match).map((recipe) => fromManifest(recipe.layer_key as ManifestKey));
}
function environmentSubgroups(group: string): SubGroupDef[] {
  const subgroups = [...new Set(ENVIRONMENT_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.group === group).map((recipe) => recipe.subgroup))];
  return subgroups.map((title) => ({ title, layers: environmentLayers((recipe) => recipe.group === group && recipe.subgroup === title) }));
}
const environmentDataTheme = (group: string): CatalogTheme => ({ title: ENVIRONMENT_STATISTICS_THEME_TITLES[group]!, groups: environmentSubgroups(group) });

/** 人口統計（戶籍人口／年齡結構…）依 recipe subgroup 派生；Layers 階層保留縣市／鄉鎮小分組。 */
function demographicsDataGroups(): SubGroupDef[] {
  const subgroups = [...new Set(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map((recipe) => recipe.subgroup))];
  return subgroups.map((title) => ({ title, layers: DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.subgroup === title).map((recipe) => fromManifest(recipe.layer_key as ManifestKey)) }));
}
/**
 * Statistics 分頁：戶籍人口→年齡結構→人口動態→遷徙→原住民→外來人口；同一資料集的縣市＋鄉鎮成員放同一小群組，
 * toggle 群組只在第一個成員渲染。既有「每月出生數（歷史快照）」併入同名「人口動態」小群組末尾。
 */
function demographicsTabGroups(): SubGroupDef[] {
  const titles = [...new Set(DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map(demographicsTabGroupTitle))];
  const groups: SubGroupDef[] = titles.map((title) => ({ title, layers: DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.filter((recipe) => demographicsTabGroupTitle(recipe) === title).map((recipe) => fromManifest(recipe.layer_key as ManifestKey)) }));
  const births = fromManifest("statsBirthsTownship");
  const dynamics = groups.find((group) => group.title === "人口動態");
  if (dynamics) dynamics.layers.push(births);
  else groups.push({ title: "人口動態", layers: [births] });
  return groups;
}

/**
 * 成癮與減害：疾病（HIV）→執法（毒品、酒駕、地檢署）→行為調查（吸菸、檳榔）→服務據點；
 * 同一群組的成員相鄰、原始數與縣市在前（群組列只在第一個成員渲染）。兩套目錄共用同一組小群組。
 */
function addictionGroups(): SubGroupDef[] {
  return ADDICTION_STATISTICS_SUBGROUPS.map((title) => ({ title, layers: ADDICTION_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.subgroup === title).map((recipe) => fromManifest(recipe.layer_key as ManifestKey)) }));
}

/** 崩塌與水土保持：崩塌 → 治山防災工程 → 水土保持災害；兩套目錄共用同一組小群組。 */
function landslideGroups(): SubGroupDef[] {
  return LANDSLIDE_STATISTICS_SUBGROUPS.map((title) => ({ title, layers: LANDSLIDE_ENABLED_STATISTICS_RECIPES.filter((recipe) => recipe.subgroup === title).map((recipe) => fromManifest(recipe.layer_key as ManifestKey)) }));
}

/** atlas 六家族＋治安＋臺北市局處（局處統計不自成一類，依主題併入各自縣市版所在主題）：群組依家族檔宣告的 key 順序（群組列只在第一個成員渲染，原始數在前）。 */
function atlasGroups(groups: ReadonlyArray<{ title: string; keys: readonly string[] }>): SubGroupDef[] {
  return groups.map(({ title, keys }) => ({ title, layers: keys.map((key) => fromManifest(key as ManifestKey)) }));
}
/** 把 atlas 群組併入既有群組清單：同標題併入該群組末尾（與縣市版同組切換），沒有同標題才新增小群組。 */
function mergeAtlasGroups(base: SubGroupDef[], extra: SubGroupDef[]): SubGroupDef[] {
  const merged = base.map((group) => ({ ...group, layers: [...group.layers] }));
  for (const group of extra) {
    const host = merged.find((candidate) => candidate.title === group.title);
    if (host) host.layers.push(...group.layers);
    else merged.push({ ...group, layers: [...group.layers] });
  }
  return merged;
}
/** Statistics 分頁主題（新主題或併入既有主題的群組）。 */
function atlasTabTheme(title: string): CatalogTheme {
  return { title, defaultCollapsed: true, groups: atlasGroups(atlasTabThemeGroups(title)) };
}

const ATLAS_DATA_THEMES: CatalogTheme[] = ATLAS_DATA_THEME_TITLES.map((title) => ({ title, groups: atlasGroups(atlasDataThemeGroups(title)) }));

/**
 * atlas 的 data_theme 若與既有主題同名（例如臺北市局處統計併入「廢棄物統計」「工作與所得」），
 * 不另開主題：群組併進既有主題末尾，原位置的重複主題移除。
 */
function foldAtlasDataThemes(themes: CatalogTheme[]): CatalogTheme[] {
  const hostOf = (atlasTheme: CatalogTheme) => themes.find((candidate) => candidate !== atlasTheme && !ATLAS_DATA_THEMES.includes(candidate) && candidate.title === atlasTheme.title);
  const folded = themes.map((theme) => ({ theme, host: ATLAS_DATA_THEMES.includes(theme) ? hostOf(theme) : undefined }));
  for (const { theme, host } of folded) if (host) host.groups = mergeAtlasGroups(host.groups, theme.groups);
  return folded.filter(({ host }) => !host).map(({ theme }) => theme);
}

/** Statistics uses the existing Layers hierarchy; reference GIS layers retain their original entries. */
export const STATISTICS_DATA_THEMES: ThemeDef[] = taiwanThemes(foldAtlasDataThemes([
  { title: "工作與所得 Work & Income", groups: [
    { title: "戶籍村里／申報戶", layers: [fromManifest("statsLaborVillageIncomeMedian")] },
    { title: "實際工作所在地", layers: [fromManifest("statsLaborCountyAnnualSalaryMedian")] },
    { title: "居住地人力資源調查", layers: [fromManifest("statsLaborCountyLaborForce"), fromManifest("statsLaborCountyEmployment"), fromManifest("statsLaborCountyUnemployment"), fromManifest("statsLaborCountyNonLaborForce"), fromManifest("statsLaborCountyParticipationRate"), fromManifest("statsLaborCountyUnemploymentRate"), fromManifest("statsLaborCountyEmploymentByIndustry")] },
  ] },
  { title: "房地產統計 Real Estate Statistics", groups: [
    { title: "行政區總市值", layers: [fromManifest("propertyValueAdmin")] },
  ] },
  ...(COMPARISON_UI_RECIPES.length > 0 ? [{ title: '統計比較', groups: [...new Set(COMPARISON_UI_RECIPES.map(r => r.groupLabel))].map(title => ({title, layers: COMPARISON_UI_RECIPES.filter(r => r.groupLabel === title).map(r => fromManifest(r.layer_key))})) }] : []),
  { title: "交通統計 Transport Statistics", groups: [
    { title: "航港獎補助", layers: [fromManifest("statsMaritimeSubsidyCounty")] },
    { title: "民航獎補助", layers: [fromManifest("statsCivilAeronauticsSubsidyCounty")] },
    { title: "臺北市違規舉發", layers: [fromManifest("statsTaipeiTrafficViolationCitations")] },
    { title: "臺中道路噪音監測", layers: [fromManifest("statsTaichungRoadNoiseMonitoringStations")] },
    { title: "市區客運營運概況", layers: [fromManifest("statsBusOperatingRouteLengthKm"), fromManifest("statsBusApprovedRouteCount"), fromManifest("statsUrbanBusOperatorCount"), fromManifest("statsBusOperatingVehicleCount"), fromManifest("statsBusAccessibleVehicleCount"), fromManifest("statsBusElectricVehicleCount"), fromManifest("statsBusOperatingTripCount"), fromManifest("statsBusOperatingVehicleKm")] },
    { title: "中捷車站出站人次", layers: [fromManifest("statsTmrtStationOutboundCounty")] },
    { title: "臺北自行車使用（110 年）", layers: [fromManifest("statsTaipeiUrbanRentalStations"), fromManifest("statsTaipeiUrbanRentalTrips"), fromManifest("statsTaipeiRiversideRentalStations"), fromManifest("statsTaipeiRiversideBicycles"), fromManifest("statsTaipeiRiversideRentalTrips")] },
    { title: "A1 交通事故（114 年）", layers: [fromManifest("statsA1AccidentCount"), fromManifest("statsA1DeathCount"), fromManifest("statsA1InjuryCount")] },
    { title: "民航各機場所在地活動（115 年 7 月）", layers: [fromManifest("statsAirportTakeoffsLandings"), fromManifest("statsAirportPassengerMovements"), fromManifest("statsAirportCargoTonnes")] },
    { title: "桃園機場所在地旅客活動（2022 年）", layers: [fromManifest("statsTaoyuanAirportArrivals"), fromManifest("statsTaoyuanAirportDepartures"), fromManifest("statsTaoyuanAirportTransit"), fromManifest("statsTaoyuanAirportPassengerMovements")] },
    { title: "縣市交通供給", layers: [
      fromManifest("statsOffstreetSmallCarParkingSpacesCount"), fromManifest("statsOnstreetSmallCarParkingSpacesCount"),
      fromManifest("statsMotorcycleRegisteredCount"), fromManifest("statsAutomobileRegisteredCount"),
      fromManifest("statsAutomobileLicenseHoldersCount"), fromManifest("statsMotorcycleLicenseHoldersCount"),
    ] },
    { title: "土地使用結構", layers: [fromManifest("statsRoadLandAreaTownship"), fromManifest("statsRailLandAreaTownship"), fromManifest("statsAirportLandAreaTownship"), fromManifest("statsPortLandAreaTownship")] },
  ] },
  { title: "水資源統計 Water Statistics", groups: [{ title: "畜牧用水", layers: [fromManifest("statsPigWaterCounty")] }, { title: "公共給水", layers: [fromManifest("statsWaterSupplyHistorical")] }] },
  { title: "廢棄物統計 Waste Statistics", groups: [{ title: "清運量能", layers: [fromManifest("statsWasteCounty")] }, { title: "回收成果", layers: [fromManifest("statsWasteRecyclingRate")] }, ...environmentSubgroups("廢棄物統計")] },
  { title: "資源回收統計 Recycling Statistics", groups: [{ title: "資源回收量能", layers: [fromManifest("statsRecyclingCounty")] }, ...environmentSubgroups("資源回收統計")] },
  environmentDataTheme("水質與污水統計"),
  environmentDataTheme("空氣品質統計"),
  environmentDataTheme("污染與公害統計"),
  environmentDataTheme("環境治理統計"),
  { title: "能源統計 Energy Statistics", groups: [{ title: "住宅用電", layers: [fromManifest("statsResidentialElectricity")] }] },
  // 舊稻作 saved-state/語意入口維持原 section；cross-topic index 另由 recipe metadata 提供。
  { title: "農業統計 Agriculture Statistics", groups: [{ title: "稻作生產", layers: [fromManifest("statsRiceHarvest")] }] },
  { title: "農業統計", groups: [
    { title: "土地使用結構", layers: [fromManifest("statsPaddyLandAreaTownship"), fromManifest("statsDryFieldAreaTownship"), fromManifest("statsOrchardAreaTownship"), fromManifest("statsAgriculturalFacilityAreaTownship")] },
    { title: "作物生產", layers: [fromManifest("statsCropPlantedAreaTownship"), fromManifest("statsCropHarvestedAreaTownship"), fromManifest("statsCropProductionTownship"), fromManifest("statsCropYieldTownship")] },
  ] },
  { title: "畜牧統計", groups: [
    { title: "土地使用結構", layers: [fromManifest("statsLivestockBuildingAreaTownship"), fromManifest("statsPastureAreaTownship")] },
    { title: "在養與場數", layers: [fromManifest("statsLivestockFarmCountTownship"), fromManifest("statsLivestockHeadCountTownship")] },
  ] },
  { title: "漁業統計", groups: [
    { title: "土地使用結構", layers: [fromManifest("statsAquacultureLandAreaTownship")] },
    { title: "產量與產值", layers: [fromManifest("statsFisheryProductionCounty"), fromManifest("statsFisheryProductionValueCounty")] },
    { title: "養殖結構", layers: [fromManifest("statsAquacultureAreaCounty")] },
  ] },
  { title: "林業統計", groups: [{ title: "土地使用結構", layers: [fromManifest("statsConiferForestAreaTownship"), fromManifest("statsBroadleafForestAreaTownship"), fromManifest("statsBambooForestAreaTownship"), fromManifest("statsMixedForestAreaTownship")] }] },
  { title: "人口統計 Population Statistics", groups: [...demographicsDataGroups(), { title: "出生登記", layers: [fromManifest("statsBirthsTownship")] }] },
  { title: ADDICTION_STATISTICS_THEME_TITLE, groups: addictionGroups() },
  { title: LANDSLIDE_STATISTICS_THEME_TITLE, groups: landslideGroups() },
  ...ATLAS_DATA_THEMES,
  { title: "教育與少子化統計", groups: [{ title: "學校所在地縣市別", layers: [
    fromManifest("statsEducationCountyInstitutionCount"), fromManifest("statsEducationCountyTeacherCount"), fromManifest("statsEducationCountyStaffCount"), fromManifest("statsEducationCountyStudentCount"), fromManifest("statsEducationCountyClassCount"), fromManifest("statsEducationCountySmallSchoolCount"), fromManifest("statsEducationCountySmallSchoolSharePct"), fromManifest("statsEducationCountyStudentTeacherRatio"), fromManifest("statsEducationCountyStudentsPerClass"), fromManifest("statsEducationCountyStudentYearChange"), fromManifest("statsEducationCountyStudentYearChangePct"),
    ...EDUCATION_PRESENTATION_VIEW_KEYS.map(fromManifest),
  ] }] },
  { title: "醫療與長照統計", groups: [
    { title: "醫院病床與人力", layers: [fromManifest("statsHealthHospitalCount"), fromManifest("statsHealthHospitalBedTotal"), fromManifest("statsHealthAcuteBedTotal"), fromManifest("statsHealthIcuBedTotal"), fromManifest("statsHealthHospiceBedTotal"), fromManifest("statsHealthHealthProfessionalTotal"), fromManifest("statsHealthWesternPhysicianCount"), fromManifest("statsHealthRegisteredNurseCount")] },
    { title: "一般護理之家人力", layers: [fromManifest("statsHealthNursingStaffListedAgeSexSum"), fromManifest("statsHealthCareWorkerListedSexSum")] },
    { title: "一般護理之家床位", layers: [fromManifest("statsHealthGeneralNursingHomeOpenBeds")] },
    { title: "母嬰照護床位", layers: [fromManifest("statsHealthPostpartumNursingHomeOpenBeds"), fromManifest("statsHealthPostpartumNursingHomeOpenInfantBeds")] },
    { title: "長照人員登錄", layers: [fromManifest("statsHealthCareWorkerRegistration")] },
    { title: "每萬人口醫療資源", layers: [fromManifest("statsHealthMedicalInstitutionBedsPer10000Population"), fromManifest("statsHealthPracticingMedicalPersonnelPer10000Population")] },
  ] },
  { title: "住宅存量與使用", groups: [
    { title: "住宅使用類別", layers: [fromManifest("statsHousingTotalCounty"), fromManifest("statsHousingOccupiedCounty"), fromManifest("statsHousingUnoccupiedCounty"), fromManifest("statsHousingOccasionalCounty"), fromManifest("statsHousingOtherUseCounty"), fromManifest("statsHousingUnusedCounty"), fromManifest("statsHousingResidenceOnlyCounty"), fromManifest("statsHousingMixedUseCounty"), fromManifest("statsHousingTotalTownship"), fromManifest("statsHousingOccupiedTownship"), fromManifest("statsHousingUnoccupiedTownship"), fromManifest("statsHousingOccasionalTownship"), fromManifest("statsHousingOtherUseTownship"), fromManifest("statsHousingUnusedTownship")] },
    { title: "住宅使用比例", layers: [fromManifest("statsHousingOccupiedPctCounty"), fromManifest("statsHousingUnusedPctCounty"), fromManifest("statsHousingOccupiedPctTownship"), fromManifest("statsHousingUnusedPctTownship")] },
  ] },
]));

/**
 * 統計專屬入口以「使用者想找的主題」重新索引既有 layers。
 *
 * 這裡刻意不沿用 manifest.section：manifest 的 section 是完整 Layers 目錄位置，
 * 統計入口則是跨主題索引。Layer key、label、來源、release 與 geometry 契約仍由
 * manifest / statistics recipes 管理，這裡只決定統計入口的閱讀順序。
 * 2026-10-03 依統計面板大分類（layerPanels.ts `STATISTICS_MACRO_GROUPS`）拆主題並重排：同一大分類的主題相鄰；
 * 從原「人口與社會」拆出的主題維持展開、從原「交通與運輸」拆出的維持收合。
 */
export const STATISTICS_TAB_THEMES: ThemeDef[] = taiwanThemes([
  {
    title: "人口與教育 Population & Education",
    defaultCollapsed: true,
    groups: [
      ...demographicsTabGroups(),
      { title: "教育與少子化", layers: [
        ...EDUCATION_PRESENTATION_VIEW_KEYS.map(fromManifest),
      ] },
      ...atlasGroups(atlasTabThemeGroups("人口與教育 Population & Education")),
    ],
  },
  {
    title: "醫療與長照 Health & Care",
    defaultCollapsed: true,
    groups: [
      { title: "醫療與長照", layers: [
        fromManifest("statsHealthHospitalCount"), fromManifest("statsHealthHospitalBedTotal"), fromManifest("statsHealthAcuteBedTotal"), fromManifest("statsHealthIcuBedTotal"), fromManifest("statsHealthHospiceBedTotal"), fromManifest("statsHealthHealthProfessionalTotal"), fromManifest("statsHealthWesternPhysicianCount"), fromManifest("statsHealthRegisteredNurseCount"), fromManifest("statsHealthNursingStaffListedAgeSexSum"), fromManifest("statsHealthCareWorkerListedSexSum"), fromManifest("statsHealthGeneralNursingHomeOpenBeds"), fromManifest("statsHealthPostpartumNursingHomeOpenBeds"), fromManifest("statsHealthPostpartumNursingHomeOpenInfantBeds"), fromManifest("statsHealthCareWorkerRegistration"), fromManifest("statsHealthMedicalInstitutionBedsPer10000Population"), fromManifest("statsHealthPracticingMedicalPersonnelPer10000Population"),
      ] },
      ...atlasGroups(atlasTabThemeGroups("醫療與長照 Health & Care")),
    ],
  },
  {
    title: ADDICTION_STATISTICS_TAB_THEME_TITLE,
    defaultCollapsed: true,
    groups: addictionGroups(),
  },
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.crime),
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.sports),
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.culture),
  {
    title: "工作與所得 Work & Income",
    defaultCollapsed: true,
    groups: [
      { title: "戶籍村里／申報戶", layers: [fromManifest("statsLaborVillageIncomeMedian")] },
      { title: "實際工作所在地", layers: [fromManifest("statsLaborCountyAnnualSalaryMedian")] },
      { title: "居住地人力資源調查", layers: [
        fromManifest("statsLaborCountyLaborForce"), fromManifest("statsLaborCountyEmployment"),
        fromManifest("statsLaborCountyUnemployment"), fromManifest("statsLaborCountyNonLaborForce"),
        fromManifest("statsLaborCountyParticipationRate"), fromManifest("statsLaborCountyUnemploymentRate"),
        fromManifest("statsLaborCountyEmploymentByIndustry"),
      ] },
      ...atlasGroups(atlasTabThemeGroups("工作與所得 Work & Income")),
    ],
  },
  {
    title: "住宅與不動產 Housing & Property",
    defaultCollapsed: true,
    groups: [
      { title: "住宅存量與使用", layers: [
        fromManifest("statsHousingTotalCounty"), fromManifest("statsHousingOccupiedCounty"), fromManifest("statsHousingUnoccupiedCounty"), fromManifest("statsHousingOccasionalCounty"), fromManifest("statsHousingOtherUseCounty"), fromManifest("statsHousingUnusedCounty"), fromManifest("statsHousingResidenceOnlyCounty"), fromManifest("statsHousingMixedUseCounty"), fromManifest("statsHousingOccupiedPctCounty"), fromManifest("statsHousingUnusedPctCounty"), fromManifest("statsHousingTotalTownship"), fromManifest("statsHousingOccupiedTownship"), fromManifest("statsHousingUnoccupiedTownship"), fromManifest("statsHousingOccasionalTownship"), fromManifest("statsHousingOtherUseTownship"), fromManifest("statsHousingUnusedTownship"), fromManifest("statsHousingOccupiedPctTownship"), fromManifest("statsHousingUnusedPctTownship"),
      ] },
      { title: "不動產總市值", layers: [fromManifest("propertyValueAdmin")] },
      ...atlasGroups(atlasTabThemeGroups("住宅與不動產 Housing & Property")),
    ],
  },
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.fiscal),
  {
    title: "公共運輸 Public Transport",
    defaultCollapsed: true,
    groups: [
      { title: "建置量", layers: [fromManifest("statsBusOperatingRouteLengthKm"), fromManifest("statsBusApprovedRouteCount")] },
      { title: "使用與營運", layers: [fromManifest("statsUrbanBusOperatorCount"), fromManifest("statsBusOperatingTripCount"), fromManifest("statsBusOperatingVehicleKm"), fromManifest("statsTmrtStationOutboundCounty")] },
      { title: "自行車（臺北市，民國 110 年）", layers: [
        fromManifest("statsTaipeiUrbanRentalStations"), fromManifest("statsTaipeiUrbanRentalTrips"),
        fromManifest("statsTaipeiRiversideRentalStations"), fromManifest("statsTaipeiRiversideBicycles"),
        fromManifest("statsTaipeiRiversideRentalTrips"),
      ] },
      { title: "航空運輸", layers: [
        fromManifest("statsAirportTakeoffsLandings"), fromManifest("statsAirportPassengerMovements"),
        fromManifest("statsAirportCargoTonnes"), fromManifest("statsTaoyuanAirportArrivals"),
        fromManifest("statsTaoyuanAirportDepartures"), fromManifest("statsTaoyuanAirportTransit"),
        fromManifest("statsTaoyuanAirportPassengerMovements"),
      ] },
      { title: "運輸補助", layers: [
        fromManifest("statsMaritimeSubsidyCounty"), fromManifest("statsCivilAeronauticsSubsidyCounty"),
      ] },
    ],
  },
  {
    title: "道路與車輛 Roads & Vehicles",
    defaultCollapsed: true,
    groups: [
      { title: "車輛登記存量", layers: [fromManifest("statsBusOperatingVehicleCount"), fromManifest("statsBusAccessibleVehicleCount"), fromManifest("statsBusElectricVehicleCount"), fromManifest("statsMotorcycleRegisteredCount"), fromManifest("statsAutomobileRegisteredCount")] },
      { title: "道路安全與監測", layers: [
        fromManifest("statsA1AccidentCount"), fromManifest("statsA1DeathCount"), fromManifest("statsA1InjuryCount"),
        fromManifest("statsTaipeiTrafficViolationCitations"), fromManifest("statsTaichungRoadNoiseMonitoringStations"),
      ] },
      { title: "駕照與停車", layers: [
        fromManifest("statsOffstreetSmallCarParkingSpacesCount"), fromManifest("statsOnstreetSmallCarParkingSpacesCount"),
        fromManifest("statsAutomobileLicenseHoldersCount"), fromManifest("statsMotorcycleLicenseHoldersCount"),
      ] },
    ],
  },
  {
    title: "交通用地 Transport Land",
    defaultCollapsed: true,
    groups: [
      { title: "交通用地", layers: [
        fromManifest("statsRoadLandAreaTownship"), fromManifest("statsRailLandAreaTownship"),
        fromManifest("statsAirportLandAreaTownship"), fromManifest("statsPortLandAreaTownship"),
      ] },
    ],
  },
  {
    title: "農林漁牧 Agriculture, Forestry & Fisheries",
    defaultCollapsed: true,
    groups: [
      { title: "農地與設施", layers: [
        fromManifest("statsPaddyLandAreaTownship"), fromManifest("statsDryFieldAreaTownship"),
        fromManifest("statsOrchardAreaTownship"), fromManifest("statsAgriculturalFacilityAreaTownship"),
      ] },
      { title: "作物生產", layers: [
        fromManifest("statsRiceHarvest"), fromManifest("statsCropPlantedAreaTownship"),
        fromManifest("statsCropHarvestedAreaTownship"), fromManifest("statsCropProductionTownship"),
        fromManifest("statsCropYieldTownship"),
      ] },
      { title: "畜牧用地", layers: [
        fromManifest("statsLivestockBuildingAreaTownship"), fromManifest("statsPastureAreaTownship"),
      ] },
      { title: "畜牧飼養", layers: [
        fromManifest("statsLivestockFarmCountTownship"), fromManifest("statsLivestockHeadCountTownship"),
      ] },
      { title: "漁業生產", layers: [
        fromManifest("statsFisheryProductionCounty"), fromManifest("statsFisheryProductionValueCounty"),
      ] },
      { title: "水產養殖", layers: [
        fromManifest("statsAquacultureLandAreaTownship"), fromManifest("statsAquacultureAreaCounty"),
      ] },
      { title: "森林用地", layers: [
        fromManifest("statsConiferForestAreaTownship"), fromManifest("statsBroadleafForestAreaTownship"),
        fromManifest("statsBambooForestAreaTownship"), fromManifest("statsMixedForestAreaTownship"),
      ] },
      ...atlasGroups(atlasTabThemeGroups("農林漁牧 Agriculture, Forestry & Fisheries")),
    ],
  },
  {
    title: "環境與資源 Environment & Resources",
    defaultCollapsed: true,
    groups: mergeAtlasGroups([
      { title: "用水與供水", layers: [fromManifest("statsPigWaterCounty"), fromManifest("statsWaterSupplyHistorical")] },
      { title: "住宅用電", layers: [fromManifest("statsResidentialElectricity")] },
      { title: "廢棄物與回收", layers: [
        fromManifest("statsWasteCounty"), fromManifest("statsRecyclingCounty"), fromManifest("statsWasteRecyclingRate"),
        ...environmentLayers((recipe) => recipe.tab_group === "廢棄物與回收"),
      ] },
      ...["水質與污水", "空氣品質", "污染與公害", "環境治理"].map((title) => ({ title, layers: environmentLayers((recipe) => recipe.tab_group === title) })),
    ], atlasGroups(atlasTabThemeGroups("環境與資源 Environment & Resources"))),
  },
  {
    title: LANDSLIDE_STATISTICS_TAB_THEME_TITLE,
    defaultCollapsed: true,
    groups: landslideGroups(),
  },
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.hazard),
  atlasTabTheme(ATLAS_TAB_THEME_TITLES.marine),
  {
    title: "地圖參考 Map Reference",
    defaultCollapsed: true,
    groups: [
      { title: "行政邊界", layers: [fromManifest("countyBoundary"), fromManifest("townshipBoundary")] },
    ],
  },
]);

/** Statistics tab 的行政邊界僅供 choropleth 對照，仍屬一般 Layers 的地圖參考資料。 */
const STATISTICS_TAB_REFERENCE_LAYER_KEYS = new Set<keyof LayerVisibility>([
  "countyBoundary",
  "townshipBoundary",
]);

/**
 * 英國統計分頁（2026-10-29 統計面板多國化）：人口／社經／住宅，主題與群組由 gb 家族 recipe 派生
 * （社經下四地剝奪指數各一個小群組，各自圖例、不可跨國比較）。
 */
export const GB_STATISTICS_TAB_THEMES: ThemeDef[] = GB_STATISTICS_TAB_THEME_TITLES.map((title) => ({
  title, country: "GB", groups: atlasGroups(atlasTabThemeGroups(title, "GB")),
}));

/** 英國完整目錄（THEMES，country GB）的統計主題；圖層頁不顯示（統計面在統計入口）。 */
const GB_STATISTICS_DATA_THEMES: ThemeDef[] = GB_STATISTICS_DATA_THEME_TITLES.map((title) => ({
  title, country: "GB", groups: atlasGroups(atlasDataThemeGroups(title, "GB")),
}));

/**
 * 實際統計面在 Statistics tab 與一般 Layers 的共同 membership。
 * 設施、等時圈和行政邊界不在此集合，避免它們因為同畫面出現而被誤分類為統計。
 */
export const STATISTICS_TAB_CHOROPLETH_LAYER_KEYS = new Set<string>(
  [...STATISTICS_TAB_THEMES, ...GB_STATISTICS_TAB_THEMES]
    .flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key)))
    .filter((key) => !STATISTICS_TAB_REFERENCE_LAYER_KEYS.has(key)),
);

/** 從一般 Layers 移除統計面，同時保留同主題下的設施與其他非統計圖層。 */
export function withoutStatisticsLayers(themes: readonly ThemeDef[]): ThemeDef[] {
  return themes.flatMap((theme) => {
    const groups = theme.groups
      .map((group) => ({ ...group, layers: group.layers.filter((layer) => !STATISTICS_TAB_CHOROPLETH_LAYER_KEYS.has(layer.key)) }))
      .filter((group) => group.layers.length > 0);
    return groups.length > 0 ? [{ ...theme, groups }] : [];
  });
}

// Derived metrics keep the source topic; education metrics are represented by the twelve presentation views.
for (const recipe of COMPARISON_UI_RECIPES) {
  const id = recipe.indicator_id;
  if (id.startsWith('education_')) continue;
  const title = recipe.groupLabel === '醫療與長照' ? '醫療與長照'
    : id.startsWith('housing_') ? '住宅存量與使用'
    : /^(bus_operating_route_length|bus_approved_route)_/.test(id) ? '建置量'
    : /^(bus_operating_vehicle|bus_accessible_vehicle|bus_electric_vehicle)_/.test(id) ? '車輛登記存量'
    : /^(bus_|urban_bus_)/.test(id) ? '使用與營運'
    : /^(a1_|a2_|a1_a2_)/.test(id) ? '道路安全與監測'
    : /^(motorcycle_registered_count|automobile_registered_count)_/.test(id) ? '車輛登記存量'
    : /^(offstreet_small_car_parking_spaces_count|onstreet_small_car_parking_spaces_count|automobile_license_holders_count|motorcycle_license_holders_count)_/.test(id) ? '駕照與停車'
    : /^(waste_|recycling_)/.test(id) ? '廢棄物與回收'
    : /^(road_land|rail_land|airport_land|port_land)_/.test(id) ? '交通用地'
    : /^(conifer_forest|broadleaf_forest|bamboo_forest|mixed_forest)_/.test(id) ? '森林用地'
    : /^(livestock_building|pasture)_/.test(id) ? '畜牧用地'
    : id.startsWith('livestock_heads_') ? '畜牧飼養'
    : id.startsWith('fishery_') ? '漁業生產'
    : id.startsWith('aquaculture_') ? '水產養殖' : '農地與設施';
  const group = STATISTICS_TAB_THEMES.flatMap(theme => theme.groups).find(group => group.title === title);
  group?.layers.push(fromManifest(recipe.layer_key));
}

// 群組變體：統計入口裡屬於同一群組的成員標上 group／lead（LayersPanel 依此畫群組列）。
for (const layer of [...STATISTICS_TAB_THEMES, ...GB_STATISTICS_TAB_THEMES].flatMap(theme => theme.groups.flatMap(group => group.layers))) {
  const group = getMedicalStatisticsGroup(layer.key);
  if (group) layer.variant = { group: group.key, lead: group.options[0]?.key === layer.key };
}

/**
 * 完整目錄保留在此，避免為了 UI 敘事分段而搬動大量 layer 定義。
 * `THEMES` 依大分類排序後才是 sidebar 的顯示順序。
 */
const THEME_CATALOG: ThemeDef[] = [
  ...STATISTICS_DATA_THEMES,
  ...GB_STATISTICS_DATA_THEMES,
  // ───────────────────────────────────────────────────────────────
  // 📍 BASE 底圖（頂置・預設摺疊）
  // ───────────────────────────────────────────────────────────────
  {
    title: "底圖 Base Map",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "行政邊界",
        layers: [
          fromManifest("countyBoundary"),
          fromManifest("townshipBoundary"),
          fromManifest("villageBoundary"),
        ],
      },
      {
        // 陸域行政界之外的**海域法定界線**（內政部 98 年公告），故不併進「行政邊界」
        title: "海域界線",
        layers: [
          fromManifest("maritimeBoundary"),
        ],
      },
      {
        title: "地形",
        layers: [
          fromManifest("contour25k"),
          fromManifest("contourDtm20"),
          fromManifest("hillshade"),
          fromManifest("slopeVector"),
          fromManifest("aspectVector"),
          // 海底等深線：陸域等高線／坡度／坡向的海域對照物，同屬「地形」子群
          fromManifest("isobath"),
        ],
      },
      {
        title: "建成環境",
        layers: [
          fromManifest("buildingsGba"),
        ],
      },
      {
        // 官方參考底圖（非分析產物）——上游 topic-research 原始目標即「pulse 底圖層」
        title: "土地使用分區 Zoning",
        layers: [
          fromManifest("urbanZoningTaipei"),
          fromManifest("urbanZoningNewTaipei"),
          // 與上面兩層互補：那兩層是「都市計畫區內」，本層是「非都市土地」，合起來是全國拼圖
          fromManifest("nonUrbanZoning"),
        ],
      },
      {
        title: "道路底圖",
        layers: [
          fromManifest("osmRoadDrive"),
        ],
      },
      {
        // 內政部地名（PMTiles，不畫文字標籤）＋三角點
        title: "地名 Gazetteer",
        layers: [
          fromManifest("placeNames"),
          fromManifest("triangulationPoints"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚦 MOVE 交通
  // ───────────────────────────────────────────────────────────────
  {
    title: "交通 Move",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時運具",
        layers: [
          fromManifest("flights"),
          fromManifest("ships"),
          fromManifest("rail"),
          fromManifest("busLive"),
          fromManifest("busIntercityLive"),
          fromManifest("touristShuttleLive"),
        ],
      },
      {
        title: "場站",
        layers: [
          fromManifest("stationsTHSR"),
          fromManifest("stationsTRA"),
          fromManifest("stationsMetro"),
          fromManifest("busStationsCity"),
          fromManifest("busStationsIntercity"),
          fromManifest("bikeStations"),
        ],
      },
      {
        title: "歷史軌跡",
        layers: [fromManifest("historicalFlightTrails")],
      },
      {
        title: "共享運具",
        layers: [
          fromManifest("youbikeFullness"),
          fromManifest("bicycleSupport"),
        ],
      },
      {
        title: "路網",
        layers: [
          fromManifest("railRoutes"),
          fromManifest("highways"),
          fromManifest("osmExpressway"),
          fromManifest("provincialRoads"),
          fromManifest("cyclingRoutes"),
          fromManifest("cctv"),
          fromManifest("etcGantry"),
          fromManifest("serviceArea"),
          fromManifest("serviceAreaPolygon"),
          fromManifest("taxiStand"),
        ],
      },
      {
        title: "樞紐節點",
        layers: [
          fromManifest("ports"),
          fromManifest("airports"),
          fromManifest("lighthouses"),
          fromManifest("aviationControl"),
          fromManifest("aviationRestricted"),
          fromManifest("droneNoFlyZone"),
          fromManifest("droneRestrictedZone"),
        ],
      },
      {
        title: "路網結構 Network Structures",
        layers: [
          fromManifest("osmBridgeCarriers"),
          fromManifest("osmBridgeFootprints"),
          fromManifest("officialBridgesNewTaipei"),
          fromManifest("bridgeComparisonNewTaipei"),
          fromManifest("tainanBridgeInspections"),
          fromManifest("officialBridgesHsinchu"),
          fromManifest("taipeiRoadTunnels"),
          fromManifest("tainanRoadTunnels"),
          fromManifest("changhuaTrafficSignals"),
          fromManifest("bridgeRainThresholds"),
        ],
      },
      {
        title: "橋梁研究（進行中）",
        layers: [
          fromManifest("bssNationalBridgePreview"),
          fromManifest("bssNationalBridgePointsPreview"),
        ],
      },
      {
        title: "即時監控",
        layers: [
          fromManifest("freewayCongestion"),
          fromManifest("roadCongestion"),
          fromManifest("roadEvents"),
        ],
      },
      {
        title: "停車 Parking",
        layers: [
          fromManifest("parkingOnstreet"),
          fromManifest("parkingOffstreet"),
        ],
      },
      {
        // atlas 批次 2026-10：省道／國道標誌、里程牌、交流道、生態敏感路段、防救災監控路段、避車彎
        title: "道路設施 Road Facilities",
        layers: [
          fromManifest("provincialRoadSigns"),
          fromManifest("provincialRoadMileposts"),
          fromManifest("freewayTrafficSigns"),
          fromManifest("freewayInterchanges"),
          fromManifest("freewayEcoSensitive"),
          fromManifest("provincialRoadMonitored"),
          fromManifest("provincialRoadEmergencyBays"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏔️ 原民與農村（atlas 批次 2026-10）
  // ───────────────────────────────────────────────────────────────
  {
    title: "原民與農村 Indigenous & Rural",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "原住民族 Indigenous Peoples",
        layers: [
          fromManifest("indigenousTribes"),
          fromManifest("indigenousIsolationRisk"),
          fromManifest("indigenousRegions"),
          fromManifest("indigenousLanguageDialects"),
        ],
      },
      {
        title: "客家 Hakka",
        layers: [
          fromManifest("hakkaCulturalZones"),
        ],
      },
      {
        title: "農村 Rural",
        layers: [
          fromManifest("agriRuralCommunityVillages"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 👥 PEOPLE 人口社經
  // ───────────────────────────────────────────────────────────────
  {
    title: "人口社經 People",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "人口分布",
        layers: [
          fromManifest("popCount"),
          fromManifest("h3Population"),
          fromManifest("indicators"),
        ],
      },
      {
        title: "社經",
        layers: [
          fromManifest("socioeconomic"),
          fromManifest("spatialEconomy"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏙️ URBAN ANALYSIS 都市分析（都市 × 環境交叉分析；未來熱島效應、風廊等進此區）
  // ───────────────────────────────────────────────────────────────
  {
    title: "都市分析 Urban Analysis",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "都市紋理",
        layers: [
          fromManifest("urbanFormGrid"),
        ],
      },
      {
        title: "都市熱島 Urban Heat",
        layers: [
          fromManifest("urbanHeat"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏠 ESTATE 房地產
  // ───────────────────────────────────────────────────────────────
  {
    title: "房地產 Real Estate",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "租賃",
        layers: [
          fromManifest("realEstateRentalGrid"),
          fromManifest("realEstateRentalPoint"),
        ],
      },
      {
        title: "買賣",
        layers: [
          fromManifest("realEstateSaleGrid"),
          fromManifest("realEstateSalePoint"),
        ],
      },
      {
        title: "預售",
        layers: [
          fromManifest("realEstatePresaleGrid"),
          fromManifest("realEstatePresalePoint"),
        ],
      },
      {
        // 上三組是「單價」（每 m² 多貴），本組是「總量」（這格壓了多少錢）——語意不同，見圖例
        title: "總市值",
        layers: [
          fromManifest("propertyValueGrid"),
        ],
      },
      {
        // G16（2026-10-24）：國有財產署待標售快照；國有地存量統計在「統計」分頁「住宅與不動產」
        title: "國有財產標售",
        layers: [
          fromManifest("statePropertyTenderListings"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏢 BUSINESS REGISTRY 工商登記
  // ───────────────────────────────────────────────────────────────
  {
    title: "工商登記 Business Registry",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "整體公司",
        layers: [
          fromManifest("companyPoints"),
          fromManifest("companyCapitalGrid"),
          fromManifest("companyIndustryDistribution"),
          fromManifest("companyAgeStructure"),
          fromManifest("commonRegistrationAddresses"),
        ],
      },
      {
        title: "製造業",
        layers: [
          fromManifest("factoryLocations"),
          fromManifest("factoryDensityGrid"),
          fromManifest("manufacturingCompanyPoints"),
          fromManifest("manufacturingCompanyDensityGrid"),
          fromManifest("regulatedFacilities"),
          fromManifest("regulatedFacilityDensityGrid"),
        ],
      },
      {
        title: "園區",
        layers: [
          fromManifest("industrialParkBoundaries"),
          fromManifest("industrialParkComparison"),
        ],
      },
      {
        title: "國營事業",
        layers: [
          fromManifest("taisugarSugarMills"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏗️ INFRA 基礎建設
  // ───────────────────────────────────────────────────────────────
  {
    title: "基礎建設 Infrastructure",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "公共設施",
        layers: [
          // 2026-08-08：schools 搬到「教育 Education」主題（第 38 主題），此處不再列出
          fromManifest("convenienceStores"),
          fromManifest("postOffices"),
          fromManifest("iPostBoxes"),
          fromManifest("communityCenters"),
          fromManifest("govServiceOffices"),
          fromManifest("publicLibraries"),
          fromManifest("welfareCenters"),
          fromManifest("retailMarkets"),
          fromManifest("publicToilets"),
          fromManifest("drinkingWaterPoints"),
          fromManifest("publicWasteBaskets"),
          fromManifest("materialRecyclingPoints"),
          fromManifest("disasterShelters"),
          fromManifest("publicLifeOsmCoverage"),
        ],
      },
      {
        // G10（2026-10-24）：財金公司名冊；ATM 台數、金融欠缺鄉鎮等統計在「統計」分頁「財稅與消費」
        title: "金融據點",
        layers: [
          fromManifest("atmSitesFisc"),
          fromManifest("financialBranchesFisc"),
          fromManifest("securitiesFuturesInstitutions"),
          fromManifest("insuranceInstitutions"),
          fromManifest("postOfficeFxCounters"),
        ],
      },
      {
        title: "無障礙 Accessibility",
        layers: [
          fromManifest("accessibleParkFacilities"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚡ ENERGY 能源
  // ───────────────────────────────────────────────────────────────
  {
    title: "能源 Energy",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "電力 · 廠",
        layers: [
          fromManifest("facPrimary"),
          fromManifest("facPlanned"),
          fromManifest("facHistorical"),
          fromManifest("facSecondary"),
          fromManifest("facOsmSupplement"),
          fromManifest("powerGenerationUnit"),
          fromManifest("powerPlantGlow"),
          fromManifest("aviationRestrictedGlow"),
        ],
      },
      {
        title: "電力 · 電網",
        layers: [
          fromManifest("osmSubstationsEhv"),
          fromManifest("substationEhvGlow"),
          fromManifest("osmSubstations"),
          fromManifest("osmPowerLines"),
          fromManifest("powerLinesGlow"),
          fromManifest("osmPowerTowers"),
          fromManifest("powerPoles"),
        ],
      },
      {
        title: "再生能源",
        layers: [
          fromManifest("offshoreWindZones"),
          fromManifest("osmWindTurbines"),
          fromManifest("windPlan"),
          fromManifest("geothermalWells"),
          fromManifest("renewablePermitsTaipei"),
          fromManifest("renewablePermitsNational"),
          fromManifest("evChargingStations"),
          fromManifest("batterySwapStations"),
        ],
      },
      {
        title: "石化 · 加油站",
        layers: [
          fromManifest("gasStationCpc"),
          fromManifest("gasStationFpcc"),
          fromManifest("gasStationTaisugar"),
          fromManifest("gasStationOther"),
          fromManifest("gasStationCanonical"),
        ],
      },
      {
        title: "石化 · 油氣",
        layers: [
          fromManifest("lpgSubpackaging"),
          fromManifest("lpgRetailers"),
          fromManifest("lngTerminal"),
          fromManifest("pipelineGas"),
          fromManifest("pipelineOilGas"),
          fromManifest("industrialRefinery"),
          fromManifest("industrialStorageTank"),
          fromManifest("industrialPowerPlant"),
          fromManifest("coalTerminal"),
          fromManifest("fossilFuelInfra"),
        ],
      },
      {
        title: "覆蓋分析",
        layers: [
          fromManifest("gasCoverageAll"),
          fromManifest("gasCoverageCpc"),
          fromManifest("gasCoverageFpcc"),
          fromManifest("gasCoverageTaisugar"),
          fromManifest("evIsland"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎓 EDUCATION 教育（2026-08-08 第 38 主題；上游 education 批次）
  // 🔴 6 個學校點層共用同一份 schools.geojson（4,315 點）：
  //    schools 為總覽（依學制上色），5 個 eduSchool* 為分級篩選，
  //    eduRemoteSchools 走 region_type 標記（非偏遠是 JSON null，見 educationTypes.ts）。
  //    schools 於本日自「基礎建設 → 公共設施」搬入本主題。
  //    eduUniversityStudents 雖在「學校」群，但讀自己的 university_students.geojson（159 筆，英文欄位）。
  // ───────────────────────────────────────────────────────────────
  {
    title: "教育 Education",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "學校 Schools",
        layers: [
          fromManifest("schools"),
          fromManifest("eduSchoolElementary"),
          fromManifest("eduSchoolJunior"),
          fromManifest("eduSchoolSenior"),
          fromManifest("eduSchoolUniversity"),
          fromManifest("eduSchoolSpecial"),
          fromManifest("eduRemoteSchools"),
          fromManifest("eduUniversityStudents"),
        ],
      },
      {
        title: "校地 Campus",
        layers: [
          fromManifest("eduCampusPolygon"),
          // 與上一層同一份切片、同一個 sourceId（只下載一次），差別只在讀法：
          // 上層按學制分色，本層按 area_ha 分 5 級 —— 兩者可獨立開關也可疊看。
          fromManifest("eduCampusArea"),
        ],
      },
      // 🔴 高中就學區是**縣市級**，與前兩者的里級完全不同粒度 —— 三者各自獨立 toggle，
      //    且標籤直接寫明「（縣市級）」，避免使用者誤以為三層是同一套邊界的三個學制。
      {
        title: "學區 District",
        layers: [
          fromManifest("eduDistrictElementary"),
          fromManifest("eduDistrictJunior"),
          fromManifest("eduDistrictSenior"),
        ],
      },
      // 🔴 補習班是**每日更新**的資料源（此為快照），且點數 17,137 為四層之最 → 切片走 PMTiles，
      //    透明度／大小 slider 與其餘三層分開（見 useLayerParamsRuntime 的 eduCramSchool* param）。
      {
        title: "幼托補習 Childcare & Cram",
        layers: [
          fromManifest("eduKindergarten"),
          fromManifest("eduCramSchool"),
          fromManifest("eduAfterschoolCare"),
          fromManifest("eduMutualCare"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🤝 WELFARE 社福長照（2026-08-13 第 40 主題；上游 welfare 批次 9 檔 10,004 點）
  //
  // 全開 10,004 點會很擠 —— 群內順序刻意把上游建議的三層（都有可做泡泡／分色的
  // 數值欄位）放最前面：護理機構床數、老人機構床數、身障機構使用率。
  // ⚠️ **沒有**把它們加進 layerVisibilityStore 的 DEFAULT_ON —— 本站 2026-08-10
  //    起「預設全關：訪客一進站不打任何 RPC、不載任何圖層」，加了會讓社福變成
  //    全站唯一預設開啟的內容（一進站多載 ~1.9MB）。要改是一行的事，但要 owner 拍板。
  //
  // 🔴 長照有兩套登記體系：本群的 welfareLtcInstitutions 是**立案機構**（3,117），
  //    醫療主題的 medLTC 是長照 2.0 **特約單位**（23,894），名稱交集僅 2,365。
  //    刻意**不放同一群、不合併** —— 兩者量的是不同東西，併起來會重複計算又漏算。
  // 🔴 基礎建設群的 welfareCenters（社福中心 162）不是本群成員；本群 welfareGovOffices
  //    已排除 T0103 正是為了不跟它重複 → 兩層零重疊，可同時開。
  // ───────────────────────────────────────────────────────────────
  {
    title: "社福長照 Welfare",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "住宿照顧",
        layers: [
          fromManifest("welfareNursingHomes"),
          fromManifest("welfareElderlyHomes"),
          fromManifest("welfareDisability"),
        ],
      },
      {
        title: "長照與托育",
        layers: [
          fromManifest("welfareLtcInstitutions"),
          fromManifest("culturalHealthStations"),
          fromManifest("welfareChildcare"),
          fromManifest("welfareChildServices"),
        ],
      },
      {
        title: "公部門與民間",
        layers: [
          fromManifest("welfareGovOffices"),
          fromManifest("welfareMentalHealth"),
          fromManifest("welfareSocialWorkOrgs"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏟️ SPORTS & LEISURE 運動休閒
  // ───────────────────────────────────────────────────────────────
  {
    title: "運動休閒 Sports & Leisure",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "運動場館",
        layers: [
          fromManifest("sportsSchool"),
          fromManifest("sportsPublicOther"),
          fromManifest("sportsPrivate"),
          fromManifest("sportsPark"),
          fromManifest("sportsCenter"),
        ],
      },
      {
        title: "公園 Parks",
        layers: [
          fromManifest("parksTaipei"),
          fromManifest("playgrounds"),
        ],
      },
      {
        title: "水域遊憩 Water Recreation",
        layers: [
          fromManifest("waterRecreationRestrictedAreas"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎭 CULTURE 文化
  // ───────────────────────────────────────────────────────────────
  {
    title: "文化 Culture",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "設施 Facilities",
        layers: [
          fromManifest("culturalFacilities"),
          fromManifest("culturalMuseums"),
        ],
      },
      {
        title: "藝文活動 Arts & Events",
        layers: [
          fromManifest("artsEvents"),
          fromManifest("performingVenues"),
        ],
      },
      {
        title: "藝文消費 Culture Coin",
        layers: [
          fromManifest("cultureCoinVenues"),
        ],
      },
      {
        title: "即時 Realtime",
        layers: [
          fromManifest("librarySeats"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛕 RELIGION 宗教（2026-08-02 第 36 主題；上游 religion 批次 23,074 點）
  // ───────────────────────────────────────────────────────────────
  {
    title: "宗教 Religion",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("religionTemples"),
          fromManifest("religionChurches"),
          fromManifest("religionAncestralHalls"),
          fromManifest("religionFoundations"),
          fromManifest("religionOtherWorship"),
        ],
      },
      {
        title: "精選",
        layers: [
          // 2026-08-02 自「觀光 → 玩・人文」搬來並更名（原 key tourReligion），
          // 對應上游 religion.top100（自 tourism.religion 搬移歸位）
          fromManifest("religionTop100"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚰️ FUNERAL 殯葬（2026-08-05 第 37 主題；上游 funeral 批次）
  // 🔴 A／B／C 三源分開不整合 —— 點位（A 官方名冊）／墓區範圍（B OSM 實際使用
  //    + C 都計法定劃設）／密度分析（A 區級）三個子群，讓使用者自行疊圖比對。
  // ───────────────────────────────────────────────────────────────
  {
    title: "殯葬 Funeral",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("funeralFacilities"),
          fromManifest("funeralOperators"),
        ],
      },
      {
        title: "墓區範圍",
        layers: [
          fromManifest("cemeteryOsm"),
          fromManifest("cemeteryZoning"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("funeralOperatorDensity"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🧳 TOURISM 觀光
  // ───────────────────────────────────────────────────────────────
  {
    title: "觀光 Tourism",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "玩・自然 Nature",
        layers: [
          fromManifest("tourAttractions"),
          fromManifest("tourHotSprings"),
          fromManifest("tourHotSpringZones"),
          fromManifest("tourScenicAreas"),
          fromManifest("nationalParks"),
          fromManifest("visitorCentres"),
          fromManifest("tourServiceSites"),
          fromManifest("tourVisitorStats"),
        ],
      },
      {
        title: "玩・人文 Heritage",
        layers: [
          fromManifest("tourHeritage"),
        ],
      },
      {
        title: "玩・體驗 Experience",
        layers: [
          fromManifest("tourEvents"),
          fromManifest("tourFactories"),
          fromManifest("tourAmusementParks"),
          fromManifest("tourCamping"),
        ],
      },
      {
        title: "住・食 Stay & Eat",
        layers: [
          fromManifest("tourHotels"),
          fromManifest("tourRestaurants"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ♻️ WASTE 廢棄物
  // ───────────────────────────────────────────────────────────────
  {
    title: "廢棄物 Waste",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時",
        layers: [
          fromManifest("wasteTruck"),
          fromManifest("wasteSchedule"),
          fromManifest("wasteScheduleNote"),
          fromManifest("wasteCleaningSquads"),
        ],
      },
      {
        title: "投放點",
        layers: [
          fromManifest("wasteStopsStatic"),
          fromManifest("wdClothes"),
          fromManifest("wdMixed"),
          fromManifest("wdRecyclingContainer"),
          fromManifest("wdBattery"),
        ],
      },
      {
        title: "處理設施",
        layers: [
          fromManifest("wfIncinerator"),
          fromManifest("wfLandfill"),
          fromManifest("wfLandfillCoastal"),
          fromManifest("wfTransfer"),
          fromManifest("wfMedical"),
          fromManifest("wfMonitoring"),
          fromManifest("wfRecycling"),
          fromManifest("wfScrapYard"),
          fromManifest("wfOther"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏥 MEDICAL 醫療
  // ───────────────────────────────────────────────────────────────
  {
    title: "醫療 Medical",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("medHospital"),
          fromManifest("emergencyHospitals"),
          fromManifest("medClinic"),
          fromManifest("medPharmacy"),
          fromManifest("medAED"),
          fromManifest("medLTC"),
        ],
      },
      {
        title: "減害服務 Harm Reduction",
        layers: [
          fromManifest("harmReductionNeedle"),
          fromManifest("harmReductionTreatment"),
          fromManifest("harmReductionHivSelftest"),
          fromManifest("harmReductionHivTesting"),
          fromManifest("harmReductionPreventionCenters"),
          // 第二批（依系統鏈：治療 → 預防／減害 → 社會復歸；酒駕事故放「執法治安 › 交通事故」）
          fromManifest("harmReductionAlcohol"),
          fromManifest("harmReductionSmokingCessation"),
          fromManifest("harmReductionInternetAddiction"),
          fromManifest("harmReductionPrep"),
          fromManifest("harmReductionCondomOutlets"),
          fromManifest("harmReductionAntiDrugPharmacies"),
          fromManifest("harmReductionTherapeuticCommunities"),
          fromManifest("harmReductionAftercare"),
        ],
      },
      {
        title: "即時 Emergency",
        layers: [
          fromManifest("erHospital"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("medIsochrone"),
          fromManifest("medDesert"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚒 FIRE 消防
  // ───────────────────────────────────────────────────────────────
  {
    title: "消防 Fire & Rescue",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("fireStations"),
          fromManifest("fireHydrants"),
          fromManifest("disasterResourceSites"),
        ],
      },
      {
        title: "事件",
        layers: [
          fromManifest("fireEvents"),
          fromManifest("fireLatest"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("fireIsochrone"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚠️ HAZARD 災害
  // ───────────────────────────────────────────────────────────────
  {
    title: "災害 Hazard",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時警示",
        layers: [
          fromManifest("lifelineAlerts"),
          fromManifest("floodAlerts"),
          fromManifest("weatherAlerts"),
          fromManifest("transitAlerts"),
          fromManifest("safetyAlerts"),
        ],
      },
      {
        title: "地震 / 斷層",
        layers: [
          fromManifest("earthquakes"),
          fromManifest("earthquakeReplay"),
          fromManifest("activeFaults"),
        ],
      },
      {
        title: "土壤液化",
        layers: [
          fromManifest("soilLiquefactionPotential"),
          fromManifest("weakSoilClay0To5"), fromManifest("weakSoilSand0To5"),
          fromManifest("weakSoilClay5To10"), fromManifest("weakSoilSand5To10"),
          fromManifest("weakSoilClay10To20"), fromManifest("weakSoilSand10To20"),
          fromManifest("liquefactionMonitoringSites"),
        ],
      },
      {
        title: "雷暴",
        layers: [
          fromManifest("lightning"),
          fromManifest("lightningCwa"),
        ],
      },
      {
        // 崩塌：大規模崩塌潛勢區＋影響範圍（同一年度版本選單）、省道歷史災情、年度全島崩塌地
        title: "崩塌 Landslide",
        layers: [
          fromManifest("landslideDodAreas"),
          fromManifest("landslideDodImpact"),
          fromManifest("highwayDisasterHistory"),
          fromManifest("landslideAnnual"),
          fromManifest("swcbDisasterPhotoPoints"),
        ],
      },
      {
        title: "淹水 Flooding",
        layers: [
          fromManifest("floodDisasterPointsNcdr"),
          fromManifest("taipeiWaterloggingHistory"),
        ],
      },
      {
        // 山域事故：與「🌲 林業」的步道 / 通訊點 / 山屋 疊圖 = 登山安全敘事
        title: "山域事故 Mountain Rescue",
        layers: [
          fromManifest("mountainRescueIncidents"),
        ],
      },
      {
        title: "核安",
        layers: [
          fromManifest("nuclearRadiation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛡️ CIVIL DEFENSE 民防避難
  // ───────────────────────────────────────────────────────────────
  {
    title: "民防避難 Civil Defense",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "避難設施",
        layers: [
          fromManifest("civilDefenseShelter"),
        ],
      },
      {
        title: "警報與疏散",
        layers: [
          fromManifest("tsunamiSirens"),
          fromManifest("nuclearEpzEvacuation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚓 LAW & ORDER 執法治安（4 子群、16 個 layer）
  // ───────────────────────────────────────────────────────────────
  {
    title: "執法治安 Law & Order",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "警政",
        layers: [
          fromManifest("policeStation"),
          fromManifest("womenChildWarning"),
          fromManifest("speedCamera"),
          fromManifest("speedZoneSegment"),
        ],
      },
      {
        title: "警察覆蓋分析",
        layers: [
          fromManifest("policeIsoSubstation"),
          fromManifest("policeIsoPrecinct"),
          fromManifest("policeIsoCityDept"),
        ],
      },
      {
        title: "司法矯正",
        layers: [
          fromManifest("court"),
          fromManifest("prosecutorsOffice"),
          fromManifest("correctionalFacility"),
          fromManifest("courtJurisdiction"),
        ],
      },
      {
        title: "治安態勢",
        layers: [
          fromManifest("theftTaoyuan"),
        ],
      },
      {
        title: "交通事故",
        layers: [
          fromManifest("trafficAccidents2025"),
          fromManifest("trafficAccidentYearly"),
          fromManifest("accidentTaipei"),
          fromManifest("a1AccidentRealtime"),
          fromManifest("harmReductionDuiCrashes"),
        ],
      },
      {
        title: "廉政移民海巡",
        layers: [
          fromManifest("investigationBureau"),
          fromManifest("antiCorruptionOffice"),
          fromManifest("immigrationOffice"),
          fromManifest("coastGuardStation"),
        ],
      },
      {
        title: "勞動檢查 Labor Inspection",
        layers: [
          fromManifest("majorOccupationalAccidents"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌤️ ENV 環境氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "環境氣候 Environment",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "氣象",
        layers: [
          fromManifest("weatherStations"),
          fromManifest("cwaCloudImagery"),
          fromManifest("cwaRadarImagery"),
          fromManifest("temperatureWave"),
          fromManifest("temperatureGrid"),
          fromManifest("cwaUvDaily"),
        ],
      },
      {
        title: "空品",
        layers: [
          fromManifest("aqiImagery"),
          fromManifest("aqiStations"),
          fromManifest("aqiMicroSensors"),
          fromManifest("pm25ManualStations"),
          fromManifest("dioxinStations"),
        ],
      },
      {
        title: "噪音／聲響 Noise",
        layers: [
          fromManifest("officialNoiseMonitoring"),
          fromManifest("noiseCaptureGrid"),
          fromManifest("noiseControlZones"),
          fromManifest("aviationNoiseZones"),
          fromManifest("noiseEnforcementEvents"),
          fromManifest("soundCameraLocations"),
        ],
      },
      {
        title: "水質與污水 Water Quality",
        layers: [
          fromManifest("riverRpiStations"),
          fromManifest("waterQualityStations"),
          fromManifest("sewageTreatmentPlants"),
          fromManifest("drinkingWaterProtectionZones"),
          fromManifest("seaWaterQualityStations"),
          fromManifest("riverRpiSegments"),
          fromManifest("waterEffluentLive"),
        ],
      },
      {
        title: "環境污染",
        layers: [
          fromManifest("pollutionFacility"),
          fromManifest("toxicChemicalFacilities"),
          fromManifest("pollutionPenaltyCritical"),
          fromManifest("pollutionPenaltyGeneral"),
          fromManifest("pollutionPenaltyMobile"),
          fromManifest("pollutionSite"),
          fromManifest("incineratorEmissions"),
          fromManifest("cemsStackLive"),
          fromManifest("nuscGammaRadiation"),
        ],
      },
      {
        title: "濕地 Wetlands",
        layers: [
          fromManifest("importantWetlands"),
        ],
      },
      {
        title: "都市樹木 Urban Trees",
        layers: [
          fromManifest("streetTreesTaipeiDiff"),
          fromManifest("streetTreesTaipei3epoch"),
          fromManifest("streetTreesNational"),
          fromManifest("protectedTreesNational"),
          fromManifest("riversideTreesTaipei"),
          fromManifest("treePitsTaipei"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌊 海洋（atlas 批次 2026-10）
  // ───────────────────────────────────────────────────────────────
  {
    title: "海洋 Marine",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "擱淺 Strandings",
        layers: [
          fromManifest("cetaceanStrandings"),
          fromManifest("seaTurtleStrandings"),
        ],
      },
      {
        title: "海域環境 Marine Environment",
        layers: [
          fromManifest("beachWaterQuality"),
          fromManifest("marineMicroplastics"),
          fromManifest("marinePollutionIncidents"),
        ],
      },
      {
        title: "調查站網 Survey Sites",
        layers: [
          fromManifest("namrEdnaSurveySites"),
          fromManifest("marineEcologicalMonitoringSites"),
        ],
      },
      {
        title: "海域保護與漁業 Protected Areas & Fisheries",
        layers: [
          fromManifest("natureReserves"),
          fromManifest("wildlifeProtectedAreas"),
          fromManifest("marineWildlifeAreas"),
          fromManifest("coastalAreaExtents"),
          fromManifest("openFishingLocations"),
          fromManifest("artificialReefCenters"),
          fromManifest("protectedReefCenters"),
          fromManifest("setNetFishingAreas"),
          fromManifest("exclusiveFisheryRightAreas"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 💧 WATER 水資源
  // ───────────────────────────────────────────────────────────────
  {
    title: "水資源 Water",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("marineObservationCwa"),
          fromManifest("marineObservationIsohe"),
          fromManifest("waterFacilities"),
          fromManifest("waterMonitorStations"),
          fromManifest("waterReservoirs"),
          fromManifest("groundwaterWells"),
          fromManifest("rainGauge"),
          fromManifest("riverLevel"),
          fromManifest("floodSensor"),
          fromManifest("iotWraRiver"),
          fromManifest("iotWraStructure"),
          fromManifest("taipeiSewer"),
          fromManifest("taipeiEvacuate"),
          fromManifest("taipeiPumb"),
        ],
      },
      {
        title: "面 / 線",
        layers: [
          fromManifest("waterBasins"),
          fromManifest("waterRivers"),
          fromManifest("waterLevees"),
          fromManifest("waterCanals"),
          fromManifest("waterProtectionZones"),
          fromManifest("waterDetentionBasins"),
          fromManifest("groundwater"),
          fromManifest("lakesPondsOsm"),
        ],
      },
      {
        // G16（2026-10-24）：台水官方名冊；「點位」的「水利設施」是 OSM，可能畫到同一座淨水場
        title: "自來水（台水）",
        layers: [
          fromManifest("twcWaterFacilities"),
          fromManifest("twcServiceOffices"),
        ],
      },
      {
        title: "水利設施 Water Facilities",
        layers: [
          fromManifest("wraFloodgatesCentral"),
          fromManifest("wraCentralDrainage"),
          fromManifest("iowStructureMonitoring"),
          fromManifest("wraDredgingPoints"),
          fromManifest("wraEcologySurveySites"),
        ],
      },
      {
        title: "地層下陷與海堤 Land Subsidence & Seawalls",
        layers: [
          fromManifest("landSubsidenceStations"),
          fromManifest("landSubsidenceCumulative"),
          fromManifest("landSubsidenceRate"),
          fromManifest("seawallZones"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("waterFloodExtreme"),
          fromManifest("floodSensorIsochrone"),
          fromManifest("precipRaster"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 📡 COMMUNICATIONS 通訊（獨立 rail tab「世界」專屬）
  // ───────────────────────────────────────────────────────────────
  {
    title: COMMUNICATIONS_THEME_TITLE,
    country: "WORLD",
    defaultCollapsed: true,
    groups: [
      {
        title: "全球骨幹 Global Backbone",
        layers: [
          fromManifest("submarineCables"),
          fromManifest("landingStations"),
        ],
      },
      {
        title: "網路互連 Internet Exchange",
        layers: [
          fromManifest("internetExchangePoints"),
        ],
      },
      {
        title: "群眾無線站點 Crowdsourced Wireless Sites",
        layers: [fromManifest("osmCommunicationSites")],
      },
      {
        title: "量測節點 Measurement Nodes",
        layers: [fromManifest("ripeAtlasProbes")],
      },
      {
        title: "網路效能格網 Network Performance Grid",
        layers: [
          fromManifest("ooklaMobilePerformance"),
          fromManifest("ooklaFixedPerformance"),
        ],
      },
    ],
  },

  // 📡 台灣「通訊」（2026-10-28 國家主體化 §8：Ookla 台灣細格自世界「全球通訊」移入）
  {
    title: TAIWAN_TELECOM_THEME_TITLE,
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "網路效能格網 Network Performance Grid",
        layers: [
          fromManifest("ooklaMobileTaiwan"),
          fromManifest("ooklaFixedTaiwan"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 GLOBAL CLIMATE 全球氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "全球氣候 Global Climate",
    country: "WORLD",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("earthquakesGlobal"),
          fromManifest("typhoonTracks"),
          fromManifest("typhoonAgencyForecasts"),
        ],
      },
      {
        title: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）",
        layers: [
          fromManifest("windField"),
          fromManifest("oceanCurrents"),
          fromManifest("dustForecast"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌾 AGRICULTURE 農業
  // ───────────────────────────────────────────────────────────────
  {
    title: "農業 Agriculture",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("agriPOI"),
          fromManifest("agriRetail"),
          fromManifest("agriProduceWholesale"),
          fromManifest("agriWholesaleMarket"),
        ],
      },
      {
        title: "畜牧 Livestock",
        layers: [
          fromManifest("livestockFarmPig"),
          fromManifest("livestockFarmChicken"),
          fromManifest("livestockFarmCattle"),
          fromManifest("livestockFarmDuck"),
          fromManifest("livestockFarmGoose"),
          fromManifest("livestockFarmSheep"),
          fromManifest("livestockFarmOther"),
          fromManifest("livestockSlaughter"),
          fromManifest("livestockFeed"),
          fromManifest("livestockMarket"),
        ],
      },
      {
        title: "養殖漁業 Aquaculture",
        layers: [
          fromManifest("aquaculturePonds"),
          fromManifest("aquacultureZone"),
          fromManifest("aquacultureCageNet"),
          fromManifest("aquacultureWaterSatellite"),
          fromManifest("aquacultureWaterSatelliteMoa"),
          fromManifest("aquacultureWaterUnion"),
          fromManifest("aquacultureIntegrated"),
        ],
      },
      {
        title: "面 / 分區",
        layers: [
          fromManifest("agriculture"),
          fromManifest("agriLeisureFarmZones"),
          fromManifest("agriRuralRegen"),
          fromManifest("ecoNetworkZones"),
        ],
      },
      {
        title: "土壤",
        layers: [
          fromManifest("agriSoil"),
          fromManifest("agriSoilFertility"),
          fromManifest("agriCropSuitability"),
        ],
      },
      {
        title: "線",
        layers: [
          fromManifest("farmRoads"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🐾 ANIMAL WELFARE 動物福利
  // ───────────────────────────────────────────────────────────────
  {
    title: "動物福利 Animal Welfare",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "認領養與收容 Adoption & Shelter",
        layers: [fromManifest("animalAdoption")],
      },
      {
        title: "收容成果與壓力",
        layers: [fromManifest("animalShelterPressure")],
      },
      {
        title: "服務據點 Service Points",
        layers: [fromManifest("animalWelfarePoints")],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌲 FORESTRY 林業
  // ───────────────────────────────────────────────────────────────
  {
    title: "林業 Forestry",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "分區",
        layers: [
          fromManifest("forestCompartments"),
          fromManifest("forestReserve"),
          fromManifest("forestRecreation"),
          fromManifest("forestFlatParks"),
          fromManifest("canopyHeight"),
          fromManifest("canopyGiants"),
        ],
      },
      {
        title: "點位",
        layers: [
          fromManifest("forestTreatmentWorks"),
          fromManifest("forestTrailSigns"),
          fromManifest("forestSignalPoints"),
          fromManifest("forestEducationCenters"),
          fromManifest("mountainHuts"),
          fromManifest("forestDamLakes"),
        ],
      },
      {
        title: "線",
        layers: [
          fromManifest("forestRoads"),
          fromManifest("forestAlishanRail"),
          fromManifest("hikingTrails"),
        ],
      },
      {
        title: "生態",
        layers: [
          fromManifest("forestWildlife"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰️ SPACE 太空
  // ───────────────────────────────────────────────────────────────
  {
    title: "太空 Space",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "台灣",
        layers: [
          fromManifest("satellitesTaiwan"),
        ],
      },
      {
        title: "中國",
        layers: [
          fromManifest("satellitesYaogan"),
          fromManifest("satellitesJilin"),
          fromManifest("satellitesGaofen"),
          fromManifest("satellitesTJS"),
          fromManifest("satellitesBeidou"),
          fromManifest("satellitesShiyan"),
        ],
      },
      {
        title: "國際偵察",
        layers: [
          fromManifest("satellitesUSA"),
          fromManifest("satellitesJapan"),
          fromManifest("satellitesRussia"),
          fromManifest("satellitesIndia"),
          fromManifest("satellitesKorea"),
          fromManifest("satellitesFrance"),
          fromManifest("satellitesGermany"),
          fromManifest("satellitesItaly"),
          fromManifest("satellitesIsrael"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰 SITUATION 情勢 — 每日回顧型的情勢內容（非秒級即時）
  // ───────────────────────────────────────────────────────────────
  {
    title: "情勢 Situation",
    country: "TW",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("newsEvents"),
        ],
      },
      {
        title: "軍事",
        layers: [
          fromManifest("plaActivity"),
          fromManifest("vesselWatch"),
          fromManifest("firingNoticeAreas"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 GLOBAL SITUATION / ENVIRONMENT（世界 rail 專屬；不再以泛稱「世界」包組）
  // ───────────────────────────────────────────────────────────────
  {
    title: GLOBAL_SITUATION_THEME_TITLE,
    country: "WORLD",
    defaultCollapsed: true,
    groups: [
      {
        title: "重大事件 Major Events",
        layers: [
          fromManifest("globalEvents"),
        ],
      },
    ],
  },
  {
    title: GLOBAL_ENVIRONMENT_THEME_TITLE,
    country: "WORLD",
    defaultCollapsed: true,
    groups: [
      {
        title: "廢棄物觀測 Waste Observations",
        layers: [
          fromManifest("worldTrashDebris"),
        ],
      },
      {
        title: "海洋生態 Marine Ecosystems",
        layers: [
          fromManifest("coralReefDistribution"),
          fromManifest("allenCoralAtlas"),
        ],
      },
    ],
  },

  {
    title: "全球海事 Global Maritime",
    country: "WORLD",
    defaultCollapsed: true,
    groups: [
      {
        title: "船舶",
        layers: [
          fromManifest("aisstreamVessels"),
          fromManifest("gfwVesselPresence"),
          fromManifest("gfwHourlyGrid"),
          fromManifest("gfwHourlyTracks"),
          fromManifest("gfwFishingEffort"),
          fromManifest("gfwDarkVessels"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🧪 SIMULATION 模擬（獨立 rail tab「模擬」專屬，站主限定；桌機主 Layers panel 排除這批主題）
  //    D-6：只搬 bridgeResilienceTwinCity，全臺橋梁（BSS）兩層留在交通「橋梁研究（進行中）」。
  // ───────────────────────────────────────────────────────────────
  {
    title: "雙北跨河橋梁中斷",
    country: "SIM",
    defaultCollapsed: true,
    groups: [{ title: "橋梁中斷", layers: [fromManifest("bridgeResilienceTwinCity")] }],
  },
  {
    // 公車擁擠模擬（simulation PLAN Phase 2 第一刀）：公開 TDX 衍生的本機靜態檔，站主限定只做 UI 鎖。
    title: "臺北 307 走廊公車擁擠",
    country: "SIM",
    defaultCollapsed: true,
    groups: [{ title: "公車擁擠", layers: [fromManifest("busCrowdingSim")] }],
  },

  // ───────────────────────────────────────────────────────────────
  // 🗾 JAPAN 日本（獨立 rail tab「日本」專屬；桌機主 Layers panel 排除這批主題）
  //    tab 抬頭已是「日本 Japan」，故不再多包一層「日本」主題 ——
  //    行政區 / 交通 / 教育 / 人口 / 宗教 直接當頂層主題並列（比照世界 tab 多主題）。
  //    2026-10-03 使用者決定：日本主題一律預設收合，與台灣一致。
  // ───────────────────────────────────────────────────────────────
  // 2026-10-26 重整：日本主題改用台灣的主題系統（主題 title＝台灣主題的中文短名，群組名沿用台灣原字串）；
  // 日本特有群組：火山、積雪、季節觀測、自來水。避難場所依使用者決定併入「災害／避難設施」，不另設民防避難主題。
  {
    title: "底圖",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "行政邊界", layers: [fromManifest("jpAdminPrefecture"), fromManifest("jpAdminBoundaries")] },
      { title: "建成環境", layers: [fromManifest("jpBuildingHeight")] },
      { title: "土地使用分區 Zoning", layers: [fromManifest("jpZoningUseDistricts")] },
      { title: "地形", layers: [fromManifest("jpGsiHillshade"), fromManifest("jpGsiRelief")] },
    ],
  },
  {
    title: "交通",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "場站", layers: [fromManifest("jpStations"), fromManifest("jpBusStops")] },
      { title: "歷史軌跡", layers: [fromManifest("jpHistoricalFlightTrails")] },
      { title: "路網", layers: [fromManifest("jpRailways"), fromManifest("jpExpressways"), fromManifest("jpMajorRoads")] },
      { title: "樞紐節點", layers: [fromManifest("jpAirports")] },
    ],
  },
  {
    title: "人口社經",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "人口分布", layers: [fromManifest("jpPopulationMesh1km")] }],
  },
  {
    title: "基礎建設",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "公共設施", layers: [fromManifest("jpPublicOffices")] }],
  },
  {
    title: "教育",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "學校 Schools", layers: [fromManifest("jpSchools")] }],
  },
  {
    title: "社福長照",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "住宿照顧", layers: [fromManifest("jpCareResidential"), fromManifest("jpWelfareDisability")] },
      { title: "長照與托育", layers: [
        fromManifest("jpCarePlanning"), fromManifest("jpCareHomeVisit"), fromManifest("jpCareDayServices"),
        fromManifest("jpCareCombined"), fromManifest("jpCareEquipment"), fromManifest("jpWelfareChild"),
      ] },
    ],
  },
  {
    title: "宗教",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "點位", layers: [fromManifest("jpReligionGsi"), fromManifest("jpReligionOsm"), fromManifest("jpReligionWikidata")] }],
  },
  {
    title: "觀光",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      ...localResearchGroup("玩・自然 Nature", [
        "jpNaturalParksNational", "jpNaturalParksQuasiNational", "jpNaturalParksPrefectural",
      ]),
      { title: "玩・人文 Heritage", layers: [
        fromManifest("jpWorldHeritageCultural"), fromManifest("jpWorldHeritageNatural"),
        ...(IS_PRODUCTION ? [] : [fromManifest("jpWorldNaturalHeritageHistorical")]),
      ] },
      { title: "住・食 Stay & Eat", layers: [
        fromManifest("jpAccommodationCanonical"), fromManifest("jpAccommodationDensity"),
        fromManifest("jpAccommodationJta"), fromManifest("jpAccommodationLocal"), fromManifest("jpAccommodationOsm"),
      ] },
    ],
  },
  {
    title: "醫療",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "點位", layers: [
        fromManifest("jpMedicalHospitals"), fromManifest("jpMedicalClinics"), fromManifest("jpMedicalDental"),
        fromManifest("jpMedicalMaternity"), fromManifest("jpMedicalPharmacies"),
      ] },
      { title: "分析", layers: [
        fromManifest("jpMedicalAreasPrimary"), fromManifest("jpMedicalAreasSecondary"), fromManifest("jpMedicalAreasTertiary"),
      ] },
    ],
  },
  {
    title: "災害",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "即時警示", layers: [fromManifest("jmaWarnings")] },
      { title: "地震 / 斷層", layers: [fromManifest("jmaQuakes")] },
      { title: "火山", layers: [fromManifest("jmaVolcanoes")] },
      { title: "雷暴", layers: [fromManifest("jmaLightning")] },
      { title: "崩塌 Landslide", layers: [fromManifest("jpLandslideWarningAreas"), fromManifest("jmaRiskLand"), fromManifest("jmaAnaRiskLandHours")] },
      { title: "淹水 Flooding", layers: [
        fromManifest("jpWaterFloodHazard"), fromManifest("jpInlandFloodAreas"), fromManifest("jmaRiskFlood"), fromManifest("jmaRiskInund"), fromManifest("jmaAnaRiskInundHours"),
      ] },
      { title: "避難設施", layers: [fromManifest("jpEvacuationSites")] },
    ],
  },
  {
    title: "執法治安",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "警政", layers: [fromManifest("jpPoliceFacilities")] }],
  },
  {
    title: "環境氣候",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "氣象", layers: [
        fromManifest("jmaAmedas"), fromManifest("jmaWbgt"), fromManifest("jmaRadar"), fromManifest("jmaRasrf"),
        fromManifest("jmaAnaRainDays"), fromManifest("jmaHimawari"), fromManifest("jmaUvIndex"),
      ] },
      { title: "積雪", layers: [
        fromManifest("jmaSnowDepth"), fromManifest("gibsSnowCover"), fromManifest("jmaAnaSnowFirst"), fromManifest("jmaAnaSnowDays"),
      ] },
      { title: "季節觀測", layers: [
        fromManifest("jmaSakura"), fromManifest("jmaAutumnLeaves"), fromManifest("jmaSnowcap"), fromManifest("jmaRainySeason"),
      ] },
      { title: "空品", layers: [fromManifest("jmaKosa")] },
      { title: "水質與污水 Water Quality", layers: [fromManifest("jpWaterQualityStations"), fromManifest("jpWaterSewerFacilities")] },
    ],
  },
  {
    title: "海洋",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "海域環境 Marine Environment", layers: [fromManifest("jmaSst"), fromManifest("jmaSeaIce")] },
      { title: "海域保護與漁業 Protected Areas & Fisheries", layers: [
        fromManifest("jpMarineEbsaCoastal"),
        ...(IS_PRODUCTION ? [] : [
          "jpNatureConservationArea", "jpPrimitiveNatureEnvironmentArea", "jpNatureConservationSpecialDistrict",
          "jpWildlifeProtectionNational", "jpWildlifeSpecialProtectionDistrict", "jpWildlifeSpecialProtectionDesignatedArea",
          "jpRamsarSites",
        ].map((key) => fromManifest(key as ManifestKey))),
      ] },
    ],
  },
  {
    title: "水資源",
    country: "JP",
    defaultCollapsed: true,
    groups: [
      { title: "點位", layers: [
        fromManifest("jpWaterDams"), fromManifest("jpWaterNilimDams"), fromManifest("jpWaterLevelStations"),
        fromManifest("jpWaterGroundwaterSites"), fromManifest("jpWaterAgriculturalPonds"),
      ] },
      { title: "面 / 線", layers: [fromManifest("jpWaterRivers"), fromManifest("jpWaterLakes")] },
      { title: "自來水", layers: [
        fromManifest("jpWaterSupplyFacilities"), fromManifest("jpWaterSupplyAreas"), fromManifest("jpWaterLocalFacilities"),
      ] },
    ],
  },
  {
    title: "林業",
    country: "JP",
    defaultCollapsed: true,
    groups: [{ title: "分區", layers: [fromManifest("jpNationalForests"), fromManifest("jpCanopyHeight")] }],
  },

  // ───────────────────────────────────────────────────────────────
  // 🇫🇷 法國（2026-10-28 國家主體化 §8：ANFR 自世界「全球通訊」移入；title 照日本做法用中文短名）
  // ───────────────────────────────────────────────────────────────
  {
    title: FRANCE_TELECOM_THEME_TITLE,
    country: "FR",
    defaultCollapsed: true,
    groups: [
      {
        title: "官方無線站點 Official Wireless Sites",
        layers: [fromManifest("anfrWirelessSites")],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🇰🇷 南韓（2026-10-31 南韓第 0 波：行政邊界；之後各波照台灣主題名登記）
  // ───────────────────────────────────────────────────────────────
  {
    title: "底圖",
    country: "KR",
    defaultCollapsed: true,
    groups: [
      { title: "行政邊界", layers: [fromManifest("krAdminBoundaries")] },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🇬🇧 英國（2026-10-29 英國第 0b 波：行政邊界；之後各波照台灣主題名登記）
  // ───────────────────────────────────────────────────────────────
  {
    title: "底圖",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "行政邊界", layers: [fromManifest("gbAdminBoundaries"), fromManifest("gbSmallAreaBoundaries")] },
      // 第 1 波 C002（UKHO）；第 3 波由「海洋」搬來，對齊台灣 maritimeBoundary 的「底圖 › 海域界線」
      { title: "海域界線", layers: [fromManifest("gbMaritimeLimits")] },
      // 第 1 波：建成區比照台灣「底圖 › 建成環境」（buildingsGba）
      { title: "建成環境", layers: [fromManifest("gbBuiltUpAreas")] },
      // 第 1 波：OS Open Greenspace 同一檔三層。台灣同類分在「運動休閒」（parksTaipei、sports*）與「殯葬」（cemeteryOsm），
      // 英國目前沒有那兩個主題，先放底圖；之後開主題時整群搬過去即可
      { title: "綠地與開放空間", layers: [fromManifest("gbGreenspace"), fromManifest("gbSportsFacilities"), fromManifest("gbCemeteries")] },
      // C003：OS Terrain 50 山體陰影／色別標高，比照台灣 hillshade 與日本地理院地形的「底圖 › 地形」
      { title: "地形", layers: [fromManifest("gbTerrainHillshade"), fromManifest("gbTerrainRelief")] },
      // 第 11 波 C005／C031：比照台灣 urbanZoning*／nonUrbanZoning 的「底圖 › 土地使用分區 Zoning」。
      // 規劃限制區是法定分區疊加；棕地登記冊是地方規劃機關依法公告的「適合住宅開發土地」名冊，同屬規劃制度（同為 Planning Data 來源）
      { title: "土地使用分區 Zoning", layers: [fromManifest("gbPlanningConstraints"), fromManifest("gbBrownfield")] },
    ],
  },
  {
    // 第 3 波 C102：台灣沒有海岸侵蝕圖層，依語意歸「災害」，自成一群
    title: "災害",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      // 第 9 波 C066：比照台灣 earthquakes 的「災害 Hazard › 地震 / 斷層」
      { title: "地震 / 斷層", layers: [fromManifest("gbEarthquakes")] },
      // 第 9 波 C067／C072：GeoSure 六種地質災害與氡氣指示圖。台灣沒有同類圖層（GeoSure 不是液化，不放「土壤液化」），自成「地質災害」群
      { title: "地質災害", layers: [fromManifest("gbGroundStability"), fromManifest("gbRadon")] },
      // 第 9 波 C069：比照台灣 landslideAnnual 的「災害 Hazard › 崩塌 Landslide」
      { title: "崩塌 Landslide", layers: [fromManifest("gbLandslide")] },
      { title: "海岸侵蝕", layers: [fromManifest("gbCoastalErosionRisk")] },
    ],
  },
  {
    title: "海洋",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      // 第 3 波 C095：比照台灣 beachWaterQuality 的「海洋 › 海域環境」
      { title: "海域環境", layers: [fromManifest("gbBathingWaters")] },
      // 第 5 波 C097：比照台灣 natureReserves／marineWildlifeAreas 的「海洋 › 海域保護與漁業」
      { title: "海域保護與漁業 Protected Areas & Fisheries", layers: [fromManifest("gbMarineProtectedAreas")] },
    ],
  },
  {
    title: "水資源",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      // 第 3 波：比照台灣 riverLevel／rainGauge（點位）、waterRivers／waterLevees（面 / 線）
      { title: "點位", layers: [fromManifest("gbHydroStations")] },
      { title: "面 / 線", layers: [fromManifest("gbRivers"), fromManifest("gbFloodDefenceAssets")] },
    ],
  },
  {
    // 第 4 波：群組比照台灣「交通 Move」——stationsMetro／bikeStations（場站）、railRoutes／cctv（路網）、ports／airports（樞紐節點）；
    // 收費區台灣無同類，自成「收費與低排放區」
    // 第 10 波：主要路網比照台灣 highways／provincialRoads、AADF 計數點比照 etcGantry（路側計數設施），都在「路網」
    title: "交通",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "場站", layers: [fromManifest("gbLondonStations"), fromManifest("gbStationUsage"), fromManifest("gbLondonBikePoints")] },
      { title: "路網", layers: [fromManifest("gbMajorRoads"), fromManifest("gbTrafficCountsAadf"), fromManifest("gbLondonRailLines"), fromManifest("gbLondonJamCams")] },
      { title: "樞紐節點", layers: [fromManifest("gbTransportHubs")] },
      { title: "收費與低排放區", layers: [fromManifest("gbLondonChargingZones")] },
    ],
  },
  {
    // 第 5 波：保護區放「環境氣候」（主 agent 決定；台灣無完全對應，自成「保護區」群）；
    // 樹木保護比照台灣 protectedTreesNational 的「環境氣候 › 都市樹木」（本層另含古老林地）
    title: "環境氣候",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "保護區", layers: [fromManifest("gbProtectedAreas")] },
      { title: "都市樹木 Urban Trees", layers: [fromManifest("gbTreeProtection")] },
      // 第 9 波 C072：加馬劑量率比照台灣 nuscGammaRadiation（環境輻射）的「環境氣候 › 環境污染」
      // 第 11 波 C092：污染排放申報比照台灣 pollutionFacility（申報工廠）；C090 噪音比照台灣「噪音／聲響 Noise」
      { title: "環境污染", layers: [fromManifest("gbRadiation"), fromManifest("gbPollutionInventory")] },
      { title: "噪音／聲響 Noise", layers: [fromManifest("gbNoise")] },
    ],
  },
  {
    // 第 11 波 C086／C087：比照台灣「廢棄物 Waste」——wdRecyclingContainer（投放點；本層回收桶 11,412 佔 88%，
    // 回收中心 1,547 比照 wfRecycling 但一層只放一群，取多數）、wf*（處理設施）
    title: "廢棄物",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "投放點", layers: [fromManifest("gbRecyclingCentres")] },
      { title: "處理設施", layers: [fromManifest("gbWastePermits")] },
    ],
  },
  {
    // 第 5 波：比照台灣「林業 Forestry」——forestCompartments（分區）、forestTrailSigns（點位）、hikingTrails（線）；
    // 開放進入地台灣無同類，與步道同屬戶外通行，放「分區」（面）
    title: "林業",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "分區", layers: [fromManifest("gbWoodland"), fromManifest("gbOpenAccessLand")] },
      { title: "點位", layers: [fromManifest("gbForestRecreation")] },
      { title: "線", layers: [fromManifest("gbTrails")] },
    ],
  },
  {
    // 第 6 波：比照台灣「能源 Energy」的群組——facPrimary（電力 · 廠）、osmPowerLines／osmSubstations（電力 · 電網）、
    // osmWindTurbines 等（再生能源）、gasStation*（石化 · 加油站）、fossilFuelInfra／pipelineOilGas（石化 · 油氣）
    title: "能源",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "電力 · 廠", layers: [fromManifest("gbPowerPlants")] },
      { title: "電力 · 電網", layers: [fromManifest("gbPowerLines"), fromManifest("gbSubstations")] },
      { title: "再生能源", layers: [fromManifest("gbRenewables")] },
      { title: "石化 · 加油站", layers: [fromManifest("gbFuelStations")] },
      { title: "石化 · 油氣", layers: [fromManifest("gbOilGasFields")] },
    ],
  },
  // 第 7 波：公共服務，主題與群組比照台灣同類圖層位置——schools 等（教育 › 學校 Schools）、
  // medHospital／medClinic／medPharmacy（醫療 › 點位）、welfareNursingHomes 等（社福長照 › 住宿照顧）、
  // welfareLtcInstitutions（社福長照 › 長照與托育）、fireStations（消防 › 點位）、court（執法治安 › 司法矯正）
  {
    title: "教育",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "學校 Schools", layers: [fromManifest("gbSchools")] }],
  },
  {
    title: "社福長照",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "住宿照顧", layers: [fromManifest("gbCareHomes")] },
      { title: "長照與托育", layers: [fromManifest("gbCareServices")] },
    ],
  },
  {
    title: "醫療",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "點位", layers: [fromManifest("gbHealthFacilities")] }],
  },
  {
    title: "消防",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "點位", layers: [fromManifest("gbFireStations")] }],
  },
  {
    title: "執法治安",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "司法矯正", layers: [fromManifest("gbCourts")] }],
  },
  // 第 8 波：文化與觀光，主題與群組比照台灣同類圖層位置——culturalFacilities／culturalMuseums（文化 › 設施 Facilities）、
  // performingVenues（文化 › 藝文活動 Arts & Events）、tourAttractions／visitorCentres（觀光 › 玩・自然 Nature；
  // 景點＋遊客中心佔本層 92%，主題樂園對應的 tourAmusementParks 在 玩・體驗，一層只能放一群取多數）
  {
    title: "文化",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "設施 Facilities", layers: [fromManifest("gbCulturalFacilities")] },
      { title: "藝文活動 Arts & Events", layers: [fromManifest("gbArtsVenues")] },
    ],
  },
  {
    title: "觀光",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "玩・自然 Nature", layers: [fromManifest("gbVisitorExperience")] }],
  },
  {
    // C028：比照台灣 statePropertyTenderListings 的「房地產 › 國有財產標售」；英國資料含 NHS、國防部與威爾斯公部門，
    // 不只國有，群組名改「公有財產標售」
    title: "房地產",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "公有財產標售", layers: [fromManifest("gbSurplusLand")] }],
  },
  {
    // 第 12 波 C029／C030：比照台灣「工商登記 Business Registry」的「整體公司」（companyPoints）與「製造業」（manufacturingCompanyPoints）
    title: "工商登記",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "整體公司", layers: [fromManifest("gbCompanies")] },
      { title: "製造業", layers: [fromManifest("gbManufacturing")] },
    ],
  },
  {
    // 第 12 波 C051：比照台灣「殯葬 Funeral › 點位」（funeralFacilities 火化場、funeralOperators 禮儀業者）；墓園另在「底圖 › 綠地」
    title: "殯葬",
    country: "GB",
    defaultCollapsed: true,
    groups: [{ title: "點位", layers: [fromManifest("gbFuneral")] }],
  },
  {
    // 第 12 波 C106／C108：比照台灣「農業 Agriculture」的「養殖漁業 Aquaculture」（aquaculture*）與「土壤」（agriSoil）
    title: "農業",
    country: "GB",
    defaultCollapsed: true,
    groups: [
      { title: "養殖漁業 Aquaculture", layers: [fromManifest("gbAquaculture")] },
      { title: "土壤", layers: [fromManifest("gbSoilParentMaterial")] },
    ],
  },

];

/**
 * Layers 的第一層閱讀順序：不改 theme title、layer key 或資料契約，只提供 UI 分段。
 * 全球與日本主題由各自入口顯示；世界入口的大分類直接讀這張對照（layerPanels.ts `WORLD_MACRO_GROUPS`）。
 */
export const LAYER_MACRO_GROUPS = [
  { key: "baseline", zh: "基準", en: "Baseline" },
  { key: "city", zh: "移動與城市", en: "City & Mobility" },
  { key: "publicLife", zh: "公共生活", en: "Public Life" },
  { key: "safety", zh: "安全與治理", en: "Safety & Governance" },
  { key: "environment", zh: "環境與資源", en: "Environment & Resources" },
  { key: "intelligence", zh: "情報", en: "Intelligence" },
] as const;

export type LayerMacroGroup = (typeof LAYER_MACRO_GROUPS)[number]["key"];

/** 主題 → 大分類，依國家主體分組（主題身分是 (country, title)）。 */
type ThemeTable<T> = Readonly<Partial<Record<ThemeScope, Readonly<Record<string, T>>>>>;

const THEME_MACRO_GROUPS: Readonly<Record<ThemeScope, Readonly<Record<string, LayerMacroGroup>>>> = {
  TW: {
    "工作與所得 Work & Income": "city",
    "農業統計": "environment",
    "畜牧統計": "environment",
    "漁業統計": "environment",
    "林業統計": "environment",
    "交通統計 Transport Statistics": "city",
    "水資源統計 Water Statistics": "environment",
    "廢棄物統計 Waste Statistics": "environment",
    "能源統計 Energy Statistics": "environment",
    "農業統計 Agriculture Statistics": "environment",
    "人口統計 Population Statistics": "city",
    [ADDICTION_STATISTICS_THEME_TITLE]: "publicLife",
    [LANDSLIDE_STATISTICS_THEME_TITLE]: "environment",
    "疾病與健康統計 Disease & Health Statistics": "publicLife",
    "財稅與消費統計 Fiscal & Consumption Statistics": "city",
    "原民與農村統計 Indigenous & Rural Statistics": "city",
    "體育統計 Sports Statistics": "publicLife",
    "文化統計 Culture Statistics": "publicLife",
    "國有資產統計 State Assets Statistics": "city",
    "災害風險統計 Disaster Risk Statistics": "environment",
    "海洋統計 Marine Statistics": "environment",
    "治安統計 Crime Statistics": "safety",
    "原民與農村 Indigenous & Rural": "city",
    "海洋 Marine": "environment",
    "統計比較": "publicLife",
    "教育與少子化統計": "publicLife",
    "醫療與長照統計": "publicLife",
    "住宅存量與使用": "city",
    "房地產統計 Real Estate Statistics": "city",
    "資源回收統計 Recycling Statistics": "environment",
    "水質與污水統計 Water Quality & Sewage Statistics": "environment",
    "空氣品質統計 Air Quality Statistics": "environment",
    "污染與公害統計 Pollution & Nuisance Statistics": "environment",
    "環境治理統計 Environmental Enforcement Statistics": "environment",
    "治安與交通 Safety & Transport": "safety",
    "行政區參考 Administrative Boundaries": "baseline",
    "底圖 Base Map": "baseline",
    "交通 Move": "city",
    "人口社經 People": "city",
    "都市分析 Urban Analysis": "city",
    "房地產 Real Estate": "city",
    "工商登記 Business Registry": "city",
    "基礎建設 Infrastructure": "publicLife",
    "教育 Education": "publicLife",
    "社福長照 Welfare": "publicLife",
    "運動休閒 Sports & Leisure": "publicLife",
    "文化 Culture": "publicLife",
    "宗教 Religion": "publicLife",
    "殯葬 Funeral": "publicLife",
    "觀光 Tourism": "publicLife",
    "醫療 Medical": "safety",
    "消防 Fire & Rescue": "safety",
    "災害 Hazard": "safety",
    "民防避難 Civil Defense": "safety",
    "執法治安 Law & Order": "safety",
    "環境氣候 Environment": "environment",
    "水資源 Water": "environment",
    "廢棄物 Waste": "environment",
    "能源 Energy": "environment",
    "農業 Agriculture": "environment",
    "動物福利 Animal Welfare": "environment",
    "林業 Forestry": "environment",
    "太空 Space": "intelligence",
    "情勢 Situation": "intelligence",
    [TAIWAN_TELECOM_THEME_TITLE]: "publicLife",
  },
  JP: {
    // 日本 tab 在 desktop 仍獨立；主題 title＝台灣主題的中文短名（機器字串不同），大分類同台灣對應主題。
    "底圖": "baseline",
    "交通": "city",
    "人口社經": "city",
    "基礎建設": "publicLife",
    "教育": "publicLife",
    "社福長照": "publicLife",
    "宗教": "publicLife",
    "觀光": "publicLife",
    "醫療": "safety",
    "災害": "safety",
    "執法治安": "safety",
    "環境氣候": "environment",
    "海洋": "environment",
    "水資源": "environment",
    "林業": "environment",
  },
  FR: {
    [FRANCE_TELECOM_THEME_TITLE]: "publicLife",
  },
  KR: {
    // 南韓主題 title＝台灣主題中文短名，大分類同台灣對應主題（比照英國、日本）。
    "底圖": "baseline",
  },
  GB: {
    // 英國主題 title＝台灣主題中文短名，大分類同台灣對應主題（比照日本）。
    "底圖": "baseline",
    "災害": "safety",
    "海洋": "environment",
    "水資源": "environment",
    "交通": "city",
    "環境氣候": "environment",
    "林業": "environment",
    "能源": "environment",
    "廢棄物": "environment",
    "教育": "publicLife",
    "社福長照": "publicLife",
    "醫療": "safety",
    "消防": "safety",
    "執法治安": "safety",
    "文化": "publicLife",
    "觀光": "publicLife",
    "房地產": "city",
    // 第 12 波：同台灣「工商登記」「殯葬」「農業」
    "工商登記": "city",
    "殯葬": "publicLife",
    "農業": "environment",
    // 英國統計（完整目錄）：同台灣「人口統計」「住宅存量與使用」歸移動與城市。
    "人口統計": "city",
    "社經統計": "city",
    "住宅統計": "city",
    // 第 12 波：作物面積，同台灣「農業統計」歸環境與資源
    "農業統計": "environment",
  },
  WORLD: {
    [GLOBAL_SITUATION_THEME_TITLE]: "intelligence",
    [GLOBAL_ENVIRONMENT_THEME_TITLE]: "environment",
    [COMMUNICATIONS_THEME_TITLE]: "publicLife",
    "全球氣候 Global Climate": "environment",
    "全球海事 Global Maritime": "intelligence",
  },
  SIM: {
    "雙北跨河橋梁中斷": "city",
    "臺北 307 走廊公車擁擠": "city",
  },
};

/**
 * 主題的顯示名稱（spec §5.5 LT1、layer-panel-unify P3）。`theme.title` 是識別字串（manifest
 * `section.theme`、大分類、各入口清單都拿它當 key），**不拆字**；畫面一律讀這張表。
 * 依國家主體分組：同名主題（例：日本「交通」與之後英國「交通」）各自有顯示名稱與副標。
 * - `sub`：副標小字。台灣、統計、世界用英文；日本 15 個主題用日文漢字（P3 B，與中文同字也照樣顯示）。
 * 新增主題時在所屬國家補一列；`layerCatalog` 測試會擋漏列。
 */
export interface ThemeName {
  zh: string;
  sub?: string;
}

const THEME_NAMES: Readonly<Record<ThemeScope, Readonly<Record<string, ThemeName>>>> = {
  TW: {
    // 統計入口的重組主題（STATISTICS_TAB_THEMES）
    "人口與教育 Population & Education": { zh: "人口與教育", sub: "Population & Education" },
    "醫療與長照 Health & Care": { zh: "醫療與長照", sub: "Health & Care" },
    "成癮與減害 Addiction & Harm Reduction": { zh: "成癮與減害", sub: "Addiction & Harm Reduction" },
    "犯罪與治安 Crime & Safety": { zh: "犯罪與治安", sub: "Crime & Safety" },
    "住宅與不動產 Housing & Property": { zh: "住宅與不動產", sub: "Housing & Property" },
    "公共運輸 Public Transport": { zh: "公共運輸", sub: "Public Transport" },
    "道路與車輛 Roads & Vehicles": { zh: "道路與車輛", sub: "Roads & Vehicles" },
    "交通用地 Transport Land": { zh: "交通用地", sub: "Transport Land" },
    "農林漁牧 Agriculture, Forestry & Fisheries": { zh: "農林漁牧", sub: "Agriculture, Forestry & Fisheries" },
    "環境與資源 Environment & Resources": { zh: "環境與資源", sub: "Environment & Resources" },
    "崩塌與水土保持 Landslides & Soil Conservation": { zh: "崩塌與水土保持", sub: "Landslides & Soil Conservation" },
    "財稅與消費 Fiscal & Consumption": { zh: "財稅與消費", sub: "Fiscal & Consumption" },
    "體育運動 Sports": { zh: "體育運動", sub: "Sports" },
    "文化與藝文 Culture & Arts": { zh: "文化與藝文", sub: "Culture & Arts" },
    "災害風險 Disaster Risk": { zh: "災害風險", sub: "Disaster Risk" },
    "海洋 Marine": { zh: "海洋", sub: "Marine" },
    "原民與農村 Indigenous & Rural": { zh: "原民與農村", sub: "Indigenous & Rural" },
    "地圖參考 Map Reference": { zh: "地圖參考", sub: "Map Reference" },
    "工作與所得 Work & Income": { zh: "工作與所得", sub: "Work & Income" },
    "農業統計": { zh: "農業統計" },
    "畜牧統計": { zh: "畜牧統計" },
    "漁業統計": { zh: "漁業統計" },
    "林業統計": { zh: "林業統計" },
    "交通統計 Transport Statistics": { zh: "交通統計", sub: "Transport Statistics" },
    "水資源統計 Water Statistics": { zh: "水資源統計", sub: "Water Statistics" },
    "廢棄物統計 Waste Statistics": { zh: "廢棄物統計", sub: "Waste Statistics" },
    "能源統計 Energy Statistics": { zh: "能源統計", sub: "Energy Statistics" },
    "農業統計 Agriculture Statistics": { zh: "農業統計", sub: "Agriculture Statistics" },
    "人口統計 Population Statistics": { zh: "人口統計", sub: "Population Statistics" },
    "成癮與減害統計 Addiction & Harm Reduction Statistics": { zh: "成癮與減害統計", sub: "Addiction & Harm Reduction Statistics" },
    "崩塌與水土保持統計 Landslide & Soil Conservation Statistics": { zh: "崩塌與水土保持統計", sub: "Landslide & Soil Conservation Statistics" },
    "疾病與健康統計 Disease & Health Statistics": { zh: "疾病與健康統計", sub: "Disease & Health Statistics" },
    "財稅與消費統計 Fiscal & Consumption Statistics": { zh: "財稅與消費統計", sub: "Fiscal & Consumption Statistics" },
    "原民與農村統計 Indigenous & Rural Statistics": { zh: "原民與農村統計", sub: "Indigenous & Rural Statistics" },
    "體育統計 Sports Statistics": { zh: "體育統計", sub: "Sports Statistics" },
    "文化統計 Culture Statistics": { zh: "文化統計", sub: "Culture Statistics" },
    "國有資產統計 State Assets Statistics": { zh: "國有資產統計", sub: "State Assets Statistics" },
    "災害風險統計 Disaster Risk Statistics": { zh: "災害風險統計", sub: "Disaster Risk Statistics" },
    "海洋統計 Marine Statistics": { zh: "海洋統計", sub: "Marine Statistics" },
    "治安統計 Crime Statistics": { zh: "治安統計", sub: "Crime Statistics" },
    "統計比較": { zh: "統計比較" },
    "教育與少子化統計": { zh: "教育與少子化統計" },
    "醫療與長照統計": { zh: "醫療與長照統計" },
    "住宅存量與使用": { zh: "住宅存量與使用" },
    "房地產統計 Real Estate Statistics": { zh: "房地產統計", sub: "Real Estate Statistics" },
    "資源回收統計 Recycling Statistics": { zh: "資源回收統計", sub: "Recycling Statistics" },
    "水質與污水統計 Water Quality & Sewage Statistics": { zh: "水質與污水統計", sub: "Water Quality & Sewage Statistics" },
    "空氣品質統計 Air Quality Statistics": { zh: "空氣品質統計", sub: "Air Quality Statistics" },
    "污染與公害統計 Pollution & Nuisance Statistics": { zh: "污染與公害統計", sub: "Pollution & Nuisance Statistics" },
    "環境治理統計 Environmental Enforcement Statistics": { zh: "環境治理統計", sub: "Environmental Enforcement Statistics" },
    "治安與交通 Safety & Transport": { zh: "治安與交通", sub: "Safety & Transport" },
    "行政區參考 Administrative Boundaries": { zh: "行政區參考", sub: "Administrative Boundaries" },
    "底圖 Base Map": { zh: "底圖", sub: "Base Map" },
    "交通 Move": { zh: "交通", sub: "Move" },
    "人口社經 People": { zh: "人口社經", sub: "People" },
    "都市分析 Urban Analysis": { zh: "都市分析", sub: "Urban Analysis" },
    "房地產 Real Estate": { zh: "房地產", sub: "Real Estate" },
    "工商登記 Business Registry": { zh: "工商登記", sub: "Business Registry" },
    "基礎建設 Infrastructure": { zh: "基礎建設", sub: "Infrastructure" },
    "教育 Education": { zh: "教育", sub: "Education" },
    "社福長照 Welfare": { zh: "社福長照", sub: "Welfare" },
    "運動休閒 Sports & Leisure": { zh: "運動休閒", sub: "Sports & Leisure" },
    "文化 Culture": { zh: "文化", sub: "Culture" },
    "宗教 Religion": { zh: "宗教", sub: "Religion" },
    "殯葬 Funeral": { zh: "殯葬", sub: "Funeral" },
    "觀光 Tourism": { zh: "觀光", sub: "Tourism" },
    "醫療 Medical": { zh: "醫療", sub: "Medical" },
    "消防 Fire & Rescue": { zh: "消防", sub: "Fire & Rescue" },
    "災害 Hazard": { zh: "災害", sub: "Hazard" },
    "民防避難 Civil Defense": { zh: "民防避難", sub: "Civil Defense" },
    "執法治安 Law & Order": { zh: "執法治安", sub: "Law & Order" },
    "環境氣候 Environment": { zh: "環境氣候", sub: "Environment" },
    "水資源 Water": { zh: "水資源", sub: "Water" },
    "廢棄物 Waste": { zh: "廢棄物", sub: "Waste" },
    "能源 Energy": { zh: "能源", sub: "Energy" },
    "農業 Agriculture": { zh: "農業", sub: "Agriculture" },
    "動物福利 Animal Welfare": { zh: "動物福利", sub: "Animal Welfare" },
    "林業 Forestry": { zh: "林業", sub: "Forestry" },
    "太空 Space": { zh: "太空", sub: "Space" },
    "情勢 Situation": { zh: "情勢", sub: "Situation" },
    [TAIWAN_TELECOM_THEME_TITLE]: { zh: "通訊", sub: "Telecommunications" },
  },
  JP: {
    "底圖": { zh: "底圖", sub: "ベースマップ" },
    "交通": { zh: "交通", sub: "交通" },
    "人口社經": { zh: "人口社經", sub: "人口・社会経済" },
    "基礎建設": { zh: "基礎建設", sub: "インフラ" },
    "教育": { zh: "教育", sub: "教育" },
    "社福長照": { zh: "社福長照", sub: "社会福祉・介護" },
    "宗教": { zh: "宗教", sub: "宗教" },
    "觀光": { zh: "觀光", sub: "観光" },
    "醫療": { zh: "醫療", sub: "医療" },
    "災害": { zh: "災害", sub: "災害" },
    "執法治安": { zh: "執法治安", sub: "警察・治安" },
    "環境氣候": { zh: "環境氣候", sub: "環境・気候" },
    "海洋": { zh: "海洋", sub: "海洋" },
    "林業": { zh: "林業", sub: "林業" },
    "水資源": { zh: "水資源", sub: "水資源" },
  },
  FR: {
    // 法國主題副標用法文（比照日本主題用日文）
    [FRANCE_TELECOM_THEME_TITLE]: { zh: "通訊", sub: "Télécommunications" },
  },
  KR: {
    // 南韓主題副標用韓文（比照日本用日文、法國用法文）
    "底圖": { zh: "底圖", sub: "기본도" },
  },
  GB: {
    // 英國主題副標用英文（比照日本用日文、法國用法文）
    "底圖": { zh: "底圖", sub: "Base Map" },
    "災害": { zh: "災害", sub: "Hazard" },
    "海洋": { zh: "海洋", sub: "Marine" },
    "水資源": { zh: "水資源", sub: "Water" },
    "交通": { zh: "交通", sub: "Transport" },
    "環境氣候": { zh: "環境氣候", sub: "Environment" },
    "林業": { zh: "林業", sub: "Forestry" },
    "能源": { zh: "能源", sub: "Energy" },
    "廢棄物": { zh: "廢棄物", sub: "Waste" },
    "教育": { zh: "教育", sub: "Education" },
    "社福長照": { zh: "社福長照", sub: "Welfare" },
    "醫療": { zh: "醫療", sub: "Medical" },
    "消防": { zh: "消防", sub: "Fire & Rescue" },
    "執法治安": { zh: "執法治安", sub: "Law & Order" },
    "文化": { zh: "文化", sub: "Culture" },
    "觀光": { zh: "觀光", sub: "Tourism" },
    "房地產": { zh: "房地產", sub: "Real Estate" },
    "工商登記": { zh: "工商登記", sub: "Business Registry" },
    "殯葬": { zh: "殯葬", sub: "Funeral" },
    // 英國統計：完整目錄三個、統計分頁三個
    "人口統計": { zh: "人口統計", sub: "Population Statistics" },
    "社經統計": { zh: "社經統計", sub: "Socio-economic Statistics" },
    "住宅統計": { zh: "住宅統計", sub: "Housing Statistics" },
    "人口": { zh: "人口", sub: "Population" },
    "社經": { zh: "社經", sub: "Socio-economic" },
    "住宅": { zh: "住宅", sub: "Housing" },
    "農業統計": { zh: "農業統計", sub: "Agriculture Statistics" },
    "農業": { zh: "農業", sub: "Agriculture" },
  },
  WORLD: {
    [GLOBAL_SITUATION_THEME_TITLE]: { zh: "全球情勢", sub: "Global Situation" },
    [GLOBAL_ENVIRONMENT_THEME_TITLE]: { zh: "全球環境", sub: "Global Environment" },
    [COMMUNICATIONS_THEME_TITLE]: { zh: "全球通訊", sub: "Global Communications" },
    "全球氣候 Global Climate": { zh: "全球氣候", sub: "Global Climate" },
    "全球海事 Global Maritime": { zh: "全球海事", sub: "Global Maritime" },
  },
  SIM: {
    "雙北跨河橋梁中斷": { zh: "雙北跨河橋梁中斷", sub: "Bridge Disruption" },
    "臺北 307 走廊公車擁擠": { zh: "臺北 307 走廊公車擁擠", sub: "Bus Crowding" },
  },
};

/** 主題 → 顯示名稱；查不到時整串當中文（測試保證 THEMES 全部有列）。`names` 只給測試換 fixture 用。 */
export function themeName(theme: ThemeRef, names: ThemeTable<ThemeName> = THEME_NAMES): ThemeName {
  return names[theme.country]?.[theme.title] ?? { zh: theme.title };
}

/** 測試用：有登記顯示名稱的主題（`themeKey` 字串）。 */
export const THEME_NAME_KEYS: ReadonlySet<string> = new Set(
  Object.entries(THEME_NAMES).flatMap(([country, names]) => Object.keys(names).map((title) => themeKey({ country: country as ThemeScope, title }))),
);

/** 主題 → 大分類；未登記直接丟錯。`groups` 只給測試換 fixture 用。 */
export function themeMacroGroup(theme: ThemeRef, groups: ThemeTable<LayerMacroGroup> = THEME_MACRO_GROUPS): LayerMacroGroup {
  const group = groups[theme.country]?.[theme.title];
  if (!group) throw new Error(`[layerCatalog] 未分類的 theme: ${themeKey(theme)}`);
  return group;
}

const MACRO_GROUP_ORDER = new Map(
  LAYER_MACRO_GROUPS.map((group, index) => [group.key, index]),
);

/** Sidebar 顯示順序；同一大分類內保留目錄原有順序。 */
export const THEMES: ThemeDef[] = [...THEME_CATALOG].sort(
  (a, b) => MACRO_GROUP_ORDER.get(themeMacroGroup(a))! - MACRO_GROUP_ORDER.get(themeMacroGroup(b))!,
);

/** 以 (country, title) 找主題；找不到回 undefined。 */
export function findTheme(country: ThemeScope, title: string, themes: readonly ThemeDef[] = THEMES): ThemeDef | undefined {
  return themes.find((theme) => theme.country === country && theme.title === title);
}

/**
 * 某 scope（世界、日本、法國…）的主題：先依全站大分類，同一大分類內照 `THEME_SCOPE` 登記順序。
 * 台灣入口不走這裡（直接沿用 `THEMES` 順序，見 layerPanels.ts `MAIN_THEMES`）。
 * `themes`／`tables` 只給測試換 fixture 用。
 */
export function scopeThemes(
  scope: ThemeScope,
  themes: readonly ThemeDef[] = THEMES,
  tables: { scope?: Readonly<Partial<Record<ThemeScope, readonly string[]>>>; macroGroups?: ThemeTable<LayerMacroGroup> } = {},
): ThemeDef[] {
  const order = themeTitlesForScope(scope, tables.scope ?? THEME_SCOPE);
  const macroIndex = (theme: ThemeDef) => MACRO_GROUP_ORDER.get(themeMacroGroup(theme, tables.macroGroups ?? THEME_MACRO_GROUPS))!;
  return themes.filter((theme) => theme.country === scope)
    .sort((a, b) => macroIndex(a) - macroIndex(b) || order.indexOf(a.title) - order.indexOf(b.title));
}

// ── SECTIONS（derived flat — backward compat for 兩個 sidebar 元件）──
// 每個 SubGroup 攤平為一筆 SectionDef，title = `主題 English · 子群中文`，
// 視覺上連續行構成主題分組。下一階段 sidebar 升級後可直接消費 THEMES。

export const SECTIONS: SectionDef[] = THEMES.flatMap((theme) =>
  theme.groups.map((group) => ({
    title: `${theme.title} · ${group.title}`,
    layers: group.layers,
  })),
);

// SECTIONS 派生 → 給 overlayManager hydrate 等需要 user-facing label 的場景查表
export const LAYER_LABELS: Partial<Record<keyof LayerVisibility, string>> = (() => {
  const out: Partial<Record<keyof LayerVisibility, string>> = {};
  for (const section of SECTIONS) {
    for (const def of section.layers) out[def.key] = def.label;
  }
  return out;
})();

/** 結構化名稱查表（P2）：搜尋結果、資料來源、我的等只拿到 key 的清單用它顯示雙語名稱。 */
export const LAYER_NAMES: Partial<Record<keyof LayerVisibility, LayerName>> = (() => {
  const out: Partial<Record<keyof LayerVisibility, LayerName>> = {};
  for (const section of SECTIONS) {
    for (const def of section.layers) out[def.key] = def.name;
  }
  return out;
})();

/** key → 結構化名稱；查不到（例 orphan、Agent 臨時圖層）就用傳入的整串名稱當中文主名。 */
export function layerDisplayName(key: string, fallback?: string): LayerName {
  return LAYER_NAMES[key as keyof LayerVisibility] ?? { zh: fallback ?? key };
}

// ── owner-only 私人圖層 SSOT（見 docs/features/owner-gated-layers）──
// 只有登入且 profiles.tier='owner' 的帳號能開啟。非 owner：sidebar 顯示鎖頭 + toggle no-op。
// DB 端由 migration 275 同步：對應 RPC 加 owner 檢查 + REVOKE anon。
// ⚠️ 明確排除（保持公開）：waterCanals（灌排渠道）、powerPoles（電桿 2.96M）。
//
// ⚠️ **P3-3 評估過收編進 manifest，結論是不收**（與 TRANSPORT_LABELS 不同類），
//    三條硬理由（機械查證，非目測）：
//    1. **沒有值重複可消滅**：manifest 裡 `gated: true` 的 entry 是 **0 個**，
//       本表 35 個 key 全部只存在於這裡。收編＝**新增** 35 筆宣告，不是去重。
//    2. **型別上表達不了**：`gated` 只存在於 `LayerManifestThemedEntry`，而本表有
//       3 個 key（facOffshore / osmPowerPlantsStatic / powerPlants）是 orphan entry
//       ——「已從 sidebar 下架但 API 敏感」正是它們要被鎖的理由，卻沒有 LayerDef 可載。
//    3. **這是安全清單不是登記簿**：embedWhitelist / urlState / layerGates 三套測試
//       以本表為錨（gated 外流＝私人資料洩漏）。搬 SSOT 是安全變更，要獨立驗收標準，
//       不該搭在一次去重重構裡。
export const GATED_LAYERS: ReadonlySet<keyof LayerVisibility> = new Set<keyof LayerVisibility>([
  // 畜牧 Livestock（改走 owner-only RPC；不含 livestockFeed / livestockMarket）
  "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck",
  "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther", "livestockSlaughter",
  // 石化 · 油氣
  "lpgSubpackaging", "lpgRetailers", "lngTerminal", "pipelineGas", "pipelineOilGas",
  "industrialRefinery", "industrialStorageTank", "industrialPowerPlant", "coalTerminal",
  "fossilFuelInfra",
  // 電力 · 電網
  "osmSubstationsEhv", "osmSubstations", "osmPowerLines", "osmPowerTowers",
  "substationEhvGlow", "powerLinesGlow",
  // 電力 · 廠
  "facPrimary", "facPlanned", "facHistorical", "facSecondary", "facOsmSupplement",
  "powerGenerationUnit", "powerPlantGlow",
  // 僅做 UI 鎖（資料載入路徑不動）
  "aviationRestrictedGlow",
  // 公車擁擠模擬（模擬面板，研究中）：使用者 2026-10-25 拍板站主限定，資料只經 owner-authenticated Range API。
  "busCrowdingSim",
  // 已從 sidebar 下架但 API 敏感（無鎖頭 UI；仍 gate 掉 bulk/chat 等程式化開啟路徑）
  "facOffshore", "osmPowerPlantsStatic", "powerPlants",
  // 日本水資源：靜態 PMTiles 只經 owner-authenticated Range API，不存在公開資產 URL。
  "jpWaterDams", "jpWaterRivers", "jpWaterSupplyFacilities", "jpWaterSupplyAreas",
  "jpWaterSewerFacilities", "jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds",
  // 全臺橋梁研究（進行中）：BSS 授權 HOLD，私人 PMTiles 只經 owner-authenticated Range API。
  "bssNationalBridgePreview", "bssNationalBridgePointsPreview",
  // 雙北跨河橋梁韌性（研究中）：同一 BSS 授權 HOLD；私人 PMTiles＋JSON 只經 owner-authenticated Range API。
  "bridgeResilienceTwinCity",
  // 土壤液化／軟弱土層（RIGHTS_HOLD）：私人 PMTiles 只經 owner-authenticated Range API。
  "soilLiquefactionPotential", "weakSoilClay0To5", "weakSoilSand0To5", "weakSoilClay5To10",
  "weakSoilSand5To10", "weakSoilClay10To20", "weakSoilSand10To20", "liquefactionMonitoringSites",
]);

/**
 * 授權或再散布條件尚未驗證、且連站主研究檢視也不開放的圖層：所有帳號均 fail-closed。
 *
 * RIGHTS_HOLD（再利用授權未確認）的圖層**一律不可公開發布**；owner gate 不等於取得授權，
 * 不能拿來把 RIGHTS_HOLD 圖層開給其他帳號。但經站主決定（2026-09-29），RIGHTS_HOLD 圖層
 * 允許以 owner gate（App.tsx `lockedKeys` 依私人存取驗證解鎖＋私人 Range API，站主限定）做**研究用途**上線，
 * 這類圖層不列入本表（列入會連站主也鎖死）。目前適用：
 *   - 土壤液化 8 層：soilLiquefactionPotential、weakSoilClay0To5、weakSoilSand0To5、
 *     weakSoilClay5To10、weakSoilSand5To10、weakSoilClay10To20、weakSoilSand10To20、
 *     liquefactionMonitoringSites（manifest topics 帶 OWNER_ONLY／RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED）
 *   - 全臺橋梁研究（BSS）：bssNationalBridgePreview、bssNationalBridgePointsPreview
 *   - 雙北跨河橋梁韌性（研究中）：bridgeResilienceTwinCity
 *   - 日本水資源全國 8 層（KSJ 舊約款排除再配布；2026-09-29 站主決定改回站主限定，
 *     私人 Range API /api/private-research/jp-water/*）：jpWaterDams、jpWaterRivers、
 *     jpWaterSupplyFacilities、jpWaterSupplyAreas、jpWaterSewerFacilities、
 *     jpWaterGroundwaterSites、jpWaterNilimDams、jpWaterAgriculturalPonds
 * 新增同類圖層時照此辦理並補進上列清單；要對外公開前須先確認授權。
 */
export const RELEASE_HOLD_LAYERS: ReadonlySet<keyof LayerVisibility> = new Set<keyof LayerVisibility>([
  "historicalFlightTrails", "jpHistoricalFlightTrails",
]);

/** 對某使用者而言此 key 是否上鎖（gated 且非 owner）。 */
export function isLayerLockedFor(key: keyof LayerVisibility, isOwner: boolean): boolean {
  return !isOwner && GATED_LAYERS.has(key);
}
