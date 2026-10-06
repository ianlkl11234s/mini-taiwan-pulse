import type { LayerVisibility } from "../../types";
import { STATISTICS_RENDER_KEYS } from "../../data/regionalStatisticsRecipes";
import { LAYER_MACRO_GROUPS, THEMES, WORLD_TAB_THEME_TITLES, JAPAN_TAB_THEME_TITLES, STATISTICS_DATA_THEMES, STATISTICS_TAB_THEMES, themeMacroGroup, withoutStatisticsLayers, type ThemeDef } from "./layerCatalog";

/**
 * 圖層面板四個入口（台灣／統計／世界／日本）—— 桌機 rail 與手機底部面板共用同一份定義
 * （layer-panel-unify P7）。每個入口只差主題清單與兩三個開關，面板本體都是 `LayersPanel`。
 */
export type LayerPanelId = "layers" | "statistics" | "world" | "japan";

/**
 * 面板內的大分類（spec §5.5、layer-panel-unify P4）。每個入口一份定義，資料驅動：
 * 面板依陣列順序顯示大分類標題，主題依 `themes` 歸組；主題在面板清單裡必須按組相鄰（測試鎖住）。
 */
export interface PanelMacroGroup {
  zh: string;
  en?: string;
  /** 屬於這個大分類的主題 `title` */
  themes: readonly string[];
}

export interface LayerPanelDef {
  id: LayerPanelId;
  /** 面板標題（桌機 PanelHeader） */
  title: string;
  /** 手機分頁與「其他面板還有 N 筆」提示用的短名 */
  shortTitle: string;
  themes: ThemeDef[];
  /** 大分類；沒給就不分（四個入口目前都有） */
  macroGroups?: readonly PanelMacroGroup[];
  /** 「全部關閉」只關這些 key；未給則關全站 */
  allOffKeys?: (keyof LayerVisibility)[];
  /** 統計入口的「單一／可重疊」切換 */
  statisticsModeControl?: boolean;
}

export function getThemeLayerKeys(themes: readonly ThemeDef[]): (keyof LayerVisibility)[] {
  return themes.flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key)));
}

const macroGroupIndex = (title: string) => LAYER_MACRO_GROUPS.findIndex((group) => group.key === themeMacroGroup(title));

/** 依全站大分類（`THEME_MACRO_GROUPS`）派生面板大分類；空的大分類不顯示。 */
function sharedMacroGroups(themes: readonly ThemeDef[]): PanelMacroGroup[] {
  return LAYER_MACRO_GROUPS.map((group) => ({
    zh: group.zh,
    en: group.en,
    themes: themes.filter((theme) => themeMacroGroup(theme.title) === group.key).map((theme) => theme.title),
  })).filter((group) => group.themes.length > 0);
}

// 「世界」入口：主題依全站大分類排（2026-10-03 使用者決定 W-A，公共生活→環境與資源→情報），同類內照登記陣列。
// 「日本」入口順序照登記陣列；台灣入口渲染其餘非統計主題。
export const WORLD_THEMES = THEMES.filter((t) => WORLD_TAB_THEME_TITLES.includes(t.title))
  .sort((a, b) => macroGroupIndex(a.title) - macroGroupIndex(b.title)
    || WORLD_TAB_THEME_TITLES.indexOf(a.title) - WORLD_TAB_THEME_TITLES.indexOf(b.title));
export const JAPAN_THEMES = THEMES.filter((t) => JAPAN_TAB_THEME_TITLES.includes(t.title))
  .sort((a, b) => JAPAN_TAB_THEME_TITLES.indexOf(a.title) - JAPAN_TAB_THEME_TITLES.indexOf(b.title));
const statisticsDataThemeTitles = new Set(STATISTICS_DATA_THEMES.map((theme) => theme.title));
export const MAIN_THEMES = withoutStatisticsLayers(THEMES.filter((t) => !WORLD_TAB_THEME_TITLES.includes(t.title) && !JAPAN_TAB_THEME_TITLES.includes(t.title) && !statisticsDataThemeTitles.has(t.title)));

/** 台灣：沿用全站大分類（`THEME_MACRO_GROUPS`，同時決定 THEMES 排序）。 */
const TAIWAN_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(MAIN_THEMES);

/** 世界：沿用台灣大分類名與同一張對照（W-A，2026-10-03 使用者決定）。 */
export const WORLD_MACRO_GROUPS: PanelMacroGroup[] = sharedMacroGroups(WORLD_THEMES);

/**
 * 統計：依政府統計領域分 5 類（S-B，2026-10-03 使用者決定，PLAN.md §3）。
 * `STATISTICS_TAB_THEMES` 已照這個順序排。
 */
export const STATISTICS_MACRO_GROUPS: PanelMacroGroup[] = [
  { zh: "人口與社會", en: "Population & Society", themes: ["人口與教育 Population & Education", "醫療與長照 Health & Care", "成癮與減害 Addiction & Harm Reduction", "犯罪與治安 Crime & Safety"] },
  { zh: "經濟與住宅", en: "Economy & Housing", themes: ["工作與所得 Work & Income", "住宅與不動產 Housing & Property"] },
  { zh: "交通", en: "Transport", themes: ["公共運輸 Public Transport", "道路與車輛 Roads & Vehicles", "交通用地 Transport Land"] },
  { zh: "土地與環境", en: "Land & Environment", themes: ["農林漁牧 Agriculture, Forestry & Fisheries", "環境與資源 Environment & Resources"] },
  { zh: "基準", en: "Baseline", themes: ["地圖參考 Map Reference"] },
];

/** 日本：5 類（2026-10-03 使用者決定，PLAN.md §3）。`JAPAN_TAB_THEME_TITLES` 已照這個順序排。 */
export const JAPAN_MACRO_GROUPS: PanelMacroGroup[] = [
  { zh: "行政與人口", themes: ["行政區", "人口"] },
  { zh: "交通與旅宿", themes: ["交通", "旅宿"] },
  { zh: "醫療與照護", themes: ["醫療設施", "長照服務", "醫療圈"] },
  { zh: "社會", themes: ["治安", "教育", "宗教"] },
  { zh: "自然與環境", themes: ["自然保護", "世界遺產", "水資源", "高度與地表"] },
];

/** 統計入口的「全部關閉」範圍：含只為相容舊網址存在的統計 render key。 */
export const STATISTICS_ALL_OFF_KEYS = [...new Set([...getThemeLayerKeys(STATISTICS_TAB_THEMES), ...STATISTICS_RENDER_KEYS])];

/** 四個入口，順序＝桌機 rail 由上到下＝手機分頁由左到右。 */
export const LAYER_PANELS: readonly LayerPanelDef[] = [
  { id: "layers", title: "台灣 Taiwan", shortTitle: "台灣", themes: MAIN_THEMES, macroGroups: TAIWAN_MACRO_GROUPS },
  { id: "statistics", title: "統計 Statistics", shortTitle: "統計", themes: STATISTICS_TAB_THEMES, macroGroups: STATISTICS_MACRO_GROUPS, allOffKeys: STATISTICS_ALL_OFF_KEYS, statisticsModeControl: true },
  { id: "world", title: "世界 World", shortTitle: "世界", themes: WORLD_THEMES, macroGroups: WORLD_MACRO_GROUPS },
  { id: "japan", title: "日本 Japan", shortTitle: "日本", themes: JAPAN_THEMES, macroGroups: JAPAN_MACRO_GROUPS },
];

export const layerPanelDef = (id: LayerPanelId): LayerPanelDef => LAYER_PANELS.find((panel) => panel.id === id)!;

const panelKeyCache = new Map<LayerPanelId, Set<string>>();
/** 某入口的全部圖層 key（搜尋「其他面板還有 N 筆」用）。 */
export function panelLayerKeys(id: LayerPanelId): Set<string> {
  let keys = panelKeyCache.get(id);
  if (!keys) {
    keys = new Set(getThemeLayerKeys(layerPanelDef(id).themes));
    panelKeyCache.set(id, keys);
  }
  return keys;
}
