import type { LayerVisibility } from "../../types";
import { STATISTICS_RENDER_KEYS } from "../../data/regionalStatisticsRecipes";
import { GB_STATISTICS_TAB_THEMES, KR_STATISTICS_TAB_THEMES, LAYER_MACRO_GROUPS, THEMES, scopeThemes, STATISTICS_DATA_THEMES, STATISTICS_TAB_THEMES, themeMacroGroup, withoutStatisticsLayers, type ThemeDef } from "./layerCatalog";
import { COUNTRIES, type CountryCode } from "../../constants/countries";

/**
 * 圖層面板四個入口（圖層／統計／世界／模擬；模擬只對站主顯示）—— 桌機 rail 與手機底部面板共用同一份定義
 * （layer-panel-unify P7）。每個入口只差主題清單與兩三個開關，面板本體都是 `LayersPanel`。
 * 「圖層」與「統計」依目前國家主體（`countryStore`）換內容：圖層＝該國主題樹（2026-10-28 國家主體化）；
 * 統計＝台灣、英國與南韓（2026-10-29 統計面板多國化，南韓 2026-10-31），其他國家顯示未涵蓋。
 */
export type LayerPanelId = "layers" | "statistics" | "world" | "simulation";

/**
 * 面板內的大分類（spec §5.5、layer-panel-unify P4）。每個入口一份定義，資料驅動：
 * 面板依陣列順序顯示大分類標題，主題依 `themes` 歸組；主題在面板清單裡必須按組相鄰（測試鎖住）。
 */
export interface PanelMacroGroup {
  zh: string;
  en?: string;
  /** 屬於這個大分類的主題 `title`（面板只放單一國家主體的主題，title 在面板內唯一；測試鎖住） */
  themes: readonly string[];
}

export interface LayerPanelDef {
  id: LayerPanelId;
  /** 面板標題（桌機 PanelHeader） */
  title: string;
  /** 手機分頁與「其他面板還有 N 筆」提示用的短名 */
  shortTitle: string;
  themes: ThemeDef[];
  /** 大分類；沒給就不分（模擬入口目前不分） */
  macroGroups?: readonly PanelMacroGroup[];
  /** 「全部關閉」只關這些 key；未給則關全站 */
  allOffKeys?: (keyof LayerVisibility)[];
  /** 統計入口的「單一／可重疊」切換 */
  statisticsModeControl?: boolean;
  /** 依國家主體換內容的入口（頂部顯示國家選單）；`countries` 給了＝只涵蓋這些國家，其他國家顯示未涵蓋 */
  countryScoped?: boolean;
  countries?: readonly CountryCode[];
}

export function getThemeLayerKeys(themes: readonly ThemeDef[]): (keyof LayerVisibility)[] {
  return themes.flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key)));
}

/** 依全站大分類（`THEME_MACRO_GROUPS`）派生面板大分類；空的大分類不顯示。 */
function sharedMacroGroups(themes: readonly ThemeDef[]): PanelMacroGroup[] {
  return LAYER_MACRO_GROUPS.map((group) => ({
    zh: group.zh,
    en: group.en,
    themes: themes.filter((theme) => themeMacroGroup(theme) === group.key).map((theme) => theme.title),
  })).filter((group) => group.themes.length > 0);
}

// 「世界」入口：主題依全站大分類排（2026-10-03 使用者決定 W-A，公共生活→環境與資源→情報），同類內照登記陣列。
// 「日本」「法國」入口同樣依全站大分類排（2026-10-26）；台灣入口渲染其餘非統計主題。
// 一律以 `ThemeDef.country` 篩（主題身分是 (country, title)，不同國家可同名）。
export const WORLD_THEMES = scopeThemes("WORLD");
export const JAPAN_THEMES = scopeThemes("JP");
/** 統計資料主題都屬台灣（`taiwanThemes`），只在台灣內以 title 比對。 */
const statisticsDataThemeTitles = new Set(STATISTICS_DATA_THEMES.map((theme) => theme.title));
/** 「模擬」入口（站主限定）：雙北跨河橋梁中斷、臺北 307 走廊公車擁擠兩個主題。 */
export const SIMULATION_THEMES = THEMES.filter((t) => t.country === "SIM");
/** 台灣入口：country 為 TW 的主題，扣掉統計資料主題、再濾掉統計面（統計面在統計入口）。 */
export const MAIN_THEMES = withoutStatisticsLayers(THEMES.filter((t) => t.country === "TW" && !statisticsDataThemeTitles.has(t.title)));

/** 法國：目前只有「通訊」（ANFR，2026-10-28）。 */
export const FRANCE_THEMES = scopeThemes("FR");

/** 英國：2026-10-29 第 0b 波起（底圖／行政邊界），之後各波照台灣主題名加入。統計面（LAD 統計）在統計入口，比照台灣從圖層頁濾掉。 */
export const UK_THEMES = withoutStatisticsLayers(scopeThemes("GB"));

/** 南韓：2026-10-31 第 0 波起（底圖／行政邊界），之後各波照台灣主題名加入。 */
export const KOREA_THEMES = withoutStatisticsLayers(scopeThemes("KR"));

/** 台灣：沿用全站大分類（`THEME_MACRO_GROUPS`，同時決定 THEMES 排序）。 */
const TAIWAN_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(MAIN_THEMES);

/** 世界：沿用台灣大分類名與同一張對照（W-A，2026-10-03 使用者決定）。 */
export const WORLD_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(WORLD_THEMES);

/**
 * 統計：依政府統計領域分 5 類（S-B，2026-10-03 使用者決定，PLAN.md §3）。
 * `STATISTICS_TAB_THEMES` 已照這個順序排。
 */
export const STATISTICS_MACRO_GROUPS: PanelMacroGroup[] = [
  { zh: "人口與社會", en: "Population & Society", themes: ["人口與教育 Population & Education", "醫療與長照 Health & Care", "成癮與減害 Addiction & Harm Reduction", "犯罪與治安 Crime & Safety", "體育運動 Sports", "文化與藝文 Culture & Arts"] },
  { zh: "經濟與住宅", en: "Economy & Housing", themes: ["工作與所得 Work & Income", "住宅與不動產 Housing & Property", "財稅與消費 Fiscal & Consumption"] },
  { zh: "交通", en: "Transport", themes: ["公共運輸 Public Transport", "道路與車輛 Roads & Vehicles", "交通用地 Transport Land"] },
  { zh: "土地與環境", en: "Land & Environment", themes: ["農林漁牧 Agriculture, Forestry & Fisheries", "環境與資源 Environment & Resources", "崩塌與水土保持 Landslides & Soil Conservation", "災害風險 Disaster Risk", "海洋 Marine"] },
  { zh: "基準", en: "Baseline", themes: ["地圖參考 Map Reference"] },
];

/** 英國統計：沿用統計入口的大分類名（人口與社會／經濟與住宅）；剝奪指數屬社經，與住宅同列經濟。 */
export const GB_STATISTICS_MACRO_GROUPS: PanelMacroGroup[] = [
  { zh: "人口與社會", en: "Population & Society", themes: ["人口"] },
  { zh: "經濟與住宅", en: "Economy & Housing", themes: ["社經", "住宅"] },
  // 第 12 波：作物面積，比照台灣「農林漁牧」所在的「土地與環境」
  { zh: "土地與環境", en: "Land & Environment", themes: ["農業"] },
];

/** 南韓統計：沿用統計入口的大分類名（人口與社會／經濟與住宅）。 */
export const KR_STATISTICS_MACRO_GROUPS: PanelMacroGroup[] = [
  { zh: "人口與社會", en: "Population & Society", themes: ["人口"] },
  { zh: "經濟與住宅", en: "Economy & Housing", themes: ["社經"] },
];

/** 日本：沿用台灣共用大分類（2026-10-26 使用者決定；主題 title＝台灣主題中文短名，大分類同台灣對應主題）。 */
export const JAPAN_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(JAPAN_THEMES);

/** 法國：沿用全站大分類。 */
export const FRANCE_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(FRANCE_THEMES);

/** 南韓：沿用全站大分類。 */
export const KOREA_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(KOREA_THEMES);

/** 英國：沿用全站大分類。 */
export const UK_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(UK_THEMES);

/**
 * 各國「圖層」入口的主題樹。新增國家：`CountryCode` 加碼後這裡會缺鍵報 tsc 錯；
 * 台灣以外照 `{ themes: scopeThemes(code), macroGroups: sharedMacroGroups(themes) }` 登記。
 */
const COUNTRY_LAYER_THEMES: Record<CountryCode, { themes: ThemeDef[]; macroGroups: PanelMacroGroup[] }> = {
  TW: { themes: MAIN_THEMES, macroGroups: TAIWAN_MACRO_GROUPS },
  JP: { themes: JAPAN_THEMES, macroGroups: JAPAN_MACRO_GROUPS },
  FR: { themes: FRANCE_THEMES, macroGroups: FRANCE_MACRO_GROUPS },
  GB: { themes: UK_THEMES, macroGroups: UK_MACRO_GROUPS },
  KR: { themes: KOREA_THEMES, macroGroups: KOREA_MACRO_GROUPS },
};

/** 某國在「圖層」入口的主題樹。 */
export function countryLayerThemes(code: CountryCode): ThemeDef[] {
  return COUNTRY_LAYER_THEMES[code].themes;
}

/** 某國「圖層」入口的全部圖層 key（「全部關閉」只關這些，§8 乙）。 */
const countryAllOffCache = new Map<CountryCode, (keyof LayerVisibility)[]>();
export function countryLayerKeys(code: CountryCode): (keyof LayerVisibility)[] {
  let keys = countryAllOffCache.get(code);
  if (!keys) {
    keys = getThemeLayerKeys(countryLayerThemes(code));
    countryAllOffCache.set(code, keys);
  }
  return keys;
}

/** 統計入口的「全部關閉」範圍：各國統計主題（台灣、英國、南韓）＋只為相容舊網址存在的統計 render key。 */
export const STATISTICS_ALL_OFF_KEYS = [...new Set([...getThemeLayerKeys(STATISTICS_TAB_THEMES), ...getThemeLayerKeys(GB_STATISTICS_TAB_THEMES), ...getThemeLayerKeys(KR_STATISTICS_TAB_THEMES), ...STATISTICS_RENDER_KEYS])];

/** 各國「統計」入口的主題樹；不在表內的國家＝未涵蓋（空狀態）。 */
const COUNTRY_STATISTICS_THEMES: Partial<Record<CountryCode, { themes: ThemeDef[]; macroGroups: readonly PanelMacroGroup[] }>> = {
  TW: { themes: STATISTICS_TAB_THEMES, macroGroups: STATISTICS_MACRO_GROUPS },
  GB: { themes: GB_STATISTICS_TAB_THEMES, macroGroups: GB_STATISTICS_MACRO_GROUPS },
  KR: { themes: KR_STATISTICS_TAB_THEMES, macroGroups: KR_STATISTICS_MACRO_GROUPS },
};

/** 四個入口，順序＝桌機 rail 由上到下＝手機分頁由左到右。`layers` 的 `themes` 是台灣（預設國家）版本，實際依國家用 `resolveLayerPanel`。 */
export const LAYER_PANELS: readonly LayerPanelDef[] = [
  { id: "layers", title: "圖層 Layers", shortTitle: "圖層", themes: MAIN_THEMES, macroGroups: TAIWAN_MACRO_GROUPS, countryScoped: true },
  { id: "statistics", title: "統計 Statistics", shortTitle: "統計", themes: STATISTICS_TAB_THEMES, macroGroups: STATISTICS_MACRO_GROUPS, allOffKeys: STATISTICS_ALL_OFF_KEYS, statisticsModeControl: true, countryScoped: true, countries: ["TW", "GB", "KR"] },
  { id: "world", title: "世界 World", shortTitle: "世界", themes: WORLD_THEMES, macroGroups: WORLD_MACRO_GROUPS },
  // 模擬：大分類先不分（macroGroups 不給）。只有站主看得到 → 一律經 `visibleLayerPanels(isOwner)` 取清單。
  { id: "simulation", title: "模擬 Simulation", shortTitle: "模擬", themes: SIMULATION_THEMES },
];

/** 依國家主體解析後的入口內容。`covered=false`：本入口不涵蓋此國（統計在台灣、英國、南韓以外），面板顯示未涵蓋空狀態。 */
export interface ResolvedLayerPanel extends LayerPanelDef {
  covered: boolean;
}

export function resolveLayerPanel(id: LayerPanelId, country: CountryCode): ResolvedLayerPanel {
  const def = layerPanelDef(id);
  if (id === "layers") {
    const { themes, macroGroups } = COUNTRY_LAYER_THEMES[country];
    return { ...def, themes, macroGroups, allOffKeys: countryLayerKeys(country), covered: true };
  }
  const covered = !def.countries || def.countries.includes(country);
  if (!covered) return { ...def, themes: [], macroGroups: [], covered };
  const statistics = id === "statistics" ? COUNTRY_STATISTICS_THEMES[country] : undefined;
  return statistics ? { ...def, ...statistics, covered } : { ...def, covered };
}

/** 有資料的國家（國家選單順序）。 */
export const PANEL_COUNTRIES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);

/** 只有站主看得到「模擬」入口（simulation PLAN D-1）；非站主（含未登入、載入中）回傳不含模擬的清單。 */
export function visibleLayerPanels(isOwner: boolean): readonly LayerPanelDef[] {
  return isOwner ? LAYER_PANELS : LAYER_PANELS.filter((panel) => panel.id !== "simulation");
}

export const layerPanelDef = (id: LayerPanelId): LayerPanelDef => LAYER_PANELS.find((panel) => panel.id === id)!;

const panelKeyCache = new Map<string, Set<string>>();
/** 某入口在某國的全部圖層 key（搜尋「其他面板還有 N 筆」用）；國家省略＝台灣。 */
export function panelLayerKeys(id: LayerPanelId, country: CountryCode = "TW"): Set<string> {
  const cacheKey = `${id}:${country}`;
  let keys = panelKeyCache.get(cacheKey);
  if (!keys) {
    keys = new Set(getThemeLayerKeys(resolveLayerPanel(id, country).themes));
    panelKeyCache.set(cacheKey, keys);
  }
  return keys;
}
